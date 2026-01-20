from fastapi import APIRouter, Depends, HTTPException, status, UploadFile, File
from sqlalchemy.orm import Session
from sqlalchemy import func, extract
from typing import List
from datetime import datetime, date

from app.core.database import get_db
from app.api.deps import get_current_user
from app.models.user import User
from app.models.receipt import Receipt, ReceiptStatus, ExpenseCategory
from app.schemas.receipt import ReceiptCreate, ReceiptUpdate, ReceiptResponse
from app.services.storage import upload_file_to_gcs, delete_file_from_gcs
from app.services.ocr import process_receipt_ocr
from app.services.audit import (
    log_receipt_created,
    log_status_change,
    log_field_update,
    log_approval,
    log_deletion,
    get_receipt_history
)


router = APIRouter(prefix="/receipts", tags=["Receipts"])


@router.post("/upload")
async def upload_receipt_image(
    file: UploadFile = File(...),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Upload a receipt image and automatically process with OCR.
    
    This is the one-step process:
        1. User uploads image file
        2. File is uploaded to GCS
        3. Receipt record created with status=PENDING
        4. OCR processing triggered automatically
        5. Returns receipt with extracted data
    
    File Requirements:
        - Type: jpg, png, or pdf
        - Size: Maximum 10MB
    
    Example Response:
        {
            "id": 1,
            "image_url": "https://storage.googleapis.com/.../receipt.jpg",
            "vendor": "Starbucks",
            "date": "2026-01-15",
            "total_amount": 9.23,
            "status": "completed"
        }
    """
    
    # Step 1: Upload to Google Cloud Storage
    file_url = upload_file_to_gcs(file, current_user.id)
    
    # Step 2: Create receipt record with PENDING status
    new_receipt = Receipt(
        user_id=current_user.id,
        image_url=file_url,
        status=ReceiptStatus.PENDING
    )
    
    db.add(new_receipt)
    db.commit()
    db.refresh(new_receipt)
    
    # Log receipt creation
    log_receipt_created(db, new_receipt.id, current_user.id, source="manual")
    
    # Step 3: Process OCR (extract + parse + update)
    try:
        processed_receipt = process_receipt_ocr(new_receipt.id, db)
        return processed_receipt
    except Exception as e:
        # Return receipt even if OCR fails (user can retry later)
        return new_receipt


@router.post("/", response_model=ReceiptResponse, status_code=status.HTTP_201_CREATED)
def create_receipt(
    receipt_data: ReceiptCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Create a new receipt record.
    
    This is called AFTER image is uploaded to storage.
    Creates database record with pending status.
    OCR processing happens in Step 6.
    
    Flow:
        1. User uploads image → Gets URL
        2. Call this endpoint with image_url
        3. Creates receipt record with status="pending"
        4. Later: OCR extracts data and updates record
    
    Example Request:
        POST /api/v1/receipts
        {
            "image_url": "https://storage.googleapis.com/receipts/abc123.jpg",
            "notes": "Office supplies"
        }
    """
    new_receipt = Receipt(
        user_id=current_user.id,
        image_url=receipt_data.image_url,
        vendor=receipt_data.vendor,
        date=receipt_data.date,
        total_amount=receipt_data.total_amount,
        tax_amount=receipt_data.tax_amount,
        items=receipt_data.items,
        category=receipt_data.category,
        notes=receipt_data.notes,
        is_business=receipt_data.is_business,
        status=ReceiptStatus.PENDING  # Will be processed by OCR
    )
    
    db.add(new_receipt)
    db.commit()
    db.refresh(new_receipt)
    
    return new_receipt


@router.get("/", response_model=List[ReceiptResponse])
def list_receipts(
    skip: int = 0,
    limit: int = 100,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Get list of user's receipts.
    
    Supports pagination with skip/limit parameters.
    Only returns receipts owned by current user.
    
    Query Parameters:
        skip: Number of records to skip (default: 0)
        limit: Max records to return (default: 100)
    
    Example Request:
        GET /api/v1/receipts?skip=0&limit=20
    
    Example Response:
        [
            {
                "id": 1,
                "vendor": "Amazon",
                "total_amount": 49.99,
                ...
            },
            {
                "id": 2,
                "vendor": "Starbucks",
                "total_amount": 8.47,
                ...
            }
        ]
    """
    receipts = db.query(Receipt).filter(
        Receipt.user_id == current_user.id,
        Receipt.deleted_at.is_(None)  # Exclude soft-deleted receipts
    ).order_by(
        Receipt.created_at.desc()
    ).offset(skip).limit(limit).all()

    return receipts


@router.get("/analytics")
def get_receipt_analytics(
    start_date: str = None,
    end_date: str = None,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Get expense analytics and breakdown by HMRC category.
    
    Returns comprehensive analytics including:
    - Total spending by category
    - Category breakdown with percentages
    - Monthly trends
    - Tax year summaries
    
    Query Parameters:
        start_date: Filter from date (YYYY-MM-DD) - optional
        end_date: Filter to date (YYYY-MM-DD) - optional
    
    Example Request:
        GET /api/v1/receipts/analytics?start_date=2025-04-06&end_date=2026-04-05
    
    Example Response:
        {
            "total_amount": 15234.50,
            "total_vat": 2539.08,
            "receipt_count": 156,
            "categories": [
                {
                    "category": "Travel Costs",
                    "total": 4532.20,
                    "vat": 755.37,
                    "count": 45,
                    "percentage": 29.8
                },
                ...
            ],
            "monthly_breakdown": [
                {
                    "month": "2025-04",
                    "total": 1234.50,
                    "count": 12
                },
                ...
            ]
        }
    """
    
    # Base query - only completed receipts
    query = db.query(Receipt).filter(
        Receipt.user_id == current_user.id,
        Receipt.status == ReceiptStatus.COMPLETED,
        Receipt.deleted_at.is_(None)  # Exclude soft-deleted receipts
    )
    
    # Apply date filters if provided
    if start_date:
        try:
            start = datetime.strptime(start_date, "%Y-%m-%d").date()
            query = query.filter(Receipt.date >= start)
        except:
            pass
    
    if end_date:
        try:
            end = datetime.strptime(end_date, "%Y-%m-%d").date()
            query = query.filter(Receipt.date <= end)
        except:
            pass
    
    receipts = query.all()
    
    # Calculate totals
    total_amount = sum(r.total_amount or 0 for r in receipts)
    total_vat = sum(r.tax_amount or 0 for r in receipts)
    receipt_count = len(receipts)
    
    # Category breakdown
    category_stats = {}
    for receipt in receipts:
        cat = receipt.category.value if receipt.category else "Uncategorized"
        
        if cat not in category_stats:
            category_stats[cat] = {
                "category": cat,
                "total": 0,
                "vat": 0,
                "count": 0
            }
        
        category_stats[cat]["total"] += receipt.total_amount or 0
        category_stats[cat]["vat"] += receipt.tax_amount or 0
        category_stats[cat]["count"] += 1
    
    # Add percentages
    for cat_data in category_stats.values():
        cat_data["percentage"] = round((cat_data["total"] / total_amount * 100), 1) if total_amount > 0 else 0
    
    # Sort by total (highest first)
    categories = sorted(category_stats.values(), key=lambda x: x["total"], reverse=True)
    
    # Monthly breakdown
    monthly_stats = {}
    for receipt in receipts:
        if receipt.date:
            month_key = receipt.date.strftime("%Y-%m")
            
            if month_key not in monthly_stats:
                monthly_stats[month_key] = {
                    "month": month_key,
                    "total": 0,
                    "vat": 0,
                    "count": 0
                }
            
            monthly_stats[month_key]["total"] += receipt.total_amount or 0
            monthly_stats[month_key]["vat"] += receipt.tax_amount or 0
            monthly_stats[month_key]["count"] += 1
    
    # Sort by month
    monthly_breakdown = sorted(monthly_stats.values(), key=lambda x: x["month"])
    
    return {
        "total_amount": round(total_amount, 2),
        "total_vat": round(total_vat, 2),
        "receipt_count": receipt_count,
        "categories": categories,
        "monthly_breakdown": monthly_breakdown
    }


@router.get("/{receipt_id}", response_model=ReceiptResponse)
def get_receipt(
    receipt_id: int, 
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Get single receipt by ID.
    
    Returns full receipt details including OCR extracted data.
    User can only access their own receipts.
    
    Path Parameters:
        receipt_id: The receipt ID
    
    Example Request:
        GET /api/v1/receipts/1
    
    Errors:
        404: Receipt not found or doesn't belong to user
    """
    receipt = db.query(Receipt).filter(
        Receipt.id == receipt_id,
        Receipt.user_id == current_user.id,
        Receipt.deleted_at.is_(None)  # Exclude soft-deleted receipts
    ).first()

    if not receipt:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Receipt not found"
        )
    
    return receipt


@router.put("/{receipt_id}", response_model=ReceiptResponse)
def update_receipt(
    receipt_id: int,
    receipt_data: ReceiptUpdate, 
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Update receipt details.
    
    User can edit any field after OCR extraction.
    Useful for correcting OCR mistakes or adding notes.
    
    Example Request:
        PUT /api/v1/receipts/1
        {
            "vendor": "Amazon (corrected)",
            "total_amount": 49.99,
            "category": "Office Supplies",
            "notes": "Wireless keyboard for home office"
        }
    
    Only updates fields that are provided (partial update).
    """
    receipt = db.query(Receipt).filter(
        Receipt.id == receipt_id,
        Receipt.user_id == current_user.id,
        Receipt.deleted_at.is_(None)  # Cannot update deleted receipts
    ).first()

    if not receipt:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Receipt not found"
        )
    
    # Track old values before update
    old_values = {
        "vendor": receipt.vendor,
        "date": receipt.date,
        "total_amount": receipt.total_amount,
        "tax_amount": receipt.tax_amount,
        "category": receipt.category.value if receipt.category else None,
        "notes": receipt.notes,
        "is_business": receipt.is_business
    }
    
    # Update only provided fields
    update_data = receipt_data.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(receipt, field, value)

    db.commit()
    db.refresh(receipt)
    
    # Log each field that changed
    for field, new_value in update_data.items():
        old_value = old_values.get(field)
        # Convert enum to value for comparison
        if field == "category" and new_value:
            new_value = new_value.value if hasattr(new_value, 'value') else new_value
        if str(old_value) != str(new_value):
            log_field_update(
                db=db,
                receipt_id=receipt_id,
                user_id=current_user.id,
                field_name=field,
                old_value=old_value,
                new_value=new_value
            )

    return receipt


@router.post("/{receipt_id}/approve", response_model=ReceiptResponse)
def approve_receipt(
    receipt_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Approve a receipt after reviewing OCR results.
    
    Changes status from PENDING to COMPLETED.
    User must review and confirm the extracted data is correct.
    
    Example Request:
        POST /api/v1/receipts/1/approve
    
    Errors:
        404: Receipt not found
        400: Receipt not in PENDING status
    """
    receipt = db.query(Receipt).filter(
        Receipt.id == receipt_id,
        Receipt.user_id == current_user.id,
        Receipt.deleted_at.is_(None)  # Cannot approve deleted receipts
    ).first()

    if not receipt:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Receipt not found"
        )
    
    if receipt.status != ReceiptStatus.PENDING:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Receipt is not pending approval (current status: {receipt.status})"
        )
    
    # Log status change and approval
    old_status = receipt.status.value
    receipt.status = ReceiptStatus.COMPLETED
    
    db.commit()
    db.refresh(receipt)
    
    # Log the approval
    log_approval(db, receipt_id, current_user.id)
    log_status_change(db, receipt_id, old_status, receipt.status.value)
    
    return receipt


@router.delete("/{receipt_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_receipt(
    receipt_id: int, 
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Delete a receipt.
    
    Permanently removes receipt from database.
    Note: Image file remains in storage (cleanup in Step 5).
    
    Example Request:
        DELETE /api/v1/receipts/1
    
    Response:
        204 No Content (empty response on success)
    
    Errors:
        404: Receipt not found
    """
    receipt = db.query(Receipt).filter(
        Receipt.id == receipt_id,
        Receipt.user_id == current_user.id
    ).first()

    if not receipt:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Receipt not found"
        )
    
    # Log deletion before soft deleting
    log_deletion(db, receipt_id, current_user.id)
    
    # Soft delete: set deleted_at timestamp instead of hard delete
    receipt.deleted_at = datetime.utcnow()
    db.commit()
    
    # Note: Image remains in storage for recovery purposes
    # Can be cleaned up later with a background job

    return None # 204 returns no content


@router.get("/{receipt_id}/history")
def get_audit_history(
    receipt_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Get complete audit history for a receipt.
    
    Returns all events that happened to this receipt:
    - Creation (manual upload or email)
    - Status changes (pending → processing → completed)
    - Field updates (vendor, amount, category changes)
    - Approval
    - Deletion attempts
    
    Useful for:
    - HMRC audit compliance
    - Debugging OCR issues
    - Understanding receipt lifecycle
    
    Example Request:
        GET /api/v1/receipts/1/history
    
    Example Response:
        {
            "receipt_id": 1,
            "events": [
                {
                    "id": 1,
                    "timestamp": "2026-01-20T10:30:00Z",
                    "event_type": "created",
                    "actor": "user",
                    "metadata": {"source": "manual"}
                },
                {
                    "id": 2,
                    "timestamp": "2026-01-20T10:30:05Z",
                    "event_type": "status_changed",
                    "actor": "system",
                    "field_name": "status",
                    "old_value": "pending",
                    "new_value": "processing"
                },
                {
                    "id": 3,
                    "timestamp": "2026-01-20T10:30:15Z",
                    "event_type": "ocr_completed",
                    "actor": "system:ocr",
                    "metadata": {"extracted_fields": {...}}
                },
                {
                    "id": 4,
                    "timestamp": "2026-01-20T14:20:00Z",
                    "event_type": "field_updated",
                    "actor": "user",
                    "field_name": "category",
                    "old_value": "Other",
                    "new_value": "Travel Costs"
                },
                {
                    "id": 5,
                    "timestamp": "2026-01-20T14:21:00Z",
                    "event_type": "approved",
                    "actor": "user"
                }
            ]
        }
    
    Errors:
        404: Receipt not found or not owned by user
    """
    # Verify receipt exists and belongs to user
    receipt = db.query(Receipt).filter(
        Receipt.id == receipt_id,
        Receipt.user_id == current_user.id
    ).first()
    
    if not receipt:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Receipt not found"
        )
    
    # Get audit history
    history = get_receipt_history(db, receipt_id)
    
    return {
        "receipt_id": receipt_id,
        "events": [
            {
                "id": log.id,
                "timestamp": log.timestamp.isoformat(),
                "event_type": log.event_type,
                "actor": log.actor,
                "field_name": log.field_name,
                "old_value": log.old_value,
                "new_value": log.new_value,
                "extra_data": log.extra_data
            }
            for log in history
        ]
    }


@router.get("/deleted/list", response_model=List[ReceiptResponse])
def list_deleted_receipts(
    skip: int = 0,
    limit: int = 100,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Get list of soft-deleted receipts.
    
    Returns all receipts that have been deleted but are still in the system.
    Useful for audit purposes and recovery.
    
    Query Parameters:
        skip: Number of records to skip (default: 0)
        limit: Max records to return (default: 100)
    
    Example Request:
        GET /api/v1/receipts/deleted/list
    
    Example Response:
        [
            {
                "id": 5,
                "vendor": "Amazon",
                "total_amount": 49.99,
                "deleted_at": "2026-01-20T15:30:00Z",
                ...
            }
        ]
    """
    deleted_receipts = db.query(Receipt).filter(
        Receipt.user_id == current_user.id,
        Receipt.deleted_at.isnot(None)  # Only show soft-deleted receipts
    ).order_by(
        Receipt.deleted_at.desc()
    ).offset(skip).limit(limit).all()

    return deleted_receipts


@router.post("/{receipt_id}/restore", response_model=ReceiptResponse)
def restore_receipt(
    receipt_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Restore a soft-deleted receipt.
    
    Undeletes a receipt by setting deleted_at back to NULL.
    Receipt becomes visible in regular lists again.
    
    Example Request:
        POST /api/v1/receipts/5/restore
    
    Example Response:
        {
            "id": 5,
            "vendor": "Amazon",
            "total_amount": 49.99,
            "deleted_at": null,
            ...
        }
    
    Errors:
        404: Receipt not found or not deleted
    """
    receipt = db.query(Receipt).filter(
        Receipt.id == receipt_id,
        Receipt.user_id == current_user.id,
        Receipt.deleted_at.isnot(None)  # Must be deleted to restore
    ).first()

    if not receipt:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Deleted receipt not found"
        )
    
    # Restore receipt
    receipt.deleted_at = None
    db.commit()
    db.refresh(receipt)
    
    # Log restoration event
    from app.services.audit import log_event
    log_event(
        db=db,
        receipt_id=receipt_id,
        event_type="restored",
        actor="user",
        user_id=current_user.id,
        extra_data={"restored_at": datetime.utcnow().isoformat()}
    )
    
    return receipt
