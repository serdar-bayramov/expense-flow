#!/usr/bin/env python3
"""
Quick script to sync a user's subscription from Stripe to database
"""
import stripe
import os
from dotenv import load_dotenv
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from app.models.user import User
from datetime import datetime

load_dotenv()

# Setup
stripe.api_key = os.getenv('STRIPE_SECRET_KEY')
engine = create_engine(os.getenv('DATABASE_URL'))
Session = sessionmaker(bind=engine)
db = Session()

# Which user to sync
email = input("Enter email to sync: ").strip()

try:
    user = db.query(User).filter(User.email == email).first()
    if not user:
        print(f"❌ User not found: {email}")
        exit(1)
    
    print(f"📋 Current DB state:")
    print(f"   Plan: {user.subscription_plan}")
    print(f"   Subscription ID: {user.stripe_subscription_id}")
    print(f"   Customer ID: {user.stripe_customer_id}")
    print(f"   Status: {user.subscription_status}")
    
    if not user.stripe_customer_id:
        print("❌ No Stripe customer ID")
        exit(1)
    
    # Get all subscriptions for this customer
    subscriptions = stripe.Subscription.list(customer=user.stripe_customer_id)
    
    print(f"\n🔍 Found {len(subscriptions.data)} subscription(s) in Stripe:")
    for i, sub in enumerate(subscriptions.data, 1):
        price_id = sub['items']['data'][0]['price']['id']
        print(f"\n  {i}. {sub.id}")
        print(f"     Status: {sub.status}")
        print(f"     Price ID: {price_id}")
        print(f"     Cancel at period end: {sub.cancel_at_period_end}")
        print(f"     Created: {datetime.fromtimestamp(sub.created)}")
    
    if not subscriptions.data:
        print("\n⚠️ No subscriptions found")
        exit(0)
    
    # Find the active subscription (not cancelled)
    active_sub = None
    for sub in subscriptions.data:
        if sub.status == 'active' and not sub.cancel_at_period_end:
            active_sub = sub
            break
    
    if not active_sub:
        # If no truly active, use the most recent one
        active_sub = subscriptions.data[0]
    
    print(f"\n✅ Using subscription: {active_sub.id}")
    
    # Map price ID to plan
    price_id = active_sub['items']['data'][0]['price']['id']
    plan_map = {
        os.getenv('STRIPE_PROFESSIONAL_PRICE_ID'): 'professional',
        os.getenv('STRIPE_PRO_PLUS_PRICE_ID'): 'pro_plus',
    }
    plan = plan_map.get(price_id, 'free')
    
    print(f"\n📦 Mapping:")
    print(f"   Price ID: {price_id}")
    print(f"   -> Plan: {plan}")
    
    # Update user
    user.stripe_subscription_id = active_sub.id
    user.subscription_plan = plan
    user.subscription_status = active_sub.status
    user.subscription_cancel_at_period_end = active_sub.get('cancel_at_period_end', False)
    
    # Get current_period_end - check subscription level first, then items
    current_period_end = active_sub.get('current_period_end')
    if not current_period_end and active_sub.get('items', {}).get('data'):
        # In newer Stripe API versions, it's nested in items
        current_period_end = active_sub['items']['data'][0].get('current_period_end')
    
    if current_period_end:
        user.subscription_current_period_end = datetime.fromtimestamp(current_period_end)
        print(f"   Period end date: {datetime.fromtimestamp(current_period_end).strftime('%Y-%m-%d %H:%M:%S')}")
    else:
        print("   ⚠️ No current_period_end found")
    
    db.commit()
    
    print(f"\n✅ Updated database:")
    print(f"   Plan: {user.subscription_plan}")
    print(f"   Subscription ID: {user.stripe_subscription_id}")
    print(f"   Status: {user.subscription_status}")
    print(f"   Cancel at period end: {user.subscription_cancel_at_period_end}")
    
except Exception as e:
    print(f"\n❌ Error: {e}")
    db.rollback()
finally:
    db.close()
