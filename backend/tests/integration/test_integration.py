import pytest
from models import Location, Post


def register_and_login(client, username):
    password = "TestPassword123!"

    registration = client.post(
        "/api/auth/register",
        json={
            "username": username,
            "email": f"{username}@example.com",
            "password": password,
        },
    )
    assert registration.status_code == 201

    login = client.post(
        "/api/auth/login",
        json={"username": username, "password": password},
    )
    assert login.status_code == 200

    headers = {"Authorization": f"Bearer {login.json()['access_token']}"}

    return registration.json()["user_id"], headers


def test_get_posts_integration_smoke(client, db, seeded_user):
    """
    Verify the Sprint 2 API integration path:

    FastAPI
        -> SQLAlchemy
        -> test database
        -> ORM relationship loading
        -> Pydantic response serialization
        -> JSON response
    """

    # Arrange: create a real Location ORM object.
    location = Location(
        name="Los Angeles, California",
        latitude=34.0522,
        longitude=-118.2437,
    )

    db.add(location)
    db.flush()

    # Arrange: create a Post tied to the seeded User and Location.
    post = Post(
        user_id=seeded_user.user_id,
        location_id=location.location_id,
        caption="Integration smoke test post",
        media_url=None,
    )

    db.add(post)
    db.commit()
    db.refresh(post)

    # Act: call the real FastAPI endpoint through TestClient.
    response = client.get("/api/posts")

    # Assert: FastAPI successfully returned the database-backed response.
    assert response.status_code == 200

    data = response.json()

    assert isinstance(data, list)
    assert len(data) == 1

    returned_post = data[0]

    # Verify the Post ORM fields serialized correctly.
    assert returned_post["post_id"] == post.post_id
    assert returned_post["user_id"] == seeded_user.user_id
    assert returned_post["caption"] == "Integration smoke test post"
    assert returned_post["media_url"] is None
    assert "created_at" in returned_post

    # Verify the Post -> Location ORM relationship serialized through Pydantic.
    assert returned_post["location"]["name"] == "Los Angeles, California"
    assert returned_post["location"]["latitude"] == 34.0522
    assert returned_post["location"]["longitude"] == -118.2437


def test_get_posts_returns_empty_list_when_no_posts_exist(client):
    """
    Verify the representative endpoint still returns a valid JSON response
    when the database contains no Post records.
    """

    response = client.get("/api/posts")

    assert response.status_code == 200
    assert response.json() == []


def test_registration_login_and_protected_route_integration(client):
    """
    Verify the PostgreSQL authentication integration path:

    Registration
        -> FastAPI
        -> password hashing
        -> SQLAlchemy
        -> PostgreSQL persistence
        -> Login
        -> credential verification
        -> JWT generation
        -> protected route
        -> JWT validation
        -> PostgreSQL user lookup
    """

    registration_data = {
        "username": "integration_auth_user",
        "email": "integration_auth@example.com",
        "password": "TestPassword123!",
    }

    # -------------------------------------------------
    # Register user
    # -------------------------------------------------

    register_response = client.post(
        "/api/auth/register",
        json=registration_data,
    )

    assert register_response.status_code == 201

    register_data = register_response.json()

    assert register_data["message"] == "User registered successfully"
    assert "user_id" in register_data

    registered_user_id = register_data["user_id"]

    # -------------------------------------------------
    # Login using persisted PostgreSQL user
    # -------------------------------------------------

    login_response = client.post(
        "/api/auth/login",
        json={
            "username": registration_data["username"],
            "password": registration_data["password"],
        },
    )

    assert login_response.status_code == 200

    login_data = login_response.json()

    assert "access_token" in login_data
    assert login_data["access_token"]
    assert login_data["token_type"] == "bearer"

    token = login_data["access_token"]

    # -------------------------------------------------
    # Use JWT against protected route
    # -------------------------------------------------

    user_response = client.get(
        "/api/users/me",
        headers={
            "Authorization": f"Bearer {token}",
        },
    )

    assert user_response.status_code == 200

    user_data = user_response.json()

    assert user_data["user_id"] == registered_user_id
    assert user_data["username"] == registration_data["username"]
    assert user_data["email"] == registration_data["email"]


def test_itinerary_create_and_retrieve_regression(client):
    """
    Sprint 4 MVP regression:
    Verify an authenticated user can create an itinerary
    and retrieve it through the backend API.
    """

    # Register a test user.
    registration = client.post(
        "/api/auth/register",
        json={
            "username": "sprint4_itinerary_user",
            "email": "sprint4_itinerary@example.com",
            "password": "TestPassword123!",
        },
    )
    assert registration.status_code == 201

    # Log in to obtain an access token.
    login = client.post(
        "/api/auth/login",
        json={
            "username": "sprint4_itinerary_user",
            "password": "TestPassword123!",
        },
    )
    assert login.status_code == 200

    headers = {"Authorization": f"Bearer {login.json()['access_token']}"}

    # Create an itinerary.
    create_response = client.post(
        "/api/itineraries",
        json={
            "name": "Sprint 4 Regression Trip",
            "start_date": "2026-11-10",
            "end_date": "2026-11-15",
        },
        headers=headers,
    )

    assert (
        create_response.status_code == 201
    ), f"Itinerary creation failed: {create_response.json()}"

    created = create_response.json()
    assert created["name"] == "Sprint 4 Regression Trip"

    itinerary_id = created["itinerary_id"]

    # Verify the itinerary appears in the user's list.
    list_response = client.get(
        "/api/itineraries",
        headers=headers,
    )
    assert list_response.status_code == 200
    assert any(trip["itinerary_id"] == itinerary_id for trip in list_response.json())

    # Retrieve the itinerary by ID.
    detail_response = client.get(
        f"/api/itineraries/{itinerary_id}",
        headers=headers,
    )
    assert detail_response.status_code == 200
    assert detail_response.json()["itinerary_id"] == itinerary_id
    assert detail_response.json()["name"] == "Sprint 4 Regression Trip"


@pytest.mark.requirement("POST-02")
def test_created_post_appears_first_in_feed_integration(client):
    """
    Sprint 4 Create Post -> Feed integration:

    Authenticated POST /api/posts
        -> post and location persisted
        -> GET /api/posts returns the new post first
        -> every submitted field round-trips unchanged
    """

    user_id, headers = register_and_login(client, "create_feed_user")

    first_post = {
        "caption": "Sunrise over Half Dome",
        "media_url": None,
        "location": {
            "name": "Yosemite National Park, California, United States",
            "latitude": 37.8651,
            "longitude": -119.5383,
        },
    }
    newest_post = {
        "caption": "Fog rolling over the Golden Gate",
        "media_url": None,
        "location": {
            "name": "San Francisco, California, United States",
            "latitude": 37.7749,
            "longitude": -122.4194,
        },
    }

    first_response = client.post("/api/posts", json=first_post, headers=headers)
    assert first_response.status_code == 201

    newest_response = client.post("/api/posts", json=newest_post, headers=headers)
    assert newest_response.status_code == 201
    created = newest_response.json()

    feed_response = client.get("/api/posts")
    assert feed_response.status_code == 200
    feed = feed_response.json()

    assert [post["post_id"] for post in feed] == [
        created["post_id"],
        first_response.json()["post_id"],
    ], "Newest post must be listed first in the feed"

    feed_post = feed[0]
    assert feed_post == created
    assert feed_post["user_id"] == user_id
    assert feed_post["caption"] == newest_post["caption"]
    assert feed_post["media_url"] is None
    assert feed_post["location"] == newest_post["location"]

    detail_response = client.get(f"/api/posts/{created['post_id']}")
    assert detail_response.status_code == 200
    assert detail_response.json() == created


@pytest.mark.requirement("POST-03", "POST-04")
@pytest.mark.parametrize(
    "invalid_post",
    [
        {
            "caption": "   ",
            "location": {"name": "Paris", "latitude": 48.8, "longitude": 2.3},
        },
        {"caption": "No location given"},
        {
            "caption": "Impossible coordinates",
            "location": {"name": "Nowhere", "latitude": 91, "longitude": 2.3},
        },
    ],
    ids=["blank-caption", "missing-location", "invalid-latitude"],
)
def test_rejected_post_is_not_added_to_feed_integration(client, invalid_post):
    """A rejected submission returns a clear error and never reaches the feed."""

    _, headers = register_and_login(client, "rejected_post_user")

    response = client.post("/api/posts", json=invalid_post, headers=headers)

    assert response.status_code == 422
    assert response.json()["detail"], "Validation errors must explain the problem"
    assert client.get("/api/posts").json() == []
