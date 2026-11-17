import os
from datetime import datetime, timedelta, timezone

import httpx
import jwt
from database import get_db
from fastapi import APIRouter, Depends, HTTPException, Query, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from models import (
    Comment,
    FriendRequest,
    Itinerary,
    Location,
    Post,
    PostLike,
    SafetyReport,
    User,
)
from pwdlib import PasswordHash
from pydantic_models import (
    AccountDeleteConfirmation,
    AccountPasswordUpdate,
    AccountUsernameUpdate,
    CommentCreate,
    CommentResponse,
    FriendActionResponse,
    FriendRequestResponse,
    ItineraryCreate,
    ItineraryResponse,
    ItineraryUpdate,
    LocationResponse,
    LoginRequest,
    PostCreate,
    PostLikeResponse,
    PostResponse,
    ProfilePrivacyResponse,
    ProfilePrivacyUpdate,
    PublicSafetyReportResponse,
    PublicUserResponse,
    SafetyReportCreate,
    SafetyReportResponse,
    TokenResponse,
    UserRegistration,
    UserResponse,
)
from security_events import record_failed_login_attempt
from sqlalchemy import func, or_, select, text
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session, joinedload

# ---------------------------------------------------------
# Router Setup
# ---------------------------------------------------------

router = APIRouter()

# ---------------------------------------------------------
# Authentication Configuration
# ---------------------------------------------------------

SECRET_KEY = os.environ["JWT_SECRET"]
ALGORITHM = os.environ.get("JWT_ALGORITHM", "HS256")
ACCESS_TOKEN_EXPIRE_MINUTES = int(os.environ.get("ACCESS_TOKEN_EXPIRE_MINUTES", 60))

password_hash = PasswordHash.recommended()

# HTTP Bearer allows JWT authentication directly in Swagger.
bearer_scheme = HTTPBearer(auto_error=False)


def hash_password(plain_password: str) -> str:
    return password_hash.hash(plain_password)


def verify_password(plain_password: str, hashed_password: str) -> bool:
    return password_hash.verify(plain_password, hashed_password)


def create_access_token(user_id: int, username: str) -> str:
    expiration = datetime.now(timezone.utc) + timedelta(
        minutes=ACCESS_TOKEN_EXPIRE_MINUTES
    )

    payload = {
        "sub": str(user_id),
        "username": username,
        "exp": expiration,
    }

    return jwt.encode(payload, SECRET_KEY, algorithm=ALGORITHM)


def get_current_user(
    credentials: HTTPAuthorizationCredentials | None = Depends(bearer_scheme),
    db: Session = Depends(get_db),
):
    """Retrieve the authenticated user from a JWT token."""

    if credentials is None or credentials.scheme.lower() != "bearer":
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Authentication required",
            headers={"WWW-Authenticate": "Bearer"},
        )

    token = credentials.credentials

    try:
        payload = jwt.decode(
            token,
            SECRET_KEY,
            algorithms=[ALGORITHM],
            options={"require": ["exp", "sub"]},
        )

        user_id = payload.get("sub")

        if user_id is None:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid authentication token",
            )

        user_id = int(user_id)

    except jwt.InvalidTokenError, ValueError, TypeError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired token",
            headers={"WWW-Authenticate": "Bearer"},
        ) from None

    user = db.get(User, user_id)

    if user is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="User no longer exists",
        )

    return user


def get_optional_user(
    credentials: HTTPAuthorizationCredentials | None = Depends(bearer_scheme),
    db: Session = Depends(get_db),
) -> User | None:
    """Use an authenticated session when available; public visitors remain anonymous."""
    if credentials is None:
        return None
    try:
        return get_current_user(credentials=credentials, db=db)
    except HTTPException:
        return None


def can_view_posts(owner: User, viewer: User | None, db: Session) -> bool:
    """Allow public posts, or private posts for owners and accepted friends."""
    if not owner.is_private:
        return True
    if viewer is None:
        return False
    if viewer.user_id == owner.user_id:
        return True
    return (
        db.scalar(
            select(FriendRequest.request_id).where(
                FriendRequest.status == "accepted",
                or_(
                    (FriendRequest.sender_id == viewer.user_id)
                    & (FriendRequest.recipient_id == owner.user_id),
                    (FriendRequest.sender_id == owner.user_id)
                    & (FriendRequest.recipient_id == viewer.user_id),
                ),
            )
        )
        is not None
    )


def mark_liked_by_viewer(posts: list[Post], viewer: User | None, db: Session):
    """Set `liked_by_me` on each post for the viewer before it is serialized.

    Anonymous visitors always get False. Only the viewer's own like state is
    exposed, never who else liked a post.
    """
    liked_post_ids: set[int] = set()

    if viewer is not None and posts:
        liked_post_ids = set(
            db.scalars(
                select(PostLike.post_id).where(
                    PostLike.user_id == viewer.user_id,
                    PostLike.post_id.in_([post.post_id for post in posts]),
                )
            )
        )

    for post in posts:
        post.liked_by_me = post.post_id in liked_post_ids

    return posts


# =========================================================
# Authentication Routes
# =========================================================


@router.post(
    "/auth/register",
    status_code=status.HTTP_201_CREATED,
)
def register(
    new_user_data: UserRegistration,
    db: Session = Depends(get_db),
):
    """Register a new user."""

    existing_email = db.scalar(select(User).where(User.email == new_user_data.email))

    if existing_email is not None:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Email is already registered",
        )

    existing_username = db.scalar(
        select(User).where(User.username == new_user_data.username)
    )

    if existing_username is not None:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Username is already taken",
        )

    new_user = User(
        email=new_user_data.email,
        username=new_user_data.username,
        hashed_password=hash_password(new_user_data.password),
    )

    try:
        db.add(new_user)
        db.commit()
        db.refresh(new_user)

    except Exception:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Unable to create user",
        ) from None

    return {
        "message": "User registered successfully",
        "user_id": new_user.user_id,
    }


@router.post(
    "/auth/login",
    response_model=TokenResponse,
)
def login(
    login_credentials: LoginRequest,
    db: Session = Depends(get_db),
):
    """Authenticate a user and return a JWT token."""

    statement = select(User).where(User.username == login_credentials.username)

    user = db.scalar(statement)

    if user is None or not verify_password(
        login_credentials.password,
        user.hashed_password,
    ):
        record_failed_login_attempt(login_credentials.username)
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid username or password",
        )

    access_token = create_access_token(
        user_id=user.user_id,
        username=user.username,
    )

    return {
        "access_token": access_token,
        "token_type": "bearer",
    }


@router.get(
    "/auth/me",
    response_model=UserResponse,
)
def get_authenticated_user(
    current_user: User = Depends(get_current_user),
):
    return current_user


# =========================================================
# User / Profile Routes
# =========================================================


@router.get(
    "/users/me",
    response_model=UserResponse,
)
def get_my_profile(
    current_user: User = Depends(get_current_user),
):
    return current_user


# =========================================================
# Feature #4: Account settings, discovery, and friendships
# =========================================================


@router.patch("/users/me/privacy", response_model=ProfilePrivacyResponse)
def update_profile_privacy(
    changes: ProfilePrivacyUpdate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Only an authenticated account owner may change their privacy setting."""
    current_user.is_private = changes.is_private
    db.commit()
    db.refresh(current_user)
    return current_user


@router.patch("/users/me", response_model=PublicUserResponse)
def update_my_username(
    changes: AccountUsernameUpdate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    proposed = changes.username.strip()
    if not proposed or len(proposed) < 3:
        raise HTTPException(
            status_code=422, detail="Username must contain 3 or more characters"
        )
    duplicate = db.scalar(
        select(User).where(
            User.username == proposed, User.user_id != current_user.user_id
        )
    )
    if duplicate:
        raise HTTPException(status_code=409, detail="Username is already taken")
    current_user.username = proposed
    try:
        db.commit()
        db.refresh(current_user)
    except IntegrityError:
        db.rollback()
        raise HTTPException(
            status_code=409, detail="Username is already taken"
        ) from None
    return current_user


@router.put("/users/me/password", response_model=FriendActionResponse)
def change_my_password(
    changes: AccountPasswordUpdate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    if not verify_password(changes.current_password, current_user.hashed_password):
        raise HTTPException(status_code=403, detail="Current password is incorrect")
    if changes.current_password == changes.new_password:
        raise HTTPException(status_code=422, detail="New password must be different")
    current_user.hashed_password = hash_password(changes.new_password)
    db.commit()
    return {"message": "Password updated"}


@router.delete("/users/me", response_model=FriendActionResponse)
def delete_my_account(
    confirmation: AccountDeleteConfirmation,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    if not verify_password(confirmation.password, current_user.hashed_password):
        raise HTTPException(status_code=403, detail="Password confirmation failed")
    db.delete(current_user)
    db.commit()
    return {"message": "Account deleted"}


@router.get("/users/search", response_model=list[PublicUserResponse])
def search_travelers(
    username: str = Query(min_length=1, max_length=50),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    term = username.strip()
    if not term:
        return []
    # Escape SQL LIKE wildcards so search input is interpreted literally.
    escaped = term.replace("\\", "\\\\").replace("%", "\\%").replace("_", "\\_")
    return db.scalars(
        select(User)
        .where(User.user_id != current_user.user_id)
        .where(User.username.ilike(f"%{escaped}%", escape="\\"))
        .order_by(User.username)
        .limit(20)
    ).all()


def _friend_request(db: Session, first: int, second: int):
    return db.scalar(
        select(FriendRequest).where(
            or_(
                (FriendRequest.sender_id == first)
                & (FriendRequest.recipient_id == second),
                (FriendRequest.sender_id == second)
                & (FriendRequest.recipient_id == first),
            )
        )
    )


@router.post(
    "/friends/requests/{recipient_id}",
    response_model=FriendRequestResponse,
    status_code=201,
)
def send_friend_request(
    recipient_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    if recipient_id == current_user.user_id:
        raise HTTPException(status_code=400, detail="Cannot friend yourself")
    if db.get(User, recipient_id) is None:
        raise HTTPException(status_code=404, detail="Traveler not found")
    if _friend_request(db, current_user.user_id, recipient_id):
        raise HTTPException(
            status_code=409, detail="A friendship or request already exists"
        )
    item = FriendRequest(
        sender_id=current_user.user_id, recipient_id=recipient_id, status="pending"
    )
    db.add(item)
    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        raise HTTPException(
            status_code=409, detail="A friendship or request already exists"
        ) from None
    return db.scalar(
        select(FriendRequest)
        .options(joinedload(FriendRequest.sender), joinedload(FriendRequest.recipient))
        .where(FriendRequest.request_id == item.request_id)
    )


@router.get("/friends/requests", response_model=list[FriendRequestResponse])
def list_friend_requests(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    return db.scalars(
        select(FriendRequest)
        .options(joinedload(FriendRequest.sender), joinedload(FriendRequest.recipient))
        .where(
            or_(
                FriendRequest.sender_id == current_user.user_id,
                FriendRequest.recipient_id == current_user.user_id,
            )
        )
        .order_by(FriendRequest.request_id.desc())
    ).all()


@router.patch("/friends/requests/{request_id}", response_model=FriendRequestResponse)
def resolve_friend_request(
    request_id: int,
    decision: str = Query(pattern="^(accept|decline)$"),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    item = db.get(FriendRequest, request_id)
    if item is None:
        raise HTTPException(status_code=404, detail="Friend request not found")
    if item.recipient_id != current_user.user_id:
        raise HTTPException(status_code=403, detail="Only the recipient can respond")
    if item.status != "pending":
        raise HTTPException(status_code=409, detail="Request is no longer pending")
    item.status = "accepted" if decision == "accept" else "declined"
    db.commit()
    return db.scalar(
        select(FriendRequest)
        .options(joinedload(FriendRequest.sender), joinedload(FriendRequest.recipient))
        .where(FriendRequest.request_id == request_id)
    )


@router.get("/friends", response_model=list[PublicUserResponse])
def list_friends(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    accepted = db.scalars(
        select(FriendRequest)
        .options(joinedload(FriendRequest.sender), joinedload(FriendRequest.recipient))
        .where(FriendRequest.status == "accepted")
        .where(
            or_(
                FriendRequest.sender_id == current_user.user_id,
                FriendRequest.recipient_id == current_user.user_id,
            )
        )
    ).all()
    return [
        req.recipient if req.sender_id == current_user.user_id else req.sender
        for req in accepted
    ]


@router.delete("/friends/{friend_id}", response_model=FriendActionResponse)
def remove_friend(
    friend_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    item = _friend_request(db, current_user.user_id, friend_id)
    if item is None or item.status != "accepted":
        raise HTTPException(status_code=404, detail="Friendship not found")
    db.delete(item)
    db.commit()
    return {"message": "Friend removed"}


@router.get(
    "/users/{user_id}",
    response_model=PublicUserResponse,
)
def get_user_profile(
    user_id: int,
    db: Session = Depends(get_db),
):
    user = db.get(User, user_id)

    if user is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found",
        )

    return user


# =========================================================
# Feed / Post Routes
# =========================================================


@router.get(
    "/users/me/posts",
    response_model=list[PostResponse],
)
def get_my_posts(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    return mark_liked_by_viewer(current_user.posts, current_user, db)


@router.get(
    "/users/{user_id}/posts",
    response_model=list[PostResponse],
)
def get_user_posts(
    user_id: int,
    viewer: User | None = Depends(get_optional_user),
    db: Session = Depends(get_db),
):
    user = db.get(User, user_id)

    if user is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found",
        )

    if not can_view_posts(user, viewer, db):
        raise HTTPException(status_code=403, detail="This profile is private")

    return mark_liked_by_viewer(user.posts, viewer, db)


@router.get(
    "/posts/{post_id}",
    response_model=PostResponse,
)
def get_post(
    post_id: int,
    viewer: User | None = Depends(get_optional_user),
    db: Session = Depends(get_db),
):
    """Retrieve an individual travel post."""

    post = db.get(Post, post_id)

    if post is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Post not found",
        )

    if not can_view_posts(post.user, viewer, db):
        raise HTTPException(status_code=404, detail="Post not found")

    mark_liked_by_viewer([post], viewer, db)
    return post


@router.get(
    "/posts",
    response_model=list[PostResponse],
)
def get_posts(
    viewer: User | None = Depends(get_optional_user),
    db: Session = Depends(get_db),
):
    """Retrieve the latest 20 travel posts."""

    posts = db.scalars(
        select(Post)
        .join(Post.user)
        .where(User.is_private.is_(False))
        .order_by(
            Post.created_at.desc(),
            Post.post_id.desc(),
        )
        .limit(20)
    ).all()

    return mark_liked_by_viewer(list(posts), viewer, db)


@router.post(
    "/posts",
    response_model=PostResponse,
    status_code=status.HTTP_201_CREATED,
)
def create_post(
    new_post_data: PostCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Create a travel post with location information."""

    new_location = Location(
        name=new_post_data.location.name,
        latitude=new_post_data.location.latitude,
        longitude=new_post_data.location.longitude,
    )

    new_post = Post(
        user_id=current_user.user_id,
        caption=new_post_data.caption,
        media_url=new_post_data.media_url,
        location=new_location,
    )

    try:
        db.add(new_post)
        db.commit()
        db.refresh(new_post)

    except Exception:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Unable to create post",
        ) from None

    return new_post


@router.delete(
    "/posts/{post_id}",
    status_code=status.HTTP_204_NO_CONTENT,
)
def delete_post(
    post_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Delete a post owned by the authenticated user."""

    post = db.get(Post, post_id)

    if post is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Post not found",
        )

    if post.user_id != current_user.user_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You are not authorized to delete this post",
        )

    try:
        db.delete(post)
        db.commit()

    except Exception:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Unable to delete post",
        ) from None


# =========================================================
# Post Likes
# =========================================================


@router.post(
    "/posts/{post_id}/likes",
    response_model=PostLikeResponse,
)
def toggle_post_like(
    post_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Toggle the authenticated user's like on a post."""

    # Verify that the post exists.
    post = db.get(Post, post_id)

    if post is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Post not found",
        )

    if not can_view_posts(post.user, current_user, db):
        raise HTTPException(status_code=404, detail="Post not found")

    # Check whether the authenticated user has already liked the post.
    existing_like = db.scalar(
        select(PostLike).where(
            PostLike.user_id == current_user.user_id,
            PostLike.post_id == post_id,
        )
    )

    try:
        if existing_like is not None:
            # User already liked the post, so remove the like.
            db.delete(existing_like)
            liked = False
        else:
            # User has not liked the post, so create the like.
            new_like = PostLike(
                user_id=current_user.user_id,
                post_id=post_id,
            )
            db.add(new_like)
            liked = True

        db.commit()

    except Exception:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Unable to update post like",
        ) from None

    # Count the current likes after the toggle.
    like_count = db.scalar(
        select(func.count()).select_from(PostLike).where(PostLike.post_id == post_id)
    )

    return {
        "post_id": post_id,
        "liked": liked,
        "like_count": like_count,
    }


# =========================================================
# Post Comments
# =========================================================


def get_visible_post_or_404(post_id: int, viewer: User | None, db: Session) -> Post:
    """Return a post the viewer may see; hide missing and private posts alike."""

    post = db.get(Post, post_id)

    if post is None or not can_view_posts(post.user, viewer, db):
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Post not found",
        )

    return post


@router.get(
    "/posts/{post_id}/comments",
    response_model=list[CommentResponse],
)
def get_post_comments(
    post_id: int,
    limit: int = Query(default=100, ge=1, le=200),
    viewer: User | None = Depends(get_optional_user),
    db: Session = Depends(get_db),
):
    """List a post's comments, oldest first."""

    get_visible_post_or_404(post_id, viewer, db)

    return db.scalars(
        select(Comment)
        .where(Comment.post_id == post_id)
        .order_by(Comment.created_at, Comment.comment_id)
        .limit(limit)
    ).all()


@router.post(
    "/posts/{post_id}/comments",
    response_model=CommentResponse,
    status_code=status.HTTP_201_CREATED,
)
def create_post_comment(
    post_id: int,
    comment_data: CommentCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Add a comment from the authenticated user to a post."""

    get_visible_post_or_404(post_id, current_user, db)

    new_comment = Comment(
        post_id=post_id,
        user_id=current_user.user_id,
        content=comment_data.content,
    )

    try:
        db.add(new_comment)
        db.commit()
        db.refresh(new_comment)

    except Exception:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Unable to create comment",
        ) from None

    return new_comment


# =========================================================
# Map / Location Routes
# =========================================================


@router.get("/locations", response_model=list[LocationResponse])
def list_locations(
    limit: int = Query(default=100, ge=1, le=200),
    db: Session = Depends(get_db),
):
    """Return existing WeTravel locations, not Mapbox search results."""
    return db.scalars(
        select(Location).order_by(Location.location_id).limit(limit)
    ).all()


@router.get("/locations/nearby", response_model=list[LocationResponse])
def nearby_locations(
    latitude: float = Query(ge=-90, le=90),
    longitude: float = Query(ge=-180, le=180),
    radius_m: float = Query(default=5000, gt=0, le=50000),
    limit: int = Query(default=100, ge=1, le=200),
    db: Session = Depends(get_db),
):
    """Find persisted WeTravel locations using PostGIS geography distances (meters).

    PostGIS must be enabled by the Alembic migration. This endpoint is PostgreSQL-only.
    """
    if db.bind is None or db.bind.dialect.name != "postgresql":
        raise HTTPException(status_code=503, detail="PostGIS requires PostgreSQL")

    # MakePoint uses longitude first. The parameterized query prevents SQL injection.
    query = text("""
        SELECT location_id, name, latitude, longitude
        FROM locations
        WHERE ST_DWithin(
            ST_SetSRID(ST_MakePoint(longitude, latitude), 4326)::geography,
            ST_SetSRID(ST_MakePoint(:longitude, :latitude), 4326)::geography,
            :radius_m
        )
        ORDER BY ST_Distance(
            ST_SetSRID(ST_MakePoint(longitude, latitude), 4326)::geography,
            ST_SetSRID(ST_MakePoint(:longitude, :latitude), 4326)::geography
        ), location_id
        LIMIT :limit
    """)
    rows = (
        db.execute(
            query,
            {
                "longitude": longitude,
                "latitude": latitude,
                "radius_m": radius_m,
                "limit": limit,
            },
        )
        .mappings()
        .all()
    )
    return [dict(row) for row in rows]


MAPBOX_SEARCH_URL = "https://api.mapbox.com/search/searchbox/v1"


def _mapbox_token() -> str:
    # A public pk. token is sufficient; configure it on the backend separately.
    token = os.getenv("MAPBOX_TOKEN", "").strip()
    if not token:
        raise HTTPException(status_code=503, detail="Mapbox Search is not configured")
    return token


def _mapbox_request(path: str, params: dict) -> dict:
    params = {**params, "access_token": _mapbox_token()}
    try:
        with httpx.Client(timeout=8.0) as client:
            response = client.get(f"{MAPBOX_SEARCH_URL}/{path}", params=params)
            response.raise_for_status()
            return response.json()
    except (httpx.HTTPError, ValueError) as exc:
        # Do not surface upstream error bodies or token-bearing URLs to clients.
        raise HTTPException(
            status_code=502, detail="Mapbox Search unavailable"
        ) from exc


@router.get("/locations/search/suggest")
def suggest_places(
    q: str = Query(min_length=2, max_length=256),
    session_token: str = Query(min_length=8, max_length=128),
    limit: int = Query(default=5, ge=1, le=10),
    near: str | None = Query(default=None, max_length=100),
):
    """Live, temporary Mapbox autocomplete; do not persist these results."""
    params = {"q": q, "session_token": session_token, "limit": limit}
    if near:
        params["near"] = near
    payload = _mapbox_request("suggest", params)
    return {"suggestions": payload.get("suggestions", [])}


@router.get("/locations/search/retrieve/{mapbox_id:path}")
def retrieve_place(
    mapbox_id: str,
    session_token: str = Query(min_length=8, max_length=128),
):
    """Retrieve a selected Mapbox suggestion for temporary on-screen display."""
    # Restrict user input to a single identifier path segment.
    if not mapbox_id or "/" in mapbox_id or len(mapbox_id) > 256:
        raise HTTPException(status_code=422, detail="Invalid Mapbox place ID")
    return _mapbox_request(f"retrieve/{mapbox_id}", {"session_token": session_token})


@router.get(
    "/locations/{location_id}",
    response_model=LocationResponse,
)
def get_location(
    location_id: int,
    db: Session = Depends(get_db),
):
    location = db.get(Location, location_id)

    if location is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Location not found",
        )

    return location


@router.get(
    "/locations/{location_id}/posts",
    response_model=list[PostResponse],
)
def get_posts_by_location(
    location_id: int,
    viewer: User | None = Depends(get_optional_user),
    db: Session = Depends(get_db),
):
    location = db.get(Location, location_id)

    if location is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Location not found",
        )

    public_posts = [post for post in location.posts if not post.user.is_private]
    return mark_liked_by_viewer(public_posts, viewer, db)


# =========================================================
# Itinerary Routes
# =========================================================


@router.get(
    "/itineraries",
    response_model=list[ItineraryResponse],
)
def get_itineraries(
    current_user: User = Depends(get_current_user),
):
    """Retrieve the authenticated user's itineraries."""

    return current_user.itineraries


@router.post(
    "/itineraries",
    response_model=ItineraryResponse,
    status_code=status.HTTP_201_CREATED,
)
def create_itinerary(
    itinerary_data: ItineraryCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Create an itinerary and associate its requested destinations."""

    locations = []

    for location_id in itinerary_data.destinations:
        location = db.get(Location, location_id)

        if location is None:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Location {location_id} not found",
            )

        locations.append(location)

    new_itinerary = Itinerary(
        user_id=current_user.user_id,
        name=itinerary_data.name,
        description=itinerary_data.description,
        start_date=itinerary_data.start_date,
        end_date=itinerary_data.end_date,
        destinations=locations,
    )

    try:
        db.add(new_itinerary)
        db.commit()
        db.refresh(new_itinerary)

    except Exception:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Unable to create itinerary",
        ) from None

    return new_itinerary


@router.get(
    "/itineraries/{itinerary_id}",
    response_model=ItineraryResponse,
)
def get_itinerary(
    itinerary_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    itinerary = db.get(Itinerary, itinerary_id)

    if itinerary is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Itinerary not found",
        )

    if itinerary.user_id != current_user.user_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You are not authorized to view this itinerary",
        )

    return itinerary


@router.put(
    "/itineraries/{itinerary_id}",
    response_model=ItineraryResponse,
)
def update_itinerary(
    itinerary_id: int,
    itinerary_data: ItineraryUpdate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Update an itinerary owned by the authenticated user."""

    itinerary = db.get(Itinerary, itinerary_id)

    if itinerary is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Itinerary not found",
        )

    if itinerary.user_id != current_user.user_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You are not authorized to modify this itinerary",
        )

    update_data = itinerary_data.model_dump(exclude_unset=True)

    for field, value in update_data.items():
        setattr(itinerary, field, value)

    try:
        db.commit()
        db.refresh(itinerary)

    except Exception:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Unable to update itinerary",
        ) from None

    return itinerary


@router.post(
    "/itineraries/{itinerary_id}/destinations/{location_id}",
    response_model=ItineraryResponse,
)
def add_itinerary_destination(
    itinerary_id: int,
    location_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Add a location to an itinerary owned by the authenticated user."""

    itinerary = db.get(Itinerary, itinerary_id)

    if itinerary is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Itinerary not found",
        )

    if itinerary.user_id != current_user.user_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You are not authorized to modify this itinerary",
        )

    location = db.get(Location, location_id)

    if location is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Location not found",
        )

    if location in itinerary.destinations:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Location is already a destination of this itinerary",
        )

    try:
        itinerary.destinations.append(location)
        db.commit()
        db.refresh(itinerary)

    except Exception:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Unable to add itinerary destination",
        ) from None

    return itinerary


@router.delete(
    "/itineraries/{itinerary_id}/destinations/{location_id}",
    status_code=status.HTTP_204_NO_CONTENT,
)
def remove_itinerary_destination(
    itinerary_id: int,
    location_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Remove a destination from an itinerary owned by the authenticated user."""

    itinerary = db.get(Itinerary, itinerary_id)

    if itinerary is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Itinerary not found",
        )

    if itinerary.user_id != current_user.user_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You are not authorized to modify this itinerary",
        )

    location = db.get(Location, location_id)

    if location is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Location not found",
        )

    if location not in itinerary.destinations:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Location is not a destination of this itinerary",
        )

    try:
        itinerary.destinations.remove(location)
        db.commit()

    except Exception:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Unable to remove itinerary destination",
        ) from None


# =========================================================
# Safety Report Routes
# =========================================================


@router.get(
    "/safety-reports",
    response_model=list[PublicSafetyReportResponse],
)
def get_safety_reports(
    report_type: str | None = None,
    db: Session = Depends(get_db),
):
    """Retrieve safety reports, optionally filtered by report type."""

    query = select(SafetyReport)

    if report_type is not None:
        query = query.where(SafetyReport.report_type == report_type)

    query = query.order_by(
        SafetyReport.created_at.desc(),
        SafetyReport.report_id.desc(),
    ).limit(100)

    return db.scalars(query).all()


@router.post(
    "/safety-reports",
    response_model=SafetyReportResponse,
    status_code=status.HTTP_201_CREATED,
)
def create_safety_report(
    report_data: SafetyReportCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Create a safety report with location information."""

    new_location = Location(
        name=report_data.location.name,
        latitude=report_data.location.latitude,
        longitude=report_data.location.longitude,
    )

    new_report = SafetyReport(
        user_id=current_user.user_id,
        report_type=report_data.report_type,
        location=new_location,
        description=report_data.description,
    )

    try:
        db.add(new_report)
        db.commit()
        db.refresh(new_report)

    except Exception:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Unable to create safety report",
        ) from None

    return new_report


@router.delete(
    "/safety-reports/{report_id}",
    status_code=status.HTTP_204_NO_CONTENT,
)
def delete_safety_report(
    report_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Only the safety report's owner may delete it."""
    report = db.get(SafetyReport, report_id)

    if report is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Safety report not found",
        )

    if report.user_id != current_user.user_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You are not authorized to delete this safety report",
        )

    try:
        db.delete(report)
        db.commit()
    except Exception:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Unable to delete safety report",
        ) from None
