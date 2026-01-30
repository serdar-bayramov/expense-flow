#!/usr/bin/env python
"""Quick script to sync subscription status from Stripe to database"""
import stripe
from app.core.database import SessionLocal, settings
from app.models.user import User

stripe.api_key = settings.STRIPE_SECRET_KEY
db = SessionLocal()

try:
    # Get the subscription from Stripe
    sub = stripe.Subscription.retrieve('sub_1SvMUu3dDzzcSrzsELOrXEAp')
    
    # Find user
    user = db.query(User).filter(User.stripe_subscription_id == sub.id).first()
    
    if user:
        print(f'Current DB state:')
        print(f'  subscription_cancel_at_period_end: {user.subscription_cancel_at_period_end}')
        print(f'  subscription_plan: {user.subscription_plan}')
        print(f'')
        print(f'Stripe state:')
        print(f'  cancel_at_period_end: {sub.cancel_at_period_end}')
        print(f'  status: {sub.status}')
        print(f'')
        
        # Sync from Stripe
        user.subscription_cancel_at_period_end = sub.cancel_at_period_end
        user.subscription_status = sub.status
        db.commit()
        
        print(f'✅ Synced! DB now matches Stripe')
    else:
        print(f'❌ User not found for subscription {sub.id}')
finally:
    db.close()
