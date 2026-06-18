"""Build the hero-portrait reference montage used to improve scoreboard parsing.

Downloads official Overwatch hero portraits (via the OverFast API, which proxies
Blizzard's CDN), matches them to the heroes in this app's roster, and composes a
single labeled grid image at ``backend/assets/hero_reference.png``. The scoreboard
parser sends that grid alongside the screenshot so the vision model *matches*
portraits against named references instead of recalling them from memory.

Run once (re-run when the hero roster changes):

    cd backend && source venv/bin/activate && python scripts/build_hero_reference.py

Heroes with no official portrait (custom/non-existent roster entries) are skipped;
they remain valid names in the text roster, just without a reference image.
"""
import json
import math
import os
import sqlite3
import unicodedata
import urllib.request

from PIL import Image, ImageDraw, ImageFont

BACKEND_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DB_PATH = os.path.join(BACKEND_DIR, "overwatch_stats.db")
ASSETS_DIR = os.path.join(BACKEND_DIR, "assets")
PORTRAIT_CACHE = os.path.join(ASSETS_DIR, "portraits")
OUTPUT_PATH = os.path.join(ASSETS_DIR, "hero_reference.png")
HEROES_API = "https://overfast-api.tekrop.fr/heroes"

COLS = 6
PORTRAIT_PX = 110
LABEL_PX = 26
PAD = 10
CELL_W = PORTRAIT_PX + 2 * PAD
CELL_H = PORTRAIT_PX + LABEL_PX + 2 * PAD


def normalize(name):
    """Lowercase, strip accents and non-alphanumerics for fuzzy name matching."""
    decomposed = unicodedata.normalize("NFKD", name)
    ascii_only = decomposed.encode("ascii", "ignore").decode("ascii")
    return "".join(ch for ch in ascii_only.lower() if ch.isalnum())


def roster_hero_names():
    conn = sqlite3.connect(DB_PATH)
    try:
        rows = conn.execute("SELECT hero_name FROM heroes ORDER BY hero_name").fetchall()
    finally:
        conn.close()
    return [r[0] for r in rows]


def fetch_overfast_portraits():
    with urllib.request.urlopen(HEROES_API, timeout=20) as resp:
        heroes = json.load(resp)
    return {normalize(h["name"]): h for h in heroes if h.get("portrait")}


def download_portrait(hero):
    os.makedirs(PORTRAIT_CACHE, exist_ok=True)
    path = os.path.join(PORTRAIT_CACHE, f"{hero['key']}.png")
    if not os.path.exists(path):
        urllib.request.urlretrieve(hero["portrait"], path)
    return path


def load_font():
    for candidate in (
        "/System/Library/Fonts/Supplemental/Arial Bold.ttf",
        "/System/Library/Fonts/Supplemental/Arial.ttf",
        "/Library/Fonts/Arial.ttf",
    ):
        if os.path.exists(candidate):
            return ImageFont.truetype(candidate, 16)
    return ImageFont.load_default(size=16)


def build_montage(matched):
    """matched: list of (hero_name, portrait_path). Returns the montage Image."""
    rows = math.ceil(len(matched) / COLS)
    width = COLS * CELL_W
    height = rows * CELL_H
    montage = Image.new("RGB", (width, height), (245, 245, 245))
    draw = ImageDraw.Draw(montage)
    font = load_font()

    for idx, (name, portrait_path) in enumerate(matched):
        col = idx % COLS
        row = idx // COLS
        x0 = col * CELL_W
        y0 = row * CELL_H

        portrait = Image.open(portrait_path).convert("RGB").resize(
            (PORTRAIT_PX, PORTRAIT_PX), Image.LANCZOS
        )
        montage.paste(portrait, (x0 + PAD, y0 + PAD))

        text = name
        bbox = draw.textbbox((0, 0), text, font=font)
        text_w = bbox[2] - bbox[0]
        text_x = x0 + (CELL_W - text_w) // 2
        text_y = y0 + PAD + PORTRAIT_PX + 4
        draw.text((text_x, text_y), text, fill=(20, 20, 20), font=font)

    return montage


def main():
    os.makedirs(ASSETS_DIR, exist_ok=True)
    roster = roster_hero_names()
    portraits = fetch_overfast_portraits()

    matched = []
    missing = []
    for name in roster:
        hero = portraits.get(normalize(name))
        if hero is None:
            missing.append(name)
            continue
        matched.append((name, download_portrait(hero)))

    montage = build_montage(matched)
    montage.save(OUTPUT_PATH)

    print(f"Matched {len(matched)}/{len(roster)} heroes.")
    print(f"Saved montage: {OUTPUT_PATH} ({montage.width}x{montage.height})")
    if missing:
        print(f"No official portrait (skipped): {', '.join(missing)}")


if __name__ == "__main__":
    main()
