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
    total_amount: Optional[float] = None
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
            "total_amount": 49.99,
            "status": "completed",
            "created_at": "2026-01-12T10:00:00Z"
        }
    """
    id: int
    user_id: int
    image_url: str
    status: ReceiptStatus
    ocr_raw_text: Optional[str] = None
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