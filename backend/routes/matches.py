from flask import Blueprint, jsonify, request, current_app
from models import Match, BannedHero, Hero, Map, Player, MatchPlayer, OutcomeEnum, TeamEnum
from utils.db import get_db
from utils.scoreboard import parse_scoreboard, ScoreboardConfigError
from utils.rate_limit import SlidingWindowLimiter
from datetime import datetime

matches_bp = Blueprint('matches', __name__)

# Cap the paid scoreboard-parsing calls at 3 per rolling 24 hours (process-wide).
_scoreboard_limiter = SlidingWindowLimiter(max_calls=3, window_seconds=24 * 60 * 60)


@matches_bp.route('/heroes', methods=['GET'])
def get_heroes():
    db = get_db()
    session = db.get_session()
    try:
        heroes = session.query(Hero).order_by(Hero.role, Hero.hero_name).all()
        return jsonify([{
            'hero_id': h.hero_id,
            'hero_name': h.hero_name,
            'role': h.role.value
        } for h in heroes]), 200
    except Exception as e:
        return jsonify({'error': str(e)}), 500
    finally:
        session.close()


@matches_bp.route('/maps', methods=['GET'])
def get_maps():
    db = get_db()
    session = db.get_session()
    try:
        maps = session.query(Map).order_by(Map.map_type, Map.map_name).all()
        return jsonify([{
            'map_id': m.map_id,
            'map_name': m.map_name,
            'map_type': m.map_type.value
        } for m in maps]), 200
    except Exception as e:
        return jsonify({'error': str(e)}), 500
    finally:
        session.close()


@matches_bp.route('/matches', methods=['POST'])
def create_match():
    data = request.get_json()
    if not data:
        return jsonify({'error': 'No data provided'}), 400

    for field in ['date_time', 'map_id', 'final_score', 'outcome']:
        if field not in data:
            return jsonify({'error': f'Missing required field: {field}'}), 400

    db = get_db()
    session = db.get_session()
    try:
        try:
            outcome = OutcomeEnum(data['outcome'])
        except ValueError:
            return jsonify({'error': 'Invalid outcome. Must be win, loss, or draw'}), 400

        try:
            date_time = datetime.fromisoformat(data['date_time'])
        except ValueError:
            return jsonify({'error': 'Invalid date_time format'}), 400

        map_obj = session.query(Map).filter_by(map_id=data['map_id']).first()
        if not map_obj:
            return jsonify({'error': 'Map not found'}), 404

        match = Match(
            date_time=date_time,
            map_id=data['map_id'],
            final_score=data['final_score'],
            outcome=outcome,
            duration=float(data.get('duration', 0.0))
        )
        session.add(match)
        session.flush()

        for player_data in data.get('players', []):
            battle_tag = player_data.get('battle_tag', '').strip()
            if not battle_tag:
                continue

            player = session.query(Player).filter_by(user_id=battle_tag).first()
            if not player:
                player = Player(user_id=battle_tag)
                session.add(player)
                session.flush()

            try:
                team = TeamEnum(player_data.get('team', 'team1'))
            except ValueError:
                team = TeamEnum.team1

            for hero_data in player_data.get('heroes', []):
                hero_name = hero_data.get('hero_name', '').strip()
                if not hero_name:
                    continue
                hero = session.query(Hero).filter_by(hero_name=hero_name).first()
                if not hero:
                    continue

                mp = MatchPlayer(
                    match_id=match.match_id,
                    player_id=player.player_id,
                    hero_id=hero.hero_id,
                    team=team,
                    eliminations=int(hero_data.get('eliminations', 0)),
                    final_blows=int(hero_data.get('final_blows', 0)),
                    assists=int(hero_data.get('assists', 0)),
                    deaths=int(hero_data.get('deaths', 0)),
                    damage_done=float(hero_data.get('damage_done', 0.0)),
                    healing_done=float(hero_data.get('healing_done', 0.0)),
                    damage_mitigated=float(hero_data.get('damage_mitigated', 0.0)),
                    time_played=float(hero_data.get('time_played', 0.0))
                )
                session.add(mp)

        bans_data = data.get('bans', {})
        for team_key in ['team1', 'team2']:
            for hero_name in bans_data.get(team_key, []):
                hero = session.query(Hero).filter_by(hero_name=hero_name).first()
                if hero:
                    ban = BannedHero(
                        match_id=match.match_id,
                        hero_id=hero.hero_id,
                        team=TeamEnum(team_key)
                    )
                    session.add(ban)

        session.commit()
        return jsonify({'match_id': match.match_id, 'message': 'Match created successfully'}), 201

    except Exception as e:
        session.rollback()
        return jsonify({'error': str(e)}), 500
    finally:
        session.close()


ALLOWED_IMAGE_TYPES = {"image/png", "image/jpeg", "image/webp", "image/gif"}
MAX_IMAGE_BYTES = 10 * 1024 * 1024  # 10 MB


@matches_bp.route('/matches/parse_scoreboard', methods=['POST'])
def parse_scoreboard_route():
    upload = request.files.get('image')
    if upload is None or upload.filename == '':
        return jsonify({'error': 'No image uploaded'}), 400

    media_type = upload.mimetype
    if media_type not in ALLOWED_IMAGE_TYPES:
        return jsonify({'error': 'Unsupported image type'}), 400

    image_bytes = upload.read()
    if not image_bytes:
        return jsonify({'error': 'Empty image'}), 400
    if len(image_bytes) > MAX_IMAGE_BYTES:
        return jsonify({'error': 'Image too large (max 10 MB)'}), 400

    allowed, retry_after = _scoreboard_limiter.allow()
    if not allowed:
        hours = retry_after // 3600 + 1
        resp = jsonify({
            'error': f'Daily scoreboard limit reached (3 per day). '
                     f'Try again in about {hours} hour{"s" if hours != 1 else ""}.'
        })
        resp.status_code = 429
        resp.headers['Retry-After'] = str(retry_after)
        return resp

    db = get_db()
    session = db.get_session()
    try:
        heroes = session.query(Hero).order_by(Hero.role, Hero.hero_name).all()
        hero_names_by_role = {}
        for h in heroes:
            hero_names_by_role.setdefault(h.role.value, []).append(h.hero_name)
    finally:
        session.close()

    try:
        players = parse_scoreboard(image_bytes, media_type, hero_names_by_role)
    except ScoreboardConfigError:
        # No model call was made — don't count it against the daily limit.
        _scoreboard_limiter.refund()
        return jsonify({
            'error': 'Scoreboard parsing is not configured. '
                     'Set the ANTHROPIC_API_KEY environment variable.'
        }), 503
    except Exception:
        current_app.logger.exception('Scoreboard parsing failed')
        return jsonify({'error': 'Failed to read the scoreboard image'}), 502

    return jsonify({'players': players}), 200


@matches_bp.route('/matches', methods=['GET'])
def get_matches():
    """
    Retrieve a list of matches with optional date filtering.
    Query params: start_date, end_date (ISO format: YYYY-MM-DD)
    """
    db = get_db()
    session = db.get_session()

    try:
        query = session.query(Match)

        # Apply date filtering
        start_date = request.args.get('start_date')
        end_date = request.args.get('end_date')

        if start_date:
            try:
                start_dt = datetime.fromisoformat(start_date)
                query = query.filter(Match.date_time >= start_dt)
            except ValueError:
                return jsonify({'error': 'Invalid start_date format. Use YYYY-MM-DD'}), 400

        if end_date:
            try:
                end_dt = datetime.fromisoformat(end_date)
                query = query.filter(Match.date_time <= end_dt)
            except ValueError:
                return jsonify({'error': 'Invalid end_date format. Use YYYY-MM-DD'}), 400

        matches = query.order_by(Match.date_time.desc()).all()

        result = []
        for match in matches:
            result.append({
                'match_id': match.match_id,
                'date_time': match.date_time.isoformat(),
                'map_id': match.map_id,
                'map_name': match.map.map_name,
                'map_type': match.map.map_type.value,
                'final_score': match.final_score,
                'outcome': match.outcome.value
            })

        return jsonify({
            'matches': result,
            'count': len(result)
        }), 200

    except Exception as e:
        return jsonify({'error': str(e)}), 500
    finally:
        session.close()


@matches_bp.route('/matches/<int:match_id>/details', methods=['GET'])
def get_match_details(match_id):
    """
    Retrieve full details for a specific match: all players' stats and hero bans.
    """
    db = get_db()
    session = db.get_session()

    try:
        match = session.query(Match).filter_by(match_id=match_id).first()
        if not match:
            return jsonify({'error': 'Match not found'}), 404

        from models import MatchPlayer, Player
        # Order by time_played desc so each player's primary hero (most time) comes first in their group
        rows = session.query(MatchPlayer, Player, Hero).join(
            Player, MatchPlayer.player_id == Player.player_id
        ).join(
            Hero, MatchPlayer.hero_id == Hero.hero_id
        ).filter(MatchPlayer.match_id == match_id).order_by(
            MatchPlayer.time_played.desc()
        ).all()

        banned_heroes = session.query(BannedHero, Hero).join(
            Hero, BannedHero.hero_id == Hero.hero_id
        ).filter(BannedHero.match_id == match_id).all()

        player_groups = {}
        player_order = []
        for mp, player, hero in rows:
            pid = player.player_id
            if pid not in player_groups:
                player_groups[pid] = {
                    'player_id': player.player_id,
                    'battle_tag': player.user_id,
                    'team': mp.team.value,
                    'slots': []
                }
                player_order.append(pid)
            player_groups[pid]['slots'].append((mp, hero))

        players_result = []
        for pid in player_order:
            data = player_groups[pid]
            slots = data['slots']  # sorted by time_played desc
            primary_mp, primary_hero = slots[0]
            players_result.append({
                'player_id': data['player_id'],
                'battle_tag': data['battle_tag'],
                'team': data['team'],
                'primary_hero': primary_hero.hero_name,
                'primary_hero_role': primary_hero.role.value,
                'heroes': [
                    {
                        'hero_name': h.hero_name,
                        'hero_role': h.role.value,
                        'time_played': round(mp.time_played, 2),
                        'eliminations': mp.eliminations,
                        'final_blows': mp.final_blows,
                        'assists': mp.assists,
                        'deaths': mp.deaths,
                        'damage_done': round(mp.damage_done, 2),
                        'healing_done': round(mp.healing_done, 2),
                        'damage_mitigated': round(mp.damage_mitigated, 2),
                    }
                    for mp, h in slots
                ],
                'eliminations': sum(mp.eliminations for mp, h in slots),
                'final_blows': sum(mp.final_blows for mp, h in slots),
                'assists': sum(mp.assists for mp, h in slots),
                'deaths': sum(mp.deaths for mp, h in slots),
                'damage_done': sum(mp.damage_done for mp, h in slots),
                'healing_done': sum(mp.healing_done for mp, h in slots),
                'damage_mitigated': sum(mp.damage_mitigated for mp, h in slots),
            })

        bans = {'team1': [], 'team2': []}
        for banned_hero, hero in banned_heroes:
            bans[banned_hero.team.value].append({
                'hero_name': hero.hero_name,
                'role': hero.role.value,
            })

        return jsonify({
            'match_id': match_id,
            'date_time': match.date_time.isoformat(),
            'map_name': match.map.map_name,
            'map_type': match.map.map_type.value,
            'final_score': match.final_score,
            'outcome': match.outcome.value,
            'duration': match.duration,
            'players': players_result,
            'bans': bans,
        }), 200

    except Exception as e:
        return jsonify({'error': str(e)}), 500
    finally:
        session.close()


@matches_bp.route('/matches/<int:match_id>/banned_heroes', methods=['GET'])
def get_banned_heroes(match_id):
    """
    Retrieve banned heroes for a specific match.
    """
    db = get_db()
    session = db.get_session()

    try:
        match = session.query(Match).filter_by(match_id=match_id).first()
        if not match:
            return jsonify({'error': 'Match not found'}), 404

        banned_heroes = session.query(BannedHero, Hero).join(
            Hero, BannedHero.hero_id == Hero.hero_id
        ).filter(BannedHero.match_id == match_id).all()

        result = {
            'match_id': match_id,
            'team1_bans': [],
            'team2_bans': []
        }

        for banned_hero, hero in banned_heroes:
            ban_info = {
                'hero_id': hero.hero_id,
                'hero_name': hero.hero_name,
                'role': hero.role.value
            }
            if banned_hero.team.value == 'team1':
                result['team1_bans'].append(ban_info)
            else:
                result['team2_bans'].append(ban_info)

        return jsonify(result), 200

    except Exception as e:
        return jsonify({'error': str(e)}), 500
    finally:
        session.close()
