import logging
from typing import Optional, List
from fastapi import APIRouter, Depends, HTTPException, Query, status
from pydantic import BaseModel
from supabase_config import supabase
from auth import get_current_user
from validators import validate_avatar_url

router = APIRouter(prefix="/api/users", tags=["users"])
logger = logging.getLogger("users")

VALID_ROLES = {"CITIZEN", "NGO", "VOLUNTEER", "SHELTER", "VET", "ADMIN"}
ALLOWED_REQUESTED_ROLES = {"NGO", "VOLUNTEER", "SHELTER", "VET"}

class UserProfileCreate(BaseModel):
    uid: str
    email: Optional[str] = None
    displayName: str
    role: Optional[str] = "CITIZEN"
    phoneNumber: Optional[str] = None
    requestedRole: Optional[str] = None

class UserProfileUpdate(BaseModel):
    displayName: Optional[str] = None
    phoneNumber: Optional[str] = None
    phone: Optional[str] = None
    address: Optional[str] = None
    bio: Optional[str] = None
    avatarUrl: Optional[str] = None
    requestedRole: Optional[str] = None

class UserRoleUpdate(BaseModel):
    role: str

@router.get("")
def list_users(
    role: Optional[str] = None,
    has_requested_role: Optional[bool] = None,
    search: Optional[str] = None,
    limit: int = Query(default=50, ge=1, le=100),
    offset: int = Query(default=0, ge=0),
    current_user: dict = Depends(get_current_user),
):
    """Allows shelter/NGO managers and administrators to query users and view pending role requests.
    Strictly forbids VET and regular users from harvesting user directory PII.
    """
    if current_user.get("role") not in ["ADMIN", "NGO", "SHELTER"]:
        raise HTTPException(status_code=403, detail="Forbidden: Only administrators and shelter/NGO coordinators can list users")
        
    try:
        query = supabase.table("users").select("id, display_name, email, phone, role, requested_role, avatar_url, created_at, address, bio")
        if role:
            query = query.eq("role", role.upper())
        if has_requested_role:
            query = query.not_.is_("requested_role", "null")
        if search:
            query = query.ilike("display_name", f"%{search}%")
            
        res = query.order("created_at", desc=True).range(offset, offset + limit - 1).execute()
        is_admin = current_user.get("role") == "ADMIN"
        
        return [
            {
                "id": d["id"],
                "uid": d["id"],
                "displayName": d.get("display_name", ""),
                # Protect user PII: Only full system administrators can see emails and phone numbers across users
                "email": d.get("email", "") if is_admin else "",
                "phoneNumber": d.get("phone", "") if is_admin else "",
                "role": d.get("role", "CITIZEN"),
                "requestedRole": d.get("requested_role"),
                "avatarUrl": d.get("avatar_url", ""),
                "createdAt": d.get("created_at"),
            }
            for d in res.data
        ]
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error listing users: {e}")
        raise HTTPException(status_code=500, detail="Failed to retrieve users")

def check_staff_has_active_case_with_user(staff_id: str, target_user_id: str) -> bool:
    """Checks if a staff user (SHELTER, NGO, VOLUNTEER) has an active operational relationship
    with the target user to justify viewing their contact details (email, phone, address).
    Legitimate cases:
      1. Target user submitted an adoption application for an animal managed/reviewed by this shelter.
      2. Target user surrendered an animal to this shelter.
      3. Staff user is assigned to an emergency rescue incident reported by target user.
    """
    try:
        # 1. Adoption applications for animals managed by this staff/shelter
        apps = (
            supabase.table("adoption_applications")
            .select("id, animal_id, reviewer_id")
            .eq("applicant_id", target_user_id)
            .execute()
        )
        if apps.data:
            animal_ids = [a["animal_id"] for a in apps.data if a.get("animal_id")]
            if animal_ids:
                shelter_animals = (
                    supabase.table("animals")
                    .select("id")
                    .in_("id", animal_ids)
                    .eq("shelter_id", staff_id)
                    .limit(1)
                    .execute()
                )
                if shelter_animals.data and len(shelter_animals.data) > 0:
                    return True
            if any(a.get("reviewer_id") == staff_id for a in apps.data):
                return True

        # 2. Check if target user surrendered an animal to this shelter
        surrenders = (
            supabase.table("animals")
            .select("id")
            .eq("surrendered_by", target_user_id)
            .eq("shelter_id", staff_id)
            .limit(1)
            .execute()
        )
        if surrenders.data and len(surrenders.data) > 0:
            return True

        # 3. Check if staff is assigned to a rescue reported by target user
        rescues = (
            supabase.table("rescues")
            .select("id")
            .eq("reporter_id", target_user_id)
            .eq("assigned_to", staff_id)
            .limit(1)
            .execute()
        )
        if rescues.data and len(rescues.data) > 0:
            return True

        return False
    except Exception as e:
        logger.warning(f"Error checking staff relationship for {staff_id} -> {target_user_id}: {e}")
        return False

@router.get("/{uid}")
def get_user_profile(uid: str, current_user: dict = Depends(get_current_user)):
    try:
        res = supabase.table("users").select("*").eq("id", uid).execute()
        if not res.data:
            raise HTTPException(status_code=404, detail="User not found")
        data = res.data[0]
        
        is_self = current_user["uid"] == uid
        is_admin = current_user.get("role") == "ADMIN"
        caller_role = current_user.get("role")
        
        # PII Protection: Contact details (email, phone, address) are strictly scoped:
        # - Full system administrators
        # - The user themselves
        # - Staff (SHELTER, NGO, VOLUNTEER) with an active application, surrender, or rescue case with the user
        can_view_contact = False
        if is_self or is_admin:
            can_view_contact = True
        elif caller_role in ["NGO", "SHELTER", "VOLUNTEER"]:
            can_view_contact = check_staff_has_active_case_with_user(current_user["uid"], uid)
        
        return {
            "id": data["id"],
            "uid": data["id"],
            "displayName": data.get("display_name", ""),
            "role": data.get("role", "CITIZEN"),
            "requestedRole": data.get("requested_role") if (is_self or is_admin) else None,
            "avatarUrl": data.get("avatar_url", ""),
            "createdAt": data.get("created_at"),
            "email": data.get("email", "") if can_view_contact else "",
            "phoneNumber": data.get("phone", "") if can_view_contact else "",
            "address": data.get("address", "") if can_view_contact else "",
            "bio": data.get("bio", ""),
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
        
        # Disallow requesting ADMIN role through signup metadata or profile creation
        req_role = profile.requestedRole.upper() if profile.requestedRole else None
        if req_role == "ADMIN" or req_role not in ALLOWED_REQUESTED_ROLES:
            req_role = None

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
            "phone": profile.phoneNumber or "",
        }
        if req_role:
            data["requested_role"] = req_role
        
        res = supabase.table("users").upsert(data).execute()
        if not res.data:
            raise HTTPException(status_code=500, detail="Failed to create user profile")
            
        dumped = profile.model_dump()
        dumped["email"] = verified_email
        dumped["role"] = target_role
        dumped["requestedRole"] = req_role
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
    if profile.displayName is not None: 
        update_data["display_name"] = profile.displayName
    phone_val = profile.phoneNumber if profile.phoneNumber is not None else profile.phone
    if phone_val is not None: 
        update_data["phone"] = phone_val
    if profile.address is not None: 
        update_data["address"] = profile.address
    if profile.bio is not None: 
        update_data["bio"] = profile.bio
    if profile.avatarUrl is not None: 
        update_data["avatar_url"] = validate_avatar_url(profile.avatarUrl)
    if profile.requestedRole is not None:
        raw_req = profile.requestedRole.strip().upper() if profile.requestedRole.strip() else None
        if raw_req == "ADMIN" or (raw_req and raw_req not in ALLOWED_REQUESTED_ROLES):
            raise HTTPException(status_code=400, detail="Cannot request ADMIN or invalid role")
        update_data["requested_role"] = raw_req
    
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
        # Fetch current role for audit log tracking
        current_rec = supabase.table("users").select("role, display_name").eq("id", uid).execute()
        prev_role = current_rec.data[0].get("role", "UNKNOWN") if (current_rec.data and len(current_rec.data) > 0) else "UNKNOWN"

        # Update role and clear pending requested_role
        res = supabase.table("users").update({
            "role": target_role,
            "requested_role": None
        }).eq("id", uid).execute()
        
        if not res.data:
            raise HTTPException(status_code=404, detail="User not found")

        # Audit role change in database audit_logs (performed_by records real admin) and structured logs
        audit_entry = {
            "action": "ROLE_CHANGE",
            "entity_type": "USER",
            "entity_id": uid,
            "performed_by": current_user["uid"],
            "old_value": {"role": prev_role},
            "new_value": {"role": target_role},
        }
        try:
            supabase.table("audit_logs").insert(audit_entry).execute()
        except Exception as audit_err:
            logger.warning(f"Could not persist audit record to database: {audit_err}")

        logger.info(
            f"AUDIT: Role changed for user {uid} from '{prev_role}' to '{target_role}' by admin '{current_user['uid']}'"
        )
            
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
