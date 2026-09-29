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
