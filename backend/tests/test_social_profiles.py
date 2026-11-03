"""Sprint 4 social MVP tests for public profiles and user posts."""

from models import Location, Post, User
from routes import hash_password


def test_public_profile_returns_public_fields_only(client, db):
    user = User(
        username="social_profile_user",
        email="social_profile@example.com",
        hashed_password=hash_password("ExamplePassword123!"),
    )
    db.add(user)
    db.commit()
    db.refresh(user)

    response = client.get(f"/api/users/{user.user_id}")

    assert response.status_code == 200
    body = response.json()
    assert body["user_id"] == user.user_id
    assert body["username"] == "social_profile_user"
    assert "email" not in body
    assert "hashed_password" not in body
    assert "posts" not in body


def test_public_profile_nonexistent_user(client):
    response = client.get("/api/users/999999999")

    assert response.status_code == 404


def test_user_posts_returns_only_requested_users_posts(client, db):
    user_a = User(
        username="social_posts_a",
        email="social_posts_a@example.com",
        hashed_password=hash_password("ExamplePassword123!"),
    )
    user_b = User(
        username="social_posts_b",
        email="social_posts_b@example.com",
        hashed_password=hash_password("ExamplePassword123!"),
    )
    location = Location(name="Social Test Location", latitude=33.9, longitude=-117.9)
    db.add_all([user_a, user_b, location])
    db.commit()
    db.refresh(user_a)
    db.refresh(user_b)

    post_a = Post(
        user_id=user_a.user_id,
        location_id=location.location_id,
        caption="Post belonging to A",
    )
    post_b = Post(
        user_id=user_b.user_id,
        location_id=location.location_id,
        caption="Post belonging to B",
    )
    db.add_all([post_a, post_b])
    db.commit()

    response = client.get(f"/api/users/{user_a.user_id}/posts")

    assert response.status_code == 200
    posts = response.json()
    assert len(posts) == 1
    assert posts[0]["user_id"] == user_a.user_id
    assert posts[0]["caption"] == "Post belonging to A"


def test_user_posts_returns_empty_list_for_user_without_posts(client, db):
    user = User(
        username="social_no_posts",
        email="social_no_posts@example.com",
        hashed_password=hash_password("ExamplePassword123!"),
    )
    db.add(user)
    db.commit()
    db.refresh(user)

    response = client.get(f"/api/users/{user.user_id}/posts")

    assert response.status_code == 200
    assert response.json() == []


def test_user_posts_nonexistent_user(client):
    response = client.get("/api/users/999999999/posts")

    assert response.status_code == 404


def test_individual_post_returns_post_details(client, db):
    user = User(
        username="social_post_detail",
        email="social_post_detail@example.com",
        hashed_password=hash_password("ExamplePassword123!"),
    )
    location = Location(name="Post Detail Location", latitude=33.9, longitude=-117.9)
    db.add_all([user, location])
    db.commit()
    db.refresh(user)
    db.refresh(location)

    post = Post(
        user_id=user.user_id,
        location_id=location.location_id,
        caption="Individual post detail",
    )
    db.add(post)
    db.commit()
    db.refresh(post)

    response = client.get(f"/api/posts/{post.post_id}")

    assert response.status_code == 200
    body = response.json()
    assert body["post_id"] == post.post_id
    assert body["user_id"] == user.user_id
    assert body["caption"] == "Individual post detail"
    assert body["location"]["name"] == "Post Detail Location"


def test_individual_post_nonexistent(client):
    response = client.get("/api/posts/999999999")

    assert response.status_code == 404
