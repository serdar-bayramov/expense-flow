"""
Stripe API endpoints
"""
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from datetime import datetime
import logging
from app.api.deps import get_db, get_current_user
from app.models.user import User
from app.services.subscription_service import SubscriptionService
from app.services.stripe_service import StripeService
from app.schemas.stripe import CheckoutSessionRequest, CheckoutSessionResponse, BillingPortalResponse
from app.core.database import settings

router = APIRouter()


@router.post("/create-checkout-session", response_model=CheckoutSessionResponse)
async def create_checkout_session(
    request: CheckoutSessionRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Create Stripe Checkout session for plan upgrade/change
    
    Handles:
    - New subscriptions (free → paid): Create new subscription
    - Plan upgrades (professional → pro_plus): Immediate via Stripe modify
    - Plan downgrades (pro_plus → professional): Scheduled for period end via Stripe modify
    """
    # Validate plan
    if request.plan not in ['professional', 'pro_plus']:
        raise HTTPException(status_code=400, detail="Invalid plan")
    
    # Check if user is trying to "upgrade" to their current plan
    if current_user.subscription_plan == request.plan:
        raise HTTPException(status_code=400, detail=f"You're already on the {request.plan} plan")
    
    # Define plan hierarchy for upgrade/downgrade detection
    plan_hierarchy = {'free': 0, 'professional': 1, 'pro_plus': 2}
    current_tier = plan_hierarchy.get(current_user.subscription_plan, 0)
    new_tier = plan_hierarchy.get(request.plan, 0)
    is_upgrade = new_tier > current_tier
    
    # If user has active subscription, modify it instead of creating new one
    if current_user.subscription_plan != 'free' and current_user.stripe_subscription_id:
        try:
            # Get price ID for new plan
            price_id = settings.STRIPE_PROFESSIONAL_PRICE_ID if request.plan == 'professional' else settings.STRIPE_PRO_PLUS_PRICE_ID
            
            # Modify existing subscription (upgrade immediately, downgrade at period end)
            await StripeService.update_subscription(
                subscription_id=current_user.stripe_subscription_id,
                new_price_id=price_id,
                is_upgrade=is_upgrade
            )
            
            if is_upgrade:
                # Upgrade: Update DB immediately
                current_user.subscription_plan = request.plan
                db.commit()
                return CheckoutSessionResponse(
                    url=f"{settings.FRONTEND_URL}/dashboard/settings?upgraded=true",
                    message=f"Upgraded to {request.plan}! Changes applied immediately."
                )
            else:
                # Downgrade: Will be applied at period end via webhook
                # Don't update plan in DB yet - webhook will do it
                db.commit()
                period_end = current_user.subscription_current_period_end
                return CheckoutSessionResponse(
                    url=f"{settings.FRONTEND_URL}/dashboard/settings?downgraded=true",
                    message=f"You'll switch to {request.plan} on {period_end.strftime('%b %d, %Y')}. You keep your current plan until then!"
                )
        except Exception as e:
            db.rollback()
            print(f"❌ Failed to modify subscription: {e}")
            raise HTTPException(status_code=500, detail=f"Failed to change plan: {str(e)}")
    
    # Free user upgrading to paid plan - create new checkout session
    url = await SubscriptionService.create_checkout_session(
        user=current_user,
        plan=request.plan,
        db=db
    )
    
    return CheckoutSessionResponse(url=url)


@router.post("/create-billing-portal-session", response_model=BillingPortalResponse)
async def create_billing_portal_session(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Create Stripe Billing Portal session for subscription management
    """
    # Ensure customer exists
    customer_id = await SubscriptionService.ensure_stripe_customer(current_user, db)
    
    # Create portal session
    session = await StripeService.create_billing_portal_session(
        customer_id=customer_id,
        return_url=f"{settings.FRONTEND_URL}/dashboard/settings"
    )
    
    return BillingPortalResponse(url=session.url)


@router.post("/cancel-subscription")
async def cancel_subscription(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Cancel user's subscription at end of billing period.
    User keeps access until they've paid for.
    """
    if not current_user.stripe_subscription_id:
        raise HTTPException(status_code=400, detail="No active subscription to cancel")
    
    try:
        subscription_id = current_user.stripe_subscription_id
        
        # Cancel subscription at period end (fair to user - they paid for full month)
        subscription = await StripeService.cancel_subscription(subscription_id, at_period_end=True)
        
        # Update user in database - keep plan active until period end
        current_user.subscription_cancel_at_period_end = True
        # Don't change plan yet - will be downgraded via webhook when period ends
        db.commit()
        
        period_end = current_user.subscription_current_period_end
        print(f"✅ Subscription {subscription_id} scheduled to cancel at period end for user {current_user.id} ({current_user.email})")
        
        return {
            "message": "Subscription will be cancelled at period end",
            "cancel_at_period_end": True,
            "period_end": period_end.isoformat() if period_end else None
        }
    except Exception as e:
        db.rollback()
        print(f"❌ Failed to cancel subscription for user {current_user.id}: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to cancel subscription: {str(e)}")


@router.get("/subscription-status")
async def get_subscription_status(
    current_user: User = Depends(get_current_user)
):
    """
    Get current user's subscription status
    """
    return {
        "plan": current_user.subscription_plan,
        "status": current_user.subscription_status,
        "current_period_end": current_user.subscription_current_period_end,
        "cancel_at_period_end": current_user.subscription_cancel_at_period_end,
        "stripe_customer_id": current_user.stripe_customer_id,
    }


@router.post("/sync-subscription")
async def sync_subscription_from_stripe(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Manually sync subscription status from Stripe (useful if webhooks fail)
    """
    if not current_user.stripe_subscription_id:
        raise HTTPException(status_code=400, detail="No active subscription")
    
    try:
        # Fetch current subscription from Stripe
        subscription = await StripeService.get_subscription(current_user.stripe_subscription_id)
        
        # Extract current_period_end - handle both old and new API versions
        current_period_end = getattr(subscription, 'current_period_end', None)
        if not current_period_end and hasattr(subscription, 'items') and subscription.items.data:
            # Fallback: get from first subscription item (new API version)
            current_period_end = subscription.items.data[0].current_period_end
        
        # Update database with current Stripe data
        current_user.subscription_status = subscription.status
        current_user.subscription_cancel_at_period_end = subscription.cancel_at_period_end
        if current_period_end:
            current_user.subscription_current_period_end = datetime.fromtimestamp(current_period_end)
        db.commit()
        
        return {
            "message": "Subscription synced successfully",
            "cancel_at_period_end": subscription.cancel_at_period_end,
            "status": subscription.status
        }
    except Exception as e:
        db.rollback()
        logger.error(f"Failed to sync subscription: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to sync: {str(e)}")
