from database import SessionLocal
from models import User, Location, Post


def seed_database():
    db = SessionLocal()

    try:
        # -------------------------------------------------
        # Avoid duplicate seed data
        # -------------------------------------------------

        existing_user = db.query(User).filter_by(email="seed@wetravel.local").first()

        if existing_user:
            print("Seed data already exists. Skipping.")
            return

        # -------------------------------------------------
        # Create User
        # -------------------------------------------------

        user = User(
            username="seedtraveler",
            email="seed@wetravel.local",
            hashed_password="development-only-password",
        )

        db.add(user)
        db.flush()

        # -------------------------------------------------
        # Create Location
        # -------------------------------------------------

        location = Location(
            name="Los Angeles, California",
            latitude=34.0522,
            longitude=-118.2437,
        )

        db.add(location)
        db.flush()

        # -------------------------------------------------
        # Create Post
        # -------------------------------------------------

        post = Post(
            user_id=user.user_id,
            location_id=location.location_id,
            caption="Exploring Los Angeles!",
            media_url=None,
        )

        db.add(post)

        # -------------------------------------------------
        # Save everything
        # -------------------------------------------------

        db.commit()

        print("Seed data created successfully.")
        print(f"User ID: {user.user_id}")
        print(f"Location ID: {location.location_id}")
        print(f"Post ID: {post.post_id}")

    except Exception:
        db.rollback()
        raise

    finally:
        db.close()


if __name__ == "__main__":
    seed_database()
