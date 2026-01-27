"""
SendGrid Inbound Email Webhook Endpoint
Receives emails forwarded to unique receipt addresses and creates receipts automatically
"""
from fastapi import APIRouter, Request, HTTPException, Depends, Form, UploadFile, File, BackgroundTasks
from sqlalchemy.orm import Session
from typing import List, Optional
import logging
from datetime import datetime, timezone
import io
import hashlib

from app.core.database import get_db
from app.models.user import User
from app.models.receipt import Receipt
from app.services.storage import upload_file_to_gcs
from app.services.ocr import process_receipt_ocr

router = APIRouter()
logger = logging.getLogger(__name__)

# Supported file extensions for receipt images
SUPPORTED_EXTENSIONS = {'.jpg', '.jpeg', '.png', '.pdf'}
MAX_FILE_SIZE = 10 * 1024 * 1024  # 10MB

# In-memory cache to prevent duplicate processing (simple solution)
# In production, use Redis or database table
processed_emails = set()

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
    
    # Create a unique identifier for this email to prevent duplicate processing
    # Use form data to create a hash (SendGrid sends headers with message-id but not always in form)
    form_data = await request.form()
    email_fingerprint = f"{to}:{from_email}:{subject}:{attachments}:{datetime.now().strftime('%Y%m%d%H%M')}"
    email_hash = hashlib.md5(email_fingerprint.encode()).hexdigest()
    
    # Check if we've already processed this email (in the last minute)
    if email_hash in processed_emails:
        logger.warning(f"Duplicate email detected and ignored: {email_hash}")
        return {
            "status": "duplicate",
            "message": "Email already processed"
        }
    
    # Mark as processed
    processed_emails.add(email_hash)
    # Clean up old entries after 100 to prevent memory growth
    if len(processed_emails) > 100:
        processed_emails.clear()
    
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
            
            # Read file content
            file_content = await file.read()
            
            # Check file size
            if len(file_content) > MAX_FILE_SIZE:
                logger.warning(f"File too large: {filename} ({len(file_content)} bytes)")
                continue
            
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
