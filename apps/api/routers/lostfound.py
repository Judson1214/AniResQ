from fastapi import APIRouter, Depends, HTTPException, Query
from typing import Optional, List
from pydantic import BaseModel
from datetime import datetime
from supabase_config import supabase
from auth import get_current_user

router = APIRouter(prefix="/api/lostfound", tags=["lostfound"])

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
    contactEmail: str
    location: Location
    lastSeenAddress: str
    lastSeenDate: str
    reporterId: str
    photoUrls: List[str] = []

class LostFoundStatusUpdate(BaseModel):
    status: str

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
        
        result = []
        for data in res.data:
            result.append({
                "id": data["id"],
                "type": data["type"],
                "title": data["title"],
                "description": data["description"],
                "species": data["species"],
                "breed": data.get("breed"),
                "color": data["color"],
                "contactPhone": data["contact_phone"],
                "contactEmail": data["contact_email"],
                "location": {"latitude": data["latitude"], "longitude": data["longitude"]},
                "lastSeenAddress": data["last_seen_address"],
                "lastSeenDate": data["last_seen_date"],
                "reporterId": data["reporter_id"],
                "photoUrls": data.get("images", []),
                "status": data["status"],
                "userId": data["reporter_id"], # Changed from user_id to reporter_id per schema
                "createdAt": data["created_at"],
                "updatedAt": data.get("updated_at"),
            })
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/")
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
            "contact_email": report.contactEmail,
            "latitude": report.location.latitude,
            "longitude": report.location.longitude,
            "last_seen_address": report.lastSeenAddress,
            "last_seen_date": report.lastSeenDate,
            "reporter_id": user.get("uid"), # Use auth user id per schema
            "images": report.photoUrls,
            "status": "ACTIVE"
        }
        
        res = supabase.table("lost_and_found").insert(new_post).execute()
        if not res.data:
            raise Exception("Failed to insert lost/found post")
            
        data = res.data[0]
        return {
            "id": data["id"],
            "type": data["type"],
            "title": data["title"],
            "description": data["description"],
            "species": data["species"],
            "breed": data.get("breed"),
            "color": data["color"],
            "contactPhone": data["contact_phone"],
            "contactEmail": data["contact_email"],
            "location": {"latitude": data["latitude"], "longitude": data["longitude"]},
            "lastSeenAddress": data["last_seen_address"],
            "lastSeenDate": data["last_seen_date"],
            "reporterId": data["reporter_id"],
            "photoUrls": data.get("images", []),
            "status": data["status"],
            "userId": data["reporter_id"],
            "createdAt": data["created_at"],
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.patch("/{id}/status")
def update_lost_found_status(id: str, status_update: LostFoundStatusUpdate, user: dict = Depends(get_current_user)):
    try:
        res = supabase.table("lost_and_found").update({"status": status_update.status}).eq("id", id).execute()
        if not res.data:
            raise HTTPException(status_code=404, detail="Not found")
        
        data = res.data[0]
        return {
            "id": data["id"],
            "status": data["status"]
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

class LostFoundReply(BaseModel):
    text: str

@router.post("/{id}/replies")
def add_lost_found_reply(id: str, reply: LostFoundReply, user: dict = Depends(get_current_user)):
    try:
        # Verify post exists
        post_res = supabase.table("lost_and_found").select("id").eq("id", id).execute()
        if not post_res.data:
            raise HTTPException(status_code=404, detail="Report not found")
            
        new_reply = {
            "lost_and_found_id": id,
            "user_id": user["uid"],
            "user_name": user.get("name", user.get("email", "Anonymous")),
            "text": reply.text
        }
        
        res = supabase.table("lost_and_found_replies").insert(new_reply).execute()
        if not res.data:
            raise Exception("Failed to insert reply")
            
        data = res.data[0]
        return {
            "id": data["id"],
            "userId": data["user_id"],
            "userName": data["user_name"],
            "text": data["text"],
            "createdAt": data["created_at"]
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/{id}/replies")
def get_lost_found_replies(id: str):
    try:
        post_res = supabase.table("lost_and_found").select("id").eq("id", id).execute()
        if not post_res.data:
            raise HTTPException(status_code=404, detail="Report not found")
            
        res = supabase.table("lost_and_found_replies").select("*").eq("lost_and_found_id", id).order("created_at").execute()
        
        result = []
        for data in res.data:
            result.append({
                "id": data["id"],
                "userId": data["user_id"],
                "userName": data["user_name"],
                "text": data["text"],
                "createdAt": data["created_at"]
            })
        return result
    except Exception as e:
        # Return empty list if table doesn't exist yet rather than breaking
        if 'relation "public.lost_and_found_replies" does not exist' in str(e):
            return []
        raise HTTPException(status_code=500, detail=str(e))
