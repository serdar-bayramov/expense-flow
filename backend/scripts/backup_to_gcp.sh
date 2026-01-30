#!/bin/bash
# Backup to GCP Cloud Storage
# Cost: $0.020/GB/month (cheaper than S3!)
# 
# Setup:
# 1. Create GCP bucket: gsutil mb gs://expenseflow-backups
# 2. Set credentials: export GOOGLE_APPLICATION_CREDENTIALS=/path/to/gcp-key.json
# 3. Run: railway run ./scripts/backup_to_gcp.sh

set -e

# Configuration
GCP_BUCKET="expenseflow-backups"  # Change to your bucket name
DATE=$(date +%Y-%m-%d_%H-%M-%S)
BACKUP_FILE="/tmp/expenseflow_$DATE.sql.gz"

echo "🔄 Starting GCP backup at $DATE..."

# Check if gsutil is installed
if ! command -v gsutil &> /dev/null; then
    echo "❌ gsutil not found. Install: pip install gsutil"
    exit 1
fi

# Check DATABASE_URL
if [ -z "$DATABASE_URL" ]; then
    echo "❌ DATABASE_URL not set. Run: railway run ./scripts/backup_to_gcp.sh"
    exit 1
fi

# Create backup
echo "📦 Dumping database..."
pg_dump "$DATABASE_URL" | gzip > "$BACKUP_FILE"

# Get file size
SIZE=$(du -h "$BACKUP_FILE" | cut -f1)
echo "📊 Backup size: $SIZE"

# Upload to GCP Cloud Storage
echo "☁️  Uploading to GCP Cloud Storage..."
gsutil cp "$BACKUP_FILE" "gs://$GCP_BUCKET/backups/$(basename $BACKUP_FILE)"

# Clean up local file
rm "$BACKUP_FILE"

# Delete backups older than 30 days (save money)
echo "🧹 Cleaning old GCP backups (keeping last 30 days)..."
gsutil ls "gs://$GCP_BUCKET/backups/" | while read file; do
    # Extract date from filename (format: expenseflow_YYYY-MM-DD_HH-MM-SS.sql.gz)
    filename=$(basename "$file")
    file_date=$(echo "$filename" | grep -oE '[0-9]{4}-[0-9]{2}-[0-9]{2}' | head -1)
    
    if [ -n "$file_date" ]; then
        # Calculate age in days
        if [[ "$OSTYPE" == "darwin"* ]]; then
            # macOS
            file_epoch=$(date -j -f "%Y-%m-%d" "$file_date" +%s 2>/dev/null || echo 0)
        else
            # Linux
            file_epoch=$(date -d "$file_date" +%s 2>/dev/null || echo 0)
        fi
        
        now_epoch=$(date +%s)
        days_old=$(( ($now_epoch - $file_epoch) / 86400 ))
        
        if [ $days_old -gt 30 ]; then
            echo "  Deleting old backup: $filename (${days_old} days old)"
            gsutil rm "$file"
        fi
    fi
done

echo ""
echo "✅ Backup complete!"
echo "📍 Location: gs://$GCP_BUCKET/backups/expenseflow_$DATE.sql.gz"
echo ""

# List recent backups
echo "📊 Recent backups:"
gsutil ls -lh "gs://$GCP_BUCKET/backups/" | tail -5

echo ""
echo "💡 To restore:"
echo "   gsutil cp gs://$GCP_BUCKET/backups/expenseflow_$DATE.sql.gz - | gunzip | railway run psql \$DATABASE_URL"
