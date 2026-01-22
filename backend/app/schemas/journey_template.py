from pydantic import BaseModel, Field
from datetime import datetime
from app.models.mileage_claim import VehicleType


class JourneyTemplateBase(BaseModel):
    """Base journey template fields"""
    name: str = Field(..., min_length=3, max_length=200)
    start_location: str = Field(..., min_length=3, max_length=500)
    end_location: str = Field(..., min_length=3, max_length=500)
    vehicle_type: VehicleType
    business_purpose: str = Field(..., min_length=5, max_length=1000)
    is_round_trip: bool = False


class JourneyTemplateCreate(JourneyTemplateBase):
    """Schema for creating a journey template"""
    pass


class JourneyTemplateUpdate(BaseModel):
    """Schema for updating a journey template"""
    name: str | None = Field(None, min_length=3, max_length=200)
    start_location: str | None = Field(None, min_length=3, max_length=500)
    end_location: str | None = Field(None, min_length=3, max_length=500)
    vehicle_type: VehicleType | None = None
    business_purpose: str | None = Field(None, min_length=5, max_length=1000)
    is_round_trip: bool | None = None


class JourneyTemplateResponse(BaseModel):
    """Schema for journey template responses"""
    id: str
    name: str
    start_location: str
    end_location: str
    vehicle_type: str
    business_purpose: str
    is_round_trip: bool
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True
