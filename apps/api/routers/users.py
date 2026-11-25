import os
import logging
from typing import Optional, List
from fastapi import APIRouter, Depends, HTTPException, Query, status
from pydantic import BaseModel
from supabase_config import supabase
from auth import get_current_user
from validators import validate_avatar_url
from .notifications import create_system_notification
from .audit import log_audit_event

router = APIRouter(prefix="/api/users", tags=["users"])
logger = logging.getLogger("users")

def is_test_environment() -> bool:
    return os.getenv("TESTING", "").lower() in ("true", "1") or "PYTEST_CURRENT_TEST" in os.environ

VALID_ROLES = {"CITIZEN", "NGO", "VOLUNTEER", "SHELTER", "VET", "ADMIN"}
ALLOWED_REQUESTED_ROLES = {"NGO", "VOLUNTEER", "SHELTER", "VET"}

class UserProfileCreate(BaseModel):
    uid: str
    email: Optional[str] = None
    displayName: str
    role: Optional[str] = "CITIZEN"
    phoneNumber: Optional[str] = None
    requestedRole: Optional[str] = None
    idCardType: Optional[str] = None
    idCardNumber: Optional[str] = None
    idCardUrl: Optional[str] = None

class UserProfileUpdate(BaseModel):
    displayName: Optional[str] = None
    phoneNumber: Optional[str] = None
    phone: Optional[str] = None
    address: Optional[str] = None
    bio: Optional[str] = None
    avatarUrl: Optional[str] = None
    requestedRole: Optional[str] = None
    idCardType: Optional[str] = None
    idCardNumber: Optional[str] = None
    idCardUrl: Optional[str] = None
    latitude: Optional[float] = None
    longitude: Optional[float] = None
    serviceRadiusKm: Optional[int] = None
    alertsEnabled: Optional[bool] = None

class UserRoleUpdate(BaseModel):
    role: str

class UserResponse(BaseModel):
    id: str
    uid: str
    displayName: Optional[str] = ""
    role: str = "CITIZEN"
    requestedRole: Optional[str] = None
    idCardType: Optional[str] = None
    idCardNumber: Optional[str] = None
    idCardUrl: Optional[str] = None
    avatarUrl: Optional[str] = ""
    createdAt: Optional[str] = None
    email: Optional[str] = ""
    phoneNumber: Optional[str] = ""
    address: Optional[str] = ""
    bio: Optional[str] = ""
    latitude: Optional[float] = None
    longitude: Optional[float] = None
    serviceRadiusKm: Optional[int] = None
    alertsEnabled: Optional[bool] = None

def notify_admins_of_role_request(
    user_id: str,
    user_name: str,
    user_email: str,
    req_role: str,
    id_card_type: Optional[str] = None,
    id_card_number: Optional[str] = None
):
    """Pushes a high-priority system notification to all administrators when an operator applies for elevated clearance."""
    try:
        admins = supabase.table("users").select("id").eq("role", "ADMIN").execute()
        id_info = f"{id_card_type}: {id_card_number}" if (id_card_type or id_card_number) else "Pending ID documentation"
        for admin in (admins.data or []):
            create_system_notification(
                user_id=admin["id"],
                notif_type="ROLE_REQUEST",
                title=f"New Clearance Request: {req_role}",
                message=f"Operator '{user_name}' ({user_email}) has requested clearance for {req_role}. Verification: {id_info}.",
                related_entity_id=user_id,
                related_entity_type="USER"
            )
        logger.info(f"Dispatched clearance request notifications to {len(admins.data or [])} admins for {user_id} ({req_role})")
    except Exception as e:
        logger.warning(f"Failed to notify admins of role request: {e}")

def map_user(data: dict, can_view_contact: bool = True, can_view_sensitive: bool = True) -> dict:
    """Map DB row to UserResponse shape with consistent camelCase attributes and PII redaction."""
    user_id = data.get("id") or data.get("uid") or ""

    # Sensitive geolocation & alert preferences
    lat = data.get("latitude") if can_view_sensitive else None
    lon = data.get("longitude") if can_view_sensitive else None

    radius_val = data.get("service_radius_km")
    if radius_val is None:
        radius_val = data.get("serviceRadiusKm")
    if radius_val is None and can_view_sensitive:
        radius_val = 15
    service_radius = radius_val if can_view_sensitive else None

    alerts_val = data.get("alerts_enabled")
    if alerts_val is None:
        alerts_val = data.get("alertsEnabled")
    if alerts_val is None and can_view_sensitive:
        alerts_val = True
    alerts_enabled = alerts_val if can_view_sensitive else None

    # Parse identification card proof
    id_card_type = data.get("id_card_type") or data.get("idCardType")
    id_card_number = data.get("id_card_number") or data.get("idCardNumber")
    id_card_url = data.get("id_card_url") or data.get("idCardUrl")

    bio_text = data.get("bio") or ""
    if not id_card_number and "[ID:" in bio_text:
        try:
            raw_id = bio_text.split("[ID:")[1].split("]")[0].strip()
            if " | " in raw_id:
                parts = raw_id.split(" | ")
                id_card_type = parts[0].strip()
                id_card_number = parts[1].strip()
                if len(parts) > 2 and parts[2].strip():
                    id_card_url = parts[2].strip()
            elif " - " in raw_id:
                parts = raw_id.split(" - ")
                id_card_type = parts[0].strip()
                id_card_number = parts[1].strip()
            else:
                id_card_type = "ID Document"
                id_card_number = raw_id
        except Exception:
            pass

    return {
        "id": user_id,
        "uid": user_id,
        "displayName": data.get("display_name") or data.get("displayName") or "",
        "role": data.get("role") or "CITIZEN",
        "requestedRole": (data.get("requested_role") if "requested_role" in data else data.get("requestedRole")) if can_view_sensitive else None,
        "idCardType": id_card_type if can_view_sensitive else None,
        "idCardNumber": id_card_number if can_view_sensitive else None,
        "idCardUrl": id_card_url if can_view_sensitive else None,
        "avatarUrl": data.get("avatar_url") or data.get("avatarUrl") or "",
        "createdAt": data.get("created_at") or data.get("createdAt"),
        "email": (data.get("email") or "") if can_view_contact else "",
        "phoneNumber": (data.get("phone") or data.get("phoneNumber") or "") if can_view_contact else "",
        "address": (data.get("address") or "") if can_view_contact else "",
        "bio": data.get("bio") or "",
        "latitude": lat,
        "longitude": lon,
        "serviceRadiusKm": service_radius,
        "alertsEnabled": alerts_enabled,
    }

@router.get("", response_model=List[UserResponse])
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
        query = supabase.table("users").select("*")
        if role:
            query = query.eq("role", role.upper())
        if search:
            query = query.ilike("display_name", f"%{search}%")
            
        res = query.order("created_at", desc=True).range(offset, offset + limit - 1).execute()
        is_admin = current_user.get("role") == "ADMIN"
        
        users_data = res.data or []
        if is_admin:
            try:
                auth_users = supabase.auth.admin.list_users()
                auth_metadata_map = {au.id: au.user_metadata for au in auth_users if au.user_metadata}
                for d in users_data:
                    meta = auth_metadata_map.get(d.get("id") or d.get("uid"), {})
                    if meta:
                        if not d.get("requested_role") and meta.get("requested_role"):
                            d["requested_role"] = meta.get("requested_role")
                        if meta.get("id_card_type"):
                            d["id_card_type"] = meta.get("id_card_type")
                        if meta.get("id_card_number"):
                            d["id_card_number"] = meta.get("id_card_number")
                        if meta.get("id_card_url"):
                            d["id_card_url"] = meta.get("id_card_url")
            except Exception as meta_err:
                logger.warning(f"Failed to load auth metadata: {meta_err}")

        if has_requested_role:
            users_data = [
                d for d in users_data
                if (d.get("requested_role") or d.get("requestedRole"))
            ]
        
        return [
            map_user(d, can_view_contact=is_admin, can_view_sensitive=is_admin)
            for d in users_data
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

@router.get("/{uid}", response_model=UserResponse)
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
        
        return map_user(data, can_view_contact=can_view_contact, can_view_sensitive=(is_self or is_admin))
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error fetching user profile {uid}: {e}")
        raise HTTPException(status_code=500, detail="Failed to retrieve user profile")

@router.post("", response_model=UserResponse)
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
            if profile.idCardType or profile.idCardNumber:
                id_card_tag = f"[ID: {profile.idCardType or 'Document'} | {profile.idCardNumber or ''} | {profile.idCardUrl or ''}]"
                data["bio"] = f"{id_card_tag} {data.get('bio', '')}".strip()
            notify_admins_of_role_request(
                user_id=profile.uid,
                user_name=profile.displayName,
                user_email=verified_email,
                req_role=req_role,
                id_card_type=profile.idCardType,
                id_card_number=profile.idCardNumber
            )
        
        res = supabase.table("users").upsert(data).execute()
        if not res.data:
            raise HTTPException(status_code=500, detail="Failed to create user profile")
            
        row_data = {**data, **(res.data[0] if res.data else {})}
        return map_user(row_data, can_view_contact=True, can_view_sensitive=True)
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error creating user profile: {e}")
        raise HTTPException(status_code=500, detail="Failed to create user profile")

@router.patch("/{uid}", response_model=UserResponse)
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
    if profile.idCardType or profile.idCardNumber:
        clean_bio = profile.bio if profile.bio is not None else ""
        if "[ID:" in clean_bio:
            clean_bio = clean_bio.split("]", 1)[1].strip()
        id_tag = f"[ID: {profile.idCardType or 'Document'} | {profile.idCardNumber or ''} | {profile.idCardUrl or ''}]"
        update_data["bio"] = f"{id_tag} {clean_bio}".strip()
    if profile.requestedRole is not None:
        raw_req = profile.requestedRole.strip().upper() if profile.requestedRole.strip() else None
        if raw_req == "ADMIN" or (raw_req and raw_req not in ALLOWED_REQUESTED_ROLES):
            raise HTTPException(status_code=400, detail="Cannot request ADMIN or invalid role")
        update_data["requested_role"] = raw_req
        if raw_req:
            try:
                user_info = supabase.table("users").select("display_name, email").eq("id", uid).execute()
                u_name = user_info.data[0].get("display_name", "Operator") if user_info.data else "Operator"
                u_email = user_info.data[0].get("email", "") if user_info.data else ""
                notify_admins_of_role_request(
                    user_id=uid,
                    user_name=u_name,
                    user_email=u_email,
                    req_role=raw_req,
                    id_card_type=profile.idCardType,
                    id_card_number=profile.idCardNumber
                )
            except Exception as e:
                logger.warning(f"Failed to dispatch admin notification: {e}")
    if profile.latitude is not None:
        if not (-90.0 <= profile.latitude <= 90.0):
            raise HTTPException(status_code=422, detail="Latitude must be between -90 and 90")
        update_data["latitude"] = profile.latitude
    if profile.longitude is not None:
        if not (-180.0 <= profile.longitude <= 180.0):
            raise HTTPException(status_code=422, detail="Longitude must be between -180 and 180")
        update_data["longitude"] = profile.longitude
    if profile.serviceRadiusKm is not None:
        if not (1 <= profile.serviceRadiusKm <= 200):
            raise HTTPException(status_code=422, detail="Service radius must be between 1 and 200 km")
        update_data["service_radius_km"] = profile.serviceRadiusKm
    if profile.alertsEnabled is not None:
        update_data["alerts_enabled"] = profile.alertsEnabled
    
    try:
        if not update_data:
            res = supabase.table("users").select("*").eq("id", uid).execute()
            if not res.data:
                raise HTTPException(status_code=404, detail="User not found")
            return map_user(res.data[0], can_view_contact=True, can_view_sensitive=True)
            
        res = supabase.table("users").update(update_data).eq("id", uid).execute()
        if not res.data:
            raise HTTPException(status_code=404, detail="User not found")
        
        row_data = {**(res.data[0] if res.data else {}), **update_data}
        return map_user(row_data, can_view_contact=True, can_view_sensitive=True)
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error updating user profile {uid}: {e}")
        raise HTTPException(status_code=500, detail="Failed to update user profile")

class RoleClearanceRequest(BaseModel):
    requestedRole: str
    idCardType: Optional[str] = "Government Photo ID"
    idCardNumber: str
    idCardUrl: Optional[str] = None
    notes: Optional[str] = None

@router.post("/request-clearance", response_model=UserResponse)
def submit_role_clearance_request(req: RoleClearanceRequest, current_user: dict = Depends(get_current_user)):
    """Allows authenticated operators to submit clearance verification with identification details."""
    target_role = req.requestedRole.strip().upper()
    if target_role == "ADMIN" or target_role not in ALLOWED_REQUESTED_ROLES:
        raise HTTPException(status_code=400, detail="Cannot request ADMIN or invalid role")
    
    uid = current_user["uid"]
    id_tag = f"[ID: {req.idCardType or 'Document'} | {req.idCardNumber} | {req.idCardUrl or ''}]"
    
    existing = supabase.table("users").select("bio, display_name, email").eq("id", uid).execute()
    curr_bio = existing.data[0].get("bio", "") if existing.data else ""
    if "[ID:" in curr_bio:
        curr_bio = curr_bio.split("]", 1)[1].strip()
    
    new_bio = f"{id_tag} {curr_bio}".strip()
    update_data = {
        "requested_role": target_role,
        "bio": new_bio
    }
    
    res = supabase.table("users").update(update_data).eq("id", uid).execute()
    if not res.data:
        raise HTTPException(status_code=404, detail="User not found")
        
    u_name = current_user.get("name") or current_user.get("displayName") or (existing.data[0].get("display_name") if existing.data else "Operator")
    u_email = current_user.get("email") or (existing.data[0].get("email") if existing.data else "")
    
    notify_admins_of_role_request(
        user_id=uid,
        user_name=u_name,
        user_email=u_email,
        req_role=target_role,
        id_card_type=req.idCardType,
        id_card_number=req.idCardNumber
    )
    
    return map_user(res.data[0], can_view_contact=True, can_view_sensitive=True)

@router.patch("/{uid}/role", response_model=UserResponse)
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
        # Fetch current role and requested role for audit log and user notification
        current_rec = supabase.table("users").select("role, display_name, requested_role").eq("id", uid).execute()
        if not current_rec.data:
            raise HTTPException(status_code=404, detail="User not found")
            
        user_row = current_rec.data[0]
        prev_role = user_row.get("role", "UNKNOWN")
        prev_requested = user_row.get("requested_role")

        updated_row = None
        # Primary transactional path: atomic update + audit log via PostgreSQL RPC
        try:
            rpc_res = supabase.rpc("admin_update_user_role", {
                "p_user_id": uid,
                "p_new_role": target_role,
                "p_admin_id": current_user["uid"],
            }).execute()
            if rpc_res and rpc_res.data:
                updated_row = rpc_res.data
        except HTTPException:
            raise
        except Exception as rpc_err:
            err_msg = str(rpc_err)
            if "USER_NOT_FOUND" in err_msg:
                raise HTTPException(status_code=404, detail="User not found")
            # Only allow test fallback if running under test suite AND function is explicitly not found
            is_missing_fn = (
                is_test_environment()
                and (
                    "42883" in err_msg
                    or "PGRST202" in err_msg
                    or "could not find the function" in err_msg.lower()
                    or ("admin_update_user_role" in err_msg.lower() and "does not exist" in err_msg.lower())
                )
            )
            if not is_missing_fn:
                logger.error(f"SECURITY CRITICAL: Transactional RPC admin_update_user_role failed: {rpc_err}")
                raise HTTPException(
                    status_code=500,
                    detail="Security audit logging failed for ROLE_CHANGE. Action was aborted to ensure an append-only audit trail."
                )
            logger.warning(
                f"RPC admin_update_user_role not installed ({rpc_err}); using test fallback with compensating rollback"
            )

        if updated_row is None:
            # Direct table update with fail-closed compensating rollback
            res = supabase.table("users").update({
                "role": target_role,
                "requested_role": None
            }).eq("id", uid).execute()
            
            if not res.data:
                raise HTTPException(status_code=404, detail="User not found")

            try:
                # Audit role change in database audit_logs (performed_by records real admin)
                log_audit_event(
                    action="ROLE_CHANGE",
                    entity_type="USER",
                    entity_id=uid,
                    performed_by=current_user["uid"],
                    old_value={"role": prev_role},
                    new_value={"role": target_role},
                    fail_closed=True,
                )
            except Exception:
                # Compensating rollback: revert mutation immediately so no unauthorized privilege persists
                try:
                    supabase.table("users").update({
                        "role": prev_role,
                        "requested_role": prev_requested
                    }).eq("id", uid).execute()
                    logger.info(f"Compensating rollback: reverted role mutation for user {uid} to {prev_role}")
                except Exception as revert_err:
                    logger.error(f"CRITICAL: Failed to revert user {uid} role after audit failure: {revert_err}")
                raise

            updated_row = {**(res.data[0] if res.data else {}), "role": target_role, "requested_role": None}

        # Send notification to user regarding clearance decision
        if prev_requested and target_role == prev_requested:
            create_system_notification(
                user_id=uid,
                notif_type="ROLE_UPDATE",
                title=f"Clearance Approved: {target_role}",
                message=f"Congratulations! Your request for {target_role} clearance has been approved.",
                related_entity_id=uid,
                related_entity_type="USER",
            )
        elif prev_requested and target_role != prev_requested:
            create_system_notification(
                user_id=uid,
                notif_type="ROLE_UPDATE",
                title="Clearance Request Reviewed",
                message=f"Your request for {prev_requested} clearance was reviewed. Your role has been set to {target_role}.",
                related_entity_id=uid,
                related_entity_type="USER",
            )
        else:
            create_system_notification(
                user_id=uid,
                notif_type="ROLE_UPDATE",
                title=f"Role Updated to {target_role}",
                message=f"An administrator updated your account role to {target_role}.",
                related_entity_id=uid,
                related_entity_type="USER",
            )

        logger.info(
            f"AUDIT: Role changed for user {uid} from '{prev_role}' to '{target_role}' by admin '{current_user['uid']}'"
        )
            
        row_data = {**updated_row, "role": target_role, "requested_role": None}
        return map_user(row_data, can_view_contact=True, can_view_sensitive=True)
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error updating role for user {uid}: {e}")
        raise HTTPException(status_code=500, detail="Failed to update user role")

@router.post("/{uid}/role-request/decline", response_model=UserResponse)
def decline_role_request(uid: str, current_user: dict = Depends(get_current_user)):
    if current_user.get("role") != "ADMIN":
        raise HTTPException(status_code=403, detail="Forbidden: Only administrators can decline role requests")
        
    try:
        current_rec = supabase.table("users").select("role, display_name, requested_role").eq("id", uid).execute()
        if not current_rec.data:
            raise HTTPException(status_code=404, detail="User not found")
            
        user_row = current_rec.data[0]
        current_role = user_row.get("role", "CITIZEN")
        requested_role = user_row.get("requested_role")
        
        if not requested_role:
            raise HTTPException(status_code=400, detail="User has no pending role request to decline")

        updated_row = None
        # Primary transactional path: atomic update + audit log via PostgreSQL RPC
        try:
            rpc_res = supabase.rpc("admin_decline_role_request", {
                "p_user_id": uid,
                "p_admin_id": current_user["uid"],
            }).execute()
            if rpc_res and rpc_res.data:
                updated_row = rpc_res.data
        except HTTPException:
            raise
        except Exception as rpc_err:
            err_msg = str(rpc_err)
            if "USER_NOT_FOUND" in err_msg:
                raise HTTPException(status_code=404, detail="User not found")
            if "NO_PENDING_REQUEST" in err_msg:
                raise HTTPException(status_code=400, detail="User has no pending role request to decline")
            # Only allow test fallback if running under test suite AND function is explicitly not found
            is_missing_fn = (
                is_test_environment()
                and (
                    "42883" in err_msg
                    or "PGRST202" in err_msg
                    or "could not find the function" in err_msg.lower()
                    or ("admin_decline_role_request" in err_msg.lower() and "does not exist" in err_msg.lower())
                )
            )
            if not is_missing_fn:
                logger.error(f"SECURITY CRITICAL: Transactional RPC admin_decline_role_request failed: {rpc_err}")
                raise HTTPException(
                    status_code=500,
                    detail="Security audit logging failed for ROLE_REQUEST_DECLINED. Action was aborted to ensure an append-only audit trail."
                )
            logger.warning(
                f"RPC admin_decline_role_request not installed ({rpc_err}); using test fallback with compensating rollback"
            )

        if updated_row is None:
            # Clear requested_role only, leave existing role untouched
            res = supabase.table("users").update({
                "requested_role": None
            }).eq("id", uid).execute()
            
            if not res.data:
                raise HTTPException(status_code=404, detail="User not found")

            try:
                # Audit role request decline
                log_audit_event(
                    action="ROLE_REQUEST_DECLINED",
                    entity_type="USER",
                    entity_id=uid,
                    performed_by=current_user["uid"],
                    old_value={"requested_role": requested_role, "role": current_role},
                    new_value={"requested_role": None, "role": current_role},
                    fail_closed=True,
                )
            except Exception:
                # Compensating rollback: restore requested_role so state remains unmodified
                try:
                    supabase.table("users").update({
                        "requested_role": requested_role
                    }).eq("id", uid).execute()
                    logger.info(f"Compensating rollback: restored requested_role for user {uid} after audit failure")
                except Exception as revert_err:
                    logger.error(f"CRITICAL: Failed to revert user {uid} requested_role after audit failure: {revert_err}")
                raise

            updated_row = {**(res.data[0] if res.data else {}), "requested_role": None}

        # Send notification to user that request was declined and current role is preserved
        create_system_notification(
            user_id=uid,
            notif_type="ROLE_UPDATE",
            title="Clearance Request Declined",
            message=f"Your request for {requested_role} clearance was declined. Your current role ({current_role}) remains unchanged.",
            related_entity_id=uid,
            related_entity_type="USER",
        )

        logger.info(
            f"AUDIT: Role request for {requested_role} by user {uid} declined by admin '{current_user['uid']}'. Role preserved as '{current_role}'."
        )

        row_data = {**updated_row, "requested_role": None}
        return map_user(row_data, can_view_contact=True, can_view_sensitive=True)
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error declining role request for user {uid}: {e}")
        raise HTTPException(status_code=500, detail="Failed to decline role request")

