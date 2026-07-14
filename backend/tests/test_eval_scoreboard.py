"""Unit tests for the pure helpers in scripts/eval_scoreboard.py."""
import importlib.util
import os

BACKEND_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
_SCRIPT = os.path.join(BACKEND_DIR, "scripts", "eval_scoreboard.py")
_spec = importlib.util.spec_from_file_location("eval_scoreboard", _SCRIPT)
eval_scoreboard = importlib.util.module_from_spec(_spec)
_spec.loader.exec_module(eval_scoreboard)

VALID = {"Reinhardt", "Genji", "Tracer", "Ana", "Kiriko"}


def test_validate_label_accepts_ten_roster_heroes():
    heroes = ["Reinhardt", "Genji", "Tracer", "Ana", "Kiriko"] * 2
    assert eval_scoreboard.validate_label("a.png", heroes, VALID) == []


def test_validate_label_rejects_wrong_length():
    problems = eval_scoreboard.validate_label("a.png", ["Genji"], VALID)
    assert problems == ["a.png: label must list exactly 10 heroes"]


def test_validate_label_rejects_unknown_hero():
    heroes = ["Reinhardt", "Genji", "Tracer", "Ana", "Kiriko"] * 2
    heroes[3] = "Not A Hero"
    problems = eval_scoreboard.validate_label("a.png", heroes, VALID)
    assert problems == ["a.png: 'Not A Hero' is not a roster hero name"]


def test_compare_rows_counts_hits_and_misses():
    predicted = [{"hero_name": "Reinhardt"}, {"hero_name": "Tracer"},
                 {"hero_name": ""}]
    expected = ["Reinhardt", "Genji", "Ana"]
    hits, misses = eval_scoreboard.compare_rows(predicted, expected)
    assert hits == 1
    assert misses == [(2, "Tracer", "Genji"), (3, "(unsure)", "Ana")]


def test_compare_rows_pads_short_predictions():
    hits, misses = eval_scoreboard.compare_rows([], ["Ana", "Kiriko"])
    assert hits == 0
    assert misses == [(1, "(unsure)", "Ana"), (2, "(unsure)", "Kiriko")]
