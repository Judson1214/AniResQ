from fastapi import APIRouter, Depends, HTTPException, Query
from typing import Optional
from pydantic import BaseModel
from datetime import datetime
from firebase_config import db
from auth import get_current_user

router = APIRouter(prefix="/api/adoptions", tags=["adoptions"])

class AdoptionCreate(BaseModel):
    animalId: str
    reason: str
    experience: Optional[str] = None

class AdoptionStatusUpdate(BaseModel):
    status: str

@router.get("/")
def get_adoptions(
    applicantId: Optional[str] = None,
    animalId: Optional[str] = None,
    status: Optional[str] = None
):
    adoptions_ref = db.collection("adoptions")
    query = adoptions_ref
    if applicantId:
        query = query.where("applicantId", "==", applicantId)
    if animalId:
        query = query.where("animalId", "==", animalId)
    if status:
        query = query.where("status", "==", status)
    
    docs = query.stream()
    result = []
    for doc in docs:
        data = doc.to_dict()
        data["id"] = doc.id
        result.append(data)
    return result

@router.get("/{id}")
def get_adoption(id: str):
    doc_ref = db.collection("adoptions").document(id)
    doc = doc_ref.get()
    if not doc.exists:
        raise HTTPException(status_code=404, detail="Adoption application not found")
    data = doc.to_dict()
    data["id"] = doc.id
    return data

@router.post("/")
def create_adoption(adoption: AdoptionCreate, user: dict = Depends(get_current_user)):
    data = adoption.dict(exclude_unset=True)
    data["applicantId"] = user["uid"]
    data["status"] = "pending"
    data["createdAt"] = datetime.utcnow().isoformat()
    
    doc_ref = db.collection("adoptions").document()
    doc_ref.set(data)
    data["id"] = doc_ref.id
    return data

@router.patch("/{id}/status")
def update_adoption_status(id: str, status_update: AdoptionStatusUpdate, user: dict = Depends(get_current_user)):
    doc_ref = db.collection("adoptions").document(id)
    if not doc_ref.get().exists:
        raise HTTPException(status_code=404, detail="Adoption application not found")
    
    update_data = {
        "status": status_update.status,
        "updatedAt": datetime.utcnow().isoformat()
    }
    doc_ref.update(update_data)
    
    updated_doc = doc_ref.get().to_dict()
    updated_doc["id"] = id
    return updated_doc
