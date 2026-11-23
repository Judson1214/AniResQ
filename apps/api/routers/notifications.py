import logging
from datetime import datetime, timezone
from typing import Optional, List
from fastapi import APIRouter, Depends, HTTPException, Query, status
from pydantic import BaseModel

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

def create_system_notification(
    user_id: str,
    notif_type: str,
    title: str,
    message: str,
    related_entity_id: Optional[str] = None,
    related_entity_type: Optional[str] = None,
):
    try:
        supabase.table("notifications").insert({
            "user_id": user_id,
            "type": notif_type,
            "title": title,
            "message": message,
            "is_read": False,
            "related_entity_id": related_entity_id,
            "related_entity_type": related_entity_type,
            "created_at": datetime.now(timezone.utc).isoformat(),
        }).execute()
    except Exception as e:
        logger.warning(f"Failed to create system notification for user {user_id}: {e}")

def create_bulk_system_notifications(notifications_list: List[dict]):
    if not notifications_list:
        return
    try:
        supabase.table("notifications").insert(notifications_list).execute()
    except Exception as e:
        logger.warning(f"Failed to bulk insert system notifications ({len(notifications_list)} items): {e}")

@router.get("/")
def get_notifications(
    limit: int = Query(default=50, ge=1, le=100),
    offset: int = Query(default=0, ge=0),
    user: dict = Depends(get_current_user),
):
    try:
        res = (
            supabase.table("notifications")
            .select("*")
            .eq("user_id", user["uid"])
            .order("created_at", desc=True)
            .range(offset, offset + limit - 1)
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
