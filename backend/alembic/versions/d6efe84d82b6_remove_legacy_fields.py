"""remove_legacy_fields

Revision ID: d6efe84d82b6
Revises: e5a3b8c9d4f2
Create Date: 2026-02-13 13:44:04.834056

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'd6efe84d82b6'
down_revision: Union[str, Sequence[str], None] = 'e5a3b8c9d4f2'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Remove legacy authentication and beta tester fields."""
    # Drop legacy password field (replaced by Clerk authentication)
    op.drop_column('users', 'hashed_password')
    
    # Drop beta tester fields (everyone is beta now, no tracking needed)
    op.drop_column('users', 'is_beta_tester')
    op.drop_column('users', 'beta_expires_at')


def downgrade() -> None:
    """Restore legacy fields if needed."""
    # Restore hashed_password (nullable for backwards compatibility)
    op.add_column('users', sa.Column('hashed_password', sa.String(), nullable=True))
    
    # Restore beta tester fields
    op.add_column('users', sa.Column('is_beta_tester', sa.Boolean(), nullable=False, server_default='false'))
    op.add_column('users', sa.Column('beta_expires_at', sa.DateTime(timezone=True), nullable=True))
