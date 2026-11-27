from unittest.mock import MagicMock
from starlette.testclient import TestClient
from main import app
from auth import get_current_user
import supabase_config

client = TestClient(app)

def mock_admin_user():
    return {
        "uid": "admin-uid-1234",
        "email": "admin@example.com",
        "role": "ADMIN",
        "is_active": True,
    }

def mock_volunteer_user():
    return {
        "uid": "vol-uid-5678",
        "email": "volunteer@example.com",
        "role": "VOLUNTEER",
        "is_active": True,
    }

def test_settings_get_unauthorized():
    app.dependency_overrides.clear()
    res = client.get("/api/settings")
    assert res.status_code in (401, 403)

def test_settings_get_non_admin_forbidden():
    app.dependency_overrides[get_current_user] = mock_volunteer_user
    res = client.get("/api/settings")
    assert res.status_code == 403
    app.dependency_overrides.clear()

def test_settings_get_admin_success(monkeypatch):
    mock_users = MagicMock()
    mock_users.select.return_value = mock_users
    mock_users.execute.return_value = MagicMock(data=[
        {"id": "u-1", "role": "ADMIN"},
        {"id": "u-2", "role": "VOLUNTEER"},
    ])
    monkeypatch.setattr(supabase_config.supabase, "table", lambda t: mock_users)

    app.dependency_overrides[get_current_user] = mock_admin_user
    try:
        res = client.get("/api/settings")
        assert res.status_code == 200
        data = res.json()
        assert "defaultDispatchRadiusKm" in data or "default_dispatch_radius_km" in data
        assert "autoAlertHighSeverity" in data or "auto_alert_high_severity" in data
    finally:
        app.dependency_overrides.clear()

def test_settings_patch_admin_success(monkeypatch):
    mock_table = MagicMock()
    mock_table.select.return_value = mock_table
    mock_table.insert.return_value = mock_table
    mock_table.execute.return_value = MagicMock(data=[])
    monkeypatch.setattr(supabase_config.supabase, "table", lambda t: mock_table)

    app.dependency_overrides[get_current_user] = mock_admin_user
    payload = {
        "defaultDispatchRadiusKm": 25.0,
        "autoDispatchEnabled": False
    }
    try:
        res = client.patch("/api/settings", json=payload)
        assert res.status_code == 200
        data = res.json()
        assert data.get("defaultDispatchRadiusKm") == 25.0 or data.get("default_dispatch_radius_km") == 25.0
    finally:
        app.dependency_overrides.clear()
