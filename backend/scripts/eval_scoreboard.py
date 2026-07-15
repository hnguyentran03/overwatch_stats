"""Measure scoreboard hero-detection accuracy against labeled screenshots.

Setup:
  1. Drop scoreboard screenshots into backend/eval/screenshots/ (gitignored).
  2. Add each file to backend/eval/labels.json: filename -> list of the 10
     correct hero names in row order (team1 rows 1-5 top-to-bottom, then
     team2 rows 1-5). Use exact roster spellings from the heroes table.

Usage (each labeled screenshot costs one paid API call):
  python scripts/eval_scoreboard.py                 # eval every labeled file
  python scripts/eval_scoreboard.py match1.png      # eval a subset
  python scripts/eval_scoreboard.py --save-crops    # no API calls; write the
      portrait crops to eval/crops/ to check the crop fractions visually
"""
import argparse
import json
import mimetypes
import os
import sqlite3
import sys

BACKEND_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
if BACKEND_DIR not in sys.path:
    sys.path.insert(0, BACKEND_DIR)

from utils.scoreboard import parse_scoreboard, _portrait_crop  # noqa: E402

EVAL_DIR = os.path.join(BACKEND_DIR, "eval")
SCREENSHOT_DIR = os.path.join(EVAL_DIR, "screenshots")
CROPS_DIR = os.path.join(EVAL_DIR, "crops")
LABELS_PATH = os.path.join(EVAL_DIR, "labels.json")
DB_PATH = os.path.join(BACKEND_DIR, "overwatch_stats.db")


def load_roster():
    """Return {role: [hero names]} from the app database."""
    if not os.path.exists(DB_PATH):
        sys.exit(f"Database not found: {DB_PATH} — start the backend once to create and seed it.")
    conn = sqlite3.connect(DB_PATH)
    try:
        rows = conn.execute(
            "SELECT role, hero_name FROM heroes ORDER BY role, hero_name"
        ).fetchall()
    finally:
        conn.close()
    roster = {}
    for role, name in rows:
        roster.setdefault(role, []).append(name)
    return roster


def validate_label(filename, heroes, valid_names):
    """Return a list of problem strings (empty when the label is valid)."""
    if not isinstance(heroes, list) or len(heroes) != 10:
        return [f"{filename}: label must list exactly 10 heroes"]
    return [
        f"{filename}: '{hero}' is not a roster hero name"
        for hero in heroes
        if hero not in valid_names
    ]


def compare_rows(predicted_players, expected_heroes):
    """Return (hits, misses) where misses are (row, predicted, expected)."""
    hits = 0
    misses = []
    predicted = [p["hero_name"] for p in predicted_players]
    predicted += [""] * (len(expected_heroes) - len(predicted))
    for row, (got, want) in enumerate(zip(predicted, expected_heroes), start=1):
        if got == want:
            hits += 1
        else:
            misses.append((row, got or "(unsure)", want))
    return hits, misses


def load_labels(only_files, valid_names):
    """Return {filename: [10 hero names]}, validated. Exits on bad data."""
    if not os.path.exists(LABELS_PATH):
        sys.exit(f"Missing labels file: {LABELS_PATH}")
    with open(LABELS_PATH) as f:
        labels = json.load(f)
    if only_files:
        missing = [name for name in only_files if name not in labels]
        if missing:
            sys.exit(f"No labels for: {', '.join(missing)}")
        labels = {name: labels[name] for name in only_files}
    if not labels:
        sys.exit(f"No labeled screenshots. Add files to {SCREENSHOT_DIR} "
                 f"and label them in {LABELS_PATH}.")
    for filename, heroes in labels.items():
        problems = validate_label(filename, heroes, valid_names)
        if problems:
            sys.exit("\n".join(problems))
        path = os.path.join(SCREENSHOT_DIR, filename)
        if not os.path.exists(path):
            sys.exit(f"Screenshot not found: {path}")
    return labels


def save_crops(labels):
    os.makedirs(CROPS_DIR, exist_ok=True)
    for filename in labels:
        with open(os.path.join(SCREENSHOT_DIR, filename), "rb") as f:
            crop = _portrait_crop(f.read())
        if crop is None:
            print(f"{filename}: no crop (aspect outside card-layout bounds, or unreadable)")
            continue
        stem, _ = os.path.splitext(filename)
        out_path = os.path.join(CROPS_DIR, f"crop_{stem}.png")
        with open(out_path, "wb") as f:
            f.write(crop)
        print(f"{filename}: wrote {out_path}")


def main():
    parser = argparse.ArgumentParser(
        description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter
    )
    parser.add_argument("files", nargs="*",
                        help="screenshot filenames (default: all labeled)")
    parser.add_argument("--save-crops", action="store_true",
                        help="write portrait crops for calibration; no API calls")
    args = parser.parse_args()

    roster = load_roster()
    valid_names = {name for names in roster.values() for name in names}
    labels = load_labels(args.files, valid_names)

    if args.save_crops:
        save_crops(labels)
        return

    if not os.getenv("ANTHROPIC_API_KEY"):
        sys.exit("ANTHROPIC_API_KEY is not set")

    print(f"About to make {len(labels)} paid API call(s).")
    total_hits = 0
    total_rows = 0
    for filename, expected in labels.items():
        path = os.path.join(SCREENSHOT_DIR, filename)
        media_type = mimetypes.guess_type(path)[0] or "image/png"
        with open(path, "rb") as f:
            players = parse_scoreboard(f.read(), media_type, roster)
        hits, misses = compare_rows(players, expected)
        total_hits += hits
        total_rows += len(expected)
        print(f"\n{filename}: {hits}/{len(expected)}")
        for row, got, want in misses:
            print(f"  row {row}: predicted {got}, expected {want}")
    print(f"\nOverall hero accuracy: {total_hits}/{total_rows} "
          f"({100 * total_hits / total_rows:.0f}%)")


if __name__ == "__main__":
    main()
