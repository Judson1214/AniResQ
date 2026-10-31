import logging
from fastapi import APIRouter, Depends, HTTPException, status
from typing import Optional, List
from pydantic import BaseModel
from datetime import datetime
from supabase_config import supabase
from auth import get_current_user

router = APIRouter(prefix="/api/notifications", tags=["notifications"])
logger = logging.getLogger("notifications")

def map_notification(db_data: dict) -> dict:
    return {
        "id": db_data["id"],
        "userId": db_data["user_id"],
        "type": db_data["type"],
        "title": db_data["title"],
        "message": db_data["message"],
        "isRead": db_data.get("is_read", False),
        "relatedEntityId": db_data.get("related_entity_id"),
        "relatedEntityType": db_data.get("related_entity_type"),
        "createdAt": db_data.get("created_at"),
    }

@router.get("/")
def get_notifications(user: dict = Depends(get_current_user)):
    try:
        res = (
            supabase.table("notifications")
            .select("*")
            .eq("user_id", user["uid"])
            .order("created_at", desc=True)
            .limit(50)
            .execute()
        )
        return [map_notification(d) for d in res.data]
    except Exception as e:
        logger.error(f"Error fetching notifications: {e}")
        raise HTTPException(status_code=500, detail="Failed to retrieve notifications")

@router.patch("/{id}/read")
def mark_as_read(id: str, user: dict = Depends(get_current_user)):
    try:
        existing = supabase.table("notifications").select("id, user_id").eq("id", id).execute()
        if not existing.data:
            raise HTTPException(status_code=404, detail="Notification not found")
            
        if existing.data[0]["user_id"] != user["uid"]:
            raise HTTPException(status_code=403, detail="Not authorized to update this notification")
            
        res = supabase.table("notifications").update({"is_read": True}).eq("id", id).execute()
        if not res.data:
            raise HTTPException(status_code=404, detail="Notification not found")
            
        return map_notification(res.data[0])
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error marking notification {id} as read: {e}")
        raise HTTPException(status_code=500, detail="Failed to update notification")

@router.post("/mark-all-read")
def mark_all_read(user: dict = Depends(get_current_user)):
    try:
        supabase.table("notifications").update({"is_read": True}).eq("user_id", user["uid"]).eq("is_read", False).execute()
        return {"success": True}
    except Exception as e:
        logger.error(f"Error marking all notifications read: {e}")
        raise HTTPException(status_code=500, detail="Failed to update notifications")
