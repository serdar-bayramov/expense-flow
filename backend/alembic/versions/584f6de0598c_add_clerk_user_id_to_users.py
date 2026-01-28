"""add_clerk_user_id_to_users

Revision ID: 584f6de0598c
Revises: d17f77c24fbb
Create Date: 2026-01-27 22:49:50.491425

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '584f6de0598c'
down_revision: Union[str, Sequence[str], None] = 'd17f77c24fbb'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    # Add clerk_user_id column to users table
    op.add_column('users', sa.Column('clerk_user_id', sa.String(), nullable=True))
    op.create_index('ix_users_clerk_user_id', 'users', ['clerk_user_id'], unique=True)
    
    # Make hashed_password nullable for Clerk migration
    op.alter_column('users', 'hashed_password', nullable=True)


def downgrade() -> None:
    """Downgrade schema."""
    # Remove clerk_user_id column
    op.drop_index('ix_users_clerk_user_id', table_name='users')
    op.drop_column('users', 'clerk_user_id')
    
    # Make hashed_password not nullable again
    op.alter_column('users', 'hashed_password', nullable=False)
