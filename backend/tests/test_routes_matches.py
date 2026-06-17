"""Integration tests for the matches blueprint."""
import os
import sys

BACKEND_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
if BACKEND_DIR not in sys.path:
    sys.path.insert(0, BACKEND_DIR)

from models import OutcomeEnum, TeamEnum  # noqa: E402


class TestHealth:
    def test_index(self, client):
        resp = client.get("/")
        assert resp.status_code == 200
        assert resp.get_json()["status"] == "running"

    def test_health(self, client):
        resp = client.get("/api/health")
        assert resp.status_code == 200
        assert resp.get_json()["status"] == "healthy"


class TestGetHeroes:
    def test_returns_seeded_heroes(self, client):
        resp = client.get("/api/heroes")
        assert resp.status_code == 200
        heroes = resp.get_json()
        assert isinstance(heroes, list)
        assert len(heroes) > 0
        names = {h["hero_name"] for h in heroes}
        assert "Ana" in names
        assert {"hero_id", "hero_name", "role"} <= set(heroes[0].keys())


class TestGetMaps:
    def test_returns_seeded_maps(self, client):
        resp = client.get("/api/maps")
        assert resp.status_code == 200
        maps = resp.get_json()
        names = {m["map_name"] for m in maps}
        assert "King's Row" in names


class TestCreateMatch:
    def _payload(self, map_id, **overrides):
        payload = {
            "date_time": "2026-01-01T12:00:00",
            "map_id": map_id,
            "final_score": "2-1",
            "outcome": "win",
            "duration": 15.0,
            "players": [
                {
                    "battle_tag": "Hero#1111",
                    "team": "team1",
                    "heroes": [
                        {
                            "hero_name": "Ana",
                            "eliminations": 10,
                            "deaths": 3,
                            "time_played": 15.0,
                        }
                    ],
                }
            ],
            "bans": {"team1": ["Sombra"], "team2": []},
        }
        payload.update(overrides)
        return payload

    def _first_map_id(self, client):
        return client.get("/api/maps").get_json()[0]["map_id"]

    def test_create_success(self, client):
        map_id = self._first_map_id(client)
        resp = client.post("/api/matches", json=self._payload(map_id))
        assert resp.status_code == 201
        body = resp.get_json()
        assert "match_id" in body

        # The match is retrievable.
        details = client.get(f"/api/matches/{body['match_id']}/details")
        assert details.status_code == 200
        data = details.get_json()
        assert data["outcome"] == "win"
        assert data["players"][0]["battle_tag"] == "Hero#1111"
        assert data["bans"]["team1"][0]["hero_name"] == "Sombra"

    def test_no_body_returns_400(self, client):
        resp = client.post("/api/matches", json=None, content_type="application/json")
        assert resp.status_code == 400

    def test_missing_field_returns_400(self, client):
        map_id = self._first_map_id(client)
        payload = self._payload(map_id)
        del payload["outcome"]
        resp = client.post("/api/matches", json=payload)
        assert resp.status_code == 400
        assert "outcome" in resp.get_json()["error"]

    def test_invalid_outcome_returns_400(self, client):
        map_id = self._first_map_id(client)
        resp = client.post("/api/matches", json=self._payload(map_id, outcome="victory"))
        assert resp.status_code == 400

    def test_invalid_date_returns_400(self, client):
        map_id = self._first_map_id(client)
        resp = client.post(
            "/api/matches", json=self._payload(map_id, date_time="not-a-date")
        )
        assert resp.status_code == 400

    def test_unknown_map_returns_404(self, client):
        resp = client.post("/api/matches", json=self._payload(999999))
        assert resp.status_code == 404

    def test_creates_new_player_record(self, client, session):
        from models import Player

        map_id = self._first_map_id(client)
        client.post("/api/matches", json=self._payload(map_id))
        player = session.query(Player).filter_by(user_id="Hero#1111").first()
        assert player is not None

    def test_blank_hero_name_skipped(self, client):
        map_id = self._first_map_id(client)
        payload = self._payload(map_id)
        payload["players"][0]["heroes"][0]["hero_name"] = ""
        resp = client.post("/api/matches", json=payload)
        # Match still created, just with no hero slots for that player.
        assert resp.status_code == 201


class TestGetMatches:
    def test_empty(self, client):
        resp = client.get("/api/matches")
        assert resp.status_code == 200
        body = resp.get_json()
        assert body["count"] == 0
        assert body["matches"] == []

    def test_lists_created_match(self, client, make_player, add_match):
        player = make_player()
        add_match(player, map_name="King's Row")
        resp = client.get("/api/matches")
        body = resp.get_json()
        assert body["count"] == 1
        assert body["matches"][0]["map_name"] == "King's Row"

    def test_date_filtering(self, client, make_player, add_match):
        from datetime import datetime

        player = make_player()
        add_match(player, date_time=datetime(2026, 1, 1))
        add_match(player, date_time=datetime(2026, 6, 1))

        resp = client.get("/api/matches?start_date=2026-03-01")
        body = resp.get_json()
        assert body["count"] == 1

    def test_invalid_start_date_returns_400(self, client):
        resp = client.get("/api/matches?start_date=bad")
        assert resp.status_code == 400

    def test_invalid_end_date_returns_400(self, client):
        resp = client.get("/api/matches?end_date=bad")
        assert resp.status_code == 400


class TestMatchDetails:
    def test_not_found(self, client):
        resp = client.get("/api/matches/999999/details")
        assert resp.status_code == 404

    def test_primary_hero_is_most_played(self, client, make_player, add_match, session):
        from models import MatchPlayer, Hero, TeamEnum

        player = make_player()
        match = add_match(
            player, hero_name="Ana", time_played=5.0, map_name="Ilios"
        )
        # Add a second hero slot with more time -> should become primary.
        genji = session.query(Hero).filter_by(hero_name="Genji").first()
        session.add(
            MatchPlayer(
                match_id=match.match_id,
                player_id=player.player_id,
                hero_id=genji.hero_id,
                team=TeamEnum.team1,
                time_played=20.0,
            )
        )
        session.commit()

        resp = client.get(f"/api/matches/{match.match_id}/details")
        data = resp.get_json()
        assert data["players"][0]["primary_hero"] == "Genji"
        assert len(data["players"][0]["heroes"]) == 2


class TestBannedHeroes:
    def test_not_found(self, client):
        resp = client.get("/api/matches/999999/banned_heroes")
        assert resp.status_code == 404

    def test_returns_bans_split_by_team(self, client, make_player, add_match, session):
        from models import BannedHero, Hero, TeamEnum

        player = make_player()
        match = add_match(player)
        sombra = session.query(Hero).filter_by(hero_name="Sombra").first()
        session.add(
            BannedHero(match_id=match.match_id, hero_id=sombra.hero_id, team=TeamEnum.team1)
        )
        session.commit()

        resp = client.get(f"/api/matches/{match.match_id}/banned_heroes")
        body = resp.get_json()
        assert len(body["team1_bans"]) == 1
        assert body["team1_bans"][0]["hero_name"] == "Sombra"
        assert body["team2_bans"] == []
