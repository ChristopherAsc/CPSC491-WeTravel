"""BUG-02: login must run the password hash check even for unknown usernames."""

import routes

LOGIN_URL = "/api/auth/login"
WRONG_PASSWORD = "Wrong-Password-123"


def spy_on_verify_password(monkeypatch) -> list[str]:
    """Record every hash that login() passes to verify_password."""
    checked_hashes: list[str] = []
    real_verify = routes.verify_password

    def spy(plain_password: str, hashed_password: str) -> bool:
        checked_hashes.append(hashed_password)
        return real_verify(plain_password, hashed_password)

    monkeypatch.setattr(routes, "verify_password", spy)
    return checked_hashes


def test_unknown_username_still_runs_the_password_check(client, monkeypatch):
    checked_hashes = spy_on_verify_password(monkeypatch)

    response = client.post(
        LOGIN_URL, json={"username": "no_such_user", "password": WRONG_PASSWORD}
    )

    assert response.status_code == 401
    assert checked_hashes == [routes.DUMMY_PASSWORD_HASH]


def test_existing_username_checks_the_real_hash(client, seeded_user, monkeypatch):
    checked_hashes = spy_on_verify_password(monkeypatch)

    response = client.post(
        LOGIN_URL, json={"username": "testuser", "password": WRONG_PASSWORD}
    )

    assert response.status_code == 401
    assert checked_hashes == [seeded_user.hashed_password]


def test_valid_login_still_succeeds(client, seeded_user):
    response = client.post(
        LOGIN_URL, json={"username": "testuser", "password": "TestPassword123!"}
    )

    assert response.status_code == 200
