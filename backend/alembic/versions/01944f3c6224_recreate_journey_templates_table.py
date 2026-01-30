"""recreate_journey_templates_table

Revision ID: 01944f3c6224
Revises: c8a88100c2ca
Create Date: 2026-01-30 09:45:17.301795

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import UUID, ENUM


# revision identifiers, used by Alembic.
revision: str = '01944f3c6224'
down_revision: Union[str, Sequence[str], None] = 'c8a88100c2ca'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Recreate journey_templates table that was accidentally dropped by previous migrations."""
    
    # Check if table exists first
    conn = op.get_bind()
    inspector = sa.inspect(conn)
    
    if 'journey_templates' not in inspector.get_table_names():
        # Create VehicleType enum if it doesn't exist
        vehicle_type_enum = ENUM('CAR', 'MOTORCYCLE', 'BICYCLE', name='vehicletype', create_type=False)
        vehicle_type_enum.create(conn, checkfirst=True)
        
        # Create journey_templates table
        op.create_table(
            'journey_templates',
            sa.Column('id', UUID(as_uuid=True), primary_key=True),
            sa.Column('user_id', sa.Integer(), nullable=False),
            sa.Column('name', sa.String(length=200), nullable=False),
            sa.Column('start_location', sa.Text(), nullable=False),
            sa.Column('end_location', sa.Text(), nullable=False),
            sa.Column('vehicle_type', vehicle_type_enum, nullable=False),
            sa.Column('business_purpose', sa.Text(), nullable=False),
            sa.Column('is_round_trip', sa.Boolean(), nullable=False, server_default='false'),
            sa.Column('created_at', sa.DateTime(timezone=True), nullable=False),
            sa.Column('updated_at', sa.DateTime(timezone=True), nullable=False),
            sa.ForeignKeyConstraint(['user_id'], ['users.id'], ondelete='CASCADE'),
        )
        
        # Create index
        op.create_index('ix_journey_templates_user_id', 'journey_templates', ['user_id'])


def downgrade() -> None:
    """Downgrade schema."""
    op.drop_index('ix_journey_templates_user_id', table_name='journey_templates')
    op.drop_table('journey_templates')

