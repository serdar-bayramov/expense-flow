"""
Stripe API endpoints
"""
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
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
    - New subscriptions (free → paid)
    - Plan upgrades (professional → pro_plus)
    - Plan downgrades (pro_plus → professional)
    
    Note: If user has active subscription, they should use billing portal for cancellations.
    For plan changes, cancel the old subscription and create new one.
    """
    # Validate plan
    if request.plan not in ['professional', 'pro_plus']:
        raise HTTPException(status_code=400, detail="Invalid plan")
    
    # Check if user is trying to "upgrade" to their current plan
    if current_user.subscription_plan == request.plan:
        raise HTTPException(status_code=400, detail=f"You're already on the {request.plan} plan")
    
    # If user has active subscription to different plan, cancel it first
    if current_user.subscription_plan not in ['free', request.plan] and current_user.stripe_subscription_id:
        try:
            # Cancel current subscription
            await StripeService.cancel_subscription(current_user.stripe_subscription_id)
            # Update user immediately
            current_user.subscription_plan = 'free'
            current_user.stripe_subscription_id = None
            db.commit()
        except Exception as e:
            # Log but don't fail - user can still create new subscription
            print(f"Warning: Could not cancel old subscription: {e}")
    
    # Create checkout session
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
    Cancel user's active subscription immediately
    """
    if not current_user.stripe_subscription_id:
        raise HTTPException(status_code=400, detail="No active subscription to cancel")
    
    try:
        subscription_id = current_user.stripe_subscription_id
        
        # Cancel subscription immediately in Stripe
        await StripeService.cancel_subscription(subscription_id)
        
        # Update user in database immediately
        current_user.subscription_plan = 'free'
        current_user.subscription_status = 'canceled'
        current_user.stripe_subscription_id = None
        current_user.subscription_cancel_at_period_end = False
        current_user.subscription_current_period_end = None
        db.commit()
        
        print(f"✅ Subscription {subscription_id} cancelled for user {current_user.id} ({current_user.email})")
        
        return {"message": "Subscription cancelled successfully", "plan": "free"}
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
