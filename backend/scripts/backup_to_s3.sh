#!/bin/bash
# Backup to AWS S3 (recommended for production-ready startups)
# Cost: ~$0.023/GB/month (super cheap!)

set -e

# Configuration
S3_BUCKET="expenseflow-db-backups"  # Change to your bucket name
DATE=$(date +%Y-%m-%d_%H-%M-%S)
BACKUP_FILE="/tmp/expenseflow_$DATE.sql.gz"

echo "🔄 Starting S3 backup at $DATE..."

# Create backup
echo "📦 Dumping database..."
pg_dump "$DATABASE_URL" | gzip > "$BACKUP_FILE"

# Upload to S3
echo "☁️  Uploading to S3..."
aws s3 cp "$BACKUP_FILE" "s3://$S3_BUCKET/backups/$(basename $BACKUP_FILE)"

# Clean up local file
rm "$BACKUP_FILE"

# Delete backups older than 30 days (save money)
echo "🧹 Cleaning old S3 backups..."
aws s3 ls "s3://$S3_BUCKET/backups/" | \
  awk '{print $4}' | \
  while read file; do
    # Get file date from filename
    file_date=$(echo $file | grep -oP '\d{4}-\d{2}-\d{2}')
    if [ -n "$file_date" ]; then
      file_epoch=$(date -d "$file_date" +%s 2>/dev/null || date -j -f "%Y-%m-%d" "$file_date" +%s)
      now_epoch=$(date +%s)
      days_old=$(( ($now_epoch - $file_epoch) / 86400 ))
      
      if [ $days_old -gt 30 ]; then
        echo "Deleting old backup: $file (${days_old} days old)"
        aws s3 rm "s3://$S3_BUCKET/backups/$file"
      fi
    fi
  done

echo "✅ Backup complete!"
echo "📍 Location: s3://$S3_BUCKET/backups/$(basename $BACKUP_FILE)"

# List recent backups
echo ""
echo "📊 Recent backups:"
aws s3 ls "s3://$S3_BUCKET/backups/" --human-readable | tail -5
