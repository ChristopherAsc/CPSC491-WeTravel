from datetime import datetime, timedelta, timezone
from typing import Optional
import jwt
from fastapi import APIRouter, HTTPException, status

# from pydantic import BaseModel, Field, EmailStr
from pwdlib import PasswordHash
from fastapi.security import OAuth2PasswordBearer

from pydantic_models import (
    Location,
    PostResponse,
    PostCreate,
    UserRegistration,
    UserResponse,
    PublicUserResponse,
    ItineraryCreate,
    SafetyReportCreate,
    LoginRequest,
)

# ---------------------------------------------------------
# Router Setup
# ---------------------------------------------------------

router = APIRouter()
# ----------------------------------------------------------

SECRET_KEY = "CHANGE_THIS_TO_A_LONG_RANDOM_SECRET"
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 60

password_hash = PasswordHash.recommended()
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/api/auth/login")


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
def register(new_user_data=UserRegistration, db: Session = Depends(get_db)):
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


@router.post("/auth/login", response_model=UserResponse)
def login(login_credentials=LoginRequest, db: Session = Depends(get_db)):
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
    statement = select(User).where(User.username == credentials.username)

    user = db.scalar(statement)

    # VALIDATION of USER AND PASSWORD compared to what is stored in database

    # Check case where Username doesn't exist case ini database
    if user is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid username or password",
        )

    # Check Case where Password is incorrect
    if not verify_password(credentials.password, user.hashed_password):
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
@router.get("/users/me")
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


@router.get("/posts", response_model=PostResponse)
def get_posts(post_request=PostRequest):
    """
    Retrieve travel posts for the Feed.

    TODO:
    - Connect PostgreSQL
    - Add pagination
    - Add destination/location filtering
    """

    return mock_posts


@router.get("/posts/{post_id}")
def get_post(post_id: int):
    """
    Retrieve one travel post.
    """

    for post in mock_posts:
        if post["post_id"] == post_id:
            return post

    raise HTTPException(
        status_code=status.HTTP_404_NOT_FOUND,
        detail="Post not found",
    )


@router.post(
    "/posts",
    response_model=PostResponse,
    status_code=status.HTTP_201_CREATED,
)
def create_post(post: PostCreate):
    """
    Create a new travel post.

    Currently returns mock data.

    TODO:
    - Get user_id from authenticated user
    - Upload media through Cloudinary
    - Store post using SQLAlchemy
    """

    new_post = {
        "post_id": len(mock_posts) + 1,
        "user_id": 1,
        "caption": post.caption,
        "media_url": post.media_url,
        "location": post.location.model_dump(),
        "created_at": datetime.now(timezone.utc),
    }

    mock_posts.append(new_post)

    return new_post


@router.delete(
    "/posts/{post_id}",
    status_code=status.HTTP_204_NO_CONTENT,
)
def delete_post(post_id: int):
    """
    Delete a post.

    TODO:
    - Require authentication
    - Verify that current user owns the post
    """

    for index, post in enumerate(mock_posts):
        if post["post_id"] == post_id:
            mock_posts.pop(index)
            return

    raise HTTPException(
        status_code=status.HTTP_404_NOT_FOUND,
        detail="Post not found",
    )


# =========================================================
# Map / Location Routes
# =========================================================


@router.get("/locations/{location_id}")
def get_location(location_id: int):
    """
    Retrieve information about a location.

    TODO:
    - Replace with PostGIS-backed location query
    """

    return {
        "location_id": location_id,
        "name": "Example Location",
        "latitude": 0.0,
        "longitude": 0.0,
    }


@router.get("/locations/{location_id}/posts")
def get_posts_by_location(location_id: int):
    """
    Retrieve posts associated with a location.

    TODO:
    - Implement using PostgreSQL/PostGIS
    """

    return {
        "location_id": location_id,
        "posts": [],
    }


# =========================================================
# Itinerary Routes
# =========================================================


@router.get("/itineraries")
def get_itineraries():
    """
    Retrieve itineraries belonging to the current user.

    TODO:
    - Require authentication
    - Query by current user ID
    """

    return []


@router.post(
    "/itineraries",
    status_code=status.HTTP_201_CREATED,
)
def create_itinerary(itinerary: ItineraryCreate):
    """
    Create a new itinerary.
    """

    return {
        "itinerary_id": 1,
        "name": itinerary.name,
        "destinations": [],
    }


@router.get("/itineraries/{itinerary_id}")
def get_itinerary(itinerary_id: int):
    """
    Retrieve one itinerary.
    """

    return {
        "itinerary_id": itinerary_id,
        "name": "Example Trip",
        "destinations": [],
    }


# =========================================================
# Safety Routes
# =========================================================


@router.get("/safety-reports")
def get_safety_reports():
    """
    Retrieve safety reports.

    TODO:
    - Add geographic filtering
    - Add PostGIS radius queries
    """

    return []


@router.post(
    "/safety-reports",
    status_code=status.HTTP_201_CREATED,
)
def create_safety_report(report: SafetyReportCreate):
    """
    Submit a new safety report.

    TODO:
    - Require authentication
    - Persist to database
    - Add validation/verification logic
    """

    return {
        "report_id": 1,
        "report_type": report.report_type,
        "location": report.location,
        "description": report.description,
        "created_at": datetime.now(timezone.utc),
    }
