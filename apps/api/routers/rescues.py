import logging
from datetime import datetime, timezone
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, Query, status, BackgroundTasks
from pydantic import BaseModel, Field

from supabase_config import supabase
from auth import get_current_user
from validators import validate_photo_urls
from .notifications import create_system_notification, create_bulk_system_notifications

router = APIRouter(prefix="/api/rescues", tags=["rescues"])
logger = logging.getLogger("rescues")

STAFF_ROLES = {"ADMIN", "NGO", "VOLUNTEER", "SHELTER", "VET"}
VALID_STATUSES = {"PENDING", "DISPATCHED", "IN_PROGRESS", "RESOLVED", "CANCELLED"}
VALID_SEVERITIES = {"CRITICAL", "HIGH", "MEDIUM", "LOW"}

class Location(BaseModel):
    latitude: float = Field(..., ge=-90.0, le=90.0, description="Latitude must be between -90 and 90")
    longitude: float = Field(..., ge=-180.0, le=180.0, description="Longitude must be between -180 and 180")

class RescueRequestCreate(BaseModel):
    title: str
    description: str
    severity: str
    species: str
    location: Location
    address: str
    photoUrls: List[str] = []

class RescueRequestStatusUpdate(BaseModel):
    status: str
    message: Optional[str] = None
    # updatedBy and updatedByName are deprecated/ignored for security; derived from token

class AssignVolunteerRequest(BaseModel):
    volunteerId: str
    volunteerName: str

class RescueResponse(BaseModel):
    id: str
    title: str
    description: str
    species: str
    severity: str
    status: str
    reporterId: str
    assignedTo: Optional[str] = None
    location: Location
    address: str
    photoUrls: List[str] = []
    createdAt: str
    updatedAt: str

class PublicRescueResponse(BaseModel):
    id: str
    title: str
    species: str
    severity: str
    status: str
    location: Optional[Location] = None
    createdAt: str

class TimelineEventResponse(BaseModel):
    id: str
    status: str
    message: Optional[str] = None
    updatedBy: Optional[str] = None
    updatedByName: Optional[str] = None
    createdAt: str

class RescueStatusUpdateResponse(BaseModel):
    id: str
    status: str

class RescueAssignResponse(BaseModel):
    id: str
    status: str
    assignedTo: str

@router.get("/", response_model=List[RescueResponse])
def get_all_rescues(
    status: Optional[str] = None,
    severity: Optional[str] = None,
    species: Optional[str] = None,
    reporterId: Optional[str] = None,
    limit: int = Query(default=20, ge=1, le=100),
    offset: int = Query(default=0, ge=0),
    user: dict = Depends(get_current_user),
):
    try:
        user_role = user.get("role", "CITIZEN")
        is_staff = user_role in STAFF_ROLES

        query = supabase.table("rescues").select("*")
        if status:
            query = query.eq("status", status.upper())
        if severity:
            query = query.eq("severity", severity.upper())
        if species:
            query = query.eq("species", species)

        # Privacy & Access Control: Staff can filter by reporterId or view all.
        # Non-staff (e.g. citizens) can ONLY view their own reported rescues.
        if is_staff:
            if reporterId:
                query = query.eq("reporter_id", reporterId)
        else:
            query = query.eq("reporter_id", user["uid"])
            
        res = query.order("created_at", desc=True).range(offset, offset + limit - 1).execute()
        rescues = []
        for data in res.data:
            rescues.append({
                "id": data["id"],
                "title": data["title"],
                "description": data["description"],
                "species": data["species"],
                "severity": data["severity"],
                "status": data["status"],
                "reporterId": data["reporter_id"],
                "assignedTo": data["assigned_to"],
                "location": {"latitude": data["latitude"], "longitude": data["longitude"]},
                "address": data["address"],
                "photoUrls": data.get("images", []),
                "createdAt": data["created_at"],
                "updatedAt": data["updated_at"],
            })
        return rescues
    except Exception as e:
        logger.error(f"Error fetching rescues: {e}")
        raise HTTPException(status_code=500, detail="Failed to retrieve rescues")

@router.get("/public", response_model=List[PublicRescueResponse])
def get_public_rescues(
    status: Optional[str] = None,
    severity: Optional[str] = None,
    species: Optional[str] = None,
    limit: int = Query(default=100, ge=1, le=250),
    offset: int = Query(default=0, ge=0),
):
    """
    Publicly visible rescue markers.
    Obfuscates precise coordinates (~500m - 1km) and omits description, address, photos, and reporter info.
    Filters to unresolved/active cases by default unless status is explicitly requested.
    """
    try:
        query = supabase.table("rescues").select("id, species, severity, status, latitude, longitude, created_at")
        if status:
            query = query.eq("status", status.upper())
        else:
            # Default to active/unresolved incidents for the community map
            query = query.neq("status", "RESOLVED").neq("status", "CANCELLED")

        if severity:
            query = query.eq("severity", severity.upper())
        if species:
            query = query.eq("species", species)
            
        res = query.order("created_at", desc=True).range(offset, offset + limit - 1).execute()
        public_rescues = []
        for data in res.data:
            lat = round(data["latitude"], 2) if data.get("latitude") is not None else None
            lon = round(data["longitude"], 2) if data.get("longitude") is not None else None
            species = (data.get("species") or "Animal").capitalize()
            public_rescues.append({
                "id": data["id"],
                "title": f"{species} SOS Report",
                "species": data["species"],
                "severity": data["severity"],
                "status": data["status"],
                "location": {"latitude": lat, "longitude": lon},
                "createdAt": data["created_at"],
            })
        return public_rescues
    except Exception as e:
        logger.error(f"Error fetching public rescues: {e}")
        raise HTTPException(status_code=500, detail="Failed to retrieve public rescue markers")

@router.get("/{rescue_id}", response_model=RescueResponse)
def get_rescue_by_id(rescue_id: str, user: dict = Depends(get_current_user)):
    try:
        res = supabase.table("rescues").select("*").eq("id", rescue_id).execute()
        if not res.data:
            raise HTTPException(status_code=404, detail="Rescue request not found")
        data = res.data[0]

        user_role = user.get("role", "CITIZEN")
        is_staff = user_role in STAFF_ROLES
        is_reporter = data.get("reporter_id") == user["uid"]
        is_assigned = data.get("assigned_to") == user["uid"]

        if not (is_staff or is_reporter or is_assigned):
            raise HTTPException(
                status_code=403,
                detail="Forbidden: You do not have permission to access this rescue request"
            )

        return {
            "id": data["id"],
            "title": data["title"],
            "description": data["description"],
            "species": data["species"],
            "severity": data["severity"],
            "status": data["status"],
            "reporterId": data["reporter_id"],
            "assignedTo": data["assigned_to"],
            "location": {"latitude": data["latitude"], "longitude": data["longitude"]},
            "address": data["address"],
            "photoUrls": data.get("images", []),
            "createdAt": data["created_at"],
            "updatedAt": data["updated_at"],
        }
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error fetching rescue {rescue_id}: {e}")
        raise HTTPException(status_code=500, detail="Failed to retrieve rescue request")

def dispatch_nearby_responder_alerts(
    rescue_id: str,
    species: str,
    severity: str,
    latitude: float,
    longitude: float,
    address: str,
    reporter_id: str,
):
    """
    Background worker: locates active volunteer and NGO responders within geographic range
    using the Haversine RPC, falling back only to responders without configured coordinates
    if no nearby responders are found within range.
    """
    try:
        nearby_responders = []
        try:
            # 1. Spatial Haversine lookup via Supabase RPC (100km max search ceiling)
            rpc_res = supabase.rpc("get_nearby_responders", {
                "p_lat": latitude,
                "p_lon": longitude,
                "p_max_radius_km": 100,
            }).execute()
            if rpc_res.data:
                nearby_responders = rpc_res.data
        except Exception as rpc_err:
            logger.warning(f"Haversine RPC get_nearby_responders unavailable or failed: {rpc_err}")

        target_responder_ids = []
        if nearby_responders:
            for r in nearby_responders:
                rid = r.get("id")
                if rid and rid != reporter_id:
                    target_responder_ids.append(rid)
        else:
            # Geofence protection: only fallback to active responders who haven't configured coordinates yet.
            # Responders with explicit locations set outside this radius are NOT alerted.
            all_resp = (
                supabase.table("users")
                .select("id")
                .in_("role", ["VOLUNTEER", "NGO"])
                .is_("latitude", "null")
                .eq("alerts_enabled", True)
                .execute()
            )
            if all_resp.data:
                for r in all_resp.data:
                    rid = r.get("id")
                    if rid and rid != reporter_id:
                        target_responder_ids.append(rid)
            logger.warning(
                f"No location-configured responders in range for rescue {rescue_id}. "
                f"Dispatched alerts to {len(target_responder_ids)} unconfigured responders."
            )

        # Batch insert rescue alert notifications
        if target_responder_ids:
            now_iso = datetime.now(timezone.utc).isoformat()
            notifications = [
                {
                    "user_id": uid,
                    "type": "RESCUE_ALERT",
                    "title": f"Emergency SOS Alert: {severity} Priority",
                    "message": f"New {severity.lower()} emergency rescue ({species}) reported near {address[:40]}.",
                    "related_entity_id": rescue_id,
                    "related_entity_type": "RESCUE",
                    "is_read": False,
                    "created_at": now_iso,
                }
                for uid in target_responder_ids
            ]
            create_bulk_system_notifications(notifications)
            logger.info(f"Dispatched {len(notifications)} nearby rescue alerts for case {rescue_id}")
    except Exception as e:
        logger.warning(f"Failed to execute background nearby responder alert dispatch: {e}")

@router.post("/", response_model=RescueResponse, status_code=status.HTTP_201_CREATED)
def create_rescue_request(
    request: RescueRequestCreate,
    background_tasks: BackgroundTasks,
    user: dict = Depends(get_current_user),
):
    target_sev = request.severity.upper()
    if target_sev not in VALID_SEVERITIES:
        raise HTTPException(status_code=422, detail=f"Invalid severity '{request.severity}'. Must be one of {sorted(VALID_SEVERITIES)}")
        
    valid_photos = validate_photo_urls(request.photoUrls)
        
    try:
        new_rescue = {
            "title": request.title,
            "description": request.description,
            "species": request.species,
            "latitude": request.location.latitude,
            "longitude": request.location.longitude,
            "address": request.address,
            "images": valid_photos,
            "severity": target_sev,
            "status": "PENDING",
            "reporter_id": user["uid"],
        }
        
        res = supabase.table("rescues").insert(new_rescue).execute()
        if not res.data:
            raise HTTPException(status_code=500, detail="Failed to create rescue request")
        
        doc_id = res.data[0]["id"]
        
        # Add initial timeline entry
        try:
            timeline_entry = {
                "rescue_id": doc_id,
                "status": "PENDING",
                "message": "Rescue request submitted",
                "updated_by": user["uid"],
                "updated_by_name": user.get("name") or "Citizen Reporter",
                "created_at": datetime.now(timezone.utc).isoformat(),
            }
            supabase.table("rescue_timeline").insert(timeline_entry).execute()
        except Exception as te_err:
            logger.warning(f"Failed to record initial timeline: {te_err}")

        # Offload spatial responder alert broadcast to background task so the API responds instantly
        if target_sev in ["CRITICAL", "HIGH"]:
            background_tasks.add_task(
                dispatch_nearby_responder_alerts,
                rescue_id=doc_id,
                species=request.species,
                severity=target_sev,
                latitude=request.location.latitude,
                longitude=request.location.longitude,
                address=request.address,
                reporter_id=user["uid"],
            )
        
        row = res.data[0]
        return {
            "id": doc_id,
            "title": row.get("title", request.title),
            "description": row.get("description", request.description),
            "species": row.get("species", request.species),
            "severity": target_sev,
            "status": row.get("status", "PENDING"),
            "reporterId": user["uid"],
            "assignedTo": row.get("assigned_to"),
            "location": {"latitude": request.location.latitude, "longitude": request.location.longitude},
            "address": row.get("address", request.address),
            "photoUrls": valid_photos,
            "createdAt": row.get("created_at") or datetime.now(timezone.utc).isoformat(),
            "updatedAt": row.get("updated_at") or row.get("created_at") or datetime.now(timezone.utc).isoformat(),
        }
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error creating rescue: {e}")
        raise HTTPException(status_code=500, detail="Failed to create rescue request")

@router.patch("/{rescue_id}/status", response_model=RescueStatusUpdateResponse)
def update_rescue_status(rescue_id: str, update: RescueRequestStatusUpdate, user: dict = Depends(get_current_user)):
    target_status = update.status.upper()
    if target_status not in VALID_STATUSES:
        raise HTTPException(status_code=422, detail=f"Invalid status '{update.status}'. Must be one of {sorted(VALID_STATUSES)}")
        
    try:
        existing = supabase.table("rescues").select("*").eq("id", rescue_id).execute()
        if not existing.data:
            raise HTTPException(status_code=404, detail="Rescue request not found")
            
        current_rescue = existing.data[0]
        user_role = user.get("role", "CITIZEN")
        is_reporter = current_rescue.get("reporter_id") == user["uid"]
        is_staff = user_role in STAFF_ROLES
        
        if not is_staff:
            if not (is_reporter and target_status in ["CANCELLED", "RESOLVED"]):
                raise HTTPException(
                    status_code=403, 
                    detail="Forbidden: Only assigned responders or administrators can change rescue status to this state"
                )
        
        res = supabase.table("rescues").update({"status": target_status}).eq("id", rescue_id).execute()
        if not res.data:
            raise HTTPException(status_code=404, detail="Rescue request not found")
            
        # Record timeline entry using verified identity from JWT token
        try:
            status_msg = update.message or f"Status updated to {target_status}"
            timeline_entry = {
                "rescue_id": rescue_id,
                "status": target_status,
                "message": status_msg,
                "updated_by": user["uid"],
                "updated_by_name": user.get("name") or user_role,
                "created_at": datetime.now(timezone.utc).isoformat(),
            }
            supabase.table("rescue_timeline").insert(timeline_entry).execute()
        except Exception as te_err:
            logger.warning(f"Failed to insert timeline entry: {te_err}")
            
        return {"id": rescue_id, "status": target_status}
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error updating rescue status: {e}")
        raise HTTPException(status_code=500, detail="Failed to update rescue status")

@router.post("/{rescue_id}/assign", response_model=RescueAssignResponse)
def assign_volunteer(rescue_id: str, req: AssignVolunteerRequest, user: dict = Depends(get_current_user)):
    try:
        user_role = user.get("role", "CITIZEN")
        if user_role not in STAFF_ROLES:
            raise HTTPException(status_code=403, detail="Forbidden: Only staff and responders can assign volunteers")
            
        # Validate that volunteerId exists and is an authorized responder/volunteer
        vol_check = supabase.table("users").select("id, role, display_name").eq("id", req.volunteerId).execute()
        if not vol_check.data:
            raise HTTPException(status_code=404, detail="Volunteer user not found")
            
        vol_user = vol_check.data[0]
        if vol_user.get("role") not in STAFF_ROLES:
            raise HTTPException(status_code=400, detail="User is not registered as a volunteer or responder")
            
        volunteer_name = vol_user.get("display_name") or req.volunteerName
        new_status = "DISPATCHED"
        
        res = supabase.table("rescues").update({
            "assigned_to": req.volunteerId,
            "status": new_status,
        }).eq("id", rescue_id).execute()
        
        if not res.data:
            raise HTTPException(status_code=404, detail="Rescue request not found")
            
        try:
            timeline_entry = {
                "rescue_id": rescue_id,
                "status": new_status,
                "message": f"Assigned to responder {volunteer_name} by {user.get('name', 'Staff')}",
                "updated_by": user["uid"],
                "updated_by_name": user.get("name") or user_role,
                "created_at": datetime.now(timezone.utc).isoformat(),
            }
            supabase.table("rescue_timeline").insert(timeline_entry).execute()
        except Exception as te_err:
            logger.warning(f"Failed to record timeline assignment: {te_err}")
            
        # Send notifications to assigned volunteer and reporter
        assigned_rescue = res.data[0]
        create_system_notification(
            user_id=req.volunteerId,
            notif_type="RESCUE_ASSIGNED",
            title="New Rescue Assignment",
            message=f"You have been assigned to rescue dispatch {rescue_id[:8].upper()}.",
            related_entity_id=rescue_id,
            related_entity_type="RESCUE",
        )
        reporter_id = assigned_rescue.get("reporter_id")
        if reporter_id and reporter_id != req.volunteerId:
            create_system_notification(
                user_id=reporter_id,
                notif_type="RESCUE_UPDATE",
                title="Responder Dispatched",
                message=f"Responder {volunteer_name} has been dispatched to your rescue report.",
                related_entity_id=rescue_id,
                related_entity_type="RESCUE",
            )

        return {"id": rescue_id, "status": new_status, "assignedTo": req.volunteerId}
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error assigning volunteer: {e}")
        raise HTTPException(status_code=500, detail="Failed to assign volunteer")

@router.delete("/{rescue_id}")
def delete_rescue(rescue_id: str, user: dict = Depends(get_current_user)):
    try:
        existing = supabase.table("rescues").select("id, reporter_id").eq("id", rescue_id).execute()
        if not existing.data:
            raise HTTPException(status_code=404, detail="Rescue request not found")
            
        rescue = existing.data[0]
        is_reporter = rescue.get("reporter_id") == user["uid"]
        is_admin = user.get("role") == "ADMIN"
        
        if not (is_reporter or is_admin):
            raise HTTPException(status_code=403, detail="Forbidden: Only the reporter or an administrator can delete this rescue request")
            
        supabase.table("rescues").delete().eq("id", rescue_id).execute()
        return {"id": rescue_id, "deleted": True}
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error deleting rescue {rescue_id}: {e}")
        raise HTTPException(status_code=500, detail="Failed to delete rescue request")

@router.get("/{rescue_id}/timeline", response_model=List[TimelineEventResponse])
def get_rescue_timeline(
    rescue_id: str,
    limit: int = Query(default=50, ge=1, le=100),
    offset: int = Query(default=0, ge=0),
    user: dict = Depends(get_current_user),
):
    try:
        parent = supabase.table("rescues").select("id, reporter_id, assigned_to").eq("id", rescue_id).execute()
        if not parent.data:
            raise HTTPException(status_code=404, detail="Rescue request not found")
        rescue = parent.data[0]

        user_role = user.get("role", "CITIZEN")
        is_staff = user_role in STAFF_ROLES
        is_reporter = rescue.get("reporter_id") == user["uid"]
        is_assigned = rescue.get("assigned_to") == user["uid"]

        if not (is_staff or is_reporter or is_assigned):
            raise HTTPException(
                status_code=403,
                detail="Forbidden: You do not have permission to access this rescue timeline"
            )

        res = (
            supabase.table("rescue_timeline")
            .select("*")
            .eq("rescue_id", rescue_id)
            .order("created_at", desc=False)
            .range(offset, offset + limit - 1)
            .execute()
        )
        return [
            {
                "id": d["id"], 
                "status": d["status"], 
                "message": d["message"], 
                "updatedBy": d.get("updated_by"),
                "updatedByName": d.get("updated_by_name"),
                "createdAt": d["created_at"]
            } 
            for d in res.data
        ]
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error fetching rescue timeline: {e}")
        raise HTTPException(status_code=500, detail="Failed to retrieve rescue timeline")
