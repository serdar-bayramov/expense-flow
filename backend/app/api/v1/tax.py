from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from app.core.database import get_db
from app.models.user import User
from app.api.deps import get_current_user
from pydantic import BaseModel

router = APIRouter()


class TaxCalculationRequest(BaseModel):
    income: float


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
    # Class 2: Automatically credited if profit >= £6,845 (no actual payment)
    class_2_ni = 0  # No longer charged - automatically credited
    
    # Class 4 NI
    lower_limit = 12570
    upper_limit = 50270
    
    if taxable_profit <= lower_limit:
        class_4_ni = 0
    elif taxable_profit <= upper_limit:
        # 6% on profits between £12,570 - £50,270
        class_4_ni = (taxable_profit - lower_limit) * 0.06
    else:
        # 6% up to upper limit, then 2% above
        class_4_ni = (upper_limit - lower_limit) * 0.06
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
    request: TaxCalculationRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Calculate tax liability for current user
    """
    # Get total expenses from receipts
    from app.models.receipt import Receipt
    from sqlalchemy import func
    
    total_expenses = db.query(func.coalesce(func.sum(Receipt.total_amount), 0)).filter(
        Receipt.user_id == current_user.id
    ).scalar()
    
    # Get total mileage
    from app.models.mileage_claim import MileageClaim
    
    total_miles = db.query(func.coalesce(func.sum(MileageClaim.distance_miles), 0)).filter(
        MileageClaim.user_id == current_user.id
    ).scalar()
    
    # Calculate tax
    result = calculate_uk_tax_liability(
        request.income, 
        float(total_expenses or 0), 
        float(total_miles or 0)
    )
    
    return result
