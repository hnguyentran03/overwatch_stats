from flask import Blueprint, jsonify, request
from models import Player, MatchPlayer, Match, Hero, Map, RoleEnum
from utils.db import get_db
from utils.calculations import aggregate_hero_stats
from utils.filters import parse_match_filters
from sqlalchemy import func
from collections import defaultdict

players_bp = Blueprint('players', __name__)


@players_bp.route('/players/<string:battle_tag>/stats', methods=['GET'])
def get_player_stats(battle_tag):
    """
    Retrieve overall statistics for a specific player by Battle.net ID (e.g. Name#1234).
    """
    db = get_db()
    session = db.get_session()

    try:
        player = session.query(Player).filter_by(user_id=battle_tag).first()
        if not player:
            return jsonify({'error': 'Player not found'}), 404

        player_id = player.player_id

        clauses, filter_error = parse_match_filters(request.args)
        if filter_error:
            return jsonify({'error': filter_error}), 400

        # Get all match players for this player
        mp_query = session.query(MatchPlayer).join(
            Match, MatchPlayer.match_id == Match.match_id
        ).filter(MatchPlayer.player_id == player_id)
        for c in clauses:
            mp_query = mp_query.filter(c)
        match_players = mp_query.all()

        # Get all matches for this player (distinct — player may have multiple hero rows per match)
        matches_query = session.query(Match).join(
            MatchPlayer, Match.match_id == MatchPlayer.match_id
        ).filter(MatchPlayer.player_id == player_id)
        for c in clauses:
            matches_query = matches_query.filter(c)
        matches = matches_query.distinct().all()

        # Aggregate stats
        stats = aggregate_hero_stats(match_players)

        # Calculate overall win/loss/draw
        wins = sum(1 for match in matches if match.outcome.value == 'win')
        losses = sum(1 for match in matches if match.outcome.value == 'loss')
        draws = len(matches) - wins - losses

        # Calculate win rate per role
        role_win_rates = {}
        for role in ['tank', 'dps', 'support']:
            role_query = session.query(Match).join(
                MatchPlayer, Match.match_id == MatchPlayer.match_id
            ).join(
                Hero, MatchPlayer.hero_id == Hero.hero_id
            ).filter(
                MatchPlayer.player_id == player_id,
                Hero.role == RoleEnum[role]
            )
            for c in clauses:
                role_query = role_query.filter(c)
            role_matches = role_query.distinct().all()
            role_wins = sum(1 for m in role_matches if m.outcome.value == 'win')
            role_losses = sum(1 for m in role_matches if m.outcome.value == 'loss')
            role_total = len(role_matches)
            role_draws = role_total - role_wins - role_losses
            role_win_rates[f'{role}_matches'] = role_total
            role_win_rates[f'{role}_wins'] = role_wins
            role_win_rates[f'{role}_losses'] = role_losses
            role_win_rates[f'{role}_draws'] = role_draws
            role_win_rates[f'{role}_win_percentage'] = (
                round(role_wins / role_total * 100, 2) if role_total > 0 else None
            )

        result = {
            'battle_tag': player.user_id,
            'total_matches': len(matches),
            'wins': wins,
            'losses': losses,
            'draws': draws,
            'win_percentage': round(wins / len(matches) * 100, 2) if len(matches) > 0 else 0.0,
            **role_win_rates,
            **stats
        }

        return jsonify(result), 200

    except Exception as e:
        return jsonify({'error': str(e)}), 500
    finally:
        session.close()


@players_bp.route('/players/<string:battle_tag>/match_outcomes', methods=['GET'])
def get_match_outcomes(battle_tag):
    """
    Retrieve match outcomes for a specific player by Battle.net ID (e.g. Name#1234).
    """
    db = get_db()
    session = db.get_session()

    try:
        player = session.query(Player).filter_by(user_id=battle_tag).first()
        if not player:
            return jsonify({'error': 'Player not found'}), 404

        player_id = player.player_id

        clauses, filter_error = parse_match_filters(request.args)
        if filter_error:
            return jsonify({'error': filter_error}), 400

        # Fetch all hero slots for this player across all matches in one query.
        # ORDER BY date desc, then time_played desc so the primary hero (most time) is first per match.
        rows_query = session.query(Match, MatchPlayer, Hero, Map).join(
            MatchPlayer, Match.match_id == MatchPlayer.match_id
        ).join(
            Hero, MatchPlayer.hero_id == Hero.hero_id
        ).join(
            Map, Match.map_id == Map.map_id
        ).filter(
            MatchPlayer.player_id == player_id
        )
        for c in clauses:
            rows_query = rows_query.filter(c)
        rows = rows_query.order_by(
            Match.date_time.desc(), MatchPlayer.time_played.desc()
        ).all()

        # Group by match, preserving date-desc order
        match_groups = {}
        match_order = []
        for match, mp, hero, map_obj in rows:
            mid = match.match_id
            if mid not in match_groups:
                match_groups[mid] = {'match': match, 'map_obj': map_obj, 'slots': []}
                match_order.append(mid)
            match_groups[mid]['slots'].append((mp, hero))

        result = []
        for mid in match_order:
            data = match_groups[mid]
            match = data['match']
            map_obj = data['map_obj']
            slots = data['slots']  # already sorted by time_played desc

            primary_mp, primary_hero = slots[0]
            result.append({
                'match_id': mid,
                'date_time': match.date_time.isoformat(),
                'game_mode': match.game_mode.value,
                'team_size': match.team_size.value,
                'map_name': map_obj.map_name,
                'map_type': map_obj.map_type.value,
                'outcome': match.outcome.value,
                'final_score': match.final_score,
                'duration': match.duration,
                'primary_hero': primary_hero.hero_name,
                'primary_hero_role': primary_hero.role.value,
                'heroes_played': [
                    {'hero_name': h.hero_name, 'hero_role': h.role.value, 'time_played': round(mp.time_played, 2)}
                    for mp, h in slots
                ],
                'eliminations': sum(mp.eliminations for mp, h in slots),
                'assists': sum(mp.assists for mp, h in slots),
                'deaths': sum(mp.deaths for mp, h in slots),
                'damage_done': sum(mp.damage_done for mp, h in slots),
                'healing_done': sum(mp.healing_done for mp, h in slots),
                'damage_mitigated': sum(mp.damage_mitigated for mp, h in slots),
            })

        return jsonify({
            'battle_tag': battle_tag,
            'matches': result,
            'count': len(result)
        }), 200

    except Exception as e:
        return jsonify({'error': str(e)}), 500
    finally:
        session.close()


@players_bp.route('/players/<string:battle_tag>/preferred_heroes/<int:map_id>', methods=['GET'])
def get_preferred_heroes(battle_tag, map_id):
    """
    Retrieve preferred heroes for a specific player on a specific map.
    Preferred heroes are sorted by time played.
    """
    db = get_db()
    session = db.get_session()

    try:
        player = session.query(Player).filter_by(user_id=battle_tag).first()
        if not player:
            return jsonify({'error': 'Player not found'}), 404

        player_id = player.player_id

        map_obj = session.query(Map).filter_by(map_id=map_id).first()
        if not map_obj:
            return jsonify({'error': 'Map not found'}), 404

        clauses, filter_error = parse_match_filters(request.args)
        if filter_error:
            return jsonify({'error': filter_error}), 400

        # Get hero usage on this map
        hero_stats_query = session.query(
            Hero.hero_id,
            Hero.hero_name,
            Hero.role,
            func.sum(MatchPlayer.time_played).label('total_time'),
            func.count(MatchPlayer.id).label('games_played')
        ).join(
            MatchPlayer, Hero.hero_id == MatchPlayer.hero_id
        ).join(
            Match, MatchPlayer.match_id == Match.match_id
        ).filter(
            MatchPlayer.player_id == player_id,
            Match.map_id == map_id
        )
        for c in clauses:
            hero_stats_query = hero_stats_query.filter(c)
        hero_stats = hero_stats_query.group_by(
            Hero.hero_id, Hero.hero_name, Hero.role
        ).order_by(
            func.sum(MatchPlayer.time_played).desc()
        ).all()

        result = []
        for hero_id, hero_name, role, total_time, games_played in hero_stats:
            result.append({
                'hero_id': hero_id,
                'hero_name': hero_name,
                'role': role.value,
                'games_played': games_played,
                'total_time_played': round(total_time, 2)
            })

        return jsonify({
            'battle_tag': battle_tag,
            'map_id': map_id,
            'map_name': map_obj.map_name,
            'preferred_heroes': result
        }), 200

    except Exception as e:
        return jsonify({'error': str(e)}), 500
    finally:
        session.close()
