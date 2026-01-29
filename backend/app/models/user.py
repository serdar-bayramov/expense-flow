from sqlalchemy import Column, Integer, String, DateTime, Boolean
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from app.core.database import Base

class User(Base):
    __tablename__ = "users"
    
    id = Column(Integer, primary_key=True, index=True)
    clerk_user_id = Column(String, unique=True, index=True, nullable=True)  # Clerk authentication ID
    email = Column(String, unique=True, index=True, nullable=False)
    hashed_password = Column(String, nullable=True)  # Nullable for Clerk migration (will be removed later)
    
    # Unique email for forwarding receipts (e.g., sarah-x8k2@receipts.xpense.com)
    unique_receipt_email = Column(String, unique=True, index=True, nullable=False)
    
    # User details
    full_name = Column(String, nullable=True)
    is_active = Column(Boolean, default=True)
    
    # Subscription & Plan Management
    subscription_plan = Column(String, default="free", nullable=False)  # free, professional, pro_plus
    stripe_customer_id = Column(String, unique=True, nullable=True, index=True)
    stripe_subscription_id = Column(String, unique=True, nullable=True, index=True)
    subscription_status = Column(String, default="active", nullable=False)  # active, cancelled, expired, past_due
    subscription_current_period_end = Column(DateTime(timezone=True), nullable=True)  # When current billing period ends
    subscription_cancel_at_period_end = Column(Boolean, default=False, nullable=False)  # If subscription is set to cancel
    
    # Beta Testing
    is_beta_tester = Column(Boolean, default=False, nullable=False)
    beta_expires_at = Column(DateTime(timezone=True), nullable=True)
    
    # Timestamps
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())
    
    # Relationships
    receipts = relationship("Receipt", back_populates="owner", cascade="all, delete-orphan")
    mileage_claims = relationship("MileageClaim", back_populates="owner", cascade="all, delete-orphan")
    journey_templates = relationship("JourneyTemplate", back_populates="owner", cascade="all, delete-orphan")