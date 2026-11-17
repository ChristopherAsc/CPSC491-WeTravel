"""Midterm Smoke Test Suite (Sprint 3).

Verifies that the application's most critical workflows are stable enough
for the midterm demo: Authentication, Feed, Create Post, Map, Safety, and
representative backend/API functionality. This suite is intentionally
shallow by design -- it checks for critical failures on the happy path,
not exhaustive edge-case coverage (see 'backend/tests/test_auth.py' and
'backend/tests/test_posts_safety.py' for deeper functional tests).

Run only this suite with: uv run pytest -m smoke -v
Each test is grouped by feature and tags its assertions with the feature
name so a failure is immediately traceable to the broken area.
"""

import pytest
from models import Post

pytestmark = pytest.mark.smoke

SMOKE_LOCATION = {
    "name": "Yosemite National Park",
    "latitude": 37.8651,
    "longitude": -119.5383,
}


@pytest.fixture()
def auth_headers(client):
    """Register and log in a dedicated smoke-test user; return a bearer header."""
    credentials = {"username": "smoke_user", "password": "SmokeTest123!"}

    client.post(
        "/api/auth/register",
        json={**credentials, "email": "smoke_user@example.com"},
    )

    login_response = client.post("/api/auth/login", json=credentials)
    assert (
        login_response.status_code == 200
    ), f"[Authentication] smoke-test login setup failed: {login_response.text}"

    return {"Authorization": f"Bearer {login_response.json()['access_token']}"}


@pytest.mark.requirement("SMOKE-01")
def test_authentication_register_login_and_profile(client):
    """A user can register, log in, and fetch their own profile."""

    register_response = client.post(
        "/api/auth/register",
        json={
            "username": "smoke_auth_user",
            "email": "smoke_auth_user@example.com",
            "password": "SmokeTest123!",
        },
    )
    assert (
        register_response.status_code == 201
    ), f"[Authentication] registration failed: {register_response.text}"

    login_response = client.post(
        "/api/auth/login",
        json={"username": "smoke_auth_user", "password": "SmokeTest123!"},
    )
    assert (
        login_response.status_code == 200
    ), f"[Authentication] login failed: {login_response.text}"

    token = login_response.json()["access_token"]

    profile_response = client.get(
        "/api/auth/me",
        headers={"Authorization": f"Bearer {token}"},
    )
    assert profile_response.status_code == 200, (
        f"[Authentication] fetching the authenticated profile failed: "
        f"{profile_response.text}"
    )
    assert profile_response.json()["username"] == "smoke_auth_user"


@pytest.mark.requirement("SMOKE-02")
def test_feed_loads_existing_posts(client):
    """The feed endpoint responds with a list, even when empty."""

    response = client.get("/api/posts")

    assert (
        response.status_code == 200
    ), f"[Feed] feed endpoint failed to load: {response.text}"
    assert isinstance(
        response.json(), list
    ), "[Feed] feed endpoint did not return a list of posts"


@pytest.mark.requirement("SMOKE-03")
def test_create_post_and_retrieve_it(client, auth_headers):
    """A logged-in user can create a post and immediately retrieve it."""

    create_response = client.post(
        "/api/posts",
        json={
            "caption": "Smoke test travel post",
            "media_url": "https://example.com/smoke.jpg",
            "location": SMOKE_LOCATION,
        },
        headers=auth_headers,
    )
    assert (
        create_response.status_code == 201
    ), f"[Create Post] post creation failed: {create_response.text}"

    post_id = create_response.json()["post_id"]

    feed_response = client.get("/api/posts")
    assert (
        feed_response.status_code == 200
    ), f"[Create Post] feed lookup after creation failed: {feed_response.text}"
    assert any(
        post["post_id"] == post_id for post in feed_response.json()
    ), "[Create Post] newly created post did not appear in the feed"

    detail_response = client.get(f"/api/posts/{post_id}")
    assert (
        detail_response.status_code == 200
    ), f"[Create Post] retrieving the created post failed: {detail_response.text}"


@pytest.mark.requirement("SMOKE-04")
def test_map_can_load_location_and_its_posts(client, auth_headers, db):
    """Map data (a location and the posts tied to it) can be loaded through the API."""

    create_response = client.post(
        "/api/posts",
        json={
            "caption": "Map smoke test post",
            "media_url": None,
            "location": SMOKE_LOCATION,
        },
        headers=auth_headers,
    )
    assert (
        create_response.status_code == 201
    ), f"[Map] setup post creation failed: {create_response.text}"

    post_id = create_response.json()["post_id"]
    location_id = db.get(Post, post_id).location_id

    location_response = client.get(f"/api/locations/{location_id}")
    assert (
        location_response.status_code == 200
    ), f"[Map] location lookup failed: {location_response.text}"
    assert location_response.json()["name"] == SMOKE_LOCATION["name"]

    posts_by_location_response = client.get(f"/api/locations/{location_id}/posts")
    assert (
        posts_by_location_response.status_code == 200
    ), f"[Map] posts-by-location lookup failed: {posts_by_location_response.text}"
    assert any(
        post["post_id"] == post_id for post in posts_by_location_response.json()
    ), "[Map] created post is missing from its location's post list"


@pytest.mark.requirement("SMOKE-05")
def test_safety_reports_are_accessible_and_creatable(client, auth_headers):
    """Safety reports can be listed and a new report is retrievable after creation."""

    list_response = client.get("/api/safety-reports")
    assert (
        list_response.status_code == 200
    ), f"[Safety] safety report listing failed: {list_response.text}"

    create_response = client.post(
        "/api/safety-reports",
        json={
            "report_type": "unsafe-area",
            "description": "Smoke test safety report",
            "location": SMOKE_LOCATION,
        },
        headers=auth_headers,
    )
    assert (
        create_response.status_code == 201
    ), f"[Safety] safety report creation failed: {create_response.text}"

    report_id = create_response.json()["report_id"]

    retrieved_response = client.get("/api/safety-reports")
    assert retrieved_response.status_code == 200
    assert any(
        report["report_id"] == report_id for report in retrieved_response.json()
    ), "[Safety] newly created safety report is not retrievable"


@pytest.mark.requirement("SMOKE-06")
def test_representative_api_endpoints_respond_cleanly(client):
    """Representative endpoints return expected status codes instead of crashing."""

    health_response = client.get("/health")
    assert (
        health_response.status_code == 200
    ), f"[API] health check failed: {health_response.text}"
    assert health_response.json() == {"status": "healthy"}

    unauthenticated_response = client.get("/api/users/me")
    assert unauthenticated_response.status_code == 401, (
        f"[API] protected route did not reject an unauthenticated request: "
        f"{unauthenticated_response.status_code}"
    )

    missing_resource_response = client.get("/api/posts/999999999")
    assert missing_resource_response.status_code == 404, (
        f"[API] missing resource did not return a clean 404: "
        f"{missing_resource_response.status_code}"
    )


@pytest.mark.requirement("SMOKE-08")
def test_invalid_requests_are_rejected_cleanly(client, auth_headers):
    """Malformed request bodies and bad credentials are rejected without crashing."""

    invalid_payload_response = client.post(
        "/api/posts",
        json={"caption": "", "location": SMOKE_LOCATION},
        headers=auth_headers,
    )
    assert invalid_payload_response.status_code == 422, (
        f"[API] an invalid post payload was not rejected cleanly: "
        f"{invalid_payload_response.status_code}"
    )

    invalid_token_response = client.get(
        "/api/users/me",
        headers={"Authorization": "Bearer not-a-real-token"},
    )
    assert invalid_token_response.status_code == 401, (
        f"[API] an invalid auth token was not rejected cleanly: "
        f"{invalid_token_response.status_code}"
    )
