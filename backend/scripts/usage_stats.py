#!/usr/bin/env python3
"""
⚠️  WARNING: This script needs updating after beta tester fields were removed.
    Some commands (beta-stats, export) will fail due to is_beta_tester references.
    TODO: Update or remove beta-specific functionality.

Admin Script: Usage Statistics & Analytics
==========================================

COMMANDS:
    summary             Show overall platform statistics
    top-users [N]       Show top N users by receipt count (default: 10)
    monthly             Show monthly active users and usage
    export CSV_FILE     Export detailed usage report to CSV

USAGE EXAMPLES:
    # Platform overview
    python scripts/usage_stats.py summary
    
    # Top 20 most active users
    python scripts/usage_stats.py top-users 20
    
    # Monthly breakdown
    python scripts/usage_stats.py monthly
    
    # Export to CSV for analysis
    python scripts/usage_stats.py export usage_report.csv

METRICS TRACKED:
    - Total users, receipts, mileage claims
    - Monthly active users (MAU)
    - Average receipts per user
    - Beta vs regular user engagement
    - Subscription plan distribution
    - User retention and growth
"""

import sys
import os
from datetime import datetime, timedelta
from collections import defaultdict
import csv

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


def show_summary():
    """Show overall platform statistics"""
    with get_db_session() as db:
        # User stats
        total_users = db.query(func.count(User.id)).scalar()
        active_users = db.query(func.count(User.id)).filter(User.is_active == True).scalar()
        beta_users = db.query(func.count(User.id)).filter(User.is_beta_tester == True).scalar()
        
        # Receipt stats
        total_receipts = db.query(func.count(Receipt.id)).scalar()
        active_receipts = db.query(func.count(Receipt.id)).filter(Receipt.deleted_at == None).scalar()
        
        # Mileage stats
        total_mileage = db.query(func.count(MileageClaim.id)).scalar()
        
        # Subscription distribution
        plan_counts = db.query(
            User.subscription_plan, 
            func.count(User.id)
        ).group_by(User.subscription_plan).all()
        
        print(f"\n{'='*60}")
        print("📊 PLATFORM STATISTICS")
        print(f"{'='*60}")
        print(f"\n👥 USERS")
        print(f"   Total:              {total_users}")
        print(f"   Active:             {active_users}")
        print(f"   Beta Testers:       {beta_users} ({beta_users/max(total_users, 1)*100:.1f}%)")
        
        print(f"\n🧾 RECEIPTS")
        print(f"   Total Created:      {total_receipts}")
        print(f"   Active:             {active_receipts}")
        print(f"   Deleted:            {total_receipts - active_receipts}")
        print(f"   Avg per User:       {total_receipts/max(total_users, 1):.1f}")
        
        print(f"\n🚗 MILEAGE CLAIMS")
        print(f"   Total:              {total_mileage}")
        print(f"   Avg per User:       {total_mileage/max(total_users, 1):.1f}")
        
        print(f"\n💳 SUBSCRIPTION PLANS")
        for plan, count in plan_counts:
            pct = count/max(total_users, 1)*100
            print(f"   {plan.upper():<12}        {count} ({pct:.1f}%)")
        
        print(f"\n{'='*60}\n")


def show_top_users(limit: int = 10):
    """Show top users by receipt count"""
    with get_db_session() as db:
        # Query users with receipt counts
        results = db.query(
            User.email,
            User.subscription_plan,
            User.is_beta_tester,
            func.count(Receipt.id).label('receipt_count')
        ).outerjoin(Receipt, Receipt.user_id == User.id).group_by(
            User.id, User.email, User.subscription_plan, User.is_beta_tester
        ).order_by(func.count(Receipt.id).desc()).limit(limit).all()
        
        if not results:
            print("📭 No users found")
            return
        
        print(f"\n{'='*80}")
        print(f"🏆 TOP {limit} USERS BY RECEIPT COUNT")
        print(f"{'='*80}")
        print(f"{'Email':<35} {'Plan':<10} {'Beta':<8} {'Receipts'}")
        print(f"{'='*80}")
        
        for email, plan, is_beta, count in results:
            beta_status = "✅ YES" if is_beta else "❌ NO"
            print(f"{email:<35} {plan:<10} {beta_status:<8} {count}")
        
        print(f"{'='*80}\n")


def show_monthly_stats():
    """Show monthly active users and usage"""
    with get_db_session() as db:
        now = datetime.utcnow()
        thirty_days_ago = now - timedelta(days=30)
        
        # Users created this month
        new_users = db.query(func.count(User.id)).filter(
            User.created_at >= thirty_days_ago
        ).scalar()
        
        # Active users (uploaded receipt in last 30 days)
        active_users = db.query(func.count(func.distinct(Receipt.user_id))).filter(
            Receipt.created_at >= thirty_days_ago
        ).scalar()
        
        # Receipts this month
        monthly_receipts = db.query(func.count(Receipt.id)).filter(
            Receipt.created_at >= thirty_days_ago
        ).scalar()
        
        # Mileage claims this month
        monthly_mileage = db.query(func.count(MileageClaim.id)).filter(
            MileageClaim.created_at >= thirty_days_ago
        ).scalar()
        
        total_users = db.query(func.count(User.id)).scalar()
        
        print(f"\n{'='*60}")
        print("📅 LAST 30 DAYS STATISTICS")
        print(f"{'='*60}")
        print(f"\n👥 USER ACTIVITY")
        print(f"   New Signups:        {new_users}")
        print(f"   Monthly Active:     {active_users}")
        print(f"   Activation Rate:    {active_users/max(total_users, 1)*100:.1f}%")
        
        print(f"\n📊 USAGE")
        print(f"   Receipts Created:   {monthly_receipts}")
        print(f"   Mileage Claims:     {monthly_mileage}")
        print(f"   Avg Receipts/User:  {monthly_receipts/max(active_users, 1):.1f}")
        
        print(f"\n{'='*60}\n")


def show_beta_stats():
    """Show beta tester conversion and usage stats"""
    with get_db_session() as db:
        # Beta vs regular users
        total_users = db.query(func.count(User.id)).scalar()
        beta_users = db.query(func.count(User.id)).filter(User.is_beta_tester == True).scalar()
        regular_users = total_users - beta_users
        
        # Receipt counts
        beta_receipts = db.query(func.count(Receipt.id)).join(
            User, Receipt.user_id == User.id
        ).filter(User.is_beta_tester == True).scalar()
        
        regular_receipts = db.query(func.count(Receipt.id)).join(
            User, Receipt.user_id == User.id
        ).filter(User.is_beta_tester == False).scalar()
        
        # Averages
        beta_avg = beta_receipts / max(beta_users, 1)
        regular_avg = regular_receipts / max(regular_users, 1)
        
        print(f"\n{'='*60}")
        print("🧪 BETA TESTER ANALYSIS")
        print(f"{'='*60}")
        print(f"\n👥 USER DISTRIBUTION")
        print(f"   Beta Testers:       {beta_users} ({beta_users/max(total_users, 1)*100:.1f}%)")
        print(f"   Regular Users:      {regular_users} ({regular_users/max(total_users, 1)*100:.1f}%)")
        
        print(f"\n📊 ENGAGEMENT")
        print(f"   Beta Avg Receipts:  {beta_avg:.1f} per user")
        print(f"   Regular Avg:        {regular_avg:.1f} per user")
        
        if beta_avg > 0 and regular_avg > 0:
            multiplier = beta_avg / regular_avg
            print(f"   Beta Multiplier:    {multiplier:.1f}x more active")
        
        print(f"\n{'='*60}\n")


def export_to_csv(filename: str):
    """Export detailed usage report to CSV"""
    with get_db_session() as db:
        # Get all users with their stats
        results = db.query(
            User.id,
            User.email,
            User.full_name,
            User.subscription_plan,
            User.is_beta_tester,
            User.is_active,
            User.created_at,
            func.count(Receipt.id).label('receipt_count')
        ).outerjoin(Receipt, Receipt.user_id == User.id).group_by(
            User.id
        ).all()
        
        # Write to CSV
        with open(filename, 'w', newline='') as csvfile:
            writer = csv.writer(csvfile)
            writer.writerow([
                'User ID', 'Email', 'Full Name', 'Plan', 'Beta Tester', 
                'Active', 'Created', 'Receipt Count'
            ])
            
            for row in results:
                writer.writerow([
                    row.id,
                    row.email,
                    row.full_name or '',
                    row.subscription_plan,
                    'Yes' if row.is_beta_tester else 'No',
                    'Yes' if row.is_active else 'No',
                    row.created_at.strftime('%Y-%m-%d') if row.created_at else '',
                    row.receipt_count
                ])
        
        print(f"✅ Exported {len(results)} users to {filename}")


def print_usage():
    """Print usage instructions"""
    print(__doc__)


def main():
    if len(sys.argv) < 2:
        print_usage()
        sys.exit(1)
    
    command = sys.argv[1].lower()
    
    try:
        if command == "summary":
            show_summary()
        
        elif command == "top-users":
            limit = int(sys.argv[2]) if len(sys.argv) > 2 else 10
            show_top_users(limit)
        
        elif command == "monthly":
            show_monthly_stats()
        
        elif command == "beta-stats":
            show_beta_stats()
        
        elif command == "export":
            if len(sys.argv) < 3:
                print("❌ Error: CSV filename required")
                print("Usage: python scripts/usage_stats.py export filename.csv")
                sys.exit(1)
            export_to_csv(sys.argv[2])
        
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
