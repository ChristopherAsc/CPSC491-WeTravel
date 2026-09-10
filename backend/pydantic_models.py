from pydantic import BaseModel, Field, EmailStr
from typing import List, Optional
from datetime import datetime, timedelta, timezone


class Location(BaseModel):
    name: str
    latitude: float
    longitude: float


class PostCreate(BaseModel):
    caption: str = Field(min_length=1, max_length=2200)
    media_url: Optional[str] = None
    location: Location


class PostResponse(BaseModel):
    post_id: int
    user_id: int
    caption: str
    media_url: Optional[str] = None
    location: Location
    created_at: datetime


class ItineraryCreate(BaseModel):
    name: str = Field(min_length=1, max_length=100)


class SafetyReportCreate(BaseModel):
    report_type: str
    location: Location
    description: Optional[str] = None


class UserRegistration(BaseModel):
    email = EmailStr
    username = str
    password = str = Field(min_length=6)


class UserResponse(BaseModel):
    user_id: int
    username: str
    email: str
    posts: list[PostResponse] = []  # Or List[PostResponse] = [] for Python < 3.9


class PublicUserResponse(BaseModel):
    user_id: int
    username: str
    posts: list[PostResponse] = []


class LoginRequest(BaseModel):
    entered_username: str
    entered_password: str
