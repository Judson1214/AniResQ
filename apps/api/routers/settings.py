import os
import logging
from datetime import datetime, timezone
from typing import Optional, Any
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

DEFAULT_SETTINGS = {
    "defaultDispatchRadiusKm": 15,
    "maxBroadcastCeilingKm": 100,
    "autoAlertHighSeverity": True,
    "autoDispatchEnabled": True,
}

_RUNTIME_SETTINGS = dict(DEFAULT_SETTINGS)

def get_system_setting(key: str, default: Any = None) -> Any:
    """Read active runtime system setting with fallback."""
    val = _RUNTIME_SETTINGS.get(key)
    if val is not None:
        return val
    return default

def sync_settings_from_db():
    """Sync runtime settings cache from public.system_settings."""
    try:
        res = supabase.table("system_settings").select("key, value").execute()
        if res.data:
            for row in res.data:
                k = row.get("key")
                v = row.get("value")
                if k in _RUNTIME_SETTINGS and v is not None:
                    _RUNTIME_SETTINGS[k] = v
    except Exception as e:
        logger.warning(f"Failed to sync system_settings from db: {e}")

@router.get("", response_model=SystemSettings)
@router.get("/", response_model=SystemSettings, include_in_schema=False)
def get_system_settings(admin_user: dict = Depends(require_roles(["ADMIN"]))):
    """Admin-only endpoint to retrieve global system configuration and telemetry from database."""
    try:
        sync_settings_from_db()

        users_res = supabase.table("users").select("id, role").execute()
        user_rows = users_res.data or []
        
        admin_count = sum(1 for u in user_rows if u.get("role") == "ADMIN")
        operators_count = sum(1 for u in user_rows if u.get("role") in ["VOLUNTEER", "NGO", "SHELTER", "VET"])

        return SystemSettings(
            defaultDispatchRadiusKm=int(_RUNTIME_SETTINGS.get("defaultDispatchRadiusKm", 15)),
            maxBroadcastCeilingKm=int(_RUNTIME_SETTINGS.get("maxBroadcastCeilingKm", 100)),
            autoAlertHighSeverity=bool(_RUNTIME_SETTINGS.get("autoAlertHighSeverity", True)),
            autoDispatchEnabled=bool(_RUNTIME_SETTINGS.get("autoDispatchEnabled", True)),
            appendOnlyAuditEnforced=True,
            directMutationProtection=True,
            platformVersion="1.0.0",
            environment=os.getenv("ENV", "Localhost Environment"),
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
        sync_settings_from_db()
        old_state = dict(_RUNTIME_SETTINGS)
        updates = {}

        if payload.defaultDispatchRadiusKm is not None:
            updates["defaultDispatchRadiusKm"] = payload.defaultDispatchRadiusKm
            _RUNTIME_SETTINGS["defaultDispatchRadiusKm"] = payload.defaultDispatchRadiusKm
        if payload.maxBroadcastCeilingKm is not None:
            updates["maxBroadcastCeilingKm"] = payload.maxBroadcastCeilingKm
            _RUNTIME_SETTINGS["maxBroadcastCeilingKm"] = payload.maxBroadcastCeilingKm
        if payload.autoAlertHighSeverity is not None:
            updates["autoAlertHighSeverity"] = payload.autoAlertHighSeverity
            _RUNTIME_SETTINGS["autoAlertHighSeverity"] = payload.autoAlertHighSeverity
        if payload.autoDispatchEnabled is not None:
            updates["autoDispatchEnabled"] = payload.autoDispatchEnabled
            _RUNTIME_SETTINGS["autoDispatchEnabled"] = payload.autoDispatchEnabled

        if updates:
            now_iso = datetime.now(timezone.utc).isoformat()
            for key, val in updates.items():
                try:
                    supabase.table("system_settings").upsert({
                        "key": key,
                        "value": val,
                        "updated_by": admin_user["uid"],
                        "updated_at": now_iso,
                    }).execute()
                except Exception as db_err:
                    logger.warning(f"Failed to persist setting '{key}' to database: {db_err}")

        new_state = dict(_RUNTIME_SETTINGS)

        log_audit_event(
            action="SYSTEM_SETTINGS_UPDATE",
            entity_type="SYSTEM",
            entity_id="global_settings",
            performed_by=admin_user["uid"],
            old_value=old_state,
            new_value=new_state,
        )

        users_res = supabase.table("users").select("id, role").execute()
        user_rows = users_res.data or []
        admin_count = sum(1 for u in user_rows if u.get("role") == "ADMIN")
        operators_count = sum(1 for u in user_rows if u.get("role") in ["VOLUNTEER", "NGO", "SHELTER", "VET"])

        return SystemSettings(
            defaultDispatchRadiusKm=int(_RUNTIME_SETTINGS.get("defaultDispatchRadiusKm", 15)),
            maxBroadcastCeilingKm=int(_RUNTIME_SETTINGS.get("maxBroadcastCeilingKm", 100)),
            autoAlertHighSeverity=bool(_RUNTIME_SETTINGS.get("autoAlertHighSeverity", True)),
            autoDispatchEnabled=bool(_RUNTIME_SETTINGS.get("autoDispatchEnabled", True)),
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
