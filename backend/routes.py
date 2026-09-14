import os
from datetime import datetime, timedelta, timezone
from typing import Optional
import jwt
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import Session

# from pydantic import BaseModel, Field, EmailStr
from pwdlib import PasswordHash
from fastapi.security import OAuth2PasswordBearer

from database import get_db
from models import User
from pydantic_models import (
    LocationResponse,
    PostResponse,
    PostCreate,
    UserRegistration,
    UserResponse,
    PublicUserResponse,
    ItineraryCreate,
    ItineraryResponse,
    SafetyReportCreate,
    SafetyReportResponse,
    LoginRequest,
    TokenResponse,
)

# ---------------------------------------------------------
# Router Setup
# ---------------------------------------------------------

router = APIRouter()
# ----------------------------------------------------------

SECRET_KEY = os.environ["JWT_SECRET"]
ALGORITHM = os.environ.get("JWT_ALGORITHM", "HS256")
ACCESS_TOKEN_EXPIRE_MINUTES = int(os.environ.get("ACCESS_TOKEN_EXPIRE_MINUTES", 60))

password_hash = PasswordHash.recommended()
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/api/auth/login")


def hash_password(plain_password: str) -> str:
    return password_hash.hash(plain_password)


def verify_password(plain_password: str, hashed_password: str) -> bool:
    return password_hash.verify(plain_password, hashed_password)


def create_access_token(user_id: int, username: str) -> str:

    expiration = datetime.now(timezone.utc) + timedelta(
        minutes=ACCESS_TOKEN_EXPIRE_MINUTES
    )

    payload = {"sub": str(user_id), "username": username, "exp": expiration}

    token = jwt.encode(payload, SECRET_KEY, algorithm=ALGORITHM)

    return token


def get_current_user(
    token: str = Depends(oauth2_scheme), db: Session = Depends(get_db)
):
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])

        user_id = payload.get("sub")

        if user_id is None:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid authentication token",
            )

    except jwt.InvalidTokenError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid or expired token"
        )

    user = db.get(User, int(user_id))

    if user is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED, detail="User no longer exists"
        )

    return user


# ---------------------------------------------------------
# Temporary Mock Data
# ---------------------------------------------------------
# This lets the frontend work with the API before PostgreSQL
# and SQLAlchemy are connected.
#
# Remove this once the database implementation is ready.
# ---------------------------------------------------------


mock_posts = [
    {
        "post_id": 1,
        "user_id": 1,
        "caption": "Exploring Yosemite!",
        "media_url": "https://example.com/yosemite.jpg",
        "location": {
            "name": "Yosemite National Park",
            "latitude": 37.8651,
            "longitude": -119.5383,
        },
        "created_at": "2026-09-01T18:30:00Z",
    }
]


# =========================================================
# Authentication Routes
# =========================================================


@router.post("/auth/register", status_code=status.HTTP_201_CREATED)
def register(new_user_data: UserRegistration, db: Session = Depends(get_db)):
    """

    Register a new user. (Instantiate database class object of User WITH a HASHED PASSWORD)

    Steps:
    1. Validate request body with Pydantic
    2. Check for duplicate email/username
    3. Hash password
    4. Create new SQLAlchemy User object
    5. Save user to database
    """

    # 2. Check case where email already exists
    existing_email = db.scalar(select(User).where(User.email == new_user_data.email))

    if existing_email is not None:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT, detail="Email is already registered"
        )

    # 2. Check case where username already exists
    existing_username = db.scalar(
        select(User).where(User.username == new_user_data.username)
    )

    if existing_username is not None:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT, detail="Username is already taken"
        )

    # 3. Hash the plain-text password sent by the client
    hashed_password = hash_password(new_user_data.password)

    # 4. Create SQLAlchemy database object
    new_user = User(
        email=new_user_data.email,
        username=new_user_data.username,
        hashed_password=hashed_password,
    )

    # 5. Save/write database object to database
    try:
        db.add(new_user)
        db.commit()
        db.refresh(new_user)

    except Exception:
        db.rollback()

        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Unable to create user",
        )

    return {"message": "User registered successfully", "user_id": new_user.user_id}


@router.post("/auth/login", response_model=TokenResponse)
def login(login_credentials: LoginRequest, db: Session = Depends(get_db)):
    """
    Authenticate a user.

    Steps
    1. validate long request with Pydantic model LoginRequest - get only necessary data from payload
    2. Find associate user
    3. Verify user exists
    4. Verify password that is supplied
    5. Generate JWT to send back to client that allows subsequent identifaction of current user in database
    """
    # Find user by username
    statement = select(User).where(User.username == login_credentials.username)

    user = db.scalar(statement)

    # VALIDATION of USER AND PASSWORD compared to what is stored in database

    # Check case where Username doesn't exist case ini database
    if user is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid username or password",
        )

    # Check Case where Password is incorrect
    if not verify_password(login_credentials.password, user.hashed_password):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid username or password",
        )

    # Credentials are valid, So we create JWT and return it to client.
    access_token = create_access_token(user_id=user.user_id, username=user.username)

    return {"access_token": access_token, "token_type": "bearer"}


## Log out is handled on the front end.


# =========================================================
# User / Profile Routes
# used to instantiate a user profile
# =========================================================
@router.get("/users/me", response_model=UserResponse)
def get_my_profile(current_user: User = Depends(get_current_user)):
    return current_user


@router.get("/users/{user_id}", response_model=PublicUserResponse)
def get_user_profile(user_id: int, db: Session = Depends(get_db)):
    user = db.get(User, user_id)

    if user is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="User not found"
        )

    return user


# =========================================================
# Feed / Post Routes
# =========================================================


@router.get("/users/me/posts", response_model=list[PostResponse])
def get_my_posts(current_user: User = Depends(get_current_user)):

    return current_user.posts

@router.get("/users/{user_id}/posts", response_model=list[PostResponse])
def get_user_posts(user_id: int, db: Session = Depends(get_db)):

    user = db.get(User, user_id)
    
    if user is None:
        raise HTTPException(
        status_code=status.HTTP_404_NOT_FOUND,
        detail="User not found",
    )
    return user.posts
    



@router.get("/posts/{post_id}", response_model = PostResponse)
def get_post(post_id: int,  db: Session = Depends(get_db)):
    """
    Retrieve one travel post.
    """
    post = db.get(Post, post_id)

    if post is None:
        raise HTTPException(
        status_code=status.HTTP_404_NOT_FOUND,
        detail="Post not found",
    )
    return post

@router.get("/posts", response_model=list[PostResponse])
def get_posts(
    db: Session = Depends(get_db)
):
    posts = db.scalars(
        select(Post)
        .order_by(Post.created_at.desc())
        .limit(20)
    ).all()

    return posts
        




@router.post(
    "/posts",
    response_model=PostResponse,
    status_code=status.HTTP_201_CREATED,
)
def create_post(new_post_data: PostCreate, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    """
    Create a new travel post.
    TODO:
    - Get user_id from authenticated user
    - Store post using SQLAlchemy
    """
    new_post = Post(
        user_id = current_user.user_id,
        caption = new_post_data.caption,
        media_url = new_post_data.media_url,
        location = new_post_data.location
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
        )

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
    """
    Delete a travel post.

    Only the user who created the post may delete it.
    """

    # Retrieve post by primary key
    post = db.get(Post, post_id)

    # Post does not exist
    if post is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Post not found",
        )

    # Logged-in user does not own the post
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
        )

    return


# =========================================================
# Map / Location Routes
# =========================================================


@router.get(
    "/locations/{location_id}",
    response_model=LocationResponse
)
def get_location(
    location_id: int,
    db: Session = Depends(get_db)
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
    response_model=list[PostResponse]
)
def get_posts_by_location(
    location_id: int,
    db: Session = Depends(get_db)
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
    response_model=list[ItineraryResponse]
)
def get_itineraries(
    current_user: User = Depends(get_current_user)
):
    """
    Retrieve itineraries belonging to the current user.
    """

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
    new_itinerary = Itinerary(
        user_id=current_user.user_id,
        name=itinerary_data.name,
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
        )

    return new_itinerary

@router.get(
    "/itineraries/{itinerary_id}",
    response_model=ItineraryResponse
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


# =========================================================
# Safety Routes
# =========================================================


@router.get("/safety-reports")
def get_safety_reports():
    """
    Retrieve safety reports.
    """

    return []


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
    new_report = SafetyReport(
        user_id=current_user.user_id,
        report_type=report_data.report_type,
        location=report_data.location,
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
        )

    return new_report
