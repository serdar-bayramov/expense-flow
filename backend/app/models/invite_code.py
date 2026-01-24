from sqlalchemy import Column, Integer, String, DateTime, Boolean
from sqlalchemy.sql import func
from app.core.database import Base

class InviteCode(Base):
    __tablename__ = "invite_codes"
    
    id = Column(Integer, primary_key=True, index=True)
    code = Column(String, unique=True, index=True, nullable=False)
    
    # Usage tracking
    max_uses = Column(Integer, default=1, nullable=False)  # How many times can be used
    used_count = Column(Integer, default=0, nullable=False)  # How many times has been used
    
    # Expiration
    expires_at = Column(DateTime(timezone=True), nullable=True)  # None = never expires
    
    # What this code grants
    grants_plan = Column(String, default="pro_plus", nullable=False)  # Plan given to user
    is_beta_code = Column(Boolean, default=True, nullable=False)  # Is this for beta testing?
    beta_duration_days = Column(Integer, default=30, nullable=True)  # How long beta access lasts
    
    # Metadata
    created_by = Column(Integer, nullable=True)  # User ID who created it (for tracking)
    notes = Column(String, nullable=True)  # E.g., "Sent to Rory", "Twitter campaign"
    
    # Timestamps
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    last_used_at = Column(DateTime(timezone=True), nullable=True)
    
    def is_valid(self):
        """Check if code can still be used"""
        from datetime import datetime, timezone as tz
        
        # Check if used up
        if self.used_count >= self.max_uses:
            return False
        
        # Check if expired
        if self.expires_at and self.expires_at < datetime.now(tz.utc):
            return False
        
        return True
