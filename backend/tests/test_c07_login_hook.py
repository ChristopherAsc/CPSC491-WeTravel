"""C07 login hook tests (T11): failed logins on the real endpoint.

These tests call POST /api/auth/login through TestClient and check that
the security logger records failed logins and raises one threshold alert,
without changing the login response.
"""

import logging

import pytest
import security_events
from failed_login_detector import FailedLoginDetector
from security_events import (
    EVENT_LOGIN_FAILED,
    EVENT_THRESHOLD_EXCEEDED,
    record_failed_login_attempt,
)

SECURITY_LOGGER = security_events.SECURITY_LOGGER_NAME
WRONG_PASSWORD = "Canary-Wrong-Password-C07!"
LOGIN_URL = "/api/auth/login"


@pytest.fixture()
def fresh_detector(monkeypatch: pytest.MonkeyPatch) -> FailedLoginDetector:
    detector = FailedLoginDetector()
    monkeypatch.setattr(security_events, "failed_login_detector", detector)
    return detector


@pytest.fixture()
def security_caplog(caplog: pytest.LogCaptureFixture) -> pytest.LogCaptureFixture:
    caplog.set_level(logging.INFO, logger=SECURITY_LOGGER)
    return caplog


def security_messages(caplog: pytest.LogCaptureFixture, event_type: str) -> list:
    return [
        record
        for record in caplog.records
        if record.name == SECURITY_LOGGER and event_type in record.getMessage()
    ]


def failed_login(client, username: str = "testuser"):
    return client.post(
        LOGIN_URL,
        json={"username": username, "password": WRONG_PASSWORD},
    )


def test_t11_wrong_password_is_logged_and_still_returns_401(
    client, seeded_user, fresh_detector, security_caplog
):
    response = failed_login(client)

    assert response.status_code == 401
    assert response.json()["detail"] == "Invalid username or password"
    assert len(security_messages(security_caplog, EVENT_LOGIN_FAILED)) == 1
    assert security_messages(security_caplog, EVENT_THRESHOLD_EXCEEDED) == []


def test_t11_unknown_username_is_logged(client, fresh_detector, security_caplog):
    response = failed_login(client, username="no-such-user")

    assert response.status_code == 401
    assert len(security_messages(security_caplog, EVENT_LOGIN_FAILED)) == 1


def test_t11_five_failures_trigger_exactly_one_alert(
    client, seeded_user, fresh_detector, security_caplog
):
    for _ in range(6):
        assert failed_login(client).status_code == 401

    assert len(security_messages(security_caplog, EVENT_LOGIN_FAILED)) == 6

    alerts = security_messages(security_caplog, EVENT_THRESHOLD_EXCEEDED)
    assert len(alerts) == 1
    assert alerts[0].levelno == logging.WARNING


def test_t11_logs_never_contain_password_or_raw_username(
    client, seeded_user, fresh_detector, security_caplog
):
    for _ in range(5):
        failed_login(client)

    log_text = security_caplog.text
    assert WRONG_PASSWORD not in log_text
    assert '"testuser"' not in log_text
    assert "access_token" not in log_text


def test_t11_successful_login_is_not_logged(
    client, seeded_user, fresh_detector, security_caplog
):
    response = client.post(
        LOGIN_URL,
        json={"username": "testuser", "password": "TestPassword123!"},
    )

    assert response.status_code == 200
    assert security_messages(security_caplog, EVENT_LOGIN_FAILED) == []


def test_t11_detector_error_never_breaks_login(
    client, seeded_user, fresh_detector, security_caplog, monkeypatch
):
    def broken_record_failure(*_args, **_kwargs):
        raise RuntimeError("detector is down")

    monkeypatch.setattr(fresh_detector, "record_failure", broken_record_failure)

    response = failed_login(client)

    assert response.status_code == 401
    assert "security_alert_pipeline_failed" in security_caplog.text


def test_t11_helper_uses_given_detector(security_caplog):
    detector = FailedLoginDetector(threshold=2)

    record_failed_login_attempt("synthetic-user", detector=detector)
    record_failed_login_attempt("synthetic-user", detector=detector)

    alerts = security_messages(security_caplog, EVENT_THRESHOLD_EXCEEDED)
    assert len(alerts) == 1
