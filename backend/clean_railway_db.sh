#!/bin/bash

# Clean Railway Production Database
# This script truncates the users table and all related data in the production database
# 
# Usage: 
#   1. Get your Railway PostgreSQL connection URL from the Railway dashboard
#   2. Run: ./clean_railway_db.sh "postgresql://user:pass@host:port/database"

if [ -z "$1" ]; then
    echo "❌ Error: DATABASE_URL not provided"
    echo ""
    echo "Usage: ./clean_railway_db.sh \"postgresql://user:pass@host:port/database\""
    echo ""
    echo "To get your DATABASE_URL:"
    echo "  1. Go to Railway dashboard"
    echo "  2. Click on PostgreSQL service"
    echo "  3. Go to Variables tab"
    echo "  4. Copy the DATABASE_URL value"
    exit 1
fi

DATABASE_URL="$1"

echo "⚠️  WARNING: This will DELETE ALL USERS and related data from production!"
echo ""
echo "Tables that will be affected:"
echo "  - users (all user accounts)"
echo "  - receipts (all receipt data)"
echo "  - mileage_claims (all mileage data)"
echo "  - journey_templates (all saved templates)"
echo "  - audit_logs (all activity history)"
echo "  - processed_emails (email processing history)"
echo ""
read -p "Are you sure you want to continue? (type 'yes' to confirm): " confirm

if [ "$confirm" != "yes" ]; then
    echo "❌ Aborted. No changes made."
    exit 0
fi

echo ""
echo "🔄 Connecting to Railway database..."
echo ""

psql "$DATABASE_URL" -c "TRUNCATE TABLE users CASCADE;"

if [ $? -eq 0 ]; then
    echo ""
    echo "✅ Success! All users and related data have been deleted from production."
    echo ""
    echo "📝 Next steps:"
    echo "  1. Make sure CLERK_SECRET_KEY is set in Railway backend environment"
    echo "  2. Deploy the latest backend code with Clerk authentication"
    echo "  3. Test authentication with a fresh sign up"
else
    echo ""
    echo "❌ Failed to truncate table. Check your DATABASE_URL and try again."
    exit 1
fi
