import logging
from datetime import datetime, timezone
from typing import Optional, List
from fastapi import APIRouter, Depends, HTTPException, Query, status
from pydantic import BaseModel

from supabase_config import supabase
from auth import get_current_user, require_roles

router = APIRouter(prefix="/api/animals", tags=["animals"])
logger = logging.getLogger("animals")

STAFF_ROLES = ["ADMIN", "NGO", "SHELTER", "VET"]
VALID_SPECIES = {"DOG", "CAT", "BIRD", "RABBIT", "OTHER"}
VALID_ADOPTION_STATUSES = {"NOT_READY", "AVAILABLE", "PENDING", "ADOPTED"}
VALID_HEALTH_STATUSES = {"HEALTHY", "INJURED", "SICK", "RECOVERING", "CRITICAL"}
VALID_GENDERS = {"MALE", "FEMALE", "UNKNOWN"}

class AnimalCreate(BaseModel):
    name: str
    species: str
    status: Optional[str] = "AVAILABLE"
    adoptionStatus: Optional[str] = "AVAILABLE"
    description: str
    ageEstimate: Optional[str] = "1 year"
    gender: Optional[str] = "UNKNOWN"
    weight: Optional[float] = None
    healthStatus: Optional[str] = "HEALTHY"
    breed: Optional[str] = None
    vaccinations: List[str] = []
    isNeutered: bool = False
    specialNeeds: Optional[str] = None
    photos: List[str] = []

class AnimalSurrenderCreate(BaseModel):
    name: str
    species: str
    description: str
    ageEstimate: Optional[str] = "Unknown"
    reason: Optional[str] = None
    photos: List[str] = []

class AnimalUpdate(BaseModel):
    name: Optional[str] = None
    species: Optional[str] = None
    adoptionStatus: Optional[str] = None
    description: Optional[str] = None
    ageEstimate: Optional[str] = None
    gender: Optional[str] = None
    weight: Optional[float] = None
    healthStatus: Optional[str] = None
    breed: Optional[str] = None
    vaccinations: Optional[List[str]] = None
    isNeutered: Optional[bool] = None
    specialNeeds: Optional[str] = None
    photos: Optional[List[str]] = None

def map_animal(db_data: dict) -> dict:
    return {
        "id": db_data["id"],
        "name": db_data["name"],
        "species": db_data["species"],
        "breed": db_data.get("breed"),
        "ageEstimate": db_data.get("age_estimate"),
        "gender": db_data.get("gender"),
        "weight": db_data.get("weight"),
        "healthStatus": db_data.get("health_status"),
        "adoptionStatus": db_data.get("adoption_status"),
        "description": db_data.get("description"),
        "vaccinations": db_data.get("vaccinations", []),
        "isNeutered": db_data.get("is_neutered", False),
        "specialNeeds": db_data.get("special_needs"),
        "shelterId": db_data.get("shelter_id"),
        "photos": db_data.get("images", []),
        "createdAt": db_data.get("created_at"),
        "updatedAt": db_data.get("updated_at"),
    }

@router.get("/")
def get_animals(
    status: Optional[str] = None,
    species: Optional[str] = None,
    limit: int = Query(default=20, ge=1, le=100),
    offset: int = Query(default=0, ge=0),
):
    try:
        query = supabase.table("animals").select("*")
        if status:
            query = query.eq("adoption_status", status.upper())
        if species:
            query = query.eq("species", species.upper())
            
        res = query.order("created_at", desc=True).range(offset, offset + limit - 1).execute()
        return [map_animal(item) for item in res.data]
    except Exception as e:
        logger.error(f"Error fetching animals: {e}")
        raise HTTPException(status_code=500, detail="Failed to retrieve animals")

@router.get("/{id}")
def get_animal(id: str):
    try:
        res = supabase.table("animals").select("*").eq("id", id).execute()
        if not res.data:
            raise HTTPException(status_code=404, detail="Animal not found")
        return map_animal(res.data[0])
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error fetching animal {id}: {e}")
        raise HTTPException(status_code=500, detail="Failed to retrieve animal details")

@router.post("/", status_code=status.HTTP_201_CREATED)
def create_animal(payload: AnimalCreate, user: dict = Depends(require_roles(STAFF_ROLES))):
    target_species = payload.species.upper()
    if target_species not in VALID_SPECIES:
        raise HTTPException(status_code=422, detail=f"Invalid species '{payload.species}'. Must be one of {sorted(VALID_SPECIES)}")
        
    target_adopt_status = (payload.adoptionStatus or payload.status or "AVAILABLE").upper()
    if target_adopt_status not in VALID_ADOPTION_STATUSES:
        raise HTTPException(status_code=422, detail=f"Invalid adoption status '{target_adopt_status}'")
        
    target_health = (payload.healthStatus or "HEALTHY").upper()
    if target_health not in VALID_HEALTH_STATUSES:
        raise HTTPException(status_code=422, detail=f"Invalid health status '{target_health}'")
        
    target_gender = (payload.gender or "UNKNOWN").upper()
    if target_gender not in VALID_GENDERS:
        raise HTTPException(status_code=422, detail=f"Invalid gender '{target_gender}'")
        
    try:
        data = {
            "name": payload.name,
            "species": target_species,
            "breed": payload.breed,
            "age_estimate": payload.ageEstimate or "1 year",
            "gender": target_gender,
            "weight": payload.weight,
            "health_status": target_health,
            "adoption_status": target_adopt_status,
            "description": payload.description,
            "vaccinations": payload.vaccinations,
            "is_neutered": payload.isNeutered,
            "special_needs": payload.specialNeeds,
            "shelter_id": user["uid"],
            "images": payload.photos,
            "created_at": datetime.now(timezone.utc).isoformat(),
        }
        res = supabase.table("animals").insert(data).execute()
        if not res.data:
            raise HTTPException(status_code=500, detail="Failed to create animal")
        return map_animal(res.data[0])
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error creating animal: {e}")
        raise HTTPException(status_code=500, detail="Failed to create animal record")

@router.post("/surrender", status_code=status.HTTP_201_CREATED)
def surrender_animal(payload: AnimalSurrenderCreate, user: dict = Depends(get_current_user)):
    """Allows citizens to surrender or donate an animal for shelter intake review."""
    target_species = payload.species.upper()
    if target_species not in VALID_SPECIES:
        raise HTTPException(status_code=422, detail=f"Invalid species '{payload.species}'. Must be one of {sorted(VALID_SPECIES)}")
        
    try:
        description_text = payload.description
        if payload.reason:
            description_text += f"\n\nSurrender Reason: {payload.reason}"
            
        data = {
            "name": payload.name,
            "species": target_species,
            "breed": "Unknown",
            "age_estimate": payload.ageEstimate or "Unknown",
            "gender": "UNKNOWN",
            "weight": None,
            "health_status": "HEALTHY",
            "adoption_status": "NOT_READY", # Surrendered animals start as NOT_READY pending intake
            "description": description_text,
            "vaccinations": [],
            "is_neutered": False,
            "special_needs": None,
            "shelter_id": None, # Unassigned pending shelter intake
            "images": payload.photos,
            "created_at": datetime.now(timezone.utc).isoformat(),
        }
        
        res = supabase.table("animals").insert(data).execute()
        if not res.data:
            raise HTTPException(status_code=500, detail="Failed to submit surrender request")
        return map_animal(res.data[0])
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error surrendering animal: {e}")
        raise HTTPException(status_code=500, detail="Failed to submit animal surrender request")

@router.patch("/{id}")
def update_animal(id: str, payload: AnimalUpdate, user: dict = Depends(require_roles(STAFF_ROLES))):
    try:
        existing = supabase.table("animals").select("id, shelter_id").eq("id", id).execute()
        if not existing.data:
            raise HTTPException(status_code=404, detail="Animal not found")
            
        update_data = {}
        if payload.name is not None: update_data["name"] = payload.name
        if payload.species is not None: 
            sp = payload.species.upper()
            if sp not in VALID_SPECIES:
                raise HTTPException(status_code=422, detail=f"Invalid species '{payload.species}'")
            update_data["species"] = sp
        if payload.breed is not None: update_data["breed"] = payload.breed
        if payload.ageEstimate is not None: update_data["age_estimate"] = payload.ageEstimate
        if payload.gender is not None: 
            g = payload.gender.upper()
            if g not in VALID_GENDERS:
                raise HTTPException(status_code=422, detail=f"Invalid gender '{payload.gender}'")
            update_data["gender"] = g
        if payload.weight is not None: update_data["weight"] = payload.weight
        if payload.healthStatus is not None: 
            hs = payload.healthStatus.upper()
            if hs not in VALID_HEALTH_STATUSES:
                raise HTTPException(status_code=422, detail=f"Invalid health status '{payload.healthStatus}'")
            update_data["health_status"] = hs
        if payload.adoptionStatus is not None: 
            ads = payload.adoptionStatus.upper()
            if ads not in VALID_ADOPTION_STATUSES:
                raise HTTPException(status_code=422, detail=f"Invalid adoption status '{payload.adoptionStatus}'")
            update_data["adoption_status"] = ads
        if payload.description is not None: update_data["description"] = payload.description
        if payload.vaccinations is not None: update_data["vaccinations"] = payload.vaccinations
        if payload.isNeutered is not None: update_data["is_neutered"] = payload.isNeutered
        if payload.specialNeeds is not None: update_data["special_needs"] = payload.specialNeeds
        if payload.photos is not None: update_data["images"] = payload.photos
        
        if not update_data:
            return map_animal(existing.data[0])
            
        res = supabase.table("animals").update(update_data).eq("id", id).execute()
        if not res.data:
            raise HTTPException(status_code=404, detail="Animal not found")
        return map_animal(res.data[0])
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error updating animal {id}: {e}")
        raise HTTPException(status_code=500, detail="Failed to update animal record")

@router.delete("/{id}")
def delete_animal(id: str, user: dict = Depends(require_roles(STAFF_ROLES))):
    try:
        existing = supabase.table("animals").select("id").eq("id", id).execute()
        if not existing.data:
            raise HTTPException(status_code=404, detail="Animal not found")
            
        supabase.table("animals").delete().eq("id", id).execute()
        return {"id": id, "deleted": True}
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error deleting animal {id}: {e}")
        raise HTTPException(status_code=500, detail="Failed to delete animal record")
