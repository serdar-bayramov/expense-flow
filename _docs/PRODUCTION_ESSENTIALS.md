# Production Essentials - Pre-Launch Checklist

## ✅ CRITICAL (Do Before Launch)

### 1. Error Tracking - Sentry (Free, 30 mins setup)
**Why:** Know immediately when something breaks in production
**Setup:**
- Sign up at sentry.io (free 5k errors/month)
- Add to backend: `pip install sentry-sdk[fastapi]`
- Add to frontend: `npm install @sentry/nextjs`
- Get instant notifications when errors occur

**Value:** Catch bugs users don't report. See exact error + stack trace + user context.

---

### 2. Uptime Monitoring (Free, 10 mins)
**Why:** Know when your site goes down
**Options:**
- Better Uptime (betteruptime.com) - 10 monitors free
- UptimeRobot - 50 monitors free
- Pingdom - 1 monitor free

**Setup:** Ping `https://yourapp.com/health` every 5 minutes, alert via email/SMS.

**Value:** Critical. You need to know immediately if your site is down.

---

### 3. Database Backups (Required, 15 mins)
**Why:** Don't lose all user data
**Setup:**
- Render/Railway: Enable daily automated backups (checkbox in settings)
- Supabase: Automatic, but verify backup schedule
- Test restoration process once

**Value:** Essential for disaster recovery.

---

### 4. Rate Limiting (30 mins)
**Why:** Prevent abuse, API cost explosions
**Setup:**
```bash
cd backend
pip install slowapi
```
Protects against users hammering your APIs and running up costs.

**Value:** Prevents $1000+ surprise bills from abuse.

---

### 5. Health Check Endpoint (5 mins)
**Why:** Uptime monitoring needs something to ping
**Already have:** Your app likely has `/` endpoint
**Ideal:** `/api/health` that checks database connection

**Value:** Quick way to verify app + database are working.

---

### 6. Production Environment Variables
**Why:** Keep secrets secure
**Checklist:**
- ✅ Use environment variables (not hardcoded)
- ✅ Different API keys for dev/prod
- ✅ Restrict API keys (you already did this for Google Maps)
- ✅ Never commit `.env` to git

**Value:** Security basics.

---

## 🟡 IMPORTANT (Do Within First Week)

### 7. Basic User Management (1-2 hours)
**Don't build admin UI yet.** Instead:

**Option A: Database GUI (Easiest)**
- Use Supabase Studio / Railway DB viewer / TablePlus
- Directly view users, receipts, mileage claims
- Can delete users via SQL if needed

**Option B: Simple Admin Endpoints** (if you want programmatic control)
```python
# Add to backend/app/api/v1/admin.py
@router.get("/users")
def list_users(current_user: User = Depends(get_current_admin_user)):
    # List all users with counts
    pass

@router.delete("/users/{user_id}")
def delete_user(user_id: int, hard_delete: bool = False):
    # GDPR deletion support
    pass
```

**Why not full admin UI?** Time vs value. You can:
- Check costs: GCP Console → Billing
- Check OpenAI usage: platform.openai.com → Usage
- Check users: Database GUI
- Check errors: Sentry dashboard

**Build admin UI later** when you have >100 users and need it frequently.

---

### 8. Google Cloud Budget Alerts (10 mins)
**Why:** Get alerted if costs spike
**Setup:**
1. GCP Console → Billing → Budgets & alerts
2. Set budget: $200/month (your free tier)
3. Alert at 50%, 90%, 100%
4. Email notifications

**Value:** Prevents surprise bills. Essential for API-heavy apps.

---

### 9. Cost Monitoring (Where to Check)

**You DON'T need custom tracking.** Use existing dashboards:

**Google Cloud (Vision OCR + Maps):**
- console.cloud.google.com → Billing → Reports
- See costs per API (Vision, Distance Matrix, Geocoding)
- Export to CSV if needed

**OpenAI (GPT-4o-mini):**
- platform.openai.com → Usage
- See daily token usage and costs
- Set usage limits under Organization settings

**Database & Hosting:**
- Render/Railway dashboard shows usage
- Supabase shows database size

**Storage (GCS):**
- GCP Console → Cloud Storage → your bucket → Usage

**Action:** Check these dashboards weekly for first month, then monthly.

---

### 10. Logging Configuration (30 mins)
**Why:** Debug production issues
**Setup:**
- FastAPI already logs to console
- Railway/Render capture logs automatically
- View logs in hosting dashboard

**Enhancement:**
```python
# backend/app/core/logging.py
import logging
import sys

logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
    handlers=[logging.StreamHandler(sys.stdout)]
)

# Log important events
logger = logging.getLogger(__name__)
logger.info(f"User {user_id} created mileage claim: ${amount}")
logger.warning(f"High API usage: {count} calls in 1 hour")
```

**Value:** Helps debug issues users report.

---

## 🟢 NICE-TO-HAVE (Post-Launch)

### Later Enhancements (When You Have Time/Users):
- **Analytics** (PostHog, Google Analytics): Track user behavior
- **Session Replay** (LogRocket): See what users did before error
- **Admin Dashboard** (Retool, custom React): When you have >100 users
- **API Usage Tracking**: Database table tracking per-user API costs
- **Advanced Monitoring** (DataDog): When app is complex
- **Feature Flags** (PostHog, LaunchDarkly): Gradual rollouts

---

## 📊 What to Monitor Weekly (First Month)

### Monday Morning Checklist:
1. **Check Sentry** (2 mins): Any new errors?
2. **Check GCP Billing** (2 mins): Costs tracking as expected?
3. **Check OpenAI Usage** (1 min): Token usage reasonable?
4. **Uptime Report** (1 min): Any downtime last week?
5. **User Count** (1 min): How many signups?

**Total: 7 minutes/week**

After stable, move to monthly checks.

---

## 🚨 Alert Thresholds (Configure These)

### Set up alerts for:
1. **Uptime:** Site down > 5 mins → SMS/Email
2. **GCP Costs:** > $100/month → Email
3. **Sentry:** > 10 errors/hour → Email
4. **OpenAI:** > $50/day → Email

These prevent disasters from going unnoticed.

---

## 💡 Key Insight: Use Existing Tools

**Don't build what vendors provide:**
- ❌ Don't build cost tracking → Use GCP/OpenAI dashboards
- ❌ Don't build admin UI yet → Use database GUI
- ❌ Don't build analytics → Use simple queries
- ✅ Do build: Core product features users pay for

**Your time is valuable.** Focus on:
1. Error tracking (Sentry) - catches bugs
2. Uptime monitoring - know when down
3. Rate limiting - prevent abuse
4. Backups - don't lose data

Everything else can use vendor dashboards initially.

---

## 🎯 Recommended Setup Order

**This weekend (2 hours total):**
1. Sentry error tracking (30 mins)
2. Uptime monitor (10 mins)
3. Verify database backups (15 mins)
4. Rate limiting (30 mins)
5. GCP budget alerts (10 mins)
6. Health check endpoint (5 mins)
7. Test everything (20 mins)

**Week 1 after launch:**
- Check dashboards daily
- Fix any errors in Sentry
- Monitor costs

**Week 2+:**
- Move to weekly checks
- Build features users request
- Add admin UI only if you need it frequently

---

## 📝 GDPR/Data Deletion (Important for UK/EU)

Since you're UK-based and targeting UK market:

**User Deletion Process:**
1. User requests account deletion (support email)
2. You run SQL or API call to delete their data:
   ```sql
   -- Soft delete (keeps audit trail)
   UPDATE users SET deleted_at = NOW() WHERE id = 123;
   
   -- Hard delete (GDPR right to deletion)
   DELETE FROM mileage_claims WHERE user_id = 123;
   DELETE FROM receipts WHERE user_id = 123;
   DELETE FROM audit_logs WHERE user_id = 123;
   DELETE FROM users WHERE id = 123;
   ```
3. Delete their files from GCS bucket
4. Respond within 30 days (GDPR requirement)

**Add to Terms of Service:** "Users can request data deletion by emailing support@yourapp.com"

---

## ✅ Pre-Launch Final Checklist

- [ ] Sentry installed & tested (trigger test error)
- [ ] Uptime monitor pinging site every 5 mins
- [ ] Database backups enabled & tested restoration
- [ ] Rate limiting on all API endpoints
- [ ] GCP budget alerts configured
- [ ] Health endpoint returns 200 OK
- [ ] All API keys use production (not dev) values
- [ ] CORS configured for production domain only
- [ ] HTTPS enforced (not HTTP)
- [ ] Privacy policy mentions data deletion rights
- [ ] You know where to check: GCP costs, OpenAI usage, errors

**Total setup time: ~2 hours**
**Maintenance time: ~10 mins/week**

---

## 🎓 Learning Resources

- **Sentry Docs**: docs.sentry.io/platforms/python/guides/fastapi/
- **FastAPI Best Practices**: fastapi.tiangolo.com/deployment/
- **GCP Cost Management**: cloud.google.com/billing/docs/how-to/budgets
- **Rate Limiting**: slowapi.readthedocs.io/

---

**Remember:** You can always add more monitoring later. Start simple, launch fast, iterate based on real usage patterns. Don't over-engineer before you have users!
