import pytest
from starlette.testclient import TestClient
from main import app
from auth import get_current_user

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

def test_settings_get_admin_success():
    app.dependency_overrides[get_current_user] = mock_admin_user
    res = client.get("/api/settings")
    assert res.status_code == 200
    data = res.json()
    assert "defaultDispatchRadiusKm" in data or "default_dispatch_radius_km" in data
    assert "autoAlertHighSeverity" in data or "auto_alert_high_severity" in data
    app.dependency_overrides.clear()

def test_settings_patch_admin_success():
    app.dependency_overrides[get_current_user] = mock_admin_user
    payload = {
        "defaultDispatchRadiusKm": 25.0,
        "autoDispatchEnabled": False
    }
    res = client.patch("/api/settings", json=payload)
    assert res.status_code == 200
    data = res.json()
    assert data.get("defaultDispatchRadiusKm") == 25.0 or data.get("default_dispatch_radius_km") == 25.0
    app.dependency_overrides.clear()
