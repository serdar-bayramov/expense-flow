"""
Subscription Service - Business logic for subscription management
Coordinates between Stripe and our database
"""
from sqlalchemy.orm import Session
from app.models.user import User
from app.services.stripe_service import StripeService
from app.core.database import settings
from datetime import datetime
from typing import Optional
import logging

logger = logging.getLogger(__name__)


class SubscriptionService:
    """Service for subscription operations"""
    
    @staticmethod
    async def ensure_stripe_customer(user: User, db: Session) -> str:
        """
        Ensure user has a Stripe customer ID, create if needed
        
        Args:
            user: User model instance
            db: Database session
        
        Returns:
            Stripe customer ID
        """
        if user.stripe_customer_id:
            return user.stripe_customer_id
        
        # Create Stripe customer
        customer = await StripeService.create_customer(
            email=user.email,
            name=user.full_name,
            metadata={
                'user_id': str(user.id),
                'clerk_user_id': user.clerk_user_id
            }
        )
        
        # Save customer ID to database
        user.stripe_customer_id = customer.id
        db.commit()
        db.refresh(user)
        
        return customer.id
    
    @staticmethod
    async def create_checkout_session(
        user: User,
        plan: str,
        db: Session
    ) -> str:
        """
        Create Stripe checkout session for plan upgrade
        
        Args:
            user: User model instance
            plan: Plan name ('professional' or 'pro_plus')
            db: Database session
        
        Returns:
            Checkout session URL
        """
        # Ensure customer exists
        customer_id = await SubscriptionService.ensure_stripe_customer(user, db)
        
        # Get price ID for plan
        price_id_map = {
            'professional': settings.STRIPE_PROFESSIONAL_PRICE_ID,
            'pro_plus': settings.STRIPE_PRO_PLUS_PRICE_ID,
        }
        
        price_id = price_id_map.get(plan)
        if not price_id:
            raise ValueError(f"Invalid plan: {plan}")
        
        # Create checkout session
        session = await StripeService.create_checkout_session(
            customer_id=customer_id,
            price_id=price_id,
            success_url=f"{settings.FRONTEND_URL}/dashboard/checkout/success?session_id={{CHECKOUT_SESSION_ID}}",
            cancel_url=f"{settings.FRONTEND_URL}/dashboard/checkout/cancel",
            metadata={
                'user_id': str(user.id),
                'plan': plan
            }
        )
        
        return session.url
    
    @staticmethod
    async def handle_subscription_created(subscription: dict, db: Session):
        """Handle subscription.created webhook"""
        try:
            customer_id = subscription['customer']
            subscription_id = subscription['id']
            
            # Find user by stripe_customer_id
            user = db.query(User).filter(User.stripe_customer_id == customer_id).first()
            if not user:
                logger.error(f"User not found for customer: {customer_id}")
                return
            
            # Determine plan from subscription
            price_id = subscription['items']['data'][0]['price']['id']
            plan_map = {
                settings.STRIPE_PROFESSIONAL_PRICE_ID: 'professional',
                settings.STRIPE_PRO_PLUS_PRICE_ID: 'pro_plus',
            }
            plan = plan_map.get(price_id, 'free')
            
            # Update user
            user.stripe_subscription_id = subscription_id
            user.subscription_plan = plan
            user.subscription_status = subscription['status']
            user.subscription_current_period_end = datetime.fromtimestamp(subscription['current_period_end'])
            user.subscription_cancel_at_period_end = subscription.get('cancel_at_period_end', False)
            
            db.commit()
            logger.info(f"✅ Subscription created for user {user.id} ({user.email}): {plan}")
        except Exception as e:
            logger.error(f"❌ Error in handle_subscription_created: {str(e)}")
            logger.error(f"Subscription data: {subscription}")
            raise
    
    @staticmethod
    async def handle_subscription_updated(subscription: dict, db: Session):
        """Handle subscription.updated webhook"""
        subscription_id = subscription['id']
        
        # Find user by subscription_id
        user = db.query(User).filter(User.stripe_subscription_id == subscription_id).first()
        if not user:
            logger.error(f"User not found for subscription: {subscription_id}")
            return
        
        # Update user
        user.subscription_status = subscription['status']
        user.subscription_current_period_end = datetime.fromtimestamp(subscription['current_period_end'])
        user.subscription_cancel_at_period_end = subscription.get('cancel_at_period_end', False)
        
        db.commit()
        logger.info(f"Subscription updated for user {user.id}")
    
    @staticmethod
    async def handle_subscription_deleted(subscription: dict, db: Session):
        """Handle subscription.deleted webhook"""
        subscription_id = subscription['id']
        
        # Find user
        user = db.query(User).filter(User.stripe_subscription_id == subscription_id).first()
        if not user:
            logger.error(f"User not found for subscription: {subscription_id}")
            return
        
        # Downgrade to free
        user.subscription_plan = 'free'
        user.subscription_status = 'canceled'
        user.stripe_subscription_id = None
        user.subscription_cancel_at_period_end = False
        
        db.commit()
        logger.info(f"Subscription deleted for user {user.id}")
