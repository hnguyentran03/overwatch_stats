from flask import Blueprint, jsonify
from models import Player, MatchPlayer, Match, Hero, Map
from utils.db import get_db
from utils.calculations import aggregate_hero_stats
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

        # Get all match players for this player
        match_players = session.query(MatchPlayer).filter_by(player_id=player_id).all()

        # Get all matches for this player
        matches = session.query(Match).join(
            MatchPlayer, Match.match_id == MatchPlayer.match_id
        ).filter(MatchPlayer.player_id == player_id).all()

        # Aggregate stats
        stats = aggregate_hero_stats(match_players)

        # Calculate win/loss
        wins = sum(1 for match in matches if match.outcome.value == 'win')
        losses = len(matches) - wins

        result = {
            'battle_tag': player.user_id,
            'total_matches': len(matches),
            'wins': wins,
            'losses': losses,
            'win_percentage': round(wins / len(matches) * 100, 2) if len(matches) > 0 else 0.0,
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

        # Get all matches for this player with their performance
        matches_query = session.query(Match, MatchPlayer, Hero, Map).join(
            MatchPlayer, Match.match_id == MatchPlayer.match_id
        ).join(
            Hero, MatchPlayer.hero_id == Hero.hero_id
        ).join(
            Map, Match.map_id == Map.map_id
        ).filter(
            MatchPlayer.player_id == player_id
        ).order_by(Match.date_time.desc())

        matches = matches_query.all()

        result = []
        for match, match_player, hero, map_obj in matches:
            result.append({
                'match_id': match.match_id,
                'date_time': match.date_time.isoformat(),
                'map_name': map_obj.map_name,
                'map_type': map_obj.map_type.value,
                'outcome': match.outcome.value,
                'final_score': match.final_score,
                'hero_played': hero.hero_name,
                'hero_role': hero.role.value,
                'eliminations': match_player.eliminations,
                'assists': match_player.assists,
                'deaths': match_player.deaths,
                'damage_done': match_player.damage_done,
                'healing_done': match_player.healing_done,
                'damage_mitigated': match_player.damage_mitigated,
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

        # Get hero usage on this map
        hero_stats = session.query(
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
        ).group_by(
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
