from sqlalchemy import Column, Integer, String, DateTime, Boolean
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from app.core.database import Base

class User(Base):
    __tablename__ = "users"
    
    id = Column(Integer, primary_key=True, index=True)
    email = Column(String, unique=True, index=True, nullable=False)
    hashed_password = Column(String, nullable=False)
    
    # Unique email for forwarding receipts (e.g., sarah-x8k2@receipts.xpense.com)
    unique_receipt_email = Column(String, unique=True, index=True, nullable=False)
    
    # User details
    full_name = Column(String, nullable=True)
    is_active = Column(Boolean, default=True)
    
    # Timestamps
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())
    
    # Relationships
    receipts = relationship("Receipt", back_populates="owner", cascade="all, delete-orphan")
    mileage_claims = relationship("MileageClaim", back_populates="owner", cascade="all, delete-orphan")