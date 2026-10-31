import logging
from datetime import datetime, timezone
from typing import Optional, List
from fastapi import APIRouter, Depends, HTTPException, Query, status
from pydantic import BaseModel, Field

from supabase_config import supabase
from auth import get_current_user

router = APIRouter(prefix="/api/lostfound", tags=["lostfound"])
logger = logging.getLogger("lostfound")

VALID_TYPES = {"LOST", "FOUND"}
VALID_STATUSES = {"ACTIVE", "RESOLVED"}

class Location(BaseModel):
    latitude: float = Field(..., ge=-90.0, le=90.0, description="Latitude must be between -90 and 90")
    longitude: float = Field(..., ge=-180.0, le=180.0, description="Longitude must be between -180 and 180")

class LostFoundCreate(BaseModel):
    type: str
    title: str
    description: str
    species: str
    breed: Optional[str] = None
    color: str
    contactPhone: str
    contactEmail: Optional[str] = ""
    location: Location
    lastSeenAddress: str
    lastSeenDate: str
    photoUrls: List[str] = []

class LostFoundStatusUpdate(BaseModel):
    status: str

class LostFoundReply(BaseModel):
    text: str

def map_post_to_camel(data: dict) -> dict:
    return {
        "id": data["id"],
        "type": data["type"],
        "title": data["title"],
        "description": data["description"],
        "species": data["species"],
        "breed": data.get("breed"),
        "color": data["color"],
        "contactPhone": data["contact_phone"],
        "contactEmail": data.get("contact_email") or "",
        "location": {"latitude": data["latitude"], "longitude": data["longitude"]},
        "lastSeenAddress": data["last_seen_address"],
        "lastSeenDate": data["last_seen_date"],
        "reporterId": data["reporter_id"],
        "userId": data["reporter_id"],
        "photoUrls": data.get("images", []),
        "status": data["status"],
        "createdAt": data["created_at"],
        "updatedAt": data.get("updated_at"),
    }

@router.get("/")
def get_lost_found(
    type: Optional[str] = None,
    status: Optional[str] = None,
    reporterId: Optional[str] = None,
    limit: int = Query(default=20, ge=1, le=100),
    offset: int = Query(default=0, ge=0),
):
    try:
        query = supabase.table("lost_and_found").select("*")
        if type:
            query = query.eq("type", type.upper())
        if status:
            query = query.eq("status", status.upper())
        if reporterId:
            query = query.eq("reporter_id", reporterId)
        
        res = query.order("created_at", desc=True).range(offset, offset + limit - 1).execute()
        return [map_post_to_camel(d) for d in res.data]
    except Exception as e:
        logger.error(f"Error fetching lost/found posts: {e}")
        raise HTTPException(status_code=500, detail="Failed to retrieve lost and found posts")

@router.get("/{id}")
def get_lost_found_by_id(id: str):
    try:
        res = supabase.table("lost_and_found").select("*").eq("id", id).execute()
        if not res.data:
            raise HTTPException(status_code=404, detail="Lost/found report not found")
        return map_post_to_camel(res.data[0])
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error fetching lost/found post {id}: {e}")
        raise HTTPException(status_code=500, detail="Failed to retrieve lost/found report")

@router.post("/", status_code=status.HTTP_201_CREATED)
def create_lost_found(report: LostFoundCreate, user: dict = Depends(get_current_user)):
    target_type = report.type.upper()
    if target_type not in VALID_TYPES:
        raise HTTPException(status_code=422, detail=f"Invalid type '{report.type}'. Must be one of {sorted(VALID_TYPES)}")
        
    try:
        new_post = {
            "type": target_type,
            "title": report.title,
            "description": report.description,
            "species": report.species,
            "breed": report.breed,
            "color": report.color,
            "contact_phone": report.contactPhone,
            "contact_email": report.contactEmail or user.get("email", ""),
            "latitude": report.location.latitude,
            "longitude": report.location.longitude,
            "last_seen_address": report.lastSeenAddress,
            "last_seen_date": report.lastSeenDate,
            "reporter_id": user["uid"],
            "images": report.photoUrls,
            "status": "ACTIVE",
            "created_at": datetime.now(timezone.utc).isoformat(),
        }
        
        res = supabase.table("lost_and_found").insert(new_post).execute()
        if not res.data:
            raise HTTPException(status_code=500, detail="Failed to insert lost/found post")
            
        return map_post_to_camel(res.data[0])
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error creating lost/found post: {e}")
        raise HTTPException(status_code=500, detail="Failed to create lost/found post")

@router.patch("/{id}/status")
def update_lost_found_status(id: str, status_update: LostFoundStatusUpdate, user: dict = Depends(get_current_user)):
    target_status = status_update.status.upper()
    if target_status not in VALID_STATUSES:
        raise HTTPException(status_code=422, detail=f"Invalid status '{status_update.status}'. Must be one of {sorted(VALID_STATUSES)}")
        
    try:
        existing = supabase.table("lost_and_found").select("id, reporter_id").eq("id", id).execute()
        if not existing.data:
            raise HTTPException(status_code=404, detail="Lost/found post not found")
            
        post = existing.data[0]
        is_reporter = post.get("reporter_id") == user["uid"]
        is_admin = user.get("role") == "ADMIN"
        
        if not (is_reporter or is_admin):
            raise HTTPException(status_code=403, detail="Forbidden: Only the original reporter or admin can change status")
            
        res = supabase.table("lost_and_found").update({"status": target_status}).eq("id", id).execute()
        if not res.data:
            raise HTTPException(status_code=404, detail="Lost/found post not found")
        
        return {"id": res.data[0]["id"], "status": res.data[0]["status"]}
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error updating lost/found status {id}: {e}")
        raise HTTPException(status_code=500, detail="Failed to update lost/found status")

@router.delete("/{id}")
def delete_lost_found(id: str, user: dict = Depends(get_current_user)):
    try:
        existing = supabase.table("lost_and_found").select("id, reporter_id").eq("id", id).execute()
        if not existing.data:
            raise HTTPException(status_code=404, detail="Lost/found post not found")
            
        post = existing.data[0]
        is_reporter = post.get("reporter_id") == user["uid"]
        is_admin = user.get("role") == "ADMIN"
        
        if not (is_reporter or is_admin):
            raise HTTPException(status_code=403, detail="Forbidden: Only the original reporter or admin can delete this post")
            
        supabase.table("lost_and_found").delete().eq("id", id).execute()
        return {"id": id, "deleted": True}
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error deleting lost/found post {id}: {e}")
        raise HTTPException(status_code=500, detail="Failed to delete lost/found post")

@router.get("/{id}/replies")
def get_lost_found_replies(
    id: str,
    limit: int = Query(default=50, ge=1, le=100),
    offset: int = Query(default=0, ge=0),
):
    try:
        res = (
            supabase.table("lost_and_found_replies")
            .select("*")
            .eq("lost_and_found_id", id)
            .order("created_at", desc=False)
            .range(offset, offset + limit - 1)
            .execute()
        )
        return [
            {
                "id": r["id"],
                "postId": r["lost_and_found_id"],
                "userId": r["user_id"],
                "userName": r["user_name"],
                "text": r["text"],
                "createdAt": r["created_at"],
            }
            for r in res.data
        ]
    except Exception as e:
        logger.error(f"Error fetching replies for post {id}: {e}")
        raise HTTPException(status_code=500, detail="Failed to retrieve replies")

@router.post("/{id}/replies", status_code=status.HTTP_201_CREATED)
def add_lost_found_reply(id: str, reply: LostFoundReply, user: dict = Depends(get_current_user)):
    try:
        # Verify parent post exists
        post_res = supabase.table("lost_and_found").select("id").eq("id", id).execute()
        if not post_res.data:
            raise HTTPException(status_code=404, detail="Lost/found post not found")
            
        data = {
            "lost_and_found_id": id,
            "user_id": user["uid"],
            "user_name": user.get("name") or "Community Member",
            "text": reply.text,
            "created_at": datetime.now(timezone.utc).isoformat(),
        }
        res = supabase.table("lost_and_found_replies").insert(data).execute()
        if not res.data:
            raise HTTPException(status_code=500, detail="Failed to add reply")
            
        return {
            "id": res.data[0]["id"],
            "postId": res.data[0]["lost_and_found_id"],
            "userId": res.data[0]["user_id"],
            "userName": res.data[0]["user_name"],
            "text": res.data[0]["text"],
            "createdAt": res.data[0]["created_at"],
        }
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error adding reply to post {id}: {e}")
        raise HTTPException(status_code=500, detail="Failed to submit reply")
