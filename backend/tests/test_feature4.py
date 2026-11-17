"""Feature #4 API integration and social/auth regression coverage (SQLite test DB)."""
import pytest
from models import User
from routes import create_access_token, hash_password


@pytest.fixture
def travelers(db):
    people = []
    for name in ("traveler_a4", "traveler_b4", "traveler_c4"):
        user = User(username=name, email=f"{name}@example.com", hashed_password=hash_password("ExamplePassword123!"))
        db.add(user)
        people.append(user)
    db.commit()
    for user in people:
        db.refresh(user)
    return people


def headers(user):
    return {"Authorization": f"Bearer {create_access_token(user.user_id, user.username)}"}


def test_username_update_persists_and_rejects_duplicates(client, db, travelers):
    a, b, _ = travelers
    assert client.patch("/api/users/me", json={"username": "new_traveler_a4"}, headers=headers(a)).status_code == 200
    assert client.get("/api/users/me", headers=headers(a)).json()["username"] == "new_traveler_a4"
    assert client.patch("/api/users/me", json={"username": b.username}, headers=headers(a)).status_code == 409
    assert db.get(User, a.user_id).username == "new_traveler_a4"
    assert client.patch("/api/users/me", json={"username": "x"}, headers=headers(a)).status_code == 422
    assert client.patch("/api/users/me", json={"username": "bad spaces"}, headers=headers(a)).status_code == 422
    assert client.patch("/api/users/me", json={"username": "hacked"}).status_code == 401


def test_search_and_public_profile_privacy(client, travelers):
    a, b, _ = travelers
    result = client.get("/api/users/search?username=traveler_b", headers=headers(a))
    assert result.status_code == 200
    assert result.json() == [{"user_id": b.user_id, "username": b.username}]
    assert client.get("/api/users/search?username=missing-person", headers=headers(a)).json() == []
    assert client.get("/api/users/search?username=a", headers=headers(a)).json() == [{"user_id": b.user_id, "username": b.username}, {"user_id": travelers[2].user_id, "username": travelers[2].username}]
    assert client.get("/api/users/search?username=b").status_code == 401
    assert client.get("/api/users/search?username=%25", headers=headers(a)).json() == []
    assert client.get("/api/users/search?username=__", headers=headers(a)).json() == []
    profile = client.get(f"/api/users/{b.user_id}").json()
    assert "email" not in profile and "hashed_password" not in profile


def test_friend_request_full_lifecycle_and_authorization(client, travelers):
    a, b, c = travelers
    route = f"/api/friends/requests/{b.user_id}"
    assert client.post(route).status_code == 401
    assert client.post(route, headers=headers(a)).status_code == 201
    assert client.post(route, headers=headers(a)).status_code == 409
    assert client.post(f"/api/friends/requests/{a.user_id}", headers=headers(b)).status_code == 409
    assert client.post(f"/api/friends/requests/{a.user_id}", headers=headers(a)).status_code == 400
    req = client.get("/api/friends/requests", headers=headers(b)).json()[0]
    rid = req["request_id"]
    assert req["status"] == "pending"
    assert client.patch(f"/api/friends/requests/{rid}?decision=accept", headers=headers(a)).status_code == 403
    assert client.patch(f"/api/friends/requests/{rid}?decision=accept", headers=headers(c)).status_code == 403
    assert client.patch(f"/api/friends/requests/{rid}?decision=accept", headers=headers(b)).status_code == 200
    assert client.patch(f"/api/friends/requests/{rid}?decision=accept", headers=headers(b)).status_code == 409
    assert client.get("/api/friends", headers=headers(a)).json()[0]["user_id"] == b.user_id
    assert client.get("/api/friends", headers=headers(b)).json()[0]["user_id"] == a.user_id
    assert client.get("/api/friends", headers=headers(c)).json() == []
    assert client.delete(f"/api/friends/{b.user_id}", headers=headers(c)).status_code == 404
    assert client.delete(f"/api/friends/{b.user_id}", headers=headers(a)).status_code == 200
    assert client.get("/api/friends", headers=headers(a)).json() == []
    assert client.get("/api/friends", headers=headers(b)).json() == []


def test_declining_is_not_accepting(client, travelers):
    a, b, _ = travelers
    rid = client.post(f"/api/friends/requests/{b.user_id}", headers=headers(a)).json()["request_id"]
    declined = client.patch(f"/api/friends/requests/{rid}?decision=decline", headers=headers(b))
    assert declined.status_code == 200 and declined.json()["status"] == "declined"
    assert client.get("/api/friends", headers=headers(a)).json() == []
    assert client.patch(f"/api/friends/requests/{rid}?decision=accept", headers=headers(b)).status_code == 409


def test_password_change_requires_current_password_and_changes_login(client, travelers):
    a, _, _ = travelers
    url = "/api/users/me/password"
    assert client.put(url, headers=headers(a), json={"current_password": "WRONG", "new_password": "DifferentPassword123!"}).status_code == 403
    assert client.put(url, headers=headers(a), json={"current_password": "ExamplePassword123!", "new_password": "ExamplePassword123!"}).status_code == 422
    assert client.put(url, headers=headers(a), json={"current_password": "ExamplePassword123!", "new_password": "DifferentPassword123!"}).status_code == 200
    assert client.post("/api/auth/login", json={"username": a.username, "password": "ExamplePassword123!"}).status_code == 401
    assert client.post("/api/auth/login", json={"username": a.username, "password": "DifferentPassword123!"}).status_code == 200


def test_account_delete_requires_password_and_revokes_identity(client, travelers):
    a, b, _ = travelers
    assert client.request("DELETE", "/api/users/me", headers=headers(a), json={"password": "wrong"}).status_code == 403
    assert client.post(f"/api/friends/requests/{b.user_id}", headers=headers(a)).status_code == 201
    assert client.request("DELETE", "/api/users/me", headers=headers(a), json={"password": "ExamplePassword123!"}).status_code == 200
    assert client.get("/api/users/me", headers=headers(a)).status_code == 401
    assert client.post("/api/auth/login", json={"username": a.username, "password": "ExamplePassword123!"}).status_code == 401
    assert client.get("/api/friends/requests", headers=headers(b)).json() == []
