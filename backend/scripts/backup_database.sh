#!/bin/bash
# Database Backup Script for Railway (Free Tier)
# Usage: ./scripts/backup_database.sh

set -e  # Exit on error

# Configuration
BACKUP_DIR="$HOME/expense-flow-backups"
DATE=$(date +%Y-%m-%d_%H-%M-%S)
BACKUP_FILE="$BACKUP_DIR/expenseflow_$DATE.sql"

# Create backup directory if it doesn't exist
mkdir -p "$BACKUP_DIR"

echo "🔄 Starting backup at $DATE..."

# Get DATABASE_URL from Railway
if [ -z "$DATABASE_URL" ]; then
    echo "❌ DATABASE_URL not set. Run: railway run ./scripts/backup_database.sh"
    exit 1
fi

# Create backup using pg_dump
echo "📦 Dumping database..."
pg_dump "$DATABASE_URL" > "$BACKUP_FILE"

# Compress the backup
echo "🗜️  Compressing backup..."
gzip "$BACKUP_FILE"
BACKUP_FILE="${BACKUP_FILE}.gz"

# Get file size
SIZE=$(du -h "$BACKUP_FILE" | cut -f1)

echo "✅ Backup complete: $BACKUP_FILE ($SIZE)"

# Keep only last 7 backups (save disk space)
echo "🧹 Cleaning old backups (keeping last 7)..."
ls -t "$BACKUP_DIR"/expenseflow_*.sql.gz | tail -n +8 | xargs -r rm

echo "📊 Current backups:"
ls -lh "$BACKUP_DIR"/expenseflow_*.sql.gz | tail -5

echo ""
echo "✅ Done! Backup saved to: $BACKUP_FILE"
echo ""
echo "💡 To restore: gunzip -c $BACKUP_FILE | railway run psql \$DATABASE_URL"
