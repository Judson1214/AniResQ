import logging
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel
from supabase_config import supabase
from auth import get_current_user

router = APIRouter(prefix="/api/users", tags=["users"])
logger = logging.getLogger("users")

VALID_ROLES = {"CITIZEN", "NGO", "VOLUNTEER", "SHELTER", "VET", "ADMIN"}

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

class UserRoleUpdate(BaseModel):
    role: str

@router.get("/{uid}")
def get_user_profile(uid: str, current_user: dict = Depends(get_current_user)):
    try:
        res = supabase.table("users").select("*").eq("id", uid).execute()
        if not res.data:
            raise HTTPException(status_code=404, detail="User not found")
        data = res.data[0]
        
        # PII Protection: Only self or organizational staff/admin can see email and phone
        # Excludes regular volunteers from broad PII access
        is_self = current_user["uid"] == uid
        is_staff_admin = current_user.get("role") in ["ADMIN", "NGO", "SHELTER", "VET"]
        
        return {
            "id": data["id"],
            "uid": data["id"],
            "displayName": data.get("display_name", ""),
            "role": data.get("role", "CITIZEN"),
            "avatarUrl": data.get("avatar_url", ""),
            "createdAt": data.get("created_at"),
            "email": data["email"] if (is_self or is_staff_admin) else "",
            "phoneNumber": data.get("phone", "") if (is_self or is_staff_admin) else "",
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
        
    try:
        # Prevent unauthorized role changes or demoting existing staff members
        existing = supabase.table("users").select("role").eq("id", profile.uid).execute()
        if existing.data and current_user.get("role") != "ADMIN":
            target_role = existing.data[0].get("role", "CITIZEN")
        else:
            target_role = profile.role.upper() if current_user.get("role") == "ADMIN" and profile.role else "CITIZEN"
            
        if target_role not in VALID_ROLES:
            target_role = "CITIZEN"
        
        data = {
            "id": profile.uid,
            "email": profile.email,
            "display_name": profile.displayName,
            "role": target_role,
            "phone": profile.phoneNumber or ""
        }
        
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

@router.patch("/{uid}/role")
def update_user_role(uid: str, req: UserRoleUpdate, current_user: dict = Depends(get_current_user)):
    if current_user.get("role") != "ADMIN":
        raise HTTPException(status_code=403, detail="Forbidden: Only administrators can assign user roles")
        
    target_role = req.role.upper()
    if target_role not in VALID_ROLES:
        raise HTTPException(status_code=422, detail=f"Invalid role '{req.role}'. Must be one of {sorted(VALID_ROLES)}")
        
    try:
        res = supabase.table("users").update({"role": target_role}).eq("id", uid).execute()
        if not res.data:
            raise HTTPException(status_code=404, detail="User not found")
            
        return {
            "id": uid,
            "uid": uid,
            "role": target_role,
            "displayName": res.data[0].get("display_name", "")
        }
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error updating role for user {uid}: {e}")
        raise HTTPException(status_code=500, detail="Failed to update user role")
