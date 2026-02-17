"""
Xero Sync Log Model

Tracks the history of receipt syncs to Xero for debugging and audit purposes.
"""

from sqlalchemy import Column, Integer, String, Text, DateTime, ForeignKey
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from app.core.database import Base


class XeroSyncLog(Base):
    """
    Record of each attempt to sync a receipt to Xero.
    
    Useful for:
    - Debugging sync failures
    - Audit trail of what was sent to Xero
    - Re-syncing failed receipts
    - Showing user sync history
    """
    __tablename__ = "xero_sync_logs"
    
    id = Column(Integer, primary_key=True, index=True)
    
    # Which user and receipt
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    receipt_id = Column(Integer, ForeignKey("receipts.id", ondelete="CASCADE"), nullable=True, index=True)
    
    # Xero transaction details
    xero_transaction_id = Column(String(255), nullable=True)  # UUID from Xero on success
    
    # Sync status
    sync_status = Column(String(50), nullable=False, index=True)  # 'success', 'failed', 'pending'
    error_message = Column(Text, nullable=True)  # Error details if sync_status = 'failed'
    
    # Timestamp
    synced_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    
    # Relationships
    user = relationship("User", backref="xero_sync_logs")
    receipt = relationship("Receipt", backref="xero_sync_logs")
    
    def __repr__(self):
        return f"<XeroSyncLog(id={self.id}, receipt_id={self.receipt_id}, status={self.sync_status})>"
