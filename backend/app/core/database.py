from sqlalchemy import create_engine
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker
from pydantic_settings import BaseSettings

class Settings(BaseSettings):
    DATABASE_URL: str
    SECRET_KEY: str
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 30
    ENVIRONMENT: str = "dev"
    BETA_MODE: bool = True  # Require invite codes during beta
    GOOGLE_APPLICATION_CREDENTIALS: str
    GCS_BUCKET_NAME: str
    OPENAI_API_KEY: str
    GOOGLE_MAPS_API_KEY: str  # For mileage distance calculations
    SENDGRID_RECOVERY_CODE: str | None = None  # Optional recovery code
    CLERK_SECRET_KEY: str  # Clerk authentication
    
    # Stripe Configuration
    STRIPE_SECRET_KEY: str = ""  # Will be set after Stripe account creation
    STRIPE_PUBLISHABLE_KEY: str = ""
    STRIPE_WEBHOOK_SECRET: str = ""
    STRIPE_PROFESSIONAL_PRICE_ID: str = ""  # Will be set after Stripe product creation
    STRIPE_PRO_PLUS_PRICE_ID: str = ""      # Will be set after Stripe product creation
    STRIPE_LIVE_SECRET_KEY: str = ""
    STRIPE_LIVE_PUBLISHABLE_KEY: str = ""
    STRIPE_LIVE_PRO_PLUS_PRICE_ID: str = ""
    STRIPE_LIVE_WEBHOOK_SECRET: str = ""
    STRIPE_LIVE_PROFESSIONAL_PRICE_ID: str = ""
    STRIPE_LIVE_PRO_PLUS_PRICE_ID: str= ""

    
    FRONTEND_URL: str = "http://localhost:3000"  # For Stripe redirects
    
    # Xero Integration
    XERO_CLIENT_ID: str = ""  # From Xero Developer portal
    XERO_CLIENT_SECRET: str = ""  # From Xero Developer portal
    XERO_REDIRECT_URI: str = "http://localhost:8000/api/v1/xero/callback"  # OAuth callback (backend endpoint)
    XERO_ENCRYPTION_KEY: str = ""  # For encrypting OAuth tokens (use Fernet.generate_key())
    

    class Config:
        env_file = ".env"

settings = Settings()

engine = create_engine(settings.DATABASE_URL)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()

# Dependency to get DB session
def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()