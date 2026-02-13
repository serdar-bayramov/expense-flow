# Expense Flow - Build Plan
**Learning Path: Backend → Frontend → Integration**

---

## 🎯 Phase 1: Backend Foundation (Week 1-2)

### Step 1: Environment Setup ✅
- [x] Create Python virtual environment
- [x] Install FastAPI, SQLAlchemy, Alembic, PostgreSQL drivers
- [x] Create `.env` file with database credentials
- [x] Test basic FastAPI server runs

### Step 2: Database Setup ✅
- [x] Design database schema (users, receipts, categories tables)
- [x] Create SQLAlchemy models
- [x] Set up Alembic for migrations
- [x] Create initial migration
- [x] Test: Connect to PostgreSQL (Docker local)

### Step 3: Authentication System ✅
- [x] Create User model (email, hashed_password, unique_receipt_email)
- [x] Build registration endpoint (`POST /api/v1/auth/register`)
- [x] Build login endpoint (`POST /api/v1/auth/login`)
- [x] Implement JWT tokens (access token only)
- [x] Create dependency for protected routes
- [x] Test: Register user, login, access protected endpoint

### Step 4: Receipt Management - Basic CRUD ✅
- [x] Create Receipt model (user_id, image_url, vendor, date, amount, category)
- [x] Build endpoints:
  - `POST /api/v1/receipts/upload` - Upload image + auto OCR
  - `GET /api/v1/receipts` - List user's receipts
  - `GET /api/v1/receipts/{id}` - Get single receipt
  - `PUT /api/v1/receipts/{id}` - Update receipt details
  - `DELETE /api/v1/receipts/{id}` - Delete receipt
- [x] Test: CRUD operations work

### Step 5: Cloud Storage Integration ✅
- [x] Set up Google Cloud Storage bucket
- [x] Create storage service (`services/storage.py`)
- [x] Upload images to GCS
- [x] Generate public URLs for image access
- [x] Test: Upload receipt, get public URL

### Step 6: OCR Integration ✅
- [x] Set up Google Vision API credentials
- [x] Create OCR service (`services/ocr.py`)
- [x] Extract text from receipt images (Vision API)
- [x] Parse extracted text with AI (OpenAI GPT-4o-mini)
- [x] Save extracted data to Receipt model
- [x] Test: Upload receipt → see extracted data (works with JPG/PNG)

### Step 7: Async Task Processing (SKIPPED FOR NOW)
- [ ] Set up Redis (Upstash)
- [ ] Configure Celery with Redis broker
- [ ] Create Celery task: `process_receipt_ocr`
- [ ] Move OCR processing to background task
- [ ] Add receipt status: pending → processing → completed
- [ ] Test: Upload receipt → task runs async → status updates
- **Note:** 3-5 second sync processing is acceptable for MVP. Add async later if needed.

### Step 8: Email Forwarding (Inbound Email)
- [ ] Set up Mailgun/SendGrid inbound email
- [ ] Create webhook endpoint (`POST /api/v1/webhooks/email`)
- [ ] Parse incoming email (extract attachments, sender)
- [ ] Match sender email to user account
- [ ] Trigger OCR task for attachment
- [ ] Test: Forward email → receipt appears in account

---

## 🎨 Phase 2: Frontend Foundation (Week 3)

### Step 9: Next.js Setup
- [ ] Run `npx create-next-app@latest frontend --typescript --tailwind --app`
- [ ] Initialize shadcn/ui: `npx shadcn-ui@latest init`
- [ ] Install dependencies:
  - `npm install @tanstack/react-query` (data fetching)
  - `npm install next-auth` (authentication)
  - `npm install framer-motion` (animations)
- [ ] Set up environment variables (API URL)
- [ ] Configure shadcn/ui components
- [ ] Test: Next.js dev server runs

### Step 10: Authentication UI
- [ ] Create login page (`app/(auth)/login/page.tsx`)
- [ ] Create signup page (`app/(auth)/signup/page.tsx`)
- [ ] Set up NextAuth.js v5 with credentials provider
- [ ] Add shadcn/ui components: Button, Input, Card, Label
- [ ] Create API client with TanStack Query (`lib/api.ts`)
- [ ] Store JWT tokens in session
- [ ] Add form validation
- [ ] Test: Signup → Login → Redirects to dashboard

### Step 11: Dashboard Layout
- [ ] Create dashboard layout with sidebar
- [ ] Add shadcn/ui navigation components
- [ ] Add navigation items (Dashboard, Receipts, Export, Settings)
- [ ] Create protected route wrapper with NextAuth
- [ ] Add responsive mobile menu
- [ ] Style with Tailwind CSS utilities
- [ ] Test: Can't access dashboard without login

### Step 12: Receipt List View
- [ ] Create receipts page (`app/dashboard/receipts/page.tsx`)
- [ ] Set up TanStack Query for data fetching
- [ ] Add shadcn/ui components: Card, Badge, Skeleton (loading)
- [ ] Display receipt cards with Framer Motion animations
- [ ] Add filters (date range, category) with shadcn/ui Select
- [ ] Add search bar with shadcn/ui Input
- [ ] Implement responsive grid layout (Tailwind)
- [ ] Test: See list of receipts with smooth animations

### Step 13: Receipt Upload
- [ ] Create upload modal with shadcn/ui Dialog
- [ ] Add drag-and-drop file uploader with visual feedback
- [ ] Upload images to backend with progress bar
- [ ] Show upload progress with Framer Motion
- [ ] Display OCR processing status with shadcn/ui Badge
- [ ] Add shadcn/ui Toast notifications for success/error
- [ ] Test: Upload receipt → see it appear in list with animation

### Step 14: Receipt Detail View
- [ ] Create receipt detail page (`app/dashboard/receipts/[id]/page.tsx`)
- [ ] Show full-size image with modal (shadcn/ui Dialog)
- [ ] Display extracted data in editable form (shadcn/ui Input, Textarea)
- [ ] Category dropdown with shadcn/ui Select
- [ ] Save changes button with loading state
- [ ] Add page transitions with Framer Motion
- [ ] Add optimistic updates with TanStack Query
- [ ] Test: Edit receipt details → saves to backend with smooth UX

---

## 🚀 Phase 3: Advanced Features (Week 4)

### Step 15: Gmail Integration
- [ ] Set up Google OAuth credentials
- [ ] Create Gmail API service
- [ ] Build "Scan Gmail" button
- [ ] Search user's Gmail for receipts
- [ ] Download matching emails + attachments
- [ ] Trigger OCR for all found receipts
- [ ] Test: Scan Gmail → receipts imported

### Step 16: Categories & Tags
- [ ] Create Category model (name, tax_deductible_percentage)
- [ ] Seed default categories (Meals, Transportation, etc.)
- [ ] Build category management UI
- [ ] Add bulk edit (select multiple receipts)
- [ ] Test: Categorize receipts

### Step 17: Export Functionality
- [ ] Create export endpoint (`POST /api/v1/receipts/export`)
- [ ] Generate CSV export
- [ ] Generate Excel export (openpyxl)
- [ ] Generate PDF report (ReportLab or WeasyPrint)
- [ ] Test: Export filtered receipts

### Step 18: Dashboard Analytics
- [ ] Create stats endpoint (total expenses, by category, etc.)
- [ ] Build charts (Chart.js or Recharts)
- [ ] Show monthly spending trends
- [ ] Tax deduction summary
- [ ] Test: Dashboard shows real data

---

## 💰 Phase 4: Monetization (Week 5)

### Step 19: Stripe Integration
- [ ] Set up Stripe account
- [ ] Create subscription plans (Free, Pro, Business)
- [ ] Build pricing page
- [ ] Implement Stripe Checkout
- [ ] Handle webhooks (subscription created/cancelled)
- [ ] Restrict features by plan
- [ ] Test: Subscribe to plan → features unlock

### Step 20: User Settings
- [ ] Create settings page
- [ ] Show unique receipt email address
- [ ] Plan management (upgrade/cancel)
- [ ] Delete account option
- [ ] Test: User can manage account

---

## 🐳 Phase 5: Deployment (Week 6)

### Step 21: Backend Deployment
- [ ] Create Dockerfile for FastAPI
- [ ] Test Docker build locally
- [ ] Deploy to Google Cloud Run
- [ ] Set up production environment variables
- [ ] Configure PostgreSQL (Neon production)
- [ ] Set up Redis (Upstash production)
- [ ] Test: API accessible at production URL

### Step 22: Frontend Deployment
- [ ] Deploy Next.js to Vercel
- [ ] Configure environment variables (production API URL)
- [ ] Set up custom domain (optional)
- [ ] Test: Full app works in production

### Step 23: Email & Monitoring
- [ ] Configure production inbound email forwarding
- [ ] Set up error logging (Sentry)
- [ ] Add health check endpoint
- [ ] Set up uptime monitoring
- [ ] Test: Forward email → receipt processes

---

## 📈 Phase 6: Polish & Launch (Week 7+)

### Step 24: Testing & Fixes
- [ ] Write backend tests (Pytest)
- [ ] Test edge cases (bad receipts, wrong formats)
- [ ] Fix bugs found during testing
- [ ] Optimize slow queries

### Step 25: UX Polish
- [ ] Add loading states
- [ ] Add error messages
- [ ] Add success notifications
- [ ] Improve mobile responsiveness
- [ ] Add onboarding tutorial

### Step 26: Launch Prep
- [ ] Create landing page
- [ ] Write documentation
- [ ] Create demo video
- [ ] Soft launch to friends/beta testers
- [ ] Collect feedback → iterate

### Step 27: Marketing & Growth
- [ ] Public launch (Product Hunt, Reddit, Twitter)
- [ ] Add analytics (user behavior tracking)
- [ ] A/B test pricing
- [ ] Collect testimonials
- [ ] Scale infrastructure as needed

---

## 🛠️ Tech Stack Reference

**Backend:**
- FastAPI (Python web framework)
- PostgreSQL (Neon - database)
- SQLAlchemy (ORM)
- Alembic (migrations)
- Celery + Redis (async tasks)
- Google Cloud Storage (image storage)
- Google Vision API (OCR)
- Mailgun/SendGrid (email)
- Google Cloud Run (hosting)

**Frontend:**
- Next.js 14+ App Router (React framework)
- TypeScript (type safety)
- Tailwind CSS (utility-first styling)
- shadcn/ui (copy-paste component library)
  - Built on Radix UI (accessibility)
  - Components: Button, Card, Dialog, Input, Select, Badge, Toast, Skeleton, Table, etc.
- TanStack Query (data fetching, caching, mutations)
- NextAuth.js v5 (authentication & session management)
- Framer Motion (animations & transitions)
- Vercel (hosting)

**Payment:**
- Stripe (subscriptions)

---

## 📚 Learning Resources

- FastAPI docs: https://fastapi.tiangolo.com/
- Next.js docs: https://nextjs.org/docs
- SQLAlchemy: https://docs.sqlalchemy.org/
- Google Vision API: https://cloud.google.com/vision/docs
- Stripe docs: https://stripe.com/docs

---

## ✅ Current Progress

**Backend (Phase 1):**
- [x] Steps 1-6: Complete core backend (Auth, CRUD, Storage, OCR)
- [ ] Step 7: Async processing (deferred)
- [ ] Step 8: Email forwarding (after frontend)

**Frontend (Phase 2): NEXT**
- [ ] Step 9: Next.js setup

**Last Updated:** January 17, 2026
