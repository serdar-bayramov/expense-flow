# Bank Statement Upload & Transaction Matching Feature

## Executive Summary

**Goal:** Allow users to upload bank statement PDFs to automatically detect missing receipts and provide comprehensive expense tracking.

**Value Proposition:**
- Find missing tax deductions automatically
- Reconcile expenses without manual matching
- Reduce accountant time (and fees) by 50%
- Works with ANY bank (no Open Banking needed)

**Competition Advantage:**
- Dext/Receipt Bank: Same feature at £100+/month
- We deliver it at £12/month (Professional tier)
- No security concerns (user-controlled data)
- Works with all UK banks

**Cost to Deliver:**
- GPT-4o-mini: £0.0005 per statement (negligible until 25k+ users)
- Development: 10-15 days
- Maintenance: Low (stable PDF parsing)

---

## User Journey

### The Problem User Faces

Sarah is a freelance consultant. She:
1. Takes photos of most receipts (using ExpenseFlow)
2. But forgets some: coffee shops, parking, quick Tesco runs
3. End of tax year: Downloads bank statement
4. Manually compares 247 transactions against 182 receipts
5. Takes 3 hours, still unsure if she missed anything
6. Accountant charges £150 for reconciliation

### With Our Feature

Sarah:
1. Downloads January bank statement PDF (2 min)
2. Uploads to ExpenseFlow (30 sec)
3. Gets instant report:
   - ✅ 182 receipts matched to bank transactions
   - ⚠️ 65 transactions with no receipt (£892 total)
   - 💡 Potential unclaimed: £892 business expense + £178 VAT
4. Reviews missing transactions:
   - Marks 12 as "Personal" (groceries, personal shopping)
   - Marks 8 as "No Receipt" (coffee, small cash purchases <£10)
   - Adds receipts for remaining 45 (photos or manual entry)
5. Total time: 20 minutes
6. Savings: £178 VAT + 3 hours time + £150 accountant fee

---

## Technical Architecture

### System Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                         FRONTEND                                 │
│                                                                   │
│  1. Upload Component (PDF drop zone)                            │
│  2. Processing Progress (uploading → parsing → matching)        │
│  3. Results Dashboard (matched vs missing)                      │
│  4. Transaction Table (filter, sort, match manually)            │
│  5. Missing Receipts Alert Banner                               │
└─────────────────────────────────────────────────────────────────┘
                           │
                           │ POST /api/v1/bank-statements/upload (PDF)
                           ▼
┌─────────────────────────────────────────────────────────────────┐
│                         BACKEND API                              │
│                                                                   │
│  1. Receive PDF file                                            │
│  2. Store in GCS/S3                                             │
│  3. Extract text with PyPDF2                                    │
│  4. Send to GPT-4o-mini for transaction extraction              │
│  5. Parse JSON response                                         │
│  6. Store transactions in database                              │
│  7. Run matching algorithm                                      │
│  8. Return results                                              │
└─────────────────────────────────────────────────────────────────┘
                           │
                           │ stores
                           ▼
┌─────────────────────────────────────────────────────────────────┐
│                         DATABASE                                 │
│                                                                   │
│  bank_statements:                                               │
│    - id, user_id, file_url, statement_month                    │
│    - bank_name, account_last4, uploaded_at                     │
│                                                                   │
│  bank_transactions:                                             │
│    - id, statement_id, user_id, transaction_date               │
│    - description, amount, type (card/DD/transfer)              │
│    - matched_receipt_id, status (matched/missing/ignored)      │
│                                                                   │
│  transaction_matches:                                           │
│    - id, transaction_id, receipt_id, confidence_score          │
│    - match_type (exact/close/manual), created_at               │
└─────────────────────────────────────────────────────────────────┘
```

---

## Database Schema

### New Tables

```sql
-- Store uploaded bank statements
CREATE TABLE bank_statements (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    
    -- File storage
    file_url VARCHAR(512) NOT NULL,  -- GCS/S3 URL
    original_filename VARCHAR(255),
    file_size_kb INTEGER,
    
    -- Statement details (extracted)
    statement_month DATE NOT NULL,  -- First day of statement month (2026-01-01)
    bank_name VARCHAR(100),         -- Extracted: "Barclays", "NatWest"
    account_last4 VARCHAR(4),       -- Last 4 digits: "1234"
    account_type VARCHAR(50),       -- "Current Account", "Business Account"
    
    -- Processing status
    processing_status VARCHAR(50) DEFAULT 'pending',  -- pending, processing, completed, failed
    error_message TEXT,
    transactions_count INTEGER DEFAULT 0,
    
    -- Timestamps
    uploaded_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    processed_at TIMESTAMP,
    
    -- Indexes
    INDEX idx_user_statements (user_id, statement_month),
    INDEX idx_processing_status (processing_status)
);

-- Store individual transactions from statements
CREATE TABLE bank_transactions (
    id SERIAL PRIMARY KEY,
    statement_id INTEGER NOT NULL REFERENCES bank_statements(id) ON DELETE CASCADE,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    
    -- Transaction details
    transaction_date DATE NOT NULL,
    description VARCHAR(255) NOT NULL,  -- "TESCO STORES 4532"
    amount DECIMAL(10, 2) NOT NULL,     -- -45.23 (negative = debit)
    transaction_type VARCHAR(50),       -- "card_payment", "direct_debit", "transfer", "atm"
    
    -- Normalized merchant name (for matching)
    merchant_normalized VARCHAR(255),   -- "TESCO"
    
    -- Matching status
    matched_receipt_id INTEGER REFERENCES receipts(id) ON DELETE SET NULL,
    match_confidence DECIMAL(3, 2),     -- 0.95 = 95% confidence
    match_type VARCHAR(50),             -- "exact", "close", "manual", null
    
    -- User actions
    status VARCHAR(50) DEFAULT 'unmatched',  -- unmatched, matched, ignored_personal, ignored_no_receipt
    user_notes TEXT,
    
    -- Timestamps
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    matched_at TIMESTAMP,
    
    -- Indexes
    INDEX idx_user_transactions (user_id, transaction_date),
    INDEX idx_statement_transactions (statement_id),
    INDEX idx_unmatched (user_id, status) WHERE status = 'unmatched',
    INDEX idx_transaction_date (transaction_date),
    INDEX idx_merchant (merchant_normalized)
);

-- Track matching history (for reprocessing)
CREATE TABLE transaction_matches (
    id SERIAL PRIMARY KEY,
    transaction_id INTEGER NOT NULL REFERENCES bank_transactions(id) ON DELETE CASCADE,
    receipt_id INTEGER NOT NULL REFERENCES receipts(id) ON DELETE CASCADE,
    
    -- Match details
    confidence_score DECIMAL(3, 2) NOT NULL,  -- 0.00 to 1.00
    match_type VARCHAR(50) NOT NULL,           -- "exact", "close", "manual"
    
    -- Match criteria met
    date_match BOOLEAN DEFAULT FALSE,
    amount_match BOOLEAN DEFAULT FALSE,
    merchant_match BOOLEAN DEFAULT FALSE,
    
    -- Matching algorithm details (for debugging)
    date_diff_days INTEGER,
    amount_diff DECIMAL(10, 2),
    merchant_similarity DECIMAL(3, 2),
    
    -- Status
    is_active BOOLEAN DEFAULT TRUE,  -- False if user unmatches
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP,
    
    -- Constraints
    UNIQUE(transaction_id, receipt_id),
    INDEX idx_active_matches (transaction_id, is_active) WHERE is_active = TRUE
);
```

### Updates to Existing Tables

```sql
-- Add flag to receipts to track if matched to bank transaction
ALTER TABLE receipts ADD COLUMN matched_transaction_id INTEGER REFERENCES bank_transactions(id) ON DELETE SET NULL;
ALTER TABLE receipts ADD COLUMN is_bank_matched BOOLEAN DEFAULT FALSE;
ALTER TABLE receipts ADD INDEX idx_bank_matched (user_id, is_bank_matched);
```

---

## GPT-4o-mini Integration

### Extraction Prompt

```python
BANK_STATEMENT_EXTRACTION_PROMPT = """
You are a financial data extraction expert. Extract ALL transactions from this bank statement.

IMPORTANT RULES:
1. Extract EVERY transaction, even small ones
2. Amounts: Use negative for debits (money out), positive for credits (money in)
3. Dates: Format as YYYY-MM-DD
4. Description: Keep merchant name, remove branch codes if obvious
5. Type: Classify as card_payment, direct_debit, transfer, atm, cheque, fee, interest

Return ONLY valid JSON array, no markdown formatting:

[
  {
    "date": "2026-01-15",
    "description": "TESCO STORES 4532",
    "amount": -45.23,
    "type": "card_payment"
  },
  {
    "date": "2026-01-16",
    "description": "NETFLIX.COM",
    "amount": -12.99,
    "type": "direct_debit"
  }
]

COMMON PATTERNS TO RECOGNIZE:
- "DD" or "D/D" = direct_debit
- "POS" or "CARD" = card_payment
- "ATM" or "CASH" = atm
- "TFR" or "TRANSFER" = transfer
- "CHQ" or "CHEQUE" = cheque
- "FEE" or "CHARGE" = fee
- "INT PAID" or "INTEREST" = interest

If you cannot parse a transaction with confidence, skip it rather than guess.
"""
```

### Statement Metadata Extraction

```python
BANK_METADATA_EXTRACTION_PROMPT = """
Extract metadata from this bank statement:

{
  "bank_name": "Barclays" or "NatWest" or "HSBC" etc.,
  "account_last4": "1234",
  "account_type": "Current Account" or "Business Account",
  "statement_period": {
    "start": "2026-01-01",
    "end": "2026-01-31"
  },
  "opening_balance": 1250.50,
  "closing_balance": 980.75
}

Return ONLY the JSON object, no markdown.
"""
```

### Processing Service

```python
# backend/app/services/bank_statement_service.py

import PyPDF2
import openai
import json
from typing import List, Dict, Optional
from datetime import datetime
from difflib import SequenceMatcher

from app.core.database import settings
from app.models.bank_statement import BankStatement, BankTransaction
from app.models.receipt import Receipt

openai.api_key = settings.OPENAI_API_KEY


class BankStatementService:
    """Handle bank statement processing and transaction matching"""
    
    @staticmethod
    def extract_text_from_pdf(pdf_path: str) -> str:
        """Extract all text from PDF file"""
        text = ""
        with open(pdf_path, 'rb') as file:
            pdf_reader = PyPDF2.PdfReader(file)
            for page in pdf_reader.pages:
                text += page.extract_text() + "\n"
        return text
    
    @staticmethod
    async def extract_transactions_with_gpt(statement_text: str) -> List[Dict]:
        """Use GPT-4o-mini to extract transactions from statement text"""
        
        response = openai.chat.completions.create(
            model="gpt-4o-mini",
            messages=[
                {
                    "role": "system",
                    "content": "You are a financial data extraction expert. Extract transactions from bank statements accurately."
                },
                {
                    "role": "user",
                    "content": f"{BANK_STATEMENT_EXTRACTION_PROMPT}\n\nBANK STATEMENT TEXT:\n{statement_text}"
                }
            ],
            temperature=0.1,  # Low temperature for consistency
            max_tokens=4096
        )
        
        # Parse JSON response
        content = response.choices[0].message.content
        
        # Remove markdown formatting if present
        if content.startswith("```json"):
            content = content.replace("```json", "").replace("```", "").strip()
        elif content.startswith("```"):
            content = content.replace("```", "").strip()
        
        try:
            transactions = json.loads(content)
            return transactions
        except json.JSONDecodeError as e:
            print(f"Failed to parse GPT response: {e}")
            print(f"Response was: {content[:500]}...")
            raise ValueError("GPT returned invalid JSON")
    
    @staticmethod
    async def extract_metadata_with_gpt(statement_text: str) -> Dict:
        """Extract statement metadata (bank name, account, period)"""
        
        response = openai.chat.completions.create(
            model="gpt-4o-mini",
            messages=[
                {
                    "role": "system",
                    "content": "You are a financial data extraction expert."
                },
                {
                    "role": "user",
                    "content": f"{BANK_METADATA_EXTRACTION_PROMPT}\n\nSTATEMENT:\n{statement_text[:2000]}"  # First 2000 chars usually have metadata
                }
            ],
            temperature=0.1,
            max_tokens=500
        )
        
        content = response.choices[0].message.content
        if content.startswith("```json"):
            content = content.replace("```json", "").replace("```", "").strip()
        
        return json.loads(content)
    
    @staticmethod
    def normalize_merchant_name(description: str) -> str:
        """
        Normalize merchant names for matching.
        
        Examples:
            "TESCO STORES 4532" → "TESCO"
            "SAINSBURYS S/MKTS 1234" → "SAINSBURYS"
            "AMAZON PRIME*ABC123" → "AMAZON"
        """
        # Remove common suffixes
        normalized = description.upper()
        
        # Remove location codes
        normalized = normalized.split()[0] if ' ' in normalized else normalized
        
        # Remove special characters
        normalized = ''.join(c for c in normalized if c.isalnum() or c == ' ')
        
        # Common patterns
        patterns = {
            "TESCO STORES": "TESCO",
            "SAINSBURYS S/MKTS": "SAINSBURYS",
            "AMAZON PRIME": "AMAZON",
            "AMAZON MKTP": "AMAZON",
            "ASDA STORES": "ASDA",
            "MARKS&SPENCER": "M&S",
            "WWW.": "",  # Remove www. prefix
        }
        
        for pattern, replacement in patterns.items():
            if pattern in normalized:
                normalized = normalized.replace(pattern, replacement)
        
        return normalized.strip()
    
    @staticmethod
    def calculate_merchant_similarity(merchant1: str, merchant2: str) -> float:
        """
        Calculate similarity between two merchant names.
        Returns score from 0.0 to 1.0
        """
        m1 = BankStatementService.normalize_merchant_name(merchant1)
        m2 = BankStatementService.normalize_merchant_name(merchant2)
        
        # Use SequenceMatcher for fuzzy matching
        return SequenceMatcher(None, m1, m2).ratio()
    
    @staticmethod
    async def match_transaction_to_receipts(
        transaction: BankTransaction,
        user_receipts: List[Receipt],
        date_window_days: int = 3
    ) -> Optional[Dict]:
        """
        Find the best matching receipt for a bank transaction.
        
        Matching criteria:
        1. Date within window (±3 days default)
        2. Amount matches (within ±£0.05 for rounding)
        3. Merchant name similarity >70%
        
        Returns match dict with confidence score or None
        """
        from datetime import timedelta
        
        matches = []
        
        for receipt in user_receipts:
            # Skip if already matched
            if receipt.matched_transaction_id:
                continue
            
            # 1. Check date window
            date_diff = abs((transaction.transaction_date - receipt.date).days)
            if date_diff > date_window_days:
                continue
            
            # 2. Check amount (allow small rounding difference)
            amount_diff = abs(abs(transaction.amount) - receipt.total_amount)
            if amount_diff > 0.05:  # More than 5p difference
                continue
            
            # 3. Check merchant similarity
            merchant_similarity = BankStatementService.calculate_merchant_similarity(
                transaction.description,
                receipt.merchant_name or ""
            )
            
            if merchant_similarity < 0.5:  # Less than 50% similar
                continue
            
            # Calculate overall confidence score
            date_score = 1.0 - (date_diff / date_window_days)  # 1.0 = same day
            amount_score = 1.0 - (amount_diff / 0.05)  # 1.0 = exact match
            merchant_score = merchant_similarity
            
            # Weighted average
            confidence = (
                date_score * 0.3 +
                amount_score * 0.3 +
                merchant_score * 0.4
            )
            
            matches.append({
                "receipt": receipt,
                "confidence": confidence,
                "date_match": date_diff == 0,
                "amount_match": amount_diff <= 0.01,
                "merchant_match": merchant_similarity >= 0.8,
                "date_diff_days": date_diff,
                "amount_diff": amount_diff,
                "merchant_similarity": merchant_similarity
            })
        
        # Return best match if confidence > 70%
        if matches:
            best_match = max(matches, key=lambda m: m["confidence"])
            if best_match["confidence"] >= 0.70:
                return best_match
        
        return None
    
    @staticmethod
    async def process_statement(
        statement_id: int,
        user_id: int,
        db
    ) -> Dict:
        """
        Complete processing pipeline:
        1. Extract text from PDF
        2. Extract transactions with GPT
        3. Extract metadata
        4. Store in database
        5. Match with existing receipts
        6. Return summary
        """
        from sqlalchemy.orm import Session
        
        statement = db.query(BankStatement).filter(
            BankStatement.id == statement_id,
            BankStatement.user_id == user_id
        ).first()
        
        if not statement:
            raise ValueError("Statement not found")
        
        try:
            # Update status
            statement.processing_status = "processing"
            db.commit()
            
            # 1. Extract text
            # Download from GCS/S3 first
            local_path = await download_from_storage(statement.file_url)
            statement_text = BankStatementService.extract_text_from_pdf(local_path)
            
            # 2. Extract transactions
            transactions_data = await BankStatementService.extract_transactions_with_gpt(statement_text)
            
            # 3. Extract metadata
            metadata = await BankStatementService.extract_metadata_with_gpt(statement_text)
            
            # Update statement with metadata
            statement.bank_name = metadata.get("bank_name")
            statement.account_last4 = metadata.get("account_last4")
            statement.account_type = metadata.get("account_type")
            statement.transactions_count = len(transactions_data)
            
            # 4. Store transactions
            created_transactions = []
            for tx_data in transactions_data:
                transaction = BankTransaction(
                    statement_id=statement_id,
                    user_id=user_id,
                    transaction_date=datetime.strptime(tx_data["date"], "%Y-%m-%d").date(),
                    description=tx_data["description"],
                    amount=tx_data["amount"],
                    transaction_type=tx_data.get("type", "unknown"),
                    merchant_normalized=BankStatementService.normalize_merchant_name(tx_data["description"]),
                    status="unmatched"
                )
                db.add(transaction)
                created_transactions.append(transaction)
            
            db.commit()
            
            # 5. Match with receipts
            user_receipts = db.query(Receipt).filter(
                Receipt.user_id == user_id,
                Receipt.deleted_at == None
            ).all()
            
            matched_count = 0
            for transaction in created_transactions:
                match = await BankStatementService.match_transaction_to_receipts(
                    transaction,
                    user_receipts
                )
                
                if match:
                    receipt = match["receipt"]
                    
                    # Create match record
                    from app.models.bank_statement import TransactionMatch
                    match_record = TransactionMatch(
                        transaction_id=transaction.id,
                        receipt_id=receipt.id,
                        confidence_score=match["confidence"],
                        match_type="exact" if match["confidence"] >= 0.95 else "close",
                        date_match=match["date_match"],
                        amount_match=match["amount_match"],
                        merchant_match=match["merchant_match"],
                        date_diff_days=match["date_diff_days"],
                        amount_diff=match["amount_diff"],
                        merchant_similarity=match["merchant_similarity"]
                    )
                    db.add(match_record)
                    
                    # Update transaction
                    transaction.matched_receipt_id = receipt.id
                    transaction.match_confidence = match["confidence"]
                    transaction.match_type = match_record.match_type
                    transaction.status = "matched"
                    transaction.matched_at = datetime.utcnow()
                    
                    # Update receipt
                    receipt.matched_transaction_id = transaction.id
                    receipt.is_bank_matched = True
                    
                    matched_count += 1
            
            db.commit()
            
            # Update statement status
            statement.processing_status = "completed"
            statement.processed_at = datetime.utcnow()
            db.commit()
            
            # 6. Return summary
            return {
                "status": "success",
                "statement_id": statement_id,
                "transactions_total": len(created_transactions),
                "transactions_matched": matched_count,
                "transactions_missing": len(created_transactions) - matched_count,
                "bank_name": statement.bank_name,
                "statement_month": statement.statement_month.isoformat()
            }
            
        except Exception as e:
            # Update status with error
            statement.processing_status = "failed"
            statement.error_message = str(e)
            db.commit()
            
            raise
```

---

## API Endpoints

### 1. Upload Statement

```python
# backend/app/api/v1/bank_statements.py

from fastapi import APIRouter, Depends, UploadFile, File, HTTPException, status
from sqlalchemy.orm import Session
from typing import List

from app.core.database import get_db
from app.api.deps import get_current_user
from app.models.user import User
from app.models.bank_statement import BankStatement
from app.services.bank_statement_service import BankStatementService
from app.services.storage import upload_to_gcs  # or S3

router = APIRouter()


@router.post("/upload")
async def upload_bank_statement(
    file: UploadFile = File(...),
    statement_month: str = None,  # Optional: "2026-01" format
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Upload a bank statement PDF for processing.
    
    Professional/Pro Plus users only.
    """
    # 1. Check user plan
    if current_user.subscription_plan not in ['professional', 'pro_plus']:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Bank statement upload requires Professional or Pro Plus plan"
        )
    
    # 2. Validate file type
    if not file.filename.endswith('.pdf'):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Only PDF files are supported"
        )
    
    # 3. Validate file size (max 10MB)
    contents = await file.read()
    file_size_kb = len(contents) / 1024
    
    if file_size_kb > 10240:  # 10MB
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="File size must be under 10MB"
        )
    
    # 4. Check monthly limit (Professional: 1/month, Pro Plus: unlimited)
    if current_user.subscription_plan == 'professional':
        from datetime import datetime
        current_month = datetime.utcnow().replace(day=1)
        
        existing_count = db.query(BankStatement).filter(
            BankStatement.user_id == current_user.id,
            BankStatement.uploaded_at >= current_month
        ).count()
        
        if existing_count >= 1:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Professional plan allows 1 statement per month. Upgrade to Pro Plus for unlimited."
            )
    
    # 5. Upload to storage
    file_url = await upload_to_gcs(
        contents,
        f"bank-statements/{current_user.id}/{file.filename}",
        content_type="application/pdf"
    )
    
    # 6. Create database record
    from datetime import datetime
    
    statement = BankStatement(
        user_id=current_user.id,
        file_url=file_url,
        original_filename=file.filename,
        file_size_kb=int(file_size_kb),
        statement_month=datetime.strptime(statement_month, "%Y-%m").date() if statement_month else None,
        processing_status="pending"
    )
    
    db.add(statement)
    db.commit()
    db.refresh(statement)
    
    # 7. Process asynchronously (or synchronously for MVP)
    # For MVP: Process synchronously
    try:
        result = await BankStatementService.process_statement(
            statement.id,
            current_user.id,
            db
        )
        
        return {
            "statement_id": statement.id,
            "status": "completed",
            **result
        }
        
    except Exception as e:
        return {
            "statement_id": statement.id,
            "status": "failed",
            "error": str(e)
        }


@router.get("/statements")
async def list_statements(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """List all uploaded statements for current user"""
    statements = db.query(BankStatement).filter(
        BankStatement.user_id == current_user.id
    ).order_by(BankStatement.uploaded_at.desc()).all()
    
    return {
        "statements": [
            {
                "id": s.id,
                "filename": s.original_filename,
                "bank_name": s.bank_name,
                "statement_month": s.statement_month.isoformat() if s.statement_month else None,
                "transactions_count": s.transactions_count,
                "processing_status": s.processing_status,
                "uploaded_at": s.uploaded_at.isoformat()
            }
            for s in statements
        ]
    }


@router.get("/statements/{statement_id}/transactions")
async def get_statement_transactions(
    statement_id: int,
    status_filter: str = None,  # "matched", "unmatched", "ignored"
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get all transactions from a statement"""
    from app.models.bank_statement import BankTransaction
    
    # Verify ownership
    statement = db.query(BankStatement).filter(
        BankStatement.id == statement_id,
        BankStatement.user_id == current_user.id
    ).first()
    
    if not statement:
        raise HTTPException(status_code=404, detail="Statement not found")
    
    # Query transactions
    query = db.query(BankTransaction).filter(
        BankTransaction.statement_id == statement_id
    )
    
    if status_filter:
        if status_filter == "unmatched":
            query = query.filter(BankTransaction.status == "unmatched")
        elif status_filter == "matched":
            query = query.filter(BankTransaction.status == "matched")
        elif status_filter == "ignored":
            query = query.filter(BankTransaction.status.in_(["ignored_personal", "ignored_no_receipt"]))
    
    transactions = query.order_by(BankTransaction.transaction_date.desc()).all()
    
    return {
        "statement_id": statement_id,
        "transactions": [
            {
                "id": t.id,
                "date": t.transaction_date.isoformat(),
                "description": t.description,
                "amount": float(t.amount),
                "type": t.transaction_type,
                "status": t.status,
                "matched_receipt_id": t.matched_receipt_id,
                "match_confidence": float(t.match_confidence) if t.match_confidence else None
            }
            for t in transactions
        ]
    }


@router.post("/transactions/{transaction_id}/match/{receipt_id}")
async def manual_match(
    transaction_id: int,
    receipt_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Manually match a transaction to a receipt"""
    from app.models.bank_statement import BankTransaction, TransactionMatch
    
    # Verify ownership
    transaction = db.query(BankTransaction).filter(
        BankTransaction.id == transaction_id,
        BankTransaction.user_id == current_user.id
    ).first()
    
    receipt = db.query(Receipt).filter(
        Receipt.id == receipt_id,
        Receipt.user_id == current_user.id
    ).first()
    
    if not transaction or not receipt:
        raise HTTPException(status_code=404, detail="Transaction or receipt not found")
    
    # Create match
    match = TransactionMatch(
        transaction_id=transaction_id,
        receipt_id=receipt_id,
        confidence_score=1.0,  # Manual match = 100% confidence
        match_type="manual",
        date_match=transaction.transaction_date == receipt.date,
        amount_match=abs(abs(transaction.amount) - receipt.total_amount) <= 0.05,
        merchant_match=True
    )
    db.add(match)
    
    # Update transaction
    transaction.matched_receipt_id = receipt_id
    transaction.match_confidence = 1.0
    transaction.match_type = "manual"
    transaction.status = "matched"
    transaction.matched_at = datetime.utcnow()
    
    # Update receipt
    receipt.matched_transaction_id = transaction_id
    receipt.is_bank_matched = True
    
    db.commit()
    
    return {"status": "success", "message": "Transaction matched successfully"}


@router.delete("/transactions/{transaction_id}/match")
async def unmatch_transaction(
    transaction_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Remove match from a transaction"""
    from app.models.bank_statement import BankTransaction, TransactionMatch
    
    transaction = db.query(BankTransaction).filter(
        BankTransaction.id == transaction_id,
        BankTransaction.user_id == current_user.id
    ).first()
    
    if not transaction:
        raise HTTPException(status_code=404, detail="Transaction not found")
    
    if transaction.matched_receipt_id:
        # Update receipt
        receipt = db.query(Receipt).filter(Receipt.id == transaction.matched_receipt_id).first()
        if receipt:
            receipt.matched_transaction_id = None
            receipt.is_bank_matched = False
        
        # Deactivate match record
        match = db.query(TransactionMatch).filter(
            TransactionMatch.transaction_id == transaction_id,
            TransactionMatch.is_active == True
        ).first()
        if match:
            match.is_active = False
    
    # Reset transaction
    transaction.matched_receipt_id = None
    transaction.match_confidence = None
    transaction.match_type = None
    transaction.status = "unmatched"
    transaction.matched_at = None
    
    db.commit()
    
    return {"status": "success", "message": "Match removed"}


@router.put("/transactions/{transaction_id}/ignore")
async def ignore_transaction(
    transaction_id: int,
    reason: str,  # "personal" or "no_receipt"
    notes: str = None,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Mark a transaction as ignored (personal or no receipt needed)"""
    from app.models.bank_statement import BankTransaction
    
    transaction = db.query(BankTransaction).filter(
        BankTransaction.id == transaction_id,
        BankTransaction.user_id == current_user.id
    ).first()
    
    if not transaction:
        raise HTTPException(status_code=404, detail="Transaction not found")
    
    if reason == "personal":
        transaction.status = "ignored_personal"
    elif reason == "no_receipt":
        transaction.status = "ignored_no_receipt"
    else:
        raise HTTPException(status_code=400, detail="Invalid reason")
    
    transaction.user_notes = notes
    db.commit()
    
    return {"status": "success", "message": "Transaction ignored"}


@router.get("/analytics/missing-receipts")
async def missing_receipts_analytics(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Get analytics about missing receipts.
    Shows potential unclaimed expenses.
    """
    from app.models.bank_statement import BankTransaction
    from sqlalchemy import func, and_
    
    # Get unmatched transactions (potential missing receipts)
    unmatched = db.query(
        func.count(BankTransaction.id).label('count'),
        func.sum(BankTransaction.amount).label('total')
    ).filter(
        BankTransaction.user_id == current_user.id,
        BankTransaction.status == 'unmatched',
        BankTransaction.amount < 0  # Only debits
    ).first()
    
    # Get matched count
    matched_count = db.query(func.count(BankTransaction.id)).filter(
        BankTransaction.user_id == current_user.id,
        BankTransaction.status == 'matched'
    ).scalar()
    
    # Calculate potential VAT savings (20% of unmatched amount)
    unmatched_total = abs(float(unmatched.total or 0))
    potential_vat = unmatched_total * 0.2
    
    return {
        "unmatched_count": unmatched.count or 0,
        "unmatched_total": unmatched_total,
        "potential_vat_unclaimed": potential_vat,
        "matched_count": matched_count or 0,
        "match_rate": matched_count / (matched_count + (unmatched.count or 0)) if matched_count else 0
    }
```

---

## Frontend Components

### 1. Upload Component

```typescript
// frontend/components/bank-statement-upload.tsx

'use client';

import { useState } from 'react';
import { useDropzone } from 'react-dropzone';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Upload, FileText, AlertCircle } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

interface UploadResult {
  statement_id: number;
  status: string;
  transactions_total: number;
  transactions_matched: number;
  transactions_missing: number;
}

export function BankStatementUpload({ onUploadComplete }: { onUploadComplete: (result: UploadResult) => void }) {
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const { toast } = useToast();

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    accept: {
      'application/pdf': ['.pdf']
    },
    maxFiles: 1,
    onDrop: async (acceptedFiles) => {
      if (acceptedFiles.length === 0) return;

      const file = acceptedFiles[0];
      setUploading(true);
      setProgress(10);

      try {
        // Upload file
        const formData = new FormData();
        formData.append('file', file);

        setProgress(30);

        const token = await getToken(); // From Clerk
        const response = await fetch(`${API_URL}/api/v1/bank-statements/upload`, {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${token}`,
          },
          body: formData,
        });

        setProgress(60);

        if (!response.ok) {
          const error = await response.json();
          throw new Error(error.detail || 'Upload failed');
        }

        const result = await response.json();
        setProgress(100);

        toast({
          title: 'Statement Processed',
          description: `Found ${result.transactions_total} transactions. ${result.transactions_matched} matched, ${result.transactions_missing} need attention.`,
        });

        onUploadComplete(result);
        
      } catch (error: any) {
        toast({
          title: 'Upload Failed',
          description: error.message,
          variant: 'destructive',
        });
      } finally {
        setUploading(false);
        setProgress(0);
      }
    },
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle>Upload Bank Statement</CardTitle>
      </CardHeader>
      <CardContent>
        {!uploading ? (
          <div
            {...getRootProps()}
            className={`
              border-2 border-dashed rounded-lg p-12 text-center cursor-pointer
              transition-colors duration-200
              ${isDragActive ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20' : 'border-gray-300 dark:border-gray-700'}
              hover:border-blue-400 hover:bg-gray-50 dark:hover:bg-gray-800
            `}
          >
            <input {...getInputProps()} />
            <Upload className="mx-auto h-12 w-12 text-gray-400 mb-4" />
            
            {isDragActive ? (
              <p className="text-lg font-medium text-blue-600 dark:text-blue-400">
                Drop your bank statement here
              </p>
            ) : (
              <>
                <p className="text-lg font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Drop your bank statement PDF here
                </p>
                <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
                  or click to browse
                </p>
                <Button variant="outline" size="sm">
                  <FileText className="mr-2 h-4 w-4" />
                  Select PDF
                </Button>
              </>
            )}
          </div>
        ) : (
          <div className="space-y-4">
            <Progress value={progress} className="w-full" />
            <p className="text-center text-sm text-gray-600 dark:text-gray-400">
              {progress < 40 && 'Uploading statement...'}
              {progress >= 40 && progress < 70 && 'Extracting transactions with AI...'}
              {progress >= 70 && progress < 100 && 'Matching with receipts...'}
              {progress === 100 && 'Complete!'}
            </p>
          </div>
        )}

        <div className="mt-6 p-4 bg-gray-50 dark:bg-gray-800 rounded-lg">
          <div className="flex items-start gap-3">
            <AlertCircle className="h-5 w-5 text-blue-500 mt-0.5 flex-shrink-0" />
            <div className="text-sm text-gray-600 dark:text-gray-400">
              <p className="font-medium text-gray-700 dark:text-gray-300 mb-1">
                How to get your statement:
              </p>
              <ol className="list-decimal list-inside space-y-1">
                <li>Log in to your online banking</li>
                <li>Go to Statements or Documents</li>
                <li>Download last month's statement as PDF</li>
                <li>Upload it here</li>
              </ol>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
```

### 2. Transaction Table Component

```typescript
// frontend/components/bank-transactions-table.tsx

'use client';

import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { CheckCircle, AlertCircle, XCircle, Link as LinkIcon } from 'lucide-react';

interface BankTransaction {
  id: number;
  date: string;
  description: string;
  amount: number;
  type: string;
  status: 'matched' | 'unmatched' | 'ignored_personal' | 'ignored_no_receipt';
  matched_receipt_id?: number;
  match_confidence?: number;
}

export function BankTransactionsTable({ 
  transactions, 
  onMatch,
  onUnmatch,
  onIgnore 
}: {
  transactions: BankTransaction[];
  onMatch: (transactionId: number, receiptId: number) => void;
  onUnmatch: (transactionId: number) => void;
  onIgnore: (transactionId: number, reason: string) => void;
}) {
  const [filter, setFilter] = useState<'all' | 'matched' | 'unmatched' | 'ignored'>('all');

  const filtered = transactions.filter(tx => {
    if (filter === 'all') return true;
    if (filter === 'matched') return tx.status === 'matched';
    if (filter === 'unmatched') return tx.status === 'unmatched';
    if (filter === 'ignored') return tx.status.startsWith('ignored_');
    return true;
  });

  const getStatusBadge = (tx: BankTransaction) => {
    if (tx.status === 'matched') {
      return (
        <Badge variant="outline" className="bg-green-50 text-green-700 border-green-300">
          <CheckCircle className="mr-1 h-3 w-3" />
          Matched {tx.match_confidence && `(${(tx.match_confidence * 100).toFixed(0)}%)`}
        </Badge>
      );
    }
    if (tx.status === 'unmatched') {
      return (
        <Badge variant="outline" className="bg-orange-50 text-orange-700 border-orange-300">
          <AlertCircle className="mr-1 h-3 w-3" />
          Missing Receipt
        </Badge>
      );
    }
    return (
      <Badge variant="outline" className="bg-gray-50 text-gray-700 border-gray-300">
        <XCircle className="mr-1 h-3 w-3" />
        Ignored
      </Badge>
    );
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle>Bank Transactions</CardTitle>
          <div className="flex gap-2">
            <Button
              variant={filter === 'all' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setFilter('all')}
            >
              All ({transactions.length})
            </Button>
            <Button
              variant={filter === 'matched' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setFilter('matched')}
            >
              Matched ({transactions.filter(tx => tx.status === 'matched').length})
            </Button>
            <Button
              variant={filter === 'unmatched' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setFilter('unmatched')}
            >
              Missing ({transactions.filter(tx => tx.status === 'unmatched').length})
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b">
                <th className="text-left py-3 px-4">Date</th>
                <th className="text-left py-3 px-4">Merchant</th>
                <th className="text-right py-3 px-4">Amount</th>
                <th className="text-left py-3 px-4">Status</th>
                <th className="text-right py-3 px-4">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(tx => (
                <tr key={tx.id} className="border-b hover:bg-gray-50 dark:hover:bg-gray-800">
                  <td className="py-3 px-4">
                    {new Date(tx.date).toLocaleDateString('en-GB')}
                  </td>
                  <td className="py-3 px-4">
                    <div className="font-medium">{tx.description}</div>
                    <div className="text-sm text-gray-500">{tx.type}</div>
                  </td>
                  <td className="py-3 px-4 text-right font-medium">
                    {tx.amount < 0 ? '-' : ''}£{Math.abs(tx.amount).toFixed(2)}
                  </td>
                  <td className="py-3 px-4">
                    {getStatusBadge(tx)}
                  </td>
                  <td className="py-3 px-4 text-right">
                    {tx.status === 'matched' && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => onUnmatch(tx.id)}
                      >
                        Unmatch
                      </Button>
                    )}
                    {tx.status === 'unmatched' && (
                      <div className="flex gap-2 justify-end">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => {/* Open receipt selector */}}
                        >
                          <LinkIcon className="mr-1 h-3 w-3" />
                          Match
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => onIgnore(tx.id, 'personal')}
                        >
                          Ignore
                        </Button>
                      </div>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>
  );
}
```

### 3. Missing Receipts Dashboard Widget

```typescript
// frontend/components/missing-receipts-widget.tsx

'use client';

import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { AlertTriangle } from 'lucide-react';
import { useRouter } from 'next/navigation';

interface MissingReceiptsData {
  unmatched_count: number;
  unmatched_total: number;
  potential_vat_unclaimed: number;
}

export function MissingReceiptsWidget({ data }: { data: MissingReceiptsData }) {
  const router = useRouter();

  if (data.unmatched_count === 0) return null;

  return (
    <Card className="border-2 border-orange-300 bg-orange-50 dark:bg-orange-900/20">
      <CardContent className="pt-6">
        <div className="flex items-start gap-4">
          <div className="p-3 rounded-full bg-orange-100 dark:bg-orange-900">
            <AlertTriangle className="h-6 w-6 text-orange-600 dark:text-orange-400" />
          </div>
          <div className="flex-1">
            <h3 className="text-lg font-semibold text-orange-900 dark:text-orange-100 mb-2">
              Missing Receipts Detected
            </h3>
            <p className="text-sm text-orange-800 dark:text-orange-200 mb-4">
              We found <strong>{data.unmatched_count} bank transactions</strong> (totaling{' '}
              <strong>£{data.unmatched_total.toFixed(2)}</strong>) without matching receipts.
              You could be missing out on <strong>£{data.potential_vat_unclaimed.toFixed(2)}</strong> in VAT claims.
            </p>
            <Button
              onClick={() => router.push('/dashboard/bank-reconciliation')}
              className="bg-orange-600 hover:bg-orange-700 text-white"
            >
              Review Missing Receipts
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
```

---

## Phase-by-Phase Implementation

### **Phase 1: MVP (Week 1-2)** 🎯 Priority

**Goal:** Basic upload, extraction, and display

**Tasks:**
1. Database schema (3 tables)
2. File upload endpoint
3. GPT extraction service
4. Basic transaction table view
5. Simple statistics

**Deliverable:**
- User uploads PDF
- Sees list of transactions
- Shows "X transactions, Y with receipts, Z missing"

**Time: 7-10 days**

### **Phase 2: Smart Matching (Week 3)**

**Goal:** Automatic receipt matching

**Tasks:**
1. Implement matching algorithm
2. Match confidence scoring
3. Transaction-receipt linking
4. Manual match/unmatch UI

**Deliverable:**
- Automatic matching on upload
- User can manually link transactions
- Confidence scores displayed

**Time: 4-5 days**

### **Phase 3: User Features (Week 4)**

**Goal:** Polish and usability

**Tasks:**
1. Ignore transaction (personal/no receipt)
2. Filter and search transactions
3. Missing receipts dashboard widget
4. Statement history page
5. Re-process statement

**Deliverable:**
- Complete user workflow
- Dashboard integration
- Professional tier gating

**Time: 5-7 days**

### **Phase 4: Analytics & Insights (Week 5+)**

**Goal:** Add intelligence

**Tasks:**
1. Recurring transaction detection
2. Category suggestions
3. Spending trends
4. Anomaly detection (unusual charges)
5. Monthly comparison

**Deliverable:**
- "You spent £200 more on travel this month"
- "New subscription detected: Netflix £12.99"
- Smart notifications

**Time: 7-10 days**

---

## Costs & Pricing

### Development Costs

**Your time:**
- Phase 1: 7-10 days
- Phase 2: 4-5 days
- Phase 3: 5-7 days
- **Total: 16-22 days**

### Operational Costs

**GPT-4o-mini pricing:**
- Input: $0.150 per 1M tokens (~£0.12)
- Output: $0.600 per 1M tokens (~£0.48)

**Per statement cost:**
- Text extraction: ~2,000 input tokens
- Transaction data: ~500 output tokens
- **Cost = £0.0005 per statement** (0.05p!)

**Realistic scenarios:**

| Month | Users | Statements | GPT Cost | Storage | Total |
|-------|-------|-----------|----------|---------|-------|
| 1 | 10 | 10 | £0.01 | £0.10 | £0.11 |
| 3 | 50 | 50 | £0.03 | £0.50 | £0.53 |
| 6 | 150 | 150 | £0.08 | £1.50 | £1.58 |
| 12 | 500 | 500 | £0.25 | £5.00 | £5.25 |

**Storage (GCS/S3):**
- Average PDF: 500KB
- 1,000 statements = 500MB = ~£5/month

**Costs are negligible until mass scale.**

### Revenue Impact

**Current pricing:**
- Free: £0/month (no bank feature)
- Professional: £12/month (1 statement/month)
- Pro Plus: £25/month (unlimited statements)

**Conversion potential:**
- If 20% of Free users upgrade for this feature = +£12/user/month
- 100 Free users × 20% × £12 = **£240/month revenue**
- Cost to deliver: **£1-2/month**
- **Profit margin: 99%**

---

## Go-To-Market Strategy

### Marketing Messaging

**Headline:**
> "Never miss a tax deduction again"

**Sub-headline:**
> "Upload your bank statement. We'll show you which expenses you forgot to claim."

**Social proof:**
> "Sarah saved £482 in missed VAT claims in her first month"

### Landing Page Copy

```
❌ Before ExpenseFlow:
- Download bank statement
- Manually compare 247 transactions
- 3 hours of tedious work
- Still unsure if you missed anything
- Pay accountant £150 to reconcile

✅ With ExpenseFlow:
- Upload bank statement (2 min)
- Automatic matching (instant)
- See exactly what's missing
- Add receipts or mark as personal
- Done in 20 minutes
```

### Launch Plan

**Week 1-2: Build MVP**
- Focus on Professional tier users
- Beta test with 5-10 users

**Week 3: Soft Launch**
- Email existing Professional users
- "New Feature: Bank Reconciliation"
- Get feedback, iterate

**Week 4: Push Free → Professional**
- Email all Free users
- "Can't find missing receipts? Upgrade today"
- Limited offer: First month 50% off

**Week 5+: Content Marketing**
- Blog post: "How UK Freelancers Miss £1,000+ in Tax Deductions"
- LinkedIn: Case studies
- Reddit: r/UKPersonalFinance

---

## Testing Strategy

### Manual Testing Checklist

**Upload:**
- [ ] PDF upload successful
- [ ] File size validation (reject >10MB)
- [ ] Non-PDF rejection
- [ ] Professional tier gating works

**Extraction:**
- [ ] Transactions extracted correctly
- [ ] Dates parsed properly (DD/MM/YYYY → YYYY-MM-DD)
- [ ] Amounts correct (negative for debits)
- [ ] Merchant names normalized

**Matching:**
- [ ] Exact matches found (same date, same amount)
- [ ] Close matches suggested (±1 day, ±£0.05)
- [ ] No false positives
- [ ] Receipts not matched twice

**User Actions:**
- [ ] Manual match works
- [ ] Unmatch works
- [ ] Ignore (personal) works
- [ ] Ignore (no receipt) works

**Edge Cases:**
- [ ] Refunds (positive amounts) handled
- [ ] Foreign currency transactions
- [ ] Multiple transactions same merchant, same day
- [ ] Very old statements (>1 year)

### Test Bank Statements

Create test PDFs with known transactions:

**Test 1: Simple statement (5 transactions)**
- 2 should match existing receipts (same date, same amount)
- 2 should be unmatched
- 1 should be ignored (small personal purchase)

**Test 2: Complex statement (50 transactions)**
- Mix of matched, unmatched, subscriptions
- Test performance and accuracy

**Test 3: Different bank formats**
- Barclays, NatWest, HSBC, Santander
- Ensure GPT handles variability

---

## Risk Mitigation

### Privacy Concerns

**Solution:**
- Clear disclaimer: "We never store your bank credentials"
- "Your statement is encrypted in transit and at rest"
- "You can delete statements anytime"
- GDPR compliant: Allow users to export/delete data

### GPT Extraction Errors

**Risk:** GPT misreads transaction

**Mitigation:**
- Manual review before confirming matches
- User can edit transaction details
- Flag low-confidence extractions
- Allow re-processing with better prompt

### Poor Matching Accuracy

**Risk:** Too many false matches or missed matches

**Mitigation:**
- Start with high confidence threshold (70%+)
- Allow user to adjust sensitivity
- Learn from manual matches (ML improvement)
- Provide detailed match reasons

### Bank Format Changes

**Risk:** Bank updates statement format

**Mitigation:**
- GPT is resilient to format changes
- Monitor error rates
- Update prompts if needed
- Fallback: CSV upload option

---

## Future Enhancements (Phase 4+)

### 1. Open Banking Integration

Once established (100+ users, proven feature):
- Add real-time bank connection
- Auto-import transactions daily
- Push notifications: "New £45 expense - add receipt?"
- Premium feature: £5/month extra

### 2. Multi-Account Support

- Business account + Personal account
- Separate tracking
- Cross-account transfers detected

### 3. Smart Categorization

- Learn from user's category choices
- Auto-categorize based on merchant
- HMRC category suggestions

### 4. Subscription Detection

- Identify recurring charges
- Alert: "Netflix £12.99 - mark as personal?"
- Annual review: "12 subscriptions costing £450/year"

### 5. Receipt Request Reminders

- WhatsApp/SMS integration
- "You spent £45 at Tesco today - photo receipt?"
- Gamification: "5-day receipt streak!"

### 6. Accountant Collaboration

- Share bank reconciliation with accountant
- They review and approve matches
- Billing: Add-on for £5/month

### 7. Xero Integration

- Push matched transactions to Xero
- Include receipt attachment
- Full automation loop

---

## Success Metrics

### KPIs to Track

**Adoption:**
- % of Professional users who upload statements
- Average statements per user per month

**Engagement:**
- Time spent on bank reconciliation page
- % of transactions reviewed
- Manual matches per user

**Value Delivered:**
- Average missing receipts found per user
- Total potential VAT unclaimed (£)
- Time saved vs manual reconciliation

**Conversion:**
- Free → Professional upgrades (attributed to feature)
- Feature mentioned in churn prevention saves

**Technical:**
- GPT extraction accuracy (% correct)
- Matching accuracy (precision & recall)
- Average processing time per statement

### Target Benchmarks (6 months)

- 40% of Professional users upload statements
- 75%+ extraction accuracy
- 65%+ automatic matching accuracy
- £500+ average unclaimed found per user
- 20+ Free → Professional conversions attributed

---

## Next Steps

### Immediate Actions (This Week)

1. **Review this plan** - Confirm approach and scope
2. **Design database schema** - Finalize tables
3. **Set up test data** - Get 3-5 real bank statement PDFs
4. **Create project branch** - `feature/bank-reconciliation`
5. **Write migration** - Create bank statement tables

### Sprint 1 (Week 1)

- [ ] Database migration
- [ ] File upload endpoint (no processing)
- [ ] Basic GPT extraction service
- [ ] Store transactions in database
- [ ] Simple admin view of transactions

### Sprint 2 (Week 2)

- [ ] Matching algorithm
- [ ] Frontend upload component
- [ ] Transaction table with filters
- [ ] Missing receipts summary

### Sprint 3 (Week 3)

- [ ] Manual match/unmatch
- [ ] Ignore transaction feature
- [ ] Dashboard widget
- [ ] Professional tier gating

### Sprint 4 (Week 4)

- [ ] Polish UI/UX
- [ ] Error handling
- [ ] Testing with real users
- [ ] Documentation
- [ ] Launch! 🚀

---

## Conclusion

This feature is a **strategic win**:

✅ Solves real pain (missed deductions)
✅ Low cost to build (2-3 weeks)
✅ Negligible operating cost (£0.0005/statement)
✅ High perceived value (saves hours + £££)
✅ Perfect monetization lever (Professional tier)
✅ Competitive moat (unique at this price point)
✅ No security baggage (vs Open Banking)
✅ Works with ALL banks

**ROI Estimate:**
- Investment: 20 days development
- Cost per user: £0.01/month
- Revenue per user: £12/month
- If 20% of 100 Free users upgrade = £240/month
- **Payback in first month**

This is the kind of feature that:
1. Gets users to upgrade
2. Keeps them subscribed
3. Generates word-of-mouth
4. Differentiates you from competitors

**Recommendation: Build it. Start next week.**

---

*Ready to begin implementation? Let's create the database migration first.*
