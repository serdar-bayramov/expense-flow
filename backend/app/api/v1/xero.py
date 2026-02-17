"""
Xero Integration API Endpoints

These endpoints handle the complete Xero OAuth flow and syncing:
- /connect: Start OAuth authorization
- /callback: Handle OAuth callback from Xero
- /disconnect: Remove Xero connection
- /status: Check connection status
- /sync/{receipt_id}: Manually sync a receipt to Xero
"""

from datetime import datetime, timedelta, timezone
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query, Request
from fastapi.responses import RedirectResponse
from sqlalchemy.orm import Session

from app.api.deps import get_current_user
from app.core.database import get_db, settings
from app.models.user import User
from app.models.receipt import Receipt, ReceiptStatus
from app.models.xero_sync_log import XeroSyncLog
from app.services import xero_service


router = APIRouter(prefix="/xero", tags=["xero"])


# ============================================================================
# ENDPOINT 1: START OAUTH FLOW
# ============================================================================

@router.get("/connect")
async def connect_to_xero(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Get Xero OAuth authorization URL.
    
    Flow:
    1. User clicks "Connect to Xero" button in frontend
    2. Frontend calls this endpoint: GET /api/v1/xero/connect (with auth token)
    3. We generate authorization URL with state parameter
    4. We store state in user's session/database for verification in callback
    5. Frontend redirects user's browser to the authorization URL
    6. User logs into Xero and authorizes our app
    7. Xero redirects back to /callback endpoint
    
    Why return URL instead of redirect?
    - Browser redirects can't include Authorization headers
    - Frontend needs to handle the redirect after getting the URL
    - This allows proper authentication flow
    
    Security:
    - State parameter prevents CSRF attacks
    - We store state with user_id for verification in callback
    - Without state verification, attackers could inject fake callbacks
    
    Returns:
        dict: {
            "authorization_url": "https://login.xero.com/...",
            "state": "random_string"
        }
    """
    # Generate the authorization URL and state
    authorization_url, state = xero_service.generate_authorization_url()
    
    # Store state in database temporarily (we'll verify in callback)
    # Using a simple approach: store in user record
    # Alternative: Use Redis or separate oauth_states table
    current_user.xero_oauth_state = state
    db.commit()
    
    return {
        "authorization_url": authorization_url,
        "state": state,
    }


# ============================================================================
# ENDPOINT 2: HANDLE OAUTH CALLBACK
# ============================================================================

@router.get("/callback")
async def xero_callback(
    request: Request,
    code: Optional[str] = Query(None),
    state: Optional[str] = Query(None),
    error: Optional[str] = Query(None),
    db: Session = Depends(get_db),
):
    """
    Handle OAuth callback from Xero.
    
    After user authorizes on Xero, they're redirected here with:
    - Success: ?code=abc123&state=xyz789
    - Error: ?error=access_denied&error_description=User+denied
    
    Flow:
    1. User authorized on Xero
    2. Xero redirects to: http://localhost:8000/api/v1/xero/callback?code=...&state=...
    3. We look up the user by state parameter (stored in database)
    4. We verify state matches what we stored for that user
    5. We exchange code for access_token and refresh_token
    6. We get the connected Xero organization (tenant_id)
    7. We encrypt and save tokens to database
    8. We redirect user back to frontend settings page with success message
    
    Security checks:
    - Verify state parameter (CSRF protection)
    - Verify code is present and valid
    - Handle errors gracefully
    
    What we save:
    - xero_tenant_id: Organization ID (needed for API calls)
    - xero_org_name: Organization name (show to user)
    - xero_access_token: Encrypted access token (30 min expiry)
    - xero_refresh_token: Encrypted refresh token (60 day expiry)
    - xero_token_expires_at: When to refresh
    - xero_connected_at: Timestamp for audit
    
    Args:
        code: Authorization code from Xero (used once to get tokens)
        state: State parameter for CSRF protection
        error: Error code if user denied or error occurred
        
    Returns:
        RedirectResponse: Redirects to frontend settings page with status
    """
    # Check if user denied authorization
    if error:
        error_description = request.query_params.get("error_description", "Unknown error")
        # Redirect to frontend with error message
        return RedirectResponse(
            url=f"{settings.FRONTEND_URL}/dashboard/settings?xero_error={error}&message={error_description}"
        )
    
    # Verify we got the code
    if not code:
        return RedirectResponse(
            url=f"{settings.FRONTEND_URL}/dashboard/settings?xero_error=missing_code&message=No authorization code received"
        )
    
    # Verify state parameter exists
    if not state:
        return RedirectResponse(
            url=f"{settings.FRONTEND_URL}/dashboard/settings?xero_error=missing_state&message=Security verification failed"
        )
    
    # Look up user by state parameter (CSRF protection)
    user = db.query(User).filter(User.xero_oauth_state == state).first()
    if not user:
        return RedirectResponse(
            url=f"{settings.FRONTEND_URL}/dashboard/settings?xero_error=invalid_state&message=Security verification failed or session expired"
        )
    
    try:
        # Step 1: Exchange code for tokens
        token_data = xero_service.exchange_code_for_tokens(code)
        
        # Step 2: Get connected Xero organizations
        access_token = token_data["access_token"]
        connections = xero_service.get_xero_connections(access_token)
        
        if not connections:
            return RedirectResponse(
                url=f"{settings.FRONTEND_URL}/dashboard/settings?xero_error=no_organizations&message=No Xero organizations connected"
            )
        
        # Use first organization (most users have only one)
        # Could be enhanced later to let users choose if multiple orgs
        connection = connections[0]
        tenant_id = connection["tenantId"]
        tenant_name = connection["tenantName"]
        
        # Step 3: Encrypt and save tokens to database
        user.xero_tenant_id = tenant_id
        user.xero_org_name = tenant_name
        user.xero_access_token = xero_service.encrypt_token(access_token)
        user.xero_refresh_token = xero_service.encrypt_token(token_data["refresh_token"])
        user.xero_token_expires_at = datetime.now(timezone.utc) + timedelta(seconds=token_data["expires_in"])
        user.xero_connected_at = datetime.now(timezone.utc)
        user.xero_auto_sync = True  # Enable auto-sync by default
        user.xero_oauth_state = None  # Clear state (one-time use)
        
        db.commit()
        
        # Redirect to settings page with success message
        return RedirectResponse(
            url=f"{settings.FRONTEND_URL}/dashboard/settings?xero_success=true&org_name={tenant_name}"
        )
        
    except Exception as e:
        # Log error and redirect with error message
        print(f"Xero OAuth callback error for user {user.id}: {e}")
        return RedirectResponse(
            url=f"{settings.FRONTEND_URL}/dashboard/settings?xero_error=token_exchange&message={str(e)}"
        )


# ============================================================================
# ENDPOINT 3: DISCONNECT XERO
# ============================================================================

@router.post("/disconnect")
async def disconnect_xero(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Disconnect user's Xero integration.
    
    What happens:
    1. Revoke tokens with Xero (invalidate them on Xero's side)
    2. Clear all Xero data from user record
    3. Receipts remain in our database (just no longer synced)
    
    When called:
    - User clicks "Disconnect Xero" button in settings
    - User wants to switch to different Xero organization
    - User no longer wants Xero integration
    
    Note: Receipts already synced remain in Xero.
    This just stops future syncing and removes the connection.
    
    Returns:
        dict: Success message
        
    Raises:
        HTTPException: If user not connected or disconnection fails
    """
    if not current_user.xero_tenant_id:
        raise HTTPException(
            status_code=400,
            detail="Not connected to Xero"
        )
    
    success = xero_service.disconnect_xero(db, current_user)
    
    if not success:
        raise HTTPException(
            status_code=500,
            detail="Failed to disconnect from Xero"
        )
    
    return {
        "success": True,
        "message": "Successfully disconnected from Xero"
    }


# ============================================================================
# ENDPOINT 4: CHECK CONNECTION STATUS
# ============================================================================

@router.get("/status")
async def get_xero_status(
    current_user: User = Depends(get_current_user),
):
    """
    Check user's Xero connection status.
    
    Used by frontend to:
    - Show/hide "Connect to Xero" button
    - Display connected organization name
    - Show auto-sync toggle state
    - Display connection timestamp
    
    Returns info:
    - connected: Boolean
    - org_name: Organization name (if connected)
    - connected_at: When connected (ISO datetime)
    - auto_sync: Whether auto-sync is enabled
    - token_expires_at: When access token expires (for debugging)
    
    Note: We don't return actual tokens (security)
    
    Returns:
        dict: Connection status and metadata
    """
    if not current_user.xero_tenant_id:
        return {
            "connected": False,
            "org_name": None,
            "connected_at": None,
            "auto_sync": False,
        }
    
    return {
        "connected": True,
        "org_name": current_user.xero_org_name,
        "tenant_id": current_user.xero_tenant_id,
        "connected_at": current_user.xero_connected_at.isoformat() if current_user.xero_connected_at else None,
        "auto_sync": current_user.xero_auto_sync,
        "token_expires_at": current_user.xero_token_expires_at.isoformat() if current_user.xero_token_expires_at else None,
    }


# ============================================================================
# ENDPOINT 5: TOGGLE AUTO-SYNC
# ============================================================================

@router.post("/auto-sync")
async def toggle_auto_sync(
    enabled: bool,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Enable or disable automatic syncing to Xero.
    
    Auto-sync behavior:
    - Enabled: When receipt status changes to COMPLETED, automatically sync to Xero
    - Disabled: User must manually click "Sync to Xero" button for each receipt
    
    This is a user preference - some users want control over what syncs.
    
    Args:
        enabled: True to enable auto-sync, False to disable
        
    Returns:
        dict: Updated status
        
    Raises:
        HTTPException: If not connected to Xero
    """
    if not current_user.xero_tenant_id:
        raise HTTPException(
            status_code=400,
            detail="Not connected to Xero"
        )
    
    current_user.xero_auto_sync = enabled
    db.commit()
    
    return {
        "success": True,
        "auto_sync": enabled,
        "message": f"Auto-sync {'enabled' if enabled else 'disabled'}"
    }


# ============================================================================
# ENDPOINT 6: MANUAL SYNC RECEIPT (PLACEHOLDER)
# ============================================================================

@router.post("/sync/{receipt_id}")
async def sync_receipt_to_xero(
    receipt_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Manually sync a single receipt to Xero.
    
    Flow (we'll implement full logic in Step 5):
    1. Verify user owns the receipt
    2. Verify user is connected to Xero
    3. Get valid access token (auto-refresh if needed)
    4. Create bank transaction in Xero
    5. Attach receipt image to transaction
    6. Update receipt with xero_transaction_id
    7. Create sync log entry
    
    This endpoint is:
    - Called when user clicks "Sync to Xero" button
    - Called automatically after OCR completion (if auto_sync enabled)
    
    For now, we'll return a placeholder response.
    Full implementation in Step 5 (Xero API Integration).
    
    Args:
        receipt_id: ID of receipt to sync
        
    Returns:
        dict: Sync result with transaction ID
        
    Raises:
        HTTPException: If not connected, receipt not found, or sync fails
    """
    # Verify user connected to Xero
    if not current_user.xero_tenant_id:
        raise HTTPException(
            status_code=400,
            detail="Not connected to Xero"
        )
    
    # Get receipt and verify ownership
    receipt = db.query(Receipt).filter(
        Receipt.id == receipt_id,
        Receipt.user_id == current_user.id
    ).first()
    
    if not receipt:
        raise HTTPException(
            status_code=404,
            detail="Receipt not found"
        )
    
    # Verify receipt is completed (has OCR data)
    if receipt.status != ReceiptStatus.COMPLETED:
        raise HTTPException(
            status_code=400,
            detail="Receipt must be processed before syncing to Xero"
        )
    
    # Check if already synced
    if receipt.xero_transaction_id:
        return {
            "success": True,
            "message": "Receipt already synced to Xero",
            "xero_transaction_id": receipt.xero_transaction_id,
            "synced_at": receipt.synced_to_xero_at.isoformat() if receipt.synced_to_xero_at else None,
        }
    
    # Perform the actual sync to Xero
    sync_result = xero_service.sync_receipt_to_xero(
        db=db,
        user=current_user,
        receipt=receipt,
    )
    
    if not sync_result["success"]:
        raise HTTPException(
            status_code=500,
            detail=sync_result["message"]
        )
    
    return {
        "success": True,
        "message": sync_result["message"],
        "xero_transaction_id": sync_result["xero_transaction_id"],
        "synced_at": receipt.synced_to_xero_at.isoformat() if receipt.synced_to_xero_at else None,
        "warnings": sync_result.get("errors", []),
    }


# ============================================================================
# ENDPOINT 7: GET BANK ACCOUNTS
# ============================================================================

@router.get("/bank-accounts")
async def get_bank_accounts(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Get list of available bank accounts from Xero.
    
    This is called after OAuth connection to let the user choose
    which bank account to use for syncing expenses.
    
    Returns list of bank accounts with:
    - code: Account code (e.g., "090")
    - name: Account name (e.g., "Business Bank Account")
    - account_id: Unique ID
    
    Returns:
        dict: {
            "bank_accounts": [
                {"code": "090", "name": "Business Bank", "account_id": "..."},
                {"code": "091", "name": "Savings Account", "account_id": "..."}
            ],
            "selected_code": "090"  # User's currently selected account (if any)
        }
    
    Raises:
        HTTPException: If not connected to Xero
    """
    if not current_user.xero_tenant_id:
        raise HTTPException(
            status_code=400,
            detail="Not connected to Xero"
        )
    
    # Get valid access token (auto-refreshes if needed)
    access_token = xero_service.get_valid_access_token(db, current_user)
    
    try:
        # Fetch bank accounts from Xero
        bank_accounts = xero_service.get_xero_bank_accounts(
            access_token=access_token,
            tenant_id=current_user.xero_tenant_id
        )
        
        return {
            "bank_accounts": bank_accounts,
            "selected_code": current_user.xero_bank_account_code,
        }
        
    except Exception as e:
        print(f"Failed to fetch bank accounts for user {current_user.id}: {e}")
        raise HTTPException(
            status_code=500,
            detail=f"Failed to fetch bank accounts: {str(e)}"
        )


# ============================================================================
# ENDPOINT 8: SELECT BANK ACCOUNT
# ============================================================================

@router.post("/bank-account")
async def select_bank_account(
    bank_account_code: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Save user's selected bank account for syncing expenses.
    
    When syncing receipts to Xero, we need to specify which bank account
    the expense was paid from. This endpoint saves the user's choice.
    
    Args:
        bank_account_code: The account code (e.g., "090")
        
    Returns:
        dict: {
            "success": True,
            "selected_code": "090"
        }
    
    Raises:
        HTTPException: If not connected to Xero
    """
    if not current_user.xero_tenant_id:
        raise HTTPException(
            status_code=400,
            detail="Not connected to Xero"
        )
    
    # Save the selected bank account code
    current_user.xero_bank_account_code = bank_account_code
    db.commit()
    
    return {
        "success": True,
        "selected_code": bank_account_code,
    }
