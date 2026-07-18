"""Integration tests for the matches blueprint."""
import os
import sys
import io

import pytest

BACKEND_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
if BACKEND_DIR not in sys.path:
    sys.path.insert(0, BACKEND_DIR)

from models import OutcomeEnum, TeamEnum, GameModeEnum  # noqa: E402


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
            "game_mode": "ranked",
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

    def test_missing_game_mode_returns_400(self, client, map_by_name):
        map_obj = map_by_name("King's Row")
        payload = self._payload(map_obj.map_id)
        del payload["game_mode"]
        resp = client.post("/api/matches", json=payload)
        assert resp.status_code == 400
        assert "game_mode" in resp.get_json()["error"]

    def test_invalid_game_mode_returns_400(self, client, map_by_name):
        map_obj = map_by_name("King's Row")
        payload = self._payload(map_obj.map_id)
        payload["game_mode"] = "bogus"
        resp = client.post("/api/matches", json=payload)
        assert resp.status_code == 400
        assert "game_mode" in resp.get_json()["error"]

    def test_creates_with_game_mode(self, client, map_by_name, session):
        from models import Match
        map_obj = map_by_name("King's Row")
        payload = self._payload(map_obj.map_id)
        payload["game_mode"] = "unranked"
        resp = client.post("/api/matches", json=payload)
        assert resp.status_code == 201
        mid = resp.get_json()["match_id"]
        from models import GameModeEnum
        stored = session.query(Match).filter_by(match_id=mid).first()
        assert stored.game_mode == GameModeEnum.unranked

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


class TestParseScoreboard:
    _PNG = b"\x89PNG\r\n\x1a\n" + b"0" * 32  # minimal non-empty fake PNG

    @pytest.fixture(autouse=True)
    def _reset_limiter(self):
        # The daily limiter is module-level state shared across requests; reset it
        # before each test so counts don't leak between tests.
        from routes.matches import _scoreboard_limiter
        _scoreboard_limiter.reset()
        yield
        _scoreboard_limiter.reset()

    def _upload(self, client, monkeypatch, fake):
        monkeypatch.setattr("routes.matches.parse_scoreboard", fake)
        return client.post(
            "/api/matches/parse_scoreboard",
            data={"image": (io.BytesIO(self._PNG), "scoreboard.png")},
            content_type="multipart/form-data",
        )

    def test_returns_parsed_players(self, client, monkeypatch):
        players = [{
            "team": "team1", "battle_tag": "IMTHETROOP", "hero_name": "Reinhardt",
            "eliminations": 12, "assists": 2, "deaths": 9,
            "damage_done": 5953, "healing_done": 4047, "damage_mitigated": 760,
        }]
        resp = self._upload(client, monkeypatch, lambda *a, **k: players)
        assert resp.status_code == 200
        assert resp.get_json() == {"players": players}

    def test_missing_image_returns_400(self, client):
        resp = client.post(
            "/api/matches/parse_scoreboard",
            data={}, content_type="multipart/form-data",
        )
        assert resp.status_code == 400

    def test_missing_api_key_returns_503(self, client, monkeypatch):
        from utils.scoreboard import ScoreboardConfigError

        def boom(*a, **k):
            raise ScoreboardConfigError("no key")

        resp = self._upload(client, monkeypatch, boom)
        assert resp.status_code == 503

    def test_model_failure_returns_502(self, client, monkeypatch):
        def boom(*a, **k):
            raise RuntimeError("model exploded")

        resp = self._upload(client, monkeypatch, boom)
        assert resp.status_code == 502

    def test_fourth_request_in_window_is_rate_limited(self, client, monkeypatch):
        ok = lambda *a, **k: []
        for _ in range(3):
            assert self._upload(client, monkeypatch, ok).status_code == 200
        resp = self._upload(client, monkeypatch, ok)
        assert resp.status_code == 429
        assert "Retry-After" in resp.headers
        assert "3 per day" in resp.get_json()["error"]

    def test_config_error_does_not_consume_the_limit(self, client, monkeypatch):
        from utils.scoreboard import ScoreboardConfigError

        def no_key(*a, **k):
            raise ScoreboardConfigError("no key")

        # Three misconfigured (503) attempts must not exhaust the daily quota...
        for _ in range(3):
            assert self._upload(client, monkeypatch, no_key).status_code == 503
        # ...so a real call still succeeds.
        assert self._upload(client, monkeypatch, lambda *a, **k: []).status_code == 200


class TestMatchesModeFilter:
    def test_filters_matches_by_mode(self, client, make_player, add_match):
        from models import GameModeEnum
        player = make_player()
        add_match(player, game_mode=GameModeEnum.ranked)
        add_match(player, game_mode=GameModeEnum.unranked)
        add_match(player, game_mode=GameModeEnum.unranked)

        resp = client.get("/api/matches?mode=ranked")
        assert resp.status_code == 200
        data = resp.get_json()
        assert data["count"] == 1
        assert all(m["game_mode"] == "ranked" for m in data["matches"])

        resp = client.get("/api/matches?mode=unranked")
        assert resp.get_json()["count"] == 2

    def test_mode_all_returns_everything(self, client, make_player, add_match):
        from models import GameModeEnum
        player = make_player()
        add_match(player, game_mode=GameModeEnum.ranked)
        add_match(player, game_mode=GameModeEnum.unranked)
        assert client.get("/api/matches?mode=all").get_json()["count"] == 2
        assert client.get("/api/matches").get_json()["count"] == 2

    def test_invalid_mode_returns_400(self, client):
        resp = client.get("/api/matches?mode=bogus")
        assert resp.status_code == 400

    def test_matches_response_includes_game_mode(self, client, make_player, add_match):
        player = make_player()
        add_match(player)
        m = client.get("/api/matches").get_json()["matches"][0]
        assert m["game_mode"] == "ranked"


class TestGameModeColumn:
    def test_add_match_defaults_to_ranked(self, add_match, make_player, session):
        from models import Match
        player = make_player()
        match = add_match(player)
        stored = session.query(Match).filter_by(match_id=match.match_id).first()
        assert stored.game_mode == GameModeEnum.ranked

    def test_add_match_accepts_unranked(self, add_match, make_player, session):
        from models import Match
        player = make_player()
        match = add_match(player, game_mode=GameModeEnum.unranked)
        stored = session.query(Match).filter_by(match_id=match.match_id).first()
        assert stored.game_mode == GameModeEnum.unranked


class TestTeamSizeColumn:
    def test_add_match_defaults_to_5v5(self, add_match, make_player, session):
        from models import Match, TeamSizeEnum
        player = make_player()
        match = add_match(player)
        stored = session.query(Match).filter_by(match_id=match.match_id).first()
        assert stored.team_size == TeamSizeEnum.five_v_five
        assert stored.team_size.value == "5v5"

    def test_add_match_accepts_6v6(self, add_match, make_player, session):
        from models import Match, TeamSizeEnum
        player = make_player()
        match = add_match(player, team_size=TeamSizeEnum.six_v_six)
        stored = session.query(Match).filter_by(match_id=match.match_id).first()
        assert stored.team_size.value == "6v6"
