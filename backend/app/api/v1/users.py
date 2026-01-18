from fastapi import APIRouter, Depends
from app.api.deps import get_current_user
from app.models.user import User
from app.schemas.user import UserResponse

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