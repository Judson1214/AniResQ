import os
import re
import logging
from datetime import datetime, timezone
from typing import Optional, List, Literal
from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel, Field
from supabase_config import supabase
from auth import get_current_user, invalidate_user_cache
from validators import validate_avatar_url
from rate_limiter import limiter
from .notifications import create_system_notification
from .audit import log_audit_event

router = APIRouter(prefix="/api/users", tags=["users"])
logger = logging.getLogger("users")

def is_test_environment() -> bool:
    return os.getenv("TESTING", "").lower() in ("true", "1") or "PYTEST_CURRENT_TEST" in os.environ

def validate_id_card_path(path: Optional[str], uid: str) -> Optional[str]:
    """Validates that id_card_url is a scoped private storage path matching ^<uid>/[A-Za-z0-9._-]+$
    Rejects raw URLs, javascript schemes, trailing newlines, traversal paths, or mismatched user directories."""
    if not path:
        return None
    # Reject strings containing newlines/carriage returns before any stripping
    if "\n" in path or "\r" in path:
        raise HTTPException(
            status_code=422,
            detail=f"Invalid ID document storage path. Must match format '{uid}/<filename>' and contain only safe alphanumeric characters without newlines."
        )
    clean_path = path.strip()
    if not clean_path:
        return None
    # Strip optional bucket prefix if user provided it
    if clean_path.startswith("id-verification/"):
        clean_path = clean_path.split("id-verification/", 1)[1].strip()

    pattern = rf"{re.escape(uid)}/[A-Za-z0-9._-]+"
    if not re.fullmatch(pattern, clean_path):
        raise HTTPException(
            status_code=422,
            detail=f"Invalid ID document storage path. Must match format '{uid}/<filename>' and contain only safe alphanumeric characters without newlines."
        )
    return clean_path

VALID_ROLES = {"CITIZEN", "NGO", "VOLUNTEER", "SHELTER", "VET", "ADMIN"}
ALLOWED_REQUESTED_ROLES = {"NGO", "VOLUNTEER", "SHELTER", "VET"}

class UserProfileCreate(BaseModel):
    uid: str
    email: Optional[str] = None
    displayName: str
    role: Optional[str] = "CITIZEN"
    phoneNumber: Optional[str] = None

class UserProfileUpdate(BaseModel):
    displayName: Optional[str] = None
    phoneNumber: Optional[str] = None
    phone: Optional[str] = None
    address: Optional[str] = None
    bio: Optional[str] = None
    avatarUrl: Optional[str] = None
    latitude: Optional[float] = None
    longitude: Optional[float] = None
    serviceRadiusKm: Optional[int] = None
    alertsEnabled: Optional[bool] = None

class UserRoleUpdate(BaseModel):
    role: str

class AccountDeleteRequest(BaseModel):
    confirm: str

class ConsentRequest(BaseModel):
    termsVersion: str = Field(..., min_length=1, max_length=20)

class UserResponse(BaseModel):
    id: str
    uid: str
    displayName: Optional[str] = ""
    role: str = "CITIZEN"
    requestedRole: Optional[str] = None
    idCardType: Optional[str] = None
    idCardNumber: Optional[str] = None # Deprecated - always None
    idCardLast4: Optional[str] = None
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
    termsAcceptedAt: Optional[str] = None
    termsVersion: Optional[str] = None
    isDisabled: Optional[bool] = None

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
        doc_type = id_card_type or "Identity Document"
        for admin in (admins.data or []):
            create_system_notification(
                user_id=admin["id"],
                notif_type="ROLE_REQUEST",
                title=f"New Clearance Request: {req_role}",
                message=f"Operator '{user_name}' ({user_email}) has requested clearance for {req_role}. Verification document ({doc_type}) submitted for review.",
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

    # Parse identification card proof: Minimization enforces only idCardLast4 is stored/returned
    id_card_type = data.get("id_card_type") or data.get("idCardType")
    id_card_last4 = data.get("id_card_last4") or data.get("idCardLast4")
    id_card_url = data.get("id_card_url") or data.get("idCardUrl")

    bio_text = data.get("bio") or ""
    if "[ID:" in bio_text:
        # Never leak ID credentials in bio to any user/client
        bio_text = bio_text.split("]", 1)[1].strip() if "]" in bio_text else ""

    # Generate short-lived signed URL for private ID verification documents (admins/owner only)
    signed_id_url = None
    if can_view_sensitive and id_card_url:
        clean_path = str(id_card_url).strip()
        if "/id-verification/" in clean_path:
            clean_path = clean_path.split("/id-verification/", 1)[1]
        elif clean_path.startswith("id-verification/"):
            clean_path = clean_path.split("id-verification/", 1)[1]
        clean_path = clean_path.split("?")[0].strip()

        # Enforce storage path format: <uid>/[A-Za-z0-9._-]+ using re.fullmatch
        if re.fullmatch(r"[0-9a-fA-F-]{36}/[A-Za-z0-9._-]+", clean_path):
            try:
                signed_res = supabase.storage.from_("id-verification").create_signed_url(clean_path, 3600)
                signed_val = (
                    signed_res.get("signedURL") or signed_res.get("signedUrl")
                ) if isinstance(signed_res, dict) else getattr(signed_res, "signed_url", None)
                if signed_val:
                    if signed_val.startswith("/"):
                        storage_base = os.getenv("SUPABASE_URL", "").rstrip("/")
                        if storage_base:
                            signed_val = f"{storage_base}{signed_val}"
                    if signed_val.startswith("https://") or signed_val.startswith("http://"):
                        signed_id_url = signed_val
            except Exception as sign_err:
                logger.warning(f"Could not generate signed URL for ID card ({clean_path}): {sign_err}")
                signed_id_url = None
        else:
            signed_id_url = None

    return {
        "id": user_id,
        "uid": user_id,
        "displayName": data.get("display_name") or data.get("displayName") or "",
        "role": data.get("role") or "CITIZEN",
        "requestedRole": (data.get("requested_role") if "requested_role" in data else data.get("requestedRole")) if can_view_sensitive else None,
        "idCardType": id_card_type if can_view_sensitive else None,
        "idCardNumber": None,
        "idCardLast4": id_card_last4 if can_view_sensitive else None,
        "idCardUrl": signed_id_url if can_view_sensitive else None,
        "avatarUrl": data.get("avatar_url") or data.get("avatarUrl") or "",
        "createdAt": data.get("created_at") or data.get("createdAt"),
        "email": (data.get("email") or "") if can_view_contact else "",
        "phoneNumber": (data.get("phone") or data.get("phoneNumber") or "") if can_view_contact else "",
        "address": (data.get("address") or "") if can_view_contact else "",
        "bio": bio_text,
        "latitude": lat,
        "longitude": lon,
        "serviceRadiusKm": service_radius,
        "alertsEnabled": alerts_enabled,
        "termsAcceptedAt": data.get("terms_accepted_at") or data.get("termsAcceptedAt"),
        "termsVersion": data.get("terms_version") or data.get("termsVersion"),
        "isDisabled": bool(data.get("is_disabled", False)) if ("is_disabled" in data or "isDisabled" in data) else None,
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
        is_admin = current_user.get("role") == "ADMIN"

        # Explicit column projection: non-admins (NGO, SHELTER) NEVER load ID document fields
        if is_admin:
            selected_columns = (
                "id, display_name, email, phone, role, requested_role, "
                "id_card_type, id_card_last4, id_card_url, avatar_url, created_at, "
                "address, bio, latitude, longitude, service_radius_km, alerts_enabled, "
                "terms_accepted_at, terms_version, is_disabled"
            )
        else:
            selected_columns = (
                "id, display_name, email, phone, role, requested_role, "
                "avatar_url, created_at, address, bio, latitude, longitude, "
                "service_radius_km, alerts_enabled, is_disabled"
            )

        query = supabase.table("users").select(selected_columns)
        if role:
            query = query.eq("role", role.upper())
        if search:
            query = query.ilike("display_name", f"%{search}%")
        if has_requested_role:
            query = query.not_.is_("requested_role", "null")
            
        res = query.order("created_at", desc=True).order("id", desc=True).range(offset, offset + limit - 1).execute()
        users_data = res.data or []
        
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

@router.delete("/me", status_code=204)
def delete_my_account(req: AccountDeleteRequest, current_user: dict = Depends(get_current_user)):
    """Self-service account deletion: deletes caller's private objects, purges profile & auth user.
    Refuses if caller is the last active ADMIN.
    """
    uid = current_user["uid"]
    if req.confirm != "DELETE MY ACCOUNT":
        raise HTTPException(
            status_code=422,
            detail="Confirmation phrase must exactly match 'DELETE MY ACCOUNT'"
        )

    # Rate limiting: 3 per hour per user
    user_key = f"user:{uid}"
    allowed, retry_after = limiter.is_allowed(user_key, path="/api/users/me", method="DELETE")
    if not allowed:
        raise HTTPException(
            status_code=429,
            detail=f"Too many account deletion requests. Please retry in {retry_after} seconds."
        )

    # Guard: Refuse (409) if the caller is the last active ADMIN
    if current_user.get("role") == "ADMIN":
        admin_check = (
            supabase.table("users")
            .select("id", count="exact")
            .eq("role", "ADMIN")
            .eq("is_disabled", False)
            .execute()
        )
        active_admins = admin_check.count if admin_check.count is not None else len(admin_check.data or [])
        if active_admins <= 1:
            raise HTTPException(
                status_code=409,
                detail="Cannot delete the last active administrator account"
            )

    # Purge caller's files under their folder in id-verification and uploads buckets
    for bucket in ["id-verification", "uploads"]:
        try:
            obj_list = supabase.storage.from_(bucket).list(uid)
            if obj_list and isinstance(obj_list, list):
                paths = []
                for item in obj_list:
                    name = item.get("name") if isinstance(item, dict) else getattr(item, "name", "")
                    if name:
                        paths.append(f"{uid}/{name}")
                if paths:
                    supabase.storage.from_(bucket).remove(paths)
                    logger.info(f"Purged {len(paths)} objects from '{bucket}' for deleted user {uid}")
        except Exception as st_err:
            logger.warning(f"Could not purge storage objects for {uid} in {bucket}: {st_err}")

    # Delete auth user with service-role admin API (cascades to public.users and triggers PII redaction)
    try:
        supabase.auth.admin.delete_user(uid)
    except Exception as auth_del_err:
        logger.warning(f"auth.admin.delete_user error for {uid}: {auth_del_err}")

    # Explicit public.users delete fallback for local/test environments
    try:
        supabase.table("users").delete().eq("id", uid).execute()
    except Exception as db_del_err:
        logger.warning(f"public.users delete fallback error for {uid}: {db_del_err}")

    # Write audit event ACCOUNT_DELETED containing ONLY the user ID (no email, no phone)
    try:
        log_audit_event(
            action="ACCOUNT_DELETED",
            entity_type="USER",
            entity_id=uid,
            performed_by=uid,
            old_value=None,
            new_value={"user_id": uid},
            fail_closed=False
        )
    except Exception as audit_err:
        logger.warning(f"Failed to record audit log for account deletion: {audit_err}")

    # Clear auth cache for that user
    invalidate_user_cache(uid)
    return None

@router.get("/me/export")
def export_my_data(current_user: dict = Depends(get_current_user)):
    """Data export: returns caller's complete profile and personal activity records.
    Never includes other users' data or raw ID verification storage URLs.
    """
    uid = current_user["uid"]

    # Rate limiting: 3 per hour per user
    user_key = f"user:{uid}"
    allowed, retry_after = limiter.is_allowed(user_key, path="/api/users/me/export", method="GET")
    if not allowed:
        raise HTTPException(
            status_code=429,
            detail=f"Too many export requests. Please retry in {retry_after} seconds."
        )

    # 1. Profile (strictly remove id_card_url and id_card_number)
    user_res = supabase.table("users").select("*").eq("id", uid).execute()
    profile_data = user_res.data[0] if user_res.data else {}
    clean_profile = {
        k: v for k, v in profile_data.items()
        if k not in ("id_card_url", "id_card_number")
    }

    # 2. Rescues (reported or assigned to caller)
    reported_rescues = supabase.table("rescues").select("*").eq("reporter_id", uid).execute().data or []
    assigned_rescues = supabase.table("rescues").select("*").eq("assigned_to", uid).execute().data or []
    rescues_map = {r["id"]: r for r in (reported_rescues + assigned_rescues)}

    # 3. Lost & Found posts
    lf_posts = supabase.table("lost_and_found").select("*").eq("reporter_id", uid).execute().data or []

    # 4. Lost & Found replies
    lf_replies = supabase.table("lost_and_found_replies").select("*").eq("user_id", uid).execute().data or []

    # 5. Adoption applications
    adoptions = supabase.table("adoption_applications").select("*").eq("applicant_id", uid).execute().data or []

    # 6. Notifications
    notifs = supabase.table("notifications").select("*").eq("user_id", uid).execute().data or []

    return {
        "exportDate": datetime.now(timezone.utc).isoformat(),
        "profile": clean_profile,
        "rescues": list(rescues_map.values()),
        "lostAndFoundPosts": lf_posts,
        "lostAndFoundReplies": lf_replies,
        "adoptionApplications": adoptions,
        "notifications": notifs,
    }

@router.post("/me/consent")
def accept_terms_consent(req: ConsentRequest, current_user: dict = Depends(get_current_user)):
    """Records terms of service and privacy consent timestamp and version."""
    uid = current_user["uid"]
    now_iso = datetime.now(timezone.utc).isoformat()
    clean_version = req.termsVersion.strip()[:20]

    res = (
        supabase.table("users")
        .update({
            "terms_accepted_at": now_iso,
            "terms_version": clean_version
        })
        .eq("id", uid)
        .execute()
    )
    if not res.data:
        raise HTTPException(status_code=404, detail="User not found")

    invalidate_user_cache(uid)
    return {
        "termsAcceptedAt": now_iso,
        "termsVersion": clean_version
    }

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
    is_admin = current_user.get("role") == "ADMIN"
    target_uid = profile.uid if is_admin else current_user["uid"]
    if not is_admin and profile.uid != current_user["uid"]:
        raise HTTPException(status_code=403, detail="Cannot create profile for another user")
        
    try:
        # Prevent unauthorized role changes or demoting existing staff members
        existing = supabase.table("users").select("role, email").eq("id", target_uid).execute()
        if existing.data and not is_admin:
            target_role = existing.data[0].get("role", "CITIZEN")
        else:
            target_role = profile.role.upper() if is_admin and profile.role else "CITIZEN"
            
        if target_role not in VALID_ROLES:
            target_role = "CITIZEN"

        # Security: Derive verified email strictly from authenticated JWT token
        verified_email = current_user.get("email")
        if not verified_email and existing.data:
            verified_email = existing.data[0].get("email")
        if not verified_email:
            verified_email = profile.email or ""
            
        data = {
            "id": target_uid,
            "email": verified_email,
            "display_name": profile.displayName,
            "role": target_role,
            "phone": profile.phoneNumber or "",
        }
        
        res = supabase.table("users").upsert(data).execute()
        if not res.data:
            raise HTTPException(status_code=500, detail="Failed to create user profile")
            
        return map_user(res.data[0], can_view_contact=True, can_view_sensitive=True)
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
        clean_bio = profile.bio
        if "[ID:" in clean_bio:
            clean_bio = clean_bio.split("]", 1)[1].strip() if "]" in clean_bio else ""
        update_data["bio"] = clean_bio
    if profile.avatarUrl is not None: 
        caller_id = current_user["uid"] if current_user.get("role") != "ADMIN" else None
        update_data["avatar_url"] = validate_avatar_url(profile.avatarUrl, caller_uid=caller_id)
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

IdCardTypeLiteral = Literal[
    "Government Photo ID",
    "Aadhaar Card",
    "Passport",
    "Driver License",
    "Voter ID",
    "NGO Registration Certificate",
    "Animal Shelter License",
    "Veterinary Medical Council ID",
]

class RoleClearanceRequest(BaseModel):
    requestedRole: str
    idCardType: IdCardTypeLiteral = Field(
        default="Government Photo ID",
        description="Verified identification document type"
    )
    idCardNumber: str = Field(
        ...,
        min_length=1,
        max_length=64,
        description="Official ID or registration certificate number"
    )
    idCardUrl: Optional[str] = Field(
        default=None,
        max_length=255,
        description="Relative storage path in id-verification bucket"
    )

@router.post("/request-clearance", response_model=UserResponse)
def submit_role_clearance_request(req: RoleClearanceRequest, current_user: dict = Depends(get_current_user)):
    """Allows authenticated operators to submit clearance verification with identification details."""
    target_role = req.requestedRole.strip().upper()
    if target_role == "ADMIN" or target_role not in ALLOWED_REQUESTED_ROLES:
        raise HTTPException(status_code=400, detail="Cannot request ADMIN or invalid role")
    
    uid = current_user["uid"]
    
    # User-keyed rate limiting: 10 clearance requests per minute per user ID
    user_key = f"user:{uid}"
    allowed, retry_after = limiter.is_allowed(user_key, path="/api/users/request-clearance", method="POST")
    if not allowed:
        raise HTTPException(
            status_code=429,
            detail=f"Too many clearance requests. Please retry in {retry_after} seconds."
        )

    # Guard 1: Existing ADMIN users cannot request lower clearance
    if current_user.get("role") == "ADMIN":
        raise HTTPException(status_code=400, detail="Administrators already hold maximum clearance")
    
    existing = supabase.table("users").select("bio, display_name, email, role, requested_role").eq("id", uid).execute()
    if not existing.data:
        raise HTTPException(status_code=404, detail="User not found")
        
    user_row = existing.data[0]
    curr_role = user_row.get("role")
    pending_role = user_row.get("requested_role")

    # Guard 2: Reject pointless requests if user already holds the target role
    if curr_role == target_role:
        raise HTTPException(status_code=409, detail=f"User already holds the '{target_role}' role")

    # Guard 3: Reject repeat requests if a request is already pending review
    if pending_role:
        raise HTTPException(status_code=409, detail=f"A clearance request for '{pending_role}' is already pending administrator review")

    clean_id_number = req.idCardNumber.strip()
    if not clean_id_number:
        raise HTTPException(status_code=422, detail="ID card number cannot be blank")

    # ID Minimization: extract strictly the last 4 characters; never store or log full number
    id_card_last4 = clean_id_number[-4:] if clean_id_number else ""

    curr_bio = user_row.get("bio", "") or ""
    clean_bio = curr_bio.split("]", 1)[1].strip() if "[ID:" in curr_bio and "]" in curr_bio else curr_bio
    
    update_data = {
        "requested_role": target_role,
        "id_card_type": req.idCardType,
        "id_card_last4": id_card_last4,
        "bio": clean_bio
    }
    if req.idCardUrl is not None:
        update_data["id_card_url"] = validate_id_card_path(req.idCardUrl, uid) if req.idCardUrl.strip() else None
    
    # Atomic conditional update: update ONLY if requested_role is NULL to prevent concurrent duplicate requests
    res = (
        supabase.table("users")
        .update(update_data)
        .eq("id", uid)
        .is_("requested_role", "null")
        .execute()
    )
    if not res.data:
        # Either user not found or requested_role was concurrently set by a simultaneous request
        existing_chk = supabase.table("users").select("id, requested_role").eq("id", uid).execute()
        if not existing_chk.data:
            raise HTTPException(status_code=404, detail="User not found")
        raise HTTPException(
            status_code=409,
            detail="A clearance request is already pending administrator review"
        )
        
    u_name = current_user.get("name") or current_user.get("displayName") or user_row.get("display_name") or "Operator"
    u_email = current_user.get("email") or user_row.get("email") or ""
    
    notify_admins_of_role_request(
        user_id=uid,
        user_name=u_name,
        user_email=u_email,
        req_role=target_role,
        id_card_type=req.idCardType
    )

    # Log audit event for clearance request submission (strictly minimizes PII)
    try:
        log_audit_event(
            action="CLEARANCE_REQUESTED",
            entity_type="USER",
            entity_id=uid,
            performed_by=uid,
            old_value={"requested_role": None},
            new_value={"requested_role": target_role, "id_card_type": req.idCardType, "id_card_last4": id_card_last4},
            fail_closed=False
        )
    except Exception as audit_err:
        logger.warning(f"Failed to record audit log for clearance request: {audit_err}")
    
    # Evict cached profile to ensure role updates and clearance states reflect immediately
    invalidate_user_cache(uid)

    invalidate_user_cache(uid)
    row_data = {**(res.data[0] if (res.data and isinstance(res.data[0], dict)) else {}), **update_data}
    return map_user(row_data, can_view_contact=True, can_view_sensitive=True)

@router.delete("/request-clearance", response_model=UserResponse)
def withdraw_role_clearance_request(current_user: dict = Depends(get_current_user)):
    """Allows an operator to withdraw their pending clearance verification request,
    resetting requested_role and clearing unverified ID credentials so they can re-submit if needed."""
    uid = current_user["uid"]

    # Rate limiting: 10 withdrawal requests per minute per user ID
    user_key = f"user:{uid}"
    allowed, retry_after = limiter.is_allowed(user_key, path="/api/users/request-clearance", method="DELETE")
    if not allowed:
        raise HTTPException(
            status_code=429,
            detail=f"Too many withdrawal requests. Please retry in {retry_after} seconds."
        )

    existing = supabase.table("users").select("role, requested_role, id_card_url").eq("id", uid).execute()
    if not existing.data:
        raise HTTPException(status_code=404, detail="User not found")

    user_row = existing.data[0]
    if not user_row.get("requested_role"):
        raise HTTPException(status_code=400, detail="No pending clearance request to withdraw")

    update_data = {
        "requested_role": None,
        "id_card_type": None,
        "id_card_number": None,
        "id_card_last4": None,
        "id_card_url": None,
    }

    # Conditional update: update ONLY if requested_role is NOT null to avoid overwriting approved roles in a race
    res = (
        supabase.table("users")
        .update(update_data)
        .eq("id", uid)
        .not_.is_("requested_role", "null")
        .execute()
    )
    if not res.data:
        existing_chk = supabase.table("users").select("id, requested_role").eq("id", uid).execute()
        if not existing_chk.data:
            raise HTTPException(status_code=404, detail="User not found")
        raise HTTPException(
            status_code=409,
            detail="Clearance request was already processed or withdrawn"
        )

    # Clean up uploaded verification document from private storage bucket
    doc_url = user_row.get("id_card_url")
    storage_cleaned = None
    if doc_url:
        storage_cleaned = False
        clean_path = str(doc_url).strip()
        if "/id-verification/" in clean_path:
            clean_path = clean_path.split("/id-verification/", 1)[1]
        elif clean_path.startswith("id-verification/"):
            clean_path = clean_path.split("id-verification/", 1)[1]
        clean_path = clean_path.split("?")[0].strip()
        if clean_path:
            try:
                supabase.storage.from_("id-verification").remove([clean_path])
                storage_cleaned = True
                logger.info(f"Removed ID document '{clean_path}' for user {uid} upon clearance withdrawal")
            except Exception as storage_err:
                storage_cleaned = False
                logger.warning(f"Could not remove ID document {clean_path} from storage on clearance withdrawal: {storage_err}")

    # Remove stale ROLE_REQUEST notifications from admin feeds
    notif_cleaned = True
    try:
        supabase.table("notifications").delete().eq("related_entity_id", uid).eq("type", "ROLE_REQUEST").execute()
    except Exception as notif_err:
        notif_cleaned = False
        logger.warning(f"Failed to clear ROLE_REQUEST notifications for user {uid}: {notif_err}")

    # Log audit event for clearance withdrawal
    try:
        log_audit_event(
            action="CLEARANCE_WITHDRAWN",
            entity_type="USER",
            entity_id=uid,
            performed_by=uid,
            old_value={"requested_role": user_row.get("requested_role")},
            new_value={
                "requested_role": None,
                "storage_cleaned": storage_cleaned,
                "notifications_cleaned": notif_cleaned
            },
            fail_closed=False
        )
    except Exception as audit_err:
        logger.warning(f"Failed to record audit log for clearance withdrawal: {audit_err}")

    # Evict cached profile to ensure role updates and clearance states reflect immediately
    invalidate_user_cache(uid)

    invalidate_user_cache(uid)
    row_data = {**(res.data[0] if (res.data and isinstance(res.data[0], dict)) else {}), **update_data}
    return map_user(row_data, can_view_contact=True, can_view_sensitive=True)

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
        current_rec = supabase.table("users").select("id, role, requested_role, id_card_url").eq("id", uid).execute()
        if not current_rec.data:
            raise HTTPException(status_code=404, detail="User not found")
            
        user_row = current_rec.data[0]
        prev_role = user_row.get("role", "UNKNOWN")
        prev_requested = user_row.get("requested_role")

        # ID Minimization: purge uploaded verification document upon clearance decision
        doc_deleted = False
        prev_doc_url = user_row.get("id_card_url")
        if prev_doc_url:
            clean_path = str(prev_doc_url).strip()
            if "/id-verification/" in clean_path:
                clean_path = clean_path.split("/id-verification/", 1)[1]
            elif clean_path.startswith("id-verification/"):
                clean_path = clean_path.split("id-verification/", 1)[1]
            clean_path = clean_path.split("?")[0].strip()
            if clean_path:
                try:
                    supabase.storage.from_("id-verification").remove([clean_path])
                    doc_deleted = True
                    logger.info(f"Purged ID document '{clean_path}' for user {uid} upon role clearance decision")
                except Exception as st_err:
                    logger.warning(f"Could not purge ID document {clean_path} on role update: {st_err}")
            try:
                supabase.table("users").update({"id_card_url": None}).eq("id", uid).execute()
            except Exception as db_err:
                logger.warning(f"Could not reset id_card_url for user {uid}: {db_err}")

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
            is_missing_fn = (
                "42883" in err_msg
                or "PGRST202" in err_msg
                or "could not find the function" in err_msg.lower()
                or ("admin_update_user_role" in err_msg.lower() and "does not exist" in err_msg.lower())
            )
            if not (is_test_environment() and is_missing_fn):
                logger.error(f"SECURITY CRITICAL: Transactional RPC admin_update_user_role failed: {rpc_err}")
                raise HTTPException(
                    status_code=500,
                    detail="Security audit logging failed for ROLE_CHANGE. Action was aborted to ensure an append-only audit trail."
                )
            logger.warning(
                f"RPC admin_update_user_role not installed ({rpc_err}); using direct update fallback with compensating rollback"
            )

        if updated_row is None:
            # Direct table update with fail-closed compensating rollback
            try:
                res = supabase.table("users").update({
                    "role": target_role,
                    "requested_role": None
                }).eq("id", uid).execute()
            except Exception as upd_err:
                if "requested_role" in str(upd_err).lower() or "42703" in str(upd_err):
                    res = supabase.table("users").update({
                        "role": target_role
                    }).eq("id", uid).execute()
                else:
                    raise
            
            if not res.data:
                raise HTTPException(status_code=404, detail="User not found")

            try:
                # Audit role change in database audit_logs (performed_by records real admin)
                audit_new_val = {"role": target_role}
                if doc_deleted:
                    audit_new_val["document_deleted"] = True
                log_audit_event(
                    action="ROLE_CHANGE",
                    entity_type="USER",
                    entity_id=uid,
                    performed_by=current_user["uid"],
                    old_value={"role": prev_role},
                    new_value=audit_new_val,
                    fail_closed=True,
                )
            except Exception:
                # Compensating rollback: revert mutation immediately so no unauthorized privilege persists
                try:
                    try:
                        supabase.table("users").update({
                            "role": prev_role,
                            "requested_role": prev_requested
                        }).eq("id", uid).execute()
                    except Exception as revert_upd_err:
                        if "requested_role" in str(revert_upd_err).lower() or "42703" in str(revert_upd_err):
                            supabase.table("users").update({
                                "role": prev_role
                            }).eq("id", uid).execute()
                        else:
                            raise
                    try:
                        supabase.auth.admin.update_user_by_id(uid, {
                            "user_metadata": {
                                "role": prev_role,
                                "requested_role": prev_requested
                            }
                        })
                    except Exception:
                        pass
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
        invalidate_user_cache(uid)
            
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
        current_rec = supabase.table("users").select("id, role, requested_role, id_card_url").eq("id", uid).execute()
        if not current_rec.data:
            raise HTTPException(status_code=404, detail="User not found")
            
        user_row = current_rec.data[0]
        current_role = user_row.get("role", "CITIZEN")
        requested_role = user_row.get("requested_role")

        if not requested_role:
            raise HTTPException(status_code=400, detail="User has no pending role request to decline")

        # ID Minimization: purge uploaded verification document upon clearance decline
        doc_deleted = False
        prev_doc_url = user_row.get("id_card_url")
        if prev_doc_url:
            clean_path = str(prev_doc_url).strip()
            if "/id-verification/" in clean_path:
                clean_path = clean_path.split("/id-verification/", 1)[1]
            elif clean_path.startswith("id-verification/"):
                clean_path = clean_path.split("id-verification/", 1)[1]
            clean_path = clean_path.split("?")[0].strip()
            if clean_path:
                try:
                    supabase.storage.from_("id-verification").remove([clean_path])
                    doc_deleted = True
                    logger.info(f"Purged ID document '{clean_path}' for user {uid} upon clearance decline")
                except Exception as st_err:
                    logger.warning(f"Could not purge ID document {clean_path} on clearance decline: {st_err}")
            try:
                supabase.table("users").update({"id_card_url": None}).eq("id", uid).execute()
            except Exception as db_err:
                logger.warning(f"Could not reset id_card_url for user {uid}: {db_err}")

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
            is_missing_fn = (
                "42883" in err_msg
                or "PGRST202" in err_msg
                or "could not find the function" in err_msg.lower()
                or ("admin_decline_role_request" in err_msg.lower() and "does not exist" in err_msg.lower())
            )
            if not (is_test_environment() and is_missing_fn):
                logger.error(f"SECURITY CRITICAL: Transactional RPC admin_decline_role_request failed: {rpc_err}")
                raise HTTPException(
                    status_code=500,
                    detail="Security audit logging failed for ROLE_REQUEST_DECLINED. Action was aborted to ensure an append-only audit trail."
                )
            logger.warning(
                f"RPC admin_decline_role_request not installed ({rpc_err}); using direct update fallback with compensating rollback"
            )

        if updated_row is None:
            # Clear requested_role only, leave existing role untouched
            try:
                res = supabase.table("users").update({
                    "requested_role": None
                }).eq("id", uid).execute()
            except Exception as upd_err:
                if "requested_role" in str(upd_err).lower() or "42703" in str(upd_err):
                    res = supabase.table("users").select("*").eq("id", uid).execute()
                else:
                    raise
            
            if not res.data:
                raise HTTPException(status_code=404, detail="User not found")

            try:
                # Audit role request decline
                audit_new_val = {"requested_role": None, "role": current_role}
                if doc_deleted:
                    audit_new_val["document_deleted"] = True
                log_audit_event(
                    action="ROLE_REQUEST_DECLINED",
                    entity_type="USER",
                    entity_id=uid,
                    performed_by=current_user["uid"],
                    old_value={"requested_role": requested_role, "role": current_role},
                    new_value=audit_new_val,
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
        invalidate_user_cache(uid)

        row_data = {**updated_row, "requested_role": None}
        return map_user(row_data, can_view_contact=True, can_view_sensitive=True)
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error declining role request for user {uid}: {e}")
        raise HTTPException(status_code=500, detail="Failed to decline role request")

@router.post("/{uid}/disable")
def disable_user(uid: str, current_user: dict = Depends(get_current_user)):
    """Admin-only: Disables user account, clears auth cache, and blocks user session in Supabase Auth."""
    if current_user.get("role") != "ADMIN":
        raise HTTPException(status_code=403, detail="Forbidden: Only administrators can disable user accounts")
    if current_user["uid"] == uid:
        raise HTTPException(status_code=400, detail="Cannot disable your own administrator account")

    target_res = supabase.table("users").select("id, role, is_disabled").eq("id", uid).execute()
    if not target_res.data:
        raise HTTPException(status_code=404, detail="User not found")
    target_user = target_res.data[0]

    if target_user.get("role") == "ADMIN":
        admin_check = supabase.table("users").select("id", count="exact").eq("role", "ADMIN").eq("is_disabled", False).execute()
        active_admins = admin_check.count if admin_check.count is not None else len(admin_check.data or [])
        if active_admins <= 1:
            raise HTTPException(status_code=409, detail="Cannot disable the last active administrator")

    supabase.table("users").update({"is_disabled": True}).eq("id", uid).execute()

    # Block Supabase auth user so existing refresh tokens stop working
    try:
        supabase.auth.admin.update_user_by_id(uid, {"ban_duration": "876000h"})
    except Exception as ban_err:
        logger.warning(f"Could not set ban_duration in Supabase Auth for {uid}: {ban_err}")

    invalidate_user_cache(uid)

    try:
        log_audit_event(
            action="USER_DISABLED",
            entity_type="USER",
            entity_id=uid,
            performed_by=current_user["uid"],
            old_value={"is_disabled": False},
            new_value={"is_disabled": True},
            fail_closed=False
        )
    except Exception as audit_err:
        logger.warning(f"Failed to record audit log for USER_DISABLED: {audit_err}")

    return {"id": uid, "isDisabled": True, "message": "Account disabled successfully"}

@router.post("/{uid}/enable")
def enable_user(uid: str, current_user: dict = Depends(get_current_user)):
    """Admin-only: Re-enables a disabled user account, restores auth privileges, and clears cache."""
    if current_user.get("role") != "ADMIN":
        raise HTTPException(status_code=403, detail="Forbidden: Only administrators can enable user accounts")

    target_res = supabase.table("users").select("id, role, is_disabled").eq("id", uid).execute()
    if not target_res.data:
        raise HTTPException(status_code=404, detail="User not found")

    supabase.table("users").update({"is_disabled": False}).eq("id", uid).execute()

    # Unblock Supabase auth user
    try:
        supabase.auth.admin.update_user_by_id(uid, {"ban_duration": "none"})
    except Exception as ban_err:
        logger.warning(f"Could not reset ban_duration in Supabase Auth for {uid}: {ban_err}")

    invalidate_user_cache(uid)

    try:
        log_audit_event(
            action="USER_ENABLED",
            entity_type="USER",
            entity_id=uid,
            performed_by=current_user["uid"],
            old_value={"is_disabled": True},
            new_value={"is_disabled": False},
            fail_closed=False
        )
    except Exception as audit_err:
        logger.warning(f"Failed to record audit log for USER_ENABLED: {audit_err}")

    return {"id": uid, "isDisabled": False, "message": "Account enabled successfully"}

