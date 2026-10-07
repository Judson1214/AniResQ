from fastapi import APIRouter, Depends, HTTPException
from typing import List, Optional
from pydantic import BaseModel
from datetime import datetime

from supabase_config import supabase
from auth import get_current_user

router = APIRouter(prefix="/api/rescues", tags=["rescues"])

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
    message: str
    updatedBy: str
    updatedByName: str

class AssignVolunteerRequest(BaseModel):
    volunteerId: str
    volunteerName: str

@router.get("/")
def get_all_rescues():
    res = supabase.table("rescues").select("*").order("created_at", desc=True).execute()
    # Map snake_case back to camelCase if frontend expects it
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

@router.get("/{rescue_id}")
def get_rescue_by_id(rescue_id: str):
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

@router.post("/")
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
            "reporter_id": user.get("uid"),
        }
        
        # Insert rescue
        res = supabase.table("rescues").insert(new_rescue).execute()
        if not res.data:
            raise Exception("Failed to insert rescue")
        
        doc_id = res.data[0]["id"]
        
        # Add timeline entry
        # Note: We assume a 'rescue_timeline' table exists. 
        # If not, this step can be skipped or the schema updated.
        try:
            timeline_entry = {
                "rescue_id": doc_id,
                "status": "PENDING",
                "message": "Rescue request submitted",
                "updated_by": user.get("uid"),
                "updated_by_name": user.get("name") or "System",
            }
            supabase.table("rescue_timeline").insert(timeline_entry).execute()
        except Exception as e:
            print(f"Warning: Failed to insert timeline entry (table might not exist yet): {e}")
        
        return {"id": doc_id, **res.data[0]}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.patch("/{rescue_id}/status")
def update_rescue_status(rescue_id: str, update: RescueRequestStatusUpdate, user: dict = Depends(get_current_user)):
    try:
        res = supabase.table("rescues").update({"status": update.status}).eq("id", rescue_id).execute()
        if not res.data:
            raise HTTPException(status_code=404, detail="Not found")
            
        try:
            timeline_entry = {
                "rescue_id": rescue_id,
                "status": update.status,
                "message": update.message,
                "updated_by": update.updatedBy,
                "updated_by_name": update.updatedByName,
            }
            supabase.table("rescue_timeline").insert(timeline_entry).execute()
        except Exception:
            pass
            
        return {"id": rescue_id, "status": update.status}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/{rescue_id}/assign")
def assign_volunteer(rescue_id: str, req: AssignVolunteerRequest, user: dict = Depends(get_current_user)):
    try:
        new_status = "DISPATCHED"
        res = supabase.table("rescues").update({
            "assigned_to": req.volunteerId,
            "status": new_status,
        }).eq("id", rescue_id).execute()
        
        if not res.data:
            raise HTTPException(status_code=404, detail="Not found")
            
        try:
            timeline_entry = {
                "rescue_id": rescue_id,
                "status": new_status,
                "message": f"Assigned to volunteer {req.volunteerName}",
                "updated_by": req.volunteerId,
                "updated_by_name": req.volunteerName,
            }
            supabase.table("rescue_timeline").insert(timeline_entry).execute()
        except Exception:
            pass
            
        return {"id": rescue_id, "status": new_status}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/{rescue_id}/timeline")
def get_rescue_timeline(rescue_id: str):
    res = supabase.table("rescue_timeline").select("*").eq("rescue_id", rescue_id).order("created_at", desc=True).execute()
    return [{"id": d["id"], "status": d["status"], "message": d["message"], "createdAt": d["created_at"]} for d in res.data]
