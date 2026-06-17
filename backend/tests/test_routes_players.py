"""Integration tests for the players blueprint."""
import os
import sys

BACKEND_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
if BACKEND_DIR not in sys.path:
    sys.path.insert(0, BACKEND_DIR)

from urllib.parse import quote  # noqa: E402

from models import OutcomeEnum  # noqa: E402


class TestPlayerStats:
    def test_player_not_found(self, client):
        resp = client.get("/api/players/Nobody%231234/stats")
        assert resp.status_code == 404

    def test_overall_win_percentage(self, client, make_player, add_match):
        player = make_player("Stat#1234")
        add_match(player, outcome=OutcomeEnum.win, hero_name="Ana")
        add_match(player, outcome=OutcomeEnum.loss, hero_name="Ana")

        tag = quote("Stat#1234", safe="")
        resp = client.get(f"/api/players/{tag}/stats")
        assert resp.status_code == 200
        body = resp.get_json()
        assert body["total_matches"] == 2
        assert body["wins"] == 1
        assert body["losses"] == 1
        assert body["win_percentage"] == 50.0

    def test_role_breakdown(self, client, make_player, add_match):
        player = make_player("Role#1234")
        # Ana is a support hero.
        add_match(player, outcome=OutcomeEnum.win, hero_name="Ana")

        tag = quote("Role#1234", safe="")
        body = client.get(f"/api/players/{tag}/stats").get_json()
        assert body["support_matches"] == 1
        assert body["support_wins"] == 1
        assert body["support_win_percentage"] == 100.0
        # No tank games -> percentage is None.
        assert body["tank_matches"] == 0
        assert body["tank_win_percentage"] is None


class TestMatchOutcomes:
    def test_player_not_found(self, client):
        resp = client.get("/api/players/Nobody%231234/match_outcomes")
        assert resp.status_code == 404

    def test_lists_outcomes_newest_first(self, client, make_player, add_match):
        from datetime import datetime

        player = make_player("Hist#1234")
        add_match(player, date_time=datetime(2026, 1, 1), map_name="Ilios")
        add_match(player, date_time=datetime(2026, 6, 1), map_name="Busan")

        tag = quote("Hist#1234", safe="")
        body = client.get(f"/api/players/{tag}/match_outcomes").get_json()
        assert body["count"] == 2
        # Newest first.
        assert body["matches"][0]["map_name"] == "Busan"


class TestPreferredHeroes:
    def test_player_not_found(self, client):
        resp = client.get("/api/players/Nobody%231234/preferred_heroes/1")
        assert resp.status_code == 404

    def test_map_not_found(self, client, make_player):
        make_player("Pref#1234")
        tag = quote("Pref#1234", safe="")
        resp = client.get(f"/api/players/{tag}/preferred_heroes/999999")
        assert resp.status_code == 404

    def test_sorted_by_time_played(
        self, client, make_player, add_match, map_by_name, session
    ):
        from models import MatchPlayer, Hero, TeamEnum

        player = make_player("Pref#1234")
        kings_row = map_by_name("King's Row")
        match = add_match(
            player, map_name="King's Row", hero_name="Ana", time_played=5.0
        )
        genji = session.query(Hero).filter_by(hero_name="Genji").first()
        session.add(
            MatchPlayer(
                match_id=match.match_id,
                player_id=player.player_id,
                hero_id=genji.hero_id,
                team=TeamEnum.team1,
                time_played=30.0,
            )
        )
        session.commit()

        tag = quote("Pref#1234", safe="")
        body = client.get(
            f"/api/players/{tag}/preferred_heroes/{kings_row.map_id}"
        ).get_json()
        heroes = body["preferred_heroes"]
        assert heroes[0]["hero_name"] == "Genji"  # most time first
        assert heroes[1]["hero_name"] == "Ana"
