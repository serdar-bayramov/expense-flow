from google.cloud import vision
from google.cloud import storage
from google.oauth2 import service_account
from openai import OpenAI
import json
import os
import io
import fitz  # PyMuPDF
from PIL import Image
from datetime import datetime
from sqlalchemy.orm import Session

from app.core.database import settings
from app.models.receipt import Receipt, ReceiptStatus

# Initialize Google Cloud clients
# Check if GOOGLE_APPLICATION_CREDENTIALS is a file path or JSON string
if settings.GOOGLE_APPLICATION_CREDENTIALS.startswith('{'):
    # It's a JSON string (for Railway/production)
    credentials_dict = json.loads(settings.GOOGLE_APPLICATION_CREDENTIALS)
    credentials = service_account.Credentials.from_service_account_info(credentials_dict)
    vision_client = vision.ImageAnnotatorClient(credentials=credentials)
else:
    # It's a file path (for local development)
    os.environ["GOOGLE_APPLICATION_CREDENTIALS"] = settings.GOOGLE_APPLICATION_CREDENTIALS
    vision_client = vision.ImageAnnotatorClient()

openai_client = OpenAI(api_key=settings.OPENAI_API_KEY)


def extract_text_from_receipt(image_url: str, user_id: int = None) -> tuple[str, str | None]:
    """
    Extract raw text from receipt image using Google Vision API.
    
    Args:
        image_url: Public URL of the receipt image in GCS
        user_id: User ID (needed to save preview images for PDFs)
        
    Returns:
        tuple: (extracted_text, preview_url)
        - extracted_text: All text found in the image
        - preview_url: URL to preview image (for PDFs), None for regular images
        
    Example:
        extract_text_from_receipt("https://storage.googleapis.com/...", 1)
        → ("STARBUCKS\n123 Main St\nTotal: $8.47\n...", "https://...preview.png")
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
        
        preview_url = None  # Track preview URL for PDFs
        
        # Check if file is PDF - convert to image first
        if gcs_uri.lower().endswith('.pdf'):
            print(f"[DEBUG] PDF detected - converting to image first")
            image_bytes = convert_pdf_to_image(gcs_uri)
            
            # Save the converted image to GCS for frontend display
            if user_id:
                from app.services.storage import save_image_to_gcs
                preview_url = save_image_to_gcs(image_bytes, image_url, user_id)
                print(f"[DEBUG] Saved preview image: {preview_url}")
            
            # Use image bytes directly with Vision API
            image = vision.Image(content=image_bytes)
            print(f"[DEBUG] Using text_detection on converted PDF image")
            response = vision_client.text_detection(image=image)
        else:
            # For regular images, use GCS URI directly
            image = vision.Image()
            image.source.image_uri = gcs_uri
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
            return full_text, preview_url
        elif response.text_annotations:
            # Fallback for text_detection method
            full_text = response.text_annotations[0].description
            print(f"[DEBUG] Extracted {len(full_text)} characters from text_annotations")
            return full_text, preview_url
        else:
            print(f"[DEBUG] No text found in response")
            return "", preview_url
            
    except Exception as e:
        print(f"[DEBUG] Exception type: {type(e).__name__}")
        print(f"[DEBUG] Exception details: {str(e)}")
        print(f"Error extracting text: {str(e)}")
        raise


def convert_pdf_to_image(gcs_uri: str) -> bytes:
    """
    Convert PDF from GCS to image bytes.
    
    Args:
        gcs_uri: GCS URI like gs://bucket/path/to/file.pdf
        
    Returns:
        bytes: PNG image bytes of first page
    """
    try:
        print(f"[DEBUG] Converting PDF to image: {gcs_uri}")
        
        # Parse gs:// URI
        uri_parts = gcs_uri.replace("gs://", "").split("/", 1)
        bucket_name = uri_parts[0]
        blob_path = uri_parts[1]
        
        # Download PDF from GCS
        storage_client = storage.Client()
        bucket = storage_client.bucket(bucket_name)
        blob = bucket.blob(blob_path)
        pdf_bytes = blob.download_as_bytes()
        
        print(f"[DEBUG] Downloaded PDF, size: {len(pdf_bytes)} bytes")
        
        # Open PDF with PyMuPDF
        pdf_document = fitz.open(stream=pdf_bytes, filetype="pdf")
        
        # Get first page (most receipts are single page)
        first_page = pdf_document[0]
        
        # Render page to image at high DPI for better OCR
        # 300 DPI is good for OCR
        zoom = 300 / 72  # 72 is default DPI
        mat = fitz.Matrix(zoom, zoom)
        pix = first_page.get_pixmap(matrix=mat)
        
        # Convert to PIL Image
        img = Image.frombytes("RGB", [pix.width, pix.height], pix.samples)
        
        # Convert to PNG bytes
        img_bytes = io.BytesIO()
        img.save(img_bytes, format='PNG', optimize=True)
        img_bytes = img_bytes.getvalue()
        
        pdf_document.close()
        
        print(f"[DEBUG] Converted to PNG, size: {len(img_bytes)} bytes")
        return img_bytes
        
    except Exception as e:
        print(f"[DEBUG] Error converting PDF: {str(e)}")
        raise Exception(f"Failed to convert PDF to image: {str(e)}")


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
        
        # Use the vision_client's credentials to create a storage client
        from google.cloud import storage
        if settings.GOOGLE_APPLICATION_CREDENTIALS.startswith('{'):
            credentials_dict = json.loads(settings.GOOGLE_APPLICATION_CREDENTIALS)
            storage_client = storage.Client(credentials=credentials, project=credentials_dict['project_id'])
        else:
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
        system_prompt = """You are a receipt parser specialized in UK receipts. Extract structured data from receipt text and categorize expenses according to HMRC allowable expense categories.
        
HMRC Expense Categories:
- Office Costs: Stationery, phone bills, internet, software
- Travel Costs: Fuel, parking, train/bus fares, taxis, business mileage
- Clothing: Uniforms, protective clothing (not everyday clothes)
- Staff Costs: Salaries, subcontractor costs, wages
- Stock and Materials: Things you buy to sell on, raw materials
- Financial Costs: Insurance, bank charges, professional subscriptions
- Business Premises: Heating, lighting, business rates, rent
- Advertising and Marketing: Website costs, promotional materials, advertising
- Training and Development: Business-related courses, professional development
- Other: Any other business expense not fitting above categories

Rules:
- Extract vendor name (business name)
- Extract date in YYYY-MM-DD format
- Extract total amount as a number (no £ or $ symbol)
- Extract VAT/tax amount if present (look for "VAT", "Tax", "GST")
- Extract individual items with names and prices
- Auto-categorize based on vendor and items (use category names exactly as listed above)
- If you can't find something, use null
- For UK receipts, VAT is typically 20% and shown separately

Return valid JSON only, no explanation."""

        user_prompt = f"""Parse this receipt text into JSON:

{raw_text}

Required JSON format:
{{
    "vendor": "string or null",
    "date": "YYYY-MM-DD or null",
    "total_amount": number or null,
    "tax_amount": number or null,
    "category": "HMRC category name or null",
    "items": [
        {{"name": "string", "price": number}}
    ]
}}

Note: Look for VAT amount on UK receipts - it's usually labeled as "VAT" or "Tax". 
Categorize based on vendor and items purchased using the HMRC categories provided."""

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
            "category": None,
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
    from app.services.audit import log_status_change, log_ocr_completed
    
    # Get receipt from database
    receipt = db.query(Receipt).filter(Receipt.id == receipt_id).first()
    
    if not receipt:
        raise Exception(f"Receipt {receipt_id} not found")
    
    try:
        # Update status to PROCESSING
        old_status = receipt.status.value
        receipt.status = ReceiptStatus.PROCESSING
        db.commit()
        log_status_change(db, receipt_id, old_status, receipt.status.value)
        
        # Step 1: Extract text from image (and get preview URL if PDF)
        print(f"Extracting text from receipt {receipt_id}...")
        raw_text, preview_url = extract_text_from_receipt(receipt.image_url, receipt.user_id)
        
        # If PDF was converted, update image_url to point to preview
        if preview_url:
            print(f"[DEBUG] Updating image_url to preview: {preview_url}")
            receipt.image_url = preview_url
        
        # Save raw text to database
        receipt.ocr_raw_text = raw_text
        db.commit()
        
        # Step 2: Parse text with AI
        print(f"Parsing receipt data with AI...")
        parsed_data = parse_receipt_with_ai(raw_text)
        
        # Step 3: Update receipt with parsed data
        extracted_fields = {}
        
        if parsed_data.get("vendor"):
            receipt.vendor = parsed_data["vendor"]
            extracted_fields["vendor"] = parsed_data["vendor"]
        
        if parsed_data.get("date"):
            # Parse date string to datetime
            try:
                receipt.date = datetime.strptime(parsed_data["date"], "%Y-%m-%d").date()
                extracted_fields["date"] = parsed_data["date"]
            except:
                pass  # Keep null if date parsing fails
        
        if parsed_data.get("total_amount") is not None:
            receipt.total_amount = float(parsed_data["total_amount"])
            extracted_fields["total_amount"] = parsed_data["total_amount"]
        
        if parsed_data.get("tax_amount") is not None:
            receipt.tax_amount = float(parsed_data["tax_amount"])
            extracted_fields["tax_amount"] = parsed_data["tax_amount"]
        
        if parsed_data.get("items"):
            # Store items as JSON string
            receipt.items = json.dumps(parsed_data["items"])
            extracted_fields["items"] = parsed_data["items"]
        
        if parsed_data.get("category"):
            # Map AI category to ExpenseCategory enum
            from app.models.receipt import ExpenseCategory
            category_str = parsed_data["category"]
            
            # Try to match to enum value
            try:
                # Find enum by value (display name)
                for cat in ExpenseCategory:
                    if cat.value == category_str:
                        receipt.category = cat
                        extracted_fields["category"] = category_str
                        break
            except:
                pass  # Keep null if category doesn't match
        
        # Mark as PENDING (awaiting user review and approval)
        old_status = receipt.status.value
        receipt.status = ReceiptStatus.PENDING
        db.commit()
        
        # Log OCR completion and status change
        log_ocr_completed(db, receipt_id, extracted_fields)
        log_status_change(db, receipt_id, old_status, receipt.status.value)
        
        # Check for duplicates after OCR completes
        from app.services.duplicate_detection import check_for_duplicates
        try:
            is_duplicate = check_for_duplicates(receipt, db)
            if is_duplicate:
                print(f"Receipt {receipt_id} flagged as possible duplicate")
        except Exception as e:
            # Don't fail OCR if duplicate detection fails
            print(f"Duplicate detection failed for receipt {receipt_id}: {str(e)}")
        
        db.refresh(receipt)
        
        print(f"Receipt {receipt_id} processed successfully! Awaiting user review.")
        return receipt
        
    except Exception as e:
        # Mark as failed on any error
        old_status = receipt.status.value
        receipt.status = ReceiptStatus.FAILED
        db.commit()
        log_status_change(db, receipt_id, old_status, receipt.status.value)
        
        print(f"Failed to process receipt {receipt_id}: {str(e)}")
        raise