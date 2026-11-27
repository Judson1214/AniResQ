import logging
from typing import Optional, List, Any, Dict
from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel
from supabase_config import supabase
from auth import require_roles

router = APIRouter(prefix="/api/audit-logs", tags=["audit"])
audit_alias = APIRouter(prefix="/api/audit", tags=["audit"])
logger = logging.getLogger("audit")

class AuditLogResponse(BaseModel):
    id: str
    action: str
    entityType: str
    entityId: str
    performedBy: str
    oldValue: Optional[Dict[str, Any]] = None
    newValue: Optional[Dict[str, Any]] = None
    createdAt: str

def log_audit_event(
    action: str,
    entity_type: str,
    entity_id: str,
    performed_by: str,
    old_value: Optional[Dict[str, Any]] = None,
    new_value: Optional[Dict[str, Any]] = None,
    fail_closed: bool = False,
) -> None:
    """Helper to record audit events in the database using service_role.
    When fail_closed=True (e.g. for security role clearance modifications), raises HTTPException(500)
    if the audit entry cannot be persisted, guaranteeing no untracked privilege mutations.
    """
    audit_entry = {
        "action": action,
        "entity_type": entity_type,
        "entity_id": str(entity_id),
        "performed_by": str(performed_by),
        "old_value": old_value,
        "new_value": new_value,
    }
    try:
        supabase.table("audit_logs").insert(audit_entry).execute()
        logger.info(f"AUDIT [{action}]: {entity_type} {entity_id} by {performed_by}")
    except Exception as err:
        logger.error(
            f"SECURITY CRITICAL: Could not persist audit record to database for {action} on {entity_type} {entity_id}: {err}"
        )
        if fail_closed:
            raise HTTPException(
                status_code=500,
                detail=f"Security audit logging failed for {action}. Action was aborted to ensure an append-only audit trail."
            )
        if "PGRST205" in str(err) or "could not find the table 'public.audit_logs'" in str(err).lower():
            logger.warning(f"audit_logs table missing from database schema cache; skipping persistence for {action}")
            return

def map_audit_log(row: dict) -> dict:
    return {
        "id": row["id"],
        "action": row["action"],
        "entityType": row.get("entity_type") or row.get("entityType") or "",
        "entityId": row.get("entity_id") or row.get("entityId") or "",
        "performedBy": row.get("performed_by") or row.get("performedBy") or "",
        "oldValue": row.get("old_value") if "old_value" in row else row.get("oldValue"),
        "newValue": row.get("new_value") if "new_value" in row else row.get("newValue"),
        "createdAt": row.get("created_at") or row.get("createdAt") or "",
    }

@router.get("", response_model=List[AuditLogResponse])
@router.get("/", response_model=List[AuditLogResponse], include_in_schema=False)
@audit_alias.get("", response_model=List[AuditLogResponse], include_in_schema=False)
@audit_alias.get("/", response_model=List[AuditLogResponse], include_in_schema=False)
def list_audit_logs(
    action: Optional[str] = None,
    entity_type: Optional[str] = None,
    performed_by: Optional[str] = None,
    limit: int = Query(default=50, ge=1, le=100),
    offset: int = Query(default=0, ge=0),
    user: dict = Depends(require_roles(["ADMIN"])),
):
    """Admin-only endpoint to retrieve append-only audit logs."""
    try:
        query = supabase.table("audit_logs").select("*")
        if action:
            query = query.eq("action", action.upper())
        if entity_type:
            query = query.eq("entity_type", entity_type.upper())
        if performed_by:
            query = query.eq("performed_by", performed_by)

        res = query.order("created_at", desc=True).order("id", desc=True).range(offset, offset + limit - 1).execute()
        return [map_audit_log(row) for row in res.data]
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error fetching audit logs: {e}")
        raise HTTPException(status_code=500, detail="Failed to retrieve audit logs")
