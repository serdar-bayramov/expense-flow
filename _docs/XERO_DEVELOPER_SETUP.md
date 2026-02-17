# Xero Developer Account Setup Guide

## Step-by-Step Instructions

### 1. Create Free Xero Developer Account

**Go to:** https://developer.xero.com/

**Click:** "Get Started" or "Sign Up"

**You'll need:**
- Email address
- Password
- Accept terms & conditions

**Cost:** 100% FREE ✅

---

### 2. Create a Demo Organization (For Testing)

Before creating an app, you need a Xero organization to test with.

**Go to:** https://login.xero.com/

**Click:** "Try Xero for free"

**Fill in:**
- Business name: "ExpenseFlow Test" (or anything)
- Industry: "Information Technology & Services"  
- Region: "United Kingdom"

This gives you a free 30-day trial organization for testing. You can create multiple demo orgs if needed.

**Important:** This is your TEST organization. Your real users will connect their own Xero accounts.

---

### 3. Create Your Xero App

**Go to:** https://developer.xero.com/app/manage

**Click:** "New app"

**Choose:** "Web app" (NOT mobile/desktop)

**Fill in the form:**

```
App name: ExpenseFlow
Company or application URL: https://expenseflow.co.uk
Redirect URIs: http://localhost:3000/api/xero/callback
```

**Important Notes:**

**Company URL:**
- Can be your production domain (https://expenseflow.co.uk)
- OR localhost (http://localhost:3000)
- This is just informational, doesn't affect OAuth

**Redirect URI:**
- Development: MUST be `http://localhost:3000/api/xero/callback`
- Must use "localhost" (NOT 127.0.0.1 or IP addresses)
- Xero allows http:// for localhost specifically
- Production: Add `https://expenseflow.co.uk/api/xero/callback` later
- You can add multiple URIs separated by commas:
  `http://localhost:3000/api/xero/callback, https://expenseflow.co.uk/api/xero/callback`

**If Xero rejects http://localhost:**
- Make sure you typed "localhost" exactly (not an IP)
- Try adding your production HTTPS URL first, then add localhost
- Some accounts require at least one HTTPS URL

**About Scopes (Permissions):**
- ❗ Xero does NOT configure scopes in the developer portal
- Scopes are requested dynamically in your code during OAuth flow
- You'll see "Select scopes" in some guides - ignore this for Xero
- We'll handle scopes in Step 3 when building the OAuth service
- Scopes we'll request:
  - `accounting.transactions` - Create/read bank transactions
  - `accounting.attachments` - Upload receipt images
  - `accounting.contacts.read` - Read supplier names
  - `accounting.settings.read` - Read chart of accounts
  - `offline_access` - Get refresh tokens (important!)

**Click:** "Create app"

---

### 4. Get Your Credentials

After creating the app, you'll see:

**Client ID:** Something like `91E5715B1199038080D6D0296EBC1648`
- Copy this ✅

**Click:** "Generate a secret"

**Client Secret:** Something like `Kp8Q_abcdefghijklmnopqrstuvwxyz123456`
- Copy this ✅
- **IMPORTANT:** You can only see this once! Save it securely.

---

### 5. Add to Your .env File

Open your `.env` file (create if doesn't exist) and add:

```bash
# Xero Integration
XERO_CLIENT_ID=YOUR_CLIENT_ID_FROM_STEP_4
XERO_CLIENT_SECRET=YOUR_CLIENT_SECRET_FROM_STEP_4
XERO_REDIRECT_URI=http://localhost:3000/api/xero/callback
XERO_ENCRYPTION_KEY=gSOWvjtBSlhO4tmkxy8BtroMlJ-b0jjCVTH2lmp4Ydk=
```

Replace `YOUR_CLIENT_ID_FROM_STEP_4` and `YOUR_CLIENT_SECRET_FROM_STEP_4` with your actual values.

**Security:**
- Never commit `.env` to git (should be in `.gitignore`)
- Don't share these credentials publicly
- Each environment (dev/prod) should have different credentials

---

### 6. Verify Configuration

Your Xero developer app should show (in Configuration tab):

```
App name: ExpenseFlow
Status: Development
Grant type: Authorization Code
OAuth 2.0 redirect URIs: http://localhost:3000/api/xero/callback
Client ID: [Your client ID]
Client Secret: [Generated - you saved this]
```

**Note:** You won't see "Scopes" listed in the portal - Xero requests scopes dynamically in the authorization URL (we'll implement this in Step 3).

**Limits in Development:**
- Can connect to 25 organizations (plenty for testing)
- No API rate limits for development
- Free forever for development

**When ready for production:**
- Apply to become a "Xero App Partner" (free, requires approval)
- Update redirect URI to production URL
- Generate new production credentials

---

## Testing Your Setup

Once credentials are in `.env`, test the connection:

```bash
cd backend

# Verify environment variables are loaded
python -c "from app.core.database import settings; print(settings.XERO_CLIENT_ID[:10] + '...')"
# Should print first 10 chars of your client ID

# If you see error about module, just check .env file exists
```

---

## Common Issues & Fixes

### Issue 1: "Redirect URI mismatch"
**Fix:** URI in Xero app settings must EXACTLY match .env file (including http:// and /api/xero/callback)

### Issue 2: "Invalid client"
**Fix:** Check XERO_CLIENT_ID and XERO_CLIENT_SECRET are correct

### Issue 3: "Insufficient scope"
**Fix:** Go back to app settings, add missing scopes, save

### Issue 4: Can't see client secret
**Fix:** Generate a new secret (old one is lost forever if not saved)

---

## What's Next?

After completing this setup:

✅ Xero developer account created  
✅ Demo organization created (for testing)  
✅ App registered with OAuth credentials  
✅ Credentials added to `.env`  
✅ Settings.py updated  

**Next Step:** Implement OAuth flow (connect button → authorization → callback)

---

## Useful Links

- **Developer Portal:** https://developer.xero.com/app/manage
- **API Documentation:** https://developer.xero.com/documentation/api/accounting/overview
- **OAuth Guide:** https://developer.xero.com/documentation/guides/oauth2/auth-flow
- **Scopes Reference:** https://developer.xero.com/documentation/guides/oauth2/scopes
- **Support:** https://developer.xero.com/support

---

## Cost Summary

| Item | Cost |
|------|------|
| Developer account | FREE ✅ |
| Demo organization (30 days) | FREE ✅ |
| API usage (development) | FREE ✅ |
| Connect 25 orgs | FREE ✅ |
| App Partner status | FREE (requires approval) ✅ |

**Total: £0.00** 🎉
