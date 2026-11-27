import logging
from datetime import datetime, timezone
from typing import Optional, List
from fastapi import APIRouter, Depends, HTTPException, Query, status
from pydantic import BaseModel

from supabase_config import supabase
from auth import get_current_user, require_roles
from errors import map_db_error
from .notifications import create_system_notification
from .audit import log_audit_event

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

class AdoptionResponse(BaseModel):
    id: str
    animalId: str
    applicantId: Optional[str] = None
    livingEnvironment: Optional[str] = None
    hasYard: bool = False
    hasOtherPets: bool = False
    otherPetDetails: Optional[str] = None
    priorPetExperience: Optional[str] = None
    familyMembers: Optional[int] = None
    hasChildren: bool = False
    workSchedule: Optional[str] = None
    whyAdopt: Optional[str] = None
    status: Optional[str] = None
    reviewerId: Optional[str] = None
    screeningNotes: Optional[str] = None
    reviewedAt: Optional[str] = None
    createdAt: Optional[str] = None
    updatedAt: Optional[str] = None

def map_adoption(db_data: dict) -> dict:
    return {
        "id": db_data["id"],
        "animalId": db_data["animal_id"],
        "applicantId": db_data.get("applicant_id"),
        "livingEnvironment": db_data.get("living_environment"),
        "hasYard": bool(db_data.get("has_yard")),
        "hasOtherPets": bool(db_data.get("has_other_pets")),
        "otherPetDetails": db_data.get("other_pet_details"),
        "priorPetExperience": db_data.get("prior_pet_experience"),
        "familyMembers": db_data.get("family_members"),
        "hasChildren": bool(db_data.get("has_children")),
        "workSchedule": db_data.get("work_schedule"),
        "whyAdopt": db_data.get("why_adopt"),
        "status": db_data.get("status"),
        "reviewerId": db_data.get("reviewer_id"),
        "screeningNotes": db_data.get("screening_notes"),
        "reviewedAt": db_data.get("reviewed_at"),
        "createdAt": db_data.get("created_at"),
        "updatedAt": db_data.get("updated_at"),
    }

@router.get("/", response_model=List[AdoptionResponse])
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
        is_admin = user_role == "ADMIN"
        
        query = supabase.table("adoption_applications").select("*")
        
        # Non-staff can ONLY query their own applications
        if not is_staff:
            query = query.eq("applicant_id", user["uid"])
        elif not is_admin:
            # Non-admin staff (SHELTER, NGO) can only see:
            # 1. Their own personal applications if filtering by their own applicantId
            # 2. Applications for animals managed by their shelter facility (shelter_id == user["uid"])
            if applicantId and applicantId == user["uid"]:
                query = query.eq("applicant_id", user["uid"])
            else:
                # Use database-level inner join to avoid URL query string length limits on large shelter rosters
                query = (
                    supabase.table("adoption_applications")
                    .select("*, animals!inner(shelter_id)")
                    .eq("animals.shelter_id", user["uid"])
                )
                if applicantId:
                    query = query.eq("applicant_id", applicantId)
        elif applicantId:
            query = query.eq("applicant_id", applicantId)
            
        if animalId:
            query = query.eq("animal_id", animalId)
        if status:
            query = query.eq("status", status.upper())
            
        res = query.order("created_at", desc=True).order("id", desc=True).range(offset, offset + limit - 1).execute()
        return [map_adoption(d) for d in res.data]
    except Exception as e:
        logger.error(f"Error fetching adoption applications: {e}")
        raise map_db_error(e, "fetching adoption applications")

@router.get("/{id}", response_model=AdoptionResponse)
def get_adoption(id: str, user: dict = Depends(get_current_user)):
    try:
        res = supabase.table("adoption_applications").select("*").eq("id", id).execute()
        if not res.data:
            raise HTTPException(status_code=404, detail="Adoption application not found")
            
        data = res.data[0]
        user_role = user.get("role", "CITIZEN")
        is_owner = data.get("applicant_id") == user["uid"]
        is_admin = user_role == "ADMIN"
        
        if is_admin or is_owner:
            return map_adoption(data)
            
        if user_role in STAFF_ROLES:
            # Check if this animal belongs to this shelter
            animal_id = data.get("animal_id")
            if animal_id:
                anim_check = supabase.table("animals").select("id, shelter_id").eq("id", animal_id).execute()
                if anim_check.data and anim_check.data[0].get("shelter_id") == user["uid"]:
                    return map_adoption(data)
                    
        raise HTTPException(status_code=403, detail="Forbidden: You cannot view this application")
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error fetching application {id}: {e}")
        raise HTTPException(status_code=500, detail="Failed to retrieve adoption application")

@router.post("/", response_model=AdoptionResponse, status_code=status.HTTP_201_CREATED)
def submit_adoption_application(payload: AdoptionCreate, user: dict = Depends(get_current_user)):
    env = payload.livingEnvironment.upper()
    if env not in VALID_ENVIRONMENTS:
        raise HTTPException(status_code=422, detail=f"Invalid living environment '{payload.livingEnvironment}'")
        
    try:
        # 1. Validate animal existence and status
        anim_res = supabase.table("animals").select("id, adoption_status, surrendered_by").eq("id", payload.animalId).execute()
        if not anim_res.data:
            raise HTTPException(status_code=404, detail="Animal not found")
            
        animal = anim_res.data[0]
        curr_status = (animal.get("adoption_status") or "").upper()
        if curr_status != "AVAILABLE":
            raise HTTPException(
                status_code=409,
                detail=f"Animal is not available for adoption (current status: {curr_status})"
            )
            
        if animal.get("surrendered_by") and animal.get("surrendered_by") == user["uid"]:
            raise HTTPException(
                status_code=400,
                detail="Cannot apply to adopt an animal you previously surrendered"
            )

        # 2. Check for duplicate open application before inserting
        existing_app = (
            supabase.table("adoption_applications")
            .select("id")
            .eq("animal_id", payload.animalId)
            .eq("applicant_id", user["uid"])
            .in_("status", ["SUBMITTED", "UNDER_REVIEW"])
            .execute()
        )
        if existing_app.data:
            raise HTTPException(
                status_code=409,
                detail="An active adoption application for this animal is already under review"
            )

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
        err_msg = str(e)
        logger.error(f"Error creating adoption application: {err_msg}")
        if "23505" in err_msg or "duplicate key" in err_msg.lower() or "uq_adoption_apps_open" in err_msg:
            raise HTTPException(
                status_code=409,
                detail="An active adoption application for this animal is already under review"
            )
        if "23503" in err_msg or "foreign key" in err_msg.lower():
            raise HTTPException(
                status_code=404,
                detail="Referenced animal or applicant does not exist"
            )
        raise HTTPException(status_code=500, detail="Failed to submit application")

@router.patch("/{id}/status", response_model=AdoptionResponse)
def update_adoption_status(id: str, payload: AdoptionStatusUpdate, user: dict = Depends(require_roles(STAFF_ROLES))):
    target_status = payload.status.upper()
    if target_status not in VALID_APP_STATUSES:
        raise HTTPException(status_code=422, detail=f"Invalid status '{payload.status}'. Must be one of {sorted(VALID_APP_STATUSES)}")
        
    try:
        existing = supabase.table("adoption_applications").select("id, animal_id, applicant_id, status").eq("id", id).execute()
        if not existing.data:
            raise HTTPException(status_code=404, detail="Adoption application not found")
            
        app_record = existing.data[0]
        user_role = user.get("role", "CITIZEN")

        # Staff can only review applications for animals belonging to their own shelter facility (Admins can review any)
        if user_role != "ADMIN":
            animal_id = app_record.get("animal_id")
            if not animal_id:
                raise HTTPException(status_code=403, detail="Forbidden: You cannot review this application")
            anim_check = supabase.table("animals").select("id, shelter_id").eq("id", animal_id).execute()
            if not anim_check.data or anim_check.data[0].get("shelter_id") != user["uid"]:
                raise HTTPException(
                    status_code=403,
                    detail="Forbidden: You can only review applications for animals in your shelter facility"
                )

        update_data = {
            "status": target_status,
            "reviewer_id": user["uid"],
            "reviewed_at": datetime.now(timezone.utc).isoformat(),
        }
        if payload.screeningNotes is not None:
            update_data["screening_notes"] = payload.screeningNotes
            
        # Conditional atomic update: review only if status matches current state
        curr_status = app_record.get("status")
        query_update = supabase.table("adoption_applications").update(update_data).eq("id", id)
        if curr_status:
            query_update = query_update.eq("status", curr_status)
        res = query_update.execute()
        if not res.data:
            chk = supabase.table("adoption_applications").select("id, status").eq("id", id).execute()
            if not chk.data:
                raise HTTPException(status_code=404, detail="Adoption application not found")
            raise HTTPException(
                status_code=409,
                detail=f"Adoption application status was concurrently modified by another reviewer (current status: {chk.data[0].get('status')})"
            )
            
        # Automatically update animal adoption status when approved
        if target_status == "APPROVED" and app_record.get("animal_id"):
            try:
                supabase.table("animals").update({"adoption_status": "ADOPTED"}).eq("id", app_record["animal_id"]).execute()
            except Exception as anim_err:
                logger.warning(f"Failed to auto-update animal adoption status: {anim_err}")

        # Send notification to applicant with human-readable labels
        applicant_id = app_record.get("applicant_id")
        if applicant_id:
            status_map = {
                "SUBMITTED": ("Submitted", "has been received and submitted"),
                "UNDER_REVIEW": ("Under Review", "is currently under review by our shelter team"),
                "APPROVED": ("Approved", "has been approved! Our team will contact you for pickup coordination"),
                "REJECTED": ("Declined", "was declined. Thank you for your interest in adopting"),
            }
            status_label, status_phrase = status_map.get(
                target_status,
                (target_status.replace("_", " ").title(), f"has been updated to {target_status.lower()}")
            )
            create_system_notification(
                user_id=applicant_id,
                notif_type="ADOPTION_DECISION",
                title=f"Adoption Application {status_label}",
                message=f"Your adoption application {status_phrase}.",
                related_entity_id=id,
                related_entity_type="ADOPTION",
            )

        log_audit_event(
            action="ADOPTION_STATUS_UPDATE",
            entity_type="ADOPTION_APPLICATION",
            entity_id=id,
            performed_by=user["uid"],
            old_value={"status": app_record.get("status")},
            new_value={"status": target_status, "screeningNotes": payload.screeningNotes},
        )
                
        return map_adoption(res.data[0])
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error updating adoption status {id}: {e}")
        raise HTTPException(status_code=500, detail="Failed to update adoption application status")
