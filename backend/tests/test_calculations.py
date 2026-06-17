"""Pure unit tests for utils/calculations.py.

These use lightweight stand-in objects (SimpleNamespace) so they exercise the
math directly without needing a database or the ORM.
"""
import os
import sys
from datetime import datetime
from types import SimpleNamespace

import pytest

BACKEND_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
if BACKEND_DIR not in sys.path:
    sys.path.insert(0, BACKEND_DIR)

from utils.calculations import (  # noqa: E402
    calculate_win_percentage,
    aggregate_hero_stats,
    calculate_map_trends,
    identify_weakest_maps,
    calculate_kda_ratio,
)


def make_match(outcome, date_time=None):
    return SimpleNamespace(
        outcome=SimpleNamespace(value=outcome),
        date_time=date_time or datetime(2026, 1, 1),
    )


def make_mp(**kwargs):
    defaults = dict(
        eliminations=0,
        final_blows=0,
        assists=0,
        deaths=0,
        damage_done=0.0,
        healing_done=0.0,
        damage_mitigated=0.0,
        time_played=0.0,
    )
    defaults.update(kwargs)
    return SimpleNamespace(**defaults)


# --------------------------------------------------------------------------- #
# calculate_win_percentage
# --------------------------------------------------------------------------- #


class TestCalculateWinPercentage:
    def test_empty_returns_zeros(self):
        result = calculate_win_percentage([])
        assert result == {
            "wins": 0,
            "losses": 0,
            "draws": 0,
            "total": 0,
            "win_percentage": 0.0,
        }

    def test_all_wins(self):
        matches = [make_match("win"), make_match("win")]
        result = calculate_win_percentage(matches)
        assert result["wins"] == 2
        assert result["losses"] == 0
        assert result["total"] == 2
        assert result["win_percentage"] == 100.0

    def test_mixed_outcomes(self):
        matches = [
            make_match("win"),
            make_match("win"),
            make_match("loss"),
            make_match("draw"),
        ]
        result = calculate_win_percentage(matches)
        assert result["wins"] == 2
        assert result["losses"] == 1
        assert result["draws"] == 1
        assert result["total"] == 4
        assert result["win_percentage"] == 50.0

    def test_rounding(self):
        # 1 win out of 3 -> 33.33
        matches = [make_match("win"), make_match("loss"), make_match("loss")]
        result = calculate_win_percentage(matches)
        assert result["win_percentage"] == 33.33


# --------------------------------------------------------------------------- #
# aggregate_hero_stats
# --------------------------------------------------------------------------- #


class TestAggregateHeroStats:
    def test_empty_returns_zeroed_dict(self):
        result = aggregate_hero_stats([])
        assert result["games_played"] == 0
        assert result["total_eliminations"] == 0
        assert result["avg_eliminations"] == 0.0
        assert result["elims_per_10"] == 0.0

    def test_totals_and_averages(self):
        mps = [
            make_mp(eliminations=10, deaths=2, damage_done=5000.0, time_played=10.0),
            make_mp(eliminations=20, deaths=4, damage_done=7000.0, time_played=10.0),
        ]
        result = aggregate_hero_stats(mps)
        assert result["games_played"] == 2
        assert result["total_eliminations"] == 30
        assert result["total_deaths"] == 6
        assert result["total_damage_done"] == 12000.0
        assert result["avg_eliminations"] == 15.0
        assert result["avg_deaths"] == 3.0
        assert result["avg_damage_done"] == 6000.0

    def test_per_10_min_rates(self):
        # 30 elims over 20 minutes total -> 15 per 10 min.
        mps = [
            make_mp(eliminations=15, time_played=10.0),
            make_mp(eliminations=15, time_played=10.0),
        ]
        result = aggregate_hero_stats(mps)
        assert result["elims_per_10"] == 15.0

    def test_zero_time_played_avoids_division_by_zero(self):
        mps = [make_mp(eliminations=5, time_played=0.0)]
        result = aggregate_hero_stats(mps)
        assert result["elims_per_10"] == 0.0
        # averages still computed off games_played
        assert result["avg_eliminations"] == 5.0


# --------------------------------------------------------------------------- #
# calculate_map_trends
# --------------------------------------------------------------------------- #


class TestCalculateMapTrends:
    def test_empty_returns_empty_list(self):
        assert calculate_map_trends([]) == []

    def test_groups_by_day(self):
        matches = [
            make_match("win", datetime(2026, 1, 1, 10, 0)),
            make_match("loss", datetime(2026, 1, 1, 20, 0)),
            make_match("win", datetime(2026, 1, 2, 10, 0)),
        ]
        trends = calculate_map_trends(matches, time_window="day")
        assert len(trends) == 2
        assert trends[0]["matches_played"] == 2
        assert trends[0]["wins"] == 1
        assert trends[0]["win_percentage"] == 50.0
        assert trends[1]["matches_played"] == 1
        assert trends[1]["win_percentage"] == 100.0

    def test_groups_by_week(self):
        # Both in the same ISO week.
        matches = [
            make_match("win", datetime(2026, 1, 5)),  # Monday
            make_match("win", datetime(2026, 1, 7)),  # Wednesday
        ]
        trends = calculate_map_trends(matches, time_window="week")
        assert len(trends) == 1
        assert trends[0]["matches_played"] == 2

    def test_groups_by_month(self):
        matches = [
            make_match("win", datetime(2026, 1, 5)),
            make_match("loss", datetime(2026, 2, 5)),
        ]
        trends = calculate_map_trends(matches, time_window="month")
        assert len(trends) == 2

    def test_trends_sorted_chronologically(self):
        matches = [
            make_match("win", datetime(2026, 3, 1)),
            make_match("win", datetime(2026, 1, 1)),
            make_match("win", datetime(2026, 2, 1)),
        ]
        trends = calculate_map_trends(matches, time_window="month")
        starts = [t["period_start"] for t in trends]
        assert starts == sorted(starts)


# --------------------------------------------------------------------------- #
# identify_weakest_maps
# --------------------------------------------------------------------------- #


class TestIdentifyWeakestMaps:
    def test_empty(self):
        assert identify_weakest_maps([]) == []

    def test_sorted_by_win_percentage_ascending(self):
        data = [
            {"map_name": "A", "win_percentage": 80.0, "total": 5},
            {"map_name": "B", "win_percentage": 20.0, "total": 5},
            {"map_name": "C", "win_percentage": 50.0, "total": 5},
        ]
        result = identify_weakest_maps(data)
        assert [m["map_name"] for m in result] == ["B", "C", "A"]

    def test_tiebreak_prefers_more_games(self):
        data = [
            {"map_name": "few", "win_percentage": 50.0, "total": 2},
            {"map_name": "many", "win_percentage": 50.0, "total": 10},
        ]
        result = identify_weakest_maps(data)
        # Same win %, more games comes first.
        assert result[0]["map_name"] == "many"


# --------------------------------------------------------------------------- #
# calculate_kda_ratio
# --------------------------------------------------------------------------- #


class TestCalculateKdaRatio:
    def test_perfect_when_no_deaths(self):
        assert calculate_kda_ratio(10, 0, 5) == "Perfect"

    def test_normal_ratio(self):
        # (10 + 5) / 5 = 3.0
        assert calculate_kda_ratio(10, 5, 5) == 3.0

    def test_rounding(self):
        # (10 + 0) / 3 = 3.33
        assert calculate_kda_ratio(10, 3, 0) == 3.33
