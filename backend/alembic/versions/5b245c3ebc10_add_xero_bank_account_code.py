"""add_xero_bank_account_code

Revision ID: 5b245c3ebc10
Revises: cacac25a4871
Create Date: 2026-02-16 13:56:47.546656

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '5b245c3ebc10'
down_revision: Union[str, Sequence[str], None] = 'cacac25a4871'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    # Add xero_bank_account_code column to users table
    op.add_column('users', sa.Column('xero_bank_account_code', sa.String(255), nullable=True))


def downgrade() -> None:
    """Downgrade schema."""
    # Remove xero_bank_account_code column from users table
    op.drop_column('users', 'xero_bank_account_code')
