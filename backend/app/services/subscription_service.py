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
            # Log the full subscription data for debugging
            logger.info(f"Processing subscription data: {type(subscription)}")
            
            customer_id = subscription.get('customer')
            subscription_id = subscription.get('id')
            
            if not customer_id or not subscription_id:
                logger.error(f"Missing customer_id or subscription_id in data")
                return
            
            # Find user by stripe_customer_id
            user = db.query(User).filter(User.stripe_customer_id == customer_id).first()
            if not user:
                logger.error(f"User not found for customer: {customer_id}")
                return
            
            # Determine plan from subscription
            items = subscription.get('items', {})
            if isinstance(items, dict):
                data = items.get('data', [])
            else:
                data = items
                
            if not data:
                logger.error(f"No items found in subscription")
                return
                
            price_id = data[0].get('price', {}).get('id') if isinstance(data[0].get('price'), dict) else data[0].get('plan', {}).get('id')
            
            plan_map = {
                settings.STRIPE_PROFESSIONAL_PRICE_ID: 'professional',
                settings.STRIPE_PRO_PLUS_PRICE_ID: 'pro_plus',
            }
            plan = plan_map.get(price_id, 'free')
            
            # Get current_period_end - could be at subscription level or item level
            current_period_end = subscription.get('current_period_end')
            if not current_period_end and data:
                current_period_end = data[0].get('current_period_end')
            
            if not current_period_end:
                logger.error(f"Could not find current_period_end in subscription data")
                return
            
            # Update user
            user.stripe_subscription_id = subscription_id
            user.subscription_plan = plan
            user.subscription_status = subscription.get('status', 'active')
            user.subscription_current_period_end = datetime.fromtimestamp(current_period_end)
            user.subscription_cancel_at_period_end = subscription.get('cancel_at_period_end', False)
            
            db.commit()
            logger.info(f"✅ Subscription created for user {user.id} ({user.email}): {plan}")
        except Exception as e:
            logger.error(f"❌ Error in handle_subscription_created: {str(e)}")
            import traceback
            logger.error(traceback.format_exc())
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
        
        # Get the cancel_at_period_end flag
        cancel_at_period_end = subscription.get('cancel_at_period_end', False)
        old_cancel_flag = user.subscription_cancel_at_period_end
        
        # Update user
        user.subscription_status = subscription['status']
        user.subscription_current_period_end = datetime.fromtimestamp(subscription['current_period_end'])
        user.subscription_cancel_at_period_end = cancel_at_period_end
        
        db.commit()
        
        # Log the change clearly
        if old_cancel_flag and not cancel_at_period_end:
            logger.info(f"✅ Subscription {subscription_id} REACTIVATED for user {user.id} ({user.email})")
        elif not old_cancel_flag and cancel_at_period_end:
            logger.info(f"⚠️ Subscription {subscription_id} will cancel at period end for user {user.id} ({user.email})")
        else:
            logger.info(f"📝 Subscription {subscription_id} updated for user {user.id}: status={subscription['status']}, cancel_at_period_end={cancel_at_period_end}")
    
    @staticmethod
    async def handle_subscription_deleted(subscription: dict, db: Session):
        """Handle subscription.deleted webhook"""
        subscription_id = subscription['id']
        
        # Find user
        user = db.query(User).filter(User.stripe_subscription_id == subscription_id).first()
        if not user:
            logger.warning(f"User not found for subscription: {subscription_id} (may have been manually cancelled)")
            return
        
        # Check if already cancelled (to avoid race condition with manual cancellation)
        if user.subscription_plan == 'free' and user.subscription_status == 'canceled':
            logger.info(f"Subscription {subscription_id} already cancelled for user {user.id} (likely manual cancellation)")
            return
        
        # Downgrade to free
        user.subscription_plan = 'free'
        user.subscription_status = 'canceled'
        user.stripe_subscription_id = None
        user.subscription_cancel_at_period_end = False
        user.subscription_current_period_end = None
        
        db.commit()
        logger.info(f"Subscription deleted for user {user.id} via webhook")
