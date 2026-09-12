from fastapi import APIRouter, Depends, HTTPException, Query
from typing import Optional, List
from pydantic import BaseModel
from datetime import datetime
from firebase_config import db
from auth import get_current_user

router = APIRouter(prefix="/api/lostfound", tags=["lostfound"])

class Location(BaseModel):
    latitude: float
    longitude: float

class LostFoundCreate(BaseModel):
    type: str
    title: str
    description: str
    species: str
    breed: Optional[str] = None
    color: str
    contactPhone: str
    contactEmail: str
    location: Location
    lastSeenAddress: str
    lastSeenDate: str
    reporterId: str
    photoUrls: List[str] = []

class LostFoundStatusUpdate(BaseModel):
    status: str

@router.get("/")
def get_lost_found(type: Optional[str] = None, status: Optional[str] = None):
    lf_ref = db.collection("lostfound")
    query = lf_ref
    if type:
        query = query.where("type", "==", type)
    if status:
        query = query.where("status", "==", status)
    
    docs = query.stream()
    result = []
    for doc in docs:
        data = doc.to_dict()
        data["id"] = doc.id
        result.append(data)
    return result

@router.post("/")
def create_lost_found(report: LostFoundCreate, user: dict = Depends(get_current_user)):
    data = report.dict(exclude_unset=True)
    data["userId"] = user["uid"]
    data["status"] = "ACTIVE"
    data["createdAt"] = datetime.utcnow().isoformat()
    
    doc_ref = db.collection("lostfound").document()
    doc_ref.set(data)
    data["id"] = doc_ref.id
    return data

@router.patch("/{id}/status")
def update_lost_found_status(id: str, status_update: LostFoundStatusUpdate, user: dict = Depends(get_current_user)):
    doc_ref = db.collection("lostfound").document(id)
    if not doc_ref.get().exists:
        raise HTTPException(status_code=404, detail="Report not found")
    
    update_data = {
        "status": status_update.status,
        "updatedAt": datetime.utcnow().isoformat()
    }
    doc_ref.update(update_data)
    
    updated_doc = doc_ref.get().to_dict()
    updated_doc["id"] = id
    return updated_doc

class LostFoundReply(BaseModel):
    text: str

@router.post("/{id}/replies")
def add_lost_found_reply(id: str, reply: LostFoundReply, user: dict = Depends(get_current_user)):
    doc_ref = db.collection("lostfound").document(id)
    if not doc_ref.get().exists:
        raise HTTPException(status_code=404, detail="Report not found")
        
    reply_data = {
        "userId": user["uid"],
        "userName": user.get("name", user.get("email", "Anonymous")),
        "text": reply.text,
        "createdAt": datetime.utcnow().isoformat()
    }
    
    # Save in a subcollection "replies"
    reply_ref = doc_ref.collection("replies").document()
    reply_ref.set(reply_data)
    
    reply_data["id"] = reply_ref.id
    return reply_data

@router.get("/{id}/replies")
def get_lost_found_replies(id: str):
    doc_ref = db.collection("lostfound").document(id)
    if not doc_ref.get().exists:
        raise HTTPException(status_code=404, detail="Report not found")
        
    docs = doc_ref.collection("replies").order_by("createdAt").stream()
    result = []
    for doc in docs:
        data = doc.to_dict()
        data["id"] = doc.id
        result.append(data)
    return result
