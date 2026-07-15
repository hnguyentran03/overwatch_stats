"""Parse an Overwatch 2 scoreboard screenshot into structured player stats.

Sends the image to a Claude vision model with the valid hero roster and uses
structured outputs so the response is guaranteed parseable. The Anthropic
client is injected to keep the function unit-testable.
"""
import base64
import io
import logging
import os
from typing import List

import anthropic
from pydantic import BaseModel
from PIL import Image

logger = logging.getLogger(__name__)

MODEL = "claude-opus-4-8"

# Labeled grid of every valid hero's portrait, built by
# scripts/build_hero_reference.py. Sent alongside the scoreboard so the model
# matches portraits against named references instead of recalling them.
REFERENCE_PATH = os.path.join(
    os.path.dirname(os.path.dirname(os.path.abspath(__file__))),
    "assets",
    "hero_reference.png",
)

# Fractional bounds of the hero-portrait column on the cropped match-summary
# card layout (two stacked 5-row team cards separated by a "VS" divider),
# spanning all 10 rows (team1 rows 1-5, then team2 rows 1-5). Calibrated
# against real screenshots via `python scripts/eval_scoreboard.py --save-crops`.
CROP_LEFT = 0.065
CROP_RIGHT = 0.145
CROP_TOP = 0.065
CROP_BOTTOM = 0.985
CROP_SCALE = 3

# The user's real screenshots are cropped match-summary cards, not full 16:9
# screenshots — their width/height ratio measures ~1.06-1.15. Accept a card
# layout with modest margin; anything outside this range is treated as an
# uncalibrated layout and falls back to the full screenshot.
_MIN_ASPECT = 1.0
_MAX_ASPECT = 1.25


def _portrait_crop(image_bytes):
    """Return upscaled PNG bytes of the hero-portrait column, or None.

    None whenever the image can't be read or its aspect ratio falls outside
    the calibrated card-layout bounds — callers fall back to sending only the
    full screenshot.
    """
    try:
        img = Image.open(io.BytesIO(image_bytes))
        img.load()
        width, height = img.size
        if height == 0:
            return None
        ratio = width / height
        if ratio < _MIN_ASPECT or ratio > _MAX_ASPECT:
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
        logger.warning("Portrait crop failed; sending scoreboard without zoomed crop", exc_info=True)
        return None


class ScoreboardConfigError(RuntimeError):
    """Raised when the Anthropic API key is not configured."""


class ScoreboardPlayer(BaseModel):
    team: str            # "team1" (blue/top) or "team2" (red/bottom)
    battle_tag: str      # display name exactly as shown on the scoreboard
    portrait_notes: str  # visible features of this row's portrait, noted before naming the hero
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


def _build_prompt(hero_names_by_role, has_reference, has_crop):
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

    if has_crop:
        crop_note = (
            "The LAST image is a zoomed-in view of the hero-portrait column "
            "from the same scoreboard: the 10 portraits in top-to-bottom row "
            "order (team1 rows 1-5, then team2 rows 1-5). Use it as the "
            "primary source when identifying each row's hero.\n\n"
        )
    else:
        crop_note = ""

    notes_note = (
        "For each player, first fill portrait_notes with the visual features "
        "you can actually see in that row's portrait (headgear, hair, colors, "
        "silhouette, weapon). Then choose hero_name: the roster hero whose "
        "look matches those notes. Base hero_name only on features you wrote "
        "in portrait_notes.\n\n"
    )

    return (
        "You are reading an Overwatch 2 end-of-match scoreboard. It shows two "
        "teams of 5 players each. The top (blue) team is team1; the bottom (red) "
        "team is team2.\n\n"
        + hero_id
        + crop_note
        + notes_note +
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
    crop_bytes = _portrait_crop(image_bytes)

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
    if crop_bytes is not None:
        content.append({
            "type": "image",
            "source": {
                "type": "base64",
                "media_type": "image/png",
                "data": base64.standard_b64encode(crop_bytes).decode("utf-8"),
            },
        })
    content.append({
        "type": "text",
        "text": _build_prompt(
            hero_names_by_role,
            has_reference=reference_b64 is not None,
            has_crop=crop_bytes is not None,
        ),
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
    return [p.model_dump(exclude={"portrait_notes"}) for p in parsed.players]
