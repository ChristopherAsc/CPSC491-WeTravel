"""Post Comment API tests: listing, creating, validation, and privacy."""

import pytest
from models import Comment, FriendRequest, Location, Post, User
from routes import create_access_token, hash_password

# =========================================================
# 1. Test Fixtures
# =========================================================
# Two travelers and one post written by the first traveler.
# =========================================================


@pytest.fixture
def comment_users(db):
    users = []

    for suffix in ("author", "visitor"):
        user = User(
            username=f"comment_{suffix}",
            email=f"comment_{suffix}@example.com",
            hashed_password=hash_password("ExamplePassword123!"),
        )
        db.add(user)
        users.append(user)

    db.commit()

    for user in users:
        db.refresh(user)

    return users


@pytest.fixture
def comment_headers(comment_users):
    return [
        {"Authorization": f"Bearer {create_access_token(user.user_id, user.username)}"}
        for user in comment_users
    ]


@pytest.fixture
def comment_post(db, comment_users):
    post = Post(
        user_id=comment_users[0].user_id,
        location=Location(
            name="Comment Test Location", latitude=32.7, longitude=-117.2
        ),
        caption="Post Comment Test",
    )
    db.add(post)
    db.commit()
    db.refresh(post)

    return post


def comments_url(post):
    return f"/api/posts/{post.post_id}/comments"


# =========================================================
# 2. Creating Comments
# =========================================================


@pytest.mark.requirement("SOCIAL-COMMENTS")
def test_user_can_comment_on_post(
    client, db, comment_post, comment_users, comment_headers
):
    """Verify a signed-in user can add a comment to a post."""
    response = client.post(
        comments_url(comment_post),
        json={"content": "Looks like an amazing trip!"},
        headers=comment_headers[1],
    )

    assert response.status_code == 201

    body = response.json()
    assert body["content"] == "Looks like an amazing trip!"
    assert body["post_id"] == comment_post.post_id
    assert body["user_id"] == comment_users[1].user_id
    assert body["username"] == "comment_visitor"
    assert body["created_at"]

    saved = db.get(Comment, body["comment_id"])
    assert saved is not None
    assert saved.content == "Looks like an amazing trip!"


@pytest.mark.requirement("SOCIAL-COMMENTS")
def test_comment_text_is_trimmed(client, comment_post, comment_headers):
    """Verify surrounding whitespace is removed before a comment is stored."""
    response = client.post(
        comments_url(comment_post),
        json={"content": "   Great photos!   "},
        headers=comment_headers[1],
    )

    assert response.status_code == 201
    assert response.json()["content"] == "Great photos!"


@pytest.mark.requirement("SOCIAL-COMMENTS")
def test_commenting_requires_authentication(client, db, comment_post):
    """Verify anonymous visitors cannot add comments."""
    response = client.post(comments_url(comment_post), json={"content": "Hello"})

    assert response.status_code == 401
    assert db.query(Comment).count() == 0


@pytest.mark.requirement("SOCIAL-COMMENTS")
@pytest.mark.parametrize(
    "content",
    ["", "   ", "x" * 501],
    ids=["empty", "whitespace-only", "too-long"],
)
def test_invalid_comment_text_is_rejected(
    client, db, comment_post, comment_headers, content
):
    """Verify blank and over-long comments are rejected and not stored."""
    response = client.post(
        comments_url(comment_post),
        json={"content": content},
        headers=comment_headers[1],
    )

    assert response.status_code == 422
    assert db.query(Comment).count() == 0


@pytest.mark.requirement("SOCIAL-COMMENTS")
def test_comment_at_the_length_limit_is_accepted(client, comment_post, comment_headers):
    """Verify a comment of exactly 500 characters is accepted."""
    response = client.post(
        comments_url(comment_post),
        json={"content": "x" * 500},
        headers=comment_headers[1],
    )

    assert response.status_code == 201


@pytest.mark.requirement("SOCIAL-COMMENTS")
def test_comment_on_missing_post_returns_404(client, comment_headers):
    """Verify commenting on a post that does not exist returns HTTP 404."""
    response = client.post(
        "/api/posts/999999999/comments",
        json={"content": "Hello"},
        headers=comment_headers[1],
    )

    assert response.status_code == 404


# =========================================================
# 3. Listing Comments
# =========================================================


@pytest.mark.requirement("SOCIAL-COMMENTS")
def test_comments_are_listed_oldest_first_without_login(
    client, comment_post, comment_headers
):
    """Verify anyone can read a post's comments, in the order they were made."""
    for index, headers in enumerate((comment_headers[1], comment_headers[0])):
        client.post(
            comments_url(comment_post),
            json={"content": f"Comment {index + 1}"},
            headers=headers,
        )

    response = client.get(comments_url(comment_post))

    assert response.status_code == 200
    assert [item["content"] for item in response.json()] == [
        "Comment 1",
        "Comment 2",
    ]
    assert [item["username"] for item in response.json()] == [
        "comment_visitor",
        "comment_author",
    ]


@pytest.mark.requirement("SOCIAL-COMMENTS")
def test_post_without_comments_returns_empty_list(client, comment_post):
    """Verify a post with no comments returns an empty list."""
    response = client.get(comments_url(comment_post))

    assert response.status_code == 200
    assert response.json() == []


@pytest.mark.requirement("SOCIAL-COMMENTS")
def test_comments_belong_to_their_own_post(
    client, db, comment_post, comment_users, comment_headers
):
    """Verify a comment only appears under the post it was written on."""
    other_post = Post(
        user_id=comment_users[0].user_id,
        location=Location(name="Other Location", latitude=34.0, longitude=-118.0),
        caption="A different post",
    )
    db.add(other_post)
    db.commit()
    db.refresh(other_post)

    client.post(
        comments_url(comment_post),
        json={"content": "Only on the first post"},
        headers=comment_headers[1],
    )

    assert len(client.get(comments_url(comment_post)).json()) == 1
    assert client.get(comments_url(other_post)).json() == []


@pytest.mark.requirement("SOCIAL-COMMENTS")
def test_listing_comments_on_missing_post_returns_404(client):
    """Verify listing comments for a missing post returns HTTP 404."""
    assert client.get("/api/posts/999999999/comments").status_code == 404


@pytest.mark.requirement("SOCIAL-COMMENTS")
def test_comment_list_honors_limit(client, comment_post, comment_headers):
    """Verify the limit query parameter caps how many comments are returned."""
    for index in range(3):
        client.post(
            comments_url(comment_post),
            json={"content": f"Comment {index}"},
            headers=comment_headers[1],
        )

    response = client.get(comments_url(comment_post), params={"limit": 2})

    assert response.status_code == 200
    assert [item["content"] for item in response.json()] == ["Comment 0", "Comment 1"]
    assert (
        client.get(comments_url(comment_post), params={"limit": 0}).status_code == 422
    )


# =========================================================
# 4. Comment Counts on Posts
# =========================================================


@pytest.mark.requirement("SOCIAL-COMMENTS")
def test_post_responses_include_comment_count(client, comment_post, comment_headers):
    """Verify the feed and post detail report how many comments a post has."""
    post_url = f"/api/posts/{comment_post.post_id}"

    assert client.get(post_url).json()["comment_count"] == 0

    for text in ("First", "Second"):
        client.post(
            comments_url(comment_post),
            json={"content": text},
            headers=comment_headers[1],
        )

    feed_entry = next(
        item
        for item in client.get("/api/posts").json()
        if item["post_id"] == comment_post.post_id
    )

    assert client.get(post_url).json()["comment_count"] == 2
    assert feed_entry["comment_count"] == 2


@pytest.mark.requirement("SOCIAL-COMMENTS")
def test_deleting_a_post_removes_its_comments(
    client, db, comment_post, comment_headers
):
    """Verify comments are deleted together with the post they belong to."""
    client.post(
        comments_url(comment_post),
        json={"content": "Goodbye"},
        headers=comment_headers[1],
    )

    response = client.delete(
        f"/api/posts/{comment_post.post_id}", headers=comment_headers[0]
    )

    assert response.status_code == 204
    assert db.query(Comment).count() == 0


# =========================================================
# 5. Private Profiles
# =========================================================
# Comments follow the same visibility rules as the post itself.
# =========================================================


@pytest.fixture
def private_post(db, comment_users, comment_post):
    comment_users[0].is_private = True
    db.commit()

    return comment_post


@pytest.mark.requirement("SOCIAL-COMMENTS")
def test_private_post_comments_are_hidden_from_strangers(
    client, private_post, comment_headers
):
    """Verify strangers cannot read or add comments on a private user's post."""
    assert client.get(comments_url(private_post)).status_code == 404
    assert (
        client.get(comments_url(private_post), headers=comment_headers[1]).status_code
        == 404
    )
    assert (
        client.post(
            comments_url(private_post),
            json={"content": "Let me in"},
            headers=comment_headers[1],
        ).status_code
        == 404
    )


@pytest.mark.requirement("SOCIAL-COMMENTS")
def test_private_post_comments_are_available_to_the_owner(
    client, private_post, comment_headers
):
    """Verify the owner of a private post can still comment on it."""
    response = client.post(
        comments_url(private_post),
        json={"content": "Note to self"},
        headers=comment_headers[0],
    )

    assert response.status_code == 201
    assert client.get(comments_url(private_post), headers=comment_headers[0]).json()


@pytest.mark.requirement("SOCIAL-COMMENTS")
def test_private_post_comments_are_available_to_accepted_friends(
    client, db, private_post, comment_users, comment_headers
):
    """Verify an accepted friend can read and add comments on a private post."""
    db.add(
        FriendRequest(
            sender_id=comment_users[1].user_id,
            recipient_id=comment_users[0].user_id,
            status="accepted",
        )
    )
    db.commit()

    response = client.post(
        comments_url(private_post),
        json={"content": "Hi from a friend"},
        headers=comment_headers[1],
    )

    assert response.status_code == 201
    assert (
        client.get(comments_url(private_post), headers=comment_headers[1]).status_code
        == 200
    )
