"""Rolling-window threshold detector for failed logins (C07-02).

In-memory and single-process. Intended for synthetic tests and a
demonstration threshold, not for multi-process production monitoring.

Rules:
- Count failures per actor_key inside a rolling window (default 5 minutes).
- An event exactly WINDOW old is expired and no longer counted.
- The THRESHOLD-th failure in the window triggers one alert (returns True).
- Further failures in the same burst do not trigger duplicate alerts.
- The alert re-arms once the in-window count drops below THRESHOLD, so a
  later, separate burst can alert again.
- Out-of-order events are inserted in time order; expiry is measured from
  the latest event seen for that actor_key.
"""

from bisect import insort
from collections import deque
from datetime import datetime, timedelta, timezone

WINDOW = timedelta(minutes=5)
THRESHOLD = 5


class FailedLoginDetector:
    def __init__(
        self,
        threshold: int = THRESHOLD,
        window: timedelta = WINDOW,
    ) -> None:
        if threshold < 1:
            raise ValueError("threshold must be at least 1")

        if window <= timedelta(0):
            raise ValueError("window must be positive")

        self.threshold = threshold
        self.window = window
        self.failures: dict[str, deque[datetime]] = {}
        self.alerted: set[str] = set()

    def record_failure(
        self,
        actor_key: str,
        occurred_at: datetime | None = None,
    ) -> bool:
        """Return True only when a new threshold alert is triggered."""

        if not actor_key:
            raise ValueError("actor_key is required")

        event_time = (
            occurred_at if occurred_at is not None else datetime.now(timezone.utc)
        )

        if event_time.tzinfo is None:
            raise ValueError("occurred_at must be timezone-aware")

        events = self.failures.setdefault(actor_key, deque())

        if events and event_time < events[-1]:
            insort(events, event_time)
        else:
            events.append(event_time)

        self._expire(actor_key, reference_time=events[-1])

        if event_time not in events:
            # The event itself was already outside the window.
            return False

        if len(events) >= self.threshold and actor_key not in self.alerted:
            self.alerted.add(actor_key)
            return True

        return False

    def failure_count(self, actor_key: str) -> int:
        """Return the number of failures currently inside the window."""

        return len(self.failures.get(actor_key, ()))

    def _expire(self, actor_key: str, reference_time: datetime) -> None:
        """Drop expired events and re-arm the alert when the burst ends."""

        events = self.failures[actor_key]
        cutoff = reference_time - self.window

        while events and events[0] <= cutoff:
            events.popleft()

        if len(events) < self.threshold:
            self.alerted.discard(actor_key)

        if not events:
            del self.failures[actor_key]