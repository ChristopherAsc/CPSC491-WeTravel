"""Enable PostGIS and index existing Location coordinates for nearby queries.

Revision ID: 7a9e5d4c102b
Revises: ff6b866c8309
"""
from alembic import op

revision = "7a9e5d4c102b"
down_revision = "ff6b866c8309"
branch_labels = None
depends_on = None


def upgrade():
    op.execute("CREATE EXTENSION IF NOT EXISTS postgis")
    # Functional index avoids duplicating lat/lon into a second column and
    # automatically reflects changes to existing Location coordinates.
    op.execute("""
        CREATE INDEX IF NOT EXISTS ix_locations_postgis_geography
        ON locations USING gist (
            (ST_SetSRID(ST_MakePoint(longitude, latitude), 4326)::geography)
        )
    """)


def downgrade():
    op.execute("DROP INDEX IF EXISTS ix_locations_postgis_geography")
    # Deliberately preserve PostGIS: other DB objects may use the extension.
