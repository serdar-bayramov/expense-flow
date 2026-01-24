from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from sqlalchemy import func
from typing import List, Optional
from datetime import datetime
from decimal import Decimal

from app.core.database import get_db
from app.api.deps import get_current_user
from app.models.user import User
from app.models.mileage_claim import MileageClaim, VehicleType
from app.schemas.mileage import (
    MileageClaimCreate,
    MileageClaimUpdate,
    MileageClaimResponse,
    DistanceCalculationRequest,
    DistanceCalculationResponse,
    MileageStatsResponse
)
from app.services.mileage import calculate_distance_google_maps, get_tax_year_start
from app.utils.subscription_limits import check_mileage_limit

router = APIRouter()


@router.post("/calculate-distance", response_model=DistanceCalculationResponse)
def calculate_distance(
    request: DistanceCalculationRequest,
    current_user: User = Depends(get_current_user)
):
    """Calculate distance between two locations using Google Maps"""
    return calculate_distance_google_maps(
        request.start_location,
        request.end_location,
        request.vehicle_type
    )


@router.get("/stats", response_model=MileageStatsResponse)
def get_mileage_stats(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get mileage statistics for current user"""
    # Get all active claims
    claims = db.query(MileageClaim).filter(
        MileageClaim.user_id == current_user.id,
        MileageClaim.deleted_at.is_(None)
    ).all()
    
    total_claims = len(claims)
    total_miles = sum(float(claim.distance_miles) for claim in claims)
    total_amount = sum(float(claim.claim_amount) for claim in claims)
    
    # Calculate current tax year miles for cars
    tax_year_start = get_tax_year_start()
    
    tax_year_miles = sum(
        float(claim.distance_miles) 
        for claim in claims 
        if claim.date >= tax_year_start and claim.vehicle_type == VehicleType.CAR
    )
    
    # Determine current rate for new car claims
    current_rate = 0.45 if tax_year_miles < 10000 else 0.25
    
    return {
        "total_claims": total_claims,
        "total_miles": round(total_miles, 2),
        "total_amount": round(total_amount, 2),
        "current_tax_year_miles": round(tax_year_miles, 2),
        "current_rate_for_new_claim": current_rate
    }


@router.get("/claims", response_model=List[MileageClaimResponse])
def list_mileage_claims(
    skip: int = 0,
    limit: int = 100,
    vehicle_type: Optional[VehicleType] = None,
    from_date: Optional[str] = None,
    to_date: Optional[str] = None,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """List all mileage claims for current user with optional filters"""
    query = db.query(MileageClaim).filter(
        MileageClaim.user_id == current_user.id,
        MileageClaim.deleted_at.is_(None)
    )
    
    if vehicle_type:
        query = query.filter(MileageClaim.vehicle_type == vehicle_type)
    
    if from_date:
        query = query.filter(MileageClaim.date >= from_date)
    
    if to_date:
        query = query.filter(MileageClaim.date <= to_date)
    
    claims = query.order_by(MileageClaim.date.desc()).offset(skip).limit(limit).all()
    
    return [
        MileageClaimResponse(
            id=str(claim.id),
            date=claim.date,
            start_location=claim.start_location,
            end_location=claim.end_location,
            start_lat=float(claim.start_lat) if claim.start_lat else None,
            start_lng=float(claim.start_lng) if claim.start_lng else None,
            end_lat=float(claim.end_lat) if claim.end_lat else None,
            end_lng=float(claim.end_lng) if claim.end_lng else None,
            distance_miles=float(claim.distance_miles),
            vehicle_type=claim.vehicle_type.value,
            is_round_trip=claim.is_round_trip,
            hmrc_rate=float(claim.hmrc_rate),
            claim_amount=float(claim.claim_amount),
            business_purpose=claim.business_purpose,
            created_at=claim.created_at,
            updated_at=claim.updated_at
        )
        for claim in claims
    ]


@router.post("/claims", response_model=MileageClaimResponse, status_code=status.HTTP_201_CREATED)
def create_mileage_claim(
    claim_data: MileageClaimCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Create a new mileage claim"""
    # Check subscription limits
    can_create, current_count, limit = check_mileage_limit(current_user, db)
    if not can_create:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=f"Monthly mileage claim limit reached ({current_count}/{limit}). Upgrade your plan for more claims."
        )
    
    # Calculate distance if not provided
    if claim_data.distance_miles is None:
        distance_info = calculate_distance_google_maps(
            claim_data.start_location,
            claim_data.end_location
        )
        distance_miles = distance_info['distance_miles']
        start_lat = distance_info['start_lat']
        start_lng = distance_info['start_lng']
        end_lat = distance_info['end_lat']
        end_lng = distance_info['end_lng']
    else:
        distance_miles = claim_data.distance_miles
        start_lat = claim_data.start_lat
        start_lng = claim_data.start_lng
        end_lat = claim_data.end_lat
        end_lng = claim_data.end_lng
    
    # Apply round trip multiplier
    if claim_data.is_round_trip:
        distance_miles *= 2
    
    # Get annual miles for rate calculation
    tax_year_start = get_tax_year_start()
    
    annual_miles = db.query(func.sum(MileageClaim.distance_miles)).filter(
        MileageClaim.user_id == current_user.id,
        MileageClaim.vehicle_type == VehicleType.CAR,
        MileageClaim.date >= tax_year_start,
        MileageClaim.deleted_at.is_(None)
    ).scalar() or 0
    
    # Calculate claim amount and rate
    claim_amount, avg_rate = MileageClaim.calculate_claim_amount(
        distance_miles,
        claim_data.vehicle_type,
        float(annual_miles)
    )
    
    # Create claim
    new_claim = MileageClaim(
        user_id=current_user.id,
        date=claim_data.date,
        start_location=claim_data.start_location,
        end_location=claim_data.end_location,
        start_lat=Decimal(str(start_lat)) if start_lat else None,
        start_lng=Decimal(str(start_lng)) if start_lng else None,
        end_lat=Decimal(str(end_lat)) if end_lat else None,
        end_lng=Decimal(str(end_lng)) if end_lng else None,
        distance_miles=Decimal(str(distance_miles)),
        vehicle_type=claim_data.vehicle_type,
        is_round_trip=claim_data.is_round_trip,
        hmrc_rate=Decimal(str(avg_rate)),
        claim_amount=Decimal(str(claim_amount)),
        business_purpose=claim_data.business_purpose
    )
    
    db.add(new_claim)
    db.commit()
    db.refresh(new_claim)
    
    return MileageClaimResponse(
        id=str(new_claim.id),
        date=new_claim.date,
        start_location=new_claim.start_location,
        end_location=new_claim.end_location,
        start_lat=float(new_claim.start_lat) if new_claim.start_lat else None,
        start_lng=float(new_claim.start_lng) if new_claim.start_lng else None,
        end_lat=float(new_claim.end_lat) if new_claim.end_lat else None,
        end_lng=float(new_claim.end_lng) if new_claim.end_lng else None,
        distance_miles=float(new_claim.distance_miles),
        vehicle_type=new_claim.vehicle_type.value,
        is_round_trip=new_claim.is_round_trip,
        hmrc_rate=float(new_claim.hmrc_rate),
        claim_amount=float(new_claim.claim_amount),
        business_purpose=new_claim.business_purpose,
        created_at=new_claim.created_at,
        updated_at=new_claim.updated_at
    )


@router.get("/claims/{claim_id}", response_model=MileageClaimResponse)
def get_mileage_claim(
    claim_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get a specific mileage claim"""
    claim = db.query(MileageClaim).filter(
        MileageClaim.id == claim_id,
        MileageClaim.user_id == current_user.id,
        MileageClaim.deleted_at.is_(None)
    ).first()
    
    if not claim:
        raise HTTPException(status_code=404, detail="Mileage claim not found")
    
    return MileageClaimResponse(
        id=str(claim.id),
        date=claim.date,
        start_location=claim.start_location,
        end_location=claim.end_location,
        start_lat=float(claim.start_lat) if claim.start_lat else None,
        start_lng=float(claim.start_lng) if claim.start_lng else None,
        end_lat=float(claim.end_lat) if claim.end_lat else None,
        end_lng=float(claim.end_lng) if claim.end_lat else None,
        distance_miles=float(claim.distance_miles),
        vehicle_type=claim.vehicle_type.value,
        is_round_trip=claim.is_round_trip,
        hmrc_rate=float(claim.hmrc_rate),
        claim_amount=float(claim.claim_amount),
        business_purpose=claim.business_purpose,
        created_at=claim.created_at,
        updated_at=claim.updated_at
    )


@router.put("/claims/{claim_id}", response_model=MileageClaimResponse)
def update_mileage_claim(
    claim_id: str,
    claim_data: MileageClaimUpdate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Update a mileage claim"""
    claim = db.query(MileageClaim).filter(
        MileageClaim.id == claim_id,
        MileageClaim.user_id == current_user.id,
        MileageClaim.deleted_at.is_(None)
    ).first()
    
    if not claim:
        raise HTTPException(status_code=404, detail="Mileage claim not found")
    
    # Update fields
    if claim_data.date is not None:
        claim.date = claim_data.date
    if claim_data.start_location is not None:
        claim.start_location = claim_data.start_location
    if claim_data.end_location is not None:
        claim.end_location = claim_data.end_location
    if claim_data.vehicle_type is not None:
        claim.vehicle_type = claim_data.vehicle_type
    if claim_data.business_purpose is not None:
        claim.business_purpose = claim_data.business_purpose
    if claim_data.is_round_trip is not None:
        claim.is_round_trip = claim_data.is_round_trip
    
    # Recalculate if locations or trip type changed
    if any([claim_data.start_location, claim_data.end_location, claim_data.is_round_trip is not None]):
        # Recalculate distance
        distance_info = calculate_distance_google_maps(
            claim.start_location,
            claim.end_location
        )
        distance_miles = distance_info['distance_miles']
        
        if claim.is_round_trip:
            distance_miles *= 2
        
        # Get annual miles (exclude current claim)
        tax_year_start = get_tax_year_start()
        
        annual_miles = db.query(func.sum(MileageClaim.distance_miles)).filter(
            MileageClaim.user_id == current_user.id,
            MileageClaim.vehicle_type == VehicleType.CAR,
            MileageClaim.date >= tax_year_start,
            MileageClaim.id != claim_id,
            MileageClaim.deleted_at.is_(None)
        ).scalar() or 0
        
        claim_amount, avg_rate = MileageClaim.calculate_claim_amount(
            distance_miles,
            claim.vehicle_type,
            float(annual_miles)
        )
        
        claim.distance_miles = Decimal(str(distance_miles))
        claim.hmrc_rate = Decimal(str(avg_rate))
        claim.claim_amount = Decimal(str(claim_amount))
        claim.start_lat = Decimal(str(distance_info['start_lat']))
        claim.start_lng = Decimal(str(distance_info['start_lng']))
        claim.end_lat = Decimal(str(distance_info['end_lat']))
        claim.end_lng = Decimal(str(distance_info['end_lng']))
    
    claim.updated_at = datetime.utcnow()
    db.commit()
    db.refresh(claim)
    
    return MileageClaimResponse(
        id=str(claim.id),
        date=claim.date,
        start_location=claim.start_location,
        end_location=claim.end_location,
        start_lat=float(claim.start_lat) if claim.start_lat else None,
        start_lng=float(claim.start_lng) if claim.start_lng else None,
        end_lat=float(claim.end_lat) if claim.end_lat else None,
        end_lng=float(claim.end_lng) if claim.end_lng else None,
        distance_miles=float(claim.distance_miles),
        vehicle_type=claim.vehicle_type.value,
        is_round_trip=claim.is_round_trip,
        hmrc_rate=float(claim.hmrc_rate),
        claim_amount=float(claim.claim_amount),
        business_purpose=claim.business_purpose,
        created_at=claim.created_at,
        updated_at=claim.updated_at
    )


@router.delete("/claims/{claim_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_mileage_claim(
    claim_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Soft delete a mileage claim"""
    claim = db.query(MileageClaim).filter(
        MileageClaim.id == claim_id,
        MileageClaim.user_id == current_user.id,
        MileageClaim.deleted_at.is_(None)
    ).first()
    
    if not claim:
        raise HTTPException(status_code=404, detail="Mileage claim not found")
    
    claim.deleted_at = datetime.utcnow()
    db.commit()
    
    return None
