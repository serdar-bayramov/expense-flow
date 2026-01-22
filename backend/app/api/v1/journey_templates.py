from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from typing import List
from datetime import datetime

from app.core.database import get_db
from app.api.deps import get_current_user
from app.models.user import User
from app.models.journey_template import JourneyTemplate
from app.schemas.journey_template import (
    JourneyTemplateCreate,
    JourneyTemplateUpdate,
    JourneyTemplateResponse
)

router = APIRouter()


@router.get("/templates", response_model=List[JourneyTemplateResponse])
def list_journey_templates(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """List all journey templates for current user"""
    templates = db.query(JourneyTemplate).filter(
        JourneyTemplate.user_id == current_user.id
    ).order_by(JourneyTemplate.name).all()
    
    return [
        JourneyTemplateResponse(
            id=str(template.id),
            name=template.name,
            start_location=template.start_location,
            end_location=template.end_location,
            vehicle_type=template.vehicle_type.value,
            business_purpose=template.business_purpose,
            is_round_trip=template.is_round_trip,
            created_at=template.created_at,
            updated_at=template.updated_at
        )
        for template in templates
    ]


@router.post("/templates", response_model=JourneyTemplateResponse, status_code=status.HTTP_201_CREATED)
def create_journey_template(
    template_data: JourneyTemplateCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Create a new journey template"""
    # Check if template with same name already exists
    existing = db.query(JourneyTemplate).filter(
        JourneyTemplate.user_id == current_user.id,
        JourneyTemplate.name == template_data.name
    ).first()
    
    if existing:
        raise HTTPException(
            status_code=400,
            detail="A template with this name already exists"
        )
    
    new_template = JourneyTemplate(
        user_id=current_user.id,
        name=template_data.name,
        start_location=template_data.start_location,
        end_location=template_data.end_location,
        vehicle_type=template_data.vehicle_type,
        business_purpose=template_data.business_purpose,
        is_round_trip=template_data.is_round_trip
    )
    
    db.add(new_template)
    db.commit()
    db.refresh(new_template)
    
    return JourneyTemplateResponse(
        id=str(new_template.id),
        name=new_template.name,
        start_location=new_template.start_location,
        end_location=new_template.end_location,
        vehicle_type=new_template.vehicle_type.value,
        business_purpose=new_template.business_purpose,
        is_round_trip=new_template.is_round_trip,
        created_at=new_template.created_at,
        updated_at=new_template.updated_at
    )


@router.get("/templates/{template_id}", response_model=JourneyTemplateResponse)
def get_journey_template(
    template_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get a specific journey template"""
    template = db.query(JourneyTemplate).filter(
        JourneyTemplate.id == template_id,
        JourneyTemplate.user_id == current_user.id
    ).first()
    
    if not template:
        raise HTTPException(status_code=404, detail="Journey template not found")
    
    return JourneyTemplateResponse(
        id=str(template.id),
        name=template.name,
        start_location=template.start_location,
        end_location=template.end_location,
        vehicle_type=template.vehicle_type.value,
        business_purpose=template.business_purpose,
        is_round_trip=template.is_round_trip,
        created_at=template.created_at,
        updated_at=template.updated_at
    )


@router.put("/templates/{template_id}", response_model=JourneyTemplateResponse)
def update_journey_template(
    template_id: str,
    template_data: JourneyTemplateUpdate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Update a journey template"""
    template = db.query(JourneyTemplate).filter(
        JourneyTemplate.id == template_id,
        JourneyTemplate.user_id == current_user.id
    ).first()
    
    if not template:
        raise HTTPException(status_code=404, detail="Journey template not found")
    
    # Check for name conflicts if name is being updated
    if template_data.name and template_data.name != template.name:
        existing = db.query(JourneyTemplate).filter(
            JourneyTemplate.user_id == current_user.id,
            JourneyTemplate.name == template_data.name,
            JourneyTemplate.id != template_id
        ).first()
        
        if existing:
            raise HTTPException(
                status_code=400,
                detail="A template with this name already exists"
            )
    
    # Update fields
    if template_data.name is not None:
        template.name = template_data.name
    if template_data.start_location is not None:
        template.start_location = template_data.start_location
    if template_data.end_location is not None:
        template.end_location = template_data.end_location
    if template_data.vehicle_type is not None:
        template.vehicle_type = template_data.vehicle_type
    if template_data.business_purpose is not None:
        template.business_purpose = template_data.business_purpose
    if template_data.is_round_trip is not None:
        template.is_round_trip = template_data.is_round_trip
    
    template.updated_at = datetime.utcnow()
    db.commit()
    db.refresh(template)
    
    return JourneyTemplateResponse(
        id=str(template.id),
        name=template.name,
        start_location=template.start_location,
        end_location=template.end_location,
        vehicle_type=template.vehicle_type.value,
        business_purpose=template.business_purpose,
        is_round_trip=template.is_round_trip,
        created_at=template.created_at,
        updated_at=template.updated_at
    )


@router.delete("/templates/{template_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_journey_template(
    template_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Delete a journey template"""
    template = db.query(JourneyTemplate).filter(
        JourneyTemplate.id == template_id,
        JourneyTemplate.user_id == current_user.id
    ).first()
    
    if not template:
        raise HTTPException(status_code=404, detail="Journey template not found")
    
    db.delete(template)
    db.commit()
    
    return None
