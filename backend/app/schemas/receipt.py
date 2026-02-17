from pydantic import BaseModel, Field
from typing import Optional
from datetime import datetime
from app.models.receipt import ReceiptStatus, ExpenseCategory


class ReceiptBase(BaseModel):
    """
    Base receipt fields shared across schemas.
    """
    vendor: Optional[str] = None
    date: Optional[datetime] = None
    
    # Currency fields
    currency: Optional[str] = "GBP"  # ISO 4217 code
    original_amount: Optional[float] = None  # Amount in original currency
    exchange_rate: Optional[float] = None  # Conversion rate to GBP
    exchange_rate_date: Optional[datetime] = None  # When rate was fetched
    
    total_amount: Optional[float] = None  # Always in GBP
    tax_amount: Optional[float] = None
    items: Optional[str] = None
    category: Optional[ExpenseCategory] = None
    notes: Optional[str] = None
    is_business: int = 1  # 1 = business, 0 = personal


class ReceiptCreate(ReceiptBase):
    """
    Schema for creating a receipt (upload endpoint).
    Only image_url is required initially, rest comes from OCR later.
    
    Example:
        {
            "image_url": "https://storage.googleapis.com/receipts/abc123.jpg"
        }
    """
    image_url: str = Field(..., description="URL to uploaded receipt image")


class ReceiptUpdate(ReceiptBase):
    """
    Schema for updating receipt details.
    User can edit any field after OCR extraction.
    
    Example:
        {
            "vendor": "Amazon",
            "total_amount": 49.99,
            "category": "Office Supplies",
            "notes": "Keyboard for home office"
        }
    """
    pass  # All fields from ReceiptBase are optional


class ReceiptResponse(ReceiptBase):
    """
    Schema for receipt responses.
    What frontend receives when fetching receipts.
    
    Example:
        {
            "id": 1,
            "user_id": 1,
            "image_url": "https://...",
            "vendor": "Amazon",
            "currency": "EUR",
            "original_amount": 50.00,
            "exchange_rate": 0.85,
            "total_amount": 42.50,
            "status": "completed",
            "duplicate_suspect": 0,
            "duplicate_of_id": null,
            "duplicate_dismissed": 0,
            "created_at": "2026-01-12T10:00:00Z"
        }
    """
    id: int
    user_id: int
    image_url: str
    status: ReceiptStatus
    ocr_raw_text: Optional[str] = None
    duplicate_suspect: int = 0
    duplicate_of_id: Optional[int] = None
    duplicate_dismissed: int = 0
    xero_transaction_id: Optional[str] = None  # Xero BankTransactionID
    synced_to_xero_at: Optional[datetime] = None  # When synced to Xero
    created_at: datetime
    updated_at: Optional[datetime] = None
    
    class Config:
        from_attributes = True  # Allows converting from SQLAlchemy model


class ReceiptUpload(BaseModel):
    """
    Schema for initial file upload response.
    Returns temporary storage info before creating receipt record.
    """
    filename: str
    url: str
    size: int