from datetime import date, datetime
from typing import Optional

from pydantic import BaseModel, ConfigDict, EmailStr, Field, field_validator


class Location(BaseModel):
    name: str = Field(min_length=1, max_length=255)
    latitude: float = Field(ge=-90, le=90, allow_inf_nan=False)
    longitude: float = Field(ge=-180, le=180, allow_inf_nan=False)

    @field_validator("name")
    @classmethod
    def validate_name(cls, value: str) -> str:
        value = value.strip()

        if not value:
            raise ValueError("Location name cannot be blank")

        return value


class LocationResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    location_id: int
    name: str
    latitude: float
    longitude: float


class PostCreate(BaseModel):
    caption: str = Field(min_length=1, max_length=2200)
    media_url: Optional[str] = Field(default=None, max_length=2048)
    location: Location

    @field_validator("caption")
    @classmethod
    def validate_caption(cls, value: str) -> str:
        value = value.strip()

        if not value:
            raise ValueError("Caption cannot be blank")

        return value


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
    description: Optional[str] = None
    start_date: date
    end_date: date
    destinations: list[int] = Field(default_factory=list)


class ItineraryResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    itinerary_id: int
    user_id: int
    name: str
    start_date: date
    end_date: date
    destinations: list[LocationResponse] = Field(default_factory=list)


class SafetyReportCreate(BaseModel):
    report_type: str = Field(min_length=1, max_length=100)
    location: Location
    description: Optional[str] = Field(default=None, max_length=2000)

    @field_validator("report_type")
    @classmethod
    def validate_report_type(cls, value: str) -> str:
        value = value.strip()

        if not value:
            raise ValueError("Report type cannot be blank")

        return value


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
    username: str = Field(min_length=3, max_length=50)
    password: str = Field(min_length=8, max_length=128)


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
