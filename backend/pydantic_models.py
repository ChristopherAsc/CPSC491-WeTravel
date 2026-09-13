from pydantic import BaseModel, ConfigDict, Field, EmailStr
from typing import List, Optional
from datetime import datetime, timedelta, timezone

class Location(BaseModel):
    name: str
    latitude: float
    longitude: float
    
class LocationResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    location_id: int
    name: str
    latitude: float
    longitude: float


class PostCreate(BaseModel):
    caption: str = Field(min_length=1, max_length=2200)
    media_url: Optional[str] = None
    location: Location


class PostResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    post_id: int
    user_id: int
    caption: str
    media_url: Optional[str] = None
    location: Location
    created_at: datetime


class ItineraryCreate(BaseModel):
    name: str = Field(min_length=1, max_length=100)

class ItineraryResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    itinerary_id: int
    user_id: int
    name: str
    destinations: list[LocationResponse] = Field(
        default_factory=list
    )


class SafetyReportCreate(BaseModel):
    report_type: str
    location: Location
    description: Optional[str] = None

class SafetyReportResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    report_id: int
    user_id: int
    report_type: str
    location: LocationResponse
    description: Optional[str] = None
    created_at: datetime


class UserRegistration(BaseModel):
    email: EmailStr
    username: str
    password: str = Field(min_length=6)


class UserResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    user_id: int
    username: str
    email: str
    posts: list[PostResponse] = []  # Or List[PostResponse] = [] for Python < 3.9


class PublicUserResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    user_id: int
    username: str
    posts: list[PostResponse] = []


class LoginRequest(BaseModel):
    username: str
    password: str


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
