"""add_processed_emails_table

Revision ID: bcc6094025fa
Revises: 29672f48c359
Create Date: 2026-01-27 13:11:43.851792

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'bcc6094025fa'
down_revision: Union[str, Sequence[str], None] = '29672f48c359'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    op.create_table(
        'processed_emails',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('email_hash', sa.String(), nullable=False),
        sa.Column('processed_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.Column('to_email', sa.String(), nullable=True),
        sa.Column('from_email', sa.String(), nullable=True),
        sa.Column('subject', sa.String(), nullable=True),
        sa.Column('attachment_count', sa.Integer(), nullable=True),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index('ix_processed_emails_email_hash', 'processed_emails', ['email_hash'], unique=True)
    op.create_index('ix_processed_emails_id', 'processed_emails', ['id'], unique=False)
    op.create_index('ix_processed_emails_processed_at', 'processed_emails', ['processed_at'], unique=False)


def downgrade() -> None:
    """Downgrade schema."""
    op.drop_index('ix_processed_emails_processed_at', table_name='processed_emails')
    op.drop_index('ix_processed_emails_id', table_name='processed_emails')
    op.drop_index('ix_processed_emails_email_hash', table_name='processed_emails')
    op.drop_table('processed_emails')
