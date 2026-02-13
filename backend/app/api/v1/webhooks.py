"""
Webhook endpoints for Clerk user synchronization and Stripe subscription events
"""
from fastapi import APIRouter, Request, HTTPException, Depends
from sqlalchemy.orm import Session
import random
import string
import stripe
import logging

from app.core.database import get_db, settings
from app.models.user import User
from app.services.subscription_service import SubscriptionService

router = APIRouter()
logger = logging.getLogger(__name__)

# Initialize Stripe
stripe.api_key = settings.STRIPE_SECRET_KEY


def generate_unique_receipt_email(base_email: str) -> str:
    """Generate a unique receipt forwarding email address."""
    username = base_email.split('@')[0]
    random_suffix = ''.join(random.choices(string.ascii_lowercase + string.digits, k=6))
    return f"{username}-{random_suffix}@receipts.expenseflow.co.uk"


@router.post("/clerk")
async def clerk_webhook(request: Request, db: Session = Depends(get_db)):
    """
    Webhook endpoint for Clerk user events.
    
    Handles:
    - user.created: Create user in our database
    - user.updated: Update user information
    - user.deleted: Soft delete user
    
    Clerk sends webhooks when users sign up, update profile, or delete account.
    We sync this data to our database to maintain user records and business data.
    """
    try:
        payload = await request.json()
        event_type = payload.get("type")
        data = payload.get("data", {})
        
        if event_type == "user.created":
            # Extract user data from Clerk
            clerk_user_id = data.get("id")
            email_addresses = data.get("email_addresses", [])
            
            if not email_addresses:
                raise HTTPException(status_code=400, detail="No email address provided")
            
            primary_email = next(
                (e for e in email_addresses if e.get("id") == data.get("primary_email_address_id")),
                email_addresses[0]
            )
            email = primary_email.get("email_address")
            
            # Check if user already exists
            existing_user = db.query(User).filter(User.clerk_user_id == clerk_user_id).first()
            if existing_user:
                return {"status": "user already exists"}
            
            # Create new user in our database
            full_name = f"{data.get('first_name', '')} {data.get('last_name', '')}".strip()
            if not full_name:
                full_name = email.split('@')[0]
            
            new_user = User(
                clerk_user_id=clerk_user_id,
                email=email,
                full_name=full_name,
                unique_receipt_email=generate_unique_receipt_email(email),
                subscription_plan="free",
                is_active=True
            )
            
            db.add(new_user)
            db.commit()
            db.refresh(new_user)
            
            return {"status": "user created", "user_id": new_user.id}
        
        elif event_type == "user.updated":
            # Update user information
            clerk_user_id = data.get("id")
            user = db.query(User).filter(User.clerk_user_id == clerk_user_id).first()
            
            if not user:
                raise HTTPException(status_code=404, detail="User not found")
            
            # Update email if changed
            email_addresses = data.get("email_addresses", [])
            if email_addresses:
                primary_email = next(
                    (e for e in email_addresses if e.get("id") == data.get("primary_email_address_id")),
                    email_addresses[0]
                )
                user.email = primary_email.get("email_address")
            
            # Update name if provided
            full_name = f"{data.get('first_name', '')} {data.get('last_name', '')}".strip()
            if full_name:
                user.full_name = full_name
            
            db.commit()
            return {"status": "user updated"}
        
        elif event_type == "user.deleted":
            # Mark user as inactive (soft delete)
            clerk_user_id = data.get("id")
            user = db.query(User).filter(User.clerk_user_id == clerk_user_id).first()
            
            if user:
                user.is_active = False
                db.commit()
                return {"status": "user deactivated"}
        
        return {"status": "event processed"}
    
    except Exception as e:
        print(f"Clerk webhook error: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Webhook processing failed: {str(e)}")


@router.post("/stripe")
async def stripe_webhook(
    request: Request,
    db: Session = Depends(get_db)
):
    """
    Webhook endpoint for Stripe subscription events.
    
    Handles:
    - checkout.session.completed: Payment successful
    - customer.subscription.created: New subscription activated
    - customer.subscription.updated: Subscription modified
    - customer.subscription.deleted: Subscription cancelled
    - invoice.payment_succeeded: Payment received
    - invoice.payment_failed: Payment failed
    """
    payload = await request.body()
    sig_header = request.headers.get('stripe-signature')
    
    try:
        event = stripe.Webhook.construct_event(
            payload, sig_header, settings.STRIPE_WEBHOOK_SECRET
        )
    except ValueError:
        logger.error("Invalid payload")
        raise HTTPException(status_code=400, detail="Invalid payload")
    except stripe.error.SignatureVerificationError:
        logger.error("Invalid signature")
        raise HTTPException(status_code=400, detail="Invalid signature")
    
    # Handle the event
    event_type = event['type']
    data = event['data']['object']
    
    logger.info(f"Received Stripe webhook: {event_type}")
    
    try:
        if event_type == 'checkout.session.completed':
            # Payment successful, retrieve subscription details
            logger.info(f"Checkout completed: {data['id']}")
            # Get the subscription ID from the checkout session
            subscription_id = data.get('subscription')
            if subscription_id:
                # Retrieve full subscription object from Stripe
                subscription = stripe.Subscription.retrieve(subscription_id)
                await SubscriptionService.handle_subscription_created(subscription, db)
        
        elif event_type == 'customer.subscription.created':
            await SubscriptionService.handle_subscription_created(data, db)
        
        elif event_type == 'customer.subscription.updated':
            await SubscriptionService.handle_subscription_updated(data, db)
        
        elif event_type == 'customer.subscription.deleted':
            await SubscriptionService.handle_subscription_deleted(data, db)
        
        elif event_type == 'invoice.payment_succeeded':
            logger.info(f"Payment succeeded: {data['id']}")
        
        elif event_type == 'invoice.payment_failed':
            logger.warning(f"Payment failed: {data['id']}")
            # Immediate downgrade to free on payment failure
            await SubscriptionService.handle_payment_failed(data, db)
        
        else:
            logger.info(f"Unhandled event type: {event_type}")
    
    except Exception as e:
        logger.error(f"Error handling webhook: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))
    
    return {"status": "success"}