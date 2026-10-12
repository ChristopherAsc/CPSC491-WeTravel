import pytest
from models import Post, SafetyReport


@pytest.fixture
def auth_headers(client, seeded_user):
    """Log in and return the authentication header."""
    response = client.post(
        "/api/auth/login",
        json={
            "username": "testuser",
            "password": "TestPassword123!",
        },
    )
    assert response.status_code == 200

    token = response.json()["access_token"]
    return {"Authorization": f"Bearer {token}"}


@pytest.fixture
def post_data():
    return {
        "caption": "Exploring Yosemite!",
        "media_url": "https://example.com/yosemite.jpg",
        "location": {
            "name": "Yosemite National Park",
            "latitude": 37.8651,
            "longitude": -119.5383,
        },
    }


@pytest.fixture
def safety_data():
    return {
        "report_type": "Road Hazard",
        "description": "Fallen tree blocking the road.",
        "location": {
            "name": "Yosemite National Park",
            "latitude": 37.8651,
            "longitude": -119.5383,
        },
    }


# =========================================================
# Post Tests
# =========================================================


def test_create_post_success(client, auth_headers, post_data, db):
    response = client.post(
        "/api/posts",
        json=post_data,
        headers=auth_headers,
    )

    assert response.status_code == 201
    data = response.json()

    assert data["caption"] == post_data["caption"]
    assert data["media_url"] == post_data["media_url"]
    assert data["location"]["name"] == "Yosemite National Park"

    saved_post = db.get(Post, data["post_id"])
    assert saved_post is not None
    assert saved_post.user_id == data["user_id"]


def test_create_post_requires_auth(client, post_data):
    response = client.post("/api/posts", json=post_data)
    assert response.status_code == 401


def test_get_posts(client, auth_headers, post_data):
    created = client.post(
        "/api/posts",
        json=post_data,
        headers=auth_headers,
    )
    assert created.status_code == 201

    response = client.get("/api/posts")

    assert response.status_code == 200
    assert any(post["post_id"] == created.json()["post_id"] for post in response.json())


def test_get_individual_post(client, auth_headers, post_data):
    created = client.post(
        "/api/posts",
        json=post_data,
        headers=auth_headers,
    )
    assert created.status_code == 201

    post_id = created.json()["post_id"]
    response = client.get(f"/api/posts/{post_id}")

    assert response.status_code == 200
    assert response.json()["post_id"] == post_id


def test_get_nonexistent_post(client):
    response = client.get("/api/posts/999999")
    assert response.status_code == 404


def test_create_post_empty_caption(client, auth_headers, post_data):
    post_data["caption"] = ""

    response = client.post(
        "/api/posts",
        json=post_data,
        headers=auth_headers,
    )

    assert response.status_code == 422


def test_create_post_invalid_coordinates(client, auth_headers, post_data):
    post_data["location"]["latitude"] = 200

    response = client.post(
        "/api/posts",
        json=post_data,
        headers=auth_headers,
    )

    assert response.status_code == 422


def test_create_post_media_url_too_long(client, auth_headers, post_data):
    post_data["media_url"] = "x" * 2049

    response = client.post(
        "/api/posts",
        json=post_data,
        headers=auth_headers,
    )

    assert response.status_code == 422


# =========================================================
# Safety Report Tests
# =========================================================


def test_create_safety_report_success(client, auth_headers, safety_data, db):
    response = client.post(
        "/api/safety-reports",
        json=safety_data,
        headers=auth_headers,
    )

    assert response.status_code == 201
    data = response.json()

    assert data["report_type"] == "Road Hazard"
    assert data["location"]["name"] == "Yosemite National Park"

    saved_report = db.get(SafetyReport, data["report_id"])
    assert saved_report is not None
    assert saved_report.user_id == data["user_id"]


def test_create_safety_report_requires_auth(client, safety_data):
    response = client.post("/api/safety-reports", json=safety_data)
    assert response.status_code == 401


def test_get_safety_reports(client, auth_headers, safety_data):
    created = client.post(
        "/api/safety-reports",
        json=safety_data,
        headers=auth_headers,
    )
    assert created.status_code == 201

    response = client.get("/api/safety-reports")

    assert response.status_code == 200
    assert any(
        report["report_id"] == created.json()["report_id"] for report in response.json()
    )


def test_safety_report_missing_type(client, auth_headers, safety_data):
    del safety_data["report_type"]

    response = client.post(
        "/api/safety-reports",
        json=safety_data,
        headers=auth_headers,
    )

    assert response.status_code == 422


def test_safety_report_empty_type(client, auth_headers, safety_data):
    safety_data["report_type"] = ""

    response = client.post(
        "/api/safety-reports",
        json=safety_data,
        headers=auth_headers,
    )

    assert response.status_code == 422


def test_safety_report_invalid_location(client, auth_headers, safety_data):
    safety_data["location"]["longitude"] = 250

    response = client.post(
        "/api/safety-reports",
        json=safety_data,
        headers=auth_headers,
    )

    assert response.status_code == 422
