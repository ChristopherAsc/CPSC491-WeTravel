"""Add post, safety, location, and itinerary tables.

Revision ID: ff6b866c8309
Revises: a6fe3f474c47
Create Date: 2026-10-11
"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

# Alembic revision identifiers
revision: str = "ff6b866c8309"
down_revision: Union[str, Sequence[str], None] = "a6fe3f474c47"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Create locations, posts, safety reports, and itinerary tables."""

    # Locations
    op.create_table(
        "locations",
        sa.Column("location_id", sa.Integer(), nullable=False),
        sa.Column("name", sa.String(length=255), nullable=False),
        sa.Column("latitude", sa.Float(), nullable=False),
        sa.Column("longitude", sa.Float(), nullable=False),
        sa.PrimaryKeyConstraint("location_id"),
    )

    # Itineraries
    op.create_table(
        "itineraries",
        sa.Column("itinerary_id", sa.Integer(), nullable=False),
        sa.Column("user_id", sa.Integer(), nullable=False),
        sa.Column("name", sa.String(length=100), nullable=False),
        sa.Column("description", sa.String(length=2000), nullable=True),
        sa.Column("start_date", sa.Date(), nullable=False),
        sa.Column("end_date", sa.Date(), nullable=False),
        sa.ForeignKeyConstraint(["user_id"], ["users.user_id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("itinerary_id"),
    )

    op.create_index(
        op.f("ix_itineraries_user_id"),
        "itineraries",
        ["user_id"],
        unique=False,
    )

    # Travel Posts
    op.create_table(
        "posts",
        sa.Column("post_id", sa.Integer(), nullable=False),
        sa.Column("user_id", sa.Integer(), nullable=False),
        sa.Column("location_id", sa.Integer(), nullable=False),
        sa.Column("caption", sa.String(length=2200), nullable=False),
        sa.Column("media_url", sa.String(length=2048), nullable=True),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.ForeignKeyConstraint(["location_id"], ["locations.location_id"]),
        sa.ForeignKeyConstraint(["user_id"], ["users.user_id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("post_id"),
    )

    op.create_index(
        op.f("ix_posts_location_id"),
        "posts",
        ["location_id"],
        unique=False,
    )
    op.create_index(
        op.f("ix_posts_user_id"),
        "posts",
        ["user_id"],
        unique=False,
    )

    # Safety Reports
    op.create_table(
        "safety_reports",
        sa.Column("report_id", sa.Integer(), nullable=False),
        sa.Column("user_id", sa.Integer(), nullable=False),
        sa.Column("location_id", sa.Integer(), nullable=False),
        sa.Column("report_type", sa.String(length=100), nullable=False),
        sa.Column("description", sa.String(length=2000), nullable=True),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.ForeignKeyConstraint(["location_id"], ["locations.location_id"]),
        sa.ForeignKeyConstraint(["user_id"], ["users.user_id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("report_id"),
    )

    op.create_index(
        op.f("ix_safety_reports_location_id"),
        "safety_reports",
        ["location_id"],
        unique=False,
    )
    op.create_index(
        op.f("ix_safety_reports_user_id"),
        "safety_reports",
        ["user_id"],
        unique=False,
    )

    # Itinerary Destinations
    op.create_table(
        "itinerary_destinations",
        sa.Column("itinerary_id", sa.Integer(), nullable=False),
        sa.Column("location_id", sa.Integer(), nullable=False),
        sa.ForeignKeyConstraint(
            ["itinerary_id"],
            ["itineraries.itinerary_id"],
            ondelete="CASCADE",
        ),
        sa.ForeignKeyConstraint(
            ["location_id"],
            ["locations.location_id"],
            ondelete="CASCADE",
        ),
        sa.PrimaryKeyConstraint("itinerary_id", "location_id"),
    )


def downgrade() -> None:
    """Remove the tables created by this migration."""

    op.drop_table("itinerary_destinations")

    op.drop_index(
        op.f("ix_safety_reports_user_id"),
        table_name="safety_reports",
    )
    op.drop_index(
        op.f("ix_safety_reports_location_id"),
        table_name="safety_reports",
    )
    op.drop_table("safety_reports")

    op.drop_index(
        op.f("ix_posts_user_id"),
        table_name="posts",
    )
    op.drop_index(
        op.f("ix_posts_location_id"),
        table_name="posts",
    )
    op.drop_table("posts")

    op.drop_index(
        op.f("ix_itineraries_user_id"),
        table_name="itineraries",
    )
    op.drop_table("itineraries")

    op.drop_table("locations")
