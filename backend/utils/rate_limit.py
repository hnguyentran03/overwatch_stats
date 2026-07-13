"""A tiny in-memory sliding-window rate limiter.

Process-local (resets on restart) and not shared across workers — sufficient for
guarding a single expensive endpoint on a personal app. ``now`` is injectable so
the window logic is unit-testable without sleeping.
"""
import time
from collections import deque


class SlidingWindowLimiter:
    def __init__(self, max_calls, window_seconds):
        self.max_calls = max_calls
        self.window_seconds = window_seconds
        self._calls = deque()

    def _prune(self, now):
        while self._calls and now - self._calls[0] >= self.window_seconds:
            self._calls.popleft()

    def allow(self, now=None):
        """Record and allow a call, or reject it.

        Returns ``(True, 0)`` when the call is under the limit (and records it),
        or ``(False, retry_after_seconds)`` when the window is full.
        """
        now = time.time() if now is None else now
        self._prune(now)
        if len(self._calls) >= self.max_calls:
            retry_after = int(self.window_seconds - (now - self._calls[0])) + 1
            return False, retry_after
        self._calls.append(now)
        return True, 0

    def refund(self):
        """Undo the most recent recorded call (e.g. when no work was actually done)."""
        if self._calls:
            self._calls.pop()

    def reset(self):
        self._calls.clear()
