"""Parse an Overwatch 2 scoreboard screenshot into structured player stats.

Sends the image to a Claude vision model with the valid hero roster and uses
structured outputs so the response is guaranteed parseable. The Anthropic
client is injected to keep the function unit-testable.
"""
import base64
import io
import os
from typing import List

import anthropic
from pydantic import BaseModel
from PIL import Image

MODEL = "claude-opus-4-8"

# Labeled grid of every valid hero's portrait, built by
# scripts/build_hero_reference.py. Sent alongside the scoreboard so the model
# matches portraits against named references instead of recalling them.
REFERENCE_PATH = os.path.join(
    os.path.dirname(os.path.dirname(os.path.abspath(__file__))),
    "assets",
    "hero_reference.png",
)

# Fractional bounds of the hero-portrait column on a 16:9 scoreboard,
# spanning all 10 rows (team1 rows 1-5, then team2 rows 1-5). Calibrated
# against real screenshots via `python scripts/eval_scoreboard.py --save-crops`.
CROP_LEFT = 0.10
CROP_RIGHT = 0.20
CROP_TOP = 0.18
CROP_BOTTOM = 0.88
CROP_SCALE = 3
_ASPECT = 16 / 9
_ASPECT_TOLERANCE = 0.05


def _portrait_crop(image_bytes):
    """Return upscaled PNG bytes of the hero-portrait column, or None.

    None whenever the image can't be read or isn't ~16:9 — callers fall back
    to sending only the full screenshot.
    """
    try:
        img = Image.open(io.BytesIO(image_bytes))
        img.load()
        width, height = img.size
        if height == 0 or abs(width / height - _ASPECT) / _ASPECT > _ASPECT_TOLERANCE:
            return None
        box = (
            int(width * CROP_LEFT),
            int(height * CROP_TOP),
            int(width * CROP_RIGHT),
            int(height * CROP_BOTTOM),
        )
        crop = img.convert("RGB").crop(box)
        crop = crop.resize(
            (crop.width * CROP_SCALE, crop.height * CROP_SCALE), Image.LANCZOS
        )
        out = io.BytesIO()
        crop.save(out, format="PNG")
        return out.getvalue()
    except Exception:
        return None


class ScoreboardConfigError(RuntimeError):
    """Raised when the Anthropic API key is not configured."""


class ScoreboardPlayer(BaseModel):
    team: str            # "team1" (blue/top) or "team2" (red/bottom)
    battle_tag: str      # display name exactly as shown on the scoreboard
    hero_name: str       # exact name from the provided roster, or "" if unsure
    eliminations: int
    assists: int
    deaths: int
    damage_done: int
    healing_done: int
    damage_mitigated: int


class Scoreboard(BaseModel):
    players: List[ScoreboardPlayer]


def _get_client():
    if not os.getenv("ANTHROPIC_API_KEY"):
        raise ScoreboardConfigError("ANTHROPIC_API_KEY is not set")
    return anthropic.Anthropic()


def _load_reference_b64():
    """Return the base64-encoded hero-reference montage, or None if absent."""
    if not os.path.exists(REFERENCE_PATH):
        return None
    with open(REFERENCE_PATH, "rb") as f:
        return base64.standard_b64encode(f.read()).decode("utf-8")


def _build_prompt(hero_names_by_role, has_reference):
    roster = "\n".join(
        f"  {role}: {', '.join(names)}"
        for role, names in hero_names_by_role.items()
    )

    if has_reference:
        hero_id = (
            "The FIRST image is a reference grid: every valid hero's portrait "
            "with its exact name printed beneath it. To identify each scoreboard "
            "hero, find the reference portrait it most closely matches and use "
            "that hero's exact name. Compare distinguishing features (silhouette, "
            "colors, headgear) against the reference. If no reference portrait is "
            "a confident match, set hero_name to an empty string rather than "
            "guessing.\n\n"
            "The SECOND image is the scoreboard to read.\n\n"
        )
    else:
        hero_id = (
            "Look carefully at each portrait's distinguishing features "
            "(silhouette, colors, headgear) before choosing. If you cannot "
            "confidently identify a hero, set hero_name to an empty string "
            "rather than guessing.\n\n"
        )

    return (
        "You are reading an Overwatch 2 end-of-match scoreboard. It shows two "
        "teams of 5 players each. The top (blue) team is team1; the bottom (red) "
        "team is team2.\n\n"
        + hero_id +
        "Within each team, the 5 rows are grouped by role, with a role icon at "
        "the far left of every row — normally row 1 = the single Tank, rows 2-3 "
        "= the two Damage players, rows 4-5 = the two Support players. Use the "
        "role icon to decide each row's role, then choose a hero of that role. "
        "Do not assign a Support hero to a Tank row, etc.\n\n"
        "Each row has a hero portrait, a player display name, and six stat "
        "columns in this order:\n"
        "  E = eliminations, A = assists, D = deaths, DMG = damage_done, "
        "H = healing_done, MIT = damage_mitigated\n\n"
        "Valid hero names, grouped by role — use these EXACT spellings:\n"
        f"{roster}\n\n"
        "For battle_tag, transcribe the player's display name EXACTLY as shown, "
        "character for character. Names may use non-Latin scripts (e.g. Korean, "
        "Japanese, Cyrillic) or unusual casing/symbols — preserve them exactly; "
        "do not translate, romanize, or normalize.\n\n"
        "Read the numbers exactly as shown (a blank or '-' cell is 0). "
        "Return all 10 players, in top-to-bottom order (team1 first, then team2)."
    )


def parse_scoreboard(image_bytes, media_type, hero_names_by_role, client=None):
    """Return a list of player-stat dicts parsed from a scoreboard image."""
    if client is None:
        client = _get_client()

    image_data = base64.standard_b64encode(image_bytes).decode("utf-8")
    reference_b64 = _load_reference_b64()

    content = []
    if reference_b64 is not None:
        content.append({
            "type": "image",
            "source": {
                "type": "base64",
                "media_type": "image/png",
                "data": reference_b64,
            },
        })
    content.append({
        "type": "image",
        "source": {"type": "base64", "media_type": media_type, "data": image_data},
    })
    content.append({
        "type": "text",
        "text": _build_prompt(hero_names_by_role, has_reference=reference_b64 is not None),
    })

    response = client.messages.parse(
        model=MODEL,
        max_tokens=4096,
        messages=[{"role": "user", "content": content}],
        output_format=Scoreboard,
    )

    parsed = response.parsed_output
    if parsed is None:
        raise ValueError("Model returned no parsable scoreboard data")
    return [p.model_dump() for p in parsed.players]
