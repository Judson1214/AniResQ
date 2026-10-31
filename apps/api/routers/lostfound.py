import logging
from fastapi import APIRouter, Depends, HTTPException, Query, status
from typing import Optional, List
from pydantic import BaseModel
from datetime import datetime
from supabase_config import supabase
from auth import get_current_user

router = APIRouter(prefix="/api/lostfound", tags=["lostfound"])
logger = logging.getLogger("lostfound")

class Location(BaseModel):
    latitude: float
    longitude: float

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
def get_lost_found(type: Optional[str] = None, status: Optional[str] = None, reporterId: Optional[str] = None):
    try:
        query = supabase.table("lost_and_found").select("*")
        if type:
            query = query.eq("type", type)
        if status:
            query = query.eq("status", status)
        if reporterId:
            query = query.eq("reporter_id", reporterId)
        
        res = query.order("created_at", desc=True).execute()
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
    try:
        new_post = {
            "type": report.type,
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
            "status": "ACTIVE"
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
    try:
        existing = supabase.table("lost_and_found").select("id, reporter_id").eq("id", id).execute()
        if not existing.data:
            raise HTTPException(status_code=404, detail="Lost/found post not found")
            
        post = existing.data[0]
        is_reporter = post.get("reporter_id") == user["uid"]
        is_admin = user.get("role") == "ADMIN"
        
        if not (is_reporter or is_admin):
            raise HTTPException(status_code=403, detail="Forbidden: Only the original reporter or admin can change status")
            
        res = supabase.table("lost_and_found").update({"status": status_update.status}).eq("id", id).execute()
        if not res.data:
            raise HTTPException(status_code=404, detail="Lost/found post not found")
        
        return {"id": res.data[0]["id"], "status": res.data[0]["status"]}
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error updating lost/found status {id}: {e}")
        raise HTTPException(status_code=500, detail="Failed to update lost/found post status")

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

@router.post("/{id}/replies", status_code=status.HTTP_201_CREATED)
def add_lost_found_reply(id: str, reply: LostFoundReply, user: dict = Depends(get_current_user)):
    try:
        post_res = supabase.table("lost_and_found").select("id").eq("id", id).execute()
        if not post_res.data:
            raise HTTPException(status_code=404, detail="Report not found")
            
        new_reply = {
            "lost_and_found_id": id,
            "user_id": user["uid"],
            "user_name": user.get("name") or user.get("email", "Anonymous"),
            "text": reply.text.strip()
        }
        
        if not new_reply["text"]:
            raise HTTPException(status_code=400, detail="Reply text cannot be empty")
            
        res = supabase.table("lost_and_found_replies").insert(new_reply).execute()
        if not res.data:
            raise HTTPException(status_code=500, detail="Failed to insert reply")
            
        data = res.data[0]
        return {
            "id": data["id"],
            "userId": data["user_id"],
            "userName": data["user_name"],
            "text": data["text"],
            "createdAt": data["created_at"]
        }
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error adding reply to post {id}: {e}")
        raise HTTPException(status_code=500, detail="Failed to add reply")

@router.get("/{id}/replies")
def get_lost_found_replies(id: str):
    try:
        post_res = supabase.table("lost_and_found").select("id").eq("id", id).execute()
        if not post_res.data:
            raise HTTPException(status_code=404, detail="Report not found")
            
        res = supabase.table("lost_and_found_replies").select("*").eq("lost_and_found_id", id).order("created_at").execute()
        return [
            {
                "id": data["id"],
                "userId": data["user_id"],
                "userName": data["user_name"],
                "text": data["text"],
                "createdAt": data["created_at"]
            }
            for data in res.data
        ]
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error fetching replies for post {id}: {e}")
        raise HTTPException(status_code=500, detail="Failed to retrieve replies")
