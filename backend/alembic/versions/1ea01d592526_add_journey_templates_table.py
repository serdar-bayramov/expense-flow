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
    # Ensure vehicletype enum exists (should be created by mileage_claims migration)
    op.execute("""
        DO $$ 
        BEGIN
            IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'vehicletype') THEN
                CREATE TYPE vehicletype AS ENUM ('CAR', 'MOTORCYCLE', 'BICYCLE');
            END IF;
        END $$;
    """)
    
    # Check if table already exists
    op.execute("""
        DO $$ 
        BEGIN
            IF NOT EXISTS (
                SELECT FROM information_schema.tables 
                WHERE table_name = 'journey_templates'
            ) THEN
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
                );
            END IF;
        END $$;
    """)
    
    # Create index if it doesn't exist
    op.execute("""
        CREATE INDEX IF NOT EXISTS ix_journey_templates_user_id 
        ON journey_templates (user_id);
    """)


def downgrade() -> None:
    """Downgrade schema."""
    op.execute("DROP INDEX IF EXISTS ix_journey_templates_user_id;")
    op.execute("DROP TABLE IF EXISTS journey_templates;")
