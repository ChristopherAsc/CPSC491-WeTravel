"""Structured security event logging for failed authentication (C07).

This module only records security events. It never changes authentication
decisions, token validation, or rate limiting.

Safety rules:
- Only allowlisted fields are emitted (see ALLOWED_FIELDS).
- Raw usernames are never logged; they are converted to a pseudonymous
  actor_key using HMAC-SHA256.
- Passwords, tokens, headers, and request bodies are never accepted as input.
"""

from __future__ import annotations

import hashlib
import hmac
import json
import logging
import os
import secrets
import uuid
from dataclasses import asdict, dataclass
from datetime import datetime, timezone
from typing import Any

# ---------------------------------------------------------
# Constants
# ---------------------------------------------------------

SECURITY_LOGGER_NAME = "wetravel.security"

EVENT_LOGIN_FAILED = "auth.login_failed"
OUTCOME_FAILURE = "failure"
REASON_INVALID_CREDENTIALS = "invalid_credentials"

ALLOWED_FIELDS = (
    "timestamp",
    "event_type",
    "outcome",
    "reason",
    "request_id",
    "actor_key",
    "source",
)

REQUIRED_FIELDS = (
    "timestamp",
    "event_type",
    "outcome",
    "request_id",
    "actor_key",
)

HMAC_KEY_ENV = "SECURITY_LOG_HMAC_KEY"

security_logger = logging.getLogger(SECURITY_LOGGER_NAME)


# ---------------------------------------------------------
# Actor Key (pseudonymous identifier)
# ---------------------------------------------------------


def _load_hmac_key() -> bytes:
    """Load the HMAC key from the environment.

    If the variable is not set, a random per-process key is used. Actor keys
    are then stable only while the process runs, which is enough for an
    in-memory detector and avoids adding a required .env or CI secret.
    """

    configured_key = os.environ.get(HMAC_KEY_ENV)

    if configured_key:
        return configured_key.encode("utf-8")

    return secrets.token_bytes(32)


_HMAC_KEY = _load_hmac_key()


def make_actor_key(identifier: str, key: bytes | None = None) -> str:
    """Convert a login identifier into a pseudonymous grouping key."""

    hmac_key = _HMAC_KEY if key is None else key
    normalized_identifier = identifier.strip().lower()

    digest = hmac.new(
        hmac_key,
        normalized_identifier.encode("utf-8"),
        hashlib.sha256,
    ).hexdigest()

    return f"actor-{digest[:16]}"


# ---------------------------------------------------------
# Event Schema
# ---------------------------------------------------------


@dataclass(frozen=True)
class SecurityEvent:
    timestamp: str
    event_type: str
    outcome: str
    request_id: str
    actor_key: str
    reason: str | None = None
    source: str = "api"

    def to_dict(self) -> dict[str, str]:
        """Return only allowlisted, non-empty fields in a stable order."""

        raw_data = asdict(self)

        return {
            field_name: raw_data[field_name]
            for field_name in ALLOWED_FIELDS
            if raw_data.get(field_name) is not None
        }


def validate_event(event_data: dict[str, Any]) -> None:
    """Reject events with missing required fields or unexpected fields."""

    missing_fields = [
        field_name for field_name in REQUIRED_FIELDS if not event_data.get(field_name)
    ]

    if missing_fields:
        raise ValueError(f"Missing required security event fields: {missing_fields}")

    unexpected_fields = sorted(set(event_data) - set(ALLOWED_FIELDS))

    if unexpected_fields:
        raise ValueError(f"Unexpected security event fields: {unexpected_fields}")


def format_utc_timestamp(moment: datetime) -> str:
    """Format an aware datetime as UTC ISO-8601 with a Z suffix."""

    if moment.tzinfo is None:
        raise ValueError("Timestamp must be timezone-aware")

    return (
        moment.astimezone(timezone.utc)
        .isoformat(timespec="seconds")
        .replace("+00:00", "Z")
    )


# ---------------------------------------------------------
# Event Builders and Emitters
# ---------------------------------------------------------


def build_failed_login_event(
    username: str,
    request_id: str | None = None,
    now: datetime | None = None,
    source: str = "api",
) -> SecurityEvent:
    """Build a failed-login event. The raw username is never stored."""

    event_time = now if now is not None else datetime.now(timezone.utc)

    return SecurityEvent(
        timestamp=format_utc_timestamp(event_time),
        event_type=EVENT_LOGIN_FAILED,
        outcome=OUTCOME_FAILURE,
        reason=REASON_INVALID_CREDENTIALS,
        request_id=request_id or f"req-{uuid.uuid4().hex[:12]}",
        actor_key=make_actor_key(username),
        source=source,
    )


def create_security_event(
    *,
    event_name: str,
    outcome: str,
    request_id: str,
    actor_key: str,
    now: datetime | None = None,
    source: str = "synthetic",
) -> dict[str, str]:
    """Create a validated event from an already pseudonymous actor_key.

    Intended for synthetic tests and the detector. Callers must never pass a
    raw username, email, password, or token as actor_key.
    """

    event_time = now if now is not None else datetime.now(timezone.utc)

    event = SecurityEvent(
        timestamp=format_utc_timestamp(event_time),
        event_type=event_name,
        outcome=outcome,
        request_id=request_id,
        actor_key=actor_key,
        source=source,
    )

    event_data = event.to_dict()
    validate_event(event_data)

    return event_data


def emit_security_event(event: SecurityEvent) -> dict[str, str]:
    """Validate and write one structured JSON event to the security logger."""

    event_data = event.to_dict()
    validate_event(event_data)

    security_logger.info(json.dumps(event_data, sort_keys=True))

    return event_data


def log_failed_login(
    username: str,
    request_id: str | None = None,
) -> dict[str, str] | None:
    """Record a failed login without ever interrupting the login flow.

    Returns the emitted event, or None if logging failed.
    """

    try:
        event = build_failed_login_event(
            username=username,
            request_id=request_id,
        )
        return emit_security_event(event)

    except Exception:  # noqa: BLE001 - logging must never break login
        security_logger.error("security_event_emit_failed")
        return None
