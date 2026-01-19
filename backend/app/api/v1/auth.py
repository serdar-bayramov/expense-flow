from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import OAuth2PasswordRequestForm
from sqlalchemy.orm import Session
import secrets
import string

from app.core.database import get_db
from app.core.security import hash_password, verify_password, create_access_token
from app.models.user import User
from app.schemas.user import UserCreate, UserResponse, Token

router = APIRouter(prefix="/auth", tags=["Authentication"])


def generate_unique_receipt_email(email: str, db: Session) -> str:
    """
    Generates a unique forwarding email for receipts.
    
    Example:
        Input: "sarah@gmail.com"
        Output: "sarah-x8k2@receipts.yourapp.com"
    
    Logic:
        1. Take username part from email (sarah)
        2. Add random 4-character code (x8k2)
        3. Keep generating until unique in database
    """
    username = email.split("@")[0].lower()
    
    while True:
        # Generate random 4-character code (lowercase + digits)
        random_code = ''.join(secrets.choice(string.ascii_lowercase + string.digits) for _ in range(4))
        unique_email = f"{username}-{random_code}@receipts.yourapp.com"
        
        # Check if this email already exists
        existing = db.query(User).filter(User.unique_receipt_email == unique_email).first()
        if not existing:
            return unique_email
        

@router.post("/register", response_model=UserResponse, status_code=status.HTTP_201_CREATED)
def register(user_data: UserCreate, db: Session = Depends(get_db)):
    """
    Register a new user account.
    
    Steps:
        1. Check if email already exists
        2. Hash the password
        3. Generate unique receipt email
        4. Save user to database
        5. Return user data (without password!)
    
    Example Request:
        POST /api/v1/auth/register
        {
            "email": "sarah@gmail.com",
            "password": "mySecurePass123",
            "full_name": "Sarah Johnson"
        }
    
    Example Response:
        {
            "id": 1,
            "email": "sarah@gmail.com",
            "full_name": "Sarah Johnson",
            "unique_receipt_email": "sarah-x8k2@receipts.yourapp.com",
            "is_active": true,
            "created_at": "2026-01-10T12:00:00Z"
        }
    """
    # 1. Check if user already exists
    existing_user = db.query(User).filter(User.email == user_data.email).first()
    if existing_user:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Email already registered"
        )
    
    # 2. Hash password (never store plain text!)
    hashed_password = hash_password(user_data.password)
    
    # 3. Generate unique receipt forwarding email
    unique_email = generate_unique_receipt_email(user_data.email, db)
    
    # 4. Create user object
    new_user = User(
        email=user_data.email,
        hashed_password=hashed_password,
        full_name=user_data.full_name,
        unique_receipt_email=unique_email,
        is_active=True
    )
    
    # 5. Save to database
    db.add(new_user)
    db.commit()
    db.refresh(new_user)  # Get the auto-generated ID and timestamps
    
    return new_user


@router.post("/login", response_model=Token)
def login(form_data: OAuth2PasswordRequestForm = Depends(), db: Session = Depends(get_db)):
    """
    Login and receive JWT access token.
    
    Steps:
        1. Find user by email
        2. Verify password matches
        3. Create JWT token with user_id
        4. Return token
    
    Example Request:
        POST /api/v1/auth/login
        {
            "email": "sarah@gmail.com",
            "password": "mySecurePass123"
        }
    
    Example Response:
        {
            "access_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
            "token_type": "bearer"
        }
    
    Frontend stores this token and sends with every request:
        Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
    """
    # 1. Find user by email
    user = db.query(User).filter(User.email == form_data.username).first()
    
    # 2. Check if user exists
    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect email or password",
            headers={"WWW-Authenticate": "Bearer"}
        )
    
    # 3. Verify password
    if not verify_password(form_data.password, user.hashed_password):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect email or password",
            headers={"WWW-Authenticate": "Bearer"}
        )
    
    # 4. Check if account is active
    if not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Account is disabled"
        )
    
    # 5. Create JWT token
    access_token = create_access_token(data={"sub": str(user.id)})
    
    return {"access_token": access_token, "token_type": "bearer"}

