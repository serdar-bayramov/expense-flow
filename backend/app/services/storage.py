from google.cloud import storage
from google.oauth2 import service_account
from fastapi import UploadFile, HTTPException
import uuid
import os
import io
import json
from datetime import timedelta
from app.core.database import settings

# Initialize Google Cloud Storage client
# Check if GOOGLE_APPLICATION_CREDENTIALS is a file path or JSON string
if settings.GOOGLE_APPLICATION_CREDENTIALS.startswith('{'):
    # It's a JSON string (for Railway/production)
    credentials_dict = json.loads(settings.GOOGLE_APPLICATION_CREDENTIALS)
    credentials = service_account.Credentials.from_service_account_info(credentials_dict)
    storage_client = storage.Client(credentials=credentials, project=credentials_dict['project_id'])
else:
    # It's a file path (for local development)
    os.environ["GOOGLE_APPLICATION_CREDENTIALS"] = settings.GOOGLE_APPLICATION_CREDENTIALS
    storage_client = storage.Client()


def upload_file_to_gcs(file: UploadFile, user_id: int) -> str:
    """
    Upload a file to Google Cloud Storage.
    
    Args:
        file: The uploaded file from FastAPI
        user_id: ID of the user uploading (for organizing files)
    
    Returns:
        str: Public URL of the uploaded file
    
    Raises:
        HTTPException: If file validation fails or upload errors
    """
    
    # 1. VALIDATE FILE TYPE
    # Only allow common image formats and PDFs
    allowed_types = ["image/jpeg", "image/jpg", "image/png", "application/pdf"]
    if file.content_type not in allowed_types:
        raise HTTPException(
            status_code=400,
            detail=f"Invalid file type. Allowed: jpg, png, pdf. Got: {file.content_type}"
        )
    
    # 2. VALIDATE FILE SIZE (10MB limit)
    # Read file to check size
    file_content = file.file.read()
    file_size_mb = len(file_content) / (1024 * 1024)  # Convert bytes to MB
    
    if file_size_mb > 10:
        raise HTTPException(
            status_code=400,
            detail=f"File too large. Max 10MB, got {file_size_mb:.2f}MB"
        )
    
    # Reset file pointer after reading (important!)
    file.file.seek(0)
    
    # 3. GENERATE UNIQUE FILENAME
    # Format: receipts/user_123/uuid-original-filename.jpg
    # This prevents filename collisions and organizes by user
    file_extension = file.filename.split(".")[-1]
    unique_filename = f"receipts/user_{user_id}/{uuid.uuid4()}-{file.filename}"
    
    # 4. UPLOAD TO GCS
    try:
        # Get the bucket object
        bucket = storage_client.bucket(settings.GCS_BUCKET_NAME)
        
        # Create a blob (file object in GCS)
        blob = bucket.blob(unique_filename)
        
        # Upload the file content
        blob.upload_from_file(file.file, content_type=file.content_type)
        
        # Return the public URL
        return blob.public_url
        
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Failed to upload file: {str(e)}"
        )


def delete_file_from_gcs(file_url: str) -> bool:
    """
    Delete a file from Google Cloud Storage.
    
    Args:
        file_url: Full public URL of the file to delete
        
    Returns:
        bool: True if deleted, False if file not found
    
    Example:
        delete_file_from_gcs("https://storage.googleapis.com/bucket/receipts/user_1/file.jpg")
    """
    
    try:
        # Extract blob name from URL
        # URL format: https://storage.googleapis.com/BUCKET_NAME/BLOB_PATH
        # We need just the BLOB_PATH part
        blob_name = file_url.split(f"{settings.GCS_BUCKET_NAME}/")[-1]
        
        # Get bucket and blob
        bucket = storage_client.bucket(settings.GCS_BUCKET_NAME)
        blob = bucket.blob(blob_name)
        
        # Delete the file
        blob.delete()
        
        return True
        
    except Exception as e:
        # File might not exist, log but don't crash
        print(f"Failed to delete file {file_url}: {str(e)}")
        return False


def save_image_to_gcs(image_bytes: bytes, original_url: str, user_id: int) -> str:
    """
    Save converted image bytes to GCS (for PDF previews).
    
    Args:
        image_bytes: PNG image bytes
        original_url: Original file URL (to derive the preview name)
        user_id: User ID for organizing files
        
    Returns:
        str: Public URL of the saved image
    """
    try:
        # Extract original filename and replace .pdf with _preview.png
        blob_name = original_url.split(f"{settings.GCS_BUCKET_NAME}/")[-1]
        preview_blob_name = blob_name.replace('.pdf', '_preview.png').replace('.PDF', '_preview.png')
        
        # Get bucket
        bucket = storage_client.bucket(settings.GCS_BUCKET_NAME)
        blob = bucket.blob(preview_blob_name)
        
        # Upload image bytes
        blob.upload_from_file(io.BytesIO(image_bytes), content_type='image/png')
        
        return blob.public_url
        
    except Exception as e:
        raise Exception(f"Failed to save preview image: {str(e)}")