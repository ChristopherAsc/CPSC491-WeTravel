"""Demo seed script tests: sample feed data and a usable demo account."""

import pytest
from models import Comment, Post, PostLike, User
from seed_db import DEMO_USERNAME, SAMPLE_POSTS, seed_demo_data

DEMO_PASSWORD = "Example-Demo-Password-123"


@pytest.fixture
def seeded(db):
    summary = seed_demo_data(db, DEMO_PASSWORD)
    db.commit()

    return summary


def login_headers(client, username=DEMO_USERNAME, password=DEMO_PASSWORD):
    response = client.post(
        "/api/auth/login", json={"username": username, "password": password}
    )

    assert response.status_code == 200
    return {"Authorization": f"Bearer {response.json()['access_token']}"}


@pytest.mark.requirement("FEED-01")
def test_seed_creates_at_least_three_located_posts_from_different_travelers(
    client, seeded
):
    """Verify the feed has several location-tagged posts from other travelers."""
    posts = client.get("/api/posts").json()

    assert len(posts) >= 3
    assert len({post["user_id"] for post in posts}) >= 3
    assert all(post["location"]["name"] for post in posts)
    assert all(post["username"] != DEMO_USERNAME for post in posts)


@pytest.mark.requirement("FEED-01")
def test_seeded_posts_are_ordered_newest_first(client, seeded):
    """Verify the seeded posts appear newest first, so a new post lands on top."""
    created = [post["created_at"] for post in client.get("/api/posts").json()]

    assert created == sorted(created, reverse=True)


@pytest.mark.requirement("SOCIAL-LIKES")
def test_seed_includes_posts_with_likes_and_comments(client, seeded):
    """Verify the sample data has likes and comments to display."""
    posts = client.get("/api/posts").json()

    assert any(post["like_count"] > 0 for post in posts)
    assert any(post["comment_count"] > 0 for post in posts)

    commented = next(post for post in posts if post["comment_count"] > 0)
    comments = client.get(f"/api/posts/{commented['post_id']}/comments").json()

    assert len(comments) == commented["comment_count"]
    assert all(comment["username"] != DEMO_USERNAME for comment in comments)


@pytest.mark.requirement("SOCIAL-LIKES")
def test_demo_account_has_not_liked_or_commented_yet(db, seeded):
    """Verify the demo account starts clean so it can like and comment live."""
    demo = db.query(User).filter_by(username=DEMO_USERNAME).one()

    assert db.query(PostLike).filter_by(user_id=demo.user_id).count() == 0
    assert db.query(Comment).filter_by(user_id=demo.user_id).count() == 0
    assert db.query(Post).filter_by(user_id=demo.user_id).count() == 0


@pytest.mark.requirement("AUTH-02")
def test_demo_account_can_log_in_and_sees_nothing_pre_liked(client, seeded):
    """Verify the demo account can sign in, and the feed shows no pre-liked posts."""
    headers = login_headers(client)

    posts = client.get("/api/posts", headers=headers).json()

    assert posts
    assert not any(post["liked_by_me"] for post in posts)


@pytest.mark.requirement("AUTH-02")
def test_demo_password_is_hashed_and_wrong_password_is_rejected(client, db, seeded):
    """Verify the password is stored hashed and a wrong password cannot log in."""
    demo = db.query(User).filter_by(username=DEMO_USERNAME).one()

    assert DEMO_PASSWORD not in demo.hashed_password
    assert (
        client.post(
            "/api/auth/login",
            json={"username": DEMO_USERNAME, "password": "not-the-password"},
        ).status_code
        == 401
    )


@pytest.mark.requirement("AUTH-02")
def test_sample_travelers_cannot_be_logged_into(client, seeded):
    """Verify sample travelers have unknown passwords and cannot sign in."""
    for post in SAMPLE_POSTS:
        response = client.post(
            "/api/auth/login",
            json={"username": post["username"], "password": DEMO_PASSWORD},
        )

        assert response.status_code == 401


def test_demo_user_can_like_and_comment_on_a_seeded_post(client, seeded):
    """Verify the full demo flow works against the seeded data."""
    headers = login_headers(client)
    post = client.get("/api/posts").json()[0]

    like = client.post(f"/api/posts/{post['post_id']}/likes", headers=headers)
    comment = client.post(
        f"/api/posts/{post['post_id']}/comments",
        json={"content": "Looks like an amazing trip!"},
        headers=headers,
    )

    assert like.json()["like_count"] == post["like_count"] + 1
    assert comment.status_code == 201

    refreshed = client.get(f"/api/posts/{post['post_id']}", headers=headers).json()

    assert refreshed["liked_by_me"] is True
    assert refreshed["comment_count"] == post["comment_count"] + 1


def test_seed_does_not_create_the_san_diego_demo_post(client, seeded):
    """Verify the post created live during the demo is not already in the feed."""
    captions = " ".join(post["caption"] for post in client.get("/api/posts").json())
    locations = " ".join(
        post["location"]["name"] for post in client.get("/api/posts").json()
    )

    assert "San Diego" not in captions + locations


def test_seed_can_be_run_again_without_duplicating_anything(db, seeded):
    """Verify a second run adds nothing."""
    counts = (
        db.query(User).count(),
        db.query(Post).count(),
        db.query(PostLike).count(),
        db.query(Comment).count(),
    )

    second = seed_demo_data(db, DEMO_PASSWORD)
    db.commit()

    assert second.users_created == 0
    assert second.posts_created == 0
    assert second.likes_created == 0
    assert second.comments_created == 0
    assert second.demo_user_created is False
    assert counts == (
        db.query(User).count(),
        db.query(Post).count(),
        db.query(PostLike).count(),
        db.query(Comment).count(),
    )


def test_first_run_reports_what_it_created(seeded):
    """Verify the summary matches the sample data definition."""
    assert seeded.demo_user_created is True
    assert seeded.posts_created == len(SAMPLE_POSTS)
    assert seeded.likes_created == sum(len(p["liked_by"]) for p in SAMPLE_POSTS)
    assert seeded.comments_created == sum(len(p["comments"]) for p in SAMPLE_POSTS)


def test_rerunning_with_a_new_password_does_not_change_the_demo_password(
    client, db, seeded
):
    """Verify an existing demo account keeps its original password."""
    seed_demo_data(db, "A-Different-Password-456")
    db.commit()

    assert (
        client.post(
            "/api/auth/login",
            json={"username": DEMO_USERNAME, "password": DEMO_PASSWORD},
        ).status_code
        == 200
    )


def test_existing_seed_traveler_is_reused_not_duplicated(db):
    """Verify a database seeded by the old script keeps its original account."""
    old_hash = "development-only-password"
    db.add(
        User(
            username="seedtraveler",
            email="seed@wetravel.local",
            hashed_password=old_hash,
        )
    )
    db.commit()

    seed_demo_data(db, DEMO_PASSWORD)
    db.commit()

    travelers = db.query(User).filter_by(username="seedtraveler").all()

    assert len(travelers) == 1
    assert travelers[0].hashed_password == old_hash
    assert db.query(Post).filter_by(user_id=travelers[0].user_id).count() >= 1
