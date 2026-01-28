#!/usr/bin/env python3
"""
Admin Script: Subscription Management
=====================================

COMMANDS:
    show EMAIL              Show subscription details and usage for a user
    usage EMAIL             Show current month usage stats (receipts/mileage)
    upgrade EMAIL PLAN      Upgrade user to a specific plan (pro/enterprise)
    downgrade EMAIL         Downgrade user to free plan
    grant-trial EMAIL DAYS  Grant trial access for N days
    reset-usage EMAIL       Reset monthly usage counters to 0
    list-plan PLAN          List all users on a specific plan

USAGE EXAMPLES:
    # Check subscription details
    python scripts/manage_subscriptions.py show user@example.com
    
    # View current month usage
    python scripts/manage_subscriptions.py usage user@example.com
    
    # Upgrade to pro plan
    python scripts/manage_subscriptions.py upgrade user@example.com pro
    
    # Grant 30-day trial
    python scripts/manage_subscriptions.py grant-trial user@example.com 30
    
    # Reset monthly counters
    python scripts/manage_subscriptions.py reset-usage user@example.com
    
    # List all pro users
    python scripts/manage_subscriptions.py list-plan pro

SUBSCRIPTION PLANS:
    free        - 50 receipts, 20 mileage claims per month (beta)
    beta        - Same as free + early access features (via is_beta_tester flag)
    pro         - 200 receipts, unlimited mileage
    enterprise  - Unlimited everything

NOTES:
    - Beta testers keep their flag even if subscription changes
    - Monthly usage resets automatically on the 1st of each month
    - Trial extensions don't change the subscription_plan field
"""

import sys
import os
from datetime import datetime, timedelta
from dateutil.relativedelta import relativedelta

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))

from sqlalchemy import create_engine, select, func
from sqlalchemy.orm import Session
from app.core.database import Settings, Base
from app.models.user import User
from app.models.receipt import Receipt
from app.models.mileage_claim import MileageClaim


def get_db_session():
    """Create database session"""
    settings = Settings()
    engine = create_engine(settings.DATABASE_URL)
    return Session(engine)


def get_monthly_limits(user: User):
    """Calculate monthly limits based on user's subscription and beta status"""
    # Beta testers get enhanced limits
    if user.is_beta_tester:
        return {
            'receipts': 50,
            'mileage': 20
        }
    
    # Plan-based limits
    limits = {
        'free': {'receipts': 10, 'mileage': 10},
        'pro': {'receipts': 200, 'mileage': 999999},  # "Unlimited"
        'enterprise': {'receipts': 999999, 'mileage': 999999}
    }
    
    return limits.get(user.subscription_plan, limits['free'])


def get_current_usage(db: Session, user: User):
    """Get current month's usage for a user"""
    # First day of current month
    now = datetime.utcnow()
    month_start = now.replace(day=1, hour=0, minute=0, second=0, microsecond=0)
    
    # Count receipts this month
    receipt_count = db.query(func.count(Receipt.id)).filter(
        Receipt.user_id == user.id,
        Receipt.created_at >= month_start,
        Receipt.deleted_at == None
    ).scalar()
    
    # Count mileage claims this month
    mileage_count = db.query(func.count(MileageClaim.id)).filter(
        MileageClaim.user_id == user.id,
        MileageClaim.created_at >= month_start
    ).scalar()
    
    return {
        'receipts': receipt_count,
        'mileage': mileage_count
    }


def show_subscription(email: str):
    """Show subscription details and usage"""
    with get_db_session() as db:
        user = db.execute(select(User).where(User.email == email)).scalar_one_or_none()
        
        if not user:
            print(f"❌ User not found: {email}")
            return
        
        limits = get_monthly_limits(user)
        usage = get_current_usage(db, user)
        
        print(f"\n{'='*60}")
        print(f"💳 SUBSCRIPTION DETAILS: {email}")
        print(f"{'='*60}")
        print(f"\n📦 PLAN INFORMATION")
        print(f"   Plan:               {user.subscription_plan.upper()}")
        print(f"   Status:             {user.subscription_status}")
        print(f"   Beta Tester:        {'✅ YES' if user.is_beta_tester else '❌ NO'}")
        
        if user.beta_expires_at:
            print(f"   Beta Expires:       {user.beta_expires_at.strftime('%Y-%m-%d')}")
        
        print(f"\n📊 CURRENT MONTH USAGE (as of {datetime.utcnow().strftime('%Y-%m-%d')})")
        
        receipt_pct = (usage['receipts'] / limits['receipts'] * 100) if limits['receipts'] < 999999 else 0
        print(f"   Receipts:           {usage['receipts']}/{limits['receipts']} ({receipt_pct:.0f}%)")
        
        mileage_pct = (usage['mileage'] / limits['mileage'] * 100) if limits['mileage'] < 999999 else 0
        print(f"   Mileage Claims:     {usage['mileage']}/{limits['mileage']} ({mileage_pct:.0f}%)")
        
        print(f"\n{'='*60}\n")


def show_usage(email: str):
    """Show detailed current month usage stats"""
    with get_db_session() as db:
        user = db.execute(select(User).where(User.email == email)).scalar_one_or_none()
        
        if not user:
            print(f"❌ User not found: {email}")
            return
        
        now = datetime.utcnow()
        month_start = now.replace(day=1, hour=0, minute=0, second=0, microsecond=0)
        next_month = month_start + relativedelta(months=1)
        days_left = (next_month - now).days
        
        limits = get_monthly_limits(user)
        usage = get_current_usage(db, user)
        
        # Calculate remaining
        receipts_left = max(0, limits['receipts'] - usage['receipts'])
        mileage_left = max(0, limits['mileage'] - usage['mileage'])
        
        print(f"\n{'='*60}")
        print(f"📊 USAGE REPORT: {email}")
        print(f"{'='*60}")
        print(f"   Period:             {month_start.strftime('%B %Y')}")
        print(f"   Days Remaining:     {days_left} days until reset")
        print(f"   Plan:               {user.subscription_plan.upper()}")
        
        print(f"\n🧾 RECEIPTS")
        print(f"   Used:               {usage['receipts']}")
        print(f"   Limit:              {limits['receipts'] if limits['receipts'] < 999999 else 'Unlimited'}")
        print(f"   Remaining:          {receipts_left if limits['receipts'] < 999999 else 'Unlimited'}")
        
        print(f"\n🚗 MILEAGE CLAIMS")
        print(f"   Used:               {usage['mileage']}")
        print(f"   Limit:              {limits['mileage'] if limits['mileage'] < 999999 else 'Unlimited'}")
        print(f"   Remaining:          {mileage_left if limits['mileage'] < 999999 else 'Unlimited'}")
        
        # Warnings
        if usage['receipts'] >= limits['receipts'] and limits['receipts'] < 999999:
            print(f"\n⚠️  Receipt limit reached!")
        elif usage['receipts'] >= limits['receipts'] * 0.8 and limits['receipts'] < 999999:
            print(f"\n⚠️  Receipt limit almost reached (80%+)")
        
        print(f"\n{'='*60}\n")


def upgrade_plan(email: str, plan: str):
    """Upgrade user to a specific plan"""
    valid_plans = ['pro', 'enterprise']
    
    if plan.lower() not in valid_plans:
        print(f"❌ Invalid plan: {plan}")
        print(f"Valid plans: {', '.join(valid_plans)}")
        return
    
    with get_db_session() as db:
        user = db.execute(select(User).where(User.email == email)).scalar_one_or_none()
        
        if not user:
            print(f"❌ User not found: {email}")
            return
        
        old_plan = user.subscription_plan
        user.subscription_plan = plan.lower()
        user.subscription_status = 'active'
        
        db.commit()
        
        print(f"✅ Upgraded {email}")
        print(f"   {old_plan.upper()} → {plan.upper()}")
        print(f"\n📦 New limits:")
        
        limits = get_monthly_limits(user)
        print(f"   Receipts:           {limits['receipts'] if limits['receipts'] < 999999 else 'Unlimited'}")
        print(f"   Mileage:            {limits['mileage'] if limits['mileage'] < 999999 else 'Unlimited'}")


def downgrade_plan(email: str):
    """Downgrade user to free plan"""
    with get_db_session() as db:
        user = db.execute(select(User).where(User.email == email)).scalar_one_or_none()
        
        if not user:
            print(f"❌ User not found: {email}")
            return
        
        if user.subscription_plan == 'free':
            print(f"ℹ️  User is already on free plan")
            return
        
        old_plan = user.subscription_plan
        user.subscription_plan = 'free'
        user.subscription_status = 'active'
        
        db.commit()
        
        print(f"⬇️  Downgraded {email}")
        print(f"   {old_plan.upper()} → FREE")
        print(f"\n📦 New limits:")
        
        limits = get_monthly_limits(user)
        print(f"   Receipts:           {limits['receipts']}")
        print(f"   Mileage:            {limits['mileage']}")


def grant_trial(email: str, days: int):
    """Grant trial access for specified days"""
    with get_db_session() as db:
        user = db.execute(select(User).where(User.email == email)).scalar_one_or_none()
        
        if not user:
            print(f"❌ User not found: {email}")
            return
        
        # Enable beta tester with expiration
        user.is_beta_tester = True
        user.beta_expires_at = datetime.utcnow() + timedelta(days=days)
        
        db.commit()
        
        print(f"✅ Trial granted for {email}")
        print(f"   Duration:           {days} days")
        print(f"   Expires:            {user.beta_expires_at.strftime('%Y-%m-%d')}")
        print(f"\n📦 Trial benefits:")
        print(f"   Receipts:           50 per month")
        print(f"   Mileage:            20 per month")


def reset_usage(email: str):
    """Reset monthly usage counters (doesn't delete data, just for limit bypass)"""
    print(f"\n⚠️  WARNING: This doesn't delete actual receipts/mileage.")
    print(f"It's mainly useful for testing or giving users a fresh start.")
    print(f"Consider using 'grant-trial' instead for temporary limit increases.\n")
    
    confirm = input(f"Reset usage counters for {email}? (type 'yes' to confirm): ")
    
    if confirm.lower() != 'yes':
        print("❌ Cancelled")
        return
    
    # Note: In a real implementation, you'd have usage tracking fields
    # For now, this is a placeholder
    print(f"ℹ️  Usage reset functionality requires monthly_receipt_count and")
    print(f"   monthly_mileage_count fields in the User model.")
    print(f"   Current implementation tracks usage via created_at queries.")
    print(f"\n💡 Alternative: Grant a trial extension instead:")
    print(f"   python scripts/manage_subscriptions.py grant-trial {email} 30")


def list_plan_users(plan: str):
    """List all users on a specific plan"""
    with get_db_session() as db:
        users = db.execute(
            select(User).where(User.subscription_plan == plan.lower())
            .order_by(User.created_at.desc())
        ).scalars().all()
        
        if not users:
            print(f"📭 No users found on {plan.upper()} plan")
            return
        
        print(f"\n{'='*80}")
        print(f"👥 USERS ON {plan.upper()} PLAN")
        print(f"{'='*80}")
        print(f"{'Email':<35} {'Status':<12} {'Beta':<8} {'Created'}")
        print(f"{'='*80}")
        
        for user in users:
            beta = "✅ YES" if user.is_beta_tester else "❌ NO"
            created = user.created_at.strftime('%Y-%m-%d') if user.created_at else 'N/A'
            print(f"{user.email:<35} {user.subscription_status:<12} {beta:<8} {created}")
        
        print(f"{'='*80}")
        print(f"Total: {len(users)} users")
        print()


def print_usage():
    """Print usage instructions"""
    print(__doc__)


def main():
    if len(sys.argv) < 2:
        print_usage()
        sys.exit(1)
    
    command = sys.argv[1].lower()
    
    try:
        if command == "show":
            if len(sys.argv) < 3:
                print("❌ Error: Email required")
                sys.exit(1)
            show_subscription(sys.argv[2])
        
        elif command == "usage":
            if len(sys.argv) < 3:
                print("❌ Error: Email required")
                sys.exit(1)
            show_usage(sys.argv[2])
        
        elif command == "upgrade":
            if len(sys.argv) < 4:
                print("❌ Error: Email and plan required")
                print("Usage: python scripts/manage_subscriptions.py upgrade EMAIL PLAN")
                sys.exit(1)
            upgrade_plan(sys.argv[2], sys.argv[3])
        
        elif command == "downgrade":
            if len(sys.argv) < 3:
                print("❌ Error: Email required")
                sys.exit(1)
            downgrade_plan(sys.argv[2])
        
        elif command == "grant-trial":
            if len(sys.argv) < 4:
                print("❌ Error: Email and days required")
                print("Usage: python scripts/manage_subscriptions.py grant-trial EMAIL DAYS")
                sys.exit(1)
            grant_trial(sys.argv[2], int(sys.argv[3]))
        
        elif command == "reset-usage":
            if len(sys.argv) < 3:
                print("❌ Error: Email required")
                sys.exit(1)
            reset_usage(sys.argv[2])
        
        elif command == "list-plan":
            if len(sys.argv) < 3:
                print("❌ Error: Plan name required")
                print("Usage: python scripts/manage_subscriptions.py list-plan PLAN")
                sys.exit(1)
            list_plan_users(sys.argv[2])
        
        else:
            print(f"❌ Unknown command: {command}")
            print_usage()
            sys.exit(1)
    
    except Exception as e:
        print(f"❌ Error: {e}")
        import traceback
        traceback.print_exc()
        sys.exit(1)


if __name__ == "__main__":
    main()
