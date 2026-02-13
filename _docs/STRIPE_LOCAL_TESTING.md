# Stripe Local Testing Guide

## 🎯 Purpose
Test subscription downgrades locally using Stripe test mode before deploying to production.

## ✅ Setup (One-Time)

### 1. Stripe CLI Login
```bash
stripe login
```
This opens a browser to authenticate with your Stripe account.

### 2. Verify Test Keys in .env
Your `.env` already has test keys configured:
- `STRIPE_SECRET_KEY=sk_test_...` ✅
- `STRIPE_WEBHOOK_SECRET=whsec_...` ✅
- `STRIPE_PROFESSIONAL_PRICE_ID=price_...` ✅
- `STRIPE_PRO_PLUS_PRICE_ID=price_...` ✅

## 🚀 Testing Workflow

### Step 1: Start Backend (Terminal 1)
```bash
cd backend
uvicorn app.main:app --reload
```
Backend runs on: http://localhost:8000

### Step 2: Start Stripe Webhook Forwarding (Terminal 2)
```bash
stripe listen --forward-to localhost:8000/api/v1/webhooks/stripe
```
This forwards Stripe webhooks to your local backend.

**Important**: Copy the webhook signing secret from the output:
```
> Ready! Your webhook signing secret is whsec_xxxxx (^C to quit)
```

Update your `.env` with this new secret:
```bash
STRIPE_WEBHOOK_SECRET=whsec_xxxxx
```

Then restart the backend (Terminal 1).

### Step 3: Start Frontend (Terminal 3)
```bash
cd frontend
npm run dev
```
Frontend runs on: http://localhost:3000

### Step 4: Test Subscription Downgrade

1. **Go to**: http://localhost:3000
2. **Login** with test account
3. **Subscribe to Pro Plus** using test card: `4242 4242 4242 4242`
4. **Downgrade to Professional**
5. **Check logs** in all terminals

## 🔍 What to Verify

### Backend Logs Should Show:
```
📅 Created subscription schedule: sub_sched_xxxxx
⬇️  SCHEDULED downgrade for subscription sub_xxx to price_xxx at period end (1706918400)
```

### Stripe CLI Logs Should Show:
```
subscription_schedule.created [evt_xxxxx]
```

### Frontend Should Show:
```
✅ "You'll switch to professional on [DATE]. You keep your current plan until then!"
```

### Stripe Dashboard Should Show:
- Subscription status: Active (still on Pro Plus)
- Scheduled change: Switch to Professional on [DATE]

## 🧪 Test Cards

- **Success**: `4242 4242 4242 4242`
- **Decline**: `4000 0000 0000 0002`
- **3D Secure**: `4000 0025 0000 3155`

Any CVV, any future expiry date, any postal code.

## 📊 Expected Behavior

### Downgrade (Pro Plus → Professional):
- ✅ Subscription schedule created
- ✅ User keeps Pro Plus until period end
- ✅ No immediate charge/refund
- ✅ Message: "You'll switch on [DATE]"
- ✅ Stripe dashboard shows scheduled change

### Upgrade (Professional → Pro Plus):
- ✅ Immediate upgrade
- ✅ Prorated charge for difference
- ✅ User gets Pro Plus features instantly
- ✅ Message: "Upgrade successful!"

## 🐛 Troubleshooting

### "Webhook signature verification failed"
- Make sure `STRIPE_WEBHOOK_SECRET` in `.env` matches the one from `stripe listen`
- Restart backend after changing `.env`

### "No subscription found"
- Subscribe first using test card `4242 4242 4242 4242`
- Check backend logs for subscription creation

### "Price not recognized"
- Verify price IDs in `.env` match your Stripe test mode products
- Check: https://dashboard.stripe.com/test/products

## 📝 Verification Checklist

- [ ] Backend running on localhost:8000
- [ ] Stripe CLI forwarding webhooks
- [ ] Frontend running on localhost:3000
- [ ] Can subscribe with test card
- [ ] Can downgrade (scheduled, not immediate)
- [ ] Can upgrade (immediate with proration)
- [ ] Backend logs show subscription schedule creation
- [ ] Stripe dashboard shows scheduled change

## 🎉 Success Criteria

If you see:
1. **Backend log**: `📅 Created subscription schedule: sub_sched_xxxxx`
2. **Stripe CLI**: `subscription_schedule.created` event received
3. **Frontend**: "You'll switch on [DATE]" message
4. **Stripe Dashboard**: Scheduled change visible

Then the fix is working correctly! ✅

## Next Steps After Successful Test

1. Commit changes to `develop` branch (or directly to `main` if confident)
2. Push to GitHub
3. Railway auto-deploys
4. Test on production with real subscription
5. Celebrate! 🎉
