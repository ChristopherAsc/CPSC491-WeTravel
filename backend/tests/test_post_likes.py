"""Post Like API tests for authenticated like/unlike toggle behavior."""

import pytest
from models import Location, Post, PostLike, User
from routes import create_access_token, hash_password

# =========================================================
# 1. Test Fixtures
# =========================================================
# Creates two users and a test post. The two users allow the
# suite to verify that likes are tracked independently.
# =========================================================


@pytest.fixture
def like_users(db):
    users = []

    for suffix in ("owner", "second"):
        user = User(
            username=f"like_{suffix}",
            email=f"like_{suffix}@example.com",
            hashed_password=hash_password("ExamplePassword123!"),
        )
        db.add(user)
        users.append(user)

    db.commit()

    for user in users:
        db.refresh(user)

    return users


@pytest.fixture
def like_headers(like_users):
    return [
        {"Authorization": f"Bearer {create_access_token(user.user_id, user.username)}"}
        for user in like_users
    ]


@pytest.fixture
def like_post(db, like_users):
    location = Location(
        name="Like Test Location",
        latitude=33.9,
        longitude=-117.9,
    )

    post = Post(
        user_id=like_users[0].user_id,
        location=location,
        caption="Post Like Test",
    )

    db.add(post)
    db.commit()
    db.refresh(post)

    return post


# =========================================================
# 2. Like Toggle Tests
# =========================================================
# First request creates a like.
# Second request removes the existing like.
# =========================================================


@pytest.mark.requirement("SOCIAL-LIKES")
def test_user_can_like_post(client, db, like_post, like_users, like_headers):
    """Verify a user can like an existing post."""
    response = client.post(
        f"/api/posts/{like_post.post_id}/likes",
        headers=like_headers[0],
    )

    assert response.status_code == 200
    assert response.json() == {
        "post_id": like_post.post_id,
        "liked": True,
        "like_count": 1,
    }

    like = db.get(
        PostLike,
        (like_users[0].user_id, like_post.post_id),
    )
    assert like is not None


@pytest.mark.requirement("SOCIAL-LIKES")
def test_user_can_toggle_like_off(
    client,
    db,
    like_post,
    like_users,
    like_headers,
):
    """Verify a second request removes the user's existing like."""
    client.post(
        f"/api/posts/{like_post.post_id}/likes",
        headers=like_headers[0],
    )

    response = client.post(
        f"/api/posts/{like_post.post_id}/likes",
        headers=like_headers[0],
    )

    assert response.status_code == 200
    assert response.json() == {
        "post_id": like_post.post_id,
        "liked": False,
        "like_count": 0,
    }

    like = db.get(
        PostLike,
        (like_users[0].user_id, like_post.post_id),
    )
    assert like is None


# =========================================================
# 3. Multiple User Tests
# =========================================================
# Verifies that likes belong to individual users and that
# one user's toggle does not affect another user's like.
# =========================================================


@pytest.mark.requirement("SOCIAL-LIKES")
def test_multiple_users_can_like_same_post(
    client,
    db,
    like_post,
    like_users,
    like_headers,
):
    """Verify multiple users can independently like the same post."""
    response_a = client.post(
        f"/api/posts/{like_post.post_id}/likes",
        headers=like_headers[0],
    )

    response_b = client.post(
        f"/api/posts/{like_post.post_id}/likes",
        headers=like_headers[1],
    )

    assert response_a.json()["liked"] is True
    assert response_b.json()["liked"] is True
    assert response_b.json()["like_count"] == 2

    assert (
        db.get(
            PostLike,
            (like_users[0].user_id, like_post.post_id),
        )
        is not None
    )

    assert (
        db.get(
            PostLike,
            (like_users[1].user_id, like_post.post_id),
        )
        is not None
    )


@pytest.mark.requirement("SOCIAL-LIKES")
def test_one_user_unliking_does_not_remove_another_users_like(
    client,
    db,
    like_post,
    like_users,
    like_headers,
):
    """Verify one user's unlike does not affect another user's like."""
    client.post(
        f"/api/posts/{like_post.post_id}/likes",
        headers=like_headers[0],
    )

    client.post(
        f"/api/posts/{like_post.post_id}/likes",
        headers=like_headers[1],
    )

    response = client.post(
        f"/api/posts/{like_post.post_id}/likes",
        headers=like_headers[0],
    )

    assert response.status_code == 200
    assert response.json()["liked"] is False
    assert response.json()["like_count"] == 1

    assert (
        db.get(
            PostLike,
            (like_users[0].user_id, like_post.post_id),
        )
        is None
    )

    assert (
        db.get(
            PostLike,
            (like_users[1].user_id, like_post.post_id),
        )
        is not None
    )


# =========================================================
# 4. Authentication and Error Handling Tests
# =========================================================


@pytest.mark.requirement("SOCIAL-LIKES")
def test_like_requires_authentication(client, like_post):
    """Verify unauthenticated users cannot like or unlike posts."""
    response = client.post(
        f"/api/posts/{like_post.post_id}/likes",
    )

    assert response.status_code == 401


@pytest.mark.requirement("SOCIAL-LIKES")
def test_like_nonexistent_post(client, like_headers):
    """Verify liking a nonexistent post returns HTTP 404."""
    response = client.post(
        "/api/posts/999999999/likes",
        headers=like_headers[0],
    )

    assert response.status_code == 404


@pytest.mark.requirement("SOCIAL-LIKES")
def test_like_count_is_isolated_per_post(
    client,
    db,
    like_post,
    like_users,
    like_headers,
):
    """Verify likes on one post do not affect another post's count."""
    second_location = Location(
        name="Second Like Location",
        latitude=34.0,
        longitude=-118.0,
    )

    second_post = Post(
        user_id=like_users[1].user_id,
        location=second_location,
        caption="Second Like Test Post",
    )

    db.add(second_post)
    db.commit()
    db.refresh(second_post)

    client.post(
        f"/api/posts/{like_post.post_id}/likes",
        headers=like_headers[0],
    )

    response = client.post(
        f"/api/posts/{second_post.post_id}/likes",
        headers=like_headers[0],
    )

    assert response.status_code == 200
    assert response.json()["like_count"] == 1

    first_post_count = (
        db.query(PostLike).filter(PostLike.post_id == like_post.post_id).count()
    )

    second_post_count = (
        db.query(PostLike).filter(PostLike.post_id == second_post.post_id).count()
    )

    assert first_post_count == 1
    assert second_post_count == 1


# =========================================================
# 5. Post Like Count Response Tests
# =========================================================
# Verifies that normal Post API responses expose the current
# like count and that the count reflects Like/Unlike changes.
# =========================================================


@pytest.mark.requirement("SOCIAL-LIKES")
def test_post_response_includes_like_count(
    client,
    like_post,
):
    """Verify a post with no likes reports a like count of zero."""
    response = client.get(f"/api/posts/{like_post.post_id}")

    assert response.status_code == 200
    assert response.json()["like_count"] == 0


@pytest.mark.requirement("SOCIAL-LIKES")
def test_post_response_like_count_updates_after_toggle(
    client,
    like_post,
    like_headers,
):
    """Verify the normal post response reflects Like/Unlike changes."""
    post_url = f"/api/posts/{like_post.post_id}"

    response = client.get(post_url)

    assert response.status_code == 200
    assert response.json()["like_count"] == 0

    client.post(
        f"/api/posts/{like_post.post_id}/likes",
        headers=like_headers[0],
    )

    response = client.get(post_url)

    assert response.status_code == 200
    assert response.json()["like_count"] == 1

    client.post(
        f"/api/posts/{like_post.post_id}/likes",
        headers=like_headers[0],
    )

    response = client.get(post_url)

    assert response.status_code == 200
    assert response.json()["like_count"] == 0


@pytest.mark.requirement("SOCIAL-LIKES")
def test_post_list_includes_like_count(
    client,
    like_post,
    like_headers,
):
    """Verify the post list response includes the current Like count."""
    client.post(
        f"/api/posts/{like_post.post_id}/likes",
        headers=like_headers[0],
    )

    response = client.get("/api/posts")

    assert response.status_code == 200

    matching_posts = [
        post for post in response.json() if post["post_id"] == like_post.post_id
    ]

    assert len(matching_posts) == 1
    assert matching_posts[0]["like_count"] == 1
