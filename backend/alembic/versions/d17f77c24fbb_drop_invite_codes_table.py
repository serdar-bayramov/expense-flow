"""drop_invite_codes_table

Revision ID: d17f77c24fbb
Revises: bcc6094025fa
Create Date: 2026-01-27 15:54:19.121477

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


# revision identifiers, used by Alembic.
revision: str = 'd17f77c24fbb'
down_revision: Union[str, Sequence[str], None] = 'bcc6094025fa'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Drop invite_codes table - no longer needed for public launch."""
    op.drop_index(op.f('ix_invite_codes_id'), table_name='invite_codes')
    op.drop_index(op.f('ix_invite_codes_code'), table_name='invite_codes')
    op.drop_table('invite_codes')


def downgrade() -> None:
    """Recreate invite_codes table if needed (rollback)."""
    op.create_table('invite_codes',
        sa.Column('id', sa.INTEGER(), autoincrement=True, nullable=False),
        sa.Column('code', sa.VARCHAR(), autoincrement=False, nullable=False),
        sa.Column('max_uses', sa.INTEGER(), autoincrement=False, nullable=True),
        sa.Column('current_uses', sa.INTEGER(), autoincrement=False, nullable=True),
        sa.Column('expires_at', postgresql.TIMESTAMP(timezone=True), autoincrement=False, nullable=True),
        sa.Column('created_at', postgresql.TIMESTAMP(timezone=True), server_default=sa.text('now()'), autoincrement=False, nullable=True),
        sa.Column('is_active', sa.BOOLEAN(), autoincrement=False, nullable=True),
        sa.PrimaryKeyConstraint('id', name='invite_codes_pkey')
    )
    op.create_index('ix_invite_codes_code', 'invite_codes', ['code'], unique=True)
    op.create_index('ix_invite_codes_id', 'invite_codes', ['id'], unique=False)
