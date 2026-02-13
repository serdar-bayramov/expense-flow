# 🔐 Clerk Authentication Implementation Guide

## Overview

ExpenseFlow uses **Clerk** for authentication instead of a custom JWT system. This guide explains:
- What code is active vs legacy
- How authentication flows work
- What each component does
- How to debug authentication issues

---

## 🎯 Current Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                         CLERK CLOUD                              │
│  - User Management                                               │
│  - Session Management                                            │
│  - JWT Token Generation                                          │
│  - OAuth/Social Login                                            │
└─────────────────────────────────────────────────────────────────┘
                           │
                           │ Issues JWT Token
                           ▼
┌─────────────────────────────────────────────────────────────────┐
│                        FRONTEND (Next.js)                        │
│                                                                   │
│  1. ClerkProvider wraps entire app (layout.tsx)                 │
│  2. Clerk handles login/signup UI                               │
│  3. Middleware protects routes (proxy.ts)                       │
│  4. useAuth() hook gets token for API calls                     │
└─────────────────────────────────────────────────────────────────┘
                           │
                           │ Sends: Authorization: Bearer <token>
                           ▼
┌─────────────────────────────────────────────────────────────────┐
│                        BACKEND (FastAPI)                         │
│                                                                   │
│  1. deps.py validates Clerk JWT token                           │
│  2. Extracts clerk_user_id from token                           │
│  3. Looks up user in database                                   │
│  4. Returns user object to endpoint                             │
└─────────────────────────────────────────────────────────────────┘
                           │
                           │ Webhook when user signs up/updates
                           ▼
┌─────────────────────────────────────────────────────────────────┐
│                    WEBHOOK HANDLER (FastAPI)                     │
│                                                                   │
│  webhooks.py creates/updates user records in our database       │
└─────────────────────────────────────────────────────────────────┘
```

---

## 📁 File Status: Active vs Legacy

### ✅ ACTIVE - Clerk Authentication

#### **Backend:**

1. **`app/api/deps.py`** ⭐ MAIN AUTH FILE
   - **Purpose:** Validates Clerk JWT tokens on every API request
   - **Function:** `get_current_user()` dependency
   - **Used by:** All protected endpoints via `Depends(get_current_user)`

2. **`app/api/v1/webhooks.py`** ⭐ USER SYNC
   - **Purpose:** Clerk webhook endpoint that syncs user data
   - **Endpoint:** `POST /api/v1/webhooks/clerk`
   - **Events handled:**
     - `user.created` - Create user in our database
     - `user.updated` - Update user email/name
     - `user.deleted` - Soft delete user

3. **`app/models/user.py`**
   - **Active fields:**
     - `clerk_user_id` - Links to Clerk user (PRIMARY KEY for auth)
     - `email`, `full_name` - Synced from Clerk
   - **Legacy fields (kept for migration):**
     - `hashed_password` - From old system (nullable, will be removed)

#### **Frontend:**

1. **`app/layout.tsx`** ⭐ CLERK PROVIDER
   - **Purpose:** Wraps entire app with `<ClerkProvider>`
   - **Effect:** Makes Clerk available everywhere

2. **`proxy.ts`** (middleware) ⭐ ROUTE PROTECTION
   - **Purpose:** Protects routes requiring authentication
   - **Logic:** 
     - Public routes: `/`, `/login`, `/signup`, `/privacy`, `/terms`, `/contact`, `/docs`
     - Protected routes: Everything else (dashboard, API pages)
   - **Action:** Redirects unauthenticated users to `/login`

3. **`app/(auth)/login/page.tsx`** & **`app/(auth)/signup/page.tsx`**
   - **Purpose:** Use Clerk's pre-built login/signup UI
   - **Component:** `<SignIn />` and `<SignUp />` from `@clerk/nextjs`

4. **`lib/api.ts`** ⭐ API CALLS
   - **Purpose:** API wrapper functions
   - **Pattern:** Every function accepts `token` parameter
   - **Example:**
     ```typescript
     await authAPI.me(token)
     await receiptsAPI.getAll(token)
     ```

5. **`app/dashboard/page.tsx`** (and all dashboard pages)
   - **Purpose:** Use Clerk's `useAuth()` hook
   - **Pattern:**
     ```typescript
     const { getToken, isLoaded, isSignedIn } = useAuth();
     const token = await getToken();
     ```

### ❌ LEGACY - Old Custom Authentication

#### **Backend (NOT ACTIVELY USED):**

1. **`app/api/v1/auth.py`** ⚠️ LEGACY
   - Old custom JWT login/register endpoints
   - **DO NOT USE** - But kept for reference
   - Has warning banner at top of file

2. **`app/core/security.py`** ⚠️ LEGACY
   - Old password hashing and JWT utilities
   - **DO NOT USE** - But kept for reference
   - Has warning banner at top of file

#### **Frontend:**
- No legacy frontend auth code (fully migrated to Clerk)

---

## 🔄 Authentication Flow (Step-by-Step)

### 1️⃣ User Signup Flow

```
User clicks "Sign Up"
    │
    ├─► Frontend redirects to /signup
    │   └─► Clerk's <SignUp /> component loads
    │
User enters email/password
    │
    ├─► Clerk creates account in their cloud
    │   └─► Clerk sends webhook to our backend
    │
Backend receives webhook at /api/v1/webhooks/clerk
    │
    ├─► Event: user.created
    │   ├─► Extract: clerk_user_id, email, name
    │   ├─► Check if user already exists
    │   ├─► Create User record in database
    │   └─► Generate unique_receipt_email
    │
User redirected to /dashboard
    │
    └─► Success! User is authenticated
```

**Code involved:**
- Frontend: `app/(auth)/signup/page.tsx`
- Backend: `app/api/v1/webhooks.py` (lines 29-125)
- Database: New row in `users` table

### 2️⃣ User Login Flow

```
User clicks "Log In"
    │
    ├─► Frontend redirects to /login
    │   └─► Clerk's <SignIn /> component loads
    │
User enters credentials
    │
    ├─► Clerk validates credentials (in their cloud)
    │   └─► Clerk issues JWT token
    │
Frontend stores token in Clerk session
    │
    └─► User redirected to /dashboard
```

**Code involved:**
- Frontend: `app/(auth)/login/page.tsx`
- Clerk: Handles all validation
- No backend involvement (Clerk manages session)

### 3️⃣ Protected API Request Flow

```
User visits /dashboard (protected route)
    │
    ├─► Middleware checks authentication (proxy.ts)
    │   └─► If not authenticated → redirect to /login
    │
Component loads (dashboard/page.tsx)
    │
    ├─► Call: const { getToken } = useAuth()
    │   └─► Call: const token = await getToken()
    │
Make API request with token
    │
    ├─► Example: authAPI.me(token)
    │   └─► Headers: { Authorization: `Bearer ${token}` }
    │
Backend receives request
    │
    ├─► FastAPI endpoint has: Depends(get_current_user)
    │   └─► Calls: get_current_user() in deps.py
    │
deps.py validates token
    │
    ├─► Extract JWT without verification (line 37)
    │   ├─► Get unverified_claims
    │   └─► Extract clerk_user_id from 'sub' claim
    │
    ├─► Query database for user (line 73)
    │   └─► filter(User.clerk_user_id == clerk_user_id)
    │
    ├─► If user not found → Auto-create from Clerk API (line 75-130)
    │   ├─► Fetch user from Clerk API
    │   ├─► Create User record
    │   └─► Generate unique_receipt_email
    │
    └─► Return user object to endpoint
    │
Endpoint receives user object
    │
    └─► Process request with authenticated user
```

**Code involved:**
- Frontend: `app/dashboard/page.tsx` (lines 16, 40-42)
- API wrapper: `lib/api.ts` (lines 50-58)
- Backend auth: `app/api/deps.py` (lines 21-142)
- Endpoint: Any endpoint with `current_user: User = Depends(get_current_user)`

---

## 🔍 Important Code Sections for Debugging

### 1. Token Validation (Backend)

**File:** `app/api/deps.py`

**Lines 21-75: Main authentication logic**

```python
def get_current_user(
    credentials: HTTPAuthorizationCredentials = Depends(security),
    db: Session = Depends(get_db)
) -> User:
    token = credentials.credentials
    
    try:
        # Decode JWT without verification
        unverified_claims = jwt.decode(token, options={"verify_signature": False})
        
        # Get clerk_user_id from token (stored as 'sub' claim)
        clerk_user_id = unverified_claims.get("sub")
        
        if not clerk_user_id:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid token: missing user ID"
            )
```

**🐛 Debug points:**
- **Line 32:** Print token to verify format
- **Line 37:** Check if JWT is valid format
- **Line 44:** Verify clerk_user_id is extracted
- **Line 73:** Check if user exists in database

**Common issues:**
- "Invalid token format" → Token is malformed or not a JWT
- "Invalid token: missing user ID" → JWT doesn't have 'sub' claim
- User not found → Webhook failed, auto-create triggers

### 2. Auto-User Creation Fallback

**File:** `app/api/deps.py`

**Lines 75-130: Fallback if webhook fails**

```python
if user is None:
    # Auto-create user if they don't exist (fallback for webhook failures)
    try:
        # Fetch user details from Clerk
        clerk_user = clerk_client.users.get(user_id=clerk_user_id)
        
        email = clerk_user.email_addresses[0].email_address
        
        # Create new user
        user = User(
            clerk_user_id=clerk_user_id,
            email=email,
            full_name=full_name,
            unique_receipt_email=unique_receipt_email,
            subscription_plan="free",
            is_active=True
        )
        
        db.add(user)
        db.commit()
```

**🐛 Debug points:**
- **Line 79:** Check if Clerk API call succeeds
- **Line 81:** Verify email extraction
- **Line 113:** Check if user creation succeeds

**When this triggers:**
- Webhook failed to fire
- Network issue during signup
- Webhook endpoint was down
- User signed up before webhook configured

### 3. Clerk Webhook Handler

**File:** `app/api/v1/webhooks.py`

**Lines 29-125: Processes Clerk events**

```python
@router.post("/clerk")
async def clerk_webhook(request: Request, db: Session = Depends(get_db)):
    payload = await request.json()
    event_type = payload.get("type")
    data = payload.get("data", {})
    
    if event_type == "user.created":
        clerk_user_id = data.get("id")
        email = primary_email.get("email_address")
        
        # Check if user already exists
        existing_user = db.query(User).filter(User.clerk_user_id == clerk_user_id).first()
        if existing_user:
            return {"status": "user already exists"}
        
        # Create new user
        new_user = User(
            clerk_user_id=clerk_user_id,
            email=email,
            full_name=full_name,
            unique_receipt_email=generate_unique_receipt_email(email),
            subscription_plan="free",
            is_active=True
        )
        
        db.add(new_user)
        db.commit()
```

**🐛 Debug points:**
- **Line 41:** Check event_type value
- **Line 48:** Verify clerk_user_id extraction
- **Line 56:** Check email extraction
- **Line 62:** Verify user doesn't already exist
- **Line 80:** Check user creation success

**How to test webhook:**
1. Sign up new user in Clerk Dashboard
2. Check Railway/backend logs for webhook call
3. Query database: `SELECT * FROM users WHERE clerk_user_id = 'user_xxx'`

### 4. Frontend Token Retrieval

**File:** `app/dashboard/page.tsx` (example)

**Lines 14-44: Get token and make API calls**

```typescript
const { getToken, isLoaded, isSignedIn } = useAuth();

useEffect(() => {
  const fetchData = async () => {
    // Wait for Clerk to fully load
    if (!isLoaded) return;
    
    if (!isSignedIn) {
      router.push('/login');
      return;
    }

    try {
      const token = await getToken();
      if (!token) return;

      // Fetch user data
      const userData = await authAPI.me(token);
      setUser(userData);

      // Fetch receipts
      const receipts = await receiptsAPI.getAll(token);
      setReceipts(receipts);
      
    } catch (error) {
      console.error('Failed to fetch data:', error);
    }
  };

  fetchData();
}, [isLoaded, isSignedIn]);
```

**🐛 Debug points:**
- **Line 35:** Check if Clerk is loaded
- **Line 38:** Verify user is signed in
- **Line 43:** Check if token exists
- **Line 46:** Log token to verify format
- **Line 52:** Catch API errors

**Common issues:**
- "Cannot read properties of null" → Clerk not loaded yet
- Token is null → User not signed in
- API returns 401 → Token is invalid or expired

### 5. Route Protection Middleware

**File:** `frontend/proxy.ts`

**Lines 1-40: Protects routes**

```typescript
const isPublicRoute = createRouteMatcher([
  '/',
  '/login(.*)',
  '/signup(.*)',
  '/privacy',
  '/terms',
  '/contact',
  '/docs',
]);

export default clerkMiddleware(async (auth, request) => {
  const path = request.nextUrl.pathname;
  
  // Only protect routes that are NOT public
  if (!isPublicRoute(request)) {
    await auth.protect();
  }
});
```

**🐛 Debug points:**
- **Line 19:** Check if route is public
- **Line 24:** Verify protection triggers for dashboard routes

**How to test:**
1. Log out of app
2. Try to visit `/dashboard` directly
3. Should redirect to `/login`

---

## 🛠️ Debugging Checklist

### Authentication Not Working

**Frontend Issues:**

- [ ] Check browser console for errors
- [ ] Verify Clerk publishable key exists: `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY`
- [ ] Check if `isLoaded` is true before making API calls
- [ ] Verify `isSignedIn` is true
- [ ] Log token: `console.log(await getToken())`
- [ ] Check if token starts with `eyJ` (valid JWT format)

**Backend Issues:**

- [ ] Check Railway logs for "🔍 Received token" prints
- [ ] Verify Clerk secret key exists: `CLERK_SECRET_KEY`
- [ ] Check if token is being sent in Authorization header
- [ ] Look for "❌" error logs in deps.py
- [ ] Query database: `SELECT * FROM users WHERE clerk_user_id = 'user_xxx'`
- [ ] Check webhook logs for user.created events

**Webhook Issues:**

- [ ] Verify webhook URL in Clerk Dashboard: `https://your-api.railway.app/api/v1/webhooks/clerk`
- [ ] Check Clerk Dashboard → Webhooks → Logs
- [ ] Look for 200 OK responses
- [ ] Check if user exists after signup: `SELECT * FROM users ORDER BY created_at DESC LIMIT 5`

### User Not Found After Signup

**Likely causes:**
1. Webhook didn't fire → Check Clerk webhook logs
2. Webhook endpoint is wrong → Verify URL in Clerk Dashboard
3. Database insert failed → Check Railway logs for errors

**Solution:**
- Auto-create fallback will trigger on first API request
- User will be created automatically from Clerk API
- Check logs for "🔍 User not found, fetching from Clerk API..."

### Token Validation Fails

**Symptoms:**
- 401 Unauthorized on API requests
- "Invalid token format" error

**Likely causes:**
1. Token expired → Clerk auto-refreshes, check if getToken() is called
2. Token is malformed → Log token, verify it's a proper JWT
3. Wrong Clerk instance → Verify publishable key matches secret key

**Solution:**
- Log full error: `console.error('Auth error:', error.response?.data)`
- Check token format: Should start with `eyJ`
- Verify token claims: Use jwt.io to decode and inspect

---

## 🔐 Security Notes

### What Clerk Handles:
✅ Password hashing and storage
✅ JWT token generation and signing
✅ Token expiration and refresh
✅ Session management
✅ OAuth/social login
✅ Rate limiting on login attempts
✅ Two-factor authentication (if enabled)

### What Your Backend Handles:
✅ Validating JWT signature (currently trusts Clerk)
✅ User record in your database
✅ Authorization (user can access their own data)
✅ Business logic

### Important:
⚠️ **Token Verification:** Currently, your backend trusts the token without verifying Clerk's signature. For production, you should:
1. Fetch Clerk's public JWKS keys
2. Verify JWT signature using those keys
3. See: https://clerk.com/docs/backend-requests/handling/manual-jwt

**Current code (line 55-56 in deps.py):**
```python
# For now, we trust the token since it's coming from Clerk
# In production, you should verify the signature using Clerk's public keys
```

**To implement full verification**, update `get_current_user()` to verify signature using Clerk's JWKS endpoint.

---

## 📝 Environment Variables Required

### Backend (.env):
```bash
# Clerk
CLERK_SECRET_KEY=sk_live_...                 # From Clerk Dashboard → API Keys

# Database
DATABASE_URL=postgresql://...                # Railway PostgreSQL

# Other
SECRET_KEY=your-secret-key                   # Still used for legacy code
ALGORITHM=HS256                              # Still used for legacy code
```

### Frontend (.env.local):
```bash
# Clerk
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_live_... # From Clerk Dashboard → API Keys

# API
NEXT_PUBLIC_API_URL=https://your-api.railway.app
```

### Clerk Dashboard Settings:
- **Webhook URL:** `https://your-api.railway.app/api/v1/webhooks/clerk`
- **Webhook Events:** user.created, user.updated, user.deleted
- **JWT Template:** Default (includes 'sub' claim with user ID)

---

## 🚀 Quick Reference

### Get Current User (Backend Endpoint):
```python
from app.api.deps import get_current_user

@router.get("/my-endpoint")
async def my_endpoint(current_user: User = Depends(get_current_user)):
    # current_user is automatically populated
    # Contains: id, clerk_user_id, email, full_name, etc.
    return {"message": f"Hello {current_user.full_name}"}
```

### Make Authenticated API Call (Frontend):
```typescript
import { useAuth } from '@clerk/nextjs';

const { getToken } = useAuth();

const fetchData = async () => {
  const token = await getToken();
  const response = await fetch(`${API_URL}/api/v1/my-endpoint`, {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });
  return response.json();
};
```

### Check if User is Authenticated (Frontend):
```typescript
import { useAuth } from '@clerk/nextjs';

const { isSignedIn, isLoaded } = useAuth();

if (!isLoaded) {
  return <div>Loading...</div>;
}

if (!isSignedIn) {
  return <div>Please log in</div>;
}

return <div>Welcome!</div>;
```

---

## 📚 Additional Resources

- **Clerk Docs:** https://clerk.com/docs
- **Clerk Next.js Guide:** https://clerk.com/docs/quickstarts/nextjs
- **Clerk Backend SDK:** https://clerk.com/docs/references/backend/overview
- **JWT Verification:** https://clerk.com/docs/backend-requests/handling/manual-jwt

---

## 🎯 Summary

**Active Authentication System:**
- ✅ Clerk handles all authentication (login, signup, sessions)
- ✅ Frontend uses `@clerk/nextjs` hooks and components
- ✅ Backend validates Clerk JWT tokens in `app/api/deps.py`
- ✅ Webhooks sync user data to your database

**Legacy Code (Not Used):**
- ❌ `app/api/v1/auth.py` - Old login/register endpoints
- ❌ `app/core/security.py` - Old JWT utilities
- ❌ Both have warning banners and are kept for reference only

**Key Files for Debugging:**
1. `app/api/deps.py` - Token validation
2. `app/api/v1/webhooks.py` - User sync
3. `frontend/proxy.ts` - Route protection
4. `frontend/app/dashboard/page.tsx` - Token usage example

**Next Steps:**
- Consider implementing full JWT signature verification for production
- Clean up legacy auth code after confirming no dependencies
- Add monitoring/logging for auth failures
