# GDPR & Legal Requirements for Expense Flow

## 🇬🇧 UK GDPR Overview

Since you're UK-based and targeting UK market, **UK GDPR** applies (post-Brexit version, nearly identical to EU GDPR).
If you expand to EU, you need to comply with EU GDPR too.

---

## ✅ MANDATORY: The 7 Key GDPR Rights

### 1. Right to Erasure (Right to be Forgotten) ✅ You Know This
**What:** User can request complete deletion of their data
**Timeline:** Must delete within 30 days of request
**Your Implementation:**

```sql
-- Hard delete (GDPR erasure)
-- Must delete in this order (foreign keys):
DELETE FROM audit_logs WHERE user_id = 123;
DELETE FROM mileage_claims WHERE user_id = 123;
DELETE FROM receipts WHERE user_id = 123;
DELETE FROM users WHERE id = 123;

-- Also delete from Google Cloud Storage
-- Delete all files in GCS bucket: users/{user_id}/
```

**Exceptions:** You can keep data if:
- Legal obligation (tax records: UK requires 6 years for business expenses)
- Pending litigation
- But you must anonymize it (remove email, name, etc.)

**For Tax Apps:** You can argue receipts are "business records" and keep for 6 years, but user details should be anonymized.

---

### 2. Right of Access (Subject Access Request - SAR)
**What:** User can request all data you hold about them
**Timeline:** Must provide within 30 days
**Format:** Free, in commonly used electronic format

**Your Implementation:**
```python
# Add endpoint: GET /api/v1/users/me/data-export
@router.get("/me/data-export")
def export_user_data(current_user: User, db: Session):
    """Generate complete data export (GDPR SAR)"""
    receipts = db.query(Receipt).filter(Receipt.user_id == current_user.id).all()
    mileage = db.query(MileageClaim).filter(MileageClaim.user_id == current_user.id).all()
    audit = db.query(AuditLog).filter(AuditLog.user_id == current_user.id).all()
    
    return {
        "personal_info": {
            "email": current_user.email,
            "name": current_user.full_name,
            "created_at": current_user.created_at,
        },
        "receipts": [receipt.to_dict() for receipt in receipts],
        "mileage_claims": [claim.to_dict() for claim in mileage],
        "audit_logs": [log.to_dict() for log in audit],
    }
```

**UI:** Add "Download My Data" button in settings

---

### 3. Right to Data Portability
**What:** User can get their data in machine-readable format to move to competitor
**Timeline:** 30 days
**Format:** JSON or CSV

**Your Implementation:**
- Same as "Right of Access" but offer CSV download option
- Export receipts + mileage claims in standard format
- Include receipt images (zip file)

```python
# Add CSV export option
@router.get("/me/export-csv")
def export_csv(current_user: User, db: Session):
    """Export data as CSV for portability"""
    # Generate CSV with receipts and mileage
    # Return as downloadable file
```

---

### 4. Right to Rectification
**What:** User can correct inaccurate data
**Timeline:** 30 days

**Your Implementation:**
- ✅ Already have: Users can edit receipts, mileage claims, profile
- ✅ Already have: Edit endpoints in your API
- Just make sure users can edit their own data freely

---

### 5. Right to Restrict Processing
**What:** User can request you stop processing their data temporarily
**Timeline:** Immediate

**Your Implementation:**
```python
# Add field to User model
class User(Base):
    # ...existing fields...
    processing_restricted = Column(Boolean, default=False)
    restriction_reason = Column(String, nullable=True)

# Check before processing
def process_receipt(receipt, user):
    if user.processing_restricted:
        raise HTTPException(403, "Data processing restricted by user request")
```

**Rare:** Most users will just delete account instead

---

### 6. Right to Object
**What:** User can object to certain processing (e.g., marketing emails)
**Your Implementation:**
- ✅ You don't send marketing emails (yet)
- If you add newsletters: "Unsubscribe" link required
- If you add AI training on user data: Opt-out option required

---

### 7. Right Not to be Subject to Automated Decision-Making
**What:** User shouldn't be significantly affected by purely automated decisions
**Your Case:** 
- ✅ OCR + GPT categorization is OK (it's assistance, user can override)
- ✅ Not making credit decisions or anything that affects them legally
- ❌ If you auto-reject expenses: Would need human review option

---

## 📄 REQUIRED: Legal Documents

### 1. Privacy Policy (MANDATORY)
**Must Include:**
- What data you collect (email, receipts, location via IP)
- Why you collect it (provide service, process expenses)
- Legal basis (consent, contract, legitimate interest)
- Third parties you share with (Google Cloud, OpenAI, Google Maps)
- How long you keep data (account duration + 6 years for receipts)
- User rights (access, deletion, portability, etc.)
- How to contact you (DPO email - can be you)
- Cookies (if any)
- International transfers (if you host outside UK/EU)

**Where to put it:**
- Link in footer: "Privacy Policy"
- Show during signup (checkbox: "I agree to Privacy Policy")
- Accessible without login

**Template:** Use iubenda.com or termly.io (free generators)

---

### 2. Terms of Service / Terms & Conditions (MANDATORY)
**Must Include:**
- What your service does
- User obligations (don't upload illegal content)
- Your limitations (don't guarantee OCR accuracy)
- Liability limitations (not responsible for tax errors)
- Account termination conditions
- Dispute resolution (UK courts)
- Payment terms (if paid plan)
- Intellectual property (user owns their data)
- Modification rights (can change terms with notice)

**Template:** Use termly.io or getterms.io

---

### 3. Cookie Policy (If You Use Cookies)
**Your App:**
- ✅ Essential cookies: Auth tokens (allowed without consent)
- ❌ Analytics cookies: Google Analytics would need consent banner
- ❌ Marketing cookies: Facebook Pixel would need consent

**Current:** You likely only use essential cookies (auth), so just mention in Privacy Policy.

**If you add analytics:** Need cookie banner with "Accept/Reject" option

---

## 🔒 REQUIRED: Data Protection Measures

### 1. Data Security (Technical Measures)
**You Must Have:**
- ✅ HTTPS only (encrypt data in transit)
- ✅ Hashed passwords (bcrypt) - you likely have this
- ✅ API authentication (JWT tokens) - you have this
- ✅ Database access controls (not publicly accessible)
- ❌ Encryption at rest (database) - nice-to-have
- ❌ Two-factor authentication - nice-to-have

**Action:** Verify passwords are hashed (not plain text)

---

### 2. Data Minimization
**Principle:** Only collect data you actually need
**Your App:**
- ✅ Email, password: Needed for auth
- ✅ Receipts, mileage: Needed for service
- ✅ IP address (in logs): Legitimate interest (security)
- ❌ Phone number: Don't collect if not needed
- ❌ Address: Don't collect if not needed

**Action:** Only ask for data you use

---

### 3. Purpose Limitation
**Principle:** Only use data for stated purpose
**Your Case:**
- ✅ Use receipts for expense tracking (stated purpose)
- ❌ Don't use receipts to train your own AI (unless user consents)
- ❌ Don't sell user data to third parties
- ❌ Don't send marketing emails without consent

---

### 4. Data Retention
**Principle:** Don't keep data longer than necessary
**Your Policy:**
- Active accounts: Keep data indefinitely
- Deleted accounts: Delete immediately OR
- Tax records: Can keep 6 years (UK HMRC requirement)

**Add to Privacy Policy:**
```
"We retain your data while your account is active. Upon deletion, 
personal data is removed within 30 days. Receipt records may be 
retained for 6 years to comply with UK tax law requirements."
```

---

## 🚨 REQUIRED: Data Breach Notification

**If you have a data breach:**
1. **72 hours:** Must report to ICO (UK data regulator) if "high risk"
2. **Without undue delay:** Must notify affected users
3. **Document:** What happened, impact, remedial actions

**What counts as breach:**
- Database hacked and user data stolen
- Receipt images leaked
- API keys exposed (if contains user data)

**Not a breach:**
- Single user account hacked (user's weak password)
- Your server goes down temporarily (no data lost)

**ICO Contact:** ico.org.uk (UK Information Commissioner's Office)

---

## 👶 Age Restrictions

**UK GDPR:** Users under 13 cannot consent
**UK Law:** Users 13-15 need parental consent for data processing

**Your App:**
- Likely targeting 18+ (business users)
- Add to Terms: "You must be 18+ to use this service"
- Add age check at signup (checkbox)

---

## 🌍 International Data Transfers

**Issue:** If you send data outside UK/EU (e.g., US servers)
**Your Stack:**
- OpenAI: US company (needs adequacy decision or standard clauses)
- Google Cloud: Likely UK/EU data centers if configured
- Hosting: Check where servers are located

**OpenAI GDPR:**
- They have Data Processing Agreement (DPA)
- Add to Privacy Policy: "We use OpenAI (US) for categorization"

**Action:** Check your hosting location (prefer UK/EU)

---

## 📋 Practical Implementation Checklist

### Before Launch:
- [ ] Write Privacy Policy (use generator, then customize)
- [ ] Write Terms of Service (use generator)
- [ ] Add checkbox at signup: "I agree to Privacy Policy and Terms"
- [ ] Add footer links to Privacy & Terms pages
- [ ] Add "Delete Account" button in settings
- [ ] Implement hard delete function (with 30-day grace period?)
- [ ] Add "Download My Data" button in settings (JSON export)
- [ ] Verify passwords are hashed (bcrypt with salt)
- [ ] HTTPS only (no HTTP)
- [ ] Add age restriction (18+) at signup

### Week 1:
- [ ] Create data breach response plan (document who to contact)
- [ ] Designate DPO (Data Protection Officer - can be you for now)
- [ ] Add DPO contact to Privacy Policy (e.g., privacy@yourapp.com)

### Nice-to-Have:
- [ ] CSV export option (for portability)
- [ ] Account suspension feature (for "restrict processing")
- [ ] 2FA for account security
- [ ] Email verification
- [ ] Audit log of data access (you already have audit logs!)

---

## 💰 GDPR Fines (Scary but Unlikely)

**Maximum Fine:** Up to €20M or 4% of global turnover (whichever is higher)
**Reality:** Small startups usually get:
- First offense: Warning + requirement to fix
- Repeated violations: £1,000-£10,000 fines
- Serious breach: Higher fines

**How to avoid fines:**
1. Have Privacy Policy
2. Respond to user requests within 30 days
3. Report breaches within 72 hours
4. Don't be negligent with security

**ICO is reasonable with startups** - they want compliance, not punishment.

---

## 🇪🇺 EU vs UK GDPR Differences (Post-Brexit)

**Mostly the same, key differences:**
- **UK:** Report to ICO (ico.org.uk)
- **EU:** Report to local DPA (e.g., CNIL in France)
- **UK:** Adequacy decision for UK data transfers
- **Both:** Nearly identical user rights and requirements

**If you have EU users:**
- Technically need EU representative (can be you)
- Must comply with both UK and EU GDPR
- For small startups: UK GDPR compliance covers 95% of EU GDPR

---

## 📧 User Deletion Flow (Best Practice)

**Recommended Flow:**
1. User clicks "Delete Account" in settings
2. Show warning: "This will permanently delete all your data"
3. Require password confirmation
4. Send confirmation email: "Your account will be deleted in 7 days"
5. 7-day grace period (user can cancel)
6. After 7 days: Hard delete everything

**Code Example:**
```python
@router.delete("/me")
def request_account_deletion(current_user: User, db: Session):
    """Request account deletion (7-day grace period)"""
    current_user.deletion_requested_at = datetime.utcnow()
    db.commit()
    
    # Send email: "Your account will be deleted on [date]"
    send_deletion_email(current_user)
    
    return {"message": "Account deletion scheduled for 7 days"}

# Background job runs daily
def process_deletions(db: Session):
    """Delete accounts past grace period"""
    cutoff = datetime.utcnow() - timedelta(days=7)
    users = db.query(User).filter(
        User.deletion_requested_at < cutoff
    ).all()
    
    for user in users:
        # Hard delete
        delete_user_data(user.id, db)
```

---

## 🔐 OpenAI Data Processing Agreement

**Important:** OpenAI processes your user data (receipt text for categorization)

**Action Required:**
1. Sign OpenAI's Data Processing Agreement (DPA)
   - Available at platform.openai.com
2. Mention in Privacy Policy:
   - "We use OpenAI to categorize expenses. OpenAI does not retain your data."
3. OpenAI's commitment:
   - API data not used for training (as of their policy)
   - 30-day retention, then deleted

---

## 📞 What to Tell Users

**In Plain English (for Privacy Policy):**

> "We collect your email, password, and expense data (receipts, mileage) to provide our service. 
> We use Google Cloud for storage, Google Vision for OCR, OpenAI for categorization, and Google Maps 
> for distance calculation. We never sell your data. You can download or delete your data anytime. 
> We keep data while your account is active, plus 6 years for tax compliance if needed."

**User Rights Section:**
> "You can: 
> - Download all your data (Settings → Download My Data)
> - Delete your account (Settings → Delete Account)
> - Correct any errors (Edit any receipt or claim)
> - Contact us at privacy@yourapp.com with questions"

---

## ✅ Summary: Must-Haves

### Before Launch (Legal):
1. **Privacy Policy** (use generator, add to site)
2. **Terms of Service** (use generator, add to site)
3. **Consent at signup** (checkbox agreeing to both)
4. **Delete account function** (hard delete within 30 days)
5. **Download data function** (JSON export minimum)
6. **HTTPS only** (no HTTP)
7. **DPO contact** (privacy@yourapp.com)

### Code Changes Needed:
```python
# 1. Add to User model
class User(Base):
    deletion_requested_at = Column(DateTime, nullable=True)

# 2. Add endpoints
POST /api/v1/users/me/delete-request  # Request deletion
GET  /api/v1/users/me/export           # Download data

# 3. Background job
# Delete users where deletion_requested_at > 7 days ago
```

### Frontend Changes:
```typescript
// Settings page
<Button onClick={requestDeletion}>Delete Account</Button>
<Button onClick={downloadData}>Download My Data</Button>

// Signup page
<Checkbox>
  I agree to <Link>Privacy Policy</Link> and <Link>Terms</Link>
</Checkbox>
```

---

## 🆘 Resources

**Privacy Policy Generators (Free):**
- termly.io/products/privacy-policy-generator/
- iubenda.com
- getterms.io

**GDPR Guides:**
- ico.org.uk/for-organisations/ (UK official guide)
- gdpr.eu (practical GDPR guide)

**Legal Help:**
- law.co.uk (UK solicitors)
- LegalZoom (document services)

**For Startups:**
Most use: Termly + Template ToS + Common sense = Compliant enough for launch

---

## 💡 Real Talk: GDPR for Small Startups

**The Truth:**
- ICO doesn't hunt small startups
- Have Privacy Policy & Terms = 90% compliant
- Respond to user requests = 100% compliant
- Only sue if egregiously negligent or ignoring complaints

**Priority:**
1. ✅ Privacy Policy + Terms (required)
2. ✅ Delete account function (required)
3. ✅ Basic security (HTTPS, hashed passwords)
4. 🟡 Data export (nice-to-have initially)
5. 🟢 DPA with vendors (do eventually)

**Start with basics, improve as you grow.** Don't let GDPR block your launch, but do the minimum required.

---

**Need help implementing deletion/export endpoints? Let me know!**
