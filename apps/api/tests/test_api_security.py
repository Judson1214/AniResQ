import pytest
from unittest.mock import MagicMock
from starlette.testclient import TestClient
from main import app
from auth import get_current_user
import supabase_config

client = TestClient(app)

def test_root_endpoint():
    response = client.get("/")
    assert response.status_code == 200
    assert response.json()["status"] == "healthy"

def test_users_api_requires_auth():
    # Unauthenticated GET
    res_get = client.get("/api/users/non-existent-uid")
    assert res_get.status_code in [401, 403]

    # Unauthenticated POST
    res_post = client.post("/api/users", json={
        "uid": "test-uid",
        "email": "hacker@test.com",
        "displayName": "Hacker",
        "role": "ADMIN"
    })
    assert res_post.status_code in [401, 403]

    # Unauthenticated PATCH
    res_patch = client.patch("/api/users/test-uid", json={"displayName": "Hacker"})
    assert res_patch.status_code in [401, 403]

def test_rescues_mutations_require_auth():
    # Unauthenticated POST rescue
    res_post = client.post("/api/rescues/", json={
        "title": "Injured dog",
        "description": "Found near street",
        "severity": "CRITICAL",
        "species": "DOG",
        "location": {"latitude": 12.34, "longitude": 56.78},
        "address": "Main Street"
    })
    assert res_post.status_code in [401, 403]

    # Unauthenticated status patch
    res_status = client.patch("/api/rescues/fake-id/status", json={"status": "RESOLVED"})
    assert res_status.status_code in [401, 403]

    # Unauthenticated assign
    res_assign = client.post("/api/rescues/fake-id/assign", json={"volunteerId": "v1", "volunteerName": "Vol"})
    assert res_assign.status_code in [401, 403]

    # Unauthenticated delete
    res_del = client.delete("/api/rescues/fake-id")
    assert res_del.status_code in [401, 403]

def test_lostfound_mutations_require_auth():
    # Unauthenticated POST
    res_post = client.post("/api/lostfound/", json={
        "type": "LOST",
        "title": "Lost dog",
        "description": "Small dog",
        "species": "DOG",
        "color": "brown",
        "contactPhone": "1234567890",
        "location": {"latitude": 1.0, "longitude": 2.0},
        "lastSeenAddress": "Park",
        "lastSeenDate": "2026-10-31"
    })
    assert res_post.status_code in [401, 403]

    # Unauthenticated status patch
    res_status = client.patch("/api/lostfound/fake-id/status", json={"status": "RESOLVED"})
    assert res_status.status_code in [401, 403]

    # Unauthenticated delete
    res_del = client.delete("/api/lostfound/fake-id")
    assert res_del.status_code in [401, 403]

def test_animals_mutations_require_staff_auth():
    # Regular citizen mock
    def mock_citizen_user():
        return {
            "uid": "citizen-1",
            "email": "citizen@test.com",
            "name": "Citizen Jane",
            "role": "CITIZEN"
        }
    
    app.dependency_overrides[get_current_user] = mock_citizen_user
    try:
        # A CITIZEN should NOT be allowed to directly insert an animal into shelter inventory
        res = client.post("/api/animals/", json={
            "name": "Buddy",
            "species": "DOG",
            "description": "Friendly dog"
        })
        assert res.status_code == 403
    finally:
        app.dependency_overrides.clear()

def test_latitude_longitude_range_validation():
    def mock_user():
        return {"uid": "user-1", "email": "user@test.com", "name": "User", "role": "CITIZEN"}
    
    app.dependency_overrides[get_current_user] = mock_user
    try:
        # Latitude exceeds 90 degrees
        res_lat = client.post("/api/rescues/", json={
            "title": "Out of bounds latitude",
            "description": "Invalid coordinates",
            "severity": "LOW",
            "species": "DOG",
            "location": {"latitude": 95.0, "longitude": 10.0},
            "address": "North Pole"
        })
        assert res_lat.status_code == 422

        # Longitude exceeds 180 degrees
        res_lon = client.post("/api/rescues/", json={
            "title": "Out of bounds longitude",
            "description": "Invalid coordinates",
            "severity": "LOW",
            "species": "DOG",
            "location": {"latitude": 10.0, "longitude": 185.0},
            "address": "Date line"
        })
        assert res_lon.status_code == 422
    finally:
        app.dependency_overrides.clear()

def test_pagination_query_parameters(monkeypatch):
    # Mock Supabase table select so tests succeed in offline CI runners
    mock_execute = MagicMock(return_value=MagicMock(data=[]))
    mock_query = MagicMock()
    mock_query.select.return_value = mock_query
    mock_query.order.return_value = mock_query
    mock_query.range.return_value = mock_query
    mock_query.execute = mock_execute
    mock_table = MagicMock(return_value=mock_query)
    monkeypatch.setattr(supabase_config.supabase, "table", mock_table)

    # Verify pagination parameters are accepted and validated
    res_valid = client.get("/api/rescues/?limit=10&offset=20")
    assert res_valid.status_code == 200

    # Limit must be >= 1
    res_invalid_limit = client.get("/api/rescues/?limit=0")
    assert res_invalid_limit.status_code == 422

    # Offset must be >= 0
    res_invalid_offset = client.get("/api/rescues/?offset=-5")
    assert res_invalid_offset.status_code == 422

def test_validation_exception_does_not_leak_body():
    def mock_user():
        return {"uid": "user-1", "email": "user@test.com", "name": "User", "role": "CITIZEN"}
    
    app.dependency_overrides[get_current_user] = mock_user
    try:
        # Trigger 422 with invalid payload as authenticated user
        res = client.post("/api/rescues/", json={"invalid": "payload"})
        assert res.status_code == 422
        data = res.json()
        assert "body" not in data # Verified: sensitive request body not leaked back
    finally:
        app.dependency_overrides.clear()

def test_user_role_assignment_admin_only(monkeypatch):
    # 1. Citizen cannot update role (403)
    app.dependency_overrides[get_current_user] = lambda: {
        "uid": "citizen-1", "email": "cit@test.com", "name": "Cit", "role": "CITIZEN"
    }
    try:
        res_cit = client.patch("/api/users/target-user/role", json={"role": "ADMIN"})
        assert res_cit.status_code == 403
    finally:
        app.dependency_overrides.clear()

    # 2. Admin with invalid role receives 422
    app.dependency_overrides[get_current_user] = lambda: {
        "uid": "admin-1", "email": "admin@test.com", "name": "Admin", "role": "ADMIN"
    }
    try:
        res_invalid = client.patch("/api/users/target-user/role", json={"role": "SUPERUSER"})
        assert res_invalid.status_code == 422

        # 3. Admin with valid role succeeds (mock Supabase response)
        mock_execute = MagicMock(return_value=MagicMock(data=[{"id": "target-user", "display_name": "Target"}]))
        mock_query = MagicMock()
        mock_query.update.return_value = mock_query
        mock_query.eq.return_value = mock_query
        mock_query.execute = mock_execute
        monkeypatch.setattr(supabase_config.supabase, "table", MagicMock(return_value=mock_query))

        res_ok = client.patch("/api/users/target-user/role", json={"role": "VOLUNTEER"})
        assert res_ok.status_code == 200
        assert res_ok.json()["role"] == "VOLUNTEER"
    finally:
        app.dependency_overrides.clear()

def test_citizen_can_surrender_animal(monkeypatch):
    app.dependency_overrides[get_current_user] = lambda: {
        "uid": "citizen-1", "email": "cit@test.com", "name": "Citizen Jane", "role": "CITIZEN"
    }
    try:
        # Invalid species receives 422
        res_inv = client.post("/api/animals/surrender", json={
            "name": "Rex",
            "species": "DRAGON",
            "description": "Found pet"
        })
        assert res_inv.status_code == 422

        # Valid surrender succeeds and sets NOT_READY status with surrendered_by
        mock_animal_record = {
            "id": "animal-123",
            "name": "Rex",
            "species": "DOG",
            "breed": "Unknown",
            "age_estimate": "2 years",
            "gender": "UNKNOWN",
            "weight": None,
            "health_status": "HEALTHY",
            "adoption_status": "NOT_READY",
            "description": "Found pet",
            "vaccinations": [],
            "is_neutered": False,
            "special_needs": None,
            "shelter_id": None,
            "surrendered_by": "citizen-1",
            "images": [],
            "created_at": "2026-11-01T00:00:00Z",
            "updated_at": "2026-11-01T00:00:00Z",
        }
        mock_execute = MagicMock(return_value=MagicMock(data=[mock_animal_record]))
        mock_query = MagicMock()
        mock_query.insert.return_value = mock_query
        mock_query.execute = mock_execute
        monkeypatch.setattr(supabase_config.supabase, "table", MagicMock(return_value=mock_query))

        res_surrender = client.post("/api/animals/surrender", json={
            "name": "Rex",
            "species": "DOG",
            "ageEstimate": "2 years",
            "description": "Found pet",
            "reason": "Moving abroad"
        })
        assert res_surrender.status_code == 201
        assert res_surrender.json()["adoptionStatus"] == "NOT_READY"
        assert res_surrender.json()["surrenderedBy"] == "citizen-1"
    finally:
        app.dependency_overrides.clear()

def test_photo_url_validation():
    app.dependency_overrides[get_current_user] = lambda: {
        "uid": "citizen-1", "email": "cit@test.com", "name": "Citizen", "role": "CITIZEN"
    }
    try:
        # External URL rejected with 422
        res_ext = client.post("/api/rescues/", json={
            "title": "Injured animal",
            "description": "Needs help",
            "severity": "HIGH",
            "species": "CAT",
            "location": {"latitude": 10.0, "longitude": 20.0},
            "address": "Street",
            "photoUrls": ["https://malicious-external-site.com/exploit.png"]
        })
        assert res_ext.status_code == 422
    finally:
        app.dependency_overrides.clear()

def test_post_users_preserves_token_email(monkeypatch):
    # Ensure client cannot forge another email in POST /api/users
    app.dependency_overrides[get_current_user] = lambda: {
        "uid": "user-real-uid", "email": "real@domain.com", "name": "Real User", "role": "CITIZEN"
    }
    try:
        mock_query = MagicMock()
        mock_query.select.return_value = mock_query
        mock_query.eq.return_value = mock_query
        mock_query.execute.return_value = MagicMock(data=[{"role": "CITIZEN", "email": "real@domain.com"}])
        mock_query.upsert.return_value = mock_query
        
        captured_data = {}
        def fake_upsert(data):
            captured_data.update(data)
            return mock_query
        mock_query.upsert.side_effect = fake_upsert
        
        monkeypatch.setattr(supabase_config.supabase, "table", MagicMock(return_value=mock_query))

        res = client.post("/api/users", json={
            "uid": "user-real-uid",
            "email": "forged_victim@domain.com",
            "displayName": "User",
        })
        assert res.status_code == 200
        # Verified: backend enforces token email, ignoring forged body email
        assert captured_data.get("email") == "real@domain.com"
    finally:
        app.dependency_overrides.clear()

def test_demote_last_admin_prevented(monkeypatch):
    app.dependency_overrides[get_current_user] = lambda: {
        "uid": "sole-admin-id", "email": "admin@domain.com", "name": "Sole Admin", "role": "ADMIN"
    }
    try:
        mock_query = MagicMock()
        mock_query.select.return_value = mock_query
        mock_query.eq.return_value = mock_query
        mock_query.execute.return_value = MagicMock(data=[{"id": "sole-admin-id"}], count=1)
        monkeypatch.setattr(supabase_config.supabase, "table", MagicMock(return_value=mock_query))

        # Trying to demote themselves when count == 1 should raise 400
        res = client.patch("/api/users/sole-admin-id/role", json={"role": "CITIZEN"})
        assert res.status_code == 400
        assert "Cannot demote the last administrator" in res.json()["detail"]
    finally:
        app.dependency_overrides.clear()
