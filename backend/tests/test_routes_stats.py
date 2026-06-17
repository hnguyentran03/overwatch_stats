"""Integration tests for the stats blueprint."""
import os
import sys

BACKEND_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
if BACKEND_DIR not in sys.path:
    sys.path.insert(0, BACKEND_DIR)

from urllib.parse import quote  # noqa: E402

from models import OutcomeEnum  # noqa: E402


def tag_of(name):
    return quote(name, safe="")


class TestWinPercentageByHero:
    def test_player_not_found(self, client):
        resp = client.get("/api/players/Nobody%231234/win_percentage/hero")
        assert resp.status_code == 404

    def test_includes_all_heroes_by_default(self, client, make_player, add_match):
        player = make_player("Hero#1234")
        add_match(player, hero_name="Ana", outcome=OutcomeEnum.win)

        body = client.get(
            f"/api/players/{tag_of('Hero#1234')}/win_percentage/hero"
        ).get_json()
        stats = body["hero_stats"]
        # Every seeded hero is represented.
        assert len(stats) > 1
        ana = next(h for h in stats if h["hero_name"] == "Ana")
        assert ana["wins"] == 1
        assert ana["win_percentage"] == 100.0
        # An unplayed hero has zeroed stats.
        unplayed = next(h for h in stats if h["hero_name"] == "Genji")
        assert unplayed["total"] == 0

    def test_map_filter_limits_to_played_heroes(
        self, client, make_player, add_match, map_by_name
    ):
        player = make_player("Hero#1234")
        add_match(player, hero_name="Ana", map_name="King's Row")
        kings_row = map_by_name("King's Row")

        body = client.get(
            f"/api/players/{tag_of('Hero#1234')}/win_percentage/hero?map_id={kings_row.map_id}"
        ).get_json()
        names = {h["hero_name"] for h in body["hero_stats"]}
        assert names == {"Ana"}


class TestWinPercentageByMap:
    def test_player_not_found(self, client):
        resp = client.get("/api/players/Nobody%231234/win_percentage/map")
        assert resp.status_code == 404

    def test_invalid_role_returns_400(self, client, make_player):
        make_player("Map#1234")
        resp = client.get(
            f"/api/players/{tag_of('Map#1234')}/win_percentage/map?role=healer"
        )
        assert resp.status_code == 400

    def test_returns_all_maps_with_played_data(self, client, make_player, add_match):
        player = make_player("Map#1234")
        add_match(player, map_name="King's Row", outcome=OutcomeEnum.win)

        body = client.get(
            f"/api/players/{tag_of('Map#1234')}/win_percentage/map"
        ).get_json()
        stats = body["map_stats"]
        assert len(stats) > 1  # all maps present
        kr = next(m for m in stats if m["map_name"] == "King's Row")
        assert kr["wins"] == 1
        assert kr["win_percentage"] == 100.0

    def test_role_filter(self, client, make_player, add_match):
        player = make_player("Map#1234")
        add_match(player, map_name="King's Row", hero_name="Ana")  # support

        # Filtering by tank yields no wins on that map.
        body = client.get(
            f"/api/players/{tag_of('Map#1234')}/win_percentage/map?role=tank"
        ).get_json()
        kr = next(m for m in body["map_stats"] if m["map_name"] == "King's Row")
        assert kr["total"] == 0


class TestMapStats:
    def test_player_not_found(self, client):
        resp = client.get("/api/players/Nobody%231234/map_stats/1")
        assert resp.status_code == 404

    def test_map_not_found(self, client, make_player):
        make_player("MS#1234")
        resp = client.get(f"/api/players/{tag_of('MS#1234')}/map_stats/999999")
        assert resp.status_code == 404

    def test_aggregates_for_map(self, client, make_player, add_match, map_by_name):
        player = make_player("MS#1234")
        add_match(
            player,
            map_name="King's Row",
            hero_name="Ana",
            outcome=OutcomeEnum.win,
            eliminations=10,
        )
        kings_row = map_by_name("King's Row")

        body = client.get(
            f"/api/players/{tag_of('MS#1234')}/map_stats/{kings_row.map_id}"
        ).get_json()
        assert body["map_name"] == "King's Row"
        assert body["wins"] == 1
        assert body["total_eliminations"] == 10
        assert len(body["heroes_played"]) == 1
        assert body["heroes_played"][0]["hero_name"] == "Ana"


class TestMapTrends:
    def test_player_not_found(self, client):
        resp = client.get("/api/players/Nobody%231234/map_trends")
        assert resp.status_code == 404

    def test_invalid_time_window_returns_400(self, client, make_player):
        make_player("MT#1234")
        resp = client.get(
            f"/api/players/{tag_of('MT#1234')}/map_trends?time_window=year"
        )
        assert resp.status_code == 400

    def test_invalid_role_returns_400(self, client, make_player):
        make_player("MT#1234")
        resp = client.get(f"/api/players/{tag_of('MT#1234')}/map_trends?role=healer")
        assert resp.status_code == 400

    def test_returns_trends_and_weakest_maps(self, client, make_player, add_match):
        from datetime import datetime

        player = make_player("MT#1234")
        add_match(
            player,
            map_name="King's Row",
            outcome=OutcomeEnum.loss,
            date_time=datetime(2026, 1, 1),
        )
        add_match(
            player,
            map_name="Ilios",
            outcome=OutcomeEnum.win,
            date_time=datetime(2026, 1, 8),
        )

        body = client.get(
            f"/api/players/{tag_of('MT#1234')}/map_trends?time_window=week"
        ).get_json()
        assert body["time_window"] == "week"
        assert len(body["map_trends"]) == 2
        # Weakest map (0% win) should be first.
        assert body["weakest_maps"][0]["map_name"] == "King's Row"
