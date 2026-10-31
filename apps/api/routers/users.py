import logging
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel
from supabase_config import supabase
from auth import get_current_user

router = APIRouter(prefix="/api/users", tags=["users"])
logger = logging.getLogger("users")

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
    avatarUrl: Optional[str] = None

@router.get("/{uid}")
def get_user_profile(uid: str, current_user: dict = Depends(get_current_user)):
    try:
        res = supabase.table("users").select("*").eq("id", uid).execute()
        if not res.data:
            raise HTTPException(status_code=404, detail="User not found")
        data = res.data[0]
        
        # PII Protection: Only self or staff/admin can see email and phone
        is_self = current_user["uid"] == uid
        is_staff = current_user.get("role") in ["ADMIN", "NGO", "SHELTER", "VOLUNTEER"]
        
        return {
            "id": data["id"],
            "uid": data["id"],
            "displayName": data.get("display_name", ""),
            "role": data.get("role", "CITIZEN"),
            "avatarUrl": data.get("avatar_url", ""),
            "createdAt": data.get("created_at"),
            "email": data["email"] if (is_self or is_staff) else "",
            "phoneNumber": data.get("phone", "") if (is_self or is_staff) else "",
        }
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error fetching user profile {uid}: {e}")
        raise HTTPException(status_code=500, detail="Failed to retrieve user profile")

@router.post("")
def create_user_profile(profile: UserProfileCreate, current_user: dict = Depends(get_current_user)):
    # Authenticated user can only create/sync their own profile
    if current_user["uid"] != profile.uid and current_user.get("role") != "ADMIN":
        raise HTTPException(status_code=403, detail="Cannot create profile for another user")
        
    # Prevent unauthorized role assignment: non-admins are forced to CITIZEN
    target_role = profile.role if current_user.get("role") == "ADMIN" else "CITIZEN"
    
    data = {
        "id": profile.uid,
        "email": profile.email,
        "display_name": profile.displayName,
        "role": target_role,
        "phone": profile.phoneNumber or ""
    }
    
    try:
        res = supabase.table("users").upsert(data).execute()
        if not res.data:
            raise HTTPException(status_code=500, detail="Failed to create user profile")
            
        dumped = profile.model_dump()
        dumped["role"] = target_role
        return {"id": profile.uid, "uid": profile.uid, **dumped}
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error creating user profile: {e}")
        raise HTTPException(status_code=500, detail="Failed to create user profile")

@router.patch("/{uid}")
def update_user_profile(uid: str, profile: UserProfileUpdate, current_user: dict = Depends(get_current_user)):
    # Users can only update their own profile, unless they are an ADMIN
    if current_user["uid"] != uid and current_user.get("role") != "ADMIN":
        raise HTTPException(status_code=403, detail="Cannot edit profile of another user")
        
    update_data = {}
    if profile.displayName is not None: update_data["display_name"] = profile.displayName
    if profile.phoneNumber is not None: update_data["phone"] = profile.phoneNumber
    if profile.avatarUrl is not None: update_data["avatar_url"] = profile.avatarUrl
    
    try:
        if not update_data:
            res = supabase.table("users").select("*").eq("id", uid).execute()
            if not res.data:
                raise HTTPException(status_code=404, detail="User not found")
            return res.data[0]
            
        res = supabase.table("users").update(update_data).eq("id", uid).execute()
        if not res.data:
            raise HTTPException(status_code=404, detail="User not found")
        
        return {"id": uid, "uid": uid, **res.data[0]}
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error updating user profile {uid}: {e}")
        raise HTTPException(status_code=500, detail="Failed to update user profile")
