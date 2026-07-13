"""Unit tests for the sliding-window rate limiter (time injected, no sleeping)."""
import os
import sys

BACKEND_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
if BACKEND_DIR not in sys.path:
    sys.path.insert(0, BACKEND_DIR)

from utils.rate_limit import SlidingWindowLimiter  # noqa: E402


def test_allows_up_to_max_then_blocks():
    lim = SlidingWindowLimiter(max_calls=3, window_seconds=100)
    assert lim.allow(now=0) == (True, 0)
    assert lim.allow(now=1) == (True, 0)
    assert lim.allow(now=2) == (True, 0)

    allowed, retry_after = lim.allow(now=3)
    assert allowed is False
    # Oldest call was at t=0; window frees at t=100, so ~97s remain (+1 rounding).
    assert retry_after == 98


def test_window_slides_as_calls_age_out():
    lim = SlidingWindowLimiter(max_calls=1, window_seconds=100)
    assert lim.allow(now=0)[0] is True
    assert lim.allow(now=50)[0] is False     # still within the window
    assert lim.allow(now=100)[0] is True     # first call aged out exactly at the edge


def test_refund_frees_a_slot():
    lim = SlidingWindowLimiter(max_calls=1, window_seconds=100)
    assert lim.allow(now=0)[0] is True
    lim.refund()
    assert lim.allow(now=1)[0] is True


def test_reset_clears_all_calls():
    lim = SlidingWindowLimiter(max_calls=1, window_seconds=100)
    lim.allow(now=0)
    lim.reset()
    assert lim.allow(now=1)[0] is True
