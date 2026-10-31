import logging
from datetime import datetime, timezone
from typing import Optional, List
from fastapi import APIRouter, Depends, HTTPException, Query, status
from pydantic import BaseModel

from supabase_config import supabase
from auth import get_current_user, require_roles

router = APIRouter(prefix="/api/adoptions", tags=["adoptions"])
logger = logging.getLogger("adoptions")

STAFF_ROLES = ["ADMIN", "NGO", "SHELTER"]
VALID_APP_STATUSES = {"SUBMITTED", "UNDER_REVIEW", "APPROVED", "REJECTED"}
VALID_ENVIRONMENTS = {"APARTMENT", "HOUSE", "FARM", "OTHER"}

class AdoptionCreate(BaseModel):
    animalId: str
    livingEnvironment: str = "APARTMENT"
    hasYard: bool = False
    hasOtherPets: bool = False
    otherPetDetails: Optional[str] = None
    priorPetExperience: str
    familyMembers: int = 1
    hasChildren: bool = False
    workSchedule: str
    whyAdopt: str

class AdoptionStatusUpdate(BaseModel):
    status: str
    screeningNotes: Optional[str] = None

def map_adoption(db_data: dict) -> dict:
    return {
        "id": db_data["id"],
        "animalId": db_data["animal_id"],
        "applicantId": db_data["applicant_id"],
        "livingEnvironment": db_data.get("living_environment"),
        "hasYard": db_data.get("has_yard", False),
        "hasOtherPets": db_data.get("has_other_pets", False),
        "otherPetDetails": db_data.get("other_pet_details"),
        "priorPetExperience": db_data.get("prior_pet_experience"),
        "familyMembers": db_data.get("family_members"),
        "hasChildren": db_data.get("has_children", False),
        "workSchedule": db_data.get("work_schedule"),
        "whyAdopt": db_data.get("why_adopt"),
        "status": db_data.get("status"),
        "reviewerId": db_data.get("reviewer_id"),
        "screeningNotes": db_data.get("screening_notes"),
        "reviewedAt": db_data.get("reviewed_at"),
        "createdAt": db_data.get("created_at"),
        "updatedAt": db_data.get("updated_at"),
    }

@router.get("/")
def get_adoptions(
    applicantId: Optional[str] = None,
    animalId: Optional[str] = None,
    status: Optional[str] = None,
    limit: int = Query(default=20, ge=1, le=100),
    offset: int = Query(default=0, ge=0),
    user: dict = Depends(get_current_user)
):
    try:
        user_role = user.get("role", "CITIZEN")
        is_staff = user_role in STAFF_ROLES
        
        query = supabase.table("adoption_applications").select("*")
        
        # Non-staff can ONLY query their own applications
        if not is_staff:
            query = query.eq("applicant_id", user["uid"])
        elif applicantId:
            query = query.eq("applicant_id", applicantId)
            
        if animalId:
            query = query.eq("animal_id", animalId)
        if status:
            query = query.eq("status", status.upper())
            
        res = query.order("created_at", desc=True).range(offset, offset + limit - 1).execute()
        return [map_adoption(d) for d in res.data]
    except Exception as e:
        logger.error(f"Error fetching adoption applications: {e}")
        raise HTTPException(status_code=500, detail="Failed to retrieve adoption applications")

@router.get("/{id}")
def get_adoption(id: str, user: dict = Depends(get_current_user)):
    try:
        res = supabase.table("adoption_applications").select("*").eq("id", id).execute()
        if not res.data:
            raise HTTPException(status_code=404, detail="Adoption application not found")
            
        data = res.data[0]
        user_role = user.get("role", "CITIZEN")
        is_owner = data.get("applicant_id") == user["uid"]
        is_staff = user_role in STAFF_ROLES
        
        if not (is_owner or is_staff):
            raise HTTPException(status_code=403, detail="Forbidden: You cannot view this application")
            
        return map_adoption(data)
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error fetching application {id}: {e}")
        raise HTTPException(status_code=500, detail="Failed to retrieve adoption application")

@router.post("/", status_code=status.HTTP_201_CREATED)
def submit_adoption_application(payload: AdoptionCreate, user: dict = Depends(get_current_user)):
    env = payload.livingEnvironment.upper()
    if env not in VALID_ENVIRONMENTS:
        raise HTTPException(status_code=422, detail=f"Invalid living environment '{payload.livingEnvironment}'")
        
    try:
        new_app = {
            "animal_id": payload.animalId,
            "applicant_id": user["uid"],
            "living_environment": env,
            "has_yard": payload.hasYard,
            "has_other_pets": payload.hasOtherPets,
            "other_pet_details": payload.otherPetDetails,
            "prior_pet_experience": payload.priorPetExperience,
            "family_members": payload.familyMembers,
            "has_children": payload.hasChildren,
            "work_schedule": payload.workSchedule,
            "why_adopt": payload.whyAdopt,
            "status": "SUBMITTED",
            "created_at": datetime.now(timezone.utc).isoformat(),
        }
        res = supabase.table("adoption_applications").insert(new_app).execute()
        if not res.data:
            raise HTTPException(status_code=500, detail="Failed to submit application")
        return map_adoption(res.data[0])
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error creating adoption application: {e}")
        raise HTTPException(status_code=500, detail="Failed to submit application")

@router.patch("/{id}/status")
def update_adoption_status(id: str, payload: AdoptionStatusUpdate, user: dict = Depends(require_roles(STAFF_ROLES))):
    target_status = payload.status.upper()
    if target_status not in VALID_APP_STATUSES:
        raise HTTPException(status_code=422, detail=f"Invalid status '{payload.status}'. Must be one of {sorted(VALID_APP_STATUSES)}")
        
    try:
        existing = supabase.table("adoption_applications").select("id, animal_id").eq("id", id).execute()
        if not existing.data:
            raise HTTPException(status_code=404, detail="Adoption application not found")
            
        app_record = existing.data[0]
        update_data = {
            "status": target_status,
            "reviewer_id": user["uid"],
            "reviewed_at": datetime.now(timezone.utc).isoformat(),
        }
        if payload.screeningNotes is not None:
            update_data["screening_notes"] = payload.screeningNotes
            
        res = supabase.table("adoption_applications").update(update_data).eq("id", id).execute()
        if not res.data:
            raise HTTPException(status_code=404, detail="Adoption application not found")
            
        # Automatically update animal adoption status when approved
        if target_status == "APPROVED" and app_record.get("animal_id"):
            try:
                supabase.table("animals").update({"adoption_status": "ADOPTED"}).eq("id", app_record["animal_id"]).execute()
            except Exception as anim_err:
                logger.warning(f"Failed to auto-update animal adoption status: {anim_err}")
                
        return map_adoption(res.data[0])
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error updating adoption status {id}: {e}")
        raise HTTPException(status_code=500, detail="Failed to update adoption application status")
