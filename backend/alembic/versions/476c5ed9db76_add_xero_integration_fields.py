"""add_xero_integration_fields

Revision ID: 476c5ed9db76
Revises: d6efe84d82b6
Create Date: 2026-02-14 19:05:38.089503

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '476c5ed9db76'
down_revision: Union[str, Sequence[str], None] = 'd6efe84d82b6'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Add Xero integration fields to users and receipts tables, create xero_sync_logs table."""
    
    # 1. Add Xero connection fields to users table
    op.add_column('users', sa.Column('xero_tenant_id', sa.String(length=255), nullable=True))
    op.add_column('users', sa.Column('xero_org_name', sa.String(length=255), nullable=True))
    op.add_column('users', sa.Column('xero_access_token', sa.Text(), nullable=True))  # Will be encrypted
    op.add_column('users', sa.Column('xero_refresh_token', sa.Text(), nullable=True))  # Will be encrypted
    op.add_column('users', sa.Column('xero_token_expires_at', sa.DateTime(timezone=True), nullable=True))
    op.add_column('users', sa.Column('xero_connected_at', sa.DateTime(timezone=True), nullable=True))
    op.add_column('users', sa.Column('xero_auto_sync', sa.Boolean(), nullable=False, server_default='false'))
    
    # 2. Add Xero sync tracking to receipts table
    op.add_column('receipts', sa.Column('xero_transaction_id', sa.String(length=255), nullable=True))
    op.add_column('receipts', sa.Column('synced_to_xero_at', sa.DateTime(timezone=True), nullable=True))
    
    # 3. Create xero_sync_logs table for tracking sync history
    op.create_table(
        'xero_sync_logs',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('user_id', sa.Integer(), nullable=False),
        sa.Column('receipt_id', sa.Integer(), nullable=True),
        sa.Column('xero_transaction_id', sa.String(length=255), nullable=True),
        sa.Column('sync_status', sa.String(length=50), nullable=False),  # 'success', 'failed', 'pending'
        sa.Column('error_message', sa.Text(), nullable=True),
        sa.Column('synced_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.ForeignKeyConstraint(['user_id'], ['users.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['receipt_id'], ['receipts.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id')
    )
    
    # Add indexes for better query performance
    op.create_index('ix_xero_sync_logs_user_id', 'xero_sync_logs', ['user_id'])
    op.create_index('ix_xero_sync_logs_receipt_id', 'xero_sync_logs', ['receipt_id'])
    op.create_index('ix_xero_sync_logs_status', 'xero_sync_logs', ['sync_status'])


def downgrade() -> None:
    """Remove Xero integration fields and tables."""
    
    # Drop indexes first
    op.drop_index('ix_xero_sync_logs_status', table_name='xero_sync_logs')
    op.drop_index('ix_xero_sync_logs_receipt_id', table_name='xero_sync_logs')
    op.drop_index('ix_xero_sync_logs_user_id', table_name='xero_sync_logs')
    
    # Drop xero_sync_logs table
    op.drop_table('xero_sync_logs')
    
    # Drop Xero fields from receipts table
    op.drop_column('receipts', 'synced_to_xero_at')
    op.drop_column('receipts', 'xero_transaction_id')
    
    # Drop Xero fields from users table
    op.drop_column('users', 'xero_auto_sync')
    op.drop_column('users', 'xero_connected_at')
    op.drop_column('users', 'xero_token_expires_at')
    op.drop_column('users', 'xero_refresh_token')
    op.drop_column('users', 'xero_access_token')
    op.drop_column('users', 'xero_org_name')
    op.drop_column('users', 'xero_tenant_id')
