# Multi-Currency Implementation Guide

## Overview
This document outlines the strategy for implementing multi-currency support in ExpenseFlow, including data model changes, exchange rate handling, and analytics considerations.

---

## Design Decisions

### 1. Receipt-Level vs User-Level Currency

**Decision: Receipt-Level Currency** ✅

**Rationale:**
- Users travel and have international expenses
- Freelancers invoice in one currency but have expenses in another
- More flexible and realistic for real-world use cases
- User-level settings are too restrictive

**Implementation:**
- Store currency per receipt
- User sets **default currency** in settings (for new receipts)
- User sets **reporting currency** (for analytics conversion)

---

## Data Model Changes

### Receipt Model Additions
```python
class Receipt:
    # ... existing fields
    currency: str = 'GBP'  # ISO 4217 code (GBP, USD, EUR, etc.)
    amount: float  # Original amount in original currency
    
    # For analytics (optional, computed and cached)
    converted_amount: Optional[float] = None  # Amount in user's reporting currency
    exchange_rate: Optional[float] = None  # Rate used for conversion
    exchange_rate_date: Optional[datetime] = None  # When rate was fetched
```

### User Model Additions
```python
class User:
    # ... existing fields
    default_currency: str = 'GBP'  # Default for new receipts
    reporting_currency: str = 'GBP'  # For analytics/totals
```

---

## Currency Detection Flow

### Step 1: GPT Extraction
```python
# In OCR service
extracted_data = {
    'merchant': 'Starbucks',
    'amount': 4.50,
    'currency': 'GBP',  # GPT detects this from receipt
    'confidence': 0.95
}
```

### Step 2: Fallback Strategy
```python
def determine_currency(gpt_currency, user_default_currency, confidence):
    """
    Priority:
    1. GPT detected currency (if high confidence)
    2. User's default currency
    """
    if gpt_currency and confidence > 0.8:
        return gpt_currency
    return user_default_currency
```

### Step 3: Manual Correction
- Show currency in receipt detail view
- User can click to change: `GBP ▼` → dropdown with common currencies
- Re-save receipt with updated currency

---

## Exchange Rate Strategy

### Historical Rates vs Current Rates

**Decision: Use Historical Rates (Transaction Date)** ✅

**Why Historical Rates:**
- ✅ Stable analytics - totals never change
- ✅ Accurate for tax/accounting purposes (HMRC compliance)
- ✅ True expense value at time of purchase
- ✅ Reliable month-to-month comparisons
- ✅ Users can submit consistent expense reports

**Why NOT Current Rates:**
- ❌ Analytics change every day (confusing)
- ❌ Same data shows different totals at different times
- ❌ Not accurate for tax purposes
- ❌ Can't compare historical periods reliably

### Exchange Rate Service

**Recommended API: Frankfurter.app**
- Free, no API key needed
- Historical rates available
- Simple REST API
- Reliable uptime

```python
import requests
from datetime import datetime
from functools import lru_cache

@lru_cache(maxsize=100)
def get_exchange_rate(from_currency: str, to_currency: str, date: Optional[datetime] = None):
    """
    Get exchange rate, cached for 24 hours
    """
    if from_currency == to_currency:
        return 1.0
    
    # Use frankfurter.app (free, no key needed)
    date_str = date.strftime('%Y-%m-%d') if date else 'latest'
    url = f"https://api.frankfurter.app/{date_str}?from={from_currency}&to={to_currency}"
    
    try:
        response = requests.get(url, timeout=5)
        response.raise_for_status()
        data = response.json()
        return data['rates'][to_currency]
    except Exception as e:
        logger.error(f"Exchange rate fetch failed: {e}")
        # Fallback: return 1.0 or cached value
        return 1.0

# Production: Cache in Redis
# Key: f"exchange_rate:{from_currency}:{to_currency}:{date}"
# TTL: 24 hours for current rates, permanent for historical
```

---

## Analytics with Multiple Currencies

### Conversion Logic

```python
def get_monthly_totals(user, month):
    """
    Get monthly totals with multi-currency support
    """
    receipts = get_receipts_for_month(user, month)
    
    # Group by currency first
    by_currency = defaultdict(float)
    for receipt in receipts:
        by_currency[receipt.currency] += receipt.amount
    
    # Convert all to user's reporting currency
    total_in_reporting_currency = 0
    breakdown = []
    
    for currency, amount in by_currency.items():
        if currency == user.reporting_currency:
            converted = amount
            rate = 1.0
        else:
            # Use cached conversion if available
            rate = get_cached_or_fetch_rate(currency, user.reporting_currency)
            converted = amount * rate
        
        total_in_reporting_currency += converted
        breakdown.append({
            'currency': currency,
            'original_amount': amount,
            'converted_amount': converted,
            'rate': rate
        })
    
    return {
        'total': total_in_reporting_currency,
        'currency': user.reporting_currency,
        'breakdown': breakdown
    }
```

### Lazy Conversion with Caching

```python
def get_receipt_converted_amount(receipt, user):
    """
    Get converted amount with lazy evaluation and caching
    """
    # No conversion needed if same currency
    if receipt.currency == user.reporting_currency:
        return receipt.amount
    
    # Use cached conversion if available
    if receipt.converted_amount and receipt.exchange_rate_date == receipt.date:
        return receipt.converted_amount
    
    # Fetch historical rate for receipt date
    rate = get_exchange_rate(
        receipt.currency, 
        user.reporting_currency, 
        receipt.date
    )
    
    # Calculate and cache
    converted = receipt.amount * rate
    receipt.converted_amount = converted
    receipt.exchange_rate = rate
    receipt.exchange_rate_date = receipt.date
    db.commit()
    
    return converted
```

---

## UI/UX Implementation

### Receipt Detail View
```tsx
<div>
  <label>Amount</label>
  <div className="flex gap-2">
    <input 
      type="number" 
      value={amount} 
      onChange={handleAmountChange}
    />
    <select 
      value={currency} 
      onChange={handleCurrencyChange}
      className="w-24"
    >
      <option value="GBP">£ GBP</option>
      <option value="USD">$ USD</option>
      <option value="EUR">€ EUR</option>
      <option value="JPY">¥ JPY</option>
      <option value="CAD">$ CAD</option>
      <option value="AUD">$ AUD</option>
      {/* Add more as needed */}
    </select>
  </div>
  
  {/* Show converted amount if different currency */}
  {currency !== user.reporting_currency && (
    <p className="text-xs text-gray-500 mt-1">
      ≈ {getCurrencySymbol(user.reporting_currency)}
      {convertedAmount.toFixed(2)} {user.reporting_currency}
    </p>
  )}
</div>
```

### Settings Page - Currency Preferences
```tsx
<Card>
  <CardHeader>
    <CardTitle>💱 Currency Preferences</CardTitle>
  </CardHeader>
  <CardContent className="space-y-4">
    <div>
      <Label>Default Currency</Label>
      <Select value={defaultCurrency} onValueChange={setDefaultCurrency}>
        <option value="GBP">🇬🇧 British Pound (£)</option>
        <option value="USD">🇺🇸 US Dollar ($)</option>
        <option value="EUR">🇪🇺 Euro (€)</option>
        {/* More currencies */}
      </Select>
      <p className="text-xs text-gray-500 mt-1">
        New receipts will use this currency by default
      </p>
    </div>
    
    <div>
      <Label>Reporting Currency</Label>
      <Select value={reportingCurrency} onValueChange={setReportingCurrency}>
        {/* Same options */}
      </Select>
      <p className="text-xs text-gray-500 mt-1">
        All expenses will be converted to this currency in analytics
      </p>
    </div>
  </CardContent>
</Card>
```

### Dashboard Analytics Display
```tsx
<Card>
  <CardHeader>
    <CardTitle>January 2026 Total</CardTitle>
  </CardHeader>
  <CardContent>
    <div className="text-3xl font-bold mb-2">
      £1,250.50
    </div>
    <p className="text-xs text-gray-500 mb-4">
      Based on exchange rates at transaction dates
    </p>
    
    {/* Currency Breakdown */}
    <div className="space-y-2">
      <h4 className="text-sm font-semibold">Breakdown by Currency:</h4>
      <div className="space-y-1">
        <div className="flex justify-between text-sm">
          <span>🇬🇧 £800.00 GBP</span>
          <span className="text-gray-500">£800.00</span>
        </div>
        <div className="flex justify-between text-sm">
          <span>🇺🇸 $500.00 USD</span>
          <span className="text-gray-500">£400.50 @ 0.801</span>
        </div>
        <div className="flex justify-between text-sm">
          <span>🇪🇺 €60.00 EUR</span>
          <span className="text-gray-500">£50.00 @ 0.833</span>
        </div>
      </div>
    </div>
  </CardContent>
</Card>
```

---

## Implementation Phases

### Phase 1: Basic Support (MVP)
**Goal:** Store and display currency per receipt

1. Add `currency` field to Receipt model (default: 'GBP')
2. Create migration for database schema update
3. Update GPT prompt to extract currency from receipts
4. Store currency code with each receipt
5. Show currency symbol in receipt list (£, $, €)
6. Update receipt detail view to display currency

**Estimated effort:** 1-2 days

### Phase 2: User Preferences
**Goal:** Let users set currency defaults

1. Add `default_currency` and `reporting_currency` to User model
2. Create migration for user schema update
3. Add currency preferences section to settings page
4. Use default currency when creating new receipts
5. Validate currency codes (ISO 4217)

**Estimated effort:** 1 day

### Phase 3: Conversion & Analytics
**Goal:** Multi-currency analytics with conversion

1. Integrate exchange rate API (frankfurter.app)
2. Implement lazy conversion with caching
3. Add `converted_amount`, `exchange_rate` fields to Receipt
4. Update analytics to convert and aggregate across currencies
5. Show currency breakdown in dashboard
6. Cache exchange rates (Redis in production)
7. Handle API failures gracefully

**Estimated effort:** 2-3 days

### Phase 4: Polish & Features
**Goal:** Enhanced UX and edge cases

1. Currency selector on receipt edit page
2. Manual currency override functionality
3. Historical exchange rates (snapshot at upload time)
4. Multi-currency CSV export (both original + converted columns)
5. Currency symbols/flags in UI
6. Currency auto-detection improvements
7. Handle edge cases (rate API down, historical rates unavailable)
8. Add currency filter to receipt search

**Estimated effort:** 2-3 days

---

## Common Currencies to Support

### Tier 1 (Must Have)
- GBP (British Pound) - £
- USD (US Dollar) - $
- EUR (Euro) - €

### Tier 2 (Should Have)
- JPY (Japanese Yen) - ¥
- CAD (Canadian Dollar) - C$
- AUD (Australian Dollar) - A$
- CHF (Swiss Franc) - Fr
- CNY (Chinese Yuan) - ¥

### Tier 3 (Nice to Have)
- INR (Indian Rupee) - ₹
- SGD (Singapore Dollar) - S$
- HKD (Hong Kong Dollar) - HK$
- NZD (New Zealand Dollar) - NZ$
- SEK (Swedish Krona) - kr
- NOK (Norwegian Krone) - kr
- DKK (Danish Krone) - kr

---

## Edge Cases & Error Handling

### 1. Exchange Rate API Unavailable
```python
def get_exchange_rate_with_fallback(from_currency, to_currency, date):
    try:
        return get_exchange_rate(from_currency, to_currency, date)
    except Exception as e:
        logger.error(f"Exchange rate API failed: {e}")
        
        # Fallback 1: Check cache
        cached_rate = get_cached_rate(from_currency, to_currency)
        if cached_rate:
            logger.warning(f"Using cached rate: {cached_rate}")
            return cached_rate
        
        # Fallback 2: Return 1.0 and flag for manual review
        logger.error(f"No cached rate available, using 1.0")
        return 1.0
```

### 2. Currency Not Recognized by GPT
```python
# Use user's default currency
if not extracted_currency or extracted_currency not in SUPPORTED_CURRENCIES:
    currency = user.default_currency
```

### 3. Historical Rate Not Available
```python
# If historical rate for specific date unavailable, use nearest available date
if rate is None:
    # Try yesterday, day before, etc.
    for days_back in range(1, 8):
        alternate_date = receipt_date - timedelta(days=days_back)
        rate = get_exchange_rate(from_currency, to_currency, alternate_date)
        if rate:
            logger.warning(f"Using rate from {alternate_date} instead of {receipt_date}")
            break
```

### 4. User Changes Reporting Currency
```python
# When user changes reporting currency, invalidate all cached conversions
def update_reporting_currency(user, new_currency):
    user.reporting_currency = new_currency
    
    # Clear cached conversions (will be recalculated on next view)
    db.execute(
        "UPDATE receipts SET converted_amount = NULL, exchange_rate = NULL "
        "WHERE user_id = :user_id",
        {"user_id": user.id}
    )
    
    db.commit()
```

---

## Migration Script

```python
"""Add multi-currency support

Revision ID: add_multi_currency
Create Date: 2026-01-31
"""

from alembic import op
import sqlalchemy as sa

def upgrade():
    # Add currency fields to receipts table
    op.add_column('receipts', sa.Column('currency', sa.String(3), nullable=False, server_default='GBP'))
    op.add_column('receipts', sa.Column('converted_amount', sa.Float(), nullable=True))
    op.add_column('receipts', sa.Column('exchange_rate', sa.Float(), nullable=True))
    op.add_column('receipts', sa.Column('exchange_rate_date', sa.DateTime(), nullable=True))
    
    # Add currency preferences to users table
    op.add_column('users', sa.Column('default_currency', sa.String(3), nullable=False, server_default='GBP'))
    op.add_column('users', sa.Column('reporting_currency', sa.String(3), nullable=False, server_default='GBP'))
    
    # Create index for faster currency queries
    op.create_index('idx_receipts_currency', 'receipts', ['currency'])

def downgrade():
    op.drop_index('idx_receipts_currency', 'receipts')
    op.drop_column('receipts', 'exchange_rate_date')
    op.drop_column('receipts', 'exchange_rate')
    op.drop_column('receipts', 'converted_amount')
    op.drop_column('receipts', 'currency')
    op.drop_column('users', 'reporting_currency')
    op.drop_column('users', 'default_currency')
```

---

## Testing Checklist

### Unit Tests
- [ ] Currency detection from GPT response
- [ ] Fallback to default currency
- [ ] Exchange rate fetching and caching
- [ ] Currency conversion calculations
- [ ] Analytics aggregation across currencies
- [ ] Edge cases (API failures, invalid currencies)

### Integration Tests
- [ ] Create receipt with non-default currency
- [ ] Update user currency preferences
- [ ] View analytics with multiple currencies
- [ ] Export receipts with currency conversion
- [ ] Currency selector UI workflow

### Manual Testing
- [ ] Upload receipt in USD, verify GBP conversion
- [ ] Change reporting currency, verify recalculation
- [ ] Test with exchange rate API offline
- [ ] Verify historical rates stay consistent
- [ ] Test currency dropdown functionality
- [ ] Check mobile responsive design

---

## Future Enhancements

1. **Currency Trends**: Show exchange rate changes over time
2. **Multi-Currency Exports**: PDF reports with breakdown
3. **Budget by Currency**: Set budgets in multiple currencies
4. **Smart Currency Detection**: Learn from user patterns
5. **Cryptocurrency Support**: BTC, ETH (if demanded)
6. **Offline Mode**: Store rates locally for offline access
7. **Rate Alerts**: Notify when rates are favorable
8. **Custom Exchange Rates**: Manual override for specific transactions

---

## Resources

- **Frankfurter API**: https://www.frankfurter.app/
- **ISO 4217 Currency Codes**: https://en.wikipedia.org/wiki/ISO_4217
- **Exchange Rate API Alternatives**: 
  - exchangerate-api.com
  - currencyapi.com
  - fixer.io
- **HMRC Guidance**: https://www.gov.uk/government/publications/hmrc-exchange-rates-for-2026

---

## Decision Log

| Date | Decision | Rationale |
|------|----------|-----------|
| 2026-01-31 | Receipt-level currency | More flexible for international users |
| 2026-01-31 | Historical exchange rates | Stable analytics, tax compliance |
| 2026-01-31 | Frankfurter.app for rates | Free, reliable, no API key needed |
| 2026-01-31 | Lazy conversion with caching | Better performance, one-time calculation |

---

*Last updated: January 31, 2026*
