from fastapi import APIRouter, Depends, HTTPException
from typing import Optional
from pydantic import BaseModel
from datetime import datetime
from firebase_config import db
from auth import get_current_user

router = APIRouter(prefix="/api/users", tags=["users"])

class UserProfileCreate(BaseModel):
    uid: str
    email: str
    displayName: str
    role: Optional[str] = "user"
    phoneNumber: Optional[str] = None

class UserProfileUpdate(BaseModel):
    displayName: Optional[str] = None
    phoneNumber: Optional[str] = None
    address: Optional[str] = None
    bio: Optional[str] = None

@router.get("/{uid}")
def get_user_profile(uid: str):
    doc_ref = db.collection("users").document(uid)
    doc = doc_ref.get()
    if not doc.exists:
        raise HTTPException(status_code=404, detail="User not found")
    data = doc.to_dict()
    data["id"] = doc.id
    return data

@router.post("")
def create_user_profile(profile: UserProfileCreate):
    data = profile.dict(exclude_unset=True)
    uid = data.pop("uid")
    data["createdAt"] = datetime.utcnow().isoformat()
    
    doc_ref = db.collection("users").document(uid)
    doc_ref.set(data)
    data["id"] = uid
    return data

@router.patch("/{uid}")
def update_user_profile(uid: str, profile: UserProfileUpdate):
    doc_ref = db.collection("users").document(uid)
    if not doc_ref.get().exists:
        raise HTTPException(status_code=404, detail="User not found")
    
    update_data = profile.dict(exclude_unset=True)
    if not update_data:
        return {"id": uid, **doc_ref.get().to_dict()}
        
    update_data["updatedAt"] = datetime.utcnow().isoformat()
    doc_ref.update(update_data)
    
    updated_doc = doc_ref.get().to_dict()
    updated_doc["id"] = uid
    return updated_doc
