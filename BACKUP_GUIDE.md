# Database Backup Guide

## 🛡️ Current Status

✅ **Your database is protected!**

**Active Protection:**
- ✅ Manual backups: `railway run ./scripts/backup_database.sh`
  - Saves locally: `~/expense-flow-backups/` (last 7)
  - Auto-uploads to GCP: `gs://expense-flow-backups/backups/` (last 30 days)
- ✅ GitHub Actions: Scheduled daily at 3:00 AM UTC
  - Runs automatically every night
  - Uploads to GCP Cloud Storage
  - Also saves to GitHub Artifacts (7-day quick access)
- ✅ PostgreSQL 17 installed (matches Railway version)
- ✅ GCP credentials configured

**Cost:** ~$0.06/month (GitHub Actions is free, GCP storage is $0.020/GB)

**Quick Commands:**
```bash
# Run backup now
cd backend && railway run ./scripts/backup_database.sh

# List GCP backups
gsutil ls -lh gs://expense-flow-backups/backups/

# Emergency restore
gsutil cat gs://expense-flow-backups/backups/expenseflow_LATEST.sql.gz | gunzip | railway run psql $DATABASE_URL
```

---

## Three Backup Options

### 1. **Local Machine Backups** (Manual, FREE) + Auto-upload to GCP
**Best for:** Development, quick backups before risky migrations

**Prerequisites:**
```bash
# 1. Install PostgreSQL 17 (must match Railway version)
brew install postgresql@17
brew link --overwrite postgresql@17

# 2. Authenticate with GCP (one-time)
export GOOGLE_APPLICATION_CREDENTIALS=/Users/serdarbayramov/Projects/expense-flow/backend/credentials/gcp-key.json
gcloud auth activate-service-account --key-file=$GOOGLE_APPLICATION_CREDENTIALS
```

**How to run:**
```bash
cd backend
railway run ./scripts/backup_database.sh
```

**What happens:**
1. ✅ Creates local backup: `~/expense-flow-backups/expenseflow_YYYY-MM-DD_HH-MM-SS.sql.gz`
2. ✅ Automatically uploads to GCP: `gs://expense-flow-backups/backups/`
3. ✅ Cleans up old backups (keeps last 7 local, last 30 days in GCP)

**Where saved:** 
- Local: `~/expense-flow-backups/` (last 7 backups)
- GCP: `gs://expense-flow-backups/backups/` (last 30 days)

**Output example:**
```
🔄 Starting backup at 2026-01-30_11-05-01...
📦 Connecting to Railway database and dumping...
🗜️  Compressing backup...
✅ Local backup complete: ~/expense-flow-backups/expenseflow_2026-01-30_11-05-01.sql.gz (8.5K)
☁️  Uploading to GCP Cloud Storage...
✅ Uploaded to GCP: gs://expense-flow-backups/backups/expenseflow_2026-01-30_11-05-01.sql.gz
```

**Pros:**
- ✅ Free (uses existing GCP bucket)
- ✅ Full control
- ✅ Instant local access
- ✅ Automatic cloud backup
- ✅ Dual protection (local + cloud)

**Cons:**
- ❌ Manual (you must remember to run)

**When to use:**
- ⚠️ **ALWAYS before deploying migrations**
- ⚠️ **ALWAYS before schema changes**
- Before dropping tables/columns
- Weekly manual backups for extra safety

---

### 2. **GitHub Actions Automated Backups** (Daily at 3 AM UTC, FREE) ⭐ **ACTIVE**
**Best for:** Hands-off automated daily backups

**Status:** ✅ **Already configured and running!**

**Schedule:** Every day at 3:00 AM UTC (11:00 PM PST / 7:00 AM GMT)

**What happens automatically:**
1. GitHub Actions wakes up at 3 AM UTC
2. Connects to Railway database
3. Creates backup with PostgreSQL 17 pg_dump
4. Compresses with gzip
5. Uploads to GCP: `gs://expense-flow-backups/backups/`
6. Also saves to GitHub Artifacts (7-day quick access)
7. Deletes GCP backups older than 30 days

**Where to view:**
- **GCP Storage:** https://console.cloud.google.com/storage/browser/expense-flow-backups
- **GitHub Artifacts:** https://github.com/YOUR_USERNAME/expense-flow/actions → "Database Backup to GCP" workflow

**Configuration file:** `.github/workflows/database-backup.yml`

**Required secrets (already set):**
```
RAILWAY_DATABASE_URL - Railway Postgres connection string
GCP_SA_KEY - Contents of backend/credentials/gcp-key.json  
GCP_PROJECT_ID - Your GCP project ID
```

**How to verify it's working:**
```bash
# Check recent backups
gsutil ls -lh gs://expense-flow-backups/backups/ | tail -10

# View workflow runs
# Go to: https://github.com/YOUR_USERNAME/expense-flow/actions
```

**Pros:**
- ✅ Fully automated (zero maintenance)
- ✅ FREE (GitHub Actions free tier: 2,000 minutes/month, this uses ~5 min/month)
- ✅ Saves to GCP (professional storage)
- ✅ Also saves to GitHub Artifacts (7-day quick access)
- ✅ Automatic cleanup (30-day retention)
- ✅ Runs even when you're sleeping
- ✅ Email notifications if backup fails

**Cons:**
- ❌ Fixed schedule (can't change without editing workflow)
- ❌ Relies on GitHub uptime

**Cost estimate:**
```
GitHub Actions: FREE (well within 2,000 min/month limit)
GCP Storage: ~$0.06/month (100MB × 30 days)
Total: $0.06/month = $0.72/year
```

**Manual trigger (if needed):**
1. Go to https://github.com/YOUR_USERNAME/expense-flow/actions
2. Click "Database Backup to GCP" workflow
3. Click "Run workflow" button
4. Select branch: main
5. Click "Run workflow"

**When to rely on this:**
- Production database protection
- Daily automated backups
- Peace of mind while sleeping
- Disaster recovery capability

---

### 3. **Manual GCP Backup Script** (On-Demand)
**Best for:** Testing GCP setup, manual cloud backups

**How to run:**
```bash
cd backend
export GOOGLE_APPLICATION_CREDENTIALS=./credentials/gcp-key.json
railway run ./scripts/backup_to_gcp.sh
```

**Note:** This is now redundant since the local backup script automatically uploads to GCP!

---

## Setup Instructions

### ✅ **You're Already Set Up!**

Your current setup:
- ✅ Local backups → `~/expense-flow-backups/`
- ✅ Auto-upload to GCP → `gs://expense-flow-backups/backups/`
- ✅ GitHub Actions scheduled for 3 AM UTC daily
- ✅ PostgreSQL 17 installed (matches Railway)
- ✅ GCP credentials authenticated

**To run a backup right now:**
```bash
cd backend
railway run ./scripts/backup_database.sh
```

**To configure GitHub Actions secrets:**
1. Go to: https://github.com/YOUR_USERNAME/expense-flow/settings/secrets/actions
2. Click "New repository secret"
3. Add these three secrets:

```
Name: RAILWAY_DATABASE_URL
Value: [Get from Railway dashboard → Database → Connect → Connection URL (Public)]

Name: GCP_SA_KEY  
Value: [Paste entire contents of backend/credentials/gcp-key.json]

Name: GCP_PROJECT_ID
Value: [Your GCP project ID, e.g., "expense-flow-receipts"]
```

4. Save each secret
5. Test workflow: Actions tab → "Database Backup to GCP" → "Run workflow"

---

## Exploring Your Backups

### List All Backups
```bash
# Local backups
ls -lh ~/expense-flow-backups/

# GCP backups (with file sizes)
gsutil ls -lh gs://expense-flow-backups/backups/

# GCP backups (sorted by date)
gsutil ls gs://expense-flow-backups/backups/ | sort
```

### View Backup Contents

**See first 50 lines (table structures):**
```bash
gsutil cat gs://expense-flow-backups/backups/expenseflow_2026-01-30_11-05-01.sql.gz | gunzip | head -50
```

**See actual user data:**
```bash
gsutil cat gs://expense-flow-backups/backups/expenseflow_2026-01-30_11-05-01.sql.gz | gunzip | grep -A 10 "COPY public.users"
```

**See receipt data:**
```bash
gsutil cat gs://expense-flow-backups/backups/expenseflow_2026-01-30_11-05-01.sql.gz | gunzip | grep -A 10 "COPY public.receipts"
```

**Count rows in backup:**
```bash
# Count users
gsutil cat gs://expense-flow-backups/backups/expenseflow_2026-01-30_11-05-01.sql.gz | gunzip | grep "COPY public.users" -A 1000 | grep -c "^[0-9]"

# Count receipts
gsutil cat gs://expense-flow-backups/backups/expenseflow_2026-01-30_11-05-01.sql.gz | gunzip | grep "COPY public.receipts" -A 1000 | grep -c "^[0-9]"
```

**Download and examine locally:**
```bash
# Download specific backup
gsutil cp gs://expense-flow-backups/backups/expenseflow_2026-01-30_11-05-01.sql.gz ~/Downloads/

# Unzip
gunzip ~/Downloads/expenseflow_2026-01-30_11-05-01.sql.gz

# View in text editor
code ~/Downloads/expenseflow_2026-01-30_11-05-01.sql
# or
less ~/Downloads/expenseflow_2026-01-30_11-05-01.sql
```

### Verify Backup is Complete
```bash
# Should see all your tables
gsutil cat gs://expense-flow-backups/backups/expenseflow_2026-01-30_11-05-01.sql.gz | gunzip | grep "CREATE TABLE" 

# Expected output:
# CREATE TABLE public.users
# CREATE TABLE public.receipts
# CREATE TABLE public.categories
# CREATE TABLE public.audit_logs
# CREATE TABLE public.mileage_claims
# CREATE TABLE public.processed_emails
# CREATE TABLE public.journey_templates
# CREATE TABLE public.invite_codes
```

---

## How to Restore a Backup

### 🚨 **Emergency Restore (Railway DB is lost or corrupted)**

**Option 1: Restore from most recent GCP backup**
```bash
# 1. Find latest backup
gsutil ls -lh gs://expense-flow-backups/backups/ | tail -5

# 2. Restore directly (one command)
gsutil cat gs://expense-flow-backups/backups/expenseflow_2026-01-30_11-05-01.sql.gz | gunzip | railway run psql $DATABASE_URL
```

**Option 2: Restore from local backup**
```bash
# 1. Find latest local backup
ls -lh ~/expense-flow-backups/

# 2. Restore
gunzip -c ~/expense-flow-backups/expenseflow_2026-01-30_11-05-01.sql.gz | railway run psql $DATABASE_URL
```

**Option 3: Restore to completely new Railway database**
```bash
# 1. Create new Postgres database in Railway dashboard
# 2. Link it to your backend service
# 3. Get new DATABASE_PUBLIC_URL from Railway
# 4. Restore:
gsutil cat gs://expense-flow-backups/backups/expenseflow_2026-01-30_11-05-01.sql.gz | gunzip | psql "YOUR_NEW_DATABASE_PUBLIC_URL"
```

### 🧪 **Test Restore (Practice without affecting production)**

**Create local test database:**
```bash
# 1. Create test DB
createdb expenseflow_test

# 2. Restore backup to test DB
gsutil cat gs://expense-flow-backups/backups/expenseflow_2026-01-30_11-05-01.sql.gz | gunzip | psql expenseflow_test

# 3. Verify data
psql expenseflow_test -c "SELECT COUNT(*) FROM users;"
psql expenseflow_test -c "SELECT COUNT(*) FROM receipts;"

# 4. Clean up
dropdb expenseflow_test
```

### 📅 **Restore to Specific Point in Time**

```bash
# 1. List all backups with dates
gsutil ls gs://expense-flow-backups/backups/

# 2. Pick specific date (e.g., January 28)
gsutil cat gs://expense-flow-backups/backups/expenseflow_2026-01-28_03-00-00.sql.gz | gunzip | railway run psql $DATABASE_URL
```

### ⚠️ **Important Restore Notes:**

**Before restoring to production:**
1. ✅ Stop your backend service (Railway dashboard → Stop)
2. ✅ Notify users (maintenance mode)
3. ✅ Make a final backup before restore!
4. ✅ Test restore on local database first

**After restore:**
1. ✅ Restart backend service
2. ✅ Check logs: `railway logs`
3. ✅ Verify data: Login to app, check receipts
4. ✅ Run health checks

---

## Backup Before Risky Migrations (CRITICAL!)

**Always run this before deploying migrations that drop tables:**

```bash
# 1. Backup
cd backend
railway run ./scripts/backup_database.sh

# 2. Deploy migration
git push origin main

# 3. Verify migration worked
railway logs

# 4. If it breaks, restore:
gunzip -c ~/expense-flow-backups/expenseflow_LATEST.sql.gz | \
  railway run psql $DATABASE_URL
```

---

## Cost Comparison

| Solution | Setup | Monthly Cost | Retention | Auto |
|----------|-------|--------------|-----------|------|
| Local | Easy | $0 | Until disk full | ❌ |
| GCP | Medium | $0.06-$1 | 30-90 days | ✅ |
| GitHub | Easy | $0 | 7-30 days | ✅ |
| Railway Pro | Easy | $20 | 7 days | ✅ |

**Recommended for startups:**
1. Start with **Local + GitHub Actions** (free)
2. Add **GCP** when you have paying customers (~$1/month)
3. Upgrade to **Railway Pro** when you're profitable (~$20/month)

---

## What Other Startups Do

**Pre-revenue (0-100 users):**
- Manual local backups before deploys
- GitHub Actions for daily backups
- Total cost: $0

**Early stage (100-1000 users):**
- GCP Cloud Storage daily backups
- Manual backups before risky changes
- Total cost: ~$1/month

**Growing (1000+ users):**
- Railway Pro (includes backups)
- GCP as secondary backup
- Total cost: ~$25/month

**Established ($10k+ MRR):**
- Railway Pro or RDS with automated backups
- Secondary backups to S3/GCP
- Backup monitoring/alerts
- Total cost: ~$100-500/month

---

## Quick Start (Do This Now!)

```bash
# 1. Test local backup
cd backend
railway run ./scripts/backup_database.sh

# 2. Commit the scripts
git add scripts/
git commit -m "Add database backup scripts"
git push origin main

# 3. Set reminder to run weekly backups
# Until you set up automated GCP backups
```

**Done!** You now have a safety net. 🎉
