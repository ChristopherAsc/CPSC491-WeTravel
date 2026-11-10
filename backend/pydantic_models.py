from datetime import date, datetime
from typing import Annotated, Optional

from pydantic import (
    BaseModel,
    ConfigDict,
    EmailStr,
    Field,
    PlainSerializer,
    field_validator,
)

# C08: 3 decimal places (about 110 m) is enough to place a map pin without
# pinpointing a building. Rounding happens only when a response is sent.
PUBLIC_COORDINATE_DECIMALS = 3

PublicCoordinate = Annotated[
    float,
    PlainSerializer(
        lambda value: round(value, PUBLIC_COORDINATE_DECIMALS), return_type=float
    ),
]


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
    latitude: PublicCoordinate
    longitude: PublicCoordinate


class PostLocationResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    name: str
    latitude: PublicCoordinate
    longitude: PublicCoordinate


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
    location: PostLocationResponse
    created_at: datetime
    like_count: int


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
    description: Optional[str] = None
    start_date: date
    end_date: date
    destinations: list[LocationResponse] = Field(default_factory=list)


class ItineraryUpdate(BaseModel):
    name: str | None = Field(default=None, min_length=1, max_length=100)
    description: str | None = Field(default=None, max_length=2000)
    start_date: date | None = None
    end_date: date | None = None


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


class PublicSafetyReportResponse(BaseModel):
    """Safety report as shown on the public map, without the reporter's identity."""

    model_config = ConfigDict(from_attributes=True)

    report_id: int
    report_type: str
    location: LocationResponse
    description: Optional[str] = None
    created_at: datetime


class SafetyReportResponse(PublicSafetyReportResponse):
    """Returned only to the reporter who created the report."""

    user_id: int


class UserRegistration(BaseModel):
    email: EmailStr
    username: str = Field(min_length=3, max_length=50)
    password: str = Field(min_length=8, max_length=128)


class UserResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    user_id: int
    username: str
    email: str
    posts: list[PostResponse] = []


class PublicUserResponse(BaseModel):
    """Fields intentionally safe for public profile responses."""

    model_config = ConfigDict(from_attributes=True)

    user_id: int
    username: str


class LoginRequest(BaseModel):
    username: str
    password: str


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"


class PostLikeResponse(BaseModel):
    post_id: int
    liked: bool
    like_count: int
