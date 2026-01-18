from sqlalchemy import Column, Integer, String, Float, Boolean
from app.core.database import Base

class Category(Base):
    __tablename__ = "categories"
    
    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, unique=True, nullable=False)  # e.g., "Meals & Entertainment"
    
    # Tax information
    tax_deductible_percentage = Column(Float, default=100.0)  # e.g., 50.0 for meals (50% deductible)
    
    # Display
    description = Column(String, nullable=True)  # e.g., "Business meals with clients"
    icon = Column(String, nullable=True)  # e.g., "🍽️" or icon name
    
    # System vs user-created
    is_system = Column(Boolean, default=True)  # True = preset categories, False = user custom