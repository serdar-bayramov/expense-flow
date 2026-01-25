"""Directly create journey_templates table in production database"""
import os
from app.core.database import settings
import psycopg2

def create_journey_templates_table():
    """Create journey_templates table directly"""
    print(f"Connecting to database...")
    conn = psycopg2.connect(settings.DATABASE_URL)
    conn.autocommit = True
    cursor = conn.cursor()
    
    try:
        # Check if vehicletype enum exists
        cursor.execute("SELECT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'vehicletype');")
        enum_exists = cursor.fetchone()[0]
        print(f"vehicletype enum exists: {enum_exists}")
        
        if not enum_exists:
            print("Creating vehicletype enum...")
            cursor.execute("CREATE TYPE vehicletype AS ENUM ('CAR', 'MOTORCYCLE', 'BICYCLE');")
            print("✅ Created vehicletype enum")
        
        # Check if journey_templates table exists
        cursor.execute("""
            SELECT EXISTS (
                SELECT FROM information_schema.tables 
                WHERE table_name = 'journey_templates'
            );
        """)
        table_exists = cursor.fetchone()[0]
        print(f"journey_templates table exists: {table_exists}")
        
        if not table_exists:
            print("Creating journey_templates table...")
            cursor.execute("""
                CREATE TABLE journey_templates (
                    id UUID PRIMARY KEY,
                    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
                    name VARCHAR(200) NOT NULL,
                    start_location TEXT NOT NULL,
                    end_location TEXT NOT NULL,
                    vehicle_type vehicletype NOT NULL,
                    business_purpose TEXT NOT NULL,
                    is_round_trip BOOLEAN NOT NULL DEFAULT false,
                    created_at TIMESTAMP WITH TIME ZONE NOT NULL,
                    updated_at TIMESTAMP WITH TIME ZONE NOT NULL
                );
            """)
            print("✅ Created journey_templates table")
            
            cursor.execute("""
                CREATE INDEX ix_journey_templates_user_id 
                ON journey_templates (user_id);
            """)
            print("✅ Created index")
        else:
            print("⚠️ Table already exists, skipping")
        
        # Check current alembic version
        cursor.execute("SELECT version_num FROM alembic_version;")
        version = cursor.fetchone()[0]
        print(f"\nCurrent alembic version: {version}")
        
        # Expected version for journey_templates migration
        expected_version = "29672f48c359"  # add_subscription_and_invite_codes (after journey_templates)
        if version != expected_version:
            print(f"⚠️ Alembic version mismatch. Expected: {expected_version}, Got: {version}")
        
    except Exception as e:
        print(f"❌ Error: {e}")
    finally:
        cursor.close()
        conn.close()

if __name__ == "__main__":
    create_journey_templates_table()
