# Duplicate Detection Feature

## Overview
Automatic duplicate detection system that flags receipts with identical vendor, amount, and date as possible duplicates.

## Implementation Details

### Algorithm: Exact Matching
- Compares: **vendor name**, **total amount**, **date**
- All three fields must match exactly
- Only checks within same user's receipts
- Ignores deleted receipts
- Simple and accurate - no false positives from fuzzy matching

### Database Schema
Added 3 new fields to `receipts` table:

```sql
duplicate_suspect INTEGER DEFAULT 0  -- 0=no, 1=possible duplicate
duplicate_of_id INTEGER REFERENCES receipts(id)  -- Points to original receipt
duplicate_dismissed INTEGER DEFAULT 0  -- 0=not reviewed, 1=user confirmed not duplicate
```

### Backend Components

**1. Service Layer** (`app/services/duplicate_detection.py`):
```python
def check_for_duplicates(receipt: Receipt, db: Session) -> bool
```
- Runs after OCR completes successfully
- Queries for exact matches (vendor, amount, date)
- Sets `duplicate_suspect=1` and `duplicate_of_id` if found
- Non-blocking: OCR succeeds even if duplicate check fails

**2. API Endpoint** (`app/api/v1/receipts.py`):
```
POST /api/v1/receipts/{id}/dismiss-duplicate
```
- User action: "This is not a duplicate"
- Sets `duplicate_dismissed=1`
- Returns updated receipt

**3. Schema Update** (`app/schemas/receipt.py`):
- Added duplicate fields to `ReceiptResponse`
- Frontend receives duplicate status with every receipt

### Frontend Components

**1. Receipt Card UI** (`app/dashboard/receipts/page.tsx`):
- Shows amber warning icon (AlertTriangle) when `duplicate_suspect=1 && duplicate_dismissed=0`
- Badge: "Possible duplicate - Review"
- "Not a duplicate" button to dismiss warning
- Warning appears after VAT amount, before deleted date

**2. API Client** (`lib/api.ts`):
```typescript
dismissDuplicate(token: string, id: number): Promise<Receipt>
```
- Calls backend endpoint
- Updates local state on success
- Shows toast notification

### User Experience Flow

1. **Upload Receipt**:
   - User uploads receipt image
   - OCR extracts vendor, amount, date
   - Duplicate check runs automatically
   - Receipt shows in list with warning (if duplicate)

2. **Review Warning**:
   - User sees amber AlertTriangle icon
   - Text: "Possible duplicate - Review"
   - User can click "Not a duplicate" button

3. **Dismiss Warning**:
   - Click triggers `dismissDuplicate()` API call
   - Warning disappears immediately
   - Toast confirms: "Duplicate dismissed"

4. **Keep or Delete**:
   - If actually duplicate: User deletes the receipt normally
   - If not duplicate: User dismisses warning and keeps both

### Performance Considerations

- **Non-blocking**: Duplicate check doesn't slow down OCR
- **Limited scope**: Only checks same user's receipts
- **Efficient query**: Uses indexed fields (user_id, vendor, total_amount, date)
- **One-time check**: Only runs once after OCR, not on every view

### Future Enhancements (Optional)

1. **Time Window**: Only check receipts from last 30 days
2. **Detailed Modal**: Show side-by-side comparison of original vs duplicate
3. **Auto-merge**: Option to automatically keep original and delete duplicate
4. **Fuzzy Matching**: Add optional fuzzy name matching for vendor variations
5. **Bulk Review**: Page to review all suspected duplicates at once

## Testing

### Manual Test Steps:

1. **Test Duplicate Detection**:
   ```
   1. Upload a receipt
   2. Wait for OCR to complete
   3. Upload same receipt again
   4. Second receipt should show warning
   ```

2. **Test Dismiss Function**:
   ```
   1. Find receipt with duplicate warning
   2. Click "Not a duplicate"
   3. Warning should disappear
   4. Refresh page - warning stays gone
   ```

3. **Test Edge Cases**:
   ```
   - Same vendor, different amount: No warning ✓
   - Same amount, different vendor: No warning ✓
   - Same vendor+amount, different date: No warning ✓
   - Exactly same all three: Warning ✓
   ```

### API Test with curl:

```bash
# Upload receipt (twice)
curl -X POST http://localhost:8000/api/v1/receipts/upload \
  -H "Authorization: Bearer $TOKEN" \
  -F "file=@receipt.jpg"

# Check duplicate status
curl http://localhost:8000/api/v1/receipts \
  -H "Authorization: Bearer $TOKEN" \
  | jq '.[] | select(.duplicate_suspect == 1)'

# Dismiss duplicate
curl -X POST http://localhost:8000/api/v1/receipts/123/dismiss-duplicate \
  -H "Authorization: Bearer $TOKEN"
```

## Migration

Applied migration: `9b984a6823ef_add_duplicate_detection_fields_to_receipts.py`

To rollback if needed:
```bash
cd backend
alembic downgrade -1
```

## Configuration

No configuration needed - works out of the box!

Default behavior:
- ✓ Enabled for all users
- ✓ Checks all receipts
- ✓ No false positives (exact matching)
- ✓ User can always dismiss warnings

## Monitoring

Watch for in logs:
- `"Receipt {id} flagged as possible duplicate"` - Duplicate found
- `"Duplicate detection failed for receipt {id}"` - Check error (non-critical)

## Cost Impact

**Zero additional cost** - uses existing database queries, no external APIs.

## Security

- ✓ Only checks user's own receipts (user_id filter)
- ✓ No cross-user data exposure
- ✓ Standard auth required for API endpoint

## Compliance

GDPR-compliant:
- Duplicate data deleted when original deleted
- Foreign key cascade on user deletion
- No PII in duplicate_of_id relationship
