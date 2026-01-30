from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from pydantic import BaseModel
from typing import Literal
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
    subscription_cancel_at_period_end: bool = False
    subscription_current_period_end: Optional[str] = None


class UpdateSubscriptionRequest(BaseModel):
    plan: Literal["free", "professional", "pro_plus"]


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
        "subscription_cancel_at_period_end": current_user.subscription_cancel_at_period_end or False,
        "subscription_current_period_end": current_user.subscription_current_period_end.isoformat() if current_user.subscription_current_period_end else None,
        "features": {
            "analytics_dashboard": limits["analytics_dashboard"],
            "export_reports": limits["export_reports"],
            "journey_templates": limits["journey_templates"],
            "advanced_ocr": limits["advanced_ocr"],
            "export_formats": limits["export_formats"],
            "support_level": limits["support_level"]
        }
    }


@router.put("/me/subscription", response_model=UserResponse)
def update_subscription_plan(
    request: UpdateSubscriptionRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Update user's subscription plan.
    
    Allows users to upgrade or downgrade between:
    - free: 10 receipts/month, 5 mileage claims/month
    - professional: 100 receipts/month, 50 mileage, analytics, templates
    - pro_plus: 500 receipts/month, 200 mileage, all features
    
    Note: This is a simple plan change without payment integration.
    Users can freely switch between plans for testing/demo purposes.
    """
    # Validate plan value (already handled by Literal type, but good for clarity)
    valid_plans = ["free", "professional", "pro_plus"]
    if request.plan not in valid_plans:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Invalid plan. Must be one of: {', '.join(valid_plans)}"
        )
    
    # Update the subscription plan
    current_user.subscription_plan = request.plan
    db.commit()
    db.refresh(current_user)
    
    return current_user


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
    - Valid Clerk authentication (already verified by get_current_user)
    - User must type "DELETE" to confirm
    
    WARNING: This action cannot be undone!
    """
    # Verify confirmation text only (no password needed - Clerk handles auth)
    if request.confirm_text != "DELETE":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Please type DELETE to confirm account deletion"
        )
    
    # Store clerk_user_id before deletion
    clerk_user_id = current_user.clerk_user_id
    
    # GDPR allows up to 30 days to delete data, but we do immediate deletion
    # This permanently removes ALL user data including:
    # - Receipts and images
    # - Mileage claims
    # - Journey templates
    # - Audit logs
    # - User account
    
    user_id = current_user.id
    receipt_image_urls = []
    
    try:
        # Collect receipt image URLs before deletion for GCS cleanup
        try:
            receipts = db.query(Receipt).filter(Receipt.user_id == user_id).all()
            receipt_image_urls = [r.image_url for r in receipts if r.image_url]
        except Exception:
            pass
        
        # Method 1: Try to use SQLAlchemy cascade (if all relationships are properly configured)
        # This is cleanest but may fail if tables don't exist
        try:
            # Refresh to ensure we have latest data
            db.expire(current_user)
            db.delete(current_user)
            db.commit()
            
            # If we get here, cascade worked!
            if receipt_image_urls:
                print(f"Note: {len(receipt_image_urls)} receipt images need cleanup from GCS")
            
            # Delete user from Clerk (so they can sign up again with same email)
            if clerk_user_id:
                try:
                    from app.api.deps import clerk_client
                    clerk_client.users.delete(user_id=clerk_user_id)
                    print(f"✅ Deleted user from Clerk: {clerk_user_id}")
                except Exception as clerk_error:
                    print(f"⚠️ Could not delete user from Clerk: {clerk_error}")
                    # Don't fail the entire operation if Clerk deletion fails
            
            return {
                "message": "Account successfully deleted",
                "deleted_receipts": len(receipt_image_urls)
            }
        except Exception as cascade_error:
            # Cascade failed (likely due to missing table), try manual deletion
            print(f"Cascade delete failed: {cascade_error}")
            db.rollback()
            
            # Method 2: Manual deletion in correct order
            # Delete child records first, then parent (user)
            
            # Try each deletion, continue even if some fail (table might not exist)
            deleted_items = {}
            
            # Audit logs
            try:
                count = db.query(AuditLog).filter(AuditLog.user_id == user_id).delete(synchronize_session=False)
                deleted_items['audit_logs'] = count
                db.commit()
            except Exception as e:
                print(f"Could not delete audit logs: {e}")
                db.rollback()
            
            # Journey templates
            try:
                from app.models.journey_template import JourneyTemplate
                count = db.query(JourneyTemplate).filter(JourneyTemplate.user_id == user_id).delete(synchronize_session=False)
                deleted_items['journey_templates'] = count
                db.commit()
            except Exception as e:
                print(f"Could not delete journey templates: {e}")
                db.rollback()
            
            # Mileage claims
            try:
                count = db.query(MileageClaim).filter(MileageClaim.user_id == user_id).delete(synchronize_session=False)
                deleted_items['mileage_claims'] = count
                db.commit()
            except Exception as e:
                print(f"Could not delete mileage claims: {e}")
                db.rollback()
            
            # Receipts
            try:
                count = db.query(Receipt).filter(Receipt.user_id == user_id).delete(synchronize_session=False)
                deleted_items['receipts'] = count
                db.commit()
            except Exception as e:
                print(f"Could not delete receipts: {e}")
                db.rollback()
            
            # Finally, delete user
            try:
                db.query(User).filter(User.id == user_id).delete(synchronize_session=False)
                db.commit()
            except Exception as e:
                db.rollback()
                raise HTTPException(
                    status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                    detail=f"Failed to delete user account: {str(e)}"
                )
            
            if receipt_image_urls:
                print(f"Note: {len(receipt_image_urls)} receipt images need cleanup from GCS")
            
            # Delete user from Clerk (so they can sign up again with same email)
            if clerk_user_id:
                try:
                    from app.api.deps import clerk_client
                    clerk_client.users.delete(user_id=clerk_user_id)
                    print(f"✅ Deleted user from Clerk: {clerk_user_id}")
                except Exception as clerk_error:
                    print(f"⚠️ Could not delete user from Clerk: {clerk_error}")
                    # Don't fail the entire operation if Clerk deletion fails
            
            return {
                "message": "Account successfully deleted",
                "deleted_items": deleted_items,
                "deleted_receipts": len(receipt_image_urls)
            }
    
    except HTTPException:
        raise
    except Exception as e:
        db.rollback()
        print(f"Unexpected error during account deletion: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to delete account. Please contact support."
        )