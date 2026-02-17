"""
Xero OAuth 2.0 Service

This service handles the complete OAuth flow for Xero integration:
1. Generate authorization URLs to send users to Xero
2. Exchange authorization codes for access tokens
3. Encrypt/decrypt tokens before database storage
4. Automatically refresh expired tokens
5. Provide valid access tokens for API calls

OAuth Flow:
User clicks "Connect Xero" → We generate auth URL → User authorizes on Xero →
Xero redirects back with code → We exchange code for tokens → Store encrypted tokens
"""

import base64
import secrets
from datetime import datetime, timedelta, timezone
from typing import Optional, Tuple
from urllib.parse import urlencode

import requests
from cryptography.fernet import Fernet
from sqlalchemy.orm import Session

from app.core.database import settings
from app.models.user import User


# ============================================================================
# SECTION 1: TOKEN ENCRYPTION
# ============================================================================
# Why encrypt? OAuth tokens are like passwords to user's Xero data.
# If our database is compromised, encrypted tokens are useless without the key.
# We use Fernet (symmetric encryption) - same key encrypts and decrypts.

def _get_cipher() -> Fernet:
    """
    Get the Fernet cipher for encryption/decryption.
    
    Fernet uses:
    - AES 128-bit encryption (secure standard)
    - HMAC for authentication (prevents tampering)
    - Timestamp for key rotation
    
    The encryption key is stored in environment variables (XERO_ENCRYPTION_KEY).
    """
    return Fernet(settings.XERO_ENCRYPTION_KEY.encode())


def encrypt_token(token: str) -> str:
    """
    Encrypt a token before storing in database.
    
    Example:
    Input:  "eyJhbGciOiJSUzI1NiIsImtpZCI6IjFDQUY4RTY2NjM3RDIy..."
    Output: "gAAAAABl2kX9vK3..."
    
    Args:
        token: Plain text token from Xero
        
    Returns:
        Encrypted token (base64 encoded)
    """
    cipher = _get_cipher()
    encrypted_bytes = cipher.encrypt(token.encode())
    return encrypted_bytes.decode()


def decrypt_token(encrypted_token: str) -> str:
    """
    Decrypt a token retrieved from database.
    
    Example:
    Input:  "gAAAAABl2kX9vK3..."
    Output: "eyJhbGciOiJSUzI1NiIsImtpZCI6IjFDQUY4RTY2NjM3RDIy..."
    
    Args:
        encrypted_token: Encrypted token from database
        
    Returns:
        Plain text token ready to use with Xero API
    """
    cipher = _get_cipher()
    decrypted_bytes = cipher.decrypt(encrypted_token.encode())
    return decrypted_bytes.decode()


# ============================================================================
# SECTION 2: OAUTH AUTHORIZATION URL
# ============================================================================
# This is Step 1 of OAuth: Generate the URL to send users to Xero's login page

def generate_authorization_url(state: Optional[str] = None) -> Tuple[str, str]:
    """
    Generate the Xero authorization URL where users give permission.
    
    OAuth Flow Step 1:
    - User clicks "Connect to Xero" button in our app
    - We call this function to build the Xero authorization URL
    - We redirect user's browser to this URL
    - User sees Xero's login page and permission request
    
    URL Structure:
    https://login.xero.com/identity/connect/authorize?
        response_type=code                    ← We want an authorization code
        client_id=YOUR_CLIENT_ID              ← Identifies our app
        redirect_uri=http://localhost:3000... ← Where to send user after auth
        scope=accounting.transactions...      ← What permissions we need
        state=random_string                   ← Security: prevent CSRF attacks
    
    The 'state' parameter:
    - Random string we generate and store in session
    - Xero sends it back in the callback
    - We verify it matches to prevent attackers from injecting fake callbacks
    
    Args:
        state: Optional state parameter. If not provided, we generate a random one.
        
    Returns:
        Tuple of (authorization_url, state)
        - authorization_url: Full URL to redirect user to
        - state: The state value to store (verify on callback)
    """
    # Generate random state if not provided (32 bytes = 256 bits of randomness)
    if state is None:
        state = secrets.token_urlsafe(32)
    
    # Define the scopes (permissions) we need
    # Space-separated list as required by OAuth 2.0 spec
    scopes = [
        "openid",                          # User identity (required for OAuth)
        "profile",                         # User name, email
        "email",                           # User email address
        "accounting.transactions",         # Create/read bank transactions (MAIN FEATURE)
        "accounting.attachments",          # Upload receipt images to Xero
        "accounting.contacts.read",        # Read supplier names
        "accounting.settings.read",        # Read chart of accounts, tax rates
        "offline_access",                  # Get refresh token (CRITICAL - without this, user must re-auth every 30 min)
    ]
    
    # Build query parameters
    params = {
        "response_type": "code",                    # We're using authorization code flow
        "client_id": settings.XERO_CLIENT_ID,       # Our app's ID from Xero developer portal
        "redirect_uri": settings.XERO_REDIRECT_URI, # Where Xero sends user after authorization
        "scope": " ".join(scopes),                  # Space-separated scopes
        "state": state,                             # CSRF protection
    }
    
    # Build the full URL
    base_url = "https://login.xero.com/identity/connect/authorize"
    authorization_url = f"{base_url}?{urlencode(params)}"
    
    return authorization_url, state


# ============================================================================
# SECTION 3: TOKEN EXCHANGE
# ============================================================================
# This is Step 2 of OAuth: Exchange the authorization code for access tokens

def exchange_code_for_tokens(code: str) -> dict:
    """
    Exchange authorization code for access and refresh tokens.
    
    OAuth Flow Step 2:
    - User authorized our app on Xero
    - Xero redirected back to our callback URL with a 'code' parameter
    - This code is temporary (expires in 5 minutes)
    - We exchange it for actual access tokens
    
    What we send to Xero:
    - Authorization header: Basic auth with client_id:client_secret (base64 encoded)
    - Body parameters: grant_type, code, redirect_uri
    
    What Xero sends back:
    {
        "access_token": "eyJhbGc...",      ← Use this to call Xero API (expires in 30 min)
        "refresh_token": "abc123...",      ← Use this to get new access tokens (expires in 60 days)
        "expires_in": 1800,                ← Access token lifetime in seconds (30 minutes)
        "token_type": "Bearer",            ← How to use the token (Authorization: Bearer <token>)
        "id_token": "eyJraWQ..."           ← Contains user info (email, name, etc.)
    }
    
    Args:
        code: Authorization code from Xero callback
        
    Returns:
        Dictionary with tokens and metadata from Xero
        
    Raises:
        requests.HTTPError: If token exchange fails (invalid code, wrong secret, etc.)
    """
    # Xero's token endpoint
    token_url = "https://identity.xero.com/connect/token"
    
    # Create Basic Auth header: base64(client_id:client_secret)
    # This proves to Xero that we are the real app (like a password for apps)
    credentials = f"{settings.XERO_CLIENT_ID}:{settings.XERO_CLIENT_SECRET}"
    credentials_b64 = base64.b64encode(credentials.encode()).decode()
    
    headers = {
        "Authorization": f"Basic {credentials_b64}",
        "Content-Type": "application/x-www-form-urlencoded",
    }
    
    # Request body
    data = {
        "grant_type": "authorization_code",          # We're exchanging a code
        "code": code,                                # The code from callback
        "redirect_uri": settings.XERO_REDIRECT_URI,  # Must match what we used in authorization
    }
    
    # Make the request
    response = requests.post(token_url, headers=headers, data=data)
    response.raise_for_status()  # Raise exception if request failed
    
    return response.json()


# ============================================================================
# SECTION 4: TOKEN REFRESH
# ============================================================================
# Access tokens expire after 30 minutes. Use refresh token to get new ones.

def refresh_access_token(refresh_token: str) -> dict:
    """
    Refresh an expired access token using the refresh token.
    
    Why refresh?
    - Access tokens expire after 30 minutes (security best practice)
    - We don't want to force users to re-authorize every 30 minutes
    - Refresh tokens last 60 days and can generate new access tokens
    
    OAuth Flow - Token Refresh:
    - Access token expired (we check before API calls)
    - We call this function with the refresh_token
    - Xero sends back NEW access_token AND NEW refresh_token
    - We must save BOTH new tokens (old ones are now invalid)
    
    Important: Xero rotates refresh tokens!
    - Each refresh gives you new access_token AND new refresh_token
    - Old refresh_token becomes invalid immediately
    - If you lose the response, you lose access (user must reconnect)
    
    Grace Period:
    - Xero gives 30-minute grace period
    - You can reuse old refresh_token if you didn't save the new one
    - After 30 minutes, old refresh_token is permanently invalid
    
    Args:
        refresh_token: Current encrypted refresh token from database
        
    Returns:
        Dictionary with new tokens from Xero
        
    Raises:
        requests.HTTPError: If refresh fails (expired token, invalid token, etc.)
    """
    # Decrypt the refresh token first
    decrypted_refresh_token = decrypt_token(refresh_token)
    
    token_url = "https://identity.xero.com/connect/token"
    
    # Basic auth (same as token exchange)
    credentials = f"{settings.XERO_CLIENT_ID}:{settings.XERO_CLIENT_SECRET}"
    credentials_b64 = base64.b64encode(credentials.encode()).decode()
    
    headers = {
        "Authorization": f"Basic {credentials_b64}",
        "Content-Type": "application/x-www-form-urlencoded",
    }
    
    # Request body for refresh
    data = {
        "grant_type": "refresh_token",
        "refresh_token": decrypted_refresh_token,
    }
    
    response = requests.post(token_url, headers=headers, data=data)
    response.raise_for_status()
    
    return response.json()


# ============================================================================
# SECTION 5: GET VALID ACCESS TOKEN
# ============================================================================
# Smart helper that automatically refreshes expired tokens

def get_valid_access_token(db: Session, user: User) -> Optional[str]:
    """
    Get a valid access token for the user, refreshing if necessary.
    
    This is the main function you'll use before making Xero API calls.
    It handles the complexity of token expiry automatically.
    
    Logic:
    1. Check if user has Xero tokens
    2. Check if access token is expired (compare expiry time to now)
    3. If expired: Call refresh_access_token() and save new tokens
    4. Return decrypted access token ready to use
    
    Example usage in your code:
    ```python
    access_token = get_valid_access_token(db, user)
    if not access_token:
        return {"error": "User not connected to Xero"}
    
    # Use the token to call Xero API
    headers = {
        "Authorization": f"Bearer {access_token}",
        "Xero-tenant-id": user.xero_tenant_id,
    }
    response = requests.get("https://api.xero.com/api.xro/2.0/Invoices", headers=headers)
    ```
    
    Args:
        db: Database session
        user: User model instance
        
    Returns:
        Decrypted access token ready to use, or None if user not connected
        
    Side effects:
        - Updates user's tokens in database if refresh was needed
        - Commits database changes
    """
    # Check if user has Xero connection
    if not user.xero_access_token or not user.xero_refresh_token:
        return None
    
    # Check if access token is still valid
    # Add 5-minute buffer to avoid edge cases (token expiring mid-request)
    now = datetime.now(timezone.utc)
    buffer = timedelta(minutes=5)
    
    if user.xero_token_expires_at and user.xero_token_expires_at > (now + buffer):
        # Token is still valid, just decrypt and return
        return decrypt_token(user.xero_access_token)
    
    # Token expired, need to refresh
    try:
        token_data = refresh_access_token(user.xero_refresh_token)
        
        # Update user with new tokens (remember: Xero rotates refresh tokens!)
        user.xero_access_token = encrypt_token(token_data["access_token"])
        user.xero_refresh_token = encrypt_token(token_data["refresh_token"])
        user.xero_token_expires_at = datetime.now(timezone.utc) + timedelta(seconds=token_data["expires_in"])
        
        db.commit()
        
        # Return the new access token (already decrypted from token_data)
        return token_data["access_token"]
        
    except requests.HTTPError as e:
        # Refresh failed - token might be fully expired (60 days passed)
        # User needs to reconnect to Xero
        print(f"Failed to refresh Xero token for user {user.id}: {e}")
        return None


# ============================================================================
# SECTION 6: GET XERO CONNECTIONS
# ============================================================================
# Find out which Xero organizations the user connected

def get_xero_connections(access_token: str) -> list:
    """
    Get list of Xero organizations (tenants) the user authorized.
    
    Why do we need this?
    - Users can have multiple Xero organizations (e.g., multiple businesses)
    - During OAuth, they choose which org(s) to connect
    - We need to know the tenant_id to make API calls
    
    This is called after successful token exchange to:
    1. Get the tenant_id (required for all API calls)
    2. Get the organization name (show to user)
    3. Store both in our database
    
    Xero API returns:
    [
        {
            "id": "connection-uuid",
            "tenantId": "org-uuid",          ← We need this for API calls
            "tenantType": "ORGANISATION",
            "tenantName": "My Business Ltd", ← We show this to user
            "createdDateUtc": "2024-01-15T10:30:00",
            "updatedDateUtc": "2024-02-15T08:20:00"
        }
    ]
    
    Note: Most users connect 1 organization, but some have multiple.
    For simplicity, we'll use the first one. Could be enhanced later.
    
    Args:
        access_token: Valid (decrypted) access token
        
    Returns:
        List of connection dictionaries
        
    Raises:
        requests.HTTPError: If API call fails
    """
    connections_url = "https://api.xero.com/connections"
    
    headers = {
        "Authorization": f"Bearer {access_token}",
        "Content-Type": "application/json",
    }
    
    response = requests.get(connections_url, headers=headers)
    response.raise_for_status()
    
    return response.json()


# ============================================================================
# SECTION 7: DISCONNECT XERO
# ============================================================================
# Remove Xero connection and clear tokens

def disconnect_xero(db: Session, user: User) -> bool:
    """
    Disconnect user's Xero integration.
    
    What this does:
    1. Revoke tokens with Xero (invalidate them on Xero's side)
    2. Clear all Xero data from user record
    3. User will need to reconnect if they want to use Xero again
    
    Why revoke?
    - Security best practice
    - If user clicks "disconnect", tokens should stop working immediately
    - Without revocation, tokens remain valid until expiry (up to 60 days)
    
    Args:
        db: Database session
        user: User model instance
        
    Returns:
        True if successful, False if no connection or revocation failed
        
    Side effects:
        - Clears user's Xero tokens and connection data
        - Commits database changes
    """
    if not user.xero_refresh_token:
        return False
    
    try:
        # Decrypt refresh token for revocation
        decrypted_refresh_token = decrypt_token(user.xero_refresh_token)
        
        # Revoke the token with Xero
        revoke_url = "https://identity.xero.com/connect/revocation"
        
        credentials = f"{settings.XERO_CLIENT_ID}:{settings.XERO_CLIENT_SECRET}"
        credentials_b64 = base64.b64encode(credentials.encode()).decode()
        
        headers = {
            "Authorization": f"Basic {credentials_b64}",
            "Content-Type": "application/x-www-form-urlencoded",
        }
        
        data = {
            "token": decrypted_refresh_token,
        }
        
        response = requests.post(revoke_url, headers=headers, data=data)
        response.raise_for_status()
        
    except Exception as e:
        print(f"Failed to revoke Xero token for user {user.id}: {e}")
        # Continue anyway - we'll clear local data even if revocation failed
    
    # Clear all Xero data from user record
    user.xero_tenant_id = None
    user.xero_org_name = None
    user.xero_access_token = None
    user.xero_refresh_token = None
    user.xero_token_expires_at = None
    user.xero_connected_at = None
    user.xero_auto_sync = False
    
    db.commit()
    
    return True


# ============================================================================
# SECTION 7.5: GET BANK ACCOUNTS
# ============================================================================
# Fetch available bank accounts from Xero

def get_xero_bank_accounts(access_token: str, tenant_id: str) -> list:
    """
    Get list of bank accounts from Xero organization.
    
    Why we need this:
    - SPEND transactions require a BankAccount to be specified
    - Each Xero org has different bank account codes
    - We need to know which accounts exist before creating transactions
    
    Returns list of accounts with:
    - Code: Account code (e.g., "090", "091")
    - Name: Account name (e.g., "Business Bank Account")
    - Type: Account type (e.g., "BANK")
    
    Args:
        access_token: Valid Xero access token
        tenant_id: Xero organization ID
        
    Returns:
        List of bank account dicts
    """
    url = "https://api.xero.com/api.xro/2.0/Accounts"
    
    headers = {
        "Authorization": f"Bearer {access_token}",
        "Xero-tenant-id": tenant_id,
        "Accept": "application/json",
    }
    
    params = {
        "where": 'Type=="BANK"',  # Only bank accounts
    }
    
    response = requests.get(url, headers=headers, params=params)
    response.raise_for_status()
    
    data = response.json()
    accounts = data.get("Accounts", [])
    
    # Return simplified list
    return [
        {
            "code": acc.get("Code"),
            "name": acc.get("Name"),
            "account_id": acc.get("AccountID"),
        }
        for acc in accounts
        if acc.get("Status") == "ACTIVE"  # Only active accounts
    ]


# ============================================================================
# SECTION 8: CATEGORY MAPPING
# ============================================================================
# Map our expense categories to Xero account codes

def get_xero_account_code(category: str) -> str:
    """
    Map ExpenseFlow category to Xero account code.
    
    Xero Account Codes:
    - Each organization has a Chart of Accounts
    - Each account has a code (e.g., "400" = Advertising, "404" = Bank Fees)
    - We need to map our categories to appropriate Xero accounts
    
    Default Xero Account Codes (UK businesses):
    - 400-499: Expense accounts
    - 200-299: Asset accounts
    - 800-899: Income accounts
    
    Common UK Business Expenses:
    - 400: Advertising & Marketing
    - 404: Bank Fees
    - 408: Cleaning
    - 412: Consulting & Accounting
    - 416: Depreciation
    - 420: Entertainment (non-deductible)
    - 425: Entertainment (deductible)
    - 429: General Expenses
    - 433: Insurance
    - 437: Interest Expense
    - 441: Legal Expenses
    - 445: Light, Power, Heating
    - 449: Motor Vehicle Expenses
    - 453: Office Expenses
    - 457: Printing & Stationery
    - 461: Rent
    - 465: Repairs & Maintenance
    - 469: Subscriptions
    - 473: Telephone & Internet
    - 477: Travel - National
    - 481: Travel - International
    
    Future Enhancement:
    - Could fetch actual account codes from user's Xero org
    - Could let users customize mappings
    - For now, we use safe defaults
    
    Args:
        category: Our expense category (e.g., "TRAVEL", "OFFICE")
        
    Returns:
        Xero account code (e.g., "477")
    """
    # Map our categories to standard Xero UK account codes
    category_map = {
        "TRAVEL": "477",           # Travel - National
        "OFFICE": "453",           # Office Expenses
        "MEALS": "420",            # Entertainment (some may need 425 for deductible)
        "FUEL": "449",             # Motor Vehicle Expenses
        "PARKING": "449",          # Motor Vehicle Expenses
        "ACCOMMODATION": "477",    # Travel - National
        "SUPPLIES": "453",         # Office Expenses
        "SOFTWARE": "469",         # Subscriptions
        "EQUIPMENT": "453",        # Office Expenses
        "UTILITIES": "445",        # Light, Power, Heating
        "INTERNET": "473",         # Telephone & Internet
        "PHONE": "473",            # Telephone & Internet
        "MARKETING": "400",        # Advertising & Marketing
        "PROFESSIONAL": "412",     # Consulting & Accounting
        "INSURANCE": "433",        # Insurance
        "RENT": "461",             # Rent
        "MAINTENANCE": "465",      # Repairs & Maintenance
        "BANK_FEES": "404",        # Bank Fees
        "OTHER": "429",            # General Expenses
    }
    
    # Default to General Expenses if category not found
    return category_map.get(category.upper(), "429")


# ============================================================================
# SECTION 9: CREATE BANK TRANSACTION
# ============================================================================
# Create a bank transaction in Xero

def create_bank_transaction(
    access_token: str,
    tenant_id: str,
    receipt_data: dict,
    user,  # User model instance (for bank account code)
) -> dict:
    """
    Create a bank transaction in Xero.
    
    What is a Bank Transaction in Xero?
    - Represents money spent from a bank account
    - Shows up in bank reconciliation
    - Can have attachments (our receipt image)
    - Has transaction date, amount, description, category (account code)
    
    API Endpoint: POST https://api.xero.com/api.xro/2.0/BankTransactions
    
    Required Headers:
    - Authorization: Bearer <access_token>
    - Xero-tenant-id: <tenant_id>
    - Content-Type: application/json
    
    Request Body Structure:
    {
        "BankTransactions": [
            {
                "Type": "SPEND",                    ← Money going out
                "Contact": {
                    "Name": "Tesco"                 ← Merchant/supplier name
                },
                "LineItems": [
                    {
                        "Description": "Office supplies",
                        "Quantity": 1,
                        "UnitAmount": 25.99,
                        "AccountCode": "453",       ← Where to categorize expense
                        "TaxType": "NONE"           ← No tax (simpler)
                    }
                ],
                "BankAccount": {
                    "Code": "090"                   ← User's bank account (fetched dynamically)
                },
                "Date": "2026-02-15",
                "Reference": "Receipt #123"
            }
        ]
    }
    
    Response:
    {
        "BankTransactions": [
            {
                "BankTransactionID": "uuid-here",   ← Save this for attaching image
                "Status": "AUTHORISED",
                "Reference": "Receipt #123",
                ...
            }
        ]
    }
    
    Args:
        access_token: Valid Xero access token
        tenant_id: Xero organization (tenant) ID
        receipt_data: Dict with keys: merchant, amount, date, description, category, receipt_id
        
    Returns:
        Xero API response with created transaction
        
    Raises:
        requests.HTTPError: If API call fails
    """
    url = "https://api.xero.com/api.xro/2.0/BankTransactions"
    
    headers = {
        "Authorization": f"Bearer {access_token}",
        "Xero-tenant-id": tenant_id,
        "Content-Type": "application/json",
        "Accept": "application/json",
    }
    
    # Get Xero account code for the category
    account_code = get_xero_account_code(receipt_data.get("category", "OTHER"))
    
    # Use user's selected bank account, or fetch and use the first one as fallback
    bank_account_code = user.xero_bank_account_code
    
    if not bank_account_code:
        try:
            bank_accounts = get_xero_bank_accounts(access_token, tenant_id)
            if not bank_accounts:
                raise Exception("No bank accounts found in Xero. Please add a bank account first.")
            bank_account_code = bank_accounts[0]["code"]
            print(f"⚠️  No bank account selected. Using first available: {bank_accounts[0]['name']} (code: {bank_account_code})")
        except Exception as e:
            print(f"❌ Failed to fetch bank accounts: {e}")
            raise
    else:
        print(f"💰 Using selected Xero bank account: {bank_account_code}")
    
    # Build the transaction payload
    payload = {
        "BankTransactions": [
            {
                "Type": "SPEND",  # Money going out
                "Contact": {
                    "Name": receipt_data.get("merchant", "Unknown Merchant")
                },
                "LineItems": [
                    {
                        "Description": receipt_data.get("description", "Expense from ExpenseFlow"),
                        "Quantity": 1,
                        "UnitAmount": receipt_data.get("amount", 0.0),
                        "AccountCode": account_code,
                        "TaxType": "NONE",  # No tax calculation (simpler for demo, adjust per region)
                    }
                ],
                "BankAccount": {
                    "Code": bank_account_code  # Use dynamically fetched bank account
                },
                "Date": receipt_data.get("date"),  # Format: YYYY-MM-DD
                "Reference": f"ExpenseFlow Receipt #{receipt_data.get('receipt_id')}",
            }
        ]
    }
    
    print(f"🔍 Xero API Request Payload: {payload}")
    
    response = requests.post(url, headers=headers, json=payload)
    
    # Better error logging
    if not response.ok:
        print(f"❌ Xero API Error {response.status_code}: {response.text}")
    
    response.raise_for_status()
    
    return response.json()


# ============================================================================
# SECTION 10: ATTACH RECEIPT IMAGE
# ============================================================================
# Upload receipt image to Xero transaction

def attach_receipt_image(
    access_token: str,
    tenant_id: str,
    transaction_id: str,
    image_url: str,
    filename: str,
) -> dict:
    """
    Attach receipt image to a Xero bank transaction.
    
    Why attach images?
    - Accountants need to see the original receipt
    - HMRC may request receipt proof during audits
    - Xero stores images securely with the transaction
    
    How it works:
    1. Download image from our Google Cloud Storage
    2. Upload image bytes to Xero
    3. Xero associates image with transaction_id
    4. Image appears in Xero when viewing the transaction
    
    API Endpoint: POST https://api.xero.com/api.xro/2.0/BankTransactions/{id}/Attachments/{filename}
    
    Required Headers:
    - Authorization: Bearer <access_token>
    - Xero-tenant-id: <tenant_id>
    - Content-Type: image/jpeg (or image/png, application/pdf)
    
    Request Body: Raw image bytes
    
    Important:
    - Xero accepts: JPG, PNG, PDF
    - Max file size: 10MB
    - Filename becomes the attachment name in Xero
    
    Args:
        access_token: Valid Xero access token
        tenant_id: Xero organization ID
        transaction_id: UUID of created bank transaction
        image_url: Public URL to download receipt image
        filename: Name for the attachment (e.g., "receipt_123.jpg")
        
    Returns:
        Xero API response confirming attachment
        
    Raises:
        requests.HTTPError: If download or upload fails
    """
    # Step 1: Download image from our storage
    image_response = requests.get(image_url)
    image_response.raise_for_status()
    image_bytes = image_response.content
    
    # Step 2: Determine content type from filename
    if filename.lower().endswith(".pdf"):
        content_type = "application/pdf"
    elif filename.lower().endswith(".png"):
        content_type = "image/png"
    else:
        content_type = "image/jpeg"
    
    # Step 3: Upload to Xero
    url = f"https://api.xero.com/api.xro/2.0/BankTransactions/{transaction_id}/Attachments/{filename}"
    
    headers = {
        "Authorization": f"Bearer {access_token}",
        "Xero-tenant-id": tenant_id,
        "Content-Type": content_type,
    }
    
    response = requests.post(url, headers=headers, data=image_bytes)
    response.raise_for_status()
    
    return response.json()


# ============================================================================
# SECTION 11: COMPLETE SYNC FUNCTION
# ============================================================================
# Orchestrate the full sync process

def sync_receipt_to_xero(
    db: Session,
    user: User,
    receipt,  # Receipt model instance
) -> dict:
    """
    Sync a receipt to Xero (create transaction + attach image).
    
    This is the main function called by the API endpoint.
    It orchestrates the complete sync process with error handling.
    
    Full Flow:
    1. Get valid access token (auto-refresh if needed)
    2. Prepare receipt data for Xero format
    3. Create bank transaction in Xero
    4. Extract transaction ID from response
    5. Attach receipt image to transaction
    6. Update receipt with xero_transaction_id and synced timestamp
    7. Create success sync log entry
    8. Return result
    
    Error Handling:
    - If token expired: Automatically refreshes
    - If API fails: Creates error sync log
    - If partial success: Still logs what succeeded
    
    Args:
        db: Database session
        user: User model instance (with Xero connection)
        receipt: Receipt model instance (with OCR data)
        
    Returns:
        dict: {
            "success": bool,
            "xero_transaction_id": str or None,
            "message": str,
            "errors": list (if any)
        }
        
    Side effects:
        - Updates receipt.xero_transaction_id
        - Updates receipt.synced_to_xero_at
        - Creates XeroSyncLog entry
        - Commits database changes
    """
    from app.models.xero_sync_log import XeroSyncLog
    
    errors = []
    
    try:
        # Step 1: Get valid access token
        access_token = get_valid_access_token(db, user)
        if not access_token:
            raise Exception("Xero connection expired. Please reconnect.")
        
        # Step 2: Prepare receipt data
        receipt_data = {
            "receipt_id": receipt.id,
            "merchant": receipt.vendor or "Unknown Merchant",
            "amount": float(receipt.total_amount) if receipt.total_amount else 0.0,
            "date": receipt.date.strftime("%Y-%m-%d") if receipt.date else datetime.now(timezone.utc).strftime("%Y-%m-%d"),
            "description": receipt.notes or f"Expense from {receipt.vendor or 'Unknown'}",
            "category": receipt.category.value if receipt.category else "OTHER",
        }
        
        # Step 3: Create bank transaction
        transaction_response = create_bank_transaction(
            access_token=access_token,
            tenant_id=user.xero_tenant_id,
            receipt_data=receipt_data,
            user=user,
        )
        
        # Step 4: Extract transaction ID
        transactions = transaction_response.get("BankTransactions", [])
        if not transactions:
            raise Exception("No transaction returned from Xero API")
        
        transaction = transactions[0]
        transaction_id = transaction.get("BankTransactionID")
        
        if not transaction_id:
            raise Exception("No transaction ID in Xero response")
        
        # Step 5: Attach receipt image (if we have one)
        if receipt.image_url:
            try:
                # Generate filename from receipt ID
                filename = f"receipt_{receipt.id}.jpg"
                
                attach_receipt_image(
                    access_token=access_token,
                    tenant_id=user.xero_tenant_id,
                    transaction_id=transaction_id,
                    image_url=receipt.image_url,
                    filename=filename,
                )
            except Exception as e:
                # Image attachment failed, but transaction created
                # Log error but don't fail the entire sync
                error_msg = f"Transaction created but image attachment failed: {str(e)}"
                errors.append(error_msg)
                print(f"Xero image attachment error for receipt {receipt.id}: {e}")
        
        # Step 6: Update receipt with Xero info
        receipt.xero_transaction_id = transaction_id
        receipt.synced_to_xero_at = datetime.now(timezone.utc)
        
        # Step 7: Create success sync log
        sync_log = XeroSyncLog(
            user_id=user.id,
            receipt_id=receipt.id,
            xero_transaction_id=transaction_id,
            sync_status="success",
            error_message="; ".join(errors) if errors else None,
            synced_at=datetime.now(timezone.utc),
        )
        db.add(sync_log)
        db.commit()
        
        return {
            "success": True,
            "xero_transaction_id": transaction_id,
            "message": "Receipt synced to Xero successfully" + (f" (warnings: {'; '.join(errors)})" if errors else ""),
            "errors": errors,
        }
        
    except Exception as e:
        # Full sync failed
        error_message = str(e)
        print(f"Xero sync failed for receipt {receipt.id}: {error_message}")
        
        # Create error sync log
        sync_log = XeroSyncLog(
            user_id=user.id,
            receipt_id=receipt.id,
            xero_transaction_id=None,
            sync_status="failed",
            error_message=error_message,
            synced_at=datetime.now(timezone.utc),
        )
        db.add(sync_log)
        db.commit()
        
        return {
            "success": False,
            "xero_transaction_id": None,
            "message": f"Failed to sync receipt to Xero: {error_message}",
            "errors": [error_message],
        }
