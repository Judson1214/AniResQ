from fastapi import APIRouter, Depends, HTTPException, Query
from typing import Optional, List, Dict, Any
from pydantic import BaseModel, Field
from datetime import datetime
from firebase_config import db
from auth import get_current_user

router = APIRouter(prefix="/api/animals", tags=["animals"])

class AnimalCreate(BaseModel):
    name: str
    species: str
    status: str
    description: Optional[str] = None
    age: Optional[int] = None
    gender: Optional[str] = None
    location: Optional[str] = None

class AnimalUpdate(BaseModel):
    name: Optional[str] = None
    species: Optional[str] = None
    status: Optional[str] = None
    description: Optional[str] = None
    age: Optional[int] = None
    gender: Optional[str] = None
    location: Optional[str] = None

@router.get("/")
def get_animals(status: Optional[str] = None, species: Optional[str] = None):
    animals_ref = db.collection("animals")
    query = animals_ref
    if status:
        query = query.where("status", "==", status)
    if species:
        query = query.where("species", "==", species)
    
    docs = query.stream()
    result = []
    for doc in docs:
        data = doc.to_dict()
        data["id"] = doc.id
        result.append(data)
    return result

@router.get("/{id}")
def get_animal(id: str):
    doc_ref = db.collection("animals").document(id)
    doc = doc_ref.get()
    if not doc.exists:
        raise HTTPException(status_code=404, detail="Animal not found")
    data = doc.to_dict()
    data["id"] = doc.id
    return data

@router.post("/")
def create_animal(animal: AnimalCreate, user: dict = Depends(get_current_user)):
    data = animal.dict(exclude_unset=True)
    data["createdAt"] = datetime.utcnow().isoformat()
    data["createdBy"] = user["uid"]
    
    doc_ref = db.collection("animals").document()
    doc_ref.set(data)
    data["id"] = doc_ref.id
    return data

@router.patch("/{id}")
def update_animal(id: str, animal: AnimalUpdate, user: dict = Depends(get_current_user)):
    doc_ref = db.collection("animals").document(id)
    doc = doc_ref.get()
    if not doc.exists:
        raise HTTPException(status_code=404, detail="Animal not found")
    
    data = animal.dict(exclude_unset=True)
    if not data:
        return {"id": id, **doc.to_dict()}
    
    data["updatedAt"] = datetime.utcnow().isoformat()
    doc_ref.update(data)
    
    updated_doc = doc_ref.get().to_dict()
    updated_doc["id"] = id
    return updated_doc

@router.delete("/{id}")
def delete_animal(id: str, user: dict = Depends(get_current_user)):
    doc_ref = db.collection("animals").document(id)
    if not doc_ref.get().exists:
        raise HTTPException(status_code=404, detail="Animal not found")
    doc_ref.delete()
    return {"message": "Animal deleted successfully"}
