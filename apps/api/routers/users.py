from fastapi import APIRouter, Depends, HTTPException
from typing import Optional
from pydantic import BaseModel
from supabase_config import supabase
from auth import get_current_user

router = APIRouter(prefix="/api/users", tags=["users"])

class UserProfileCreate(BaseModel):
    uid: str
    email: str
    displayName: str
    role: Optional[str] = "CITIZEN"
    phoneNumber: Optional[str] = None

class UserProfileUpdate(BaseModel):
    displayName: Optional[str] = None
    phoneNumber: Optional[str] = None
    address: Optional[str] = None
    bio: Optional[str] = None

@router.get("/{uid}")
def get_user_profile(uid: str):
    res = supabase.table("users").select("*").eq("id", uid).execute()
    if not res.data:
        raise HTTPException(status_code=404, detail="User not found")
    data = res.data[0]
    return {
        "id": data["id"],
        "uid": data["id"],
        "email": data["email"],
        "displayName": data["display_name"],
        "role": data["role"],
        "phoneNumber": data.get("phone", ""),
        "createdAt": data["created_at"]
    }

@router.post("")
def create_user_profile(profile: UserProfileCreate):
    # This route might be redundant since Supabase handles profile creation via triggers,
    # but we will keep it working in case the frontend relies on it strictly.
    data = {
        "id": profile.uid,
        "email": profile.email,
        "display_name": profile.displayName,
        "role": profile.role,
        "phone": profile.phoneNumber or ""
    }
    
    # Use upsert to handle cases where the trigger already created it
    res = supabase.table("users").upsert(data).execute()
    if not res.data:
        raise HTTPException(status_code=500, detail="Failed to create user")
        
    return {"id": profile.uid, "uid": profile.uid, **profile.dict()}

@router.patch("/{uid}")
def update_user_profile(uid: str, profile: UserProfileUpdate):
    update_data = {}
    if profile.displayName is not None: update_data["display_name"] = profile.displayName
    if profile.phoneNumber is not None: update_data["phone"] = profile.phoneNumber
    
    if not update_data:
        # Just return current
        res = supabase.table("users").select("*").eq("id", uid).execute()
        if not res.data:
            raise HTTPException(status_code=404, detail="User not found")
        return res.data[0]
        
    res = supabase.table("users").update(update_data).eq("id", uid).execute()
    if not res.data:
        raise HTTPException(status_code=404, detail="User not found")
    
    return {"id": uid, "uid": uid, **res.data[0]}
