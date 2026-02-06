from sqlalchemy import Column, Integer, String, DateTime, Float, Text, ForeignKey, Enum
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
import enum
from app.core.database import Base

class ReceiptStatus(str, enum.Enum):
    PENDING = "pending"
    PROCESSING = "processing"
    COMPLETED = "completed"
    FAILED = "failed"

class ExpenseCategory(str, enum.Enum):
    """HMRC-compliant expense categories for UK self-employed allowable expenses."""
    OFFICE_COSTS = "Office Costs"  # Stationery, phone bills
    TRAVEL_COSTS = "Travel Costs"  # Fuel, parking, train/bus fares
    CLOTHING = "Clothing"  # Uniforms
    STAFF_COSTS = "Staff Costs"  # Salaries, subcontractor costs
    STOCK_MATERIALS = "Stock and Materials"  # Things you buy to sell on
    FINANCIAL_COSTS = "Financial Costs"  # Insurance, bank charges
    BUSINESS_PREMISES = "Business Premises"  # Heating, lighting, business rates
    ADVERTISING_MARKETING = "Advertising and Marketing"  # Website costs, promotional materials
    TRAINING = "Training and Development"  # Business-related courses
    OTHER = "Other"  # Miscellaneous business expenses

class Receipt(Base):
    __tablename__ = "receipts"
    
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    
    # Image storage
    image_url = Column(String, nullable=False)  # GCS URL
    
    # Extracted data from OCR
    vendor = Column(String, nullable=True)
    date = Column(DateTime(timezone=True), nullable=True)
    
    # Currency handling
    currency = Column(String(3), default="GBP", nullable=False)  # ISO 4217 code (GBP, EUR, USD, etc.)
    original_amount = Column(Float, nullable=True)  # Amount in original currency
    exchange_rate = Column(Float, nullable=True)  # Exchange rate used (to GBP)
    exchange_rate_date = Column(DateTime(timezone=True), nullable=True)  # When rate was fetched
    
    total_amount = Column(Float, nullable=True)  # Always in GBP for analytics/tax
    tax_amount = Column(Float, nullable=True)
    items = Column(Text, nullable=True)  # JSON string or text list
    
    # User categorization
    category = Column(Enum(ExpenseCategory), nullable=True)  # HMRC expense category
    notes = Column(Text, nullable=True)
    is_business = Column(Integer, default=1)  # 1=business, 0=personal
    
    # Processing status
    status = Column(Enum(ReceiptStatus), default=ReceiptStatus.PENDING)
    ocr_raw_text = Column(Text, nullable=True)  # Full OCR output for debugging
    
    # Duplicate detection
    duplicate_suspect = Column(Integer, default=0)  # 0=no, 1=possible duplicate
    duplicate_of_id = Column(Integer, ForeignKey("receipts.id"), nullable=True)  # Reference to original
    duplicate_dismissed = Column(Integer, default=0)  # 0=not reviewed, 1=user confirmed not duplicate
    
    # Timestamps
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())
    deleted_at = Column(DateTime(timezone=True), nullable=True)  # Soft delete
    
    # Relationships
    owner = relationship("User", back_populates="receipts")
    audit_logs = relationship("AuditLog", back_populates="receipt", order_by="AuditLog.timestamp")