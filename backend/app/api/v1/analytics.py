from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from app.core.database import get_db, settings
from app.models.user import User
from app.api.deps import get_current_user
from datetime import datetime, timedelta, timezone
from collections import defaultdict
import openai
import json

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
    from app.models.mileage_claim import MileageClaim
    
    # Get receipts for analysis
    all_receipts = db.query(Receipt).filter(Receipt.user_id == current_user.id).all()
    
    # Get mileage claims
    all_mileage = db.query(MileageClaim).filter(MileageClaim.user_id == current_user.id).all()
    
    # Calculate metrics - convert all to float for consistency
    total_receipts = len(all_receipts)
    total_spent = float(sum(r.total_amount or 0 for r in all_receipts))
    total_vat = float(sum(r.tax_amount or 0 for r in all_receipts))
    
    # Get current month data - simplified datetime handling
    now = datetime.now(timezone.utc)
    first_day_this_month = datetime(now.year, now.month, 1, tzinfo=timezone.utc)
    first_day_last_month = (first_day_this_month - timedelta(days=1)).replace(day=1)
    
    # Filter receipts by month - handle both timezone-aware and naive dates
    def receipt_in_range(r, start, end=None):
        if not r.date:
            return False
        dt = r.date if r.date.tzinfo else r.date.replace(tzinfo=timezone.utc)
        return (dt >= start and (end is None or dt < end))
    
    this_month_receipts = [r for r in all_receipts if receipt_in_range(r, first_day_this_month)]
    last_month_receipts = [r for r in all_receipts if receipt_in_range(r, first_day_last_month, first_day_this_month)]
    
    this_month_spent = float(sum(r.total_amount or 0 for r in this_month_receipts))
    last_month_spent = float(sum(r.total_amount or 0 for r in last_month_receipts))
    
    # Category breakdown
    category_totals = defaultdict(float)
    for r in all_receipts:
        if r.category:
            category_totals[r.category.value] += float(r.total_amount or 0)
    
    top_categories = sorted(category_totals.items(), key=lambda x: x[1], reverse=True)[:3]
    
    # Mileage stats - convert Decimal to float
    total_miles = float(sum(float(c.distance_miles or 0) for c in all_mileage))
    mileage_allowance = float(sum(float(c.claim_amount or 0) for c in all_mileage))
    
    # Tax year progress
    tax_year_start = datetime(now.year if now.month >= 4 else now.year - 1, 4, 6, tzinfo=timezone.utc)
    days_into_tax_year = (now - tax_year_start).days
    
    # Average receipt amount
    avg_receipt = total_spent / total_receipts if total_receipts > 0 else 0
    
    # Build context for GPT
    context = {
        'total_receipts': total_receipts,
        'total_spent': round(total_spent, 2),
        'total_vat': round(total_vat, 2),
        'this_month_receipts': len(this_month_receipts),
        'this_month_spent': round(this_month_spent, 2),
        'last_month_receipts': len(last_month_receipts),
        'last_month_spent': round(last_month_spent, 2),
        'month_over_month_change': round(((this_month_spent - last_month_spent) / last_month_spent * 100) if last_month_spent > 0 else 0, 1),
        'top_categories': [(cat, round(amt, 2)) for cat, amt in top_categories],
        'total_miles': round(total_miles, 1),
        'mileage_allowance': round(mileage_allowance, 2),
        'days_into_tax_year': days_into_tax_year,
        'avg_receipt': round(avg_receipt, 2),
        'tax_deductions_saved': round((total_spent + mileage_allowance) * 0.20, 2)
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
        client = openai.OpenAI(api_key=settings.OPENAI_API_KEY)
        response = client.chat.completions.create(
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
        insights = json.loads(insights_text)
        
        return {
            'insights': insights,
            'context': context
        }
        
    except Exception as e:
        print(f"GPT insights error: {e}")
        # Fallback to template-based insights
        insights = []
        
        # Tax savings insight (always show if meaningful)
        if context['tax_deductions_saved'] > 500:
            insights.append(f"💰 You've saved approximately £{context['tax_deductions_saved']:.0f} in tax deductions so far. That's real money back in your pocket!")
        
        # Spending trends (only show if meaningful data)
        if context['this_month_spent'] > 0 and context['last_month_spent'] > 0:
            if context['month_over_month_change'] > 20:
                insights.append(f"📈 Your spending is up {context['month_over_month_change']:.0f}% this month (£{context['this_month_spent']:.2f} vs £{context['last_month_spent']:.2f}). Busy month?")
            elif context['month_over_month_change'] < -20:
                insights.append(f"📉 You spent {abs(context['month_over_month_change']):.0f}% less this month (£{context['this_month_spent']:.2f} vs £{context['last_month_spent']:.2f}). Great job managing costs!")
        
        # Tracking consistency
        if context['this_month_receipts'] > 10:
            insights.append(f"✅ Excellent tracking! You've logged {context['this_month_receipts']} receipts this month. You're capturing every deduction.")
        elif context['total_receipts'] > 5:
            insights.append(f"📝 You're tracking {context['total_receipts']} receipts overall. Keep it up to maximize your tax deductions!")
        
        # Category insights
        if context['top_categories']:
            top_cat, top_amount = context['top_categories'][0]
            insights.append(f"🏆 Your biggest expense category is {top_cat} at £{top_amount:.2f}. Make sure you're claiming all allowable deductions!")
        
        # Mileage insights
        if context['total_miles'] > 0:
            insights.append(f"🚗 You've claimed {context['total_miles']:.0f} miles worth £{context['mileage_allowance']:.2f}. Keep tracking your business journeys!")
        
        # Default if no insights
        if not insights:
            insights.append("👋 Welcome! Start tracking your expenses to unlock personalized insights about your spending and tax savings.")
        
        return {
            'insights': insights[:3],  # Limit to 3 insights
            'context': context
        }
