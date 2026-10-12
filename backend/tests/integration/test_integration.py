from models import Location, Post


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
