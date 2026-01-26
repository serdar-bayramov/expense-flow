"""
SendGrid Inbound Email Webhook Endpoint
Receives emails forwarded to unique receipt addresses and creates receipts automatically
"""
from fastapi import APIRouter, Request, HTTPException, Depends, Form, UploadFile, File
from sqlalchemy.orm import Session
from typing import List, Optional
import logging
from datetime import datetime, timezone
import io

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


@router.post("/inbound")
async def receive_email(
    request: Request,
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
    """
    logger.info(f"Received email: to={to}, from={from_email}, attachments={attachments}")
    
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
        form_data = await request.form()
        
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
                    merchant_name=f"Receipt from {from_email or 'email'}",
                    amount=0.0,  # Will be updated by OCR
                    date=datetime.now(timezone.utc).date(),
                    category="uncategorized",
                    image_url=image_url,
                    description=subject if subject else None,
                    notes=f"Received via email from {from_email}" if from_email else "Received via email"
                )
                
                db.add(receipt)
                db.commit()
                db.refresh(receipt)
                
                # Process OCR asynchronously (extract text + parse with AI)
                try:
                    process_receipt_ocr(receipt.id, db)
                    logger.info(f"OCR processing completed for receipt {receipt.id}")
                except Exception as ocr_error:
                    logger.error(f"OCR processing failed for receipt {receipt.id}: {ocr_error}")
                    # Receipt is still saved, just without OCR data
                
                receipts_created.append({
                    "id": receipt.id,
                    "filename": filename,
                    "merchant": receipt.merchant_name,
                    "amount": receipt.amount
                })
                
                logger.info(f"Created receipt {receipt.id} for user {user.email} from attachment {filename}")
                
            except Exception as e:
                logger.error(f"Failed to process attachment {filename}: {e}")
                continue
        
        # Return success response
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
