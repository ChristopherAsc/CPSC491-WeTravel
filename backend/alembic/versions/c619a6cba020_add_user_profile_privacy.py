"""Add public/private user profile setting.

Revision ID: c619a6cba020
Revises: da4f6c2b55a1
"""
from alembic import op
import sqlalchemy as sa

revision = "c619a6cba020"
down_revision = "da4f6c2b55a1"
branch_labels = None
depends_on = None


def upgrade():
    op.add_column("users", sa.Column("is_private", sa.Boolean(), nullable=False, server_default=sa.false()))


def downgrade():
    op.drop_column("users", "is_private")
