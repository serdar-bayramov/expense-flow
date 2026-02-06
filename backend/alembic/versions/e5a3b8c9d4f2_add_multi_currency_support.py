"""add multi-currency support

Revision ID: e5a3b8c9d4f2
Revises: d17f77c24fbb
Create Date: 2026-02-06 10:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'e5a3b8c9d4f2'
down_revision: Union[str, Sequence[str], None] = '01944f3c6224'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Add multi-currency fields to receipts table."""
    # Add currency code field (ISO 4217)
    op.add_column('receipts', sa.Column('currency', sa.String(length=3), server_default='GBP', nullable=False))
    
    # Add original amount (in original currency)
    op.add_column('receipts', sa.Column('original_amount', sa.Float(), nullable=True))
    
    # Add exchange rate used for conversion
    op.add_column('receipts', sa.Column('exchange_rate', sa.Float(), nullable=True))
    
    # Add date when exchange rate was fetched
    op.add_column('receipts', sa.Column('exchange_rate_date', sa.DateTime(timezone=True), nullable=True))
    
    # Backfill existing data: set currency to GBP and original_amount = total_amount
    op.execute("""
        UPDATE receipts 
        SET 
            currency = 'GBP',
            original_amount = total_amount,
            exchange_rate = 1.0
        WHERE currency IS NULL
    """)


def downgrade() -> None:
    """Remove multi-currency fields from receipts table."""
    op.drop_column('receipts', 'exchange_rate_date')
    op.drop_column('receipts', 'exchange_rate')
    op.drop_column('receipts', 'original_amount')
    op.drop_column('receipts', 'currency')
