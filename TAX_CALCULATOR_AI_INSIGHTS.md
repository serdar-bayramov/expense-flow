# Tax Calculator & AI Insights Implementation

## Overview
Add intelligent tax liability calculator and AI-powered insights to dashboard analytics to show users the real value of expense tracking.

---

## Features to Add

### 1. Tax Liability Calculator

**Location:** Dashboard page - New card after mileage stats

**User Flow:**
1. User enters estimated annual income
2. System calculates:
   - Total deductions (receipts + mileage)
   - Taxable profit
   - Income Tax
   - Class 2 & 4 National Insurance
   - Total tax liability
   - Monthly savings recommendation
3. Highlight "You've saved £X in deductions"

**Data Needed:**
- Annual income (user input, stored in preferences)
- Total expenses (from receipts)
- Total mileage allowance (from mileage claims)

---

### 2. AI-Powered Insights

**Location:** Dashboard page - New "Insights" card at top (after stats cards)

**What GPT Analyzes:**
- Total spending trends
- Category breakdown
- Month-over-month changes
- Receipt tracking frequency
- Average receipt amount
- Tax year progress
- Mileage patterns
- Missed opportunities (common deductions)

**Insight Types:**

#### **Trend Analysis**
```
"Your spending is up 25% this month (£1,200 vs £960). 
Mostly from travel expenses - busy month on the road?"
```

#### **Positive Reinforcement**
```
"Excellent! You've tracked 47 receipts this month. 
You're on track to capture every deduction."
```

#### **Tax Savings Highlight**
```
"You've saved approximately £2,840 in tax deductions so far. 
That's real money back in your pocket!"
```

#### **Smart Recommendations**
```
"You spent £450 on equipment this quarter. Did you know 
you can claim 100% of equipment costs under £1,000 as Annual Investment Allowance?"
```

#### **Deadline Reminders**
```
"Tax year ends in 2 months. You're at 1,200 miles claimed - 
if you hit 10,000 miles, you'll save £4,500 at 45p/mile."
```

---

## Technical Implementation

### Backend: Tax Calculation Endpoint

**File:** `backend/app/api/v1/tax.py` (new)

```python
from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from app.core.database import get_db
from app.models.user import User
from app.dependencies.auth import get_current_user
from datetime import datetime

router = APIRouter()

def calculate_uk_tax_liability(income: float, expenses: float, mileage_miles: float):
    """
    Calculate UK tax liability for 2025/26 tax year
    Returns breakdown of Income Tax and National Insurance
    """
    
    # Mileage allowance (45p first 10k miles, 25p after)
    if mileage_miles <= 10000:
        mileage_allowance = mileage_miles * 0.45
    else:
        mileage_allowance = (10000 * 0.45) + ((mileage_miles - 10000) * 0.25)
    
    # Taxable profit
    taxable_profit = max(0, income - expenses - mileage_allowance)
    
    # Income Tax calculation (2025/26 rates)
    personal_allowance = 12570
    basic_rate_limit = 50270
    higher_rate_limit = 125140
    
    taxable_income = max(0, taxable_profit - personal_allowance)
    
    if taxable_income <= 0:
        income_tax = 0
    elif taxable_income <= (basic_rate_limit - personal_allowance):
        # Basic rate: 20%
        income_tax = taxable_income * 0.20
    elif taxable_income <= (higher_rate_limit - personal_allowance):
        # Basic + Higher (40%)
        basic = (basic_rate_limit - personal_allowance) * 0.20
        higher = (taxable_income - (basic_rate_limit - personal_allowance)) * 0.40
        income_tax = basic + higher
    else:
        # Basic + Higher + Additional (45%)
        basic = (basic_rate_limit - personal_allowance) * 0.20
        higher = (higher_rate_limit - basic_rate_limit) * 0.40
        additional = (taxable_income - (higher_rate_limit - personal_allowance)) * 0.45
        income_tax = basic + higher + additional
    
    # National Insurance calculation (Self-Employed 2025/26)
    class_2_weekly = 3.50
    weeks_per_year = 52
    class_2_threshold = 12570
    
    if taxable_profit >= class_2_threshold:
        class_2_ni = class_2_weekly * weeks_per_year  # £182
    else:
        class_2_ni = 0
    
    # Class 4 NI
    lower_limit = 12570
    upper_limit = 50270
    
    if taxable_profit <= lower_limit:
        class_4_ni = 0
    elif taxable_profit <= upper_limit:
        # 9% on profits between £12,570 - £50,270
        class_4_ni = (taxable_profit - lower_limit) * 0.09
    else:
        # 9% up to upper limit, then 2% above
        class_4_ni = (upper_limit - lower_limit) * 0.09
        class_4_ni += (taxable_profit - upper_limit) * 0.02
    
    total_tax = income_tax + class_2_ni + class_4_ni
    
    return {
        'income': income,
        'expenses': expenses,
        'mileage_miles': mileage_miles,
        'mileage_allowance': round(mileage_allowance, 2),
        'total_deductions': round(expenses + mileage_allowance, 2),
        'taxable_profit': round(taxable_profit, 2),
        'income_tax': round(income_tax, 2),
        'class_2_ni': round(class_2_ni, 2),
        'class_4_ni': round(class_4_ni, 2),
        'total_ni': round(class_2_ni + class_4_ni, 2),
        'total_tax': round(total_tax, 2),
        'monthly_savings_needed': round(total_tax / 12, 2),
        'effective_tax_rate': round((total_tax / income * 100) if income > 0 else 0, 2),
        'deductions_saved_tax': round((expenses + mileage_allowance) * 0.20, 2)  # Rough estimate at 20% basic rate
    }

@router.post("/calculate")
async def calculate_tax(
    income: float,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Calculate tax liability for current user
    """
    # Get total expenses from receipts
    from app.models.receipt import Receipt
    receipts = db.query(Receipt).filter(Receipt.user_id == current_user.id).all()
    total_expenses = sum(r.total_amount or 0 for r in receipts)
    
    # Get total mileage
    from app.models.mileage import MileageClaim
    claims = db.query(MileageClaim).filter(MileageClaim.user_id == current_user.id).all()
    total_miles = sum(c.distance for c in claims)
    
    # Calculate tax
    result = calculate_uk_tax_liability(income, total_expenses, total_miles)
    
    # Save income to user preferences (for future use)
    current_user.estimated_annual_income = income
    db.commit()
    
    return result
```

**Register Route:**
`backend/app/main.py`:
```python
from app.api.v1 import tax

app.include_router(tax.router, prefix="/api/v1/tax", tags=["tax"])
```

---

### Backend: AI Insights Endpoint

**File:** `backend/app/api/v1/analytics.py` (enhance existing or create new)

```python
from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from app.core.database import get_db, settings
from app.models.user import User
from app.dependencies.auth import get_current_user
from datetime import datetime, timedelta
from collections import defaultdict
import openai

router = APIRouter()

@router.get("/insights")
async def get_ai_insights(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Generate AI-powered insights about user's spending patterns
    """
    from app.models.receipt import Receipt
    from app.models.mileage import MileageClaim
    
    # Get receipts for analysis
    all_receipts = db.query(Receipt).filter(Receipt.user_id == current_user.id).all()
    
    # Get mileage claims
    all_mileage = db.query(MileageClaim).filter(MileageClaim.user_id == current_user.id).all()
    
    # Calculate metrics for GPT
    total_receipts = len(all_receipts)
    total_spent = sum(r.total_amount or 0 for r in all_receipts)
    total_vat = sum(r.tax_amount or 0 for r in all_receipts)
    
    # Get current month data
    now = datetime.now()
    first_day_this_month = datetime(now.year, now.month, 1)
    first_day_last_month = (first_day_this_month - timedelta(days=1)).replace(day=1)
    
    this_month_receipts = [r for r in all_receipts if r.date and datetime.fromisoformat(str(r.date)) >= first_day_this_month]
    last_month_receipts = [r for r in all_receipts if r.date and first_day_last_month <= datetime.fromisoformat(str(r.date)) < first_day_this_month]
    
    this_month_spent = sum(r.total_amount or 0 for r in this_month_receipts)
    last_month_spent = sum(r.total_amount or 0 for r in last_month_receipts)
    
    # Category breakdown
    category_totals = defaultdict(float)
    for r in all_receipts:
        if r.category:
            category_totals[r.category] += (r.total_amount or 0)
    
    top_categories = sorted(category_totals.items(), key=lambda x: x[1], reverse=True)[:3]
    
    # Mileage stats
    total_miles = sum(c.distance for c in all_mileage)
    mileage_allowance = sum(c.amount_claimed for c in all_mileage)
    
    # Tax year progress
    tax_year_start = datetime(now.year if now.month >= 4 else now.year - 1, 4, 6)
    days_into_tax_year = (now - tax_year_start).days
    
    # Average receipt amount
    avg_receipt = total_spent / total_receipts if total_receipts > 0 else 0
    
    # Build context for GPT
    context = {
        'total_receipts': total_receipts,
        'total_spent': total_spent,
        'total_vat': total_vat,
        'this_month_receipts': len(this_month_receipts),
        'this_month_spent': this_month_spent,
        'last_month_receipts': len(last_month_receipts),
        'last_month_spent': last_month_spent,
        'month_over_month_change': ((this_month_spent - last_month_spent) / last_month_spent * 100) if last_month_spent > 0 else 0,
        'top_categories': top_categories,
        'total_miles': total_miles,
        'mileage_allowance': mileage_allowance,
        'days_into_tax_year': days_into_tax_year,
        'avg_receipt': avg_receipt,
        'tax_deductions_saved': (total_spent + mileage_allowance) * 0.20  # Rough 20% basic rate estimate
    }
    
    # Generate insights with GPT
    prompt = f"""You are a friendly, encouraging financial assistant for freelancers in the UK. 
Analyze these expense tracking stats and provide 2-3 short, actionable insights (1-2 sentences each).

User's Stats:
- Total receipts tracked: {context['total_receipts']}
- Total spent: £{context['total_spent']:.2f}
- This month: {context['this_month_receipts']} receipts, £{context['this_month_spent']:.2f}
- Last month: {context['last_month_receipts']} receipts, £{context['last_month_spent']:.2f}
- Change: {context['month_over_month_change']:.1f}%
- Top categories: {', '.join([f'{cat}: £{amt:.2f}' for cat, amt in context['top_categories']])}
- Mileage: {context['total_miles']:.0f} miles, £{context['mileage_allowance']:.2f} claimed
- Tax deductions saved (estimate): £{context['tax_deductions_saved']:.2f}
- Average receipt: £{context['avg_receipt']:.2f}
- Days into tax year: {context['days_into_tax_year']}

Rules:
1. Be encouraging and positive
2. Focus on tax savings and value
3. Give 2-3 insights only
4. Keep each insight to 1-2 sentences
5. Use specific numbers from their data
6. If spending is up, be curious not judgmental
7. Highlight good tracking habits
8. Suggest optimizations where relevant

Format as JSON array of strings: ["insight1", "insight2", "insight3"]
"""
    
    try:
        openai.api_key = settings.OPENAI_API_KEY
        response = openai.chat.completions.create(
            model="gpt-4o-mini",
            messages=[
                {"role": "system", "content": "You are a helpful financial assistant for UK freelancers."},
                {"role": "user", "content": prompt}
            ],
            temperature=0.7,
            max_tokens=300
        )
        
        insights_text = response.choices[0].message.content.strip()
        
        # Parse JSON response
        import json
        insights = json.loads(insights_text)
        
        return {
            'insights': insights,
            'context': context
        }
        
    except Exception as e:
        print(f"GPT insights error: {e}")
        # Fallback to template-based insights
        insights = []
        
        if context['tax_deductions_saved'] > 1000:
            insights.append(f"Great news! You've saved approximately £{context['tax_deductions_saved']:.0f} in tax deductions this year. That's real money back in your pocket.")
        
        if context['month_over_month_change'] > 20:
            insights.append(f"Your spending is up {context['month_over_month_change']:.0f}% this month (£{context['this_month_spent']:.2f} vs £{context['last_month_spent']:.2f}). Busy month?")
        elif context['month_over_month_change'] < -20:
            insights.append(f"You spent {abs(context['month_over_month_change']):.0f}% less this month. Nice job keeping costs down!")
        
        if context['this_month_receipts'] > 10:
            insights.append(f"Excellent tracking! You've logged {context['this_month_receipts']} receipts this month. You're capturing every deduction.")
        
        return {
            'insights': insights if insights else ["Keep tracking your expenses to see personalized insights here!"],
            'context': context
        }
```

---

### Frontend: Tax Calculator Component

**File:** `frontend/components/tax-calculator.tsx` (new)

```tsx
'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { AlertTriangle, TrendingDown, Calculator } from 'lucide-react';
import { useAuth } from '@clerk/nextjs';

interface TaxResult {
  income: number;
  expenses: number;
  mileage_miles: number;
  mileage_allowance: number;
  total_deductions: number;
  taxable_profit: number;
  income_tax: number;
  class_2_ni: number;
  class_4_ni: number;
  total_ni: number;
  total_tax: number;
  monthly_savings_needed: number;
  effective_tax_rate: number;
  deductions_saved_tax: number;
}

export function TaxCalculator() {
  const { getToken } = useAuth();
  const [income, setIncome] = useState<string>('45000');
  const [calculating, setCalculating] = useState(false);
  const [result, setResult] = useState<TaxResult | null>(null);

  useEffect(() => {
    const timer = setTimeout(() => {
      if (income && parseFloat(income) > 0) {
        calculateTax();
      }
    }, 1000); // Debounce 1 second

    return () => clearTimeout(timer);
  }, [income]);

  const calculateTax = async () => {
    try {
      setCalculating(true);
      const token = await getToken();
      if (!token) return;

      const response = await fetch('/api/v1/tax/calculate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ income: parseFloat(income) })
      });

      if (!response.ok) throw new Error('Calculation failed');

      const data = await response.json();
      setResult(data);
    } catch (error) {
      console.error('Tax calculation error:', error);
    } finally {
      setCalculating(false);
    }
  };

  return (
    <Card className="border-2 border-green-200 dark:border-green-800">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Calculator className="h-5 w-5 text-green-600" />
          Estimated Tax Impact
        </CardTitle>
        <CardDescription>
          See how your expense tracking saves you money
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Income Input */}
        <div>
          <Label htmlFor="income">Estimated Annual Income (£)</Label>
          <Input
            id="income"
            type="number"
            value={income}
            onChange={(e) => setIncome(e.target.value)}
            placeholder="45000"
            className="text-lg"
          />
        </div>

        {result && (
          <>
            {/* Tax Savings Highlight */}
            <div className="bg-green-50 dark:bg-green-900/20 p-4 rounded-lg border-2 border-green-300 dark:border-green-700">
              <div className="flex items-start gap-3">
                <TrendingDown className="h-6 w-6 text-green-600 dark:text-green-400 mt-1 flex-shrink-0" />
                <div>
                  <h4 className="font-bold text-lg text-green-900 dark:text-green-100">
                    You've saved approximately £{result.deductions_saved_tax.toFixed(0)} in tax
                  </h4>
                  <p className="text-sm text-green-800 dark:text-green-200 mt-1">
                    By tracking £{result.total_deductions.toFixed(2)} in deductions
                  </p>
                </div>
              </div>
            </div>

            {/* Deductions Summary */}
            <div className="bg-gray-50 dark:bg-gray-800 p-4 rounded space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-gray-600 dark:text-gray-300">Income:</span>
                <span className="font-semibold">£{result.income.toFixed(2)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600 dark:text-gray-300">Expenses:</span>
                <span className="font-semibold">-£{result.expenses.toFixed(2)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600 dark:text-gray-300">
                  Mileage ({result.mileage_miles.toFixed(0)} miles):
                </span>
                <span className="font-semibold">-£{result.mileage_allowance.toFixed(2)}</span>
              </div>
              <div className="flex justify-between border-t pt-2 text-base">
                <span className="font-semibold">Taxable Profit:</span>
                <span className="font-bold">£{result.taxable_profit.toFixed(2)}</span>
              </div>
            </div>

            {/* Tax Breakdown */}
            <div className="border-t pt-4 space-y-2">
              <h4 className="font-semibold text-sm text-gray-700 dark:text-gray-300 mb-3">
                Estimated Tax Liability (2025/26):
              </h4>
              <div className="flex justify-between text-sm">
                <span className="text-gray-600 dark:text-gray-300">Income Tax:</span>
                <span>£{result.income_tax.toFixed(2)}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-gray-600 dark:text-gray-300">Class 2 NI:</span>
                <span>£{result.class_2_ni.toFixed(2)}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-gray-600 dark:text-gray-300">Class 4 NI:</span>
                <span>£{result.class_4_ni.toFixed(2)}</span>
              </div>
              <div className="flex justify-between font-bold text-lg border-t pt-2">
                <span>Total Tax Due:</span>
                <span className="text-red-600 dark:text-red-400">£{result.total_tax.toFixed(2)}</span>
              </div>
              <div className="flex justify-between text-sm text-gray-600 dark:text-gray-400">
                <span>Effective Rate:</span>
                <span>{result.effective_tax_rate.toFixed(1)}%</span>
              </div>
            </div>

            {/* Helpful Tip */}
            <div className="bg-blue-50 dark:bg-blue-900/20 p-3 rounded text-sm border border-blue-200 dark:border-blue-800">
              <p className="font-semibold text-blue-900 dark:text-blue-100 mb-1">💡 Pro Tip:</p>
              <p className="text-blue-800 dark:text-blue-200">
                Save <span className="font-bold">£{result.monthly_savings_needed.toFixed(2)}/month</span> to cover your tax bill (due by 31 Jan)
              </p>
            </div>
          </>
        )}

        {/* Disclaimer */}
        <Alert>
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle>Important</AlertTitle>
          <AlertDescription className="text-xs">
            This is an estimate only, not tax advice. Your actual tax liability may differ based on other income,
            allowances, and circumstances. Consult an accountant or use HMRC's official calculator for accurate figures.
          </AlertDescription>
        </Alert>
      </CardContent>
    </Card>
  );
}
```

---

### Frontend: AI Insights Component

**File:** `frontend/components/ai-insights.tsx` (new)

```tsx
'use client';

import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Sparkles, Loader2 } from 'lucide-react';
import { useAuth } from '@clerk/nextjs';

interface Insight {
  insights: string[];
  context: any;
}

export function AIInsights() {
  const { getToken } = useAuth();
  const [insights, setInsights] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchInsights();
  }, []);

  const fetchInsights = async () => {
    try {
      setLoading(true);
      const token = await getToken();
      if (!token) return;

      const response = await fetch('/api/v1/analytics/insights', {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (!response.ok) throw new Error('Failed to fetch insights');

      const data: Insight = await response.json();
      setInsights(data.insights);
    } catch (error) {
      console.error('Failed to fetch insights:', error);
      setInsights(["Keep tracking expenses to unlock personalized insights!"]);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <Card className="border-2 border-purple-200 dark:border-purple-800 bg-gradient-to-br from-purple-50 to-blue-50 dark:from-purple-900/20 dark:to-blue-900/20">
        <CardContent className="pt-6">
          <div className="flex items-center justify-center gap-2 text-purple-600 dark:text-purple-400">
            <Loader2 className="h-5 w-5 animate-spin" />
            <span className="text-sm">Analyzing your expenses...</span>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="border-2 border-purple-200 dark:border-purple-800 bg-gradient-to-br from-purple-50 to-blue-50 dark:from-purple-900/20 dark:to-blue-900/20">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Sparkles className="h-5 w-5 text-purple-600 dark:text-purple-400" />
          <span className="bg-gradient-to-r from-purple-600 to-blue-600 bg-clip-text text-transparent">
            AI Insights
          </span>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          {insights.map((insight, index) => (
            <div 
              key={index}
              className="p-3 bg-white/60 dark:bg-gray-800/60 rounded-lg border border-purple-200 dark:border-purple-700"
            >
              <p className="text-sm text-gray-800 dark:text-gray-200">
                {insight}
              </p>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
```

---

### Frontend: Integration into Dashboard

**File:** `frontend/app/dashboard/page.tsx`

**Changes needed:**

```tsx
import { TaxCalculator } from '@/components/tax-calculator';
import { AIInsights } from '@/components/ai-insights';

// After stats cards, add:
<AIInsights />

// After mileage stats, add:
<TaxCalculator />
```

---

## User Model Update

**Add field to User model:**

```python
# backend/app/models/user.py
class User(Base):
    # ... existing fields
    estimated_annual_income: Optional[float] = None  # For tax calculations
```

**Migration:**
```bash
cd backend
alembic revision -m "add estimated_annual_income to users"
# Edit migration file to add column
alembic upgrade head
```

---

## Testing Checklist

### Backend Tests:
- [ ] Tax calculation with various incomes
- [ ] Mileage rate changes at 10k miles
- [ ] National Insurance thresholds
- [ ] Income Tax bands
- [ ] Edge cases (£0 income, negative profit)

### Frontend Tests:
- [ ] Tax calculator updates on income change
- [ ] Insights load and display correctly
- [ ] Loading states work
- [ ] Responsive on mobile
- [ ] Dark mode support

### Integration Tests:
- [ ] Calculate tax with real user data
- [ ] GPT insights generation
- [ ] Fallback insights when GPT fails
- [ ] API error handling

---

## Timeline Estimate

**Day 1:**
- Backend tax calculation endpoint (4 hours)
- User model update + migration (1 hour)
- Frontend tax calculator component (3 hours)

**Day 2:**
- Backend AI insights endpoint (4 hours)
- Frontend AI insights component (2 hours)
- Integration into dashboard (1 hour)
- Testing & bug fixes (1 hour)

**Total: 16 hours / 2 days**

---

## Success Metrics

**User Engagement:**
- % of users who enter income (conversion to using calculator)
- Time spent on dashboard page
- Return visits to check insights

**Value Perception:**
- User feedback on "WOW" factor
- Sharing of insights (future: social share buttons)
- Conversion from free to paid (after seeing tax savings)

**Technical:**
- GPT API success rate
- Average insight generation time
- Tax calculation accuracy vs HMRC calculator

---

## Future Enhancements

1. **Historical Insights**: Compare this month to last year
2. **Category Insights**: "You spent £200 on coffee. Switch to home brew = £1,800/year saved"
3. **Predictive**: "At this rate, you'll spend £14k this year"
4. **Benchmarking**: "Similar freelancers average £300/month on travel"
5. **Tax Planning**: "Contribute £X to pension to reduce tax by £Y"
6. **Export Insights**: PDF report with insights
7. **Insight History**: Track insights over time

---

*Implementation Date: January 31, 2026*
