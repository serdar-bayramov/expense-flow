# Xero Integration Implementation Plan

## Executive Summary

**Goal:** Auto-sync expense receipts and mileage claims from ExpenseFlow to Xero with receipt images automatically attached.

**Value Proposition:**
- Saves users £600-1,800/year in accountant data entry time
- Professional tier differentiator
- Eliminates manual CSV import and image attachment workflow
- Real-time sync with accountant's Xero account

**Complexity:** Medium (3-5 days for MVP)

**Prerequisites:** 50+ paying users, proven demand

---

## Why Full Integration vs CSV

### CSV Limitations
- ❌ No automatic image attachment
- ❌ Manual import into Xero required
- ❌ No real-time sync
- ❌ Risk of duplicate entries
- ❌ Still requires 2-3 hours/month of manual work

### API Integration Benefits
- ✅ Receipts + images automatically in Xero
- ✅ Zero manual work after setup
- ✅ Real-time or scheduled sync
- ✅ Pre-categorized with HMRC codes mapped to Xero chart of accounts
- ✅ Professional competitive advantage
- ✅ Accountants love it = better customer retention

---

## Technical Architecture

### 1. Xero App Registration

**Steps:**
1. Register app at https://developer.xero.com/app/manage
2. Choose "Web App" type
3. Configure OAuth 2.0 settings:
   - Redirect URI: `https://expenseflow.co.uk/api/v1/xero/callback`
   - Scopes needed:
     - `accounting.transactions` - Create bank transactions
     - `accounting.attachments` - Upload receipt images
     - `accounting.contacts.read` - Read supplier/vendor list
     - `accounting.settings.read` - Get chart of accounts
4. Get Client ID and Client Secret
5. Store in environment variables

### 2. OAuth 2.0 Flow

```
User clicks "Connect to Xero"
    ↓
Redirect to Xero authorization page
    ↓
User grants permission
    ↓
Xero redirects back with authorization code
    ↓
Exchange code for access token + refresh token
    ↓
Store encrypted tokens in database
    ↓
Get Xero tenant/organization ID
    ↓
Connection complete
```

**Token Lifecycle:**
- Access token expires after 30 minutes
- Refresh token valid for 60 days
- Must refresh before expiry or user needs to reconnect

---

## Database Changes

### Add to `users` table:

```sql
ALTER TABLE users ADD COLUMN xero_tenant_id VARCHAR(255);
ALTER TABLE users ADD COLUMN xero_access_token TEXT;
ALTER TABLE users ADD COLUMN xero_refresh_token TEXT;
ALTER TABLE users ADD COLUMN xero_token_expires_at TIMESTAMP;
ALTER TABLE users ADD COLUMN xero_connected_at TIMESTAMP;
ALTER TABLE users ADD COLUMN xero_org_name VARCHAR(255);
ALTER TABLE users ADD COLUMN xero_auto_sync BOOLEAN DEFAULT FALSE;
```

**Security:** Tokens should be encrypted at rest using Fernet or similar.

### New `xero_sync_logs` table:

```sql
CREATE TABLE xero_sync_logs (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id),
    receipt_id INTEGER REFERENCES receipts(id),
    xero_transaction_id VARCHAR(255),
    sync_status VARCHAR(50), -- 'success', 'failed', 'pending'
    error_message TEXT,
    synced_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

---

## Backend Implementation

### File Structure

```
backend/app/
├── services/
│   └── xero_service.py          (OAuth, token management, API calls)
├── api/v1/
│   └── xero.py                  (Endpoints for OAuth and sync)
├── models/
│   └── user.py                  (Add Xero fields)
└── core/
    └── settings.py              (Add Xero credentials)
```

### 1. `backend/app/services/xero_service.py`

```python
"""
Xero Integration Service

Handles OAuth flow, token management, and API calls to Xero.
"""

import requests
from datetime import datetime, timedelta
from typing import Optional, Dict, List
from sqlalchemy.orm import Session
from cryptography.fernet import Fernet

from app.core.database import settings
from app.models.user import User
from app.models.receipt import Receipt

XERO_AUTH_URL = "https://login.xero.com/identity/connect/authorize"
XERO_TOKEN_URL = "https://identity.xero.com/connect/token"
XERO_API_BASE = "https://api.xero.com/api.xro/2.0"

# Encryption key for tokens (store in env)
cipher_suite = Fernet(settings.XERO_ENCRYPTION_KEY.encode())


class XeroService:
    """Handle Xero OAuth and API interactions"""
    
    @staticmethod
    def get_authorization_url(state: str) -> str:
        """Generate OAuth authorization URL"""
        params = {
            "response_type": "code",
            "client_id": settings.XERO_CLIENT_ID,
            "redirect_uri": settings.XERO_REDIRECT_URI,
            "scope": "accounting.transactions accounting.attachments accounting.contacts.read accounting.settings.read",
            "state": state
        }
        query = "&".join([f"{k}={v}" for k, v in params.items()])
        return f"{XERO_AUTH_URL}?{query}"
    
    @staticmethod
    async def exchange_code_for_tokens(code: str) -> Dict:
        """Exchange authorization code for access and refresh tokens"""
        payload = {
            "grant_type": "authorization_code",
            "code": code,
            "redirect_uri": settings.XERO_REDIRECT_URI,
            "client_id": settings.XERO_CLIENT_ID,
            "client_secret": settings.XERO_CLIENT_SECRET
        }
        
        response = requests.post(XERO_TOKEN_URL, data=payload)
        response.raise_for_status()
        return response.json()
    
    @staticmethod
    async def refresh_access_token(refresh_token: str) -> Dict:
        """Refresh expired access token"""
        payload = {
            "grant_type": "refresh_token",
            "refresh_token": refresh_token,
            "client_id": settings.XERO_CLIENT_ID,
            "client_secret": settings.XERO_CLIENT_SECRET
        }
        
        response = requests.post(XERO_TOKEN_URL, data=payload)
        response.raise_for_status()
        return response.json()
    
    @staticmethod
    def encrypt_token(token: str) -> str:
        """Encrypt token before storing in database"""
        return cipher_suite.encrypt(token.encode()).decode()
    
    @staticmethod
    def decrypt_token(encrypted_token: str) -> str:
        """Decrypt token from database"""
        return cipher_suite.decrypt(encrypted_token.encode()).decode()
    
    @staticmethod
    async def get_valid_access_token(user: User, db: Session) -> str:
        """Get valid access token, refreshing if needed"""
        # Check if token is expired or about to expire (5 min buffer)
        if user.xero_token_expires_at < datetime.utcnow() + timedelta(minutes=5):
            # Refresh token
            refresh_token = XeroService.decrypt_token(user.xero_refresh_token)
            tokens = await XeroService.refresh_access_token(refresh_token)
            
            # Update user with new tokens
            user.xero_access_token = XeroService.encrypt_token(tokens["access_token"])
            user.xero_refresh_token = XeroService.encrypt_token(tokens["refresh_token"])
            user.xero_token_expires_at = datetime.utcnow() + timedelta(seconds=tokens["expires_in"])
            db.commit()
            
            return tokens["access_token"]
        
        return XeroService.decrypt_token(user.xero_access_token)
    
    @staticmethod
    async def get_connections(access_token: str) -> List[Dict]:
        """Get list of Xero organizations user has access to"""
        headers = {
            "Authorization": f"Bearer {access_token}",
            "Content-Type": "application/json"
        }
        
        response = requests.get(
            "https://api.xero.com/connections",
            headers=headers
        )
        response.raise_for_status()
        return response.json()
    
    @staticmethod
    async def create_bank_transaction(
        user: User,
        receipt: Receipt,
        db: Session
    ) -> Dict:
        """
        Create a bank transaction in Xero for a receipt.
        Maps ExpenseFlow receipt to Xero BankTransaction.
        """
        access_token = await XeroService.get_valid_access_token(user, db)
        
        headers = {
            "Authorization": f"Bearer {access_token}",
            "Xero-tenant-id": user.xero_tenant_id,
            "Content-Type": "application/json"
        }
        
        # Map HMRC category to Xero account code
        account_code = XeroService.map_category_to_account(receipt.category)
        
        # Create transaction payload
        payload = {
            "BankTransactions": [{
                "Type": "SPEND",
                "Contact": {
                    "Name": receipt.merchant_name or "General Expense"
                },
                "LineItems": [{
                    "Description": receipt.description or receipt.category,
                    "Quantity": 1,
                    "UnitAmount": receipt.total_amount,
                    "AccountCode": account_code,
                    "TaxType": "INPUT2" if receipt.vat_amount > 0 else "NONE"
                }],
                "Date": receipt.date.strftime("%Y-%m-%d"),
                "Reference": f"ExpenseFlow #{receipt.id}",
                "Status": "AUTHORISED"
            }]
        }
        
        response = requests.post(
            f"{XERO_API_BASE}/BankTransactions",
            headers=headers,
            json=payload
        )
        response.raise_for_status()
        return response.json()
    
    @staticmethod
    async def attach_receipt_image(
        user: User,
        receipt: Receipt,
        xero_transaction_id: str,
        db: Session
    ) -> bool:
        """Upload receipt image as attachment to Xero transaction"""
        access_token = await XeroService.get_valid_access_token(user, db)
        
        headers = {
            "Authorization": f"Bearer {access_token}",
            "Xero-tenant-id": user.xero_tenant_id,
            "Content-Type": "image/jpeg"
        }
        
        # Download image from storage (GCS or S3)
        image_data = await XeroService.download_receipt_image(receipt.image_url)
        
        filename = f"receipt_{receipt.id}.jpg"
        response = requests.put(
            f"{XERO_API_BASE}/BankTransactions/{xero_transaction_id}/Attachments/{filename}",
            headers=headers,
            data=image_data
        )
        
        return response.status_code == 200
    
    @staticmethod
    def map_category_to_account(hmrc_category: str) -> str:
        """
        Map HMRC expense categories to Xero account codes.
        These are default codes - users may need custom mapping.
        """
        mapping = {
            "Advertising": "400",
            "Bank Charges": "404",
            "Computer": "412",
            "Entertainment": "429",
            "General": "429",
            "Insurance": "415",
            "Legal": "416",
            "Motor": "449",
            "Office": "420",
            "Postage": "425",
            "Professional": "416",
            "Rent": "470",
            "Repairs": "473",
            "Software": "476",
            "Stationery": "453",
            "Subscriptions": "489",
            "Telephone": "489",
            "Training": "489",
            "Travel": "493",
            "Utilities": "445",
            "Wages": "477"
        }
        return mapping.get(hmrc_category, "429")  # Default to General
    
    @staticmethod
    async def sync_receipt_to_xero(
        receipt: Receipt,
        user: User,
        db: Session
    ) -> Dict:
        """
        Full sync process: Create transaction + attach image
        """
        try:
            # Create bank transaction
            result = await XeroService.create_bank_transaction(user, receipt, db)
            transaction = result["BankTransactions"][0]
            xero_transaction_id = transaction["BankTransactionID"]
            
            # Attach receipt image
            await XeroService.attach_receipt_image(
                user, receipt, xero_transaction_id, db
            )
            
            # Log success
            log = XeroSyncLog(
                user_id=user.id,
                receipt_id=receipt.id,
                xero_transaction_id=xero_transaction_id,
                sync_status="success"
            )
            db.add(log)
            db.commit()
            
            return {
                "status": "success",
                "xero_transaction_id": xero_transaction_id
            }
            
        except Exception as e:
            # Log failure
            log = XeroSyncLog(
                user_id=user.id,
                receipt_id=receipt.id,
                sync_status="failed",
                error_message=str(e)
            )
            db.add(log)
            db.commit()
            
            return {
                "status": "failed",
                "error": str(e)
            }
```

### 2. `backend/app/api/v1/xero.py`

```python
"""
Xero OAuth and Sync Endpoints
"""

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from typing import List

from app.core.database import get_db
from app.core.auth import get_current_user
from app.models.user import User
from app.models.receipt import Receipt
from app.services.xero_service import XeroService
import uuid

router = APIRouter()


@router.get("/connect")
async def connect_xero(current_user: User = Depends(get_current_user)):
    """
    Initiate Xero OAuth flow.
    Returns authorization URL to redirect user to.
    """
    # Generate state token for CSRF protection
    state = str(uuid.uuid4())
    # Store state in session or cache for verification
    
    auth_url = XeroService.get_authorization_url(state)
    return {"authorization_url": auth_url}


@router.get("/callback")
async def xero_callback(
    code: str = Query(...),
    state: str = Query(...),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    OAuth callback endpoint.
    Xero redirects here after user grants permission.
    """
    try:
        # Exchange code for tokens
        tokens = await XeroService.exchange_code_for_tokens(code)
        
        # Get connections to determine tenant ID
        connections = await XeroService.get_connections(tokens["access_token"])
        
        if not connections:
            raise HTTPException(status_code=400, detail="No Xero organizations found")
        
        # Use first organization (most users have one)
        tenant = connections[0]
        
        # Store encrypted tokens
        current_user.xero_tenant_id = tenant["tenantId"]
        current_user.xero_org_name = tenant["tenantName"]
        current_user.xero_access_token = XeroService.encrypt_token(tokens["access_token"])
        current_user.xero_refresh_token = XeroService.encrypt_token(tokens["refresh_token"])
        current_user.xero_token_expires_at = datetime.utcnow() + timedelta(seconds=tokens["expires_in"])
        current_user.xero_connected_at = datetime.utcnow()
        
        db.commit()
        
        return {
            "status": "connected",
            "organization": tenant["tenantName"]
        }
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Connection failed: {str(e)}")


@router.post("/sync/receipt/{receipt_id}")
async def sync_receipt(
    receipt_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Manually sync a single receipt to Xero.
    """
    if not current_user.xero_tenant_id:
        raise HTTPException(status_code=400, detail="Xero not connected")
    
    receipt = db.query(Receipt).filter(
        Receipt.id == receipt_id,
        Receipt.user_id == current_user.id
    ).first()
    
    if not receipt:
        raise HTTPException(status_code=404, detail="Receipt not found")
    
    result = await XeroService.sync_receipt_to_xero(receipt, current_user, db)
    return result


@router.post("/sync/all")
async def sync_all_receipts(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Sync all unsynced receipts to Xero.
    """
    if not current_user.xero_tenant_id:
        raise HTTPException(status_code=400, detail="Xero not connected")
    
    # Get receipts not yet synced
    receipts = db.query(Receipt).filter(
        Receipt.user_id == current_user.id
    ).outerjoin(XeroSyncLog).filter(
        XeroSyncLog.id == None
    ).all()
    
    results = []
    for receipt in receipts:
        result = await XeroService.sync_receipt_to_xero(receipt, current_user, db)
        results.append({
            "receipt_id": receipt.id,
            **result
        })
    
    return {
        "total_synced": len(results),
        "results": results
    }


@router.delete("/disconnect")
async def disconnect_xero(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Disconnect Xero integration"""
    current_user.xero_tenant_id = None
    current_user.xero_access_token = None
    current_user.xero_refresh_token = None
    current_user.xero_token_expires_at = None
    current_user.xero_auto_sync = False
    
    db.commit()
    return {"status": "disconnected"}


@router.get("/status")
async def xero_status(current_user: User = Depends(get_current_user)):
    """Check Xero connection status"""
    if not current_user.xero_tenant_id:
        return {"connected": False}
    
    return {
        "connected": True,
        "organization": current_user.xero_org_name,
        "connected_at": current_user.xero_connected_at,
        "auto_sync": current_user.xero_auto_sync
    }
```

---

## Frontend Implementation

### File Structure

```
frontend/
├── components/
│   ├── xero-connect-button.tsx
│   ├── xero-sync-status.tsx
│   └── xero-settings-card.tsx
├── app/dashboard/
│   └── settings/
│       └── integrations/
│           └── page.tsx
```

### 1. `components/xero-connect-button.tsx`

```typescript
"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";

export function XeroConnectButton() {
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

  const handleConnect = async () => {
    try {
      setLoading(true);
      const response = await fetch("/api/v1/xero/connect", {
        headers: {
          Authorization: `Bearer ${await getToken()}`,
        },
      });
      
      const data = await response.json();
      
      // Redirect to Xero authorization page
      window.location.href = data.authorization_url;
      
    } catch (error) {
      toast({
        title: "Connection Failed",
        description: "Could not connect to Xero",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Button onClick={handleConnect} disabled={loading}>
      {loading ? "Connecting..." : "Connect to Xero"}
    </Button>
  );
}
```

### 2. `components/xero-settings-card.tsx`

```typescript
"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";

export function XeroSettingsCard({ status }) {
  if (!status.connected) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Xero Integration</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-gray-600 mb-4">
            Connect your Xero account to automatically sync expenses with receipt images.
          </p>
          <XeroConnectButton />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle>Xero Integration</CardTitle>
          <Badge variant="success">Connected</Badge>
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          <div>
            <p className="text-sm text-gray-600">Organization:</p>
            <p className="font-medium">{status.organization}</p>
          </div>
          
          <div className="flex items-center justify-between">
            <div>
              <p className="font-medium">Auto-sync new receipts</p>
              <p className="text-sm text-gray-500">
                Automatically sync receipts to Xero when uploaded
              </p>
            </div>
            <Switch checked={status.auto_sync} />
          </div>
          
          <Button variant="outline" onClick={handleSyncAll}>
            Sync All Receipts Now
          </Button>
          
          <Button variant="ghost" onClick={handleDisconnect}>
            Disconnect Xero
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
```

---

## Environment Variables

Add to `.env`:

```bash
# Xero OAuth Credentials
XERO_CLIENT_ID=your_client_id_here
XERO_CLIENT_SECRET=your_client_secret_here
XERO_REDIRECT_URI=https://expenseflow.co.uk/api/v1/xero/callback
XERO_ENCRYPTION_KEY=generate_with_fernet.generate_key()
```

---

## Migration File

```python
"""add xero integration fields

Revision ID: xero_integration_001
"""

from alembic import op
import sqlalchemy as sa

def upgrade():
    op.add_column('users', sa.Column('xero_tenant_id', sa.String(255), nullable=True))
    op.add_column('users', sa.Column('xero_access_token', sa.Text, nullable=True))
    op.add_column('users', sa.Column('xero_refresh_token', sa.Text, nullable=True))
    op.add_column('users', sa.Column('xero_token_expires_at', sa.DateTime, nullable=True))
    op.add_column('users', sa.Column('xero_connected_at', sa.DateTime, nullable=True))
    op.add_column('users', sa.Column('xero_org_name', sa.String(255), nullable=True))
    op.add_column('users', sa.Column('xero_auto_sync', sa.Boolean, default=False))
    
    # Create sync logs table
    op.create_table(
        'xero_sync_logs',
        sa.Column('id', sa.Integer, primary_key=True),
        sa.Column('user_id', sa.Integer, sa.ForeignKey('users.id')),
        sa.Column('receipt_id', sa.Integer, sa.ForeignKey('receipts.id')),
        sa.Column('xero_transaction_id', sa.String(255)),
        sa.Column('sync_status', sa.String(50)),
        sa.Column('error_message', sa.Text),
        sa.Column('synced_at', sa.DateTime, server_default=sa.func.now())
    )

def downgrade():
    op.drop_table('xero_sync_logs')
    op.drop_column('users', 'xero_tenant_id')
    op.drop_column('users', 'xero_access_token')
    op.drop_column('users', 'xero_refresh_token')
    op.drop_column('users', 'xero_token_expires_at')
    op.drop_column('users', 'xero_connected_at')
    op.drop_column('users', 'xero_org_name')
    op.drop_column('users', 'xero_auto_sync')
```

---

## Testing Strategy

### Local Testing

1. **Create Xero Demo Company:**
   - Sign up at https://developer.xero.com
   - Create demo company for testing
   - Use demo data (won't affect real accounting)

2. **Test OAuth Flow:**
   ```bash
   # Start backend
   cd backend
   uvicorn app.main:app --reload
   
   # Test connection
   curl http://localhost:8000/api/v1/xero/connect
   ```

3. **Test Transaction Creation:**
   - Upload test receipt
   - Click "Sync to Xero"
   - Verify transaction appears in demo Xero account
   - Verify image attached

### Production Testing Checklist

- [ ] OAuth flow completes successfully
- [ ] Tokens are encrypted in database
- [ ] Token refresh works automatically
- [ ] Receipt creates transaction in Xero
- [ ] Image attaches to transaction
- [ ] Category mapping is correct
- [ ] VAT calculation is accurate
- [ ] Auto-sync works (if enabled)
- [ ] Manual sync works
- [ ] Disconnect removes tokens
- [ ] Error handling shows user-friendly messages

---

## Rate Limits & Performance

**Xero API Limits:**
- 60 requests per minute per organization
- Daily limit: 5,000 calls per day per app

**Strategies:**
- Batch sync receipts (5-10 at a time)
- Implement queue system for large syncs
- Cache chart of accounts (rarely changes)
- Use webhooks to avoid polling

---

## Monetization Strategy

### Pricing Tiers

**Free Plan:**
- ❌ No Xero integration
- CSV export only

**Professional Plan (£12/month):**
- ✅ Xero integration included
- Auto-sync up to 100 receipts/month
- Manual sync unlimited

**Pro Plus Plan (£25/month):**
- ✅ Xero integration
- Unlimited auto-sync
- Priority sync (real-time)
- Custom category mapping

### Marketing Messaging

> "Save £600-1,800 per year in accountant fees with automatic Xero sync. Your receipts and images flow directly into Xero - zero manual work required."

---

## Implementation Timeline

**Phase 1 (Day 1-2): Backend OAuth**
- [ ] Xero app registration
- [ ] OAuth endpoints
- [ ] Token management
- [ ] Database migration

**Phase 2 (Day 2-3): API Integration**
- [ ] Create bank transaction endpoint
- [ ] Image attachment upload
- [ ] Category mapping
- [ ] Error handling

**Phase 3 (Day 3-4): Frontend**
- [ ] Connect button
- [ ] Settings page
- [ ] Sync status indicators
- [ ] Auto-sync toggle

**Phase 4 (Day 4-5): Testing & Polish**
- [ ] End-to-end testing
- [ ] Error scenarios
- [ ] Documentation
- [ ] Marketing page updates

---

## Future Enhancements

**Phase 2 Features:**
- Two-way sync (get invoices from Xero)
- Custom category mapping UI
- Bulk sync with progress bar
- Xero webhooks for real-time updates
- QuickBooks integration (similar architecture)
- FreeAgent integration (UK accountants)

---

## Success Metrics

**Track:**
- Number of Xero connections
- Receipts synced per user
- Sync success rate
- Time saved (avg receipts × 2 minutes)
- Professional plan conversion rate
- User retention (Xero users vs non-Xero)

**Target:**
- 30% of Professional users connect Xero
- 95%+ sync success rate
- 50+ receipts synced per user per month

---

## Documentation Needed

1. **User Guide:** How to connect Xero
2. **Accountant Guide:** What they'll see in Xero
3. **Troubleshooting:** Common connection issues
4. **FAQ:** Does it overwrite? Can I disconnect?

---

## Risk Mitigation

**What if Xero changes API?**
- Subscribe to Xero developer newsletter
- Monitor deprecation notices
- Keep SDK/library updated

**What if tokens expire unexpectedly?**
- Show clear "Reconnect Xero" message
- Email user when connection fails
- Grace period before disabling auto-sync

**What if sync fails?**
- Retry logic (3 attempts)
- Store failed receipts for manual review
- User notification of failures

---

## Questions to Answer Before Starting

1. What percentage of current users have requested Xero?
2. Do we have 50+ paying users yet?
3. Is Professional tier validated as worth £12/month?
4. Do we have accountant contacts for beta testing?
5. Is current CSV export sufficient for now?

---

## Recommendation

**Wait until you have:**
- 50-100 paying users
- 10+ direct requests for Xero integration
- Validated Professional tier pricing
- 1-2 accountants willing to beta test

**Then implement as a Professional tier exclusive feature to drive upgrades.**

This will be your #1 competitive advantage against basic expense trackers.
