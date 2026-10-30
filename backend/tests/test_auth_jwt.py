"""JWT and protected-endpoint tests for WT-14 (step 5, AT-07).

These tests add to test_auth.py without repeating it: they check the token
contents, the error behaviour for bad tokens, that every protected endpoint
rejects anonymous requests, and that a token identifies the right user.
"""

from datetime import datetime, timedelta, timezone

import jwt
import pytest
from models import Location, Post, User
from routes import (
    ACCESS_TOKEN_EXPIRE_MINUTES,
    ALGORITHM,
    SECRET_KEY,
    create_access_token,
    hash_password,
)

PASSWORD = "TestPassword123!"
OTHER_SECRET = "a-different-secret-used-to-forge-tokens-1234567890"

# Endpoints that need a signed-in user
PROTECTED_ENDPOINTS = [
    ("GET", "/api/auth/me"),
    ("GET", "/api/users/me"),
    ("GET", "/api/users/me/posts"),
    ("POST", "/api/posts"),
    ("DELETE", "/api/posts/1"),
    ("GET", "/api/itineraries"),
    ("POST", "/api/itineraries"),
    ("POST", "/api/safety-reports"),
]


def auth_header(token: str) -> dict[str, str]:
    return {"Authorization": f"Bearer {token}"}


def login_token(client, username: str = "testuser", password: str = PASSWORD) -> str:
    response = client.post(
        "/api/auth/login",
        json={"username": username, "password": password},
    )

    assert response.status_code == 200

    return response.json()["access_token"]


def build_bad_token(kind: str, user_id: int) -> str:
    claims = {
        "sub": str(user_id),
        "username": "testuser",
        "exp": datetime.now(timezone.utc) + timedelta(minutes=5),
    }

    if kind == "malformed":
        return "not.a.jwt"

    if kind == "wrong_signature":
        return jwt.encode(claims, OTHER_SECRET, algorithm=ALGORITHM)

    if kind == "expired":
        claims["exp"] = datetime.now(timezone.utc) - timedelta(minutes=1)
        return jwt.encode(claims, SECRET_KEY, algorithm=ALGORITHM)

    if kind == "missing_subject":
        del claims["sub"]
        return jwt.encode(claims, SECRET_KEY, algorithm=ALGORITHM)

    # For C03 SOC2 Compliance Testing
    if kind == "missing_expiration":
        del claims["exp"]
        return jwt.encode(claims, SECRET_KEY, algorithm=ALGORITHM)
    #

    if kind == "unsigned":
        return jwt.encode(claims, key=None, algorithm="none")

    raise ValueError(kind)


def make_other_user(db) -> User:
    other = User(
        username="otheruser",
        email="other@example.com",
        hashed_password=hash_password("OtherPassword123!"),
    )

    db.add(other)
    db.commit()
    db.refresh(other)

    return other


# ---------------------------------------------------------------------------
# Login and token contents
# ---------------------------------------------------------------------------


@pytest.mark.requirement("AUTH-02")
def test_login_token_has_the_expected_claims(client, seeded_user):
    token = login_token(client)

    payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
    now = datetime.now(timezone.utc).timestamp()

    assert payload["sub"] == str(seeded_user.user_id)
    assert payload["username"] == "testuser"

    # The lifetime follows the configured setting, not a hard-coded number
    remaining = payload["exp"] - now
    assert abs(remaining - ACCESS_TOKEN_EXPIRE_MINUTES * 60) < 30


@pytest.mark.requirement("AUTH-02")
def test_login_failures_give_the_same_answer(client, seeded_user):
    wrong_password = client.post(
        "/api/auth/login",
        json={"username": "testuser", "password": "wrong-password"},
    )
    unknown_user = client.post(
        "/api/auth/login",
        json={"username": "nobody", "password": PASSWORD},
    )

    # Same response, so the API does not reveal which usernames exist
    assert wrong_password.status_code == 401
    assert unknown_user.status_code == 401
    assert wrong_password.json() == unknown_user.json()


@pytest.mark.requirement("AUTH-02")
def test_login_requires_username_and_password(client):
    missing_password = client.post("/api/auth/login", json={"username": "testuser"})
    missing_username = client.post("/api/auth/login", json={"password": PASSWORD})

    assert missing_password.status_code == 422
    assert missing_username.status_code == 422


# ---------------------------------------------------------------------------
# Requests without a valid token
# ---------------------------------------------------------------------------


@pytest.mark.requirement("AUTH-05")
@pytest.mark.parametrize(("method", "path"), PROTECTED_ENDPOINTS)
def test_protected_endpoints_reject_requests_without_a_token(client, method, path):
    body = {} if method == "POST" else None

    response = client.request(method, path, json=body)

    assert response.status_code == 401


@pytest.mark.requirement("AUTH-05")
# missing expiration added for SOC2 - Randoll
@pytest.mark.parametrize(
    "kind",
    [
        "malformed",
        "wrong_signature",
        "expired",
        "missing_subject",
        "missing_expiration",
        "unsigned",
    ],
)
def test_invalid_tokens_are_rejected(client, seeded_user, kind):
    token = build_bad_token(kind, seeded_user.user_id)

    response = client.get("/api/users/me", headers=auth_header(token))

    assert response.status_code == 401


@pytest.mark.requirement("AUTH-05")
def test_token_for_a_deleted_user_is_rejected(client):
    token = create_access_token(user_id=999999, username="ghost")

    response = client.get("/api/users/me", headers=auth_header(token))

    assert response.status_code == 401
    assert response.json()["detail"] == "User no longer exists"


@pytest.mark.requirement("AUTH-05")
def test_authorization_header_must_use_the_bearer_scheme(client, seeded_user):
    token = login_token(client)

    response = client.get(
        "/api/users/me",
        headers={"Authorization": f"Token {token}"},
    )

    assert response.status_code == 401


# ---------------------------------------------------------------------------
# A valid token identifies the right user
# ---------------------------------------------------------------------------


@pytest.mark.requirement("AUTH-05")
def test_token_identifies_the_correct_user(client, db, seeded_user):
    other = make_other_user(db)

    mine = client.get(
        "/api/users/me",
        headers=auth_header(
            create_access_token(seeded_user.user_id, seeded_user.username)
        ),
    )
    theirs = client.get(
        "/api/auth/me",
        headers=auth_header(create_access_token(other.user_id, other.username)),
    )

    assert mine.status_code == 200
    assert theirs.status_code == 200
    assert mine.json()["username"] == "testuser"
    assert theirs.json()["username"] == "otheruser"


@pytest.mark.requirement("AUTH-05")
def test_profile_response_does_not_expose_the_password(client, seeded_user):
    token = login_token(client)

    data = client.get("/api/users/me", headers=auth_header(token)).json()

    assert not any("password" in key for key in data)


@pytest.mark.requirement("AUTH-05")
def test_only_the_owner_can_delete_a_post(client, db, seeded_user):
    other = make_other_user(db)

    location = Location(
        name="Yosemite National Park", latitude=37.8651, longitude=-119.5383
    )
    db.add(location)
    db.commit()
    db.refresh(location)

    post = Post(
        user_id=seeded_user.user_id,
        location_id=location.location_id,
        caption="Owner's post",
    )
    db.add(post)
    db.commit()
    db.refresh(post)

    intruder = client.delete(
        f"/api/posts/{post.post_id}",
        headers=auth_header(create_access_token(other.user_id, other.username)),
    )
    owner = client.delete(
        f"/api/posts/{post.post_id}",
        headers=auth_header(
            create_access_token(seeded_user.user_id, seeded_user.username)
        ),
    )

    assert intruder.status_code == 403
    assert owner.status_code == 204


# ---------------------------------------------------------------------------
# Whole flow through the API
# ---------------------------------------------------------------------------


@pytest.mark.requirement("AUTH-05")
def test_register_login_and_read_profile_flow(client):
    register = client.post(
        "/api/auth/register",
        json={
            "username": "flowuser",
            "email": "flow@example.com",
            "password": "FlowPassword123!",
        },
    )
    assert register.status_code == 201

    token = login_token(client, "flowuser", "FlowPassword123!")

    me = client.get("/api/users/me", headers=auth_header(token))

    assert me.status_code == 200
    assert me.json()["user_id"] == register.json()["user_id"]
    assert me.json()["email"] == "flow@example.com"
