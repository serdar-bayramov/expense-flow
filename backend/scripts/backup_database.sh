#!/bin/bash
# Database Backup Script for Railway (Free Tier)
# Usage: ./scripts/backup_database.sh

set -e  # Exit on error

# Configuration
BACKUP_DIR="$HOME/expense-flow-backups"
GCP_BUCKET="expense-flow-backups"  # Your GCP bucket name
DATE=$(date +%Y-%m-%d_%H-%M-%S)
BACKUP_FILE="$BACKUP_DIR/expenseflow_$DATE.sql.gz"

# Create backup directory if it doesn't exist
mkdir -p "$BACKUP_DIR"

echo "🔄 Starting backup at $DATE..."

# Create temporary uncompressed file first
TEMP_FILE="$BACKUP_DIR/expenseflow_$DATE.sql"

# Use Railway's PUBLIC database URL (not the internal one)
# railway run sets both DATABASE_URL (internal) and DATABASE_PUBLIC_URL (external)
echo "📦 Connecting to Railway database and dumping..."

if [ -z "$DATABASE_PUBLIC_URL" ]; then
    echo "❌ DATABASE_PUBLIC_URL not set. Make sure you're running: railway run ./scripts/backup_database.sh"
    exit 1
fi

# Use PostgreSQL 17 pg_dump to match Railway's version
# Check both Homebrew locations for pg_dump
if [ -f "/opt/homebrew/opt/postgresql@17/bin/pg_dump" ]; then
    PG_DUMP="/opt/homebrew/opt/postgresql@17/bin/pg_dump"
elif [ -f "/usr/local/opt/postgresql@17/bin/pg_dump" ]; then
    PG_DUMP="/usr/local/opt/postgresql@17/bin/pg_dump"
else
    # Fallback to system pg_dump (may cause version mismatch warning)
    PG_DUMP="pg_dump"
fi

$PG_DUMP "$DATABASE_PUBLIC_URL" > "$TEMP_FILE"

# Check if backup succeeded
if [ $? -ne 0 ] || [ ! -s "$TEMP_FILE" ]; then
    echo "❌ Backup failed. Check your Railway connection and pg_dump installation."
    rm -f "$TEMP_FILE"
    exit 1
fi

# Compress the backup
echo "🗜️  Compressing backup..."
gzip "$TEMP_FILE"

# Get file size
SIZE=$(du -h "$BACKUP_FILE" | cut -f1)

echo "✅ Local backup complete: $BACKUP_FILE ($SIZE)"

# Upload to GCP Cloud Storage
if command -v gsutil &> /dev/null; then
    echo "☁️  Uploading to GCP Cloud Storage (gs://$GCP_BUCKET)..."
    
    if gsutil cp "$BACKUP_FILE" "gs://$GCP_BUCKET/backups/" 2>/dev/null; then
        echo "✅ Uploaded to GCP: gs://$GCP_BUCKET/backups/expenseflow_$DATE.sql.gz"
        
        # Clean up old GCP backups (keep last 30 days)
        echo "🧹 Cleaning old GCP backups (older than 30 days)..."
        CUTOFF_DATE=$(date -u -v-30d +%Y-%m-%d 2>/dev/null || date -u -d '30 days ago' +%Y-%m-%d 2>/dev/null)
        gsutil ls "gs://$GCP_BUCKET/backups/" | while read file; do
            FILE_DATE=$(echo "$file" | grep -o '[0-9]\{4\}-[0-9]\{2\}-[0-9]\{2\}' | head -1)
            if [[ "$FILE_DATE" < "$CUTOFF_DATE" ]]; then
                echo "  Deleting old backup: $file"
                gsutil rm "$file" 2>/dev/null || true
            fi
        done
    else
        echo "⚠️  GCP upload failed (credentials issue?). Local backup is safe."
    fi
else
    echo "⚠️  gsutil not found. Skipping GCP upload (local backup is safe)."
    echo "💡 To enable GCP: brew install google-cloud-sdk"
fi

# Keep only last 7 backups (save disk space)
echo "🧹 Cleaning old local backups (keeping last 7)..."
ls -t "$BACKUP_DIR"/expenseflow_*.sql.gz | tail -n +8 | xargs -r rm

echo "📊 Current backups:"
ls -lh "$BACKUP_DIR"/expenseflow_*.sql.gz | tail -5

echo ""
echo "✅ Done! Backups saved:"
echo "   📁 Local: $BACKUP_FILE"
if command -v gsutil &> /dev/null; then
    echo "   ☁️  GCP: gs://$GCP_BUCKET/backups/expenseflow_$DATE.sql.gz"
fi
echo ""
echo "💡 To restore: gunzip -c $BACKUP_FILE | railway run psql \$DATABASE_URL"
echo "💡 To list GCP backups: gsutil ls gs://$GCP_BUCKET/backups/"
