"""Create the friendship request lifecycle table.

Revision ID: da4f6c2b55a1
Revises: 7a88b43c8a8a
"""

import sqlalchemy as sa
from alembic import op

revision = "da4f6c2b55a1"
down_revision = "7a88b43c8a8a"
branch_labels = None
depends_on = None


def upgrade():
    op.create_table(
        "friend_requests",
        sa.Column("request_id", sa.Integer(), primary_key=True),
        sa.Column(
            "sender_id",
            sa.Integer(),
            sa.ForeignKey("users.user_id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column(
            "recipient_id",
            sa.Integer(),
            sa.ForeignKey("users.user_id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("status", sa.String(16), nullable=False, server_default="pending"),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.func.now(),
        ),
        sa.UniqueConstraint(
            "sender_id", "recipient_id", name="uq_friend_request_direction"
        ),
        sa.CheckConstraint(
            "sender_id <> recipient_id", name="ck_friend_request_no_self"
        ),
        sa.CheckConstraint(
            "status IN ('pending', 'accepted', 'declined')",
            name="ck_friend_request_status",
        ),
    )
    op.create_index("ix_friend_requests_sender_id", "friend_requests", ["sender_id"])
    op.create_index(
        "ix_friend_requests_recipient_id", "friend_requests", ["recipient_id"]
    )


def downgrade():
    op.drop_index("ix_friend_requests_recipient_id", table_name="friend_requests")
    op.drop_index("ix_friend_requests_sender_id", table_name="friend_requests")
    op.drop_table("friend_requests")
