import logging
from typing import Optional, List
from fastapi import APIRouter, Depends, HTTPException, Query, status
from pydantic import BaseModel
from supabase_config import supabase
from auth import get_current_user

router = APIRouter(prefix="/api/users", tags=["users"])
logger = logging.getLogger("users")

VALID_ROLES = {"CITIZEN", "NGO", "VOLUNTEER", "SHELTER", "VET", "ADMIN"}

def validate_avatar_url(url: Optional[str]) -> Optional[str]:
    if not url:
        return url
    u = url.strip()
    if "/storage/v1/object/public/uploads/" in u or u.startswith("uploads/") or "/uploads/" in u:
        return u
    raise HTTPException(
        status_code=422,
        detail="Invalid avatar URL. Avatars must be uploaded to the official AniResQ uploads storage bucket."
    )

class UserProfileCreate(BaseModel):
    uid: str
    email: Optional[str] = None
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

@router.get("")
def list_users(
    role: Optional[str] = None,
    has_requested_role: Optional[bool] = None,
    limit: int = Query(default=50, ge=1, le=100),
    offset: int = Query(default=0, ge=0),
    current_user: dict = Depends(get_current_user),
):
    """Allows staff/administrators to query users and view pending role requests."""
    if current_user.get("role") not in ["ADMIN", "NGO", "SHELTER", "VET"]:
        raise HTTPException(status_code=403, detail="Forbidden: Only staff and administrators can list users")
        
    try:
        query = supabase.table("users").select("id, display_name, email, phone, role, requested_role, avatar_url, created_at")
        if role:
            query = query.eq("role", role.upper())
        if has_requested_role:
            query = query.not_.is_("requested_role", "null")
            
        res = query.order("created_at", desc=True).range(offset, offset + limit - 1).execute()
        return [
            {
                "id": d["id"],
                "uid": d["id"],
                "displayName": d.get("display_name", ""),
                "email": d.get("email", ""),
                "phoneNumber": d.get("phone", ""),
                "role": d.get("role", "CITIZEN"),
                "requestedRole": d.get("requested_role"),
                "avatarUrl": d.get("avatar_url", ""),
                "createdAt": d.get("created_at"),
            }
            for d in res.data
        ]
    except Exception as e:
        logger.error(f"Error listing users: {e}")
        raise HTTPException(status_code=500, detail="Failed to retrieve users")

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
            "requestedRole": data.get("requested_role") if (is_self or is_staff_admin) else None,
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
        existing = supabase.table("users").select("role, email").eq("id", profile.uid).execute()
        if existing.data and current_user.get("role") != "ADMIN":
            target_role = existing.data[0].get("role", "CITIZEN")
        else:
            target_role = profile.role.upper() if current_user.get("role") == "ADMIN" and profile.role else "CITIZEN"
            
        if target_role not in VALID_ROLES:
            target_role = "CITIZEN"
        
        # Security: Derive verified email strictly from authenticated JWT token
        verified_email = current_user.get("email")
        if not verified_email and existing.data:
            verified_email = existing.data[0].get("email")
        if not verified_email:
            verified_email = profile.email or ""
            
        data = {
            "id": profile.uid,
            "email": verified_email,
            "display_name": profile.displayName,
            "role": target_role,
            "phone": profile.phoneNumber or ""
        }
        
        res = supabase.table("users").upsert(data).execute()
        if not res.data:
            raise HTTPException(status_code=500, detail="Failed to create user profile")
            
        dumped = profile.model_dump()
        dumped["email"] = verified_email
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
    if profile.avatarUrl is not None: 
        update_data["avatar_url"] = validate_avatar_url(profile.avatarUrl)
    
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
        
    # Guard against demoting the last remaining administrator
    if current_user["uid"] == uid and target_role != "ADMIN":
        admin_check = supabase.table("users").select("id", count="exact").eq("role", "ADMIN").execute()
        if admin_check.count is not None and admin_check.count <= 1:
            raise HTTPException(status_code=400, detail="Cannot demote the last administrator.")
            
    try:
        # Update role and clear pending requested_role
        res = supabase.table("users").update({
            "role": target_role,
            "requested_role": None
        }).eq("id", uid).execute()
        
        if not res.data:
            raise HTTPException(status_code=404, detail="User not found")
            
        return {
            "id": uid,
            "uid": uid,
            "role": target_role,
            "requestedRole": None,
            "displayName": res.data[0].get("display_name", "")
        }
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error updating role for user {uid}: {e}")
        raise HTTPException(status_code=500, detail="Failed to update user role")
