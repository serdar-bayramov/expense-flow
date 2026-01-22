from sqlalchemy import Column, String, ForeignKey, DateTime, Boolean, Text, Enum, Integer
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship
from datetime import datetime
import uuid

from app.core.database import Base
from app.models.mileage_claim import VehicleType


class JourneyTemplate(Base):
    __tablename__ = "journey_templates"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    
    # Template details
    name = Column(String(200), nullable=False)  # e.g., "Home to Office"
    start_location = Column(Text, nullable=False)
    end_location = Column(Text, nullable=False)
    vehicle_type = Column(Enum(VehicleType), nullable=False, default=VehicleType.CAR)
    business_purpose = Column(Text, nullable=False)
    is_round_trip = Column(Boolean, default=False, nullable=False)
    
    # Timestamps
    created_at = Column(DateTime(timezone=True), default=datetime.utcnow, nullable=False)
    updated_at = Column(DateTime(timezone=True), default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)

    # Relationships
    owner = relationship("User", back_populates="journey_templates")
