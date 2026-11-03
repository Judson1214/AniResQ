import pytest
import time
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
        # External URL containing /uploads/ substring rejected with 422
        res_evil_uploads = client.post("/api/rescues/", json={
            "title": "Injured animal",
            "description": "Needs help",
            "severity": "HIGH",
            "species": "CAT",
            "location": {"latitude": 10.0, "longitude": 20.0},
            "address": "Street",
            "photoUrls": ["https://evil.example/uploads/x.jpg"]
        })
        assert res_evil_uploads.status_code == 422

        # Substring in query param rejected with 422
        res_evil_query = client.post("/api/rescues/", json={
            "title": "Injured animal",
            "description": "Needs help",
            "severity": "HIGH",
            "species": "CAT",
            "location": {"latitude": 10.0, "longitude": 20.0},
            "address": "Street",
            "photoUrls": ["https://evil.example/a?x=/storage/v1/object/public/uploads/"]
        })
        assert res_evil_query.status_code == 422

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

def test_shared_validators_direct():
    from validators import PREFIX, validate_photo_urls, validate_avatar_url

    # Prefix must be formatted with the Supabase uploads bucket path
    assert PREFIX.endswith("/storage/v1/object/public/uploads/")

    # Rejection of substrings on evil domains
    for evil_url in [
        "https://evil.example/uploads/x.jpg",
        "https://evil.example/a?x=/storage/v1/object/public/uploads/",
        "https://malicious-external-site.com/exploit.png",
        "http://evil.com/storage/v1/object/public/uploads/test.png",
    ]:
        with pytest.raises(Exception) as exc_info:
            validate_photo_urls([evil_url])
        assert exc_info.value.status_code == 422

        with pytest.raises(Exception) as exc_info_avatar:
            validate_avatar_url(evil_url)
        assert exc_info_avatar.value.status_code == 422

    # Valid URLs starting with PREFIX succeed
    valid_url = f"{PREFIX}rescues/rescue-1.jpg"
    assert validate_photo_urls([valid_url]) == [valid_url]
    assert validate_avatar_url(valid_url) == valid_url

    # Empty / None avatar URL is safely passed through
    assert validate_avatar_url(None) is None
    assert validate_avatar_url("") == ""

def test_user_avatar_url_validation():
    app.dependency_overrides[get_current_user] = lambda: {
        "uid": "user-1", "email": "user@test.com", "name": "User", "role": "CITIZEN"
    }
    try:
        res = client.patch("/api/users/user-1", json={
            "avatarUrl": "https://evil.example/uploads/x.jpg"
        })
        assert res.status_code == 422
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

def test_vet_cannot_list_users():
    app.dependency_overrides[get_current_user] = lambda: {
        "uid": "vet-1", "email": "vet@clinic.com", "name": "Dr. Vet", "role": "VET"
    }
    try:
        # VET cannot access user directory
        res = client.get("/api/users")
        assert res.status_code == 403
        assert "Forbidden" in res.json()["detail"]
    finally:
        app.dependency_overrides.clear()

def test_vet_cannot_view_other_user_contact_info(monkeypatch):
    app.dependency_overrides[get_current_user] = lambda: {
        "uid": "vet-1", "email": "vet@clinic.com", "name": "Dr. Vet", "role": "VET"
    }
    try:
        mock_user = {
            "id": "citizen-99",
            "display_name": "Private Citizen",
            "email": "private@domain.com",
            "phone": "555-1234",
            "role": "CITIZEN",
            "avatar_url": "",
            "created_at": "2026-11-01T00:00:00Z"
        }
        mock_query = MagicMock()
        mock_query.select.return_value = mock_query
        mock_query.eq.return_value = mock_query
        mock_query.execute.return_value = MagicMock(data=[mock_user])
        monkeypatch.setattr(supabase_config.supabase, "table", MagicMock(return_value=mock_query))

        res = client.get("/api/users/citizen-99")
        assert res.status_code == 200
        # Email and phone must be redacted for VET viewing another user
        assert res.json()["email"] == ""
        assert res.json()["phoneNumber"] == ""
    finally:
        app.dependency_overrides.clear()

def test_cannot_request_admin_role_via_profile(monkeypatch):
    app.dependency_overrides[get_current_user] = lambda: {
        "uid": "user-test", "email": "user@test.com", "name": "Test User", "role": "CITIZEN"
    }
    try:
        captured = {}
        mock_query = MagicMock()
        mock_query.select.return_value = mock_query
        mock_query.eq.return_value = mock_query
        mock_query.execute.return_value = MagicMock(data=[{"id": "user-test"}])
        mock_query.upsert.side_effect = lambda d: captured.update(d) or mock_query
        monkeypatch.setattr(supabase_config.supabase, "table", MagicMock(return_value=mock_query))

        # Trying to request ADMIN should be rejected / sanitized to None
        res = client.post("/api/users", json={
            "uid": "user-test",
            "displayName": "Test",
            "requestedRole": "ADMIN"
        })
        assert res.status_code == 200
        assert res.json()["requestedRole"] is None
        assert "requested_role" not in captured

        # Valid requested role VOLUNTEER is preserved
        res_vol = client.post("/api/users", json={
            "uid": "user-test",
            "displayName": "Test",
            "requestedRole": "VOLUNTEER"
        })
        assert res_vol.status_code == 200
        assert res_vol.json()["requestedRole"] == "VOLUNTEER"
        assert captured.get("requested_role") == "VOLUNTEER"
    finally:
        app.dependency_overrides.clear()

def test_role_change_audited(monkeypatch):
    app.dependency_overrides[get_current_user] = lambda: {
        "uid": "admin-1", "email": "admin@domain.com", "name": "Admin", "role": "ADMIN"
    }
    try:
        mock_users_query = MagicMock()
        mock_users_query.select.return_value = mock_users_query
        mock_users_query.eq.return_value = mock_users_query
        mock_users_query.execute.return_value = MagicMock(data=[{"role": "CITIZEN", "display_name": "Target"}])
        mock_users_query.update.return_value = mock_users_query

        audit_inserted = {}
        mock_audit_query = MagicMock()
        mock_audit_query.insert.side_effect = lambda d: audit_inserted.update(d) or mock_audit_query
        mock_audit_query.execute.return_value = MagicMock(data=[{"id": "audit-1"}])

        def table_router(name):
            if name == "audit_logs":
                return mock_audit_query
            return mock_users_query

        monkeypatch.setattr(supabase_config.supabase, "table", table_router)

        res = client.patch("/api/users/target-user/role", json={"role": "VOLUNTEER"})
        assert res.status_code == 200
        assert audit_inserted.get("action") == "ROLE_CHANGE"
        assert audit_inserted.get("entity_id") == "target-user"
        assert audit_inserted.get("performed_by") == "admin-1"
        assert audit_inserted.get("old_value") == {"role": "CITIZEN"}
        assert audit_inserted.get("new_value") == {"role": "VOLUNTEER"}
    finally:
        app.dependency_overrides.clear()

def test_rate_limiter_blocks_excessive_requests():
    from rate_limiter import SlidingWindowRateLimiter, get_client_ip
    from starlette.datastructures import Headers

    limiter = SlidingWindowRateLimiter(default_limit=3, window_seconds=10)
    client_ip = "192.168.1.100"

    assert limiter.is_allowed(client_ip, path="/api/rescues", method="GET")[0] is True
    assert limiter.is_allowed(client_ip, path="/api/rescues", method="GET")[0] is True
    assert limiter.is_allowed(client_ip, path="/api/rescues", method="GET")[0] is True

    # 4th GET request exceeds limit
    allowed, retry_after = limiter.is_allowed(client_ip, path="/api/rescues", method="GET")
    assert allowed is False
    assert retry_after > 0

    # Tiered limits: surrender endpoint has strict limit of 10
    surrender_ip = "192.168.1.200"
    for _ in range(10):
        assert limiter.is_allowed(surrender_ip, path="/api/animals/surrender", method="POST")[0] is True
    # 11th surrender request blocked
    allowed_surrender, _ = limiter.is_allowed(surrender_ip, path="/api/animals/surrender", method="POST")
    assert allowed_surrender is False

    # Eviction of idle keys:
    limiter.evict_idle_keys(now=time.time() + 20)
    assert f"{client_ip}:read" not in limiter.requests
    assert f"{surrender_ip}:surrender" not in limiter.requests

    # Spoofed X-Forwarded-For is ignored by default
    fake_scope = {
        "type": "http",
        "client": ("10.0.0.1", 12345),
        "headers": [(b"x-forwarded-for", b"spoofed.hacker.ip")]
    }
    mock_req = MagicMock()
    mock_req.client.host = "10.0.0.1"
    mock_req.headers = {"x-forwarded-for": "spoofed.hacker.ip"}
    resolved_ip = get_client_ip(mock_req)
    assert resolved_ip == "10.0.0.1"  # Uses socket host, not spoofed header!

def test_user_profile_address_and_bio_patch(monkeypatch):
    app.dependency_overrides[get_current_user] = lambda: {
        "uid": "user-addr-bio", "email": "user@test.com", "name": "User", "role": "CITIZEN"
    }
    try:
        captured_update = {}
        mock_query = MagicMock()
        mock_query.update.side_effect = lambda d: captured_update.update(d) or mock_query
        mock_query.eq.return_value = mock_query
        mock_query.execute.return_value = MagicMock(data=[{
            "id": "user-addr-bio",
            "display_name": "User",
            "address": "123 Main St",
            "bio": "Animal lover"
        }])
        monkeypatch.setattr(supabase_config.supabase, "table", MagicMock(return_value=mock_query))

        res = client.patch("/api/users/user-addr-bio", json={
            "address": "123 Main St",
            "bio": "Animal lover"
        })
        assert res.status_code == 200
        assert captured_update.get("address") == "123 Main St"
        assert captured_update.get("bio") == "Animal lover"
    finally:
        app.dependency_overrides.clear()

def test_shelter_ngo_can_view_applicant_contact_details(monkeypatch):
    # SHELTER/NGO coordinator reviewing an applicant with an active adoption application
    app.dependency_overrides[get_current_user] = lambda: {
        "uid": "shelter-mgr", "email": "shelter@test.com", "name": "Shelter Mgr", "role": "SHELTER"
    }
    try:
        mock_user = {
            "id": "applicant-1",
            "display_name": "Jane Applicant",
            "email": "jane@example.com",
            "phone": "555-9876",
            "address": "456 Elm St",
            "bio": "Experienced dog owner",
            "role": "CITIZEN",
            "avatar_url": "",
            "created_at": "2026-11-01T00:00:00Z"
        }
        
        def table_mock(name):
            query = MagicMock()
            query.select.return_value = query
            query.eq.return_value = query
            query.in_.return_value = query
            query.limit.return_value = query
            if name == "users":
                query.execute.return_value = MagicMock(data=[mock_user])
            elif name == "adoption_applications":
                # Active application by applicant-1
                query.execute.return_value = MagicMock(data=[{"id": "app-1", "animal_id": "animal-10"}])
            elif name == "animals":
                # animal-10 is owned by shelter-mgr
                query.execute.return_value = MagicMock(data=[{"id": "animal-10"}])
            else:
                query.execute.return_value = MagicMock(data=[])
            return query

        monkeypatch.setattr(supabase_config.supabase, "table", table_mock)

        res = client.get("/api/users/applicant-1")
        assert res.status_code == 200
        # Shelter reviewing applicant for their animal receives contact details
        assert res.json()["email"] == "jane@example.com"
        assert res.json()["phoneNumber"] == "555-9876"
        assert res.json()["address"] == "456 Elm St"
    finally:
        app.dependency_overrides.clear()

def test_shelter_ngo_cannot_view_unrelated_user_contact_details(monkeypatch):
    # SHELTER/NGO querying a random user with no active application, surrender, or rescue
    app.dependency_overrides[get_current_user] = lambda: {
        "uid": "shelter-mgr", "email": "shelter@test.com", "name": "Shelter Mgr", "role": "SHELTER"
    }
    try:
        mock_user = {
            "id": "unrelated-user-2",
            "display_name": "Random User",
            "email": "random@example.com",
            "phone": "555-0000",
            "address": "789 Pine St",
            "bio": "No animals",
            "role": "CITIZEN",
            "avatar_url": "",
            "created_at": "2026-11-01T00:00:00Z"
        }
        
        def table_mock(name):
            query = MagicMock()
            query.select.return_value = query
            query.eq.return_value = query
            query.in_.return_value = query
            query.limit.return_value = query
            if name == "users":
                query.execute.return_value = MagicMock(data=[mock_user])
            else:
                # No active cases for this user
                query.execute.return_value = MagicMock(data=[])
            return query

        monkeypatch.setattr(supabase_config.supabase, "table", table_mock)

        res = client.get("/api/users/unrelated-user-2")
        assert res.status_code == 200
        # Contact details are strictly redacted for unrelated user
        assert res.json()["email"] == ""
        assert res.json()["phoneNumber"] == ""
        assert res.json()["address"] == ""
        assert res.json()["displayName"] == "Random User"
    finally:
        app.dependency_overrides.clear()

def test_cannot_request_admin_role_via_patch_profile(monkeypatch):
    app.dependency_overrides[get_current_user] = lambda: {
        "uid": "user-test", "email": "user@test.com", "name": "Test User", "role": "CITIZEN"
    }
    try:
        mock_query = MagicMock()
        mock_query.select.return_value = mock_query
        mock_query.eq.return_value = mock_query
        mock_query.update.return_value = mock_query
        mock_query.execute.return_value = MagicMock(data=[{"id": "user-test", "display_name": "Test"}])
        monkeypatch.setattr(supabase_config.supabase, "table", MagicMock(return_value=mock_query))

        # Attempting to PATCH requestedRole to ADMIN fails with 400
        res = client.patch("/api/users/user-test", json={"requestedRole": "ADMIN"})
        assert res.status_code == 400
        assert "Cannot request ADMIN" in res.json()["detail"]

        # Valid requested role VOLUNTEER is accepted
        res_ok = client.patch("/api/users/user-test", json={"requestedRole": "VOLUNTEER"})
        assert res_ok.status_code == 200
    finally:
        app.dependency_overrides.clear()

