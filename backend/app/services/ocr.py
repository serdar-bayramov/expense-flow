from google.cloud import vision
from openai import OpenAI
import json
import os
from datetime import datetime
from sqlalchemy.orm import Session

from app.core.database import settings
from app.models.receipt import Receipt, ReceiptStatus

# Google credentials
os.environ["GOOGLE_APPLICATION_CREDENTIALS"] = settings.GOOGLE_APPLICATION_CREDENTIALS

# Initialise clients
vision_client = vision.ImageAnnotatorClient()
openai_client = OpenAI(api_key=settings.OPENAI_API_KEY)


def extract_text_from_receipt(image_url: str) -> str:
    """
    Extract raw text from receipt image using Google Vision API.
    
    Args:
        image_url: Public URL of the receipt image in GCS
        
    Returns:
        str: All text found in the image
        
    Example:
        extract_text_from_receipt("https://storage.googleapis.com/...")
        → "STARBUCKS\n123 Main St\nTotal: $8.47\n..."
    """
    
    try:
        print(f"[DEBUG] Original image_url: {image_url}")
        
        # Convert public URL to GCS URI format
        # From: https://storage.googleapis.com/expense-flow/receipts/user_1/file.jpg
        # To:   gs://expense-flow/receipts/user_1/file.jpg
        from urllib.parse import unquote
        
        if "storage.googleapis.com" in image_url:
            # Extract bucket and blob path from URL
            parts = image_url.split("storage.googleapis.com/")[1]
            print(f"[DEBUG] URL parts before decode: {parts}")
            # Decode URL encoding (%20 → space, etc.)
            parts = unquote(parts)
            print(f"[DEBUG] URL parts after decode: {parts}")
            gcs_uri = f"gs://{parts}"
        else:
            # If already in gs:// format, use as-is
            gcs_uri = image_url
        
        print(f"[DEBUG] Final GCS URI: {gcs_uri}")
        print(f"[DEBUG] Is PDF: {gcs_uri.lower().endswith('.pdf')}")
        
        # Verify blob exists before calling Vision API
        if not verify_blob_exists(gcs_uri):
            raise Exception(f"File not found in GCS: {gcs_uri}")
        
        # Create Vision API image object from GCS URI
        
        # Create Vision API image object from GCS URI
        image = vision.Image()
        image.source.image_uri = gcs_uri
        
        # Check if file is PDF (needs different method)
        if gcs_uri.lower().endswith('.pdf'):
            print(f"[DEBUG] Using document_text_detection for PDF")
            response = vision_client.document_text_detection(image=image)
        else:
            print(f"[DEBUG] Using text_detection for image")
            response = vision_client.text_detection(image=image)
        
        print(f"[DEBUG] Response received")
        print(f"[DEBUG] Has error: {bool(response.error.message)}")
        
        # Check for errors
        if response.error.message:
            print(f"[DEBUG] Error message: {response.error.message}")
            print(f"[DEBUG] Error code: {response.error.code}")
            raise Exception(f"Vision API error: {response.error.message}")
        
        print(f"[DEBUG] Has full_text_annotation: {bool(response.full_text_annotation)}")
        print(f"[DEBUG] Has text_annotations: {bool(response.text_annotations)}")
        
        # Get the detected text
        # For both methods, full_text_annotation contains the complete text
        if response.full_text_annotation:
            full_text = response.full_text_annotation.text
            print(f"[DEBUG] Extracted {len(full_text)} characters from full_text_annotation")
            return full_text
        elif response.text_annotations:
            # Fallback for text_detection method
            full_text = response.text_annotations[0].description
            print(f"[DEBUG] Extracted {len(full_text)} characters from text_annotations")
            return full_text
        else:
            print(f"[DEBUG] No text found in response")
            return ""
            
    except Exception as e:
        print(f"[DEBUG] Exception type: {type(e).__name__}")
        print(f"[DEBUG] Exception details: {str(e)}")
        print(f"Error extracting text: {str(e)}")
        raise


def verify_blob_exists(gcs_uri: str) -> bool:
    """
    Verify that a blob exists in GCS.
    
    Args:
        gcs_uri: GCS URI like gs://bucket/path/to/file.jpg
        
    Returns:
        bool: True if blob exists and is readable
    """
    try:
        # Parse gs:// URI
        uri_parts = gcs_uri.replace("gs://", "").split("/", 1)
        bucket_name = uri_parts[0]
        blob_path = uri_parts[1]
        
        print(f"[DEBUG] Checking bucket: {bucket_name}")
        print(f"[DEBUG] Checking blob path: {blob_path}")
        from google.cloud import storage
        storage_client = storage.Client()
        # Get bucket and blob
        bucket = storage_client.bucket(bucket_name)
        blob = bucket.blob(blob_path)
        
        # Check if exists
        exists = blob.exists()
        print(f"[DEBUG] Blob exists: {exists}")
        
        if exists:
            print(f"[DEBUG] Blob size: {blob.size} bytes")
            print(f"[DEBUG] Blob content type: {blob.content_type}")
        
        return exists
        
    except Exception as e:
        print(f"[DEBUG] Error checking blob: {str(e)}")
        return False


def parse_receipt_with_ai(raw_text: str) -> dict:
    """
    Parse raw receipt text into structured data using OpenAI.
    
    Args:
        raw_text: Unstructured text extracted from receipt
        
    Returns:
        dict: Parsed receipt data
        
    Example output:
        {
            "vendor": "Starbucks",
            "date": "2026-01-15",
            "total_amount": 9.23,
            "tax_amount": 0.76,
            "items": [
                {"name": "Caffe Latte", "price": 4.95},
                {"name": "Croissant", "price": 3.52}
            ]
        }
    """
    
    try:
        # Prompt for GPT to parse the receipt
        system_prompt = """You are a receipt parser. Extract structured data from receipt text.
        
Rules:
- Extract vendor name (business name)
- Extract date in YYYY-MM-DD format
- Extract total amount as a number (no $ symbol)
- Extract tax amount if present
- Extract individual items with names and prices
- If you can't find something, use null

Return valid JSON only, no explanation."""

        user_prompt = f"""Parse this receipt text into JSON:

{raw_text}

Required JSON format:
{{
    "vendor": "string or null",
    "date": "YYYY-MM-DD or null",
    "total_amount": number or null,
    "tax_amount": number or null,
    "items": [
        {{"name": "string", "price": number}}
    ]
}}"""

        # Call OpenAI API
        response = openai_client.chat.completions.create(
            model="gpt-4o-mini",  # Cheap and fast model
            messages=[
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": user_prompt}
            ],
            response_format={"type": "json_object"},  # Ensures valid JSON
            temperature=0  # Deterministic output
        )
        
        # Parse the JSON response
        parsed_data = json.loads(response.choices[0].message.content)
        
        return parsed_data
        
    except Exception as e:
        print(f"Error parsing receipt with AI: {str(e)}")
        # Return empty structure on error
        return {
            "vendor": None,
            "date": None,
            "total_amount": None,
            "tax_amount": None,
            "items": []
        }
    

def process_receipt_ocr(receipt_id: int, db: Session) -> Receipt:
    """
    Complete OCR processing: extract text, parse with AI, update database.
    
    This is the main function called after a receipt is uploaded.
    
    Args:
        receipt_id: ID of the receipt to process
        db: Database session
        
    Returns:
        Receipt: Updated receipt object
        
    Flow:
        1. Get receipt from database
        2. Set status to PROCESSING
        3. Extract text with Vision API
        4. Parse text with OpenAI
        5. Update receipt with parsed data
        6. Set status to COMPLETED (or FAILED on error)
    """
    
    # Get receipt from database
    receipt = db.query(Receipt).filter(Receipt.id == receipt_id).first()
    
    if not receipt:
        raise Exception(f"Receipt {receipt_id} not found")
    
    try:
        # Update status to PROCESSING
        receipt.status = ReceiptStatus.PROCESSING
        db.commit()
        
        # Step 1: Extract text from image
        print(f"Extracting text from receipt {receipt_id}...")
        raw_text = extract_text_from_receipt(receipt.image_url)
        
        # Save raw text to database
        receipt.ocr_raw_text = raw_text
        db.commit()
        
        # Step 2: Parse text with AI
        print(f"Parsing receipt data with AI...")
        parsed_data = parse_receipt_with_ai(raw_text)
        
        # Step 3: Update receipt with parsed data
        if parsed_data.get("vendor"):
            receipt.vendor = parsed_data["vendor"]
        
        if parsed_data.get("date"):
            # Parse date string to datetime
            try:
                receipt.date = datetime.strptime(parsed_data["date"], "%Y-%m-%d").date()
            except:
                pass  # Keep null if date parsing fails
        
        if parsed_data.get("total_amount") is not None:
            receipt.total_amount = float(parsed_data["total_amount"])
        
        if parsed_data.get("tax_amount") is not None:
            receipt.tax_amount = float(parsed_data["tax_amount"])
        
        if parsed_data.get("items"):
            # Store items as JSON string
            receipt.items = json.dumps(parsed_data["items"])
        
        # Mark as completed
        receipt.status = ReceiptStatus.COMPLETED
        db.commit()
        db.refresh(receipt)
        
        print(f"Receipt {receipt_id} processed successfully!")
        return receipt
        
    except Exception as e:
        # Mark as failed on any error
        receipt.status = ReceiptStatus.FAILED
        db.commit()
        
        print(f"Failed to process receipt {receipt_id}: {str(e)}")
        raise