# Subscription Cancellation Guide

## Two Ways to Cancel Subscription

### Method 1: Immediate Cancellation (via Free Plan Button)
**Location**: Settings → Plan & Billing → Select "Free" plan → "Cancel Subscription"

**Behavior**:
- ✅ Cancels subscription **immediately**
- ✅ Downgrades to Free plan **right away**
- ✅ Page reloads to show Free badge
- ✅ No access to paid features after cancellation
- ✅ `subscription_cancel_at_period_end` = `False` (immediate cancellation)

**Use Case**: User wants to cancel and downgrade immediately, no longer needs paid features.

---

### Method 2: Scheduled Cancellation (via Manage Billing Button)
**Location**: Settings → Plan & Billing → "Manage Billing" → Stripe Customer Portal → Cancel Subscription

**Behavior**:
- ✅ Schedules cancellation for **end of billing period**
- ✅ User **keeps paid plan** until period ends
- ⚠️ Orange warning banner shows: "Subscription will cancel on [date]"
- ✅ `subscription_cancel_at_period_end` = `True`
- ✅ User can **reactivate** via Stripe portal before period ends
- ✅ Auto-downgrades to Free when period ends (via webhook)

**Use Case**: User wants to cancel but keep access until they've paid for (e.g., paid until Feb 28, wants access until then).

---

## Technical Implementation

### Backend Endpoints

1. **`POST /api/v1/stripe/cancel-subscription`** (Immediate)
   - Calls: `StripeService.cancel_subscription(subscription_id, at_period_end=False)`
   - Stripe API: `stripe.Subscription.delete(subscription_id)`
   - Updates DB: `plan='free'`, `status='canceled'`, `subscription_id=None`
   - Used by: Free plan button

2. **Stripe Customer Portal** (Scheduled)
   - User clicks "Cancel subscription" in Stripe portal
   - Stripe API: `stripe.Subscription.modify(subscription_id, cancel_at_period_end=True)`
   - Webhook: `customer.subscription.updated` → Sets `cancel_at_period_end=True`
   - Webhook: `customer.subscription.deleted` (at period end) → Downgrades to Free

### Webhooks

#### `customer.subscription.updated`
```python
# Handles scheduled cancellation
user.subscription_cancel_at_period_end = subscription['cancel_at_period_end']
# If True, user keeps plan until period_end
# If False, user reactivated subscription
```

#### `customer.subscription.deleted`
```python
# Handles immediate cancellation OR end of scheduled cancellation
user.subscription_plan = 'free'
user.subscription_status = 'canceled'
user.stripe_subscription_id = None
```

---

## UI Components

### Warning Banner (Scheduled Cancellation)
Shows when `subscription_cancel_at_period_end = True`:

```
⚠️ Subscription Cancellation Scheduled
Your subscription will be cancelled on 28 February 2026. You'll keep your current plan benefits until then.
Want to keep your subscription? Use the "Manage Billing" button to reactivate it.
```

### Manage Billing Button
- **Shows**: Only for paid plans (Professional, Pro Plus)
- **Hides**: On Free plan
- **Purpose**: Access Stripe Customer Portal for:
  - Update payment method
  - View invoices
  - Cancel subscription (scheduled)
  - Reactivate subscription

---

## Database Fields

| Field | Immediate Cancel | Scheduled Cancel (Before Period End) | Scheduled Cancel (After Period End) |
|-------|-----------------|-------------------------------------|-----------------------------------|
| `subscription_plan` | `'free'` | `'professional'` | `'free'` |
| `subscription_status` | `'canceled'` | `'active'` | `'canceled'` |
| `stripe_subscription_id` | `NULL` | `'sub_xxx'` | `NULL` |
| `subscription_cancel_at_period_end` | `False` | `True` | `False` |
| `subscription_current_period_end` | `NULL` | `2026-02-28` | `NULL` |

---

## Stripe Portal Behavior

### Subscription History
**Normal Behavior**: Stripe portal shows **all subscriptions** including:
- ✅ Active subscriptions
- ✅ Cancelled subscriptions (with cancellation date)
- ✅ Past subscriptions

This is **expected** - it's Stripe's way of showing full payment history.

### Why User Sees Multiple Subscriptions
If user has:
- Professional cancelled on Jan 28
- Pro Plus cancelled on Jan 29
- Professional active

They'll see all 3 in Stripe portal. This is normal and allows them to:
- Download invoices for any subscription
- See payment history
- Understand their billing timeline

---

## Common Scenarios

### Scenario 1: Immediate Downgrade
```
User: Professional plan
Action: Settings → Free plan → Cancel Subscription
Result: 
- Immediately: Free plan
- Stripe: Subscription deleted
- DB: plan='free', cancel_at_period_end=False
```

### Scenario 2: Scheduled Cancellation
```
User: Professional plan (paid until Feb 28)
Action: Settings → Manage Billing → Cancel subscription (keep until period end)
Result:
- Now: Still Professional (until Feb 28)
- Warning banner shows
- Stripe: cancel_at_period_end=True
- DB: plan='professional', cancel_at_period_end=True
- Feb 28: Auto-downgrades to Free via webhook
```

### Scenario 3: Reactivation
```
User: Professional plan (scheduled to cancel Feb 28)
Action: Settings → Manage Billing → Reactivate subscription
Result:
- Warning banner disappears
- Stripe: cancel_at_period_end=False
- DB: cancel_at_period_end=False (via webhook)
- Subscription continues after Feb 28
```

### Scenario 4: Plan Change While Scheduled Cancellation
```
User: Professional (scheduled to cancel Feb 28)
Action: Settings → Pro Plus → Confirm Change
Result:
- Creates new Pro Plus checkout session
- Old Professional subscription stays cancelled
- New subscription starts after payment
```

---

## Testing Checklist

### Test Immediate Cancellation
- [ ] Professional → Free = Immediate downgrade, page reloads, shows Free badge
- [ ] Pro Plus → Free = Immediate downgrade, page reloads, shows Free badge
- [ ] Free plan button changes to "Cancel Subscription" (outline variant)
- [ ] After cancellation, "Manage Billing" button disappears

### Test Scheduled Cancellation
- [ ] Professional → Manage Billing → Cancel (keep until period end)
- [ ] Returns to Settings, warning banner shows with date
- [ ] Plan badge still shows "Professional"
- [ ] Database: `cancel_at_period_end = True`
- [ ] Can reactivate via Manage Billing

### Test Reactivation
- [ ] Schedule cancellation via Billing Portal
- [ ] Warning banner appears
- [ ] Click "Manage Billing" → Reactivate subscription
- [ ] Warning banner disappears
- [ ] Database: `cancel_at_period_end = False`

### Test Webhook Processing
- [ ] Immediate cancel: `subscription.deleted` webhook processes correctly
- [ ] Scheduled cancel: `subscription.updated` webhook sets `cancel_at_period_end=True`
- [ ] Period end: `subscription.deleted` webhook downgrades to Free
- [ ] Reactivation: `subscription.updated` webhook sets `cancel_at_period_end=False`

---

## Summary

**✅ Current Behavior (EXPECTED)**:
1. Stripe portal shows subscription history = **Normal**
2. "Manage Billing" only for paid plans = **By Design**
3. Two cancellation methods = **Feature, not bug**
4. `cancel_at_period_end` updates via webhooks = **Working Correctly**

**✅ Recent Fixes**:
1. Added warning banner for scheduled cancellations
2. Include `cancel_at_period_end` in subscription usage response
3. Better webhook logging for cancellation events
4. Race condition protection between manual and webhook cancellation

**📌 Remember**: 
- Immediate cancel = Use Free plan button
- Scheduled cancel = Use Manage Billing portal
- Both methods are valid and serve different use cases
