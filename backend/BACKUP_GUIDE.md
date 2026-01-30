# Database Backup Guide

## Three Backup Options

### 1. **Local Machine Backups** (Manual, FREE)
**Best for:** Development, quick backups before risky migrations

**How to run:**
```bash
cd backend
railway run ./scripts/backup_database.sh
```

**Where saved:** `~/expense-flow-backups/`

**Retention:** Last 7 backups (auto-cleanup)

**Pros:**
- ✅ Free
- ✅ Full control
- ✅ Instant access

**Cons:**
- ❌ Manual (you must remember to run)
- ❌ Only on your machine
- ❌ Lost if your machine fails

**When to use:**
- Before deploying risky migrations
- Before making schema changes
- Weekly manual backups

---

### 2. **GCP Cloud Storage** (Automated, ~$0.02/GB/month) ⭐ **RECOMMENDED**
**Best for:** Production, automated daily backups

**Setup (one-time):**
```bash
# 1. Create GCP bucket
gsutil mb gs://expenseflow-backups

# 2. Make bucket private
gsutil iam ch allUsers:objectViewer gs://expenseflow-backups

# 3. Set lifecycle (auto-delete after 90 days)
gsutil lifecycle set - <<EOF gs://expenseflow-backups
{
  "lifecycle": {
    "rule": [{
      "action": {"type": "Delete"},
      "condition": {"age": 90}
    }]
  }
}
EOF
```

**Manual backup:**
```bash
cd backend
export GOOGLE_APPLICATION_CREDENTIALS=./credentials/gcp-key.json
railway run ./scripts/backup_to_gcp.sh
```

**Automated backup (GitHub Actions):**
- Runs daily at 3 AM UTC
- Saves to GCP Cloud Storage
- Keeps 30 days of backups
- Auto-deletes old backups

**Pros:**
- ✅ Automated (set and forget)
- ✅ Cheap (~$0.60/month for 30GB)
- ✅ Professional infrastructure
- ✅ Accessible from anywhere
- ✅ Can restore to any environment

**Cons:**
- ❌ Costs money (minimal)
- ❌ Requires GCP setup

**Cost estimate:**
```
Daily backups: ~100MB each
30 days: 100MB × 30 = 3GB
Cost: 3GB × $0.020 = $0.06/month

After 1 year: ~36GB
Cost: ~$0.72/month
```

**When to use:**
- Production database
- Automated daily backups
- Peace of mind while sleeping

---

### 3. **GitHub Actions Artifacts** (Automated, FREE, Limited)
**Best for:** Recent backups (last 7-30 days)

**How it works:**
- GitHub Actions runs daily
- Creates backup
- Uploads to GCP (primary)
- Also saves to GitHub Artifacts (backup of backup)

**Where to access:**
1. Go to: https://github.com/yourusername/expense-flow/actions
2. Click on "Database Backup to GCP" workflow
3. Click latest run
4. Download from "Artifacts" section

**Pros:**
- ✅ Free
- ✅ Automated
- ✅ Easy to download

**Cons:**
- ❌ Only keeps 7-90 days (you choose)
- ❌ Manual download
- ❌ Not meant for long-term storage

**When to use:**
- As secondary backup (belt and suspenders)
- When you need to grab yesterday's backup quickly
- Testing restore procedures

---

## Setup Instructions

### Option 1: Local Backups Only (Start Here)
```bash
# Just run manually when needed
cd backend
railway run ./scripts/backup_database.sh
```

### Option 2: GCP Cloud Storage (Production-Ready)

**Step 1: Create GCP Bucket**
```bash
# Install gcloud CLI if not installed
brew install google-cloud-sdk  # macOS
# or: apt-get install google-cloud-sdk  # Linux

# Login
gcloud auth login

# Create bucket
gsutil mb -p YOUR_GCP_PROJECT_ID gs://expenseflow-backups

# Verify
gsutil ls
```

**Step 2: Test Manual Backup**
```bash
cd backend
export GOOGLE_APPLICATION_CREDENTIALS=./credentials/gcp-key.json
railway run ./scripts/backup_to_gcp.sh
```

**Step 3: Set Up GitHub Actions**

Add these secrets to your GitHub repo (Settings → Secrets):

```
RAILWAY_DATABASE_URL - Your Railway DB connection string
GCP_SA_KEY - Contents of your gcp-key.json file
GCP_PROJECT_ID - Your GCP project ID
```

**Step 4: Enable Workflow**
The workflow will run automatically daily at 3 AM UTC.

To test immediately:
1. Go to GitHub Actions tab
2. Click "Database Backup to GCP"
3. Click "Run workflow"

---

## How to Restore a Backup

### From Local Backup:
```bash
# List backups
ls -lh ~/expense-flow-backups/

# Restore specific backup
gunzip -c ~/expense-flow-backups/expenseflow_2026-01-30_10-30-00.sql.gz | \
  railway run psql $DATABASE_URL
```

### From GCP:
```bash
# List backups
gsutil ls -lh gs://expenseflow-backups/backups/

# Restore specific backup
gsutil cp gs://expenseflow-backups/backups/expenseflow_2026-01-30_10-30-00.sql.gz - | \
  gunzip | \
  railway run psql $DATABASE_URL
```

### From GitHub Artifacts:
1. Download artifact from Actions tab
2. Unzip file
3. Run: `gunzip -c expenseflow_*.sql.gz | railway run psql $DATABASE_URL`

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
