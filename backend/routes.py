import os
from datetime import datetime, timedelta, timezone

import httpx
import jwt
from database import get_db
from fastapi import APIRouter, Depends, HTTPException, Query, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from models import Itinerary, Location, Post, PostLike, SafetyReport, User
from pwdlib import PasswordHash
from pydantic_models import (
    ItineraryCreate,
    ItineraryResponse,
    ItineraryUpdate,
    LocationResponse,
    LoginRequest,
    PostCreate,
    PostLikeResponse,
    PostResponse,
    PublicUserResponse,
    SafetyReportCreate,
    SafetyReportResponse,
    TokenResponse,
    UserRegistration,
    UserResponse,
)
from sqlalchemy import func, select, text
from sqlalchemy.orm import Session

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
):
    return current_user.posts


@router.get(
    "/users/{user_id}/posts",
    response_model=list[PostResponse],
)
def get_user_posts(
    user_id: int,
    db: Session = Depends(get_db),
):
    user = db.get(User, user_id)

    if user is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found",
        )

    return user.posts


@router.get(
    "/posts/{post_id}",
    response_model=PostResponse,
)
def get_post(
    post_id: int,
    db: Session = Depends(get_db),
):
    """Retrieve an individual travel post."""

    post = db.get(Post, post_id)

    if post is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Post not found",
        )

    return post


@router.get(
    "/posts",
    response_model=list[PostResponse],
)
def get_posts(
    db: Session = Depends(get_db),
):
    """Retrieve the latest 20 travel posts."""

    return db.scalars(
        select(Post)
        .order_by(
            Post.created_at.desc(),
            Post.post_id.desc(),
        )
        .limit(20)
    ).all()


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
    db: Session = Depends(get_db),
):
    location = db.get(Location, location_id)

    if location is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Location not found",
        )

    return location.posts


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
    response_model=list[SafetyReportResponse],
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
