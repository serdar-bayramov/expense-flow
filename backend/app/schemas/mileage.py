from pydantic import BaseModel, Field
from typing import Optional
from datetime import date as date_type, datetime
from app.models.mileage_claim import VehicleType


class MileageClaimBase(BaseModel):
    """Base mileage claim fields shared across schemas"""
    date: date_type
    start_location: str = Field(..., min_length=3, max_length=500)
    end_location: str = Field(..., min_length=3, max_length=500)
    vehicle_type: VehicleType
    business_purpose: str = Field(..., min_length=5, max_length=1000)
    is_round_trip: bool = False


class MileageClaimCreate(MileageClaimBase):
    """Schema for creating a new mileage claim"""
    # Optional: if frontend already calculated distance
    distance_miles: Optional[float] = None
    start_lat: Optional[float] = None
    start_lng: Optional[float] = None
    end_lat: Optional[float] = None
    end_lng: Optional[float] = None


class MileageClaimUpdate(BaseModel):
    """Schema for updating a mileage claim"""
    date: Optional[date_type] = None
    start_location: Optional[str] = Field(None, min_length=3, max_length=500)
    end_location: Optional[str] = Field(None, min_length=3, max_length=500)
    vehicle_type: Optional[VehicleType] = None
    business_purpose: Optional[str] = Field(None, min_length=5, max_length=1000)
    is_round_trip: Optional[bool] = None


class MileageClaimResponse(BaseModel):
    """Schema for mileage claim responses"""
    id: str
    date: date_type
    start_location: str
    end_location: str
    start_lat: Optional[float]
    start_lng: Optional[float]
    end_lat: Optional[float]
    end_lng: Optional[float]
    distance_miles: float
    vehicle_type: str
    is_round_trip: bool
    hmrc_rate: float
    claim_amount: float
    business_purpose: str
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class DistanceCalculationRequest(BaseModel):
    """Schema for distance calculation request"""
    start_location: str
    end_location: str
    vehicle_type: str = "car"  # car, motorcycle, or bicycle


class DistanceCalculationResponse(BaseModel):
    """Schema for distance calculation response"""
    distance_miles: float
    start_lat: float
    start_lng: float
    end_lat: float
    end_lng: float
    duration_text: str


class MileageStatsResponse(BaseModel):
    """Schema for mileage statistics response"""
    total_claims: int
    total_miles: float
    total_amount: float
    current_tax_year_miles: float
    current_rate_for_new_claim: float  # 45p or 25p for cars
