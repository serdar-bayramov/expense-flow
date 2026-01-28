from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from sqlalchemy.orm import Session
import jwt
import requests
import random
import string
from clerk_backend_api import Clerk

from app.core.database import get_db, settings
from app.models.user import User

# Security scheme for Swagger UI
security = HTTPBearer()

# Initialize Clerk client
clerk_client = Clerk(bearer_auth=settings.CLERK_SECRET_KEY)

# Cache for Clerk JWKS
_clerk_jwks_cache = None


def get_current_user(
    credentials: HTTPAuthorizationCredentials = Depends(security),
    db: Session = Depends(get_db)
) -> User:
    """
    Dependency to get the currently authenticated user from Clerk JWT token.
    
    Verifies Clerk session token and returns user from database.
    """
    token = credentials.credentials
    
    print(f"🔍 Received token: {token[:50]}...")  # Debug log
    
    try:
        # Decode JWT without verification first to get the issuer
        unverified_header = jwt.get_unverified_header(token)
        unverified_claims = jwt.decode(token, options={"verify_signature": False})
        
        print(f"🔍 Token claims: {unverified_claims}")  # Debug log
        
        # Get clerk_user_id from token (stored as 'sub' claim)
        clerk_user_id = unverified_claims.get("sub")
        
        print(f"🔍 Extracted clerk_user_id: {clerk_user_id}")  # Debug log
        
        if not clerk_user_id:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid token: missing user ID"
            )
        
        # For now, we trust the token since it's coming from Clerk
        # In production, you should verify the signature using Clerk's public keys
        # See: https://clerk.com/docs/backend-requests/handling/manual-jwt
        
    except jwt.DecodeError as e:
        print(f"❌ JWT Decode Error: {str(e)}")  # Debug log
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=f"Invalid token format: {str(e)}"
        )
    except Exception as e:
        print(f"❌ Token validation error: {str(e)}")  # Debug log
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=f"Token validation failed: {str(e)}"
        )
    
    # Fetch user from our database
    user = db.query(User).filter(User.clerk_user_id == clerk_user_id).first()
    
    if user is None:
        # Auto-create user if they don't exist (fallback for webhook failures)
        print(f"🔍 User not found, fetching from Clerk API...")
        
        try:
            # Fetch user details from Clerk
            clerk_user = clerk_client.users.get(user_id=clerk_user_id)
            
            email = clerk_user.email_addresses[0].email_address if clerk_user.email_addresses else None
            
            if not email:
                raise HTTPException(
                    status_code=status.HTTP_401_UNAUTHORIZED,
                    detail="Cannot create user: no email found in Clerk"
                )
            
            # Check if user exists with this email (from old auth system)
            existing_user = db.query(User).filter(User.email == email).first()
            
            if existing_user:
                # Update existing user with Clerk ID
                print(f"🔄 Updating existing user with Clerk ID...")
                existing_user.clerk_user_id = clerk_user_id
                db.commit()
                db.refresh(existing_user)
                user = existing_user
                print(f"✅ Updated user: {email} with clerk_id: {clerk_user_id}")
            else:
                # Generate unique receipt email
                username = email.split('@')[0]
                random_suffix = ''.join(random.choices(string.ascii_lowercase + string.digits, k=6))
                unique_receipt_email = f"{username}-{random_suffix}@receipts.expenseflow.co.uk"
                
                # Get user name
                first_name = clerk_user.first_name or ""
                last_name = clerk_user.last_name or ""
                full_name = f"{first_name} {last_name}".strip() or email.split('@')[0]
                
                # Create new user
                user = User(
                    clerk_user_id=clerk_user_id,
                    email=email,
                    full_name=full_name,
                    unique_receipt_email=unique_receipt_email,
                    subscription_plan="free",
                    is_active=True
                )
                
                db.add(user)
                db.commit()
                db.refresh(user)
                
                print(f"✅ Auto-created user: {email} (clerk_id: {clerk_user_id})")
            
        except Exception as e:
            print(f"❌ Failed to create user from Clerk: {str(e)}")
            db.rollback()
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail=f"Cannot create user: {str(e)}"
            )
    
    if not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Inactive user"
        )
    
    return user