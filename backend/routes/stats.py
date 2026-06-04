from flask import Blueprint, jsonify, request
from models import Player, MatchPlayer, Match, Hero, Map
from utils.db import get_db
from utils.calculations import (
    calculate_win_percentage,
    aggregate_hero_stats,
    calculate_map_trends,
    identify_weakest_maps
)
from sqlalchemy import func

stats_bp = Blueprint('stats', __name__)


@stats_bp.route('/players/<int:player_id>/win_percentage/hero', methods=['GET'])
def get_win_percentage_by_hero(player_id):
    """
    Retrieve win percentage per hero for a specific player.
    """
    db = get_db()
    session = db.get_session()

    try:
        player = session.query(Player).filter_by(player_id=player_id).first()
        if not player:
            return jsonify({'error': 'Player not found'}), 404

        # Get all heroes the player has played
        heroes = session.query(Hero).join(
            MatchPlayer, Hero.hero_id == MatchPlayer.hero_id
        ).filter(
            MatchPlayer.player_id == player_id
        ).distinct().all()

        result = []
        for hero in heroes:
            # Get matches for this hero
            matches = session.query(Match).join(
                MatchPlayer, Match.match_id == MatchPlayer.match_id
            ).filter(
                MatchPlayer.player_id == player_id,
                MatchPlayer.hero_id == hero.hero_id
            ).all()

            # Get stats for this hero
            match_players = session.query(MatchPlayer).filter(
                MatchPlayer.player_id == player_id,
                MatchPlayer.hero_id == hero.hero_id
            ).all()

            win_stats = calculate_win_percentage(matches)
            performance_stats = aggregate_hero_stats(match_players)

            result.append({
                'hero_id': hero.hero_id,
                'hero_name': hero.hero_name,
                'role': hero.role.value,
                **win_stats,
                'avg_eliminations': performance_stats['avg_eliminations'],
                'avg_deaths': performance_stats['avg_deaths'],
                'avg_damage_done': performance_stats['avg_damage_done'],
                'avg_healing_done': performance_stats['avg_healing_done'],
            })

        # Sort by games played descending
        result.sort(key=lambda x: x['total'], reverse=True)

        return jsonify({
            'player_id': player_id,
            'hero_stats': result
        }), 200

    except Exception as e:
        return jsonify({'error': str(e)}), 500
    finally:
        session.close()


@stats_bp.route('/players/<int:player_id>/win_percentage/map', methods=['GET'])
def get_win_percentage_by_map(player_id):
    """
    Retrieve win percentage per map for a specific player.
    """
    db = get_db()
    session = db.get_session()

    try:
        player = session.query(Player).filter_by(player_id=player_id).first()
        if not player:
            return jsonify({'error': 'Player not found'}), 404

        # Get all maps the player has played on
        maps = session.query(Map).join(
            Match, Map.map_id == Match.map_id
        ).join(
            MatchPlayer, Match.match_id == MatchPlayer.match_id
        ).filter(
            MatchPlayer.player_id == player_id
        ).distinct().all()

        result = []
        for map_obj in maps:
            # Get matches for this map
            matches = session.query(Match).join(
                MatchPlayer, Match.match_id == MatchPlayer.match_id
            ).filter(
                MatchPlayer.player_id == player_id,
                Match.map_id == map_obj.map_id
            ).all()

            win_stats = calculate_win_percentage(matches)

            result.append({
                'map_id': map_obj.map_id,
                'map_name': map_obj.map_name,
                'map_type': map_obj.map_type.value,
                **win_stats
            })

        # Sort by games played descending
        result.sort(key=lambda x: x['total'], reverse=True)

        return jsonify({
            'player_id': player_id,
            'map_stats': result
        }), 200

    except Exception as e:
        return jsonify({'error': str(e)}), 500
    finally:
        session.close()


@stats_bp.route('/players/<int:player_id>/map_stats/<int:map_id>', methods=['GET'])
def get_map_stats(player_id, map_id):
    """
    Retrieve detailed statistics for a specific player on a specific map.
    """
    db = get_db()
    session = db.get_session()

    try:
        player = session.query(Player).filter_by(player_id=player_id).first()
        if not player:
            return jsonify({'error': 'Player not found'}), 404

        map_obj = session.query(Map).filter_by(map_id=map_id).first()
        if not map_obj:
            return jsonify({'error': 'Map not found'}), 404

        # Get matches on this map
        matches = session.query(Match).join(
            MatchPlayer, Match.match_id == MatchPlayer.match_id
        ).filter(
            MatchPlayer.player_id == player_id,
            Match.map_id == map_id
        ).all()

        # Get match players on this map
        match_players = session.query(MatchPlayer).join(
            Match, MatchPlayer.match_id == Match.match_id
        ).filter(
            MatchPlayer.player_id == player_id,
            Match.map_id == map_id
        ).all()

        win_stats = calculate_win_percentage(matches)
        performance_stats = aggregate_hero_stats(match_players)

        # Get hero breakdown on this map
        hero_breakdown = session.query(
            Hero.hero_name,
            Hero.role,
            func.count(MatchPlayer.id).label('games')
        ).join(
            MatchPlayer, Hero.hero_id == MatchPlayer.hero_id
        ).join(
            Match, MatchPlayer.match_id == Match.match_id
        ).filter(
            MatchPlayer.player_id == player_id,
            Match.map_id == map_id
        ).group_by(
            Hero.hero_name, Hero.role
        ).order_by(
            func.count(MatchPlayer.id).desc()
        ).all()

        heroes_played = [
            {
                'hero_name': hero_name,
                'role': role.value,
                'games': games
            }
            for hero_name, role, games in hero_breakdown
        ]

        result = {
            'player_id': player_id,
            'map_id': map_id,
            'map_name': map_obj.map_name,
            'map_type': map_obj.map_type.value,
            **win_stats,
            **performance_stats,
            'heroes_played': heroes_played
        }

        return jsonify(result), 200

    except Exception as e:
        return jsonify({'error': str(e)}), 500
    finally:
        session.close()


@stats_bp.route('/players/<int:player_id>/map_trends', methods=['GET'])
def get_map_trends(player_id):
    """
    Retrieve trends on maps for a specific player to identify weakest maps.
    Query params: time_window (day, week, month)
    """
    db = get_db()
    session = db.get_session()

    try:
        player = session.query(Player).filter_by(player_id=player_id).first()
        if not player:
            return jsonify({'error': 'Player not found'}), 404

        time_window = request.args.get('time_window', 'week')
        if time_window not in ['day', 'week', 'month']:
            return jsonify({'error': 'Invalid time_window. Use day, week, or month'}), 400

        # Get all maps the player has played on
        maps = session.query(Map).join(
            Match, Map.map_id == Match.map_id
        ).join(
            MatchPlayer, Match.match_id == MatchPlayer.match_id
        ).filter(
            MatchPlayer.player_id == player_id
        ).distinct().all()

        map_trends = []
        weakest_maps_data = []

        for map_obj in maps:
            # Get matches for this map
            matches = session.query(Match).join(
                MatchPlayer, Match.match_id == MatchPlayer.match_id
            ).filter(
                MatchPlayer.player_id == player_id,
                Match.map_id == map_obj.map_id
            ).order_by(Match.date_time).all()

            # Calculate trends
            trends = calculate_map_trends(matches, time_window)

            # Calculate overall stats for weakest map identification
            win_stats = calculate_win_percentage(matches)

            weakest_maps_data.append({
                'map_id': map_obj.map_id,
                'map_name': map_obj.map_name,
                'map_type': map_obj.map_type.value,
                **win_stats
            })

            map_trends.append({
                'map_id': map_obj.map_id,
                'map_name': map_obj.map_name,
                'map_type': map_obj.map_type.value,
                'trends': trends
            })

        # Identify weakest maps
        weakest_maps = identify_weakest_maps(weakest_maps_data)

        return jsonify({
            'player_id': player_id,
            'time_window': time_window,
            'map_trends': map_trends,
            'weakest_maps': weakest_maps[:5]  # Top 5 weakest
        }), 200

    except Exception as e:
        return jsonify({'error': str(e)}), 500
    finally:
        session.close()
