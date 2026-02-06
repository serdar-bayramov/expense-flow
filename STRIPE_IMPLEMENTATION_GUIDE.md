# 🎯 Complete Stripe & Plan Implementation Guide for ExpenseFlow

This document provides a comprehensive walkthrough of ExpenseFlow's Stripe integration and subscription plan system, covering every file, function, and flow from frontend to backend.

---

## 📋 **1. PLAN DEFINITIONS**
**File:** `frontend/lib/plans.ts`

This is your **source of truth** for plan metadata - pricing, features, and limits.

### Three Plans Defined:

#### FREE PLAN
- **Price:** £0/forever
- **Limits:** 50 receipts/month, 20 mileage claims
- **Features:** Basic OCR, tax calculator, CSV export
- **Beta bonus:** Increased from 10 receipts to 50

#### PROFESSIONAL PLAN (Popular)
- **Price:** £10/month
- **Limits:** 100 receipts, 50 mileage
- **Features:** All free features + more volume

#### PRO PLUS PLAN
- **Price:** £17/month
- **Limits:** 500 receipts, 200 mileage
- **Features:** Everything + PDF export, priority support

### Key Structure:
```typescript
interface Plan {
  id: 'free' | 'professional' | 'pro_plus';
  name: string;
  icon: LucideIcon;
  description: string;
  price: string;
  priceMonthly: number;
  period: string;
  popular?: boolean;
  features: PlanFeature[];
  limits: {
    receipts: number;
    mileage: number;
    analytics: boolean;
    templates: boolean;
    exportFormats: string[];
    support: string;
  };
}
```

---

## 💳 **2. STRIPE CLIENT SERVICE**
**File:** `frontend/lib/stripe.ts`

Your **frontend's bridge to Stripe** - handles all Stripe-related API calls.

### Four Main Functions:

#### a) `createCheckoutSession(token, plan)` 
**Purpose:** Start payment flow for new/upgrade subscription
- **Calls:** `POST /api/v1/stripe/create-checkout-session`
- **Returns:** Stripe Checkout URL
- **Flow:** User redirects to Stripe's hosted payment page

#### b) `createBillingPortalSession(token)`
**Purpose:** Let users manage their subscription (cancel, update payment)
- **Calls:** `POST /api/v1/stripe/create-billing-portal-session`
- **Returns:** Stripe Billing Portal URL
- **Features:** Users can cancel, update cards, view invoices

#### c) `cancelSubscription(token)`
**Purpose:** Cancel subscription at period end
- **Calls:** `POST /api/v1/stripe/cancel-subscription`
- **Behavior:** Marks subscription to cancel but keeps access until paid period ends

#### d) `syncSubscription(token)`
**Purpose:** Manually sync subscription status from Stripe
- **Calls:** `POST /api/v1/stripe/sync-subscription`
- **Use Case:** Useful when webhooks fail or after returning from Stripe portal

---

## 🎨 **3. FRONTEND COMPONENTS**

### a) Plan Selector Component
**File:** `frontend/components/plan-selector.tsx`

Visual plan picker with radio buttons - shows all 3 plans side-by-side.

**Features:**
- Highlights current plan with "Current" badge
- Shows "Popular" badge on Professional plan
- Displays key features with checkmarks
- Shows confirmation button when selection changes
- Different messaging for upgrades vs downgrades

**Usage:** Embedded in Settings page for plan changes

---

### b) Upgrade Plan Dialog
**File:** `frontend/components/upgrade-plan-dialog.tsx`

Modal dialog showing all plans with pricing cards.

**Flow:**
1. User clicks plan → `handleSelectPlan()` fires
2. Calls `stripeService.createCheckoutSession()`
3. Redirects to Stripe Checkout URL
4. After payment, user returns to `/dashboard/checkout/success`

**Smart Behavior:**
- Won't let you select your current plan
- Won't let you "upgrade" to free (use cancel instead)
- Shows loading state during checkout creation

---

### c) Settings Page
**File:** `frontend/app/dashboard/settings/page.tsx`

**Your main subscription management hub.**

**Key Features:**

1. **Displays current plan with icon and badge**
2. **Shows usage stats:**
   - Receipts used/limit with progress bar
   - Mileage used/limit with progress bar
   - Current period end date
   - Cancellation warning if scheduled

3. **Plan Selector Component** for changing plans

4. **Billing Portal Button** - Opens Stripe's hosted portal

5. **Handles post-Stripe returns:**
   - Detects `stripe_portal_visited` in sessionStorage
   - Auto-syncs subscription after returning
   - Shows appropriate toast messages

**Special Handling:**
```typescript
// When user selects FREE plan → Cancels at period end
// When user selects PAID plan → Upgrades/downgrades immediately
```

---

## 🔧 **4. BACKEND CONFIGURATION**
**File:** `backend/app/core/database.py`

### Environment Variables Required:

```python
# Stripe Keys
STRIPE_SECRET_KEY           # sk_test_xxx or sk_live_xxx
STRIPE_PUBLISHABLE_KEY      # pk_test_xxx or pk_live_xxx
STRIPE_WEBHOOK_SECRET       # whsec_xxx

# Stripe Price IDs
STRIPE_PROFESSIONAL_PRICE_ID # price_xxx (£10 plan)
STRIPE_PRO_PLUS_PRICE_ID    # price_xxx (£17 plan)

# Frontend URL for redirects
FRONTEND_URL                # http://localhost:3000 or production URL
```

**⚠️ CRITICAL:** All 5 Stripe variables must match same mode (test or live). Mixing test and live will cause API crashes.

---

## 🗄️ **5. USER MODEL**
**File:** `backend/app/models/user.py`

### Subscription-Related Database Fields:

```python
# Plan Information
subscription_plan = Column(String, default="free", nullable=False)
# Values: 'free', 'professional', 'pro_plus'

# Stripe Integration
stripe_customer_id = Column(String, unique=True, nullable=True, index=True)
# Links to Stripe Customer object

stripe_subscription_id = Column(String, unique=True, nullable=True, index=True)
# Links to active Stripe Subscription

# Subscription Status
subscription_status = Column(String, default="active", nullable=False)
# Values: 'active', 'cancelled', 'expired', 'past_due'

subscription_current_period_end = Column(DateTime(timezone=True), nullable=True)
# When current billing period ends

subscription_cancel_at_period_end = Column(Boolean, default=False, nullable=False)
# True if subscription is scheduled for cancellation
```

**This is your database's subscription state** - synced from Stripe via webhooks.

---

## 🔌 **6. STRIPE SERVICE (Low-Level API Wrapper)**
**File:** `backend/app/services/stripe_service.py`

Handles direct Stripe SDK calls.

### Key Functions:

#### a) `create_customer(email, name, metadata)`
Creates Stripe Customer object
- **Called when:** User first upgrades from free
- **Stores:** user_id in metadata for reference
- **Returns:** Stripe Customer object

#### b) `create_checkout_session(customer_id, price_id, success_url, cancel_url)`
Creates Stripe Checkout Session
- **Mode:** `'subscription'` for recurring billing
- **Features:** Includes success/cancel URLs, allows promo codes
- **Returns:** Session object with redirect URL

#### c) `get_subscription(subscription_id)`
Fetches current subscription from Stripe
- **Use:** Verify subscription status directly from Stripe

#### d) `cancel_subscription(subscription_id, at_period_end=True)`
Cancels subscription
- **at_period_end=True:** Cancel at billing period end (fair to user)
- **at_period_end=False:** Immediate cancellation (for refunds/fraud)
- **Default:** Uses period end (better UX)

#### e) `update_subscription(subscription_id, new_price_id, is_upgrade)`
**Most complex function** - handles plan changes

**For UPGRADES (professional → pro_plus):**
```python
proration_behavior='create_prorations'  # Charge difference immediately
cancel_at_period_end=False  # Remove cancellation if present
```

**For DOWNGRADES (pro_plus → professional):**
```python
proration_behavior='create_prorations'  # Credit unused time
```

Both happen **immediately** with automatic prorations calculated by Stripe.

#### f) `create_billing_portal_session(customer_id, return_url)`
Creates Stripe Customer Portal session
- **Users can:** Cancel, update payment methods, view invoices
- **Returns:** Portal URL, redirects back to your app after

---

## 🔄 **7. SUBSCRIPTION SERVICE (Business Logic Layer)**
**File:** `backend/app/services/subscription_service.py`

Coordinates between Stripe and your database.

### Key Functions:

#### a) `ensure_stripe_customer(user, db)`
**Idempotent customer creation**
- Checks if user has `stripe_customer_id`
- Creates Stripe customer if missing
- Saves to database
- Returns customer_id

#### b) `create_checkout_session(user, plan, db)`
**High-level checkout creation**
- Ensures customer exists
- Maps plan name ('professional') to price ID
- Creates Stripe checkout session
- Builds success/cancel URLs with frontend URL

#### c) `handle_subscription_created(subscription, db)`
**Webhook handler for new subscriptions**
- Finds user by `stripe_customer_id`
- Maps price_id to plan name
- Updates user's subscription fields in database
- Commits changes

#### d) `handle_subscription_updated(subscription, db)`
**Webhook handler for plan changes**
- Updates plan based on new price_id
- Updates status, period_end, cancellation flag
- Handles reactivations (removing cancel flag)

#### e) `handle_subscription_deleted(subscription, db)`
**Webhook handler for expired subscriptions**
- Downgrades user to 'free' plan
- Clears subscription ID
- Sets status to 'cancelled'

---

## 🎯 **8. STRIPE API ENDPOINTS**
**File:** `backend/app/api/v1/stripe.py`

### a) `POST /api/v1/stripe/create-checkout-session`
**Entry point for upgrades/downgrades**

**Request Body:**
```json
{
  "plan": "professional"  // or "pro_plus"
}
```

**Logic Flow:**
```
1. Validate plan (must be 'professional' or 'pro_plus')
2. Check if selecting current plan (reject if same)
3. Determine upgrade vs downgrade based on plan hierarchy
4. Check if has active subscription:
   
   IF YES (existing paid subscriber):
      → Call StripeService.update_subscription()
      → Update database immediately
      → Return success URL with ?upgraded=true or ?downgraded=true
      → No payment page needed!
   
   IF NO (free user):
      → Call SubscriptionService.create_checkout_session()
      → Return Stripe Checkout URL
      → User goes to Stripe payment page
```

**Key Feature:** Existing subscribers don't go through checkout again - instant plan change with prorations!

---

### b) `POST /api/v1/stripe/create-billing-portal-session`
Opens Stripe Customer Portal
- Ensures customer exists in Stripe
- Creates portal session
- Returns redirect URL to Stripe-hosted portal

---

### c) `POST /api/v1/stripe/sync-subscription`
**Manual sync from Stripe (important for reliability)**

**When used:**
- After returning from Stripe portal
- When webhooks might have failed
- During debugging or troubleshooting

**Logic:**
```
1. Find all active subscriptions for customer in Stripe
2. Prefer non-cancelled subscriptions
3. Use most recent if all are cancelled
4. Update subscription_id if changed
5. Map price_id to plan name
6. Update all subscription fields in database
7. Commit changes
```

**Critical:** Always fetches from Stripe (source of truth), not local DB.

---

### d) `POST /api/v1/stripe/cancel-subscription`
Schedules cancellation at period end
- Calls `StripeService.cancel_subscription(at_period_end=True)`
- Sets `subscription_cancel_at_period_end = True` in database
- User keeps access until they've paid for (fair to user)

---

### e) `GET /api/v1/stripe/subscription-status`
Returns current user's subscription info
- Plan, status, period end date, cancellation flag
- Used by frontend to display subscription state

---

## 🪝 **9. WEBHOOK HANDLERS**
**File:** `backend/app/api/v1/webhooks.py`

### `POST /api/v1/webhooks/stripe`
**Stripe's way of notifying you about subscription events**

**Security:** Verified with webhook signing secret - prevents spoofing

### Events Handled:

#### a) `checkout.session.completed`
**Trigger:** Payment succeeded
**Action:** Retrieve subscription and call handler to update database

#### b) `customer.subscription.created`
**Trigger:** New subscription activated
**Action:** Update user to paid plan in database

#### c) `customer.subscription.updated`
**Trigger:** Plan changed or subscription modified
**Action:** Update user's plan/status in database

#### d) `customer.subscription.deleted`
**Trigger:** Subscription expired or cancelled
**Action:** Downgrade user to free plan

#### e) `invoice.payment_succeeded`
**Trigger:** Payment received successfully
**Action:** Log success (could send receipt email)

#### f) `invoice.payment_failed`
**Trigger:** Payment failed
**Action:** Log warning (could send dunning email)

**⚠️ Critical:** Webhooks are Stripe's way of keeping your database in sync! Always verify signatures.

---

## 🔄 **10. COMPLETE USER FLOWS**

### **Flow A: Free User Upgrades to Professional**

#### Frontend:
1. User clicks "Upgrade" in settings or analytics page
2. `UpgradePlanDialog` opens, shows 3 plans
3. User selects "Professional" → `handleSelectPlan()` fires
4. Calls `stripeService.createCheckoutSession(token, 'professional')`

#### Backend:
5. `POST /create-checkout-session` receives request
6. Validates: `user.subscription_plan = 'free'`
7. Calls `SubscriptionService.create_checkout_session()`
8. Calls `ensure_stripe_customer()` - creates Stripe Customer if needed
9. Maps 'professional' → `STRIPE_PROFESSIONAL_PRICE_ID`
10. Calls `StripeService.create_checkout_session()`
11. Returns Stripe Checkout URL

#### Stripe Hosted Page:
12. User redirects to `https://checkout.stripe.com/...`
13. User enters card details and pays
14. Stripe creates subscription
15. User redirects to `yoursite.com/dashboard/checkout/success`

#### Webhook Processing:
16. Stripe sends `checkout.session.completed` webhook
17. Backend retrieves subscription details from Stripe
18. `handle_subscription_created()` fires
19. Finds user by `stripe_customer_id`
20. Maps price_id → 'professional'
21. Updates database:
    - `subscription_plan = 'professional'`
    - `stripe_subscription_id = 'sub_xxx'`
    - `subscription_status = 'active'`
    - `subscription_current_period_end = (date)`

#### Frontend Success Page:
22. Displays success message
23. User continues to dashboard with Professional plan active
24. Increased limits (100 receipts, 50 mileage) now enforced

---

### **Flow B: Professional User Upgrades to Pro Plus**

#### Frontend:
1. User clicks "Change Plan" in settings
2. Selects "Pro Plus" from `PlanSelector`
3. Clicks "Confirm Change"
4. Calls `stripeService.createCheckoutSession(token, 'pro_plus')`

#### Backend (No Stripe Checkout Page!):
5. `POST /create-checkout-session` receives request
6. Validates: `user.subscription_plan = 'professional'`, `request.plan = 'pro_plus'`
7. Detects: `is_upgrade = True` (pro_plus tier > professional tier)
8. User has `stripe_subscription_id` → **Skip checkout!**
9. Calls `StripeService.update_subscription()`:
   - Retrieves subscription from Stripe
   - Modifies subscription item price to Pro Plus price_id
   - Sets `proration_behavior='create_prorations'`
   - Stripe charges prorated difference immediately
   - Removes any cancellation flags
10. Updates database immediately: `subscription_plan = 'pro_plus'`
11. Returns: `{ url: '/dashboard/settings?upgraded=true', message: '...' }`

#### Frontend:
12. Redirects to settings with success message
13. **No payment page!** Instant upgrade with proration
14. User sees Pro Plus limits (500 receipts, 200 mileage) immediately

#### Webhook (Confirmation):
15. Stripe sends `customer.subscription.updated` webhook
16. Backend confirms plan change in database

---

### **Flow C: Pro Plus User Downgrades to Professional**

**Same as Flow B, but:**
- `is_upgrade = False` detected
- Stripe gives **credit** for unused Pro Plus time
- Credit applied to next invoice automatically
- Instant downgrade to Professional limits
- User sees downgrade confirmation message

---

### **Flow D: User Cancels Subscription**

#### Frontend:
1. User selects "Free" in `PlanSelector`
2. OR clicks "Cancel Subscription" in Billing Portal
3. Calls `stripeService.cancelSubscription(token)`

#### Backend:
4. `POST /cancel-subscription` receives request
5. Calls `StripeService.cancel_subscription(sub_id, at_period_end=True)`
6. Stripe marks subscription to cancel at period end
7. Updates database: `subscription_cancel_at_period_end = True`
8. Returns current period end date

#### Frontend:
9. Shows warning: "Cancels on [date]. You keep access until then."
10. User keeps Professional/Pro Plus limits until paid period ends
11. Badge shows "Cancels on [date]" warning

#### Webhook (At Period End):
12. Stripe sends `customer.subscription.deleted` webhook
13. `handle_subscription_deleted()` fires
14. Updates database:
    - `subscription_plan = 'free'`
    - `stripe_subscription_id = None`
    - `subscription_status = 'cancelled'`

#### Frontend:
15. User's next login shows Free plan limits (50 receipts, 20 mileage)

---

### **Flow E: User Opens Billing Portal**

#### Frontend:
1. User clicks "Manage Billing" button in settings
2. Sets `sessionStorage.setItem('stripe_portal_visited', 'true')`
3. Calls `stripeService.createBillingPortalSession(token)`

#### Backend:
4. `POST /create-billing-portal-session` receives request
5. Ensures customer exists in Stripe
6. Calls `StripeService.create_billing_portal_session()`
7. Returns Stripe Billing Portal URL

#### Stripe Hosted Portal:
8. User redirects to `https://billing.stripe.com/...`
9. User can:
   - Cancel subscription
   - Update payment method
   - View all invoices
   - Download receipts
10. Clicks "Return to ExpenseFlow"

#### Frontend (Return):
11. Detects `stripe_portal_visited = true` in sessionStorage
12. Calls `stripeService.syncSubscription(token)` → Force sync from Stripe
13. Refreshes user data from database
14. Shows appropriate toast based on new state:
    - "Subscription Scheduled to Cancel" if cancelled
    - "Subscription Active" if still active

---

## 🔑 **KEY CONCEPTS TO UNDERSTAND**

### 1. Test vs Live Mode
- Stripe has **completely separate** test and live environments
- Test keys start with `sk_test_`, live keys start with `sk_live_`
- Test price IDs (`price_xxx`) **only** work with test keys
- Live price IDs **only** work with live keys
- Test webhooks have separate signing secrets from live webhooks
- **⚠️ CRITICAL:** Mixing test keys with live price IDs crashes the backend

### 2. Prorations (How Stripe Handles Mid-Cycle Changes)
- When you change plans mid-cycle, Stripe calculates unused time
- **Upgrade:** Charges difference immediately (fair to you as the business)
  - Example: User on £10/month for 15 days, upgrades to £17/month
  - Stripe charges ~£3.50 for remaining 15 days
- **Downgrade:** Credits difference to next invoice (fair to customer)
  - Example: User on £17/month for 15 days, downgrades to £10/month
  - Stripe credits ~£3.50 to next month's invoice
- Happens automatically with `proration_behavior='create_prorations'`
- All calculations are precise to the second

### 3. Checkout vs Portal (Two Different Stripe Hosted Pages)
- **Checkout:** For new subscriptions (Stripe-hosted payment page)
  - Fresh payment form
  - Collects card details
  - Creates new subscription
  - Used for free → paid transitions
- **Portal:** For existing subscribers (Stripe-hosted management page)
  - Self-service subscription management
  - Cancel, update payment method, view invoices
  - No coding required - Stripe handles everything
- Both are PCI-compliant, mobile-responsive, localized

### 4. Webhooks are Critical (Source of Truth)
- Your database is NOT the source of truth - **Stripe is**
- Webhooks keep your database in sync with Stripe
- Always verify webhook signatures (prevents spoofing/replay attacks)
- If webhooks fail, use manual sync endpoint as fallback
- Webhook endpoint must be publicly accessible (Railway, not localhost)
- Stripe retries failed webhooks with exponential backoff

### 5. Customer vs Subscription (Two Separate Stripe Objects)
- **Customer:** The person/entity
  - Has email, name, address
  - Has payment methods (cards)
  - Has billing history
  - One customer per user
- **Subscription:** The recurring charge
  - Has plan/price
  - Has status (active, cancelled, past_due)
  - Has billing cycle dates
  - One active subscription per customer (in your model)
- Relationship: `Customer --< Subscriptions` (one-to-many)

### 6. Period End vs Immediate Cancellation
- **cancel_at_period_end=True:** Fair to user (they paid for full month)
  - Subscription remains active until period end
  - No refund
  - User keeps access
  - Better customer experience
- **cancel_at_period_end=False:** Immediate cancellation
  - Use for refunds, fraud, or violations
  - Subscription ends immediately
  - Can trigger refund separately
- **You use period end** (better UX, less support tickets)

### 7. Subscription Statuses
- **active:** Subscription is current and paid
- **past_due:** Payment failed, in grace period (not applicable - immediate downgrade)
- **canceled:** Subscription ended (period expired)
- **unpaid:** Payment failed, grace period expired (not applicable - immediate downgrade)
- **trialing:** In free trial period (not used in your app)
- **incomplete:** Checkout started but payment not confirmed
- **payment_failed:** Custom status when payment fails and user is immediately downgraded to free

**Note:** Payment failures trigger immediate downgrade to free plan. See STRIPE_TESTING_GUIDE.md for testing details.

---

## 📊 **ARCHITECTURE DIAGRAM**

```
┌─────────────────────────────────────────────────────────────┐
│                        FRONTEND                              │
│                   (Next.js on Vercel)                        │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  Settings Page → Plan Selector → stripeService              │
│       ↓              ↓               ↓                       │
│  Upgrade Dialog → Pricing Cards → Create Checkout           │
│                                      ↓                       │
│                          Redirect to Stripe                  │
└───────────────────────────────┬─────────────────────────────┘
                                ↓
┌─────────────────────────────────────────────────────────────┐
│                     BACKEND API                              │
│                (FastAPI on Railway)                          │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  /api/v1/stripe/create-checkout-session                     │
│       ↓                                                      │
│  SubscriptionService.create_checkout_session()              │
│       ↓                                                      │
│  StripeService.create_checkout_session()                    │
│       ↓                                                      │
│  Return Stripe Checkout URL                                 │
└───────────────────────────────┬─────────────────────────────┘
                                ↓
┌─────────────────────────────────────────────────────────────┐
│                      STRIPE API                              │
│              (stripe.com - PCI Compliant)                    │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  Checkout Session → User Pays → Subscription Created        │
│       ↓                                                      │
│  Sends webhook: checkout.session.completed                  │
│       ↓                                                      │
│  POST https://expense-flow-production.up.railway.app/        │
│       api/v1/webhooks/stripe                                 │
└───────────────────────────────┬─────────────────────────────┘
                                ↓
┌─────────────────────────────────────────────────────────────┐
│                   WEBHOOK HANDLER                            │
│                (FastAPI on Railway)                          │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  /api/v1/webhooks/stripe                                    │
│       ↓                                                      │
│  Verify webhook signature (security)                        │
│       ↓                                                      │
│  SubscriptionService.handle_subscription_created()          │
│       ↓                                                      │
│  Update User model in PostgreSQL database                   │
│       ↓                                                      │
│  User now has Professional/Pro Plus access                  │
└─────────────────────────────────────────────────────────────┘
```

---

## ✅ **CHECKLIST: Going Live with Stripe**

### Stripe Dashboard Setup:

- [ ] **Complete business verification**
  - Business address, tax ID, bank account
  - May take 1-3 days for approval

- [ ] **Activate live mode** in Stripe dashboard

- [ ] **Create Professional Plan product**
  - Name: "Professional Plan"
  - Price: £10.00 GBP
  - Billing period: Monthly
  - Copy the price ID (starts with `price_`)

- [ ] **Create Pro Plus Plan product**
  - Name: "Pro Plus Plan"
  - Price: £17.00 GBP
  - Billing period: Monthly
  - Copy the price ID (starts with `price_`)

- [ ] **Create webhook endpoint**
  - URL: `https://expense-flow-production.up.railway.app/api/v1/webhooks/stripe`
  - Description: "ExpenseFlow subscription events"
  - API Version: Use latest (2024-12-18 or newer)

- [ ] **Select webhook events:**
  - ✅ `checkout.session.completed`
  - ✅ `customer.subscription.created`
  - ✅ `customer.subscription.updated`
  - ✅ `customer.subscription.deleted`
  - ✅ `invoice.payment_succeeded`
  - ✅ `invoice.payment_failed`

- [ ] **Copy webhook signing secret** (starts with `whsec_`)

### Railway Environment Variables:

Update all 5 Stripe variables **atomically** (all at once):

- [ ] `STRIPE_SECRET_KEY` → Live secret key (sk_live_...)
- [ ] `STRIPE_PUBLISHABLE_KEY` → Live publishable key (pk_live_...)
- [ ] `STRIPE_WEBHOOK_SECRET` → Live webhook secret (whsec_...)
- [ ] `STRIPE_PROFESSIONAL_PRICE_ID` → Live Professional price ID (price_...)
- [ ] `STRIPE_PRO_PLUS_PRICE_ID` → Live Pro Plus price ID (price_...)

**⚠️ Important:** Update all 5 together. If you mix test/live, the backend will crash.

### Frontend Environment (if needed):

- [ ] Check if frontend uses `STRIPE_PUBLISHABLE_KEY` directly
- [ ] Update Vercel environment variable to live publishable key
- [ ] Redeploy frontend after environment variable change

### Testing:

- [ ] **Test new subscription:**
  - Sign up with test account
  - Upgrade to Professional
  - Verify webhook received
  - Verify database updated
  - Verify limits enforced

- [ ] **Test upgrade:**
  - Upgrade Professional → Pro Plus
  - Verify instant upgrade (no checkout page)
  - Verify proration charged
  - Verify limits updated

- [ ] **Test downgrade:**
  - Downgrade Pro Plus → Professional
  - Verify instant downgrade
  - Verify credit issued
  - Verify limits reduced

- [ ] **Test cancellation:**
  - Cancel subscription
  - Verify keeps access until period end
  - Verify webhook fires at period end
  - Verify downgrade to free

- [ ] **Test billing portal:**
  - Open billing portal
  - Update payment method
  - Cancel subscription
  - Verify sync works after return

### Monitoring:

- [ ] Set up Stripe email notifications for failed payments
- [ ] Monitor Railway logs for webhook processing
- [ ] Set up alerts for subscription-related errors
- [ ] Check Stripe Dashboard weekly for:
  - Failed payments
  - Cancelled subscriptions
  - Disputes/chargebacks

---

## 🚨 **COMMON ISSUES & SOLUTIONS**

### Issue 1: Backend crashes with Stripe API errors
**Symptom:** `InvalidRequestError: No such price: price_xxx`
**Cause:** Mixing test and live mode (test price ID with live secret key)
**Solution:** Ensure all 5 Stripe environment variables match the same mode

### Issue 2: Webhooks not received
**Symptom:** Subscriptions created in Stripe but database not updated
**Cause:** Webhook endpoint not accessible or signature verification failing
**Solution:** 
- Check Railway deployment is running
- Verify webhook URL is publicly accessible
- Verify webhook secret matches Railway environment
- Check Railway logs for webhook errors

### Issue 3: Prorations not working correctly
**Symptom:** User charged/credited wrong amount on plan change
**Cause:** Not using `proration_behavior='create_prorations'`
**Solution:** Ensure `update_subscription()` uses correct proration behavior

### Issue 4: Users can't cancel subscription
**Symptom:** Cancel button doesn't work or shows error
**Cause:** Subscription ID missing or invalid
**Solution:** Use sync endpoint to update subscription ID from Stripe

### Issue 5: Checkout session expires
**Symptom:** User clicks old checkout link, shows error
**Cause:** Checkout sessions expire after 24 hours
**Solution:** Always generate fresh checkout session, don't cache URLs

### Issue 6: User charged after cancellation
**Symptom:** User cancelled but still charged next month
**Cause:** Cancellation didn't process correctly
**Solution:** 
- Verify `cancel_at_period_end=True` is set
- Check webhook `subscription.deleted` fired at period end
- Use Stripe Dashboard to manually cancel if needed

---

## 📝 **DEVELOPMENT NOTES**

### Local Testing with Stripe:
1. Use Stripe CLI to forward webhooks to localhost:
   ```bash
   stripe listen --forward-to localhost:8000/api/v1/webhooks/stripe
   ```

2. Get webhook signing secret from CLI output

3. Update `.env` with local webhook secret

4. Use test card: `4242 4242 4242 4242`, any future date, any CVC

### Database Migrations:
If you modify subscription fields, create Alembic migration:
```bash
cd backend
alembic revision --autogenerate -m "update subscription fields"
alembic upgrade head
```

### Stripe API Version:
- Current implementation uses latest Stripe Python SDK
- Stripe API version set automatically by SDK
- If Stripe changes API, update SDK: `pip install --upgrade stripe`

### Testing Webhooks:
Use Stripe CLI to trigger test webhooks:
```bash
stripe trigger customer.subscription.created
stripe trigger customer.subscription.deleted
```

---

## 🔗 **USEFUL LINKS**

- **Stripe Dashboard:** https://dashboard.stripe.com/
- **Stripe API Docs:** https://stripe.com/docs/api
- **Stripe Webhooks Guide:** https://stripe.com/docs/webhooks
- **Stripe Testing:** https://stripe.com/docs/testing
- **Stripe Subscriptions:** https://stripe.com/docs/billing/subscriptions/overview
- **Stripe CLI:** https://stripe.com/docs/stripe-cli

---

## 📞 **SUPPORT**

If you encounter issues:

1. **Check Railway logs:** `railway logs` or dashboard
2. **Check Stripe Dashboard:** Look for failed events in Webhooks tab
3. **Use sync endpoint:** Manually sync subscription from Stripe
4. **Stripe Support:** Available 24/7 via dashboard chat
5. **Backend logs:** Check for detailed error messages

---

**Last Updated:** February 6, 2026
**Version:** 1.0
**Status:** Production Ready ✅
