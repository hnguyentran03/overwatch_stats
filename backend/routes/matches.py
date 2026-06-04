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
