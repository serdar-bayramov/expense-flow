"""Ensure journey_templates table exists - run before server starts"""
import sys
from app.core.database import engine
from sqlalchemy import text

def ensure_journey_templates():
    """Create journey_templates table if it doesn't exist"""
    with engine.connect() as conn:
        # Check if table exists
        result = conn.execute(text("""
            SELECT EXISTS (
                SELECT FROM information_schema.tables 
                WHERE table_name = 'journey_templates'
            );
        """))
        table_exists = result.scalar()
        
        if not table_exists:
            print("Creating journey_templates table...")
            
            # Ensure enum exists
            conn.execute(text("""
                DO $$ 
                BEGIN
                    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'vehicletype') THEN
                        CREATE TYPE vehicletype AS ENUM ('CAR', 'MOTORCYCLE', 'BICYCLE');
                    END IF;
                END $$;
            """))
            
            # Create table
            conn.execute(text("""
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
            """))
            
            # Create index
            conn.execute(text("""
                CREATE INDEX ix_journey_templates_user_id 
                ON journey_templates (user_id);
            """))
            
            conn.commit()
            print("✅ journey_templates table created successfully")
        else:
            print("✓ journey_templates table already exists")

if __name__ == "__main__":
    try:
        ensure_journey_templates()
    except Exception as e:
        print(f"❌ Error creating journey_templates: {e}")
        sys.exit(1)
