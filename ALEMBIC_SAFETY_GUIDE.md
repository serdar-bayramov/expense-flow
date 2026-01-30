# Alembic Migration Safety Guide

## ✅ Current Status (30 Jan 2026)

### All Models Properly Registered
```python
# backend/app/models/__init__.py
✅ User
✅ Receipt
✅ Category
✅ AuditLog
✅ MileageClaim
✅ ProcessedEmail
✅ JourneyTemplate
```

### Migration Review Completed
- ✅ All `op.drop_table()` calls are in `downgrade()` functions only (correct)
- ✅ No accidental drops in `upgrade()` functions
- ✅ One intentional drop: `d17f77c24fbb_drop_invite_codes_table.py` (invite_codes removed by design)

---

## 🚨 Rules to Prevent Table Drops

### Rule 1: ALWAYS Register New Models
**Before creating a migration, ensure the model is imported in `__init__.py`:**

```python
# backend/app/models/__init__.py
from app.models.your_new_model import YourNewModel

__all__ = [..., "YourNewModel"]  # Add to exports
```

**Why:** Alembic only sees models that are imported. If a model isn't imported, Alembic thinks the table should be removed!

### Rule 2: Review Auto-Generated Migrations
**Never blindly trust `alembic revision --autogenerate`:**

```bash
# After generating a migration:
alembic revision --autogenerate -m "description"

# ALWAYS review the generated file:
cat alembic/versions/<new_file>.py
```

**Look for dangerous operations:**
- ❌ `op.drop_table()` in `upgrade()` 
- ❌ `op.drop_column()` in `upgrade()` for existing columns
- ❌ `op.drop_index()` in `upgrade()` for existing indexes

### Rule 3: Use Manual SQL for Sensitive Operations
**For tables created manually or outside Alembic:**

```python
def upgrade() -> None:
    # Check if table exists first
    conn = op.get_bind()
    inspector = sa.inspect(conn)
    
    if 'your_table' not in inspector.get_table_names():
        # Safe to create
        op.create_table(...)
```

### Rule 4: Test Migrations Locally First
```bash
# 1. Backup your local DB
pg_dump expense_flow > backup.sql

# 2. Run migration locally
alembic upgrade head

# 3. Verify tables exist
psql expense_flow -c "\dt"

# 4. Test rollback
alembic downgrade -1
alembic upgrade head
```

---

## 📝 Safe Migration Workflow

### Creating a New Model
1. **Create the model file:** `app/models/new_model.py`
2. **Register in `__init__.py`:** Add import and to `__all__`
3. **Generate migration:** `alembic revision --autogenerate -m "add_new_model"`
4. **Review generated file:** Check for accidental drops
5. **Test locally:** Run `alembic upgrade head`
6. **Commit and push:** Deploy to Railway

### Modifying Existing Model
1. **Update model file:** Change columns/relationships
2. **Verify in `__init__.py`:** Model is still imported
3. **Generate migration:** `alembic revision --autogenerate -m "update_model"`
4. **Review carefully:** Ensure no data loss operations
5. **Test with real data:** Use a copy of production DB
6. **Deploy:** Push to Railway

### Dropping a Table (Intentionally)
1. **Remove from code first:** Delete model file, remove from `__init__.py`
2. **Generate migration:** `alembic revision --autogenerate -m "drop_old_table"`
3. **Review:** Confirm drop is in `upgrade()` (this is one case where it's correct)
4. **Backup production data:** Before deploying!
5. **Deploy with caution**

---

## 🔍 Migration Checklist

Before pushing ANY migration to Railway:

- [ ] All models in `app/models/` are imported in `__init__.py`
- [ ] Reviewed the generated migration file
- [ ] No `op.drop_table()` in `upgrade()` unless intentional
- [ ] No `op.drop_column()` for columns still in use
- [ ] Tested locally with `alembic upgrade head`
- [ ] Tested rollback with `alembic downgrade -1`
- [ ] Verified app still works after migration
- [ ] Production backup taken (if dropping data)

---

## 🛠️ Common Alembic Commands

```bash
# Generate new migration from model changes
alembic revision --autogenerate -m "description"

# Apply all pending migrations
alembic upgrade head

# Rollback last migration
alembic downgrade -1

# Check current migration version
alembic current

# Show migration history
alembic history

# Create empty migration (for manual SQL)
alembic revision -m "description"

# Upgrade to specific version
alembic upgrade <revision_id>
```

---

## 🚫 What Went Wrong (Lesson Learned)

### The Journey Templates Incident

**Timeline:**
1. ✅ Manually created `journey_templates` table with raw SQL
2. ✅ Created model `app/models/journey_template.py`
3. ❌ **FORGOT** to add to `app/models/__init__.py`
4. 🔴 Ran `alembic revision --autogenerate` for subscription fields
5. 🔴 Alembic couldn't see JourneyTemplate model
6. 🔴 Generated migrations with `op.drop_table('journey_templates')` in `upgrade()`
7. 💥 Deployed to Railway → Table deleted!

**Fixes Applied:**
- ✅ Added `JourneyTemplate` to `__init__.py`
- ✅ Removed `op.drop_table()` from both problematic migrations
- ✅ Created new migration to recreate the table

**Prevention:**
- Always register models in `__init__.py` BEFORE generating migrations
- Always review auto-generated migrations before committing
- Never trust Alembic blindly!

---

## 📊 Current Migration Chain

```
644e419d84b5 → Initial migration (users, receipts, categories)
└─ 9b984a6823ef → Add duplicate detection
   └─ 1ea01d592526 → Add journey_templates (manual SQL)
      └─ 29672f48c359 → Add subscriptions (accidentally dropped journey_templates - FIXED)
         └─ bcc6094025fa → Add processed_emails
            └─ d17f77c24fbb → Drop invite_codes (intentional)
               └─ 584f6de0598c → Add clerk_user_id
                  └─ c8a88100c2ca → Add subscription fields (accidentally dropped journey_templates - FIXED)
                     └─ 01944f3c6224 → Recreate journey_templates ← YOU ARE HERE
```

---

## 💡 Pro Tips

1. **Use `checkfirst=True`** when creating types/enums:
   ```python
   my_enum.create(conn, checkfirst=True)
   ```

2. **Always check table existence** for manual creations:
   ```python
   if 'table_name' not in inspector.get_table_names():
       op.create_table(...)
   ```

3. **Comment your migrations** explaining WHY:
   ```python
   # This drop is intentional - invite_codes feature removed for public launch
   op.drop_table('invite_codes')
   ```

4. **Keep `__init__.py` up to date** - treat it like a checklist!

5. **Never edit applied migrations** - always create a new one to fix issues

---

## 🎯 Summary

**Golden Rule:** If your model exists in `app/models/`, it MUST be in `__init__.py`!

**Safety Net:** Always review auto-generated migrations before deploying.

**Recovery:** Migrations are version-controlled - you can always fix issues with a new migration.
