from fastapi import APIRouter, Depends, HTTPException
from typing import Optional
from pydantic import BaseModel
from datetime import datetime
from firebase_config import db
from auth import get_current_user

router = APIRouter(prefix="/api/notifications", tags=["notifications"])

@router.get("/")
def get_notifications(user: dict = Depends(get_current_user)):
    notif_ref = db.collection("notifications")
    query = notif_ref.where("userId", "==", user["uid"])
    
    docs = query.stream()
    result = []
    for doc in docs:
        data = doc.to_dict()
        data["id"] = doc.id
        result.append(data)
    return result

@router.patch("/{id}/read")
def mark_as_read(id: str, user: dict = Depends(get_current_user)):
    doc_ref = db.collection("notifications").document(id)
    doc = doc_ref.get()
    if not doc.exists:
        raise HTTPException(status_code=404, detail="Notification not found")
        
    doc_data = doc.to_dict()
    if doc_data.get("userId") != user["uid"]:
        raise HTTPException(status_code=403, detail="Not authorized to update this notification")
        
    doc_ref.update({"read": True, "readAt": datetime.utcnow().isoformat()})
    
    updated = doc_ref.get().to_dict()
    updated["id"] = id
    return updated

@router.post("/mark-all-read")
def mark_all_read(user: dict = Depends(get_current_user)):
    notif_ref = db.collection("notifications")
    query = notif_ref.where("userId", "==", user["uid"]).where("read", "==", False)
    
    docs = query.stream()
    batch = db.batch()
    count = 0
    now = datetime.utcnow().isoformat()
    
    for doc in docs:
        batch.update(doc.reference, {"read": True, "readAt": now})
        count += 1
        
    if count > 0:
        batch.commit()
        
    return {"message": f"Marked {count} notifications as read"}
