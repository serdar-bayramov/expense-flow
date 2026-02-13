"""
⚠️ LEGACY SECURITY UTILITIES - NOT ACTIVELY USED

This file contains JWT and password hashing utilities from the old auth system.
Kept for reference but NO LONGER PRIMARY AUTH METHOD.

🔄 CURRENT AUTH: Clerk handles all authentication
   - Clerk manages password hashing and JWT tokens
   - Backend only validates Clerk's JWT tokens (see app/api/deps.py)

📝 May be needed for:
   - Migrating old users to Clerk
   - Emergency fallback (if approved)
   - Reference for understanding old system
"""

from datetime import datetime, timedelta, timezone
from typing import Optional
from jose import JWSError, jwt
from jose.exceptions import ExpiredSignatureError
from passlib.context import CryptContext
from app.core.database import settings

# Password hashing configuration
# CryptContext handles password encryption using bcrypt algorithm
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

def hash_password(password: str) -> str:
    """
    Takes a plain text password and returns a hashed version.
    
    Example:
        Input: "mypassword123"
        Output: "$2b$12$KIXxP7..."  (60 character hash)
    
    Why: Never store plain passwords. If database is hacked,
    hackers can't see actual passwords.
    """
    return pwd_context.hash(password)


def verify_password(plain_password: str, hashed_password: str) -> bool:
    """
    Checks if a plain password matches the hashed version.
    
    Example:
        verify_password("mypassword123", "$2b$12$KIXxP7...") → True
        verify_password("wrongpassword", "$2b$12$KIXxP7...") → False
    
    Why: During login, compare what user typed with what's in database.
    """
    return pwd_context.verify(plain_password, hashed_password)


def create_access_token(data: dict, expiers_delta: Optional[timedelta] = None) -> str:
    """
    Creates a JWT token containing user information.
    
    Args:
        data: Dictionary with user info (usually {"sub": "user_id"})
        expires_delta: How long token is valid (default: 30 minutes)
    
    Returns:
        Encrypted JWT token string
    
    Example:
        Input: {"sub": "123"}
        Output: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
    
    Why: Token proves user is logged in without storing session on server.
    """
    to_encode = data.copy()

    if expiers_delta:
        expire = datetime.now(timezone.utc) + expiers_delta
    else:
        expire = datetime.now(timezone.utc) + timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)
    
    # Add expiration time to token payload
    to_encode.update({"exp": expire})
    # Encode using secret key (only your server knows this key)
    encoded_jwt = jwt.encode(to_encode, settings.SECRET_KEY, algorithm=settings.ALGORITHM)
    return encoded_jwt


def decode_access_token(token: str) -> Optional[str]:
    """
    Decodes a JWT token and extracts the user ID.
    
    Args:
        token: JWT token string from Authorization header
    
    Returns:
        User ID (string) if token is valid, None if invalid/expired
    
    Example:
        Input: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
        Output: "123" (user_id)
    
    Why: Every protected request needs to verify the token is real.
    """
    try:
        # Decode and verify signature
        payload = jwt.decode(token, settings.SECRET_KEY, algorithms=[settings.ALGORITHM])
        user_id: str = payload.get("sub")
        return user_id
    except ExpiredSignatureError:
        # Token has expired - this is a normal case, not an error
        return None
    except JWSError:
        # Token is invalid or tampered with
        return None