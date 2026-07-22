"""Integration tests for the players blueprint."""
import os
import sys

BACKEND_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
if BACKEND_DIR not in sys.path:
    sys.path.insert(0, BACKEND_DIR)

from urllib.parse import quote  # noqa: E402

from models import OutcomeEnum  # noqa: E402


class TestSamplePlayer:
    def test_returns_null_when_no_players(self, client):
        body = client.get("/api/players/sample").get_json()
        assert body == {"battle_tag": None}

    def test_returns_a_streamer_name(self, client, make_player):
        make_player("Krusher99")
        resp = client.get("/api/players/sample")
        assert resp.status_code == 200
        assert resp.get_json()["battle_tag"] == "Krusher99"

    def test_excludes_real_battle_tags(self, client, make_player):
        # A real logged player (not a baked-in streamer name) must never be
        # surfaced as the example — even when it's the only player in the DB.
        make_player("RealPerson#1234")
        body = client.get("/api/players/sample").get_json()
        assert body == {"battle_tag": None}


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


class TestPlayerModeFilter:
    def test_stats_filtered_by_mode(self, client, make_player, add_match):
        from models import GameModeEnum, OutcomeEnum
        player = make_player("Filter#1")
        add_match(player, game_mode=GameModeEnum.ranked, outcome=OutcomeEnum.win)
        add_match(player, game_mode=GameModeEnum.unranked, outcome=OutcomeEnum.loss)
        tag = "Filter%231"  # '#' encoded
        all_stats = client.get(f"/api/players/{tag}/stats").get_json()
        assert all_stats["total_matches"] == 2
        ranked = client.get(f"/api/players/{tag}/stats?mode=ranked").get_json()
        assert ranked["total_matches"] == 1
        assert ranked["wins"] == 1

    def test_match_outcomes_filtered_and_labeled(self, client, make_player, add_match):
        from models import GameModeEnum
        player = make_player("Filter#2")
        add_match(player, game_mode=GameModeEnum.ranked)
        add_match(player, game_mode=GameModeEnum.unranked)
        tag = "Filter%232"
        data = client.get(f"/api/players/{tag}/match_outcomes?mode=unranked").get_json()
        assert data["count"] == 1
        assert data["matches"][0]["game_mode"] == "unranked"

    def test_invalid_mode_returns_400(self, client, make_player):
        make_player("Filter#3")
        resp = client.get("/api/players/Filter%233/stats?mode=bogus")
        assert resp.status_code == 400

    def test_preferred_heroes_filtered_by_mode(self, client, make_player, add_match, map_by_name):
        from models import GameModeEnum
        player = make_player("Filter#4")
        add_match(player, map_name="King's Row", hero_name="Ana", game_mode=GameModeEnum.ranked)
        add_match(player, map_name="King's Row", hero_name="Kiriko", game_mode=GameModeEnum.unranked)
        map_id = map_by_name("King's Row").map_id
        data = client.get(f"/api/players/Filter%234/preferred_heroes/{map_id}?mode=ranked").get_json()
        names = [h["hero_name"] for h in data["preferred_heroes"]]
        assert names == ["Ana"]
