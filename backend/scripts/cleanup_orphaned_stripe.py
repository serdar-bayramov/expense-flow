#!/usr/bin/env python3
"""
Script to clean up orphaned Stripe customers/subscriptions
Use this when users are deleted from database but still exist in Stripe
"""
import sys
import os

# Add parent directory to path so we can import app modules
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))

import stripe
from sqlalchemy.orm import Session
from app.core.database import engine, settings
from app.models.user import User

stripe.api_key = settings.STRIPE_SECRET_KEY


def find_orphaned_customers():
    """Find Stripe customers that don't exist in our database"""
    print("🔍 Scanning for orphaned Stripe customers...")
    
    orphaned = []
    
    # Get all customers from Stripe
    customers = stripe.Customer.list(limit=100)
    
    with Session(engine) as db:
        for customer in customers.auto_paging_iter():
            customer_id = customer.id
            email = customer.email
            
            # Check if customer exists in our database
            user = db.query(User).filter(User.stripe_customer_id == customer_id).first()
            
            if not user:
                # Check if user exists by email
                user_by_email = db.query(User).filter(User.email == email).first()
                if not user_by_email:
                    orphaned.append({
                        'id': customer_id,
                        'email': email,
                        'subscriptions': [sub.id for sub in customer.subscriptions.data] if customer.subscriptions else []
                    })
    
    return orphaned


def cleanup_customer(customer_id: str, cancel_subscriptions: bool = True):
    """Clean up a specific customer and their subscriptions"""
    try:
        customer = stripe.Customer.retrieve(customer_id)
        
        if cancel_subscriptions and customer.subscriptions:
            for subscription in customer.subscriptions.data:
                print(f"  ❌ Cancelling subscription: {subscription.id}")
                stripe.Subscription.delete(subscription.id)
        
        # Delete the customer
        stripe.Customer.delete(customer_id)
        print(f"  ✅ Deleted customer: {customer_id}")
        return True
    except Exception as e:
        print(f"  ⚠️ Error cleaning up {customer_id}: {e}")
        return False


def main():
    print("=" * 60)
    print("Stripe Orphaned Customer Cleanup")
    print("=" * 60)
    
    orphaned = find_orphaned_customers()
    
    if not orphaned:
        print("✅ No orphaned customers found!")
        return
    
    print(f"\n🔍 Found {len(orphaned)} orphaned customer(s):\n")
    
    for idx, customer in enumerate(orphaned, 1):
        print(f"{idx}. Customer ID: {customer['id']}")
        print(f"   Email: {customer['email']}")
        if customer['subscriptions']:
            print(f"   Subscriptions: {', '.join(customer['subscriptions'])}")
        else:
            print(f"   Subscriptions: None")
        print()
    
    response = input("\n⚠️  Do you want to delete these customers from Stripe? (yes/no): ")
    
    if response.lower() != 'yes':
        print("❌ Cancelled. No changes made.")
        return
    
    print("\n🔄 Cleaning up orphaned customers...\n")
    
    success_count = 0
    for customer in orphaned:
        print(f"Processing: {customer['email']}")
        if cleanup_customer(customer['id'], cancel_subscriptions=True):
            success_count += 1
        print()
    
    print("=" * 60)
    print(f"✅ Cleanup complete: {success_count}/{len(orphaned)} customers deleted")
    print("=" * 60)


if __name__ == "__main__":
    main()
