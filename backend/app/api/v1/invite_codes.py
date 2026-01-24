from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List
from datetime import datetime, timedelta, timezone
import secrets
import string

from app.api.deps import get_db, get_current_user
from app.models.user import User
from app.models.invite_code import InviteCode
from pydantic import BaseModel

router = APIRouter()


# Pydantic schemas
class InviteCodeCreate(BaseModel):
    max_uses: int = 1
    expires_in_days: int | None = 30
    grants_plan: str = "pro_plus"
    is_beta_code: bool = True
    beta_duration_days: int = 30
    notes: str | None = None


class InviteCodeResponse(BaseModel):
    id: int
    code: str
    max_uses: int
    used_count: int
    expires_at: datetime | None
    grants_plan: str
    is_beta_code: bool
    notes: str | None
    created_at: datetime
    
    class Config:
        from_attributes = True


class InviteCodeValidation(BaseModel):
    code: str


class InviteCodeValidationResponse(BaseModel):
    valid: bool
    message: str
    grants_plan: str | None = None
    is_beta_code: bool | None = None


def generate_code() -> str:
    """Generate a random invite code like BETA-XK8P-2M9L"""
    chars = string.ascii_uppercase + string.digits
    part1 = ''.join(secrets.choice(chars) for _ in range(4))
    part2 = ''.join(secrets.choice(chars) for _ in range(4))
    return f"BETA-{part1}-{part2}"


@router.post("/generate", response_model=InviteCodeResponse)
async def generate_invite_code(
    data: InviteCodeCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Generate a new invite code. (Admin only - for now, any authenticated user)
    
    In production, you should add proper admin role checking.
    """
    # Generate unique code
    code = generate_code()
    while db.query(InviteCode).filter(InviteCode.code == code).first():
        code = generate_code()  # Regenerate if collision (very rare)
    
    # Calculate expiration
    expires_at = None
    if data.expires_in_days:
        expires_at = datetime.now(timezone.utc) + timedelta(days=data.expires_in_days)
    
    # Create invite code
    invite = InviteCode(
        code=code,
        max_uses=data.max_uses,
        expires_at=expires_at,
        grants_plan=data.grants_plan,
        is_beta_code=data.is_beta_code,
        beta_duration_days=data.beta_duration_days,
        created_by=current_user.id,
        notes=data.notes
    )
    
    db.add(invite)
    db.commit()
    db.refresh(invite)
    
    return invite


@router.post("/validate", response_model=InviteCodeValidationResponse)
async def validate_invite_code(
    data: InviteCodeValidation,
    db: Session = Depends(get_db)
):
    """
    Validate an invite code (public endpoint - used during signup)
    """
    invite = db.query(InviteCode).filter(InviteCode.code == data.code.strip().upper()).first()
    
    if not invite:
        return InviteCodeValidationResponse(
            valid=False,
            message="Invalid invite code"
        )
    
    if not invite.is_valid():
        # Determine why it's invalid
        if invite.used_count >= invite.max_uses:
            message = "This invite code has already been used"
        elif invite.expires_at and invite.expires_at < datetime.now(timezone.utc):
            message = "This invite code has expired"
        else:
            message = "This invite code is no longer valid"
        
        return InviteCodeValidationResponse(
            valid=False,
            message=message
        )
    
    return InviteCodeValidationResponse(
        valid=True,
        message="Valid invite code",
        grants_plan=invite.grants_plan,
        is_beta_code=invite.is_beta_code
    )


@router.get("/my-codes", response_model=List[InviteCodeResponse])
async def get_my_codes(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Get all invite codes created by current user
    """
    codes = db.query(InviteCode).filter(InviteCode.created_by == current_user.id).all()
    
    response = []
    for code in codes:
        code_data = InviteCodeResponse.model_validate(code)
        code_data.is_valid = code.is_valid()
        response.append(code_data)
    
    return response


@router.get("/all", response_model=List[InviteCodeResponse])
async def get_all_codes(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Get all invite codes (Admin only)
    
    For now, any authenticated user can see all codes.
    In production, add admin role check.
    """
    codes = db.query(InviteCode).order_by(InviteCode.created_at.desc()).all()
    
    response = []
    for code in codes:
        code_data = InviteCodeResponse.model_validate(code)
        code_data.is_valid = code.is_valid()
        response.append(code_data)
    
    return response
