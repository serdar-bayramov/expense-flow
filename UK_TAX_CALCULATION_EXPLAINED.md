# UK Tax Calculation Explained (2025/26 Tax Year)

## Overview
This document explains how the Expense Flow app calculates UK tax liability for self-employed freelancers.

## Official UK Tax Rates (2025/26)

### Income Tax Bands
- **Personal Allowance**: £12,570 (tax-free)
- **Basic Rate (20%)**: £12,571 - £50,270
- **Higher Rate (40%)**: £50,271 - £125,140
- **Additional Rate (45%)**: £125,141+

### National Insurance (Self-Employed)
- **Class 2 NI**: £3.50 per week (£182/year) if profit ≥ £12,570
- **Class 4 NI**: 
  - 9% on profits between £12,570 - £50,270
  - 2% on profits above £50,270

### Mileage Allowance
- **First 10,000 miles**: 45p per mile
- **After 10,000 miles**: 25p per mile

---

## Step-by-Step Calculation

### Step 1: Calculate Mileage Allowance
```
If miles ≤ 10,000:
    Mileage Allowance = miles × £0.45

If miles > 10,000:
    Mileage Allowance = (10,000 × £0.45) + ((miles - 10,000) × £0.25)
```

### Step 2: Calculate Taxable Profit
```
Taxable Profit = Income - Expenses - Mileage Allowance
```

### Step 3: Calculate Income Tax

**Remove Personal Allowance:**
```
Taxable Income = Taxable Profit - £12,570
```

**Apply Tax Bands:**

If `Taxable Income ≤ 0`:
```
Income Tax = £0
```

If `Taxable Income ≤ £37,700` (Basic Rate only):
```
Income Tax = Taxable Income × 20%
```

If `Taxable Income ≤ £112,570` (Basic + Higher Rate):
```
Basic Band = £37,700 × 20% = £7,540
Higher Band = (Taxable Income - £37,700) × 40%
Income Tax = £7,540 + Higher Band
```

If `Taxable Income > £112,570` (All three rates):
```
Basic Band = £37,700 × 20% = £7,540
Higher Band = £74,870 × 40% = £29,948
Additional Band = (Taxable Income - £112,570) × 45%
Income Tax = £7,540 + £29,948 + Additional Band
```

### Step 4: Calculate Class 2 National Insurance
```
If Taxable Profit ≥ £12,570:
    Class 2 NI = £3.50 × 52 weeks = £182.00
Else:
    Class 2 NI = £0
```

### Step 5: Calculate Class 4 National Insurance

If `Taxable Profit ≤ £12,570`:
```
Class 4 NI = £0
```

If `£12,570 < Taxable Profit ≤ £50,270`:
```
Class 4 NI = (Taxable Profit - £12,570) × 9%
```

If `Taxable Profit > £50,270`:
```
Lower Band = (£50,270 - £12,570) × 9% = £3,393.00
Upper Band = (Taxable Profit - £50,270) × 2%
Class 4 NI = £3,393.00 + Upper Band
```

### Step 6: Calculate Total Tax
```
Total Tax = Income Tax + Class 2 NI + Class 4 NI
```

---

## Example Calculation

**Scenario:**
- Annual Income: £45,000
- Tracked Expenses: £6,000
- Mileage: 3,000 miles

### Step 1: Mileage Allowance
```
3,000 miles × £0.45 = £1,350
```

### Step 2: Taxable Profit
```
£45,000 - £6,000 - £1,350 = £37,650
```

### Step 3: Income Tax
```
Taxable Income = £37,650 - £12,570 = £25,080

Since £25,080 ≤ £37,700 (Basic Rate only):
Income Tax = £25,080 × 20% = £5,016.00
```

### Step 4: Class 2 NI
```
Profit £37,650 ≥ £12,570
Class 2 NI = £3.50 × 52 = £182.00
```

### Step 5: Class 4 NI
```
Profit £37,650 is between £12,570 and £50,270
Class 4 NI = (£37,650 - £12,570) × 9% = £2,257.20
```

### Step 6: Total Tax
```
Total Tax = £5,016.00 + £182.00 + £2,257.20 = £7,455.20
```

### Additional Metrics
```
Monthly Savings Needed = £7,455.20 ÷ 12 = £621.27
Effective Tax Rate = (£7,455.20 ÷ £45,000) × 100 = 16.57%
Tax Saved by Tracking = (£6,000 + £1,350) × 20% = £1,470.00
```

---

## Example 2: High Earner Calculation

**Scenario:**
- Annual Income: £600,000
- Tracked Expenses: £40,000
- Mileage: 5,000 miles

### Step 1: Mileage Allowance
```
5,000 miles × £0.45 = £2,250
```

### Step 2: Taxable Profit
```
£600,000 - £40,000 - £2,250 = £557,750
```

### Step 3: Income Tax
```
Taxable Income = £557,750 - £12,570 = £545,180

Since £545,180 > £112,570 (All three rates apply):
Basic Band = £37,700 × 20% = £7,540.00
Higher Band = £74,870 × 40% = £29,948.00
Additional Band = (£545,180 - £112,570) × 45% = £432,610 × 45% = £194,674.50

Income Tax = £7,540.00 + £29,948.00 + £194,674.50 = £232,162.50
```

### Step 4: Class 2 NI
```
Profit £557,750 ≥ £12,570
Class 2 NI = £3.50 × 52 = £182.00
```

### Step 5: Class 4 NI
```
Profit £557,750 is above £50,270
Lower Band = (£50,270 - £12,570) × 9% = £3,393.00
Upper Band = (£557,750 - £50,270) × 2% = £507,480 × 2% = £10,149.60
Class 4 NI = £3,393.00 + £10,149.60 = £13,542.60
```

### Step 6: Total Tax
```
Total Tax = £232,162.50 + £182.00 + £13,542.60 = £245,887.10
```

### Additional Metrics
```
Monthly Savings Needed = £245,887.10 ÷ 12 = £20,490.59
Effective Tax Rate = (£245,887.10 ÷ £600,000) × 100 = 40.98%
Tax Saved by Tracking = (£40,000 + £2,250) × 45% = £19,012.50
```

**Key Insight for High Earners:**  
At the 45% tax band, every £1,000 in tracked expenses saves:
- **£450** in Income Tax (45% additional rate)
- **£20** in Class 4 NI (2% upper band)
- **Total: £470 saved per £1,000 tracked** 💰

---

## Your Calculation Breakdown

Based on your result of **£3,376.86 Income Tax**:

**Reverse Engineering Your Numbers:**

If Income Tax = £3,376.86, working backwards:
```
£3,376.86 ÷ 20% = £16,884.30 taxable income (after personal allowance)

Taxable Profit = £16,884.30 + £12,570 = £29,454.30
```

This suggests your actual taxable profit (after expenses and mileage deductions) is approximately **£29,454**.

**Your Class 2 NI:**
```
£182.00 = £3.50 × 52 weeks ✓
(You qualify because profit > £12,570)
```

**Your Class 4 NI:**
```
(£29,454 - £12,570) × 9% = £1,519.56
```

---

## Why This Matters

Every £1,000 in tracked expenses saves you approximately:
- **£200** in Income Tax (20% basic rate)
- **£90** in Class 4 NI (9%)
- **Total: £290 saved**

**Keep tracking your expenses!** 📊

---

## Important Notes

⚠️ **This is an estimate only** - not professional tax advice  
⚠️ Assumes you're self-employed as a sole trader  
⚠️ Doesn't include student loan repayments or pension contributions  
⚠️ Always consult with an accountant for your actual tax return  

---

## Sources

- [HMRC Self Assessment Tax Rates 2025/26](https://www.gov.uk/income-tax-rates)
- [HMRC National Insurance Rates](https://www.gov.uk/self-employed-national-insurance-rates)
- [HMRC Approved Mileage Rates](https://www.gov.uk/expenses-if-youre-self-employed)
