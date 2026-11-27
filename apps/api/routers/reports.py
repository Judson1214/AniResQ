import logging
from datetime import datetime, timezone
from typing import Optional, List, Literal
from fastapi import APIRouter, Depends, HTTPException, Query, status
from pydantic import BaseModel, Field

from supabase_config import supabase
from auth import get_current_user, require_roles
from rate_limiter import limiter
from .audit import log_audit_event

router = APIRouter(prefix="/api/reports", tags=["reports"])
logger = logging.getLogger("reports")

TargetTypeLiteral = Literal["RESCUE", "LOST_FOUND", "LOST_FOUND_REPLY", "USER", "ANIMAL"]
ReasonLiteral = Literal["SPAM", "FAKE", "ABUSE", "PRIVACY", "OTHER"]
ReportStatusLiteral = Literal["OPEN", "REVIEWED", "ACTIONED", "DISMISSED"]

class ReportCreate(BaseModel):
    targetType: TargetTypeLiteral
    targetId: str
    reason: ReasonLiteral
    details: Optional[str] = Field(default=None, max_length=1000)

class ReportStatusUpdate(BaseModel):
    status: Literal["REVIEWED", "ACTIONED", "DISMISSED"]

class ReportResponse(BaseModel):
    id: str
    reporterId: Optional[str] = None
    targetType: str
    targetId: str
    reason: str
    details: Optional[str] = None
    status: str
    handledBy: Optional[str] = None
    handledAt: Optional[str] = None
    createdAt: str

def map_report(row: dict) -> dict:
    return {
        "id": row["id"],
        "reporterId": row.get("reporter_id"),
        "targetType": row["target_type"],
        "targetId": row["target_id"],
        "reason": row["reason"],
        "details": row.get("details"),
        "status": row.get("status", "OPEN"),
        "handledBy": row.get("handled_by"),
        "handledAt": row.get("handled_at"),
        "createdAt": row.get("created_at") or "",
    }

@router.post("", response_model=ReportResponse, status_code=status.HTTP_201_CREATED, include_in_schema=False)
@router.post("/", response_model=ReportResponse, status_code=status.HTTP_201_CREATED)
def submit_content_report(req: ReportCreate, current_user: dict = Depends(get_current_user)):
    """Authenticated users can report spam, fake, abuse, or privacy violations.
    Rate limited to 10 reports per hour per user.
    """
    uid = current_user["uid"]

    # Rate limiting: 10 per hour per user
    user_key = f"user:{uid}"
    allowed, retry_after = limiter.is_allowed(user_key, path="/api/reports", method="POST")
    if not allowed:
        raise HTTPException(
            status_code=429,
            detail=f"Too many reports submitted. Please retry in {retry_after} seconds."
        )

    # 1. Validate target existence and self-reporting
    target_type = req.targetType
    target_id = req.targetId.strip()

    if target_type == "USER":
        if target_id == uid:
            raise HTTPException(status_code=422, detail="Cannot report your own account")
        chk = supabase.table("users").select("id").eq("id", target_id).execute()
        if not chk.data:
            raise HTTPException(status_code=404, detail="User target not found")

    elif target_type == "RESCUE":
        chk = supabase.table("rescues").select("id, reporter_id").eq("id", target_id).execute()
        if not chk.data:
            raise HTTPException(status_code=404, detail="Rescue target not found")
        if chk.data[0].get("reporter_id") == uid:
            raise HTTPException(status_code=422, detail="Cannot report your own rescue report")

    elif target_type == "LOST_FOUND":
        chk = supabase.table("lost_and_found").select("id, reporter_id").eq("id", target_id).execute()
        if not chk.data:
            raise HTTPException(status_code=404, detail="Lost & Found target not found")
        if chk.data[0].get("reporter_id") == uid:
            raise HTTPException(status_code=422, detail="Cannot report your own post")

    elif target_type == "LOST_FOUND_REPLY":
        chk = supabase.table("lost_and_found_replies").select("id, user_id").eq("id", target_id).execute()
        if not chk.data:
            raise HTTPException(status_code=404, detail="Reply target not found")
        if chk.data[0].get("user_id") == uid:
            raise HTTPException(status_code=422, detail="Cannot report your own reply")

    elif target_type == "ANIMAL":
        chk = supabase.table("animals").select("id, surrendered_by").eq("id", target_id).execute()
        if not chk.data:
            raise HTTPException(status_code=404, detail="Animal target not found")
        if chk.data[0].get("surrendered_by") == uid:
            raise HTTPException(status_code=422, detail="Cannot report your own animal submission")

    # 2. Check for existing OPEN report to prevent duplicate reports
    existing_open = (
        supabase.table("content_reports")
        .select("id")
        .eq("reporter_id", uid)
        .eq("target_type", target_type)
        .eq("target_id", target_id)
        .eq("status", "OPEN")
        .execute()
    )
    if existing_open.data and len(existing_open.data) > 0:
        raise HTTPException(
            status_code=409,
            detail="You already have an open report pending review for this content"
        )

    insert_data = {
        "reporter_id": uid,
        "target_type": target_type,
        "target_id": target_id,
        "reason": req.reason,
        "details": req.details,
        "status": "OPEN",
        "created_at": datetime.now(timezone.utc).isoformat()
    }

    try:
        res = supabase.table("content_reports").insert(insert_data).execute()
        if not res.data:
            raise HTTPException(status_code=500, detail="Failed to create report")
        created = res.data[0]
        logger.info(f"Report filed: id={created.get('id')} by user={uid} target={target_type}:{target_id}")
        return map_report(created)
    except HTTPException:
        raise
    except Exception as e:
        err_msg = str(e).lower()
        if "unique" in err_msg or "23505" in err_msg or "duplicate" in err_msg:
            raise HTTPException(
                status_code=409,
                detail="You already have an open report pending review for this content"
            )
        logger.error(f"Error creating content report: {e}")
        raise HTTPException(status_code=500, detail="Failed to submit report")

@router.get("", response_model=List[ReportResponse], include_in_schema=False)
@router.get("/", response_model=List[ReportResponse])
def list_content_reports(
    status: Optional[str] = None,
    limit: int = Query(default=50, ge=1, le=100),
    offset: int = Query(default=0, ge=0),
    current_user: dict = Depends(require_roles(["ADMIN"]))
):
    """Admin-only: query moderation reports with optional status filtering and pagination."""
    try:
        query = supabase.table("content_reports").select("*")
        if status:
            query = query.eq("status", status.upper())
        res = (
            query.order("created_at", desc=True)
            .order("id", desc=True)
            .range(offset, offset + limit - 1)
            .execute()
        )
        return [map_report(r) for r in (res.data or [])]
    except Exception as e:
        logger.error(f"Error listing content reports: {e}")
        raise HTTPException(status_code=500, detail="Failed to retrieve content reports")

@router.patch("/{id}", response_model=ReportResponse)
def update_report_status(
    id: str,
    req: ReportStatusUpdate,
    current_user: dict = Depends(require_roles(["ADMIN"]))
):
    """Admin-only: transition a report status to REVIEWED, ACTIONED, or DISMISSED with full audit logging."""
    admin_id = current_user["uid"]
    target_status = req.status.upper()

    existing = supabase.table("content_reports").select("*").eq("id", id).execute()
    if not existing.data:
        raise HTTPException(status_code=404, detail="Report not found")

    report_row = existing.data[0]
    prev_status = report_row.get("status", "OPEN")
    now_iso = datetime.now(timezone.utc).isoformat()

    update_payload = {
        "status": target_status,
        "handled_by": admin_id,
        "handled_at": now_iso
    }

    try:
        res = supabase.table("content_reports").update(update_payload).eq("id", id).execute()
        if not res.data:
            raise HTTPException(status_code=500, detail="Failed to update report")

        updated_row = res.data[0]

        # Audit log for moderation action
        try:
            log_audit_event(
                action="REPORT_STATUS_UPDATED",
                entity_type="CONTENT_REPORT",
                entity_id=id,
                performed_by=admin_id,
                old_value={"status": prev_status},
                new_value={
                    "status": target_status,
                    "target_type": report_row.get("target_type"),
                    "target_id": report_row.get("target_id")
                },
                fail_closed=False
            )
        except Exception as audit_err:
            logger.warning(f"Failed to record audit log for report update: {audit_err}")

        return map_report(updated_row)
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error updating report {id}: {e}")
        raise HTTPException(status_code=500, detail="Failed to update report")
