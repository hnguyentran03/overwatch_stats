"""Unit tests for the scoreboard parser util (Anthropic client mocked)."""
import os
import sys
from types import SimpleNamespace

import pytest

BACKEND_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
if BACKEND_DIR not in sys.path:
    sys.path.insert(0, BACKEND_DIR)

from utils.scoreboard import (  # noqa: E402
    parse_scoreboard,
    ScoreboardConfigError,
    Scoreboard,
    ScoreboardPlayer,
)

HEROES_BY_ROLE = {
    "tank": ["Reinhardt", "Winston"],
    "dps": ["Genji", "Tracer"],
    "support": ["Ana", "Kiriko"],
}


def _fake_client(scoreboard):
    """A stand-in Anthropic client whose messages.parse returns scoreboard."""
    parse = lambda **kwargs: SimpleNamespace(parsed_output=scoreboard)
    return SimpleNamespace(messages=SimpleNamespace(parse=parse))


def test_parse_scoreboard_maps_players():
    scoreboard = Scoreboard(players=[
        ScoreboardPlayer(
            team="team1", battle_tag="IMTHETROOP", hero_name="Reinhardt",
            eliminations=12, assists=2, deaths=9,
            damage_done=5953, healing_done=4047, damage_mitigated=760,
        ),
    ])
    client = _fake_client(scoreboard)

    result = parse_scoreboard(b"fakebytes", "image/png", HEROES_BY_ROLE, client=client)

    assert result == [{
        "team": "team1", "battle_tag": "IMTHETROOP", "hero_name": "Reinhardt",
        "eliminations": 12, "assists": 2, "deaths": 9,
        "damage_done": 5953, "healing_done": 4047, "damage_mitigated": 760,
    }]


def test_parse_scoreboard_requires_api_key(monkeypatch):
    monkeypatch.delenv("ANTHROPIC_API_KEY", raising=False)
    with pytest.raises(ScoreboardConfigError):
        parse_scoreboard(b"fakebytes", "image/png", HEROES_BY_ROLE)


def _capturing_client(captured):
    def parse(**kwargs):
        captured.update(kwargs)
        return SimpleNamespace(parsed_output=Scoreboard(players=[]))
    return SimpleNamespace(messages=SimpleNamespace(parse=parse))


def test_includes_reference_image_first_when_present(monkeypatch):
    import utils.scoreboard as sb
    monkeypatch.setattr(sb, "_load_reference_b64", lambda: "FAKEREF")
    captured = {}
    parse_scoreboard(b"bytes", "image/png", HEROES_BY_ROLE, client=_capturing_client(captured))

    content = captured["messages"][0]["content"]
    images = [b for b in content if b["type"] == "image"]
    assert len(images) == 2
    assert images[0]["source"]["data"] == "FAKEREF"  # reference grid comes first


def test_omits_reference_image_when_absent(monkeypatch):
    import utils.scoreboard as sb
    monkeypatch.setattr(sb, "_load_reference_b64", lambda: None)
    captured = {}
    parse_scoreboard(b"bytes", "image/png", HEROES_BY_ROLE, client=_capturing_client(captured))

    content = captured["messages"][0]["content"]
    images = [b for b in content if b["type"] == "image"]
    assert len(images) == 1  # only the scoreboard, feature still works without the asset


def test_parse_scoreboard_raises_when_no_parsed_output():
    # The SDK returns parsed_output=None when the model emits no parsable
    # structured data (refusal, truncation, thinking-only response).
    client = _fake_client(None)
    with pytest.raises(ValueError):
        parse_scoreboard(b"fakebytes", "image/png", HEROES_BY_ROLE, client=client)


from PIL import Image
import io

from utils.scoreboard import (  # noqa: E402
    _portrait_crop,
    CROP_LEFT,
    CROP_RIGHT,
    CROP_TOP,
    CROP_BOTTOM,
    CROP_SCALE,
)


def _png_bytes(width, height):
    buf = io.BytesIO()
    Image.new("RGB", (width, height), (30, 30, 30)).save(buf, format="PNG")
    return buf.getvalue()


def test_portrait_crop_returns_upscaled_png_for_card_layout():
    width, height = 1244, 1129
    data = _portrait_crop(_png_bytes(width, height))
    assert data is not None
    crop = Image.open(io.BytesIO(data))
    assert crop.format == "PNG"
    expected_w = (int(width * CROP_RIGHT) - int(width * CROP_LEFT)) * CROP_SCALE
    expected_h = (int(height * CROP_BOTTOM) - int(height * CROP_TOP)) * CROP_SCALE
    assert crop.size == (expected_w, expected_h)


def test_portrait_crop_rejects_16_9_fullscreen():
    # A full 16:9 screenshot is an uncalibrated layout under the card-based
    # gate and should fall back rather than produce a misaligned crop.
    assert _portrait_crop(_png_bytes(1920, 1080)) is None


def test_portrait_crop_rejects_garbage_bytes():
    assert _portrait_crop(b"not an image") is None
