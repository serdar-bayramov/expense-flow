"""
Duplicate detection service for receipts
"""
from sqlalchemy.orm import Session
from sqlalchemy import func, cast, Date
from datetime import datetime, timedelta
from app.models.receipt import Receipt


def check_for_duplicates(receipt: Receipt, db: Session) -> bool:
    """
    Check if receipt might be a duplicate of an existing receipt.
    Uses exact matching: same merchant, amount, and date.
    
    Args:
        receipt: The receipt to check
        db: Database session
        
    Returns:
        bool: True if potential duplicate found and flagged, False otherwise
    """
    # Only check if receipt has required fields
    if not receipt.vendor or not receipt.total_amount or not receipt.date:
        return False
    
    # Extract just the date portion (ignore time) for comparison
    receipt_date = receipt.date.date() if receipt.date else None
    if not receipt_date:
        return False
    
    # Find potential duplicates: same user, not deleted, not this receipt
    # Compare dates without time component
    potential_duplicates = db.query(Receipt).filter(
        Receipt.user_id == receipt.user_id,
        Receipt.id != receipt.id,
        Receipt.deleted_at.is_(None),
        Receipt.vendor == receipt.vendor,  # Exact merchant match
        Receipt.total_amount == receipt.total_amount,  # Exact amount match
        cast(Receipt.date, Date) == receipt_date,  # Date match (without time)
    ).first()
    
    if potential_duplicates:
        # Flag this receipt as potential duplicate
        receipt.duplicate_suspect = 1
        receipt.duplicate_of_id = potential_duplicates.id
        db.commit()
        return True
    
    return False
