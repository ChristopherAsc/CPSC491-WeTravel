"""Seed a development database with sample travelers, posts, likes and comments.

Run from the project root once the tables exist (alembic upgrade head):

    uv run --env-file .env.local python backend/seed_db.py

The script is safe to run repeatedly: anything that already exists is left
alone, so it never duplicates data or overwrites an existing account.

It also creates a "demo_traveler" account you can sign in with. Set the
DEMO_USER_PASSWORD environment variable to choose its password; otherwise a
random one is generated and printed once. No password is stored in the repo.
"""

import os
import secrets
from dataclasses import dataclass
from datetime import datetime, timedelta, timezone

from database import SessionLocal
from models import Comment, Location, Post, PostLike, User
from routes import hash_password
from sqlalchemy import select
from sqlalchemy.orm import Session

DEMO_USERNAME = "demo_traveler"
DEMO_EMAIL = "demo@wetravel.local"

# Other travelers who own the sample posts. They get a random, unknown password
# so they exist for the feed but nobody can sign in as them.
SAMPLE_TRAVELERS = {
    "seedtraveler": "seed@wetravel.local",
    "maya_explores": "maya@wetravel.local",
    "jordan_roams": "jordan@wetravel.local",
    "sam_wanders": "sam@wetravel.local",
}

# Sample posts, oldest first. The demo account has not liked or commented on
# any of them, so those interactions can be shown live. There is deliberately
# no San Diego post: that one is created during the demonstration.
SAMPLE_POSTS = [
    {
        "username": "seedtraveler",
        "caption": "Exploring Los Angeles!",
        "location": ("Los Angeles, California", 34.0522, -118.2437),
        "days_ago": 6,
        "liked_by": ["maya_explores", "jordan_roams"],
        "comments": [
            ("maya_explores", "Great pick! The sunsets there are unreal."),
            ("sam_wanders", "Adding this to my list."),
        ],
    },
    {
        "username": "maya_explores",
        "caption": "Sunrise at Yosemite Valley. Worth every minute of the early alarm.",
        "location": ("Yosemite National Park, California", 37.8651, -119.5383),
        "days_ago": 4,
        "liked_by": ["sam_wanders"],
        "comments": [("jordan_roams", "Those views are incredible!")],
    },
    {
        "username": "jordan_roams",
        "caption": "First time at the Grand Canyon. It is even bigger than the photos.",
        "location": ("Grand Canyon National Park, Arizona", 36.1069, -112.1129),
        "days_ago": 2,
        "liked_by": [],
        "comments": [],
    },
    {
        "username": "sam_wanders",
        "caption": "Coffee, ferries and rain in Seattle. Exactly as advertised.",
        "location": ("Seattle, Washington", 47.6062, -122.3321),
        "days_ago": 1,
        "liked_by": ["maya_explores"],
        "comments": [],
    },
]


@dataclass
class SeedSummary:
    users_created: int = 0
    posts_created: int = 0
    likes_created: int = 0
    comments_created: int = 0
    demo_user_created: bool = False


def _get_or_create_user(
    db: Session, username: str, email: str, password: str, summary: SeedSummary
) -> User:
    user = db.scalar(select(User).where(User.username == username))

    if user is None:
        user = User(
            username=username,
            email=email,
            hashed_password=hash_password(password),
        )
        db.add(user)
        db.flush()
        summary.users_created += 1

    return user


def seed_demo_data(db: Session, demo_password: str) -> SeedSummary:
    """Add any missing sample data. Flushes but does not commit."""
    summary = SeedSummary()
    now = datetime.now(timezone.utc)

    users = {
        username: _get_or_create_user(
            db, username, email, secrets.token_urlsafe(32), summary
        )
        for username, email in SAMPLE_TRAVELERS.items()
    }

    demo_users_before = summary.users_created
    _get_or_create_user(db, DEMO_USERNAME, DEMO_EMAIL, demo_password, summary)
    summary.demo_user_created = summary.users_created > demo_users_before

    for sample in SAMPLE_POSTS:
        author = users[sample["username"]]
        post = db.scalar(
            select(Post).where(
                Post.user_id == author.user_id, Post.caption == sample["caption"]
            )
        )

        if post is None:
            name, latitude, longitude = sample["location"]
            post = Post(
                user_id=author.user_id,
                caption=sample["caption"],
                media_url=None,
                location=Location(name=name, latitude=latitude, longitude=longitude),
                created_at=now - timedelta(days=sample["days_ago"]),
            )
            db.add(post)
            db.flush()
            summary.posts_created += 1

        for username in sample["liked_by"]:
            liker = users[username]
            if db.get(PostLike, (liker.user_id, post.post_id)) is None:
                db.add(PostLike(user_id=liker.user_id, post_id=post.post_id))
                summary.likes_created += 1

        for hours_later, (username, content) in enumerate(sample["comments"], start=1):
            commenter = users[username]
            already_there = db.scalar(
                select(Comment.comment_id).where(
                    Comment.post_id == post.post_id,
                    Comment.user_id == commenter.user_id,
                    Comment.content == content,
                )
            )
            if already_there is None:
                db.add(
                    Comment(
                        post_id=post.post_id,
                        user_id=commenter.user_id,
                        content=content,
                        created_at=post.created_at + timedelta(hours=hours_later),
                    )
                )
                summary.comments_created += 1

    db.flush()

    return summary


def seed_database():
    demo_password = os.environ.get("DEMO_USER_PASSWORD")
    password_was_generated = not demo_password

    if password_was_generated:
        demo_password = secrets.token_urlsafe(12)

    db = SessionLocal()

    try:
        summary = seed_demo_data(db, demo_password)
        db.commit()

    except Exception:
        db.rollback()
        raise

    finally:
        db.close()

    print(
        f"Seed complete: {summary.users_created} users, "
        f"{summary.posts_created} posts, {summary.likes_created} likes, "
        f"{summary.comments_created} comments added."
    )

    if summary.demo_user_created:
        print(f"Demo account created. Username: {DEMO_USERNAME}")
        if password_was_generated:
            print(f"Generated password (shown once, save it now): {demo_password}")
        else:
            print("Password: the value of DEMO_USER_PASSWORD.")
    else:
        print(
            f"Demo account '{DEMO_USERNAME}' already exists; its password is unchanged."
        )


if __name__ == "__main__":
    seed_database()
