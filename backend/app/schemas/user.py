from pydantic import BaseModel, EmailStr, Field
from typing import Optional
from datetime import datetime


class UserBase(BaseModel):
    email: EmailStr
    full_name: Optional[str] = None


class UserCreate(UserBase):
    password: str = Field(..., min_length=8)
    invite_code: Optional[str] = None  # Optional for now, will be required in beta mode
    # Field(...) means required


class UserResponse(UserBase):
    id: int
    unique_receipt_email: str
    is_active: bool
    subscription_plan: Optional[str] = "free"
    is_beta_tester: Optional[bool] = False
    created_at: datetime

    class Config:
        from_attributes = True # Allows converting SQLAlchemy models to Pydantic


class Token(BaseModel):
    """
    Schema for JWT token response after login.
    """
    access_token: str
    token_type: str = "bearer"


class TokenData(BaseModel):
    """
    Schema for data extracted from JWT token.
    Used internally to pass user_id around.
    """
    user_id: Optional[int] = None


class DeleteAccountRequest(BaseModel):
    """Request to delete account with password confirmation (GDPR)"""
    password: str
    confirm_text: str  # User must type "DELETE" to confirm
