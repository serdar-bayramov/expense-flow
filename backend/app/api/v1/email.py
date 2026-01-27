"""
SendGrid Inbound Email Webhook Endpoint
Receives emails forwarded to unique receipt addresses and creates receipts automatically
"""
from fastapi import APIRouter, Request, HTTPException, Depends, Form, UploadFile, File, BackgroundTasks
from sqlalchemy.orm import Session
from typing import List, Optional
import logging
from datetime import datetime, timezone, timedelta
import io
import hashlib

from app.core.database import get_db
from app.models.user import User
from app.models.receipt import Receipt
from app.models.processed_email import ProcessedEmail
from app.services.storage import upload_file_to_gcs
from app.services.ocr import process_receipt_ocr

router = APIRouter()
logger = logging.getLogger(__name__)

# Supported file extensions for receipt images
SUPPORTED_EXTENSIONS = {'.jpg', '.jpeg', '.png', '.pdf'}
MAX_FILE_SIZE = 10 * 1024 * 1024  # 10MB

def process_receipt_ocr_background(receipt_id: int):
    """Background task to process OCR for a receipt"""
    from app.core.database import SessionLocal
    db = SessionLocal()
    try:
        process_receipt_ocr(receipt_id, db)
        logger.info(f"Background OCR processing completed for receipt {receipt_id}")
    except Exception as e:
        logger.error(f"Background OCR processing failed for receipt {receipt_id}: {e}")
    finally:
        db.close()


@router.post("/inbound")
async def receive_email(
    request: Request,
    background_tasks: BackgroundTasks,
    to: str = Form(...),
    from_email: str = Form(alias="from", default=None),
    subject: str = Form(default=""),
    text: Optional[str] = Form(default=None),
    attachments: Optional[int] = Form(default=0),
    db: Session = Depends(get_db)
):
    """
    SendGrid Inbound Parse webhook endpoint.
    Receives email data and creates receipts from attachments.
    
    SendGrid sends multipart/form-data with:
    - to: recipient email (user's unique_receipt_email)
    - from: sender email address
    - subject: email subject
    - text: email body
    - attachments: number of attachments
    - attachment1, attachment2, etc: actual files
    
    IMPORTANT: This endpoint responds immediately to prevent SendGrid retries.
    OCR processing happens in the background.
    """
    
    # Get form data first (needed for hash calculation)
    form_data = await request.form()
    
    # Create idempotency key using email properties (not server time!)
    # Include all attachments' filenames to make it unique per email
    attachment_names = []
    for i in range(1, (attachments or 0) + 1):
        attachment_key = f"attachment{i}"
        if attachment_key in form_data:
            file = form_data[attachment_key]
            if hasattr(file, 'filename'):
                attachment_names.append(file.filename or f"file{i}")
    
    # Create unique fingerprint based on email content (not time!)
    email_fingerprint = f"{to}:{from_email}:{subject}:{attachments}:{','.join(sorted(attachment_names))}"
    email_hash = hashlib.md5(email_fingerprint.encode()).hexdigest()
    
    # Check database if we've already processed this exact email
    existing = db.query(ProcessedEmail).filter(ProcessedEmail.email_hash == email_hash).first()
    if existing:
        time_since = (datetime.now(timezone.utc) - existing.processed_at).total_seconds()
        logger.warning(f"Duplicate email detected and ignored: {email_hash} (processed {time_since:.1f}s ago)")
        return {
            "status": "duplicate",
            "message": "Email already processed"
        }
    
    # Store in database that we're processing this email
    processed_entry = ProcessedEmail(
        email_hash=email_hash,
        to_email=to[:255] if to else None,  # Truncate to fit varchar
        from_email=from_email[:255] if from_email else None,
        subject=subject[:255] if subject else None,
        attachment_count=attachments
    )
    db.add(processed_entry)
    db.commit()
    
    # Cleanup old entries (older than 7 days) - run occasionally
    # Only cleanup if we have more than 1000 entries to avoid unnecessary queries
    if db.query(ProcessedEmail).count() > 1000:
        cutoff_date = datetime.now(timezone.utc) - timedelta(days=7)
        deleted = db.query(ProcessedEmail).filter(ProcessedEmail.processed_at < cutoff_date).delete()
        if deleted > 0:
            db.commit()
            logger.info(f"Cleaned up {deleted} old processed email entries")
    
    logger.info(f"Received email: to={to}, from={from_email}, attachments={attachments}, hash={email_hash}")
    
    try:
        # Extract recipient email (handle both direct and forwarded emails)
        recipient_email = to.split('<')[-1].strip('>') if '<' in to else to
        recipient_email = recipient_email.lower().strip()
        
        logger.info(f"Looking for user with receipt email: {recipient_email}")
        
        # Find user by unique_receipt_email
        user = db.query(User).filter(User.unique_receipt_email == recipient_email).first()
        
        if not user:
            logger.warning(f"No user found for receipt email: {recipient_email}")
            # Debug: Check all users in database
            all_users = db.query(User).all()
            logger.info(f"Total users in database: {len(all_users)}")
            for u in all_users:
                logger.info(f"User {u.id}: email={u.email}, receipt_email={u.unique_receipt_email}")
            return {
                "status": "error",
                "message": f"No account found for {recipient_email}"
            }
        
        if not user.is_active:
            logger.warning(f"User account inactive: {user.email}")
            return {
                "status": "error",
                "message": "Account is inactive"
            }
        
        # Check if there are any attachments
        if not attachments or attachments == 0:
            logger.warning(f"Email from {from_email} has no attachments")
            return {
                "status": "error",
                "message": "No attachments found. Please include receipt images."
            }
        
        # Process each attachment
        receipts_created = []
        
        logger.info(f"Form data keys: {list(form_data.keys())}")
        
        for i in range(1, attachments + 1):
            attachment_key = f"attachment{i}"
            
            if attachment_key not in form_data:
                logger.warning(f"Attachment {i} not found in form data")
                continue
            
            file = form_data[attachment_key]
            logger.info(f"Attachment {i} type: {type(file)}, hasattr filename: {hasattr(file, 'filename')}")
            
            # SendGrid sends files as UploadFile objects, but check both ways
            if not hasattr(file, 'filename') or not hasattr(file, 'read'):
                logger.warning(f"Attachment {i} is not a valid file object")
                continue
            
            # Get file extension
            filename = file.filename or ""
            file_ext = filename.lower().split('.')[-1] if '.' in filename else ""
            file_ext_with_dot = f".{file_ext}"
            
            # Check if file type is supported
            if file_ext_with_dot not in SUPPORTED_EXTENSIONS:
                logger.warning(f"Unsupported file type: {filename}")
                continue
            
            # Read file content ONCE and reuse
            file_content = await file.read()
            
            # Check file size
            if len(file_content) > MAX_FILE_SIZE:
                logger.warning(f"File too large: {filename} ({len(file_content)} bytes)")
                continue
            
            # Reset file pointer after reading (in case upload_file_to_gcs needs it)
            await file.seek(0)
            
            try:
                # Upload to GCS (file is already an UploadFile object from SendGrid)
                image_url = upload_file_to_gcs(file, user.id)
                
                # Create receipt record with basic info
                receipt = Receipt(
                    user_id=user.id,
                    vendor=f"Receipt from {from_email or 'email'}",
                    total_amount=0.0,  # Will be updated by OCR
                    date=datetime.now(timezone.utc),
                    category=None,
                    image_url=image_url,
                    notes=f"Subject: {subject}\nReceived via email from {from_email}" if subject and from_email else (f"Received via email from {from_email}" if from_email else "Received via email")
                )
                
                db.add(receipt)
                db.commit()
                db.refresh(receipt)
                
                # Schedule OCR processing in background - don't block response
                background_tasks.add_task(process_receipt_ocr_background, receipt.id)
                
                receipts_created.append({
                    "id": receipt.id,
                    "filename": filename,
                    "vendor": receipt.vendor,
                    "amount": receipt.total_amount
                })
                
                logger.info(f"Created receipt {receipt.id} for user {user.email} from attachment {filename}")
                
            except Exception as e:
                logger.error(f"Failed to process attachment {filename}: {e}")
                continue
        
        # Return success response IMMEDIATELY (OCR happens in background)
        if receipts_created:
            return {
                "status": "success",
                "message": f"Created {len(receipts_created)} receipt(s)",
                "receipts": receipts_created
            }
        else:
            return {
                "status": "error",
                "message": "No valid receipt images found in email attachments"
            }
    
    except Exception as e:
        logger.error(f"Error processing email: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/test")
async def test_endpoint():
    """Test endpoint to verify the email API is accessible"""
    return {
        "status": "ok",
        "message": "Email webhook endpoint is active",
        "version": "1.0"
    }
