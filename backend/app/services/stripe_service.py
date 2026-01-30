"""
Stripe Service - Abstraction layer for Stripe API
Handles all direct Stripe API interactions
"""
import stripe
from typing import Optional, Dict, Any
from app.core.database import settings
from fastapi import HTTPException
import logging

logger = logging.getLogger(__name__)

# Initialize Stripe
stripe.api_key = settings.STRIPE_SECRET_KEY

# Debug: Log if API key is set (first/last 4 chars only for security)
if stripe.api_key:
    logger.info(f"✅ Stripe API key loaded: {stripe.api_key[:7]}...{stripe.api_key[-4:]}")
else:
    logger.error("❌ Stripe API key is empty!")


class StripeService:
    """Service for Stripe operations"""
    
    @staticmethod
    async def create_customer(email: str, name: Optional[str] = None, metadata: Optional[Dict] = None) -> stripe.Customer:
        """
        Create a Stripe customer
        
        Args:
            email: Customer email
            name: Customer name
            metadata: Additional metadata (user_id, etc.)
        
        Returns:
            Stripe Customer object
        """
        try:
            customer = stripe.Customer.create(
                email=email,
                name=name,
                metadata=metadata or {}
            )
            logger.info(f"Created Stripe customer: {customer.id} for {email}")
            return customer
        except stripe.error.StripeError as e:
            logger.error(f"Failed to create Stripe customer: {str(e)}")
            raise HTTPException(status_code=400, detail=f"Stripe error: {str(e)}")
    
    @staticmethod
    async def create_checkout_session(
        customer_id: str,
        price_id: str,
        success_url: str,
        cancel_url: str,
        metadata: Optional[Dict] = None
    ) -> stripe.checkout.Session:
        """
        Create a Stripe Checkout session for subscription
        
        Args:
            customer_id: Stripe customer ID
            price_id: Stripe price ID
            success_url: Redirect URL on success
            cancel_url: Redirect URL on cancel
            metadata: Additional metadata
        
        Returns:
            Stripe Checkout Session
        """
        try:
            session = stripe.checkout.Session.create(
                customer=customer_id,
                mode='subscription',
                payment_method_types=['card'],
                line_items=[{
                    'price': price_id,
                    'quantity': 1,
                }],
                success_url=success_url,
                cancel_url=cancel_url,
                metadata=metadata or {},
                allow_promotion_codes=True,  # Allow discount codes
                billing_address_collection='auto',
            )
            logger.info(f"Created checkout session: {session.id}")
            return session
        except stripe.error.StripeError as e:
            logger.error(f"Failed to create checkout session: {str(e)}")
            raise HTTPException(status_code=400, detail=f"Stripe error: {str(e)}")
    
    @staticmethod
    async def get_subscription(subscription_id: str) -> stripe.Subscription:
        """Get subscription details"""
        try:
            return stripe.Subscription.retrieve(subscription_id)
        except stripe.error.StripeError as e:
            logger.error(f"Failed to retrieve subscription: {str(e)}")
            raise HTTPException(status_code=400, detail=f"Stripe error: {str(e)}")
    
    @staticmethod
    async def cancel_subscription(subscription_id: str, at_period_end: bool = True) -> stripe.Subscription:
        """
        Cancel a subscription
        
        Args:
            subscription_id: Stripe subscription ID
            at_period_end: If True, cancel at period end. If False, cancel immediately.
        
        Returns:
            Updated Stripe Subscription
        """
        try:
            if at_period_end:
                subscription = stripe.Subscription.modify(
                    subscription_id,
                    cancel_at_period_end=True
                )
            else:
                subscription = stripe.Subscription.delete(subscription_id)
            
            logger.info(f"Cancelled subscription: {subscription_id}, at_period_end={at_period_end}")
            return subscription
        except stripe.error.StripeError as e:
            logger.error(f"Failed to cancel subscription: {str(e)}")
            raise HTTPException(status_code=400, detail=f"Stripe error: {str(e)}")
    
    @staticmethod
    async def update_subscription(
        subscription_id: str, 
        new_price_id: str,
        is_upgrade: bool = True
    ) -> stripe.Subscription:
        """
        Update subscription to new price (upgrade/downgrade) using Stripe's standard implementation
        
        Args:
            subscription_id: Stripe subscription ID
            new_price_id: New Stripe price ID
            is_upgrade: If True (upgrade), prorate immediately. If False (downgrade), credit at period end.
        
        Returns:
            Updated Stripe Subscription
        """
        try:
            subscription = stripe.Subscription.retrieve(subscription_id)
            subscription_item_id = subscription['items']['data'][0]['id']
            
            # Standard Stripe implementation: Just modify the subscription
            # proration_behavior controls when changes take effect
            if is_upgrade:
                # UPGRADE: Immediate with prorated charge
                updated_sub = stripe.Subscription.modify(
                    subscription_id,
                    items=[{
                        'id': subscription_item_id,
                        'price': new_price_id,
                    }],
                    proration_behavior='create_prorations',  # Charge difference immediately
                    cancel_at_period_end=False,  # Remove cancellation if present
                )
                logger.info(f"⬆️  UPGRADED subscription {subscription_id} to {new_price_id}")
                if subscription.get('cancel_at_period_end'):
                    logger.info(f"✅ Reactivated subscription (was scheduled to cancel)")
            else:
                # DOWNGRADE: Immediate switch with prorated credit
                # Stripe gives credit for unused time on old plan
                updated_sub = stripe.Subscription.modify(
                    subscription_id,
                    items=[{
                        'id': subscription_item_id,
                        'price': new_price_id,
                    }],
                    proration_behavior='create_prorations',  # Credit for unused time
                )
                logger.info(f"⬇️  DOWNGRADED subscription {subscription_id} to {new_price_id}")
            
            return updated_sub
        except stripe.error.StripeError as e:
            logger.error(f"Failed to update subscription: {str(e)}")
            raise HTTPException(status_code=400, detail=f"Stripe error: {str(e)}")
    
    @staticmethod
    async def create_billing_portal_session(customer_id: str, return_url: str) -> stripe.billing_portal.Session:
        """
        Create a billing portal session for customer to manage subscription
        
        Args:
            customer_id: Stripe customer ID
            return_url: URL to return after portal session
        
        Returns:
            Stripe Billing Portal Session
        """
        try:
            session = stripe.billing_portal.Session.create(
                customer=customer_id,
                return_url=return_url,
            )
            logger.info(f"Created billing portal session for customer: {customer_id}")
            return session
        except stripe.error.StripeError as e:
            logger.error(f"Failed to create billing portal session: {str(e)}")
            raise HTTPException(status_code=400, detail=f"Stripe error: {str(e)}")
