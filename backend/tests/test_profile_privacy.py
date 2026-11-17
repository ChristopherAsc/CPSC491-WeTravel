"""Integration and regression checks for public-feed/private-friends post visibility."""

from models import Location, Post, User
from routes import create_access_token, hash_password


def auth(user):
    return {"Authorization": f"Bearer {create_access_token(user.user_id, user.username)}"}


def test_private_profile_visibility_and_public_feed(client, db):
    owner = User(username="privacy_owner", email="privacy_owner@example.com", hashed_password=hash_password("ExamplePassword123!"))
    friend = User(username="privacy_friend", email="privacy_friend@example.com", hashed_password=hash_password("ExamplePassword123!"))
    outsider = User(username="privacy_stranger", email="privacy_stranger@example.com", hashed_password=hash_password("ExamplePassword123!"))
    public_author = User(username="privacy_public", email="privacy_public@example.com", hashed_password=hash_password("ExamplePassword123!"))
    loc = Location(name="Privacy test landmark", latitude=34.2, longitude=-118.1)
    db.add_all([owner, friend, outsider, public_author, loc]); db.commit()
    private_post = Post(user_id=owner.user_id, location_id=loc.location_id, caption="Friends-only itinerary moment")
    public_post = Post(user_id=public_author.user_id, location_id=loc.location_id, caption="Public travel moment")
    db.add_all([private_post, public_post]); db.commit()

    path = f"/api/users/{owner.user_id}/posts"
    public_feed = "/api/posts"
    single = f"/api/posts/{private_post.post_id}"
    likes = f"/api/posts/{private_post.post_id}/likes"
    location_posts = f"/api/locations/{loc.location_id}/posts"
    assert len(client.get(path).json()) == 1
    changed = client.patch("/api/users/me/privacy", json={"is_private": True}, headers=auth(owner))
    assert changed.status_code == 200 and changed.json()["is_private"] is True
    assert client.get("/api/users/me", headers=auth(owner)).json()["is_private"] is True
    assert "is_private" not in client.get(f"/api/users/{owner.user_id}").json()
    assert client.patch("/api/users/me/privacy", json={"is_private": False}).status_code == 401
    assert client.patch("/api/users/me/privacy", json={"is_private": "not-a-bool"}, headers=auth(owner)).status_code == 422

    # Privacy does not hide the account itself, but it protects its posts in all query paths.
    for viewing_headers in ({}, auth(friend), auth(outsider)):
        assert client.get(path, headers=viewing_headers).status_code == 403
        assert client.get(single, headers=viewing_headers).status_code == 404
    assert len(client.get(path, headers=auth(owner)).json()) == 1
    assert client.get(single, headers=auth(owner)).status_code == 200
    assert client.post(likes, headers=auth(outsider)).status_code == 404
    assert client.post(likes, headers=auth(friend)).status_code == 404

    feed = client.get(public_feed, headers=auth(owner)).json()
    assert [x["post_id"] for x in feed] == [public_post.post_id]
    location_feed = client.get(location_posts, headers=auth(owner)).json()
    assert [x["post_id"] for x in location_feed] == [public_post.post_id]

    request = client.post(f"/api/friends/requests/{owner.user_id}", headers=auth(friend))
    assert request.status_code == 201
    request_id = request.json()["request_id"]
    # Pending is NOT friendship.
    assert client.get(path, headers=auth(friend)).status_code == 403
    assert client.patch(f"/api/friends/requests/{request_id}?decision=accept", headers=auth(outsider)).status_code == 403
    assert client.patch(f"/api/friends/requests/{request_id}?decision=accept", headers=auth(owner)).status_code == 200

    # The accepted friend (but not outsider) can see private posts and interact with them.
    assert len(client.get(path, headers=auth(friend)).json()) == 1
    assert client.get(single, headers=auth(friend)).status_code == 200
    assert client.post(likes, headers=auth(friend)).status_code == 200
    assert client.get(path, headers=auth(outsider)).status_code == 403
    assert client.get(single, headers=auth(outsider)).status_code == 404
    # Even accepted friends don't make these posts public in feed and location views.
    assert [x["post_id"] for x in client.get(public_feed, headers=auth(friend)).json()] == [public_post.post_id]
    assert [x["post_id"] for x in client.get(location_posts, headers=auth(friend)).json()] == [public_post.post_id]

    assert client.delete(f"/api/friends/{friend.user_id}", headers=auth(owner)).status_code == 200
    assert client.get(path, headers=auth(friend)).status_code == 403
    assert client.get(single, headers=auth(friend)).status_code == 404
    # Switching back to public immediately restores discovery in the feed.
    assert client.patch("/api/users/me/privacy", json={"is_private": False}, headers=auth(owner)).status_code == 200
    assert len(client.get(path).json()) == 1
    assert {x["post_id"] for x in client.get(public_feed).json()} == {public_post.post_id, private_post.post_id}
