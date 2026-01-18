from fastapi import APIRouter, Depends, HTTPException, status, UploadFile, File
from sqlalchemy.orm import Session
from typing import List

from app.core.database import get_db
from app.api.deps import get_current_user
from app.models.user import User
from app.models.receipt import Receipt, ReceiptStatus
from app.schemas.receipt import ReceiptCreate, ReceiptUpdate, ReceiptResponse
from app.services.storage import upload_file_to_gcs, delete_file_from_gcs
from app.services.ocr import process_receipt_ocr


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
        Receipt.user_id == current_user.id
    ).order_by(
        Receipt.created_at.desc()
    ).offset(skip).limit(limit).all()

    return receipts


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
        Receipt.user_id == current_user.id
    ).first()

    if not receipt:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Receipt not found"
        )
    
    return receipt


@router.put("/receipt_id", response_model=ReceiptResponse)
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
        Receipt.user_id == current_user.id
    ).first()

    if not receipt:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Receipt not found"
        )
        
    # Update only provided fields
    update_data = receipt_data.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(receipt, field, value)

    db.commit()
    db.refresh(receipt)

    return receipt


@router.delete("/receipt_id", status_code=status.HTTP_204_NO_CONTENT)
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
    # Delete image from storage first (before deleting DB record)
    if receipt.image_url:
        delete_file_from_gcs(receipt.image_url)
        
    db.delete(receipt)
    db.commit()

    return None # 204 returns no content