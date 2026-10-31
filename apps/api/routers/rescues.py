import logging
from fastapi import APIRouter, Depends, HTTPException, Query, status
from typing import List, Optional
from pydantic import BaseModel
from datetime import datetime

from supabase_config import supabase
from auth import get_current_user

router = APIRouter(prefix="/api/rescues", tags=["rescues"])
logger = logging.getLogger("rescues")

STAFF_ROLES = {"ADMIN", "NGO", "VOLUNTEER", "SHELTER", "VET"}

class Location(BaseModel):
    latitude: float
    longitude: float

class RescueRequestCreate(BaseModel):
    title: str
    description: str
    severity: str
    species: str
    location: Location
    address: str
    photoUrls: List[str] = []

class RescueRequestStatusUpdate(BaseModel):
    status: str
    message: Optional[str] = None
    # updatedBy and updatedByName are deprecated/ignored for security; derived from token

class AssignVolunteerRequest(BaseModel):
    volunteerId: str
    volunteerName: str

@router.get("/")
def get_all_rescues(
    status: Optional[str] = None,
    severity: Optional[str] = None,
    species: Optional[str] = None,
    reporterId: Optional[str] = None
):
    try:
        query = supabase.table("rescues").select("*")
        if status:
            query = query.eq("status", status)
        if severity:
            query = query.eq("severity", severity)
        if species:
            query = query.eq("species", species)
        if reporterId:
            query = query.eq("reporter_id", reporterId)
            
        res = query.order("created_at", desc=True).execute()
        rescues = []
        for data in res.data:
            rescues.append({
                "id": data["id"],
                "title": data["title"],
                "description": data["description"],
                "species": data["species"],
                "severity": data["severity"],
                "status": data["status"],
                "reporterId": data["reporter_id"],
                "assignedTo": data["assigned_to"],
                "location": {"latitude": data["latitude"], "longitude": data["longitude"]},
                "address": data["address"],
                "photoUrls": data.get("images", []),
                "createdAt": data["created_at"],
                "updatedAt": data["updated_at"],
            })
        return rescues
    except Exception as e:
        logger.error(f"Error fetching rescues: {e}")
        raise HTTPException(status_code=500, detail="Failed to retrieve rescues")

@router.get("/{rescue_id}")
def get_rescue_by_id(rescue_id: str):
    try:
        res = supabase.table("rescues").select("*").eq("id", rescue_id).execute()
        if not res.data:
            raise HTTPException(status_code=404, detail="Rescue request not found")
        data = res.data[0]
        return {
            "id": data["id"],
            "title": data["title"],
            "description": data["description"],
            "species": data["species"],
            "severity": data["severity"],
            "status": data["status"],
            "reporterId": data["reporter_id"],
            "assignedTo": data["assigned_to"],
            "location": {"latitude": data["latitude"], "longitude": data["longitude"]},
            "address": data["address"],
            "photoUrls": data.get("images", []),
            "createdAt": data["created_at"],
            "updatedAt": data["updated_at"],
        }
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error fetching rescue {rescue_id}: {e}")
        raise HTTPException(status_code=500, detail="Failed to retrieve rescue request")

@router.post("/", status_code=status.HTTP_201_CREATED)
def create_rescue_request(request: RescueRequestCreate, user: dict = Depends(get_current_user)):
    try:
        new_rescue = {
            "title": request.title,
            "description": request.description,
            "species": request.species,
            "latitude": request.location.latitude,
            "longitude": request.location.longitude,
            "address": request.address,
            "images": request.photoUrls,
            "severity": request.severity,
            "status": "PENDING",
            "reporter_id": user["uid"],
        }
        
        res = supabase.table("rescues").insert(new_rescue).execute()
        if not res.data:
            raise HTTPException(status_code=500, detail="Failed to create rescue request")
        
        doc_id = res.data[0]["id"]
        
        # Add initial timeline entry
        try:
            timeline_entry = {
                "rescue_id": doc_id,
                "status": "PENDING",
                "message": "Rescue request submitted",
                "updated_by": user["uid"],
                "updated_by_name": user.get("name") or "Citizen Reporter",
            }
            supabase.table("rescue_timeline").insert(timeline_entry).execute()
        except Exception as te_err:
            logger.warning(f"Failed to record initial timeline: {te_err}")
        
        return {"id": doc_id, **res.data[0]}
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error creating rescue: {e}")
        raise HTTPException(status_code=500, detail="Failed to create rescue request")

@router.patch("/{rescue_id}/status")
def update_rescue_status(rescue_id: str, update: RescueRequestStatusUpdate, user: dict = Depends(get_current_user)):
    try:
        # Check existing rescue
        existing = supabase.table("rescues").select("*").eq("id", rescue_id).execute()
        if not existing.data:
            raise HTTPException(status_code=404, detail="Rescue request not found")
            
        current_rescue = existing.data[0]
        user_role = user.get("role", "CITIZEN")
        is_reporter = current_rescue.get("reporter_id") == user["uid"]
        is_staff = user_role in STAFF_ROLES
        
        # Authorization check:
        # Reporter can only cancel or mark resolved
        # Staff can update to any valid status
        if not is_staff:
            if not (is_reporter and update.status in ["CANCELLED", "RESOLVED"]):
                raise HTTPException(
                    status_code=403, 
                    detail="Forbidden: Only assigned responders or administrators can change rescue status to this state"
                )
        
        res = supabase.table("rescues").update({"status": update.status}).eq("id", rescue_id).execute()
        if not res.data:
            raise HTTPException(status_code=404, detail="Rescue request not found")
            
        # Record timeline entry using verified identity from JWT token
        try:
            status_msg = update.message or f"Status updated to {update.status}"
            timeline_entry = {
                "rescue_id": rescue_id,
                "status": update.status,
                "message": status_msg,
                "updated_by": user["uid"],
                "updated_by_name": user.get("name") or user_role,
            }
            supabase.table("rescue_timeline").insert(timeline_entry).execute()
        except Exception as te_err:
            logger.warning(f"Failed to insert timeline entry: {te_err}")
            
        return {"id": rescue_id, "status": update.status}
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error updating rescue status: {e}")
        raise HTTPException(status_code=500, detail="Failed to update rescue status")

@router.post("/{rescue_id}/assign")
def assign_volunteer(rescue_id: str, req: AssignVolunteerRequest, user: dict = Depends(get_current_user)):
    try:
        user_role = user.get("role", "CITIZEN")
        if user_role not in STAFF_ROLES:
            raise HTTPException(status_code=403, detail="Forbidden: Only staff and responders can assign volunteers")
            
        new_status = "DISPATCHED"
        res = supabase.table("rescues").update({
            "assigned_to": req.volunteerId,
            "status": new_status,
        }).eq("id", rescue_id).execute()
        
        if not res.data:
            raise HTTPException(status_code=404, detail="Rescue request not found")
            
        # Securely record timeline entry
        try:
            timeline_entry = {
                "rescue_id": rescue_id,
                "status": new_status,
                "message": f"Assigned to volunteer {req.volunteerName} by {user.get('name', 'Staff')}",
                "updated_by": user["uid"],
                "updated_by_name": user.get("name") or user_role,
            }
            supabase.table("rescue_timeline").insert(timeline_entry).execute()
        except Exception as te_err:
            logger.warning(f"Failed to record timeline assignment: {te_err}")
            
        return {"id": rescue_id, "status": new_status, "assignedTo": req.volunteerId}
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error assigning volunteer: {e}")
        raise HTTPException(status_code=500, detail="Failed to assign volunteer")

@router.delete("/{rescue_id}")
def delete_rescue(rescue_id: str, user: dict = Depends(get_current_user)):
    try:
        existing = supabase.table("rescues").select("id, reporter_id").eq("id", rescue_id).execute()
        if not existing.data:
            raise HTTPException(status_code=404, detail="Rescue request not found")
            
        rescue = existing.data[0]
        is_reporter = rescue.get("reporter_id") == user["uid"]
        is_admin = user.get("role") == "ADMIN"
        
        if not (is_reporter or is_admin):
            raise HTTPException(status_code=403, detail="Forbidden: Only the reporter or an administrator can delete this rescue request")
            
        supabase.table("rescues").delete().eq("id", rescue_id).execute()
        return {"id": rescue_id, "deleted": True}
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error deleting rescue {rescue_id}: {e}")
        raise HTTPException(status_code=500, detail="Failed to delete rescue request")

@router.get("/{rescue_id}/timeline")
def get_rescue_timeline(rescue_id: str):
    try:
        res = supabase.table("rescue_timeline").select("*").eq("rescue_id", rescue_id).order("created_at", desc=False).execute()
        return [
            {
                "id": d["id"], 
                "status": d["status"], 
                "message": d["message"], 
                "updatedBy": d.get("updated_by"),
                "updatedByName": d.get("updated_by_name"),
                "createdAt": d["created_at"]
            } 
            for d in res.data
        ]
    except Exception as e:
        logger.error(f"Error fetching rescue timeline: {e}")
        raise HTTPException(status_code=500, detail="Failed to retrieve rescue timeline")
