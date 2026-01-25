"""Check Railway database migration status and run pending migrations"""
import os
import psycopg2
from psycopg2 import sql

# Railway database URL (public)
DATABASE_URL = "postgresql://postgres:wQqKFcnqzDkStuxARVrcfgUMVYZZmqfY@shortline.proxy.rlwy.net:23991/railway"

def check_migration_status():
    """Check which migrations have been applied"""
    conn = psycopg2.connect(DATABASE_URL)
    cursor = conn.cursor()
    
    # Check if alembic_version table exists
    cursor.execute("""
        SELECT EXISTS (
            SELECT FROM information_schema.tables 
            WHERE table_name = 'alembic_version'
        );
    """)
    
    if not cursor.fetchone()[0]:
        print("❌ alembic_version table does not exist - no migrations have been run!")
        conn.close()
        return
    
    # Get current version
    cursor.execute("SELECT version_num FROM alembic_version;")
    result = cursor.fetchone()
    
    if result:
        print(f"✅ Current migration version: {result[0]}")
    else:
        print("❌ No migration version found")
    
    # Check if journey_templates table exists
    cursor.execute("""
        SELECT EXISTS (
            SELECT FROM information_schema.tables 
            WHERE table_name = 'journey_templates'
        );
    """)
    
    has_journey_templates = cursor.fetchone()[0]
    print(f"{'✅' if has_journey_templates else '❌'} journey_templates table exists: {has_journey_templates}")
    
    # Check if vehicletype enum exists
    cursor.execute("""
        SELECT EXISTS (
            SELECT FROM pg_type 
            WHERE typname = 'vehicletype'
        );
    """)
    
    has_vehicletype = cursor.fetchone()[0]
    print(f"{'✅' if has_vehicletype else '❌'} vehicletype enum exists: {has_vehicletype}")
    
    conn.close()

if __name__ == "__main__":
    check_migration_status()
