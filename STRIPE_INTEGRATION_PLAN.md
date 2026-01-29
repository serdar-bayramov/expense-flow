# Stripe Integration Plan - ExpenseFlow

## 🎯 Overview

This document outlines a clean, maintainable implementation of Stripe subscriptions following our existing architecture patterns with proper service abstraction.

---

## 📋 Integration Goals

- ✅ Allow users to upgrade from Free → Professional → Pro Plus
- ✅ Handle subscription lifecycle (create, upgrade, downgrade, cancel)
- ✅ Sync subscription status with our database
- ✅ Integrate seamlessly with Clerk authentication
- ✅ Use Stripe Checkout (hosted, PCI-compliant)
- ✅ Handle webhooks for subscription events
- ✅ Proper error handling and logging

---

## 🏗️ Architecture Overview

```
Frontend (Next.js)
├── Stripe Checkout Session (redirect)
└── Success/Cancel pages

Backend (FastAPI)
├── Stripe Service (abstraction layer)
├── Subscription API endpoints
├── Webhook handler
└── Database models (existing User model)

Database
└── User table (subscription_plan, subscription_status, stripe_customer_id, stripe_subscription_id)
```

---

## 📁 File Structure

### Backend

```
backend/
├── app/
│   ├── services/
│   │   ├── stripe_service.py          # NEW - Stripe abstraction layer
│   │   └── subscription_service.py     # NEW - Subscription business logic
│   ├── api/
│   │   └── v1/
│   │       ├── stripe.py               # NEW - Stripe endpoints
│   │       └── webhooks.py             # NEW - Webhook handler
│   ├── models/
│   │   └── user.py                     # UPDATE - Add Stripe fields
│   ├── schemas/
│   │   └── stripe.py                   # NEW - Stripe schemas
│   └── core/
│       └── config.py                   # UPDATE - Add Stripe keys
├── alembic/
│   └── versions/
│       └── xxx_add_stripe_fields.py    # NEW - Migration
└── requirements.txt                    # UPDATE - Add stripe package
```

### Frontend

```
frontend/
├── lib/
│   └── stripe.ts                       # NEW - Stripe client utilities
├── app/
│   └── dashboard/
│       └── checkout/
│           ├── success/
│           │   └── page.tsx            # NEW - Success page
│           └── cancel/
│               └── page.tsx            # NEW - Cancel page
└── components/
    └── upgrade-plan-dialog.tsx         # UPDATE - Add Stripe checkout
```

---

## 🔧 Implementation Steps

### Phase 1: Setup & Configuration (30 minutes)

#### 1.1 Stripe Account Setup
- [ ] Sign up at https://stripe.com/gb
- [ ] Complete business verification
- [ ] Enable test mode
- [ ] Get API keys (Publishable & Secret)

#### 1.2 Create Stripe Products
- [ ] Create "Professional" product (£10/month recurring)
- [ ] Create "Pro Plus" product (£17/month recurring)
- [ ] Copy Price IDs (price_xxx)

#### 1.3 Backend Configuration

**File:** `backend/app/core/config.py`

```python
class Settings(BaseSettings):
    # ... existing fields ...
    
    # Stripe Configuration
    STRIPE_SECRET_KEY: str
    STRIPE_PUBLISHABLE_KEY: str
    STRIPE_WEBHOOK_SECRET: str
    STRIPE_PROFESSIONAL_PRICE_ID: str = "price_xxx"  # From Stripe dashboard
    STRIPE_PRO_PLUS_PRICE_ID: str = "price_xxx"      # From Stripe dashboard
    
    # Frontend URL for redirects
    FRONTEND_URL: str = "http://localhost:3000"  # Update for production
```

**File:** `backend/.env`

```bash
STRIPE_SECRET_KEY=sk_test_...
STRIPE_PUBLISHABLE_KEY=pk_test_...
STRIPE_WEBHOOK_SECRET=whsec_...
STRIPE_PROFESSIONAL_PRICE_ID=price_...
STRIPE_PRO_PLUS_PRICE_ID=price_...
```

#### 1.4 Install Dependencies

```bash
cd backend
pip install stripe
pip freeze > requirements.txt
```

---

### Phase 2: Database Schema (15 minutes)

#### 2.1 Update User Model

**File:** `backend/app/models/user.py`

```python
class User(Base):
    __tablename__ = "users"
    
    # ... existing fields ...
    
    # Stripe fields
    stripe_customer_id = Column(String, nullable=True, index=True)
    stripe_subscription_id = Column(String, nullable=True, index=True)
    subscription_plan = Column(String, default="free")  # Already exists
    subscription_status = Column(String, default="active")  # Already exists
    subscription_current_period_end = Column(DateTime(timezone=True), nullable=True)
    subscription_cancel_at_period_end = Column(Boolean, default=False)
```

#### 2.2 Create Migration

```bash
cd backend
alembic revision --autogenerate -m "add_stripe_fields_to_users"
alembic upgrade head
```

---

### Phase 3: Backend Services (1 hour)

#### 3.1 Stripe Service (Abstraction Layer)

**File:** `backend/app/services/stripe_service.py`

```python
"""
Stripe Service - Abstraction layer for Stripe API
Handles all direct Stripe API interactions
"""
import stripe
from typing import Optional, Dict, Any
from app.core.config import Settings
from fastapi import HTTPException
import logging

logger = logging.getLogger(__name__)
settings = Settings()

# Initialize Stripe
stripe.api_key = settings.STRIPE_SECRET_KEY


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
    async def update_subscription(subscription_id: str, new_price_id: str) -> stripe.Subscription:
        """
        Update subscription to new price (upgrade/downgrade)
        
        Args:
            subscription_id: Stripe subscription ID
            new_price_id: New Stripe price ID
        
        Returns:
            Updated Stripe Subscription
        """
        try:
            subscription = stripe.Subscription.retrieve(subscription_id)
            
            # Update the subscription item
            stripe.Subscription.modify(
                subscription_id,
                items=[{
                    'id': subscription['items']['data'][0].id,
                    'price': new_price_id,
                }],
                proration_behavior='create_prorations',  # Prorate the charge
            )
            
            logger.info(f"Updated subscription: {subscription_id} to price: {new_price_id}")
            return stripe.Subscription.retrieve(subscription_id)
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
```

#### 3.2 Subscription Service (Business Logic)

**File:** `backend/app/services/subscription_service.py`

```python
"""
Subscription Service - Business logic for subscription management
Coordinates between Stripe and our database
"""
from sqlalchemy.orm import Session
from app.models.user import User
from app.services.stripe_service import StripeService
from app.core.config import Settings
from datetime import datetime
from typing import Optional
import logging

logger = logging.getLogger(__name__)
settings = Settings()


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
        logger.info(f"Subscription created for user {user.id}: {plan}")
    
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
```

---

### Phase 4: API Endpoints (45 minutes)

#### 4.1 Stripe Schemas

**File:** `backend/app/schemas/stripe.py`

```python
from pydantic import BaseModel


class CheckoutSessionRequest(BaseModel):
    plan: str  # 'professional' or 'pro_plus'


class CheckoutSessionResponse(BaseModel):
    url: str


class BillingPortalResponse(BaseModel):
    url: str
```

#### 4.2 Stripe Endpoints

**File:** `backend/app/api/v1/stripe.py`

```python
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
from app.core.config import Settings

router = APIRouter()
settings = Settings()


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
        raise HTTPException(status_code=400, detail="User already has active subscription")
    
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
```

#### 4.3 Webhook Handler

**File:** `backend/app/api/v1/webhooks.py`

```python
"""
Stripe Webhook Handler
"""
from fastapi import APIRouter, Request, HTTPException, Depends
from sqlalchemy.orm import Session
from app.api.deps import get_db
from app.services.subscription_service import SubscriptionService
from app.core.config import Settings
import stripe
import logging

router = APIRouter()
settings = Settings()
logger = logging.getLogger(__name__)

stripe.api_key = settings.STRIPE_SECRET_KEY


@router.post("/stripe")
async def stripe_webhook(
    request: Request,
    db: Session = Depends(get_db)
):
    """
    Handle Stripe webhooks
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
    
    logger.info(f"Received webhook: {event_type}")
    
    try:
        if event_type == 'checkout.session.completed':
            # Payment successful, subscription created
            logger.info(f"Checkout completed: {data['id']}")
        
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
        
        else:
            logger.info(f"Unhandled event type: {event_type}")
    
    except Exception as e:
        logger.error(f"Error handling webhook: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))
    
    return {"status": "success"}
```

#### 4.4 Register Routes

**File:** `backend/app/api/v1/__init__.py`

```python
from fastapi import APIRouter
from app.api.v1 import auth, users, receipts, mileage, analytics, stripe, webhooks

api_router = APIRouter()

# ... existing routes ...

api_router.include_router(stripe.router, prefix="/stripe", tags=["stripe"])
api_router.include_router(webhooks.router, prefix="/webhooks", tags=["webhooks"])
```

---

### Phase 5: Frontend Integration (1 hour)

#### 5.1 Stripe Utilities

**File:** `frontend/lib/stripe.ts`

```typescript
import { API_URL } from './api';

export const stripeService = {
  async createCheckoutSession(token: string, plan: 'professional' | 'pro_plus'): Promise<string> {
    const response = await fetch(`${API_URL}/api/v1/stripe/create-checkout-session`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ plan }),
    });

    if (!response.ok) {
      throw new Error('Failed to create checkout session');
    }

    const data = await response.json();
    return data.url;
  },

  async createBillingPortalSession(token: string): Promise<string> {
    const response = await fetch(`${API_URL}/api/v1/stripe/create-billing-portal-session`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
      },
    });

    if (!response.ok) {
      throw new Error('Failed to create billing portal session');
    }

    const data = await response.json();
    return data.url;
  },
};
```

#### 5.2 Update Upgrade Dialog

**File:** `frontend/components/upgrade-plan-dialog.tsx`

Add Stripe checkout logic:

```typescript
const handleSelectPlan = async (planId: 'free' | 'professional' | 'pro_plus') => {
  if (planId === currentPlan || planId === 'free') {
    return;
  }

  const plan = plans.find(p => p.id === planId);
  if (plan?.comingSoon) {
    toast({
      title: 'Coming Soon',
      description: 'This plan will be available soon!',
    });
    return;
  }

  try {
    setLoading(true);
    setSelectedPlan(planId);

    const token = await getToken();
    if (!token) {
      throw new Error('Not authenticated');
    }

    // Create Stripe Checkout session
    const checkoutUrl = await stripeService.createCheckoutSession(token, planId);
    
    // Redirect to Stripe Checkout
    window.location.href = checkoutUrl;

  } catch (error: any) {
    toast({
      variant: 'destructive',
      title: 'Error',
      description: error.message || 'Failed to start checkout',
    });
  } finally {
    setLoading(false);
    setSelectedPlan(null);
  }
};
```

#### 5.3 Success Page

**File:** `frontend/app/dashboard/checkout/success/page.tsx`

```typescript
'use client';

import { useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { CheckCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';

export default function CheckoutSuccessPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const sessionId = searchParams.get('session_id');

  useEffect(() => {
    // Optional: Verify session with backend
    console.log('Checkout session:', sessionId);
  }, [sessionId]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <div className="max-w-md w-full space-y-8 text-center">
        <div className="flex justify-center">
          <CheckCircle className="h-24 w-24 text-green-500" />
        </div>
        <h1 className="text-3xl font-bold">Payment Successful!</h1>
        <p className="text-muted-foreground">
          Your subscription has been activated. You now have access to all premium features.
        </p>
        <Button onClick={() => router.push('/dashboard')} className="w-full">
          Go to Dashboard
        </Button>
      </div>
    </div>
  );
}
```

#### 5.4 Cancel Page

**File:** `frontend/app/dashboard/checkout/cancel/page.tsx`

```typescript
'use client';

import { useRouter } from 'next/navigation';
import { XCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';

export default function CheckoutCancelPage() {
  const router = useRouter();

  return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <div className="max-w-md w-full space-y-8 text-center">
        <div className="flex justify-center">
          <XCircle className="h-24 w-24 text-amber-500" />
        </div>
        <h1 className="text-3xl font-bold">Checkout Cancelled</h1>
        <p className="text-muted-foreground">
          No charges were made. You can try again anytime.
        </p>
        <div className="flex gap-4">
          <Button variant="outline" onClick={() => router.push('/dashboard')} className="flex-1">
            Go to Dashboard
          </Button>
          <Button onClick={() => router.push('/dashboard/settings')} className="flex-1">
            Try Again
          </Button>
        </div>
      </div>
    </div>
  );
}
```

#### 5.5 Add Billing Portal to Settings

**File:** `frontend/app/dashboard/settings/page.tsx`

Add button to manage subscription:

```typescript
import { stripeService } from '@/lib/stripe';

// Inside component
const handleManageSubscription = async () => {
  try {
    const token = await getToken();
    if (!token) return;

    const portalUrl = await stripeService.createBillingPortalSession(token);
    window.location.href = portalUrl;
  } catch (error) {
    toast({
      variant: 'destructive',
      title: 'Error',
      description: 'Failed to open billing portal',
    });
  }
};

// In JSX (add to subscription card):
{usage.plan !== 'free' && (
  <Button onClick={handleManageSubscription} variant="outline" size="sm">
    Manage Subscription
  </Button>
)}
```

---

### Phase 6: Stripe Dashboard Configuration (15 minutes)

#### 6.1 Configure Webhook Endpoint

1. Go to Stripe Dashboard → Developers → Webhooks
2. Click "Add endpoint"
3. URL: `https://your-backend-url.com/api/v1/webhooks/stripe`
4. Select events:
   - `checkout.session.completed`
   - `customer.subscription.created`
   - `customer.subscription.updated`
   - `customer.subscription.deleted`
   - `invoice.payment_succeeded`
   - `invoice.payment_failed`
5. Copy webhook signing secret → Add to `.env` as `STRIPE_WEBHOOK_SECRET`

#### 6.2 Configure Customer Portal

1. Go to Stripe Dashboard → Settings → Billing → Customer portal
2. Enable customer portal
3. Configure:
   - ✅ Allow customers to update payment methods
   - ✅ Allow customers to update billing information
   - ✅ Allow customers to cancel subscriptions
   - ✅ Allow customers to switch plans
4. Set cancellation behavior: "Cancel at period end"

#### 6.3 Enable Tax Calculation (Optional)

1. Go to Stripe Dashboard → Settings → Tax
2. Enable Stripe Tax
3. Configure UK VAT settings
4. Add tax calculation to checkout sessions (already in code)

---

### Phase 7: Testing (30 minutes)

#### 7.1 Test Mode Setup

Use Stripe test mode cards:
- **Success:** `4242 4242 4242 4242`
- **Decline:** `4000 0000 0000 0002`
- **3D Secure:** `4000 0027 6000 3184`
- Expiry: Any future date
- CVC: Any 3 digits

#### 7.2 Test Scenarios

- [ ] Create free account
- [ ] Upgrade to Professional plan
- [ ] Verify subscription in database
- [ ] Check webhook received
- [ ] Test success page redirect
- [ ] Test cancel flow
- [ ] Open billing portal
- [ ] Cancel subscription in portal
- [ ] Verify downgrade to free
- [ ] Test upgrade Professional → Pro Plus
- [ ] Test payment failure (use test card)

#### 7.3 Webhook Testing

Use Stripe CLI for local testing:

```bash
# Install Stripe CLI
brew install stripe/stripe-cli/stripe

# Login
stripe login

# Forward webhooks to local backend
stripe listen --forward-to localhost:8000/api/v1/webhooks/stripe

# Trigger test events
stripe trigger checkout.session.completed
stripe trigger customer.subscription.created
```

---

### Phase 8: Production Deployment (30 minutes)

#### 8.1 Update Environment Variables

**Vercel (Frontend):**
- No Stripe keys needed in frontend (using backend)

**Railway (Backend):**
```bash
STRIPE_SECRET_KEY=sk_live_...
STRIPE_PUBLISHABLE_KEY=pk_live_...
STRIPE_WEBHOOK_SECRET=whsec_...
STRIPE_PROFESSIONAL_PRICE_ID=price_live_...
STRIPE_PRO_PLUS_PRICE_ID=price_live_...
FRONTEND_URL=https://expenseflow.co.uk
```

#### 8.2 Switch to Live Mode

1. Go to Stripe Dashboard → Switch to "Live mode"
2. Create live products (£10/month, £17/month)
3. Copy live Price IDs
4. Create live webhook endpoint
5. Update all environment variables with live keys

#### 8.3 Final Checklist

- [ ] Live Stripe keys in production
- [ ] Live webhook endpoint configured
- [ ] Customer portal enabled
- [ ] Test with real card (small amount)
- [ ] Verify webhook delivery
- [ ] Check database updates
- [ ] Test full user flow
- [ ] Monitor Stripe Dashboard for first payment

---

## 🔒 Security Considerations

### Backend
- ✅ Webhook signature verification (prevents fake webhooks)
- ✅ API endpoints require authentication
- ✅ Stripe keys in environment variables (never committed)
- ✅ Rate limiting on checkout endpoints
- ✅ Input validation (plan names, etc.)

### Frontend
- ✅ No Stripe secret keys in frontend
- ✅ Redirect to Stripe Checkout (PCI-compliant)
- ✅ Use Clerk authentication
- ✅ HTTPS only in production

---

## 📊 Monitoring & Logging

### What to Monitor

1. **Stripe Dashboard:**
   - Payment success rate
   - Failed payments
   - Subscription churn
   - Revenue

2. **Backend Logs:**
   - Webhook delivery
   - Subscription updates
   - Error rates

3. **Database:**
   - User subscription status
   - Stripe customer/subscription IDs
   - Subscription dates

### Key Metrics

- Conversion rate (free → paid)
- Churn rate (cancellations)
- Average revenue per user (ARPU)
- Payment failure rate
- Webhook processing time

---

## 🐛 Common Issues & Solutions

### Issue: Webhook not received
**Solution:** 
- Check webhook endpoint URL
- Verify webhook secret
- Check firewall/security rules
- Test with Stripe CLI

### Issue: Customer not created
**Solution:**
- Check email format
- Verify Stripe API key
- Check error logs
- Ensure network connectivity

### Issue: Subscription not updating
**Solution:**
- Check webhook event type
- Verify user lookup (customer_id or subscription_id)
- Check database transaction commits
- Review error logs

### Issue: Payment fails
**Solution:**
- Test with Stripe test cards
- Check card details
- Verify 3D Secure setup
- Review Stripe Radar rules

---

## 📈 Future Enhancements

### Phase 2 (After Launch)

- [ ] Add annual billing (20% discount)
- [ ] Implement referral program
- [ ] Add usage-based billing
- [ ] Support for team accounts
- [ ] Multiple payment methods (PayPal, etc.)
- [ ] Automated dunning (failed payment recovery)
- [ ] Invoice customization
- [ ] Revenue analytics dashboard

---

## 💡 Pro Tips

1. **Start with monthly billing** - easier to implement, better cash flow
2. **Enable customer portal** - reduces support tickets
3. **Use proration** - fair when upgrading/downgrading
4. **Test webhooks locally** - use Stripe CLI
5. **Monitor failed payments** - set up alerts
6. **Offer annual discounts later** - after validating monthly demand
7. **Keep logs** - essential for debugging subscription issues

---

## 📚 Resources

- Stripe Documentation: https://stripe.com/docs
- Stripe API Reference: https://stripe.com/docs/api
- Stripe Testing: https://stripe.com/docs/testing
- Stripe CLI: https://stripe.com/docs/stripe-cli
- Webhook Best Practices: https://stripe.com/docs/webhooks/best-practices
- Next.js + Stripe Guide: https://vercel.com/guides/getting-started-with-nextjs-typescript-stripe

---

## 🎯 Estimated Timeline

- **Phase 1 (Setup):** 30 minutes
- **Phase 2 (Database):** 15 minutes
- **Phase 3 (Backend Services):** 1 hour
- **Phase 4 (API Endpoints):** 45 minutes
- **Phase 5 (Frontend):** 1 hour
- **Phase 6 (Stripe Config):** 15 minutes
- **Phase 7 (Testing):** 30 minutes
- **Phase 8 (Deployment):** 30 minutes

**Total:** ~5 hours (spread over 1-2 days)

---

## ✅ Ready to Start?

Review this plan, then we can begin implementation step by step. We'll follow our clean architecture pattern with proper service abstraction throughout.

**Next steps:**
1. Review this plan
2. Sign up for Stripe account
3. Create test products
4. Begin Phase 1 implementation

Let me know when you're ready to proceed! 🚀
