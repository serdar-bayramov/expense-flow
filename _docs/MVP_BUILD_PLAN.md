# Expense Flow - MVP Build Plan

## Current Status (✅ Completed Features)

### Core Receipt Management
- ✅ Receipt upload with drag-and-drop
- ✅ Multi-file upload support
- ✅ OCR with Google Vision API
- ✅ AI extraction with OpenAI GPT-4o-mini
- ✅ PDF support
- ✅ Receipt editing and categorization
- ✅ HMRC-compliant expense categories
- ✅ Image storage on Google Cloud Storage

### Dashboard & Analytics
- ✅ Dashboard overview with stats
- ✅ Analytics page with charts
- ✅ Category breakdown with pie chart
- ✅ Monthly trends
- ✅ Date range filtering
- ✅ Tax year filtering (UK April 6 - April 5)
- ✅ Receipt status tracking (pending/completed/failed)

### User Experience
- ✅ Dark mode support
- ✅ Responsive design
- ✅ Receipt detail page with edit capability
- ✅ Approval workflow for pending receipts
- ✅ Search and filtering (by category, date, status, vendor)

### Compliance & Security
- ✅ Complete audit trail system
- ✅ Receipt history timeline
- ✅ Soft delete with recovery
- ✅ JWT authentication
- ✅ Password hashing with bcrypt
- ✅ User-specific data isolation

---

## 🔴 CRITICAL - Must Have Before MVP Launch

### 1. Email Forwarding (SendGrid) ⚠️ PRIORITY 1
**Status:** Not started  
**Estimated Time:** 2-3 days

**Requirements:**
- SendGrid Inbound Parse webhook setup
- Unique email per user (receipts+userid@expenseflow.com)
- Email attachment extraction
- Create receipt from emailed images
- Email verification flow
- Test with Gmail, Outlook, mobile email

**Technical:**
- Backend: `/api/v1/webhooks/sendgrid` endpoint
- Parse multipart email with attachments
- Extract sender, validate against user email
- Auto-create receipt with source="email"
- Audit log email receipts

---

### 2. Export Functionality ⚠️ PRIORITY 2
**Status:** Not started  
**Estimated Time:** 2 days

**CSV Export:**
- Export all receipts or filtered subset
- Columns: Date, Vendor, Category, Total, VAT, Status, Notes
- Include summary row with totals
- Filter by date range, category, tax year
- Download from receipts page

**PDF Report:**
- Professional formatted report
- Cover page with date range and totals
- Receipt details table
- Category breakdown section
- VAT summary
- Company branding
- Generate on analytics page

**Technical:**
- Backend: `/api/v1/receipts/export/csv` endpoint
- Backend: `/api/v1/receipts/export/pdf` endpoint
- Use Python `csv` module for CSV
- Use `reportlab` or `weasyprint` for PDF
- Frontend: Download buttons on receipts and analytics pages

---

### 3. Auth0 Migration ⚠️ PRIORITY 3
**Status:** Not started  
**Estimated Time:** 3-4 days  
**Timeline:** After SendGrid implementation

**Features Gained:**
- Social login (Google, Microsoft, Apple)
- MFA/2FA support
- Passwordless login options
- Password reset (built-in)
- Email verification (built-in)
- Session management
- Refresh tokens (solves logout issues)
- Account takeover protection
- Breached password detection

**Migration Steps:**
1. Set up Auth0 tenant
2. Configure social connections
3. Update backend to validate Auth0 tokens
4. Update frontend to use Auth0 SDK
5. Migrate existing users (or force password reset)
6. Keep same user IDs in database
7. Update API authentication middleware
8. Test all auth flows

**Technical:**
- Backend: Replace JWT auth with Auth0 token validation
- Frontend: Use `@auth0/auth0-react`
- Keep `users` table structure (only auth changes)
- All receipts/audit logs remain unchanged

---

### 4. Email Verification ⚠️ PRIORITY 4
**Status:** Not started  
**Estimated Time:** 1 day (or included in Auth0)

**If staying with custom auth (before Auth0):**
- Send verification email on signup
- Verification link with token
- Block receipt email until verified
- Resend verification option

**If using Auth0:**
- Built-in, just configure

---

### 5. Legal Pages ⚠️ REQUIRED
**Status:** Not started  
**Estimated Time:** 1 day (content writing + pages)

**Pages Needed:**
- Terms of Service
- Privacy Policy
- Cookie Policy
- GDPR Compliance Statement
- Data Retention Policy (7+ years for HMRC)
- Data Processing Agreement (for business customers)

**Technical:**
- Create pages under `/app/(legal)/` directory
- Add footer links
- Include last updated dates
- Accept ToS checkbox on signup

---

### 6. Mileage Tracker ⚠️ HIGH VALUE FOR UK MARKET
**Status:** Not started  
**Estimated Time:** 3-4 days

**Why This Matters:**
- HMRC allows mileage claims (45p/mile first 10k miles)
- Almost ALL contractors/self-employed claim mileage
- Competitors like Dext include this feature
- Major differentiator from basic receipt apps
- Common use case: client visits, business errands

**HMRC Approved Rates (2024-2026):**
- Cars/vans: 45p per mile (first 10,000 miles), 25p thereafter
- Motorcycles: 24p per mile
- Bicycles: 20p per mile

**Features:**
- Add mileage claim with start/end location
- Google Maps integration for distance calculation
- Automatic HMRC rate calculation
- Track by vehicle type
- Business purpose field (required for HMRC)
- Annual mileage counter (10k threshold tracking)
- Round trip option
- View on map (route visualization)
- Export mileage claims alongside receipts

**User Flow:**
1. Click "Add Mileage" button
2. Enter start and end location (autocomplete with Google Places)
3. Select vehicle type (car/motorcycle/bicycle)
4. Enter business purpose ("Visit client in Manchester")
5. Optional: add date/time
6. Google calculates distance via best route
7. System calculates claim amount using HMRC rates
8. Save as mileage record
9. Appears in dashboard analytics
10. Export with receipts for tax return

**Technical Implementation:**

Database Schema:
```sql
CREATE TABLE mileage_claims (
    id UUID PRIMARY KEY,
    user_id UUID REFERENCES users(id),
    date DATE NOT NULL,
    start_location TEXT NOT NULL,
    end_location TEXT NOT NULL,
    start_lat DECIMAL,
    start_lng DECIMAL,
    end_lat DECIMAL,
    end_lng DECIMAL,
    distance_miles DECIMAL(10,2) NOT NULL,
    vehicle_type VARCHAR(20) NOT NULL, -- car, motorcycle, bicycle
    hmrc_rate DECIMAL(5,2) NOT NULL, -- rate at time of claim
    claim_amount DECIMAL(10,2) NOT NULL,
    business_purpose TEXT NOT NULL,
    is_round_trip BOOLEAN DEFAULT false,
    route_json TEXT, -- store Google Maps route for display
    created_at TIMESTAMP,
    updated_at TIMESTAMP
);
```

Backend:
- `/api/v1/mileage/claims` - list user's claims
- `/api/v1/mileage/claims` (POST) - create new claim
- `/api/v1/mileage/claims/{id}` (PUT) - update claim
- `/api/v1/mileage/claims/{id}` (DELETE) - delete claim
- `/api/v1/mileage/distance` (POST) - calculate distance via Google Maps
- `/api/v1/mileage/stats` - annual total, current rate threshold

Frontend:
- New "Mileage" page under dashboard
- Add mileage modal with Google Maps autocomplete
- List view with map pins
- Integration into analytics (total mileage claims)
- Include in CSV/PDF exports
- Annual tracker widget (X miles of 10,000 at 45p)

**Google Maps API Costs:**
- Distance Matrix API: $0.005 per element
- Places Autocomplete: $0.017 per session (capped)
- Maps JavaScript API: $7 per 1000 loads
- **Free Tier:** $200/month credit (~40,000 distance calculations)
- **Actual Cost:** Most users <10 claims/month = $0.05/user/month
- **At 1000 users:** ~$50/month (well within free tier)

**Cost-Saving Strategies:**
- Cache common routes (home → office)
- Batch distance calculations
- Use simple distance calculation for known routes
- Only load map when user clicks "view route"
- Implement autocomplete session tokens

---

### 7. Error Handling & User Feedback
**Status:** Partial  
**Estimated Time:** 1-2 days

**Improvements Needed:**
- Upload failure recovery (retry, clear failed uploads)
- OCR failure messaging (what to do if extraction fails)
- Network error toasts (with retry button)
- Loading states for all async operations
- Form validation error messages
- 404/500 error pages
- Session timeout handling
- File size/type validation feedback

---

### 8. Rate Limiting (Backend)
**Status:** Not started  
**Estimated Time:** 1 day

**Limits to Implement:**
- Upload: 50 receipts per hour per user
- API: 100 requests per minute per user
- Failed login: 5 attempts then lockout (15 min)
- Export: 10 exports per hour

**Technical:**
- Use `slowapi` or `fastapi-limiter`
- Redis for rate limit storage (or in-memory for MVP)
- Return 429 Too Many Requests with Retry-After header
- Log rate limit violations

---

### 9. Onboarding Flow
**Status:** Not started  
**Estimated Time:** 1-2 days

**First-time user experience:**
- Welcome modal on first login
- Quick start guide (3-4 steps)
- Receipt email setup instructions
- Sample receipt or demo mode
- Tooltips on key features
- Help button with documentation link

---

## 📋 Nice to Have (V1.1 - Post Launch)

### 10. Bulk Operations
**Status:** Not started  
**Estimated Time:** 2 days

**Features:**
- Select multiple receipts (checkbox)
- Bulk delete
- Bulk export
- Bulk categorize
- Bulk approve (for pending receipts)

---

### 11. Mobile Optimization
**Status:** Partial (responsive, but not optimized)  
**Estimated Time:** 1-2 days

**Improvements:**
- Touch-friendly buttons (larger tap targets)
- Mobile camera upload (capture photo directly)
- Swipe gestures for receipt cards
- Mobile-optimized forms
- Test on iOS Safari and Android Chrome

---

### 12. Advanced Analytics ⚠️ HIGH VALUE

#### 12.1 Tax Year Deep Dive
**Current:** Basic filtering by tax year  
**Enhanced:**
- Dedicated tax year summary page
- April 6 - April 5 visualization
- Compare to previous tax years
- Projected spending (if mid-year)
- Alert if approaching allowance limits
- Export tax year summary for accountant

#### 12.2 Category Spending Trends
**Current:** Static pie chart  
**Enhanced:**
- Line chart showing spending over time per category
- Month-over-month comparison
- Identify spending patterns (seasonality)
- Budget vs actual per category
- Anomaly detection (unusual spending)

#### 12.3 MTD VAT Reports
**For VAT-registered businesses:**
- Quarterly VAT return preparation
- Input VAT summary (reclaimable)
- Output VAT summary (if invoice feature added)
- MTD-compatible format
- HMRC submission ready

#### 12.4 Smart Insights
**AI-powered suggestions:**
- "You spent 40% more on Travel this month vs last"
- "Most receipts from Starbucks - consider claiming home office"
- "You haven't claimed any receipts in 2 weeks"
- "Office Costs category trending up"
- Missing category warnings

#### 12.5 Forecasting
**Predictive analytics:**
- Based on historical data, project year-end expenses
- Seasonal trend detection
- Budget recommendations
- Tax liability estimates

---

### 13. GPT-4 Data Assistant 🤖 INNOVATIVE FEATURE

#### Concept
Natural language query interface for expense data:
- "How much did I spend on travel last quarter?"
- "Show me all receipts from Amazon over £50"
- "What's my average monthly spend on office supplies?"
- "Generate a summary for my accountant"
- "Which category grew the most this year?"

#### Benefits
- **User Experience:** Natural way to query data (no complex filters)
- **Accessibility:** Great for non-technical users
- **Efficiency:** Faster than navigating filters
- **Insights:** Can surface patterns users wouldn't think to look for
- **Differentiation:** Competitive advantage (most expense apps don't have this)

#### Abuse Prevention Strategies

**1. Rate Limiting (Critical)**
- 20 queries per day (free tier)
- 100 queries per day (paid tier)
- Reset daily at midnight
- Show remaining quota in UI
- Premium plans for heavy users

**2. Cost Controls**
- Use GPT-4o-mini (cheaper, faster)
- Set max tokens per response (500-1000)
- Cache common queries
- Implement query complexity scoring
- Block queries requiring excessive computation

**3. Context Window Management**
- Only include user's own receipt data (security)
- Limit to last 1000 receipts or 1 year
- Summarize data before sending to GPT
- Pre-aggregate stats (don't send raw data)

**4. Query Validation**
- Detect malicious/inappropriate queries
- Block attempts to extract other users' data
- Sanitize inputs
- Whitelist query types
- Log all queries for monitoring

**5. Technical Implementation**
```
Frontend:
- Query input box with character limit
- Show remaining daily quota
- Loading state with estimated time
- Display query history (last 5)

Backend:
- /api/v1/receipts/ai-query endpoint
- Check rate limit (Redis/DB)
- Fetch user's receipt data (filtered)
- Build context with aggregated stats
- Send to OpenAI with system prompt
- Parse and format response
- Log query + cost + response time
- Deduct from user quota
```

**6. System Prompt Template**
```
You are an expense data assistant. Analyze the following receipt data 
for user {user_id} and answer their question accurately and concisely.

Data Summary:
- Total receipts: {count}
- Date range: {start_date} to {end_date}
- Total spent: £{total}
- Categories: {category_breakdown}

Receipts:
{receipts_json}

User Question: {user_query}

Rules:
- Only answer questions about this user's expense data
- Be concise (max 200 words)
- Format currency as GBP (£)
- Suggest actionable insights where relevant
- If data is insufficient, say so clearly
```

#### Monetization Opportunity
- Free tier: 20 queries/day
- Pro tier ($10/month): 100 queries/day + priority
- Business tier ($30/month): Unlimited + custom reports

#### MVP Implementation
**Phase 1 (Post-launch):**
- Basic query interface
- 10 queries/day limit
- Simple analytics queries only
- GPT-4o-mini for cost efficiency

**Phase 2 (After user feedback):**
- Increase quota based on usage
- Add query suggestions/templates
- Cache common queries
- Add voice input (mobile)

---

## 🎯 Launch Readiness Checklist

### Technical
- [ ] SendGrid email forwarding working
- [ ] CSV export functional (includes mileage claims)
- [ ] Mileage tracker operational
- [ ] Auth0 integrated with social login
- [ ] Error handling comprehensive
- [ ] Rate limiting active
- [ ] Email verification enabled

### Content
- [ ] Terms of Service live
- [ ] Privacy Policy live
- [ ] Help documentation
- [ ] Onboarding flow complete

### Testing
- [ ] Test all user flows end-to-end
- [ ] Test on mobile devices
- [ ] Test with real receipts
- [ ] Security audit (basic)
- [ ] Performance testing (load time)
- [ ] Cross-browser testing

### Marketing
- [ ] Landing page ready
- [ ] Pricing page (if applicable)
- [ ] Demo video/screenshots
- [ ] Initial marketing strategy

---

## Post-Launch Roadmap

### Month 1
- Monitor user feedback
- Fix critical bugs
- Improve onboarding based on drop-off
- Add most requested features

### Month 2
- Bulk operations
- Advanced analytics (tax year deep dive)
- Mobile app (if needed)

### Month 3
- GPT-4 assistant (beta)
- Bank statement import
- Recurring expense detection
- API for accountant integrations

### Month 4+
- Multi-currency support
- Team/business accounts
- Accountant collaboration features
- Integration with accounting software (Xero, QuickBooks)

---

## Cost Estimates (Monthly at Scale)

### Infrastructure
- Google Cloud Run: $20-50
- PostgreSQL: $25-50
- Google Cloud Storage: $10-20
- SendGrid: $15 (up to 50k emails)
- Auth0: Free tier (7k users), then $23+

### AI Services
- OpenAI API: ~$0.10 per receipt (GPT-4o-mini)
- 1000 receipts/month = $100
- With GPT-4 assistant: +$50-200 (depends on usage)
Google Maps API
- Distance calculations: ~$0.05/user/month
- 1000 users = $50/month (within free tier initially)

### Total: $250-6
### Total: $200-500/month for 1000 users

### Revenue Target
- $10/user/month = $10,000/month
- **90%+ margin at scale**

---

## Success Metrics (KPIs)

### User Engagement
- Weekly active users (WAU)
- Receipts uploaded per user per month
- Time spent in app
- Feature adoption rates

### Business
- Signup conversion rate
- Trial to paid conversion
- Monthly recurring revenue (MRR)
- Churn rate
- Customer acquisition cost (CAC)

### Technical
- API response times (<500ms)
- OCR accuracy rate (>90%)
- Uptime (>99.9%)
- Error rate (<1%)

---

## Notes
- Focus on HMRC compliance (UK market first)
- Accountant-friendly features critical
- Self-employed/freelancer primary audience
- Mobile-first for receipt capture
- Export features non-negotiable
