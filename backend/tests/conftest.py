"""Shared pytest fixtures for the backend test suite.

A temporary SQLite database file is used so the real ``overwatch_stats.db`` is
never touched. The DATABASE_URL env var is set *before* the app/config modules
are imported, because ``config.py`` reads it at import time.
"""
import os
import sys
import tempfile

import pytest

# Make the backend package importable (tests live in backend/tests/).
BACKEND_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
if BACKEND_DIR not in sys.path:
    sys.path.insert(0, BACKEND_DIR)

# Point the app at a throwaway SQLite file before importing config.
_DB_FD, _DB_PATH = tempfile.mkstemp(suffix=".db")
os.close(_DB_FD)
os.environ["DATABASE_URL"] = f"sqlite:///{_DB_PATH}"

from app import create_app  # noqa: E402
from utils.db import get_db  # noqa: E402
from models import (  # noqa: E402
    Match,
    Player,
    MatchPlayer,
    Hero,
    Map,
    BannedHero,
    OutcomeEnum,
    TeamEnum,
    GameModeEnum,
)


@pytest.fixture(scope="session")
def app():
    """Create the Flask app once for the whole test session."""
    application = create_app("development")
    application.config["TESTING"] = True
    yield application
    # Clean up the temporary database file.
    if os.path.exists(_DB_PATH):
        os.remove(_DB_PATH)


@pytest.fixture
def db(app):
    """Return the database instance with a clean, freshly seeded schema."""
    database = get_db()
    database.drop_tables()
    database.create_tables()
    database.seed_data()
    yield database
    database.Session.remove()


@pytest.fixture
def session(db):
    """A SQLAlchemy session bound to the clean test database."""
    return db.get_session()


@pytest.fixture
def client(app, db):
    """A Flask test client backed by the clean test database."""
    return app.test_client()


# --------------------------------------------------------------------------- #
# Helpers for building test data.
# --------------------------------------------------------------------------- #


@pytest.fixture
def make_player(session):
    def _make(user_id="Tester#1234"):
        player = Player(user_id=user_id)
        session.add(player)
        session.commit()
        return player

    return _make


@pytest.fixture
def hero_by_name(session):
    def _get(name):
        return session.query(Hero).filter_by(hero_name=name).first()

    return _get


@pytest.fixture
def map_by_name(session):
    def _get(name):
        return session.query(Map).filter_by(map_name=name).first()

    return _get


@pytest.fixture
def add_match(session, hero_by_name, map_by_name):
    """Insert a match with a single hero slot for the given player.

    Returns the created Match.
    """

    def _add(
        player,
        map_name="King's Row",
        hero_name="Ana",
        outcome=OutcomeEnum.win,
        date_time=None,
        team=TeamEnum.team1,
        final_score="2-1",
        duration=15.0,
        game_mode=GameModeEnum.ranked,
        eliminations=10,
        final_blows=5,
        assists=8,
        deaths=4,
        damage_done=5000.0,
        healing_done=3000.0,
        damage_mitigated=1000.0,
        time_played=15.0,
    ):
        from datetime import datetime

        map_obj = map_by_name(map_name)
        hero = hero_by_name(hero_name)
        match = Match(
            date_time=date_time or datetime(2026, 1, 1, 12, 0, 0),
            map_id=map_obj.map_id,
            final_score=final_score,
            outcome=outcome,
            duration=duration,
            game_mode=game_mode,
        )
        session.add(match)
        session.flush()

        mp = MatchPlayer(
            match_id=match.match_id,
            player_id=player.player_id,
            hero_id=hero.hero_id,
            team=team,
            eliminations=eliminations,
            final_blows=final_blows,
            assists=assists,
            deaths=deaths,
            damage_done=damage_done,
            healing_done=healing_done,
            damage_mitigated=damage_mitigated,
            time_played=time_played,
        )
        session.add(mp)
        session.commit()
        return match

    return _add
