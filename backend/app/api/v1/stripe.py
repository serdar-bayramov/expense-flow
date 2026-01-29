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
    Create Stripe Checkout session for plan upgrade
    """
    # Validate plan
    if request.plan not in ['professional', 'pro_plus']:
        raise HTTPException(status_code=400, detail="Invalid plan")
    
    # Check if user already has active subscription
    if current_user.subscription_plan != 'free':
        raise HTTPException(status_code=400, detail="User already has active subscription. Use billing portal to manage.")
    
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
