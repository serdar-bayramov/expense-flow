"""
Mileage calculation service for Google Maps integration and HMRC rate calculations
"""
from fastapi import HTTPException
import googlemaps
from datetime import date
from app.core.database import settings


def calculate_distance_google_maps(start: str, end: str, vehicle_type: str = "car") -> dict:
    """
    Calculate distance between two locations using Google Maps Distance Matrix API
    
    Args:
        start: Starting location address
        end: Ending location address
        vehicle_type: Type of vehicle (car, motorcycle, bicycle)
        
    Returns:
        dict with distance_miles, coordinates, and duration
        
    Raises:
        HTTPException: If API call fails or addresses are invalid
    """
    try:
        gmaps = googlemaps.Client(key=settings.GOOGLE_MAPS_API_KEY)
        
        # Map vehicle type to Google Maps mode
        # Car and motorcycle use same roads/speeds, bicycle uses bike routes
        mode = "bicycling" if vehicle_type == "bicycle" else "driving"
        
        result = gmaps.distance_matrix(
            origins=[start],
            destinations=[end],
            mode=mode,
            units="imperial"
        )
        
        if result['rows'][0]['elements'][0]['status'] != 'OK':
            raise HTTPException(
                status_code=400,
                detail="Could not calculate distance. Please check your addresses."
            )
        
        element = result['rows'][0]['elements'][0]
        distance_meters = element['distance']['value']
        distance_miles = distance_meters / 1609.34
        
        # Geocode to get coordinates
        start_geocode = gmaps.geocode(start)
        end_geocode = gmaps.geocode(end)
        
        if not start_geocode or not end_geocode:
            raise HTTPException(status_code=400, detail="Could not geocode addresses")
        
        return {
            "distance_miles": round(distance_miles, 2),
            "start_lat": start_geocode[0]['geometry']['location']['lat'],
            "start_lng": start_geocode[0]['geometry']['location']['lng'],
            "end_lat": end_geocode[0]['geometry']['location']['lat'],
            "end_lng": end_geocode[0]['geometry']['location']['lng'],
            "duration_text": element['duration']['text']
        }
    except googlemaps.exceptions.ApiError as e:
        raise HTTPException(status_code=500, detail=f"Google Maps API error: {str(e)}")
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error calculating distance: {str(e)}")


def get_tax_year_start(reference_date: date = None) -> date:
    """
    Get the start date of the current UK tax year (April 6 - April 5)
    
    Args:
        reference_date: Date to calculate from (defaults to today)
        
    Returns:
        Date object representing April 6th of the current tax year
    """
    if reference_date is None:
        reference_date = date.today()
    
    if reference_date.month < 4 or (reference_date.month == 4 and reference_date.day < 6):
        # Before April 6, so tax year started last year
        return date(reference_date.year - 1, 4, 6)
    else:
        # On or after April 6, so tax year started this year
        return date(reference_date.year, 4, 6)
