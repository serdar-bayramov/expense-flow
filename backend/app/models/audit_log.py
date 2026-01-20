from sqlalchemy import Column, Integer, String, DateTime, ForeignKey, JSON, Text
from sqlalchemy.orm import relationship
from app.core.database import Base
from datetime import datetime

class AuditLog(Base):
    """
    Audit log for tracking all changes to receipts.
    Provides full audit trail for HMRC compliance and debugging.
    """
    __tablename__ = "audit_logs"
    
    id = Column(Integer, primary_key=True, index=True)
    receipt_id = Column(Integer, ForeignKey("receipts.id", ondelete="SET NULL"), nullable=True, index=True)
    
    # Event details
    event_type = Column(String, nullable=False, index=True)  # 'created', 'status_changed', 'field_updated', 'approved', 'deleted'
    timestamp = Column(DateTime, default=datetime.utcnow, nullable=False, index=True)
    
    # What changed (for field updates)
    field_name = Column(String, nullable=True)  # 'vendor', 'category', 'total_amount', etc.
    old_value = Column(Text, nullable=True)  # Previous value
    new_value = Column(Text, nullable=True)  # New value
    
    # Who/what made the change
    actor = Column(String, nullable=False)  # 'user', 'system:ocr', 'system:email'
    user_id = Column(Integer, ForeignKey("users.id"), nullable=True)
    
    # Additional context (optional)
    extra_data = Column(JSON, nullable=True)  # Extra info like OCR confidence, source, etc.
    
    # Relationships
    receipt = relationship("Receipt", back_populates="audit_logs")
    user = relationship("User")
