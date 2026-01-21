from sqlalchemy import Column, String, ForeignKey, DateTime, Date, Numeric, Boolean, Text, Enum, Integer
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship
from datetime import datetime
import uuid
import enum

from app.core.database import Base


class VehicleType(str, enum.Enum):
    CAR = "car"
    MOTORCYCLE = "motorcycle"
    BICYCLE = "bicycle"


class MileageClaim(Base):
    __tablename__ = "mileage_claims"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    
    # Trip details
    date = Column(Date, nullable=False)
    start_location = Column(Text, nullable=False)
    end_location = Column(Text, nullable=False)
    start_lat = Column(Numeric(10, 7))
    start_lng = Column(Numeric(10, 7))
    end_lat = Column(Numeric(10, 7))
    end_lng = Column(Numeric(10, 7))
    
    # Distance and vehicle
    distance_miles = Column(Numeric(10, 2), nullable=False)
    vehicle_type = Column(Enum(VehicleType), nullable=False, default=VehicleType.CAR)
    is_round_trip = Column(Boolean, default=False, nullable=False)
    
    # Claim calculation
    hmrc_rate = Column(Numeric(5, 2), nullable=False)  # Rate at time of claim
    claim_amount = Column(Numeric(10, 2), nullable=False)  # Total claim in GBP
    
    # Business purpose (required for HMRC)
    business_purpose = Column(Text, nullable=False)
    
    # Soft delete
    deleted_at = Column(DateTime(timezone=True), nullable=True)
    
    # Timestamps
    created_at = Column(DateTime(timezone=True), default=datetime.utcnow, nullable=False)
    updated_at = Column(DateTime(timezone=True), default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)

    # Relationships
    owner = relationship("User", back_populates="mileage_claims")

    @staticmethod
    def get_hmrc_rate(vehicle_type: VehicleType, annual_miles: float = 0) -> float:
        """
        Get HMRC approved mileage rates (2024-2026)
        
        Cars/vans: 45p per mile (first 10,000 miles), then 25p
        Motorcycles: 24p per mile
        Bicycles: 20p per mile
        """
        if vehicle_type == VehicleType.MOTORCYCLE:
            return 0.24
        elif vehicle_type == VehicleType.BICYCLE:
            return 0.20
        elif vehicle_type == VehicleType.CAR:
            # Check if over 10k threshold
            if annual_miles >= 10000:
                return 0.25  # Lower rate after 10k miles
            return 0.45  # Standard rate
        return 0.45  # Default to car rate

    @staticmethod
    def calculate_claim_amount(distance_miles: float, vehicle_type: VehicleType, annual_miles_before: float = 0) -> tuple[float, float]:
        """
        Calculate claim amount considering HMRC 10k mile threshold for cars
        
        Returns: (claim_amount, average_rate_used)
        """
        if vehicle_type in [VehicleType.MOTORCYCLE, VehicleType.BICYCLE]:
            # Simple calculation for non-cars
            rate = MileageClaim.get_hmrc_rate(vehicle_type)
            return (round(distance_miles * rate, 2), rate)
        
        # Car calculation with 10k threshold
        if annual_miles_before >= 10000:
            # All miles at lower rate
            claim = distance_miles * 0.25
            return (round(claim, 2), 0.25)
        elif annual_miles_before + distance_miles <= 10000:
            # All miles at higher rate
            claim = distance_miles * 0.45
            return (round(claim, 2), 0.45)
        else:
            # Split between rates
            miles_at_45p = 10000 - annual_miles_before
            miles_at_25p = distance_miles - miles_at_45p
            claim = (miles_at_45p * 0.45) + (miles_at_25p * 0.25)
            avg_rate = claim / distance_miles
            return (round(claim, 2), round(avg_rate, 2))
