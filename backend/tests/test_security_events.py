"""C07 security audit logging and alert detection tests (SCRUM-51).

All tests use synthetic identifiers and fixed, timezone-aware timestamps.
No real credentials, tokens, or database access are needed.

T01 Schema            T06 Re-arm
T02 Threshold         T07 Out-of-order
T03 Deduplication     T08 No-secret
T04 Isolation         T09 Missing / unexpected fields
T05 Expiry            T10 Alert schema
"""

import json
import logging
from datetime import datetime, timedelta, timezone

import pytest
import security_events
from failed_login_detector import FailedLoginDetector
from security_events import (
    ALLOWED_FIELDS,
    EVENT_LOGIN_FAILED,
    EVENT_THRESHOLD_EXCEEDED,
    REQUIRED_FIELDS,
    build_failed_login_event,
    create_security_event,
    emit_security_event,
    emit_threshold_alert,
    log_failed_login,
    make_actor_key,
    validate_event,
)

SECURITY_LOGGER = "wetravel.security"
ACTOR = "synthetic-user-01"
OTHER_ACTOR = "synthetic-user-02"
T0 = datetime(2026, 11, 1, 18, 0, 0, tzinfo=timezone.utc)

# Canary values that must never appear in log output.
CANARY_USERNAME = "canary-user-7f3a"
CANARY_PASSWORD = "CanaryP@ssw0rd!9x"
CANARY_JWT = (
    "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9"
    ".eyJzdWIiOiJjYW5hcnkifQ.c2lnbmF0dXJlLWNhbmFyeQ"
)


def at(seconds: float) -> datetime:
    """Return a timestamp `seconds` after T0."""
    return T0 + timedelta(seconds=seconds)


def security_records(caplog: pytest.LogCaptureFixture) -> list[logging.LogRecord]:
    return [r for r in caplog.records if r.name == SECURITY_LOGGER]


@pytest.fixture
def detector() -> FailedLoginDetector:
    return FailedLoginDetector()


@pytest.fixture
def security_caplog(caplog: pytest.LogCaptureFixture) -> pytest.LogCaptureFixture:
    caplog.set_level(logging.INFO, logger=SECURITY_LOGGER)
    return caplog


# ---------------------------------------------------------
# T01 - Schema
# ---------------------------------------------------------


def test_t01_failed_login_event_has_required_schema(security_caplog):
    event = build_failed_login_event(
        username=ACTOR,
        request_id="req-t01",
        now=T0,
    )
    emitted = emit_security_event(event)

    assert set(REQUIRED_FIELDS) <= set(emitted)
    assert set(emitted) <= set(ALLOWED_FIELDS)
    assert emitted["event_type"] == EVENT_LOGIN_FAILED
    assert emitted["outcome"] == "failure"
    assert emitted["reason"] == "invalid_credentials"
    assert emitted["request_id"] == "req-t01"
    assert emitted["timestamp"] == "2026-11-01T18:00:00Z"
    assert emitted["actor_key"].startswith("actor-")

    records = security_records(security_caplog)
    assert len(records) == 1
    assert records[0].levelno == logging.INFO
    assert json.loads(records[0].getMessage()) == emitted


def test_t01_create_security_event_returns_valid_event():
    event = create_security_event(
        event_name="login_failed",
        outcome="failure",
        request_id="req-test-001",
        actor_key=ACTOR,
        now=T0,
    )

    validate_event(event)
    assert event["actor_key"] == ACTOR
    assert event["source"] == "synthetic"
    assert event["timestamp"].endswith("Z")


def test_t01_actor_key_is_stable_and_keyed():
    key = b"test-key-1"

    assert make_actor_key("Alice", key) == make_actor_key("  alice ", key)
    assert make_actor_key("alice", key) != make_actor_key("alice", b"test-key-2")
    assert make_actor_key("alice", key) != make_actor_key("bob", key)


# ---------------------------------------------------------
# T02 - Threshold
# ---------------------------------------------------------


def test_t02_four_failures_no_alert_fifth_alerts(detector):
    results = [detector.record_failure(ACTOR, at(s)) for s in (0, 60, 120, 180)]
    assert results == [False, False, False, False]

    assert detector.record_failure(ACTOR, at(240)) is True
    assert detector.failure_count(ACTOR) == 5


# ---------------------------------------------------------
# T03 - Deduplication
# ---------------------------------------------------------


def test_t03_sixth_and_later_failures_do_not_alert_again(detector):
    results = [detector.record_failure(ACTOR, at(i)) for i in range(10)]

    assert results.count(True) == 1
    assert results[4] is True
    assert results[5:] == [False] * 5


def test_t03_continuous_attack_alerts_only_once(detector):
    # One failure per minute for 20 minutes keeps the window at the threshold.
    results = [detector.record_failure(ACTOR, at(60 * i)) for i in range(20)]

    assert results.count(True) == 1


# ---------------------------------------------------------
# T04 - Isolation
# ---------------------------------------------------------


def test_t04_actors_are_counted_independently(detector):
    for i in range(4):
        assert detector.record_failure(ACTOR, at(i)) is False
        assert detector.record_failure(OTHER_ACTOR, at(i)) is False

    assert detector.failure_count(ACTOR) == 4
    assert detector.failure_count(OTHER_ACTOR) == 4

    assert detector.record_failure(ACTOR, at(10)) is True
    assert detector.failure_count(OTHER_ACTOR) == 4
    assert detector.record_failure(OTHER_ACTOR, at(11)) is True


# ---------------------------------------------------------
# T05 - Expiry
# ---------------------------------------------------------


def test_t05_fifth_failure_at_299_seconds_alerts(detector):
    results = [detector.record_failure(ACTOR, at(s)) for s in (0, 60, 120, 180, 299)]

    assert results[-1] is True


def test_t05_event_exactly_300_seconds_old_is_expired(detector):
    results = [detector.record_failure(ACTOR, at(s)) for s in (0, 60, 120, 180, 300)]

    assert results == [False] * 5
    assert detector.failure_count(ACTOR) == 4


def test_t05_old_failures_are_excluded(detector):
    for i in range(4):
        detector.record_failure(ACTOR, at(i))

    assert detector.record_failure(ACTOR, at(600)) is False
    assert detector.failure_count(ACTOR) == 1


# ---------------------------------------------------------
# T06 - Re-arm
# ---------------------------------------------------------


def test_t06_new_burst_after_window_can_alert_again(detector):
    first_burst = [detector.record_failure(ACTOR, at(i)) for i in range(5)]
    assert first_burst.count(True) == 1

    second_burst = [detector.record_failure(ACTOR, at(600 + i)) for i in range(5)]
    assert second_burst == [False, False, False, False, True]


# ---------------------------------------------------------
# T07 - Out-of-order
# ---------------------------------------------------------


def test_t07_out_of_order_events_are_counted_correctly(detector):
    results = [detector.record_failure(ACTOR, at(s)) for s in (100, 0, 200, 50, 150)]

    assert results == [False, False, False, False, True]


def test_t07_late_event_outside_window_is_ignored(detector):
    detector.record_failure(ACTOR, at(1000))

    assert detector.record_failure(ACTOR, at(0)) is False
    assert detector.failure_count(ACTOR) == 1


# ---------------------------------------------------------
# T08 - No-secret
# ---------------------------------------------------------


@pytest.mark.parametrize(
    "typed_identifier",
    [CANARY_USERNAME, CANARY_PASSWORD, CANARY_JWT],
    ids=["username", "password-typed-as-username", "jwt-typed-as-username"],
)
def test_t08_raw_identifier_never_appears_in_logs(security_caplog, typed_identifier):
    # Users sometimes type a password or paste a token into the username field.
    event = log_failed_login(username=typed_identifier, request_id="req-t08")

    assert event is not None
    log_text = security_caplog.text

    assert typed_identifier not in log_text
    assert typed_identifier.lower() not in log_text
    assert "eyJ" not in log_text
    assert "Authorization" not in log_text
    assert "Bearer" not in log_text
    assert "password" not in log_text.lower()


def test_t08_secret_fields_are_rejected_by_validator():
    event = create_security_event(
        event_name=EVENT_LOGIN_FAILED,
        outcome="failure",
        request_id="req-t08",
        actor_key=ACTOR,
        now=T0,
    )

    for secret_field, value in [
        ("password", CANARY_PASSWORD),
        ("token", CANARY_JWT),
        ("authorization", f"Bearer {CANARY_JWT}"),
        ("body", '{"password": "x"}'),
    ]:
        with pytest.raises(ValueError, match="Unexpected"):
            validate_event({**event, secret_field: value})


def test_t08_log_failed_login_never_raises(security_caplog, monkeypatch):
    def broken_emit(_event):
        raise RuntimeError(CANARY_PASSWORD)

    monkeypatch.setattr(security_events, "emit_security_event", broken_emit)

    assert log_failed_login(username=CANARY_USERNAME) is None
    assert "security_event_emit_failed" in security_caplog.text
    assert CANARY_PASSWORD not in security_caplog.text


# ---------------------------------------------------------
# T09 - Missing / unexpected fields
# ---------------------------------------------------------


@pytest.mark.parametrize("missing_field", REQUIRED_FIELDS)
def test_t09_missing_required_field_is_rejected(missing_field):
    event = create_security_event(
        event_name=EVENT_LOGIN_FAILED,
        outcome="failure",
        request_id="req-t09",
        actor_key=ACTOR,
        now=T0,
    )
    event.pop(missing_field)

    with pytest.raises(ValueError, match="Missing"):
        validate_event(event)


def test_t09_empty_request_id_is_rejected():
    with pytest.raises(ValueError, match="Missing"):
        create_security_event(
            event_name=EVENT_LOGIN_FAILED,
            outcome="failure",
            request_id="",
            actor_key=ACTOR,
            now=T0,
        )


def test_t09_naive_timestamp_is_rejected(detector):
    naive = datetime(2026, 11, 1, 18, 0, 0)

    with pytest.raises(ValueError, match="timezone-aware"):
        build_failed_login_event(username=ACTOR, now=naive)

    with pytest.raises(ValueError, match="timezone-aware"):
        detector.record_failure(ACTOR, naive)


def test_t09_empty_actor_key_is_rejected_by_detector(detector):
    with pytest.raises(ValueError, match="actor_key"):
        detector.record_failure("", T0)


# ---------------------------------------------------------
# T10 - Alert schema
# ---------------------------------------------------------


def test_t10_threshold_alert_is_one_warning_with_expected_fields(security_caplog):
    alert = emit_threshold_alert(
        actor_key=ACTOR,
        failure_count=5,
        request_id="alert-t10",
        now=T0,
    )

    assert alert == {
        "timestamp": "2026-11-01T18:00:00Z",
        "event_type": EVENT_THRESHOLD_EXCEEDED,
        "outcome": "alert",
        "reason": "failed_login_threshold_reached",
        "request_id": "alert-t10",
        "actor_key": ACTOR,
        "source": "detector",
        "failure_count": 5,
        "window_seconds": 300,
    }

    records = security_records(security_caplog)
    assert len(records) == 1
    assert records[0].levelno == logging.WARNING
    assert json.loads(records[0].getMessage()) == alert


def test_t10_detector_and_alert_flow_emits_exactly_one_warning(
    detector, security_caplog
):
    for i in range(6):
        if detector.record_failure(ACTOR, at(i)):
            emit_threshold_alert(
                actor_key=ACTOR,
                failure_count=detector.failure_count(ACTOR),
                now=at(i),
            )

    warnings = [
        r for r in security_records(security_caplog) if r.levelno == logging.WARNING
    ]
    assert len(warnings) == 1
    assert json.loads(warnings[0].getMessage())["failure_count"] == 5
