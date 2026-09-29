def test_register_success(client):
    response = client.post(
        "/api/auth/register",
        json={
            "username": "newuser",
            "email": "newuser@example.com",
            "password": "Password123!",
        },
    )

    assert response.status_code == 201

    data = response.json()

    assert data["message"] == "User registered successfully"
    assert "user_id" in data


def test_register_duplicate_email(client, seeded_user):
    response = client.post(
        "/api/auth/register",
        json={
            "username": "anotheruser",
            "email": "test@example.com",
            "password": "Password123!",
        },
    )

    assert response.status_code == 409


def test_register_duplicate_username(client, seeded_user):
    response = client.post(
        "/api/auth/register",
        json={
            "username": "testuser",
            "email": "different@example.com",
            "password": "Password123!",
        },
    )

    assert response.status_code == 409


def test_login_success(client, seeded_user):
    response = client.post(
        "/api/auth/login",
        json={
            "username": "testuser",
            "password": "TestPassword123!",
        },
    )

    assert response.status_code == 200

    data = response.json()

    assert "access_token" in data
    assert data["token_type"] == "bearer"


def test_login_invalid_username(client):
    response = client.post(
        "/api/auth/login",
        json={
            "username": "doesnotexist",
            "password": "Password123!",
        },
    )

    assert response.status_code == 401


def test_register_invalid_email(client):
    response = client.post(
        "/api/auth/register",
        json={
            "username": "bademailuser",
            "email": "not-an-email",
            "password": "Password123!",
        },
    )

    assert response.status_code == 422


def test_login_invalid_password(client, seeded_user):
    response = client.post(
        "/api/auth/login",
        json={
            "username": "testuser",
            "password": "wrongpassword",
        },
    )

    assert response.status_code == 401


def test_protected_route_requires_token(client):
    response = client.get("/api/users/me")

    assert response.status_code == 401


def test_protected_route_with_valid_token(client, seeded_user):
    login_response = client.post(
        "/api/auth/login",
        json={
            "username": "testuser",
            "password": "TestPassword123!",
        },
    )

    token = login_response.json()["access_token"]

    response = client.get(
        "/api/users/me",
        headers={
            "Authorization": f"Bearer {token}",
        },
    )

    assert response.status_code == 200

    data = response.json()

    assert data["username"] == "testuser"
    assert data["email"] == "test@example.com"


def test_invalid_jwt_is_rejected(client):
    response = client.get(
        "/api/users/me",
        headers={
            "Authorization": "Bearer invalid-token",
        },
    )

    assert response.status_code == 401


def test_register_password_too_short(client):
    response = client.post(
        "/api/auth/register",
        json={
            "username": "shortpassuser",
            "email": "shortpass@example.com",
            "password": "123",
        },
    )

    assert response.status_code == 422
