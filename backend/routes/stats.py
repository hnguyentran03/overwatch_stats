from flask import Blueprint, jsonify, request
from models import Player, MatchPlayer, Match, Hero, Map, RoleEnum
from utils.db import get_db
from utils.calculations import (
    calculate_win_percentage,
    aggregate_hero_stats,
    calculate_map_trends,
    identify_weakest_maps
)
from sqlalchemy import func

stats_bp = Blueprint('stats', __name__)


@stats_bp.route('/players/<string:battle_tag>/win_percentage/hero', methods=['GET'])
def get_win_percentage_by_hero(battle_tag):
    """
    Retrieve win percentage per hero for a specific player.
    Optional ?map_id=N filter returns only heroes played on that map.
    Without map_id, returns all heroes (including those with 0 games).
    """
    db = get_db()
    session = db.get_session()

    try:
        player = session.query(Player).filter_by(user_id=battle_tag).first()
        if not player:
            return jsonify({'error': 'Player not found'}), 404

        player_id = player.player_id
        map_id = request.args.get('map_id', type=int)

        if map_id:
            hero_ids = session.query(MatchPlayer.hero_id).join(
                Match, MatchPlayer.match_id == Match.match_id
            ).filter(
                MatchPlayer.player_id == player_id,
                Match.map_id == map_id
            ).distinct().all()
            heroes = [session.query(Hero).filter_by(hero_id=hid).first() for (hid,) in hero_ids]
        else:
            heroes = session.query(Hero).all()

        result = []
        for hero in heroes:
            matches_q = session.query(Match).join(
                MatchPlayer, Match.match_id == MatchPlayer.match_id
            ).filter(
                MatchPlayer.player_id == player_id,
                MatchPlayer.hero_id == hero.hero_id
            )
            mps_q = session.query(MatchPlayer).filter(
                MatchPlayer.player_id == player_id,
                MatchPlayer.hero_id == hero.hero_id
            )
            if map_id:
                matches_q = matches_q.filter(Match.map_id == map_id)
                mps_q = mps_q.join(
                    Match, MatchPlayer.match_id == Match.match_id
                ).filter(Match.map_id == map_id)

            matches = matches_q.distinct().all()
            match_players = mps_q.all()

            win_stats = calculate_win_percentage(matches)
            performance_stats = aggregate_hero_stats(match_players)

            result.append({
                'hero_id': hero.hero_id,
                'hero_name': hero.hero_name,
                'role': hero.role.value,
                **win_stats,
                'total_time_played': performance_stats['total_time_played'],
                'total_eliminations': performance_stats['total_eliminations'],
                'total_final_blows': performance_stats['total_final_blows'],
                'total_assists': performance_stats['total_assists'],
                'total_deaths': performance_stats['total_deaths'],
                'total_damage_done': performance_stats['total_damage_done'],
                'total_healing_done': performance_stats['total_healing_done'],
                'total_damage_mitigated': performance_stats['total_damage_mitigated'],
                'avg_eliminations': performance_stats['avg_eliminations'],
                'avg_final_blows': performance_stats['avg_final_blows'],
                'avg_assists': performance_stats['avg_assists'],
                'avg_deaths': performance_stats['avg_deaths'],
                'avg_damage_done': performance_stats['avg_damage_done'],
                'avg_healing_done': performance_stats['avg_healing_done'],
                'avg_damage_mitigated': performance_stats['avg_damage_mitigated'],
                'elims_per_10': performance_stats['elims_per_10'],
                'final_blows_per_10': performance_stats['final_blows_per_10'],
                'assists_per_10': performance_stats['assists_per_10'],
                'deaths_per_10': performance_stats['deaths_per_10'],
                'damage_per_10': performance_stats['damage_per_10'],
                'healing_per_10': performance_stats['healing_per_10'],
                'mitigation_per_10': performance_stats['mitigation_per_10'],
            })

        # Sort by role (tank, dps, support), then alphabetically by hero name
        role_order = {'tank': 0, 'dps': 1, 'support': 2}
        result.sort(key=lambda x: (role_order.get(x['role'], 3), x['hero_name']))

        return jsonify({
            'battle_tag': battle_tag,
            'hero_stats': result
        }), 200

    except Exception as e:
        return jsonify({'error': str(e)}), 500
    finally:
        session.close()


@stats_bp.route('/players/<string:battle_tag>/win_percentage/map', methods=['GET'])
def get_win_percentage_by_map(battle_tag):
    """
    Retrieve win percentage per map for a specific player by Battle.net ID.
    Returns all maps, including those with no data (0% win rate).
    """
    db = get_db()
    session = db.get_session()

    try:
        player = session.query(Player).filter_by(user_id=battle_tag).first()
        if not player:
            return jsonify({'error': 'Player not found'}), 404

        player_id = player.player_id

        role = request.args.get('role')
        if role and role not in ['tank', 'dps', 'support']:
            return jsonify({'error': 'Invalid role. Use tank, dps, or support'}), 400

        hero_id = request.args.get('hero_id', type=int)

        # Get ALL maps from the database
        all_maps = session.query(Map).all()

        result = []
        for map_obj in all_maps:
            # Get matches for this map
            query = session.query(Match).join(
                MatchPlayer, Match.match_id == MatchPlayer.match_id
            ).filter(
                MatchPlayer.player_id == player_id,
                Match.map_id == map_obj.map_id
            )
            if role:
                query = query.join(Hero, MatchPlayer.hero_id == Hero.hero_id).filter(
                    Hero.role == RoleEnum(role)
                )
            if hero_id:
                query = query.filter(MatchPlayer.hero_id == hero_id)
            matches = query.distinct().all()

            win_stats = calculate_win_percentage(matches)

            result.append({
                'map_id': map_obj.map_id,
                'map_name': map_obj.map_name,
                'map_type': map_obj.map_type.value,
                **win_stats
            })

        # Sort by map type (Control, Escort, Flashpoint, Hybrid, Push), then alphabetically by map name
        map_type_order = {'Control': 0, 'Escort': 1, 'Flashpoint': 2, 'Hybrid': 3, 'Push': 4}
        result.sort(key=lambda x: (map_type_order.get(x['map_type'], 5), x['map_name']))

        return jsonify({
            'battle_tag': battle_tag,
            'map_stats': result
        }), 200

    except Exception as e:
        return jsonify({'error': str(e)}), 500
    finally:
        session.close()


@stats_bp.route('/players/<string:battle_tag>/map_stats/<int:map_id>', methods=['GET'])
def get_map_stats(battle_tag, map_id):
    """
    Retrieve detailed statistics for a specific player on a specific map.
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

        # Get matches on this map
        matches = session.query(Match).join(
            MatchPlayer, Match.match_id == MatchPlayer.match_id
        ).filter(
            MatchPlayer.player_id == player_id,
            Match.map_id == map_id
        ).distinct().all()

        # Get match players on this map
        match_players = session.query(MatchPlayer).join(
            Match, MatchPlayer.match_id == Match.match_id
        ).filter(
            MatchPlayer.player_id == player_id,
            Match.map_id == map_id
        ).all()

        win_stats = calculate_win_percentage(matches)
        performance_stats = aggregate_hero_stats(match_players)

        # Get distinct heroes played on this map, then compute full stats per hero
        hero_ids = session.query(MatchPlayer.hero_id).join(
            Match, MatchPlayer.match_id == Match.match_id
        ).filter(
            MatchPlayer.player_id == player_id,
            Match.map_id == map_id
        ).distinct().all()

        heroes_played = []
        for (hero_id,) in hero_ids:
            hero = session.query(Hero).filter_by(hero_id=hero_id).first()

            hero_matches = session.query(Match).join(
                MatchPlayer, Match.match_id == MatchPlayer.match_id
            ).filter(
                MatchPlayer.player_id == player_id,
                MatchPlayer.hero_id == hero_id,
                Match.map_id == map_id
            ).distinct().all()

            hero_mps = session.query(MatchPlayer).join(
                Match, MatchPlayer.match_id == Match.match_id
            ).filter(
                MatchPlayer.player_id == player_id,
                MatchPlayer.hero_id == hero_id,
                Match.map_id == map_id
            ).all()

            hero_win_stats = calculate_win_percentage(hero_matches)
            hero_perf_stats = aggregate_hero_stats(hero_mps)

            heroes_played.append({
                'hero_name': hero.hero_name,
                'role': hero.role.value,
                **hero_win_stats,
                **hero_perf_stats,
            })

        heroes_played.sort(key=lambda x: x['total'], reverse=True)

        result = {
            'battle_tag': battle_tag,
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


@stats_bp.route('/players/<string:battle_tag>/map_trends', methods=['GET'])
def get_map_trends(battle_tag):
    """
    Retrieve trends on maps for a specific player to identify weakest maps.
    Query params: time_window (day, week, month)
    """
    db = get_db()
    session = db.get_session()

    try:
        player = session.query(Player).filter_by(user_id=battle_tag).first()
        if not player:
            return jsonify({'error': 'Player not found'}), 404

        player_id = player.player_id

        time_window = request.args.get('time_window', 'week')
        if time_window not in ['day', 'week', 'month']:
            return jsonify({'error': 'Invalid time_window. Use day, week, or month'}), 400

        role = request.args.get('role')
        if role and role not in ['tank', 'dps', 'support']:
            return jsonify({'error': 'Invalid role. Use tank, dps, or support'}), 400

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
            query = session.query(Match).join(
                MatchPlayer, Match.match_id == MatchPlayer.match_id
            ).filter(
                MatchPlayer.player_id == player_id,
                Match.map_id == map_obj.map_id
            )
            if role:
                query = query.join(Hero, MatchPlayer.hero_id == Hero.hero_id).filter(
                    Hero.role == RoleEnum(role)
                )
            matches = query.distinct().order_by(Match.date_time).all()

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
            'battle_tag': battle_tag,
            'time_window': time_window,
            'map_trends': map_trends,
            'weakest_maps': weakest_maps[:5]  # Top 5 weakest
        }), 200

    except Exception as e:
        return jsonify({'error': str(e)}), 500
    finally:
        session.close()
