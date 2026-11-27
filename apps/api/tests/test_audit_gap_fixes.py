import pytest
from unittest.mock import MagicMock
from starlette.testclient import TestClient
from main import app
from auth import get_current_user
import supabase_config
from routers import settings as settings_module
from rate_limiter import limiter

client = TestClient(app)

@pytest.fixture(autouse=True)
def reset_rate_limiter():
    limiter.requests.clear()
    yield
    limiter.requests.clear()

def mock_citizen_user():
    return {
        "uid": "citizen-applicant-1",
        "email": "applicant@example.com",
        "role": "CITIZEN",
        "is_active": True,
        "name": "Citizen Applicant"
    }

def mock_admin_user():
    return {
        "uid": "admin-1",
        "email": "admin@aniresq.org",
        "role": "ADMIN",
        "is_active": True,
        "name": "Super Admin"
    }

def mock_volunteer_user():
    return {
        "uid": "volunteer-1",
        "email": "vol@aniresq.org",
        "role": "VOLUNTEER",
        "is_active": True,
        "name": "Volunteer Bob"
    }

# ============================================================================
# 1. Adoption Application Validation & Duplicate Prevention Tests
# ============================================================================

def test_adoption_unknown_animal_returns_404(monkeypatch):
    """Animal lookup failure must return 404 Not Found, not 500."""
    app.dependency_overrides[get_current_user] = mock_citizen_user
    try:
        mock_table = MagicMock()
        mock_table.select.return_value = mock_table
        mock_table.eq.return_value = mock_table
        # Return empty data indicating animal does not exist
        mock_table.execute.return_value = MagicMock(data=[])
        monkeypatch.setattr(supabase_config.supabase, "table", lambda t: mock_table)

        res = client.post("/api/adoptions/", json={
            "animalId": "nonexistent-animal-id",
            "livingEnvironment": "HOUSE",
            "hasYard": True,
            "hasOtherPets": False,
            "priorPetExperience": "5 years with dogs",
            "familyMembers": 3,
            "hasChildren": False,
            "workSchedule": "Remote",
            "whyAdopt": "Looking for a companion"
        })
        assert res.status_code == 404
        assert "Animal not found" in res.json()["detail"]
    finally:
        app.dependency_overrides.clear()

def test_adoption_unavailable_animal_returns_409(monkeypatch):
    """Attempting to adopt an animal not in AVAILABLE status must return 409 Conflict."""
    app.dependency_overrides[get_current_user] = mock_citizen_user
    try:
        mock_table = MagicMock()
        mock_table.select.return_value = mock_table
        mock_table.eq.return_value = mock_table
        # Animal in PENDING or NOT_READY status
        mock_table.execute.return_value = MagicMock(data=[{
            "id": "animal-pending-1",
            "adoption_status": "PENDING",
            "surrendered_by": None
        }])
        monkeypatch.setattr(supabase_config.supabase, "table", lambda t: mock_table)

        res = client.post("/api/adoptions/", json={
            "animalId": "animal-pending-1",
            "livingEnvironment": "APARTMENT",
            "priorPetExperience": "None",
            "workSchedule": "9-5",
            "whyAdopt": "Want a pet"
        })
        assert res.status_code == 409
        assert "Animal is not available for adoption" in res.json()["detail"]
        assert "PENDING" in res.json()["detail"]
    finally:
        app.dependency_overrides.clear()

def test_adoption_surrendered_by_same_applicant_rejected(monkeypatch):
    """Citizens cannot apply to adopt an animal they previously surrendered."""
    app.dependency_overrides[get_current_user] = mock_citizen_user
    try:
        mock_table = MagicMock()
        mock_table.select.return_value = mock_table
        mock_table.eq.return_value = mock_table
        # Animal is surrendered by the current applicant
        mock_table.execute.return_value = MagicMock(data=[{
            "id": "animal-surrendered-1",
            "adoption_status": "AVAILABLE",
            "surrendered_by": "citizen-applicant-1"
        }])
        monkeypatch.setattr(supabase_config.supabase, "table", lambda t: mock_table)

        res = client.post("/api/adoptions/", json={
            "animalId": "animal-surrendered-1",
            "livingEnvironment": "HOUSE",
            "priorPetExperience": "Owner",
            "workSchedule": "Flexible",
            "whyAdopt": "Want it back"
        })
        assert res.status_code == 400
        assert "Cannot apply to adopt an animal you previously surrendered" in res.json()["detail"]
    finally:
        app.dependency_overrides.clear()

def test_duplicate_adoption_application_returns_409(monkeypatch):
    """Submitting an application when an open application exists must return 409 Conflict."""
    app.dependency_overrides[get_current_user] = mock_citizen_user
    try:
        mock_table = MagicMock()
        mock_table.select.return_value = mock_table
        mock_table.eq.return_value = mock_table
        mock_table.in_.return_value = mock_table

        # 1. Animal check -> AVAILABLE
        # 2. Existing application check -> Found existing application
        mock_table.execute.side_effect = [
            MagicMock(data=[{
                "id": "animal-avail-1",
                "adoption_status": "AVAILABLE",
                "surrendered_by": "someone-else"
            }]),
            MagicMock(data=[{"id": "existing-open-app-1"}])
        ]
        monkeypatch.setattr(supabase_config.supabase, "table", lambda t: mock_table)

        res = client.post("/api/adoptions/", json={
            "animalId": "animal-avail-1",
            "livingEnvironment": "HOUSE",
            "priorPetExperience": "Good",
            "workSchedule": "WFH",
            "whyAdopt": "Love animals"
        })
        assert res.status_code == 409
        assert "An active adoption application for this animal is already under review" in res.json()["detail"]
    finally:
        app.dependency_overrides.clear()

def test_adoption_database_unique_violation_caught_as_409(monkeypatch):
    """Race condition resulting in Postgres 23505 must map to 409 instead of 500."""
    app.dependency_overrides[get_current_user] = mock_citizen_user
    try:
        mock_table = MagicMock()
        mock_table.select.return_value = mock_table
        mock_table.eq.return_value = mock_table
        mock_table.in_.return_value = mock_table

        mock_table.execute.side_effect = [
            # 1. Animal check
            MagicMock(data=[{
                "id": "animal-avail-2",
                "adoption_status": "AVAILABLE",
                "surrendered_by": None
            }]),
            # 2. Duplicate check (simulating concurrent pass)
            MagicMock(data=[]),
            # 3. Insert fails with Postgres 23505 unique violation
            Exception('duplicate key value violates unique constraint "uq_adoption_apps_open" (23505)')
        ]
        mock_table.insert.return_value = mock_table
        monkeypatch.setattr(supabase_config.supabase, "table", lambda t: mock_table)

        res = client.post("/api/adoptions/", json={
            "animalId": "animal-avail-2",
            "livingEnvironment": "HOUSE",
            "priorPetExperience": "Good",
            "workSchedule": "WFH",
            "whyAdopt": "Love animals"
        })
        assert res.status_code == 409
        assert "An active adoption application for this animal is already under review" in res.json()["detail"]
    finally:
        app.dependency_overrides.clear()

# ============================================================================
# 2. System Settings & Runtime Policy Wiring Tests
# ============================================================================

def test_system_settings_read_write_admin_only_and_audited(monkeypatch):
    """Admin settings update must write to DB, update runtime cache, and write audit log."""
    app.dependency_overrides[get_current_user] = mock_admin_user
    audit_events = []

    def mock_audit(**kwargs):
        audit_events.append(kwargs)

    monkeypatch.setattr(settings_module, "log_audit_event", mock_audit)

    mock_table = MagicMock()
    mock_table.select.return_value = mock_table
    mock_table.upsert.return_value = mock_table
    mock_table.execute.return_value = MagicMock(data=[])
    monkeypatch.setattr(supabase_config.supabase, "table", lambda t: mock_table)

    try:
        # Patch system settings
        payload = {
            "defaultDispatchRadiusKm": 30,
            "maxBroadcastCeilingKm": 150,
            "autoAlertHighSeverity": False,
            "autoDispatchEnabled": False
        }
        res = client.patch("/api/settings", json=payload)
        assert res.status_code == 200
        data = res.json()
        assert data["defaultDispatchRadiusKm"] == 30
        assert data["maxBroadcastCeilingKm"] == 150
        assert data["autoAlertHighSeverity"] is False
        assert data["autoDispatchEnabled"] is False

        # Verify audit event was logged
        assert len(audit_events) == 1
        assert audit_events[0]["action"] == "SYSTEM_SETTINGS_UPDATE"
        assert audit_events[0]["performed_by"] == "admin-1"
        assert audit_events[0]["new_value"]["autoDispatchEnabled"] is False

        # Verify runtime getter reflects updated values
        assert settings_module.get_system_setting("defaultDispatchRadiusKm") == 30
        assert settings_module.get_system_setting("autoAlertHighSeverity") is False
        assert settings_module.get_system_setting("autoDispatchEnabled") is False
    finally:
        # Reset runtime settings back to defaults
        settings_module._RUNTIME_SETTINGS.update(settings_module.DEFAULT_SETTINGS)
        app.dependency_overrides.clear()

def test_volunteer_self_assign_disabled_when_policy_off(monkeypatch):
    """When autoDispatchEnabled is false, volunteer direct self-assignment must return 403."""
    app.dependency_overrides[get_current_user] = mock_volunteer_user
    settings_module._RUNTIME_SETTINGS["autoDispatchEnabled"] = False

    try:
        mock_table = MagicMock()
        mock_table.select.return_value = mock_table
        mock_table.eq.return_value = mock_table
        # Return unassigned open rescue
        mock_table.execute.return_value = MagicMock(data=[{
            "id": "rescue-unassigned-1",
            "status": "PENDING",
            "assigned_to": None,
            "reporter_id": "citizen-x"
        }])
        monkeypatch.setattr(supabase_config.supabase, "table", lambda t: mock_table)

        res = client.post("/api/rescues/rescue-unassigned-1/assign", json={
            "volunteerId": "volunteer-1",
            "volunteerName": "Volunteer Bob"
        })
        assert res.status_code == 403
        assert "Volunteer direct claim is currently disabled by system policy" in res.json()["detail"]
    finally:
        settings_module._RUNTIME_SETTINGS["autoDispatchEnabled"] = True
        app.dependency_overrides.clear()

# ============================================================================
# 3. Cascade Deletes & Null Reporter/Applicant Resilience Tests
# ============================================================================

def test_rescue_with_null_reporter_id_renders_safely(monkeypatch):
    """Rescues where reporter_id is NULL (user deleted) must return 200 with reporterId as None."""
    app.dependency_overrides[get_current_user] = mock_admin_user
    try:
        mock_table = MagicMock()
        mock_table.select.return_value = mock_table
        mock_table.order.return_value = mock_table
        mock_table.range.return_value = mock_table
        mock_table.execute.return_value = MagicMock(data=[{
            "id": "rescue-null-reporter",
            "title": "Injured cat",
            "description": "Found on highway",
            "species": "CAT",
            "severity": "HIGH",
            "status": "PENDING",
            "reporter_id": None,
            "assigned_to": None,
            "latitude": 13.0,
            "longitude": 77.6,
            "address": "Hebbal Flyover",
            "images": [],
            "created_at": "2026-11-20T10:00:00Z",
            "updated_at": "2026-11-20T10:00:00Z",
        }])
        monkeypatch.setattr(supabase_config.supabase, "table", lambda t: mock_table)

        res = client.get("/api/rescues/")
        assert res.status_code == 200
        items = res.json()
        assert len(items) == 1
        assert items[0]["reporterId"] is None
        assert items[0]["title"] == "Injured cat"
    finally:
        app.dependency_overrides.clear()

def test_lost_found_with_null_reporter_renders_safely(monkeypatch):
    """Lost and found posts with null reporter_id must return 200 with reporterId as None."""
    try:
        mock_table = MagicMock()
        mock_table.select.return_value = mock_table
        mock_table.order.return_value = mock_table
        mock_table.range.return_value = mock_table
        mock_table.execute.return_value = MagicMock(data=[{
            "id": "lf-null-reporter",
            "type": "LOST",
            "title": "Lost Husky",
            "description": "Blue collar",
            "species": "DOG",
            "breed": "Husky",
            "color": "Grey/White",
            "contact_phone": "[Deleted User]",
            "contact_email": None,
            "latitude": 12.9,
            "longitude": 77.5,
            "last_seen_address": "Indiranagar",
            "last_seen_date": "2026-11-25T10:00:00Z",
            "reporter_id": None,
            "images": [],
            "status": "ACTIVE",
            "created_at": "2026-11-25T10:00:00Z",
            "updated_at": None
        }])
        monkeypatch.setattr(supabase_config.supabase, "table", lambda t: mock_table)

        res = client.get("/api/lostfound/")
        assert res.status_code == 200
        items = res.json()
        assert len(items) == 1
        assert items[0]["reporterId"] is None
        assert items[0]["userId"] is None
    finally:
        app.dependency_overrides.clear()
