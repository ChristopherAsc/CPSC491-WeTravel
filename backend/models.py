from __future__ import annotations

from datetime import date, datetime

from database import Base
from sqlalchemy import (
    Boolean,
    CheckConstraint,
    Column,
    Date,
    DateTime,
    Float,
    ForeignKey,
    String,
    Table,
    UniqueConstraint,
    func,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship

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
    is_private: Mapped[bool] = mapped_column(
        Boolean, nullable=False, default=False, server_default="false"
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
    outgoing_friend_requests: Mapped[list["FriendRequest"]] = relationship(
        foreign_keys="FriendRequest.sender_id",
        back_populates="sender",
        cascade="all, delete-orphan",
    )
    incoming_friend_requests: Mapped[list["FriendRequest"]] = relationship(
        foreign_keys="FriendRequest.recipient_id",
        back_populates="recipient",
        cascade="all, delete-orphan",
    )
    post_likes: Mapped[list["PostLike"]] = relationship(
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
    post_likes: Mapped[list["PostLike"]] = relationship(
        back_populates="post",
        cascade="all, delete-orphan",
    )

    @property
    def like_count(self) -> int:
        return len(self.post_likes)


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


class PostLike(Base):
    __tablename__ = "post_likes"

    user_id: Mapped[int] = mapped_column(
        ForeignKey("users.user_id", ondelete="CASCADE"),
        primary_key=True,
    )
    post_id: Mapped[int] = mapped_column(
        ForeignKey("posts.post_id", ondelete="CASCADE"),
        primary_key=True,
    )

    user: Mapped["User"] = relationship(back_populates="post_likes")
    post: Mapped["Post"] = relationship(back_populates="post_likes")


class FriendRequest(Base):
    __tablename__ = "friend_requests"
    __table_args__ = (
        UniqueConstraint(
            "sender_id", "recipient_id", name="uq_friend_request_direction"
        ),
        CheckConstraint("sender_id <> recipient_id", name="ck_friend_request_no_self"),
        CheckConstraint(
            "status IN ('pending', 'accepted', 'declined')",
            name="ck_friend_request_status",
        ),
    )

    request_id: Mapped[int] = mapped_column(primary_key=True)
    sender_id: Mapped[int] = mapped_column(
        ForeignKey("users.user_id", ondelete="CASCADE"), nullable=False, index=True
    )
    recipient_id: Mapped[int] = mapped_column(
        ForeignKey("users.user_id", ondelete="CASCADE"), nullable=False, index=True
    )
    status: Mapped[str] = mapped_column(String(16), nullable=False, default="pending")
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )

    sender: Mapped["User"] = relationship(
        foreign_keys=[sender_id], back_populates="outgoing_friend_requests"
    )
    recipient: Mapped["User"] = relationship(
        foreign_keys=[recipient_id], back_populates="incoming_friend_requests"
    )
