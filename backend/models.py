from __future__ import annotations

from datetime import date, datetime

from sqlalchemy import Date, DateTime, Float, ForeignKey, String, Table, Column, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from database import Base

itinerary_destinations = Table(
    "itinerary_destinations",
    Base.metadata,
    Column(
        "itinerary_id",
        ForeignKey("itineraries.itinerary_id", ondelete="CASCADE"),
        primary_key=True,
    ),
    Column(
        "location_id",
        ForeignKey("locations.location_id", ondelete="CASCADE"),
        primary_key=True,
    ),
)


class User(Base):
    __tablename__ = "users"

    user_id: Mapped[int] = mapped_column(primary_key=True)
    username: Mapped[str] = mapped_column(
        String(50),
        unique=True,
        nullable=False,
        index=True,
    )
    email: Mapped[str] = mapped_column(
        String(255),
        unique=True,
        nullable=False,
        index=True,
    )
    hashed_password: Mapped[str] = mapped_column(
        String(255),
        nullable=False,
    )

    posts: Mapped[list["Post"]] = relationship(
        back_populates="user",
        cascade="all, delete-orphan",
    )
    itineraries: Mapped[list["Itinerary"]] = relationship(
        back_populates="user",
        cascade="all, delete-orphan",
    )
    safety_reports: Mapped[list["SafetyReport"]] = relationship(
        back_populates="user",
        cascade="all, delete-orphan",
    )


class Location(Base):
    __tablename__ = "locations"

    location_id: Mapped[int] = mapped_column(primary_key=True)
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    latitude: Mapped[float] = mapped_column(Float, nullable=False)
    longitude: Mapped[float] = mapped_column(Float, nullable=False)

    posts: Mapped[list["Post"]] = relationship(back_populates="location")
    safety_reports: Mapped[list["SafetyReport"]] = relationship(
        back_populates="location"
    )
    itineraries: Mapped[list["Itinerary"]] = relationship(
        secondary=itinerary_destinations,
        back_populates="destinations",
    )


class Post(Base):
    __tablename__ = "posts"

    post_id: Mapped[int] = mapped_column(primary_key=True)
    user_id: Mapped[int] = mapped_column(
        ForeignKey("users.user_id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    location_id: Mapped[int] = mapped_column(
        ForeignKey("locations.location_id"),
        nullable=False,
        index=True,
    )
    caption: Mapped[str] = mapped_column(String(2200), nullable=False)
    media_url: Mapped[str | None] = mapped_column(String(2048), nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        nullable=False,
    )

    user: Mapped["User"] = relationship(back_populates="posts")
    location: Mapped["Location"] = relationship(back_populates="posts")


class Itinerary(Base):
    __tablename__ = "itineraries"

    itinerary_id: Mapped[int] = mapped_column(primary_key=True)
    user_id: Mapped[int] = mapped_column(
        ForeignKey("users.user_id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    name: Mapped[str] = mapped_column(String(100), nullable=False)
    description: Mapped[str | None] = mapped_column(String(2000), nullable=True)
    start_date: Mapped[date] = mapped_column(Date, nullable=False)
    end_date: Mapped[date] = mapped_column(Date, nullable=False)

    user: Mapped["User"] = relationship(back_populates="itineraries")
    destinations: Mapped[list["Location"]] = relationship(
        secondary=itinerary_destinations,
        back_populates="itineraries",
    )


class SafetyReport(Base):
    __tablename__ = "safety_reports"

    report_id: Mapped[int] = mapped_column(primary_key=True)
    user_id: Mapped[int] = mapped_column(
        ForeignKey("users.user_id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    location_id: Mapped[int] = mapped_column(
        ForeignKey("locations.location_id"),
        nullable=False,
        index=True,
    )
    report_type: Mapped[str] = mapped_column(String(100), nullable=False)
    description: Mapped[str | None] = mapped_column(String(2000), nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        nullable=False,
    )

    user: Mapped["User"] = relationship(back_populates="safety_reports")
    location: Mapped["Location"] = relationship(back_populates="safety_reports")
