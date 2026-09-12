from fastapi import APIRouter, Depends, HTTPException
from typing import List, Optional
from pydantic import BaseModel
from datetime import datetime

from firebase_config import db
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
    rescues_ref = db.collection("rescueRequests")
    # For now, order by creation in python or let frontend sort.
    docs = rescues_ref.order_by("createdAt", direction="DESCENDING").stream()
    rescues = []
    for doc in docs:
        data = doc.to_dict()
        data["id"] = doc.id
        rescues.append(data)
    return rescues

@router.get("/{rescue_id}")
def get_rescue_by_id(rescue_id: str):
    doc_ref = db.collection("rescueRequests").document(rescue_id)
    doc = doc_ref.get()
    if not doc.exists:
        raise HTTPException(status_code=404, detail="Rescue request not found")
    data = doc.to_dict()
    data["id"] = doc.id
    return data

@router.post("/")
def create_rescue_request(request: RescueRequestCreate, user: dict = Depends(get_current_user)):
    try:
        now = datetime.utcnow().isoformat()
        new_rescue = {
            "title": request.title,
            "description": request.description,
            "species": request.species,
            "location": request.location.model_dump(),
            "address": request.address,
            "photoUrls": request.photoUrls,
            "severity": request.severity,
            "status": "PENDING",
            "reporterId": user.get("uid"),
            "assignedTo": None,
            "createdAt": now,
            "updatedAt": now
        }
        
        # Add to collection
        _, doc_ref = db.collection("rescueRequests").add(new_rescue)
        
        # Add timeline entry
        timeline_entry = {
            "status": "PENDING",
            "message": "Rescue request submitted",
            "updatedBy": user.get("uid"),
            "updatedByName": user.get("name") or "System",
            "createdAt": now
        }
        db.collection("rescueRequests").document(doc_ref.id).collection("timeline").add(timeline_entry)
        
        new_rescue["id"] = doc_ref.id
        return new_rescue
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.patch("/{rescue_id}/status")
def update_rescue_status(rescue_id: str, update: RescueRequestStatusUpdate, user: dict = Depends(get_current_user)):
    try:
        doc_ref = db.collection("rescueRequests").document(rescue_id)
        if not doc_ref.get().exists:
            raise HTTPException(status_code=404, detail="Not found")
            
        now = datetime.utcnow().isoformat()
        doc_ref.update({
            "status": update.status,
            "updatedAt": now
        })
        
        timeline_entry = {
            "status": update.status,
            "message": update.message,
            "updatedBy": update.updatedBy,
            "updatedByName": update.updatedByName,
            "createdAt": now
        }
        doc_ref.collection("timeline").add(timeline_entry)
        
        return {"id": rescue_id, "status": update.status}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/{rescue_id}/assign")
def assign_volunteer(rescue_id: str, req: AssignVolunteerRequest, user: dict = Depends(get_current_user)):
    try:
        doc_ref = db.collection("rescueRequests").document(rescue_id)
        if not doc_ref.get().exists:
            raise HTTPException(status_code=404, detail="Not found")
            
        now = datetime.utcnow().isoformat()
        new_status = "DISPATCHED"
        doc_ref.update({
            "assignedTo": req.volunteerId,
            "status": new_status,
            "updatedAt": now
        })
        
        timeline_entry = {
            "status": new_status,
            "message": f"Assigned to volunteer {req.volunteerName}",
            "updatedBy": req.volunteerId,
            "updatedByName": req.volunteerName,
            "createdAt": now
        }
        doc_ref.collection("timeline").add(timeline_entry)
        
        return {"id": rescue_id, "status": new_status}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/{rescue_id}/timeline")
def get_rescue_timeline(rescue_id: str):
    timeline_ref = db.collection("rescueRequests").document(rescue_id).collection("timeline")
    docs = timeline_ref.order_by("createdAt", direction="DESCENDING").stream()
    return [{"id": d.id, **d.to_dict()} for d in docs]
