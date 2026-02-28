# Stripe Testing Guide

## 🧪 Complete Stripe Testing Checklist

### 1. **Payment Flow Tests**

#### A. Successful Payment (Free → Professional)
1. Start on Free plan
2. Go to Settings → Upgrade Plan
3. Select Professional (£10/month)
4. Use test card: `4242 4242 4242 4242`
5. **Verify:**
   - ✅ Redirected to success page
   - ✅ Dashboard shows "Professional" plan
   - ✅ Receipt/mileage limits updated (100 receipts, 50 mileage)
   - ✅ Settings shows "Manage Billing" button
   - ✅ Stripe Dashboard shows active subscription
   - ✅ Database: `subscription_plan='professional'`, `stripe_subscription_id` populated

#### B. Successful Payment (Free → Pro Plus)
1. Repeat above but select Pro Plus (£17/month)
2. **Verify:**
   - ✅ Plan shows "Pro Plus"
   - ✅ Limits: 500 receipts, 200 mileage

#### C. Plan Upgrade (Professional → Pro Plus)
1. Already on Professional
2. Go to Settings → Change Plan
3. Select Pro Plus
4. Complete payment
5. **Verify:**
   - ✅ Old subscription cancelled in Stripe
   - ✅ New subscription created
   - ✅ Plan updated to Pro Plus
   - ✅ Limits increased

#### D. Plan Downgrade (Pro Plus → Professional)
1. Already on Pro Plus
2. Go to Settings → Change Plan
3. Select Professional
4. Complete payment
5. **Verify:**
   - ✅ Plan downgraded
   - ✅ Limits reduced
   - ✅ Old subscription cancelled

---

### 2. **Failed Payment Tests**

#### A. Card Declined
- Card: `4000 0000 0000 0002`
- **Expected:** Error message, plan stays Free, no subscription created

#### B. Insufficient Funds
- Card: `4000 0000 0000 9995`
- **Expected:** Payment rejected, user stays on current plan

#### C. Expired Card
- Card: `4000 0000 0000 0069`
- **Expected:** Payment fails, clear error message

#### D. Payment Failure on Recurring Billing (STRICT MODE)
**Testing automatic downgrade when subscription renewal fails:**

**Test Card:** `4000 0000 0000 0341` (always fails)

**Setup:**
1. Create subscription using success card `4242 4242 4242 4242`
2. User now on Professional/Pro Plus plan
3. In Stripe Dashboard → Customers → Find customer → Payment methods
4. Replace card with failing card `4000 0000 0000 0341`
5. In Stripe Dashboard → Subscriptions → Find subscription → Actions → "Update subscription" → Set next billing to today (or use Stripe CLI)

**Using Stripe CLI (recommended):**
```bash
# Trigger payment failure webhook directly
stripe trigger invoice.payment_failed
```

**Expected Results:**
- ✅ Webhook `invoice.payment_failed` received
- ✅ Railway logs show: `⚠️ PAYMENT FAILED: Immediately downgraded user X from professional to free`
- ✅ Database updated:
  - `subscription_plan = 'free'`
  - `subscription_status = 'payment_failed'`
  - `stripe_subscription_id = NULL`
  - `subscription_current_period_end = NULL`
- ✅ User loses access to paid features immediately
- ✅ Dashboard shows Free plan limits (10 receipts, 5 mileage)
- ✅ Settings page shows Free plan badge

**Verify Immediate Downgrade:**
```sql
SELECT 
  id, email, subscription_plan, subscription_status,
  stripe_subscription_id, subscription_current_period_end
FROM users 
WHERE email = 'test-payment-failure@example.com';
```

**Code Locations:**
- Handler: `backend/app/services/subscription_service.py` → `handle_payment_failed()`
- Webhook: `backend/app/api/v1/webhooks.py` → `invoice.payment_failed` event

**Why Immediate Downgrade?**
- ✅ Protects revenue (no free access after payment fails)
- ✅ Clear expectations (payment required for features)
- ✅ Prevents abuse

**TODO:** Email notification to user about payment failure (currently just logs)

---

### 3. **3D Secure Authentication**

#### A. Required Authentication
- Card: `4000 0025 0000 3155`
- **Expected:** 
  - Modal appears for authentication
  - Click "Complete" to approve
  - Payment succeeds after auth

#### B. Failed Authentication
- Card: `4000 0025 0000 3155` → Click "Fail"
- **Expected:** Payment fails, stays on current plan

---

### 4. **Webhook Tests**

#### A. Check Webhook Logs (Railway)
After each payment, verify logs show:
```
✅ Stripe API key loaded: sk_test...
Received Stripe webhook: checkout.session.completed
✅ Subscription created for user 4 (email@example.com): professional
```

#### B. Manual Webhook Test (Stripe Dashboard)
1. Go to Stripe Dashboard → Developers → Webhooks
2. Click your webhook endpoint
3. Send test events:
   - `checkout.session.completed`
   - `customer.subscription.created`
   - `customer.subscription.updated`
   - `customer.subscription.deleted`
4. **Verify:** All return 200 OK

---

### 5. **Billing Portal Tests**

#### A. Update Payment Method
1. Click "Manage Billing" in Settings
2. Click "Update payment method"
3. Add new test card
4. **Verify:** Card updated in Stripe

#### B. View Invoices
1. Open billing portal
2. Go to "Invoice history"
3. **Verify:** All invoices visible and downloadable

#### C. Cancel Subscription
1. Open billing portal
2. Click "Cancel subscription"
3. Select "Cancel at period end"
4. **Verify:**
   - Settings shows "Expires on [date]"
   - Still have access until period end
   - `subscription_cancel_at_period_end = true` in database

#### D. Reactivate Subscription
1. After cancelling, open billing portal again
2. Click "Renew subscription"
3. **Verify:**
   - Cancellation removed
   - `subscription_cancel_at_period_end = false`

---

### 6. **Edge Cases**

#### A. Duplicate Checkout Session
1. Start checkout but don't complete
2. Start another checkout
3. **Expected:** Only newest session works, old one expires

#### B. Webhook Out of Order
1. Payment completes
2. Manually trigger `subscription.updated` before `subscription.created`
3. **Expected:** Handles gracefully, no crash

#### C. User Deleted During Active Subscription
1. User has active subscription
2. Delete account
3. **Expected:** 
   - User deleted from database
   - Subscription cancelled in Stripe
   - Can sign up again with same email

#### D. Network Interruption
1. Start payment
2. Close browser during Stripe redirect
3. **Expected:** 
   - Webhook still processes payment
   - Plan updates when user logs back in

---

### 7. **Database Verification**

After each test, check database:

```sql
SELECT 
  id,
  email,
  subscription_plan,
  subscription_status,
  stripe_customer_id,
  stripe_subscription_id,
  subscription_current_period_end,
  subscription_cancel_at_period_end
FROM users 
WHERE email = 'your-test-email@example.com';
```

**Expected values:**
- `subscription_plan`: 'free', 'professional', or 'pro_plus'
- `subscription_status`: 'active', 'canceled', 'past_due'
- `stripe_customer_id`: 'cus_...' (after first payment)
- `stripe_subscription_id`: 'sub_...' (after active subscription)
- `subscription_current_period_end`: Future timestamp
- `subscription_cancel_at_period_end`: true/false

---

### 8. **Stripe Dashboard Verification**

#### Check Each Time:
1. **Customers** → Find user by email
   - Customer exists
   - Correct metadata (user_id)
   
2. **Subscriptions** → Active subscriptions
   - Correct plan (Professional/Pro Plus)
   - Status: Active
   - Next billing date correct
   
3. **Payments** → Successful payments
   - Amount correct (£10 or £17)
   - Currency: GBP
   
4. **Webhooks** → Recent deliveries
   - All events delivered successfully (200 OK)
   - No failed deliveries

---

### 9. **Error Handling Tests**

#### A. Stripe API Down
- Turn off internet mid-payment
- **Expected:** Graceful error, retry mechanism

#### B. Invalid Price ID
- Change `STRIPE_PROFESSIONAL_PRICE_ID` to invalid value
- Try to upgrade
- **Expected:** Clear error message, no crash

#### C. Webhook Signature Failure
- Change `STRIPE_WEBHOOK_SECRET` in Railway
- Make payment
- **Expected:** Webhook rejected (401), logged but doesn't crash server

---

### 10. **Production Readiness Tests**

Before going live:

- [ ] Switch to live Stripe keys
- [ ] Create live products (£10/month, £17/month)
- [ ] Update webhook URL for live mode
- [ ] Test with real card (small amount)
- [ ] Verify live webhook delivers successfully
- [ ] Check live customer portal works
- [ ] Test live invoice emails
- [ ] Verify tax calculations (if applicable)
- [ ] Test with UK postcode for VAT

---

## 🎯 Critical Success Criteria

Every payment flow should:
1. ✅ Create customer in Stripe (first time)
2. ✅ Create active subscription
3. ✅ Send `checkout.session.completed` webhook
4. ✅ Send `customer.subscription.created` webhook
5. ✅ Update database with plan and subscription ID
6. ✅ Show updated plan in dashboard immediately
7. ✅ Update usage limits correctly
8. ✅ Enable "Manage Billing" button

---

## 🐛 Common Issues to Watch For

1. **Webhook not received**
   - Check Railway logs for "Received Stripe webhook"
   - Verify webhook URL in Stripe Dashboard
   - Ensure STRIPE_WEBHOOK_SECRET matches

2. **Plan not updating**
   - Check webhook response in Stripe
   - Look for errors in Railway logs
   - Verify price IDs match in .env

3. **Multiple subscriptions for same user**
   - Cancel old subscriptions in Stripe Dashboard
   - Fixed by allowing plan changes in code

4. **"User already has subscription" error**
   - Fixed: Now cancels old subscription before creating new one
   - Users can upgrade/downgrade freely

---

## 📊 Test Card Summary

| Scenario | Card Number | Behavior |
|----------|-------------|----------|
| Success | `4242 4242 4242 4242` | Payment succeeds |
| Decline | `4000 0000 0000 0002` | Card declined |
| Insufficient | `4000 0000 0000 9995` | Insufficient funds |
| 3D Secure | `4000 0025 0000 3155` | Requires authentication |
| Expired | `4000 0000 0000 0069` | Expired card |

**For all cards:**
- Expiry: Any future date (e.g., `12/34`)
- CVC: Any 3 digits (e.g., `123`)
- ZIP: Any 5 digits (e.g., `12345`)

---

## ✅ Quick Smoke Test (5 minutes)

Run this before each deployment:

1. Sign up new test user
2. Upgrade to Professional (`4242...`)
3. Check plan updated ✅
4. Open billing portal ✅
5. Cancel subscription ✅
6. Verify shows "Expires on X" ✅
7. Check Railway logs for webhook ✅

If all pass: ✅ Ready to deploy
