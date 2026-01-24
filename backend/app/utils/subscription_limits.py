"""
Subscription plan limits and enforcement
"""
from sqlalchemy.orm import Session
from sqlalchemy import func, extract
from datetime import datetime
from app.models.user import User
from app.models.receipt import Receipt
from app.models.mileage_claim import MileageClaim


# Plan limits - monthly limits
PLAN_LIMITS = {
    "free": {
        "receipts": 10,
        "mileage_claims": 5,
        "analytics_dashboard": False,
        "export_reports": False,
        "journey_templates": False,
        "advanced_ocr": False,
        "export_formats": [],  # No exports
        "support_level": "none"
    },
    "professional": {
        "receipts": 100,
        "mileage_claims": 50,
        "analytics_dashboard": True,
        "export_reports": True,
        "journey_templates": True,
        "advanced_ocr": True,
        "export_formats": ["csv"],
        "support_level": "email"
    },
    "pro_plus": {
        "receipts": 500,
        "mileage_claims": 200,
        "analytics_dashboard": True,
        "export_reports": True,
        "journey_templates": True,
        "advanced_ocr": True,
        "export_formats": ["csv", "pdf", "images"],
        "support_level": "priority"
    }
}


def get_monthly_receipt_count(user_id: int, db: Session) -> int:
    """
    Count receipts created this month for a user.
    Uses created_at to determine the month.
    """
    current_month = datetime.now().month
    current_year = datetime.now().year
    
    count = db.query(func.count(Receipt.id)).filter(
        Receipt.user_id == user_id,
        Receipt.deleted_at.is_(None),
        extract('month', Receipt.created_at) == current_month,
        extract('year', Receipt.created_at) == current_year
    ).scalar()
    
    return count or 0


def get_monthly_mileage_count(user_id: int, db: Session) -> int:
    """
    Count mileage claims created this month for a user.
    Uses created_at to determine the month.
    """
    current_month = datetime.now().month
    current_year = datetime.now().year
    
    count = db.query(func.count(MileageClaim.id)).filter(
        MileageClaim.user_id == user_id,
        MileageClaim.deleted_at.is_(None),
        extract('month', MileageClaim.created_at) == current_month,
        extract('year', MileageClaim.created_at) == current_year
    ).scalar()
    
    return count or 0


def check_receipt_limit(user: User, db: Session) -> tuple[bool, int, int]:
    """
    Check if user can create another receipt.
    
    Returns:
        (can_create, current_count, limit)
    """
    plan = user.subscription_plan or "free"
    limit = PLAN_LIMITS[plan]["receipts"]
    current_count = get_monthly_receipt_count(user.id, db)
    
    can_create = current_count < limit
    return can_create, current_count, limit


def check_mileage_limit(user: User, db: Session) -> tuple[bool, int, int]:
    """
    Check if user can create another mileage claim.
    
    Returns:
        (can_create, current_count, limit)
    """
    plan = user.subscription_plan or "free"
    limit = PLAN_LIMITS[plan]["mileage_claims"]
    current_count = get_monthly_mileage_count(user.id, db)
    
    can_create = current_count < limit
    return can_create, current_count, limit


def get_plan_limits(plan: str) -> dict:
    """
    Get the limits for a specific plan.
    """
    return PLAN_LIMITS.get(plan, PLAN_LIMITS["free"])


def can_access_feature(user: User, feature: str) -> bool:
    """
    Check if user's plan allows access to a specific feature.
    
    Features:
        - analytics_dashboard
        - export_reports
        - journey_templates
        - advanced_ocr
    
    Returns:
        bool - True if user can access the feature
    """
    plan = user.subscription_plan or "free"
    limits = PLAN_LIMITS.get(plan, PLAN_LIMITS["free"])
    return limits.get(feature, False)


def get_export_formats(user: User) -> list[str]:
    """
    Get available export formats for user's plan.
    
    Returns:
        List of format strings: ["csv", "pdf", "images"]
    """
    plan = user.subscription_plan or "free"
    limits = PLAN_LIMITS.get(plan, PLAN_LIMITS["free"])
    return limits.get("export_formats", [])
