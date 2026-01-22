"""add_journey_templates_table

Revision ID: 1ea01d592526
Revises: 9b984a6823ef
Create Date: 2026-01-22 00:09:34.699618

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '1ea01d592526'
down_revision: Union[str, Sequence[str], None] = '9b984a6823ef'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    # Create table using raw SQL to avoid enum recreation issues
    op.execute("""
        CREATE TABLE journey_templates (
            id UUID PRIMARY KEY,
            user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
            name VARCHAR(200) NOT NULL,
            start_location TEXT NOT NULL,
            end_location TEXT NOT NULL,
            vehicle_type vehicletype NOT NULL,
            business_purpose TEXT NOT NULL,
            is_round_trip BOOLEAN NOT NULL DEFAULT false,
            created_at TIMESTAMP WITH TIME ZONE NOT NULL,
            updated_at TIMESTAMP WITH TIME ZONE NOT NULL
        )
    """)
    op.create_index('ix_journey_templates_user_id', 'journey_templates', ['user_id'])


def downgrade() -> None:
    """Downgrade schema."""
    op.drop_index('ix_journey_templates_user_id', 'journey_templates')
    op.drop_table('journey_templates')
