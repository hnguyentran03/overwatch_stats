from flask import Blueprint, jsonify, request
from models import Match, BannedHero, Hero
from utils.db import get_db
from datetime import datetime

matches_bp = Blueprint('matches', __name__)


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
