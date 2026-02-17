"""add_xero_oauth_state_to_users

Revision ID: cacac25a4871
Revises: 476c5ed9db76
Create Date: 2026-02-15 16:52:21.402748

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'cacac25a4871'
down_revision: Union[str, Sequence[str], None] = '476c5ed9db76'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Add xero_oauth_state column to users table for OAuth state verification."""
    op.add_column('users', sa.Column('xero_oauth_state', sa.String(length=255), nullable=True))


def downgrade() -> None:
    """Remove xero_oauth_state column from users table."""
    op.drop_column('users', 'xero_oauth_state')
