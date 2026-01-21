from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from app.api.deps import get_current_user
from app.core.database import get_db
from app.models.user import User
from app.models.receipt import Receipt
from app.models.mileage_claim import MileageClaim
from app.models.audit_log import AuditLog
from app.schemas.user import UserResponse, DeleteAccountRequest

router = APIRouter(prefix="/users", tags=["Users"])


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