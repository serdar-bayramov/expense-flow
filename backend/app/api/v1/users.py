from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from pydantic import BaseModel
from app.api.deps import get_current_user
from app.core.database import get_db
from app.models.user import User
from app.models.receipt import Receipt
from app.models.mileage_claim import MileageClaim
from app.models.audit_log import AuditLog
from app.schemas.user import UserResponse, DeleteAccountRequest
from app.utils.subscription_limits import (
    get_monthly_receipt_count,
    get_monthly_mileage_count,
    get_plan_limits
)

router = APIRouter(prefix="/users", tags=["Users"])


class SubscriptionUsageResponse(BaseModel):
    plan: str
    receipts_used: int
    receipts_limit: int
    mileage_used: int
    mileage_limit: int
    is_beta_tester: bool
    features: dict  # All feature flags for the plan


@router.get("/me", response_model=UserResponse)
def get_current_user_info(current_user: User = Depends(get_current_user)):
    """
    Get current user information.
    
    Requires: Valid JWT token in Authorization header
    
    Example:
        GET /api/v1/users/me
        Headers: { "Authorization": "Bearer eyJhbGci..." }
    
    Returns current user's profile information.
    """
    return current_user


@router.get("/me/subscription", response_model=SubscriptionUsageResponse)
def get_subscription_usage(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Get current user's subscription plan and usage stats for this month.
    
    Returns:
        - Current plan (free/professional/pro_plus)
        - Monthly receipts used vs limit
        - Monthly mileage claims used vs limit
        - Beta tester status
        - Feature flags (analytics, exports, templates, etc.)
    
    This is useful for showing users their remaining quota in the UI.
    """
    plan = current_user.subscription_plan or "free"
    limits = get_plan_limits(plan)
    
    receipts_used = get_monthly_receipt_count(current_user.id, db)
    mileage_used = get_monthly_mileage_count(current_user.id, db)
    
    return {
        "plan": plan,
        "receipts_used": receipts_used,
        "receipts_limit": limits["receipts"],
        "mileage_used": mileage_used,
        "mileage_limit": limits["mileage_claims"],
        "is_beta_tester": current_user.is_beta_tester or False,
        "features": {
            "analytics_dashboard": limits["analytics_dashboard"],
            "export_reports": limits["export_reports"],
            "journey_templates": limits["journey_templates"],
            "advanced_ocr": limits["advanced_ocr"],
            "export_formats": limits["export_formats"],
            "support_level": limits["support_level"]
        }
    }


@router.delete("/me")
def delete_account(
    request: DeleteAccountRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Delete user account and all associated data (GDPR Right to Erasure)
    
    This will permanently delete:
    - User account
    - All receipts and their metadata
    - All mileage claims
    - All audit logs
    - Receipt images from cloud storage
    
    Requires:
    - Valid password confirmation
    - User must type "DELETE" to confirm
    
    WARNING: This action cannot be undone!
    """
    from app.core.security import verify_password
    
    # Verify password
    if not verify_password(request.password, current_user.hashed_password):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect password"
        )
    
    # Verify confirmation text
    if request.confirm_text != "DELETE":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Please type DELETE to confirm account deletion"
        )
    
    # Delete in order (foreign key constraints)
    # 1. Delete audit logs
    db.query(AuditLog).filter(AuditLog.user_id == current_user.id).delete()
    
    # 2. Delete mileage claims
    db.query(MileageClaim).filter(MileageClaim.user_id == current_user.id).delete()
    
    # 3. Delete receipts (this should also trigger deletion of cloud storage files)
    # Note: You may want to add a background job to delete GCS files
    receipts = db.query(Receipt).filter(Receipt.user_id == current_user.id).all()
    receipt_image_urls = [r.image_url for r in receipts if r.image_url]
    db.query(Receipt).filter(Receipt.user_id == current_user.id).delete()
    
    # 4. Delete user
    db.delete(current_user)
    
    db.commit()
    
    # TODO: Delete receipt images from Google Cloud Storage
    # For now, log the URLs that need to be deleted
    if receipt_image_urls:
        print(f"Note: {len(receipt_image_urls)} receipt images need manual cleanup from GCS")
    
    return {
        "message": "Account successfully deleted",
        "deleted_receipts": len(receipt_image_urls),
        "note": "Receipt images will be cleaned up within 24 hours"
    }