#!/usr/bin/env python3
"""
Admin Script: Manage Beta Testers
==================================

COMMANDS:
    list                List all users with their beta status
    show EMAIL          Show detailed information for a specific user
    enable EMAIL        Enable beta tester (unlimited duration)
    enable EMAIL DAYS   Enable beta tester with expiration (e.g., 90 days)
    disable EMAIL       Disable beta tester status
    enable-all          Enable beta for ALL users (asks for confirmation)

USAGE EXAMPLES:
    # View all users
    python scripts/manage_beta_testers.py list
    
    # Check specific user details
    python scripts/manage_beta_testers.py show user@example.com
    
    # Enable beta tester (no expiration)
    python scripts/manage_beta_testers.py enable user@example.com
    
    # Enable beta tester for 90 days
    python scripts/manage_beta_testers.py enable user@example.com 90
    
    # Disable beta tester
    python scripts/manage_beta_testers.py disable user@example.com
    
    # Enable ALL users as beta testers (bulk operation)
    python scripts/manage_beta_testers.py enable-all

BETA TESTER BENEFITS:
    - 50 receipts per month (vs 10 for regular free users)
    - Early access to new features
    - Priority support

DATABASE:
    - Local dev:     Uses DATABASE_URL from .env
    - Production:    DATABASE_URL="railway-url" python scripts/...
"""

import sys
import os
from datetime import datetime, timedelta

# Add parent directory to path to import app modules
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))

from sqlalchemy import create_engine, select
from sqlalchemy.orm import Session
from app.core.database import Settings

# Import Base first to register all models
from app.core.database import Base
from app.models.user import User
from app.models.receipt import Receipt
from app.models.mileage_claim import MileageClaim
from app.models.journey_template import JourneyTemplate


def get_db_session():
    """Create database session"""
    settings = Settings()
    engine = create_engine(settings.DATABASE_URL)
    return Session(engine)


def list_users():
    """List all users with beta tester status"""
    with get_db_session() as db:
        users = db.execute(select(User).order_by(User.created_at.desc())).scalars().all()
        
        if not users:
            print("📭 No users found")
            return
        
        print(f"\n{'='*80}")
        print(f"{'ID':<5} {'Email':<35} {'Beta':<8} {'Plan':<15} {'Created'}")
        print(f"{'='*80}")
        
        for user in users:
            beta_status = "✅ YES" if user.is_beta_tester else "❌ NO"
            created = user.created_at.strftime('%Y-%m-%d') if user.created_at else 'N/A'
            print(f"{user.id:<5} {user.email:<35} {beta_status:<8} {user.subscription_plan:<15} {created}")
        
        print(f"{'='*80}")
        print(f"Total users: {len(users)}")
        print()


def show_user(email: str):
    """Show detailed user information"""
    with get_db_session() as db:
        user = db.execute(select(User).where(User.email == email)).scalar_one_or_none()
        
        if not user:
            print(f"❌ User not found: {email}")
            return
        
        print(f"\n{'='*60}")
        print(f"USER DETAILS: {email}")
        print(f"{'='*60}")
        print(f"ID:                    {user.id}")
        print(f"Email:                 {user.email}")
        print(f"Full Name:             {user.full_name or 'N/A'}")
        print(f"Clerk ID:              {user.clerk_user_id or 'N/A'}")
        print(f"Receipt Email:         {user.unique_receipt_email}")
        print(f"")
        print(f"Subscription Plan:     {user.subscription_plan}")
        print(f"Subscription Status:   {user.subscription_status}")
        print(f"Beta Tester:           {'✅ YES' if user.is_beta_tester else '❌ NO'}")
        print(f"Beta Expires:          {user.beta_expires_at or 'N/A'}")
        print(f"")
        print(f"Active:                {'✅ YES' if user.is_active else '❌ NO'}")
        print(f"Created:               {user.created_at}")
        print(f"Updated:               {user.updated_at or 'Never'}")
        print(f"{'='*60}\n")


def enable_beta_tester(email: str, days: int = None):
    """Enable beta tester status for a user"""
    with get_db_session() as db:
        user = db.execute(select(User).where(User.email == email)).scalar_one_or_none()
        
        if not user:
            print(f"❌ User not found: {email}")
            return
        
        if user.is_beta_tester:
            print(f"ℹ️  User {email} is already a beta tester")
            return
        
        user.is_beta_tester = True
        
        # Set expiration if specified
        if days:
            user.beta_expires_at = datetime.utcnow() + timedelta(days=days)
            print(f"⏰ Beta access will expire in {days} days ({user.beta_expires_at.strftime('%Y-%m-%d')})")
        
        db.commit()
        print(f"✅ Beta tester enabled for: {email}")
        print(f"📦 Monthly limits: 50 receipts, 10 mileage claims")


def disable_beta_tester(email: str):
    """Disable beta tester status for a user"""
    with get_db_session() as db:
        user = db.execute(select(User).where(User.email == email)).scalar_one_or_none()
        
        if not user:
            print(f"❌ User not found: {email}")
            return
        
        if not user.is_beta_tester:
            print(f"ℹ️  User {email} is not a beta tester")
            return
        
        user.is_beta_tester = False
        user.beta_expires_at = None
        
        db.commit()
        print(f"❌ Beta tester disabled for: {email}")
        print(f"📦 Monthly limits: 10 receipts, 10 mileage claims")


def enable_all_beta():
    """Enable beta tester for all users"""
    confirm = input("⚠️  Enable beta tester for ALL users? (type 'yes' to confirm): ")
    
    if confirm.lower() != 'yes':
        print("❌ Cancelled")
        return
    
    with get_db_session() as db:
        users = db.execute(select(User)).scalars().all()
        
        count = 0
        for user in users:
            if not user.is_beta_tester:
                user.is_beta_tester = True
                count += 1
        
        db.commit()
        print(f"✅ Enabled beta tester for {count} user(s)")


def print_usage():
    """Print usage instructions"""
    print(__doc__)


def main():
    if len(sys.argv) < 2:
        print_usage()
        sys.exit(1)
    
    command = sys.argv[1].lower()
    
    try:
        if command == "list":
            list_users()
        
        elif command == "show":
            if len(sys.argv) < 3:
                print("❌ Error: Email required")
                print("Usage: python scripts/manage_beta_testers.py show EMAIL")
                sys.exit(1)
            show_user(sys.argv[2])
        
        elif command == "enable":
            if len(sys.argv) < 3:
                print("❌ Error: Email required")
                print("Usage: python scripts/manage_beta_testers.py enable EMAIL [DAYS]")
                sys.exit(1)
            
            days = int(sys.argv[3]) if len(sys.argv) > 3 else None
            enable_beta_tester(sys.argv[2], days)
        
        elif command == "disable":
            if len(sys.argv) < 3:
                print("❌ Error: Email required")
                print("Usage: python scripts/manage_beta_testers.py disable EMAIL")
                sys.exit(1)
            disable_beta_tester(sys.argv[2])
        
        elif command == "enable-all":
            enable_all_beta()
        
        else:
            print(f"❌ Unknown command: {command}")
            print_usage()
            sys.exit(1)
    
    except Exception as e:
        print(f"❌ Error: {e}")
        sys.exit(1)


if __name__ == "__main__":
    main()
