"""Feed responses name the traveler who wrote each post."""

import pytest
from models import Location, Post, User
from routes import hash_password


@pytest.fixture
def authored_post(db):
    user = User(
        username="wanderer_author",
        email="wanderer_author@example.com",
        hashed_password=hash_password("ExamplePassword123!"),
    )
    post = Post(
        user=user,
        location=Location(name="Author Test Location", latitude=32.7, longitude=-117.2),
        caption="Post with an author",
    )
    db.add_all([user, post])
    db.commit()
    db.refresh(post)
    return post


@pytest.mark.requirement("FEED-02")
def test_feed_posts_include_author_username(client, authored_post):
    """The feed lists each post with its author's username."""
    response = client.get("/api/posts")

    assert response.status_code == 200
    matching = [p for p in response.json() if p["post_id"] == authored_post.post_id]
    assert len(matching) == 1
    assert matching[0]["username"] == "wanderer_author"
    assert matching[0]["user_id"] == authored_post.user_id


@pytest.mark.requirement("FEED-02")
def test_post_detail_includes_author_username(client, authored_post):
    """A single post response also carries the author's username."""
    response = client.get(f"/api/posts/{authored_post.post_id}")

    assert response.status_code == 200
    assert response.json()["username"] == "wanderer_author"
