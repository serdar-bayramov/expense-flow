"""
Seed invite codes into the database.
Run this once to populate the invite_codes table.
"""
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
import os
from dotenv import load_dotenv

# Import all models first to establish relationships
from app.models.user import User
from app.models.invite_code import InviteCode
from app.models.receipt import Receipt
from app.models.mileage_claim import MileageClaim
from app.models.journey_template import JourneyTemplate
from app.models.audit_log import AuditLog
from app.models.category import Category

load_dotenv()

DATABASE_URL = os.getenv("DATABASE_URL")
engine = create_engine(DATABASE_URL)
SessionLocal = sessionmaker(bind=engine)
db = SessionLocal()

# Codes from beta_codes.txt
codes = [
    "BETA-3KTI-7ODD", "BETA-GCYP-U7VR", "BETA-X3KO-OTM7", "BETA-1AN2-6ERU",
    "BETA-RJHN-JOQ3", "BETA-8IUF-EUU3", "BETA-4DS7-H45B", "BETA-5XSE-E8D3",
    "BETA-HAEA-AAQO", "BETA-0W19-5GTT", "BETA-MNFM-OP72", "BETA-V4B3-K1X6",
    "BETA-90KT-UDP3", "BETA-PYKM-RGQE", "BETA-Y8RJ-BI0X", "BETA-G4N9-LBXS",
    "BETA-41KV-TZRB", "BETA-Y58L-4SPH", "BETA-2IB8-4FO6", "BETA-8NZV-11JM"
]

try:
    for code in codes:
        # Check if already exists
        existing = db.query(InviteCode).filter(InviteCode.code == code).first()
        if not existing:
            invite_code = InviteCode(
                code=code,
                max_uses=1,
                grants_plan="free",
                is_beta_code=True,
                beta_duration_days=90  # 90 days beta access
            )
            db.add(invite_code)
            print(f"✓ Added: {code}")
        else:
            print(f"⊘ Exists: {code}")
    
    db.commit()
    print(f"\n✅ Successfully seeded {len(codes)} invite codes!")
    
except Exception as e:
    db.rollback()
    print(f"❌ Error: {e}")
finally:
    db.close()
