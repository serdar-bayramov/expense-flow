from sqlalchemy import Column, Integer, String, DateTime, Index
from sqlalchemy.sql import func
from app.core.database import Base

class ProcessedEmail(Base):
    """
    Track processed emails to prevent duplicates.
    Persists across server restarts unlike in-memory cache.
    """
    __tablename__ = "processed_emails"
    
    id = Column(Integer, primary_key=True, index=True)
    email_hash = Column(String, unique=True, nullable=False, index=True)
    processed_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    
    # Store email details for debugging
    to_email = Column(String, nullable=True)
    from_email = Column(String, nullable=True)
    subject = Column(String, nullable=True)
    attachment_count = Column(Integer, nullable=True)
    
    # Index for cleanup queries (remove old entries)
    __table_args__ = (
        Index('ix_processed_emails_processed_at', 'processed_at'),
    )
