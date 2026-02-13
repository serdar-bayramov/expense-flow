# SendGrid Email Forwarding Implementation

## Overview
Enable users to forward receipts via email to `receipts@yourapp.com` for automatic processing and upload.

## User Flow
1. User takes photo of receipt on phone
2. Emails receipt image to `receipts@yourapp.com`
3. System receives email, extracts attachment
4. Uploads to GCS and triggers OCR automatically
5. Receipt appears in user's dashboard

## Prerequisites
- SendGrid account (free tier: 100 emails/day)
- Domain/subdomain for receiving emails (e.g., `receipts.expenseflow.com`)
- DNS configuration access

## Implementation Steps

### Step 1: SendGrid Account Setup
**Manual Steps (You do this):**
1. Go to https://sendgrid.com and sign up
2. Verify your email address
3. Navigate to Settings → Inbound Parse
4. Click "Add Host & URL"
5. Set up subdomain: `receipts.yourdomain.com`
6. Add MX record to your DNS:
   ```
   Type: MX
   Host: receipts
   Value: mx.sendgrid.net
   Priority: 10
   ```
7. Wait for DNS propagation (5-30 minutes)
8. Get your API key from Settings → API Keys

**What you'll need:**
- Your domain name
- DNS access (wherever your domain is hosted)

---

### Step 2: Backend - Email Webhook Endpoint
**I'll create:**
- `app/api/v1/email.py` - Webhook endpoint for receiving emails
- Email parsing logic to extract attachments
- User identification via email address

**Endpoint:** `POST /api/v1/email/inbound`

**How it works:**
- SendGrid posts email data to this endpoint
- Parse multipart form data
- Extract image attachments (jpg, png, pdf)
- Look up user by sender email
- Upload to GCS and create receipt

---

### Step 3: Database - Email Verification
**I'll add:**
- `verified_emails` table: Links email addresses to users
- Users can add multiple email addresses
- Verification flow: Send confirmation link

**Schema:**
```sql
CREATE TABLE verified_emails (
  id SERIAL PRIMARY KEY,
  user_id INTEGER REFERENCES users(id),
  email VARCHAR(255) UNIQUE NOT NULL,
  verified BOOLEAN DEFAULT FALSE,
  verification_token VARCHAR(255),
  created_at TIMESTAMP
);
```

---

### Step 4: Frontend - Email Management UI
**I'll add to Settings page:**
- Section: "Email Forwarding"
- Add email address input
- List of verified emails
- Remove email option
- Instructions: "Forward receipts to receipts@yourapp.com from any verified email"

---

### Step 5: Email Verification Flow
**User adds email:**
1. User enters email in settings
2. Backend sends verification email
3. User clicks link
4. Email marked as verified
5. Can now forward receipts from that email

---

### Step 6: Security & Error Handling
**I'll implement:**
- Webhook signature verification (SendGrid signs requests)
- Rate limiting (max 50 emails per user per day)
- Virus scanning for attachments (optional, can use ClamAV)
- Error notifications to user if parsing fails
- Supported formats check (jpg, png, pdf only)

---

### Step 7: Testing
**Test scenarios:**
- Email with single image attachment → Creates receipt
- Email with multiple images → Creates multiple receipts
- Email from unverified address → Rejected with notification
- Email with no attachment → Error notification
- Email with unsupported format → Error notification

---

## Cost Estimate
- **SendGrid Free Tier:** 100 emails/day = $0
- **SendGrid Essentials:** $19.95/month = 50,000 emails/month
- **For 100 users:** ~$0.20/user/month (assuming 10 receipts/month)

## Environment Variables Needed
```bash
SENDGRID_API_KEY=your_sendgrid_api_key
SENDGRID_WEBHOOK_SECRET=your_webhook_secret  # For signature verification
VERIFIED_EMAIL_FROM=noreply@yourdomain.com   # For sending verification emails
```

## SendGrid Configuration in Code
You'll need to configure:
1. Inbound Parse URL: `https://yourbackend.com/api/v1/email/inbound`
2. Enable POST of raw email: No (we'll use parsed data)
3. Enable spam check: Yes

## Step-by-Step Execution Order

**Phase 1: Backend Foundation** (I do this)
1. Create database migration for `verified_emails` table
2. Create email webhook endpoint
3. Add email parsing logic
4. Test with curl/Postman

**Phase 2: SendGrid Setup** (You do this)
1. Create SendGrid account
2. Configure inbound parse
3. Add MX record to DNS
4. Provide me with API key (add to .env)
5. Test by sending email

**Phase 3: Frontend UI** (I do this)
1. Add email management section to settings
2. Add/remove email functionality
3. Display verification status
4. Instructions/help text

**Phase 4: Email Verification** (I do this)
1. Verification email sending
2. Verification link endpoint
3. Token validation
4. Update UI to show verified status

**Phase 5: Testing & Polish** (We do together)
1. Send test emails with receipts
2. Verify receipts appear in dashboard
3. Test error cases
4. Add user-friendly error messages

## Expected Timeline
- **Backend foundation:** 2-3 hours
- **SendGrid setup:** 30 minutes (waiting for DNS)
- **Frontend UI:** 1-2 hours
- **Email verification:** 1 hour
- **Testing:** 1 hour
- **Total:** ~6-7 hours (spread over 2 days due to DNS propagation)

## Alternative: Mailgun
If SendGrid is too complex, we could use Mailgun instead:
- Similar pricing
- Similar API
- Sometimes easier DNS setup

## Future Enhancements (Not in MVP)
- ✉️ Email templates for verification/errors
- 📧 Reply-to confirmation: "Receipt received! Processing..."
- 🔄 Retry failed processing
- 📊 Email forwarding analytics
- 🤖 Smart subject line parsing (extract notes from subject)
- 📎 Multiple attachments in one email → bulk upload

---

## Ready to Start?

**Your first action:**
1. Go to https://sendgrid.com and create account
2. Let me know when done, and I'll start building the backend

**OR**

If you want me to start coding first (while you set up SendGrid), I can build the backend endpoints and test with mock data.

What would you prefer?
