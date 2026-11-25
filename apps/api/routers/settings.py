import logging
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field

from auth import require_roles
from supabase_config import supabase
from .audit import log_audit_event

router = APIRouter(prefix="/api/settings", tags=["settings"])
logger = logging.getLogger("settings")

class SystemSettings(BaseModel):
    defaultDispatchRadiusKm: int = Field(default=15, ge=1, le=200)
    maxBroadcastCeilingKm: int = Field(default=100, ge=10, le=500)
    autoAlertHighSeverity: bool = True
    autoDispatchEnabled: bool = True
    appendOnlyAuditEnforced: bool = True
    directMutationProtection: bool = True
    platformVersion: str = "1.0.0"
    environment: str = "Localhost Environment"
    activeAdminCount: int = 1
    totalOperatorsCount: int = 0

class SystemSettingsUpdate(BaseModel):
    defaultDispatchRadiusKm: Optional[int] = Field(default=None, ge=1, le=200)
    maxBroadcastCeilingKm: Optional[int] = Field(default=None, ge=10, le=500)
    autoAlertHighSeverity: Optional[bool] = None
    autoDispatchEnabled: Optional[bool] = None

# Active system runtime settings state
_RUNTIME_SETTINGS = {
    "defaultDispatchRadiusKm": 15,
    "maxBroadcastCeilingKm": 100,
    "autoAlertHighSeverity": True,
    "autoDispatchEnabled": True,
}

@router.get("", response_model=SystemSettings)
def get_system_settings(admin_user: dict = Depends(require_roles(["ADMIN"]))):
    """Admin-only endpoint to retrieve global system configuration and telemetry."""
    try:
        users_res = supabase.table("users").select("id, role").execute()
        user_rows = users_res.data or []
        
        admin_count = sum(1 for u in user_rows if u.get("role") == "ADMIN")
        operators_count = sum(1 for u in user_rows if u.get("role") in ["VOLUNTEER", "NGO", "SHELTER", "VET"])

        return SystemSettings(
            defaultDispatchRadiusKm=_RUNTIME_SETTINGS["defaultDispatchRadiusKm"],
            maxBroadcastCeilingKm=_RUNTIME_SETTINGS["maxBroadcastCeilingKm"],
            autoAlertHighSeverity=_RUNTIME_SETTINGS["autoAlertHighSeverity"],
            autoDispatchEnabled=_RUNTIME_SETTINGS["autoDispatchEnabled"],
            appendOnlyAuditEnforced=True,
            directMutationProtection=True,
            platformVersion="1.0.0",
            environment="Localhost Environment",
            activeAdminCount=max(admin_count, 1),
            totalOperatorsCount=operators_count,
        )
    except Exception as e:
        logger.error(f"Error reading system settings: {e}")
        raise HTTPException(status_code=500, detail="Failed to retrieve system settings")

@router.patch("", response_model=SystemSettings)
def update_system_settings(payload: SystemSettingsUpdate, admin_user: dict = Depends(require_roles(["ADMIN"]))):
    """Admin-only endpoint to update global dispatch, broadcast, and routing configurations."""
    try:
        old_state = dict(_RUNTIME_SETTINGS)
        
        if payload.defaultDispatchRadiusKm is not None:
            _RUNTIME_SETTINGS["defaultDispatchRadiusKm"] = payload.defaultDispatchRadiusKm
        if payload.maxBroadcastCeilingKm is not None:
            _RUNTIME_SETTINGS["maxBroadcastCeilingKm"] = payload.maxBroadcastCeilingKm
        if payload.autoAlertHighSeverity is not None:
            _RUNTIME_SETTINGS["autoAlertHighSeverity"] = payload.autoAlertHighSeverity
        if payload.autoDispatchEnabled is not None:
            _RUNTIME_SETTINGS["autoDispatchEnabled"] = payload.autoDispatchEnabled

        log_audit_event(
            action="SYSTEM_SETTINGS_UPDATE",
            entity_type="SYSTEM",
            entity_id="global_settings",
            performed_by=admin_user["uid"],
            old_value=old_state,
            new_value=_RUNTIME_SETTINGS,
        )

        users_res = supabase.table("users").select("id, role").execute()
        user_rows = users_res.data or []
        admin_count = sum(1 for u in user_rows if u.get("role") == "ADMIN")
        operators_count = sum(1 for u in user_rows if u.get("role") in ["VOLUNTEER", "NGO", "SHELTER", "VET"])

        return SystemSettings(
            defaultDispatchRadiusKm=_RUNTIME_SETTINGS["defaultDispatchRadiusKm"],
            maxBroadcastCeilingKm=_RUNTIME_SETTINGS["maxBroadcastCeilingKm"],
            autoAlertHighSeverity=_RUNTIME_SETTINGS["autoAlertHighSeverity"],
            autoDispatchEnabled=_RUNTIME_SETTINGS["autoDispatchEnabled"],
            appendOnlyAuditEnforced=True,
            directMutationProtection=True,
            platformVersion="1.0.0",
            environment="Localhost Environment",
            activeAdminCount=max(admin_count, 1),
            totalOperatorsCount=operators_count,
        )
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error updating system settings: {e}")
        raise HTTPException(status_code=500, detail="Failed to update system settings")
