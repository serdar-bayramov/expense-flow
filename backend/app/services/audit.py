"""
Audit logging service for tracking all receipt changes.
Provides full audit trail for HMRC compliance and debugging.
"""
from sqlalchemy.orm import Session
from app.models.audit_log import AuditLog
from datetime import datetime
from typing import Optional, Any

def log_event(
    db: Session,
    receipt_id: int,
    event_type: str,
    actor: str = "system",
    user_id: Optional[int] = None,
    field_name: Optional[str] = None,
    old_value: Optional[Any] = None,
    new_value: Optional[Any] = None,
    extra_data: Optional[dict] = None
) -> AuditLog:
    """
    Log an audit event for a receipt.
    
    Args:
        db: Database session
        receipt_id: ID of the receipt being modified
        event_type: Type of event (created, status_changed, field_updated, approved, etc.)
        actor: Who/what made the change (user, system:ocr, system:email)
        user_id: ID of user who made the change (if applicable)
        field_name: Name of field that changed (if applicable)
        old_value: Previous value (if applicable)
        new_value: New value (if applicable)
        extra_data: Additional context as JSON
    
    Returns:
        Created AuditLog instance
    """
    audit_log = AuditLog(
        receipt_id=receipt_id,
        event_type=event_type,
        timestamp=datetime.utcnow(),
        actor=actor,
        user_id=user_id,
        field_name=field_name,
        old_value=str(old_value) if old_value is not None else None,
        new_value=str(new_value) if new_value is not None else None,
        extra_data=extra_data
    )
    db.add(audit_log)
    db.commit()
    return audit_log


def log_receipt_created(
    db: Session,
    receipt_id: int,
    user_id: int,
    source: str = "manual"
) -> AuditLog:
    """
    Log receipt creation.
    
    Args:
        db: Database session
        receipt_id: ID of created receipt
        user_id: ID of user who created it
        source: How it was created (manual, email)
    """
    actor = "user" if source == "manual" else "system:email"
    return log_event(
        db=db,
        receipt_id=receipt_id,
        event_type="created",
        actor=actor,
        user_id=user_id,
        extra_data={"source": source}
    )


def log_status_change(
    db: Session,
    receipt_id: int,
    old_status: str,
    new_status: str,
    actor: str = "system"
) -> AuditLog:
    """
    Log status change (pending → processing → completed).
    
    Args:
        db: Database session
        receipt_id: ID of receipt
        old_status: Previous status
        new_status: New status
        actor: Who changed it (usually system)
    """
    return log_event(
        db=db,
        receipt_id=receipt_id,
        event_type="status_changed",
        actor=actor,
        field_name="status",
        old_value=old_status,
        new_value=new_status
    )


def log_field_update(
    db: Session,
    receipt_id: int,
    user_id: int,
    field_name: str,
    old_value: Any,
    new_value: Any
) -> AuditLog:
    """
    Log field update by user (vendor, amount, category, etc.).
    
    Args:
        db: Database session
        receipt_id: ID of receipt
        user_id: ID of user making the change
        field_name: Name of field being updated
        old_value: Previous value
        new_value: New value
    """
    return log_event(
        db=db,
        receipt_id=receipt_id,
        event_type="field_updated",
        actor="user",
        user_id=user_id,
        field_name=field_name,
        old_value=old_value,
        new_value=new_value
    )


def log_approval(
    db: Session,
    receipt_id: int,
    user_id: int
) -> AuditLog:
    """
    Log receipt approval (pending → completed).
    
    Args:
        db: Database session
        receipt_id: ID of receipt
        user_id: ID of user approving
    """
    return log_event(
        db=db,
        receipt_id=receipt_id,
        event_type="approved",
        actor="user",
        user_id=user_id
    )


def log_ocr_completed(
    db: Session,
    receipt_id: int,
    extracted_fields: dict
) -> AuditLog:
    """
    Log OCR processing completion.
    
    Args:
        db: Database session
        receipt_id: ID of receipt
        extracted_fields: Fields extracted by OCR
    """
    return log_event(
        db=db,
        receipt_id=receipt_id,
        event_type="ocr_completed",
        actor="system:ocr",
        extra_data={"extracted_fields": extracted_fields}
    )


def log_deletion(
    db: Session,
    receipt_id: int,
    user_id: int
) -> AuditLog:
    """
    Log receipt deletion.
    
    Args:
        db: Database session
        receipt_id: ID of receipt
        user_id: ID of user deleting
    """
    return log_event(
        db=db,
        receipt_id=receipt_id,
        event_type="deleted",
        actor="user",
        user_id=user_id
    )


def get_receipt_history(
    db: Session,
    receipt_id: int
) -> list[AuditLog]:
    """
    Get full audit history for a receipt.
    
    Args:
        db: Database session
        receipt_id: ID of receipt
    
    Returns:
        List of AuditLog entries ordered by timestamp
    """
    return db.query(AuditLog).filter(
        AuditLog.receipt_id == receipt_id
    ).order_by(AuditLog.timestamp.asc()).all()
