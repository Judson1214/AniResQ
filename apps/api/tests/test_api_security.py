import pytest
import time
from unittest.mock import MagicMock
from starlette.testclient import TestClient
from main import app
from auth import get_current_user, get_optional_user
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
    mock_query.neq.return_value = mock_query
    mock_query.order.return_value = mock_query
    mock_query.range.return_value = mock_query
    mock_query.execute = mock_execute
    mock_table = MagicMock(return_value=mock_query)
    monkeypatch.setattr(supabase_config.supabase, "table", mock_table)

    # Verify pagination parameters are accepted and validated on public endpoint
    res_valid = client.get("/api/rescues/public?limit=10&offset=20")
    assert res_valid.status_code == 200

    # Limit must be >= 1
    res_invalid_limit = client.get("/api/rescues/public?limit=0")
    assert res_invalid_limit.status_code == 422

    # Offset must be >= 0
    res_invalid_offset = client.get("/api/rescues/public?offset=-5")
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
        mock_rpc = MagicMock()
        mock_rpc.execute.return_value = MagicMock(data={"id": "target-user", "role": "VOLUNTEER", "display_name": "Target"})
        monkeypatch.setattr(supabase_config.supabase, "rpc", lambda fn, params: mock_rpc)

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
        mock_rpc = MagicMock()
        mock_rpc.execute.side_effect = Exception("PGRST202 could not find the function public.admin_update_user_role")
        monkeypatch.setattr(supabase_config.supabase, "rpc", lambda fn, params: mock_rpc)

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

def test_surrendered_by_redacted_for_public_and_unrelated_users(monkeypatch):
    mock_animal = {
        "id": "animal-1",
        "name": "Buddy",
        "species": "DOG",
        "breed": "Mix",
        "age_estimate": "2 years",
        "gender": "MALE",
        "weight": 12.0,
        "health_status": "HEALTHY",
        "adoption_status": "AVAILABLE",
        "description": "Friendly dog",
        "vaccinations": [],
        "is_neutered": True,
        "special_needs": None,
        "shelter_id": "shelter-1",
        "surrendered_by": "citizen-owner-1",
        "images": [],
        "created_at": "2026-11-01T00:00:00Z",
        "updated_at": "2026-11-01T00:00:00Z",
    }
    mock_query = MagicMock()
    mock_query.select.return_value = mock_query
    mock_query.eq.return_value = mock_query
    mock_query.execute.return_value = MagicMock(data=[mock_animal])
    monkeypatch.setattr(supabase_config.supabase, "table", MagicMock(return_value=mock_query))

    # 1. Unauthenticated / anonymous visitor
    app.dependency_overrides[get_optional_user] = lambda: None
    res = client.get("/api/animals/animal-1")
    assert res.status_code == 200
    assert res.json()["surrenderedBy"] is None

    # 2. Authenticated unrelated citizen
    app.dependency_overrides[get_optional_user] = lambda: {
        "uid": "other-citizen", "role": "CITIZEN"
    }
    res = client.get("/api/animals/animal-1")
    assert res.status_code == 200
    assert res.json()["surrenderedBy"] is None

    # 3. Animal owner (citizen who surrendered)
    app.dependency_overrides[get_optional_user] = lambda: {
        "uid": "citizen-owner-1", "role": "CITIZEN"
    }
    res = client.get("/api/animals/animal-1")
    assert res.status_code == 200
    assert res.json()["surrenderedBy"] == "citizen-owner-1"

    # 4. Staff member (SHELTER / ADMIN)
    app.dependency_overrides[get_optional_user] = lambda: {
        "uid": "shelter-staff-1", "role": "SHELTER"
    }
    res = client.get("/api/animals/animal-1")
    assert res.status_code == 200
    assert res.json()["surrenderedBy"] == "citizen-owner-1"

    app.dependency_overrides.clear()

def test_shelter_can_claim_animal(monkeypatch):
    mock_unclaimed_animal = {
        "id": "animal-surrender-1",
        "name": "Milo",
        "species": "CAT",
        "breed": "Unknown",
        "age_estimate": "1 year",
        "gender": "UNKNOWN",
        "weight": None,
        "health_status": "HEALTHY",
        "adoption_status": "NOT_READY",
        "description": "Surrendered cat",
        "vaccinations": [],
        "is_neutered": False,
        "special_needs": None,
        "shelter_id": None,
        "surrendered_by": "citizen-1",
        "images": [],
        "created_at": "2026-11-01T00:00:00Z",
        "updated_at": "2026-11-01T00:00:00Z",
    }
    mock_claimed_animal = {**mock_unclaimed_animal, "shelter_id": "shelter-99"}

    # 1. Citizen cannot claim (403)
    app.dependency_overrides[get_current_user] = lambda: {
        "uid": "citizen-1", "role": "CITIZEN"
    }
    res = client.post("/api/animals/animal-surrender-1/claim")
    assert res.status_code == 403

    # 2. Shelter claiming unclaimed animal succeeds
    app.dependency_overrides[get_current_user] = lambda: {
        "uid": "shelter-42", "role": "SHELTER"
    }
    mock_query = MagicMock()
    mock_query.select.return_value = mock_query
    mock_query.eq.return_value = mock_query
    mock_query.is_.return_value = mock_query
    mock_query.update.return_value = mock_query
    # First call is select (existing), second is update
    mock_query.execute.side_effect = [
        MagicMock(data=[mock_unclaimed_animal]),
        MagicMock(data=[{**mock_unclaimed_animal, "shelter_id": "shelter-42"}]),
    ]
    monkeypatch.setattr(supabase_config.supabase, "table", MagicMock(return_value=mock_query))

    res = client.post("/api/animals/animal-surrender-1/claim")
    assert res.status_code == 200
    assert res.json()["shelterId"] == "shelter-42"

    # 3. Already claimed animal returns 409
    mock_query_claimed = MagicMock()
    mock_query_claimed.select.return_value = mock_query_claimed
    mock_query_claimed.eq.return_value = mock_query_claimed
    mock_query_claimed.execute.return_value = MagicMock(data=[mock_claimed_animal])
    monkeypatch.setattr(supabase_config.supabase, "table", MagicMock(return_value=mock_query_claimed))

    res_conflict = client.post("/api/animals/animal-surrender-1/claim")
    assert res_conflict.status_code == 409

    # 4. Animal not surrendered returns 400
    mock_nonsurrendered = {**mock_unclaimed_animal, "surrendered_by": None}
    mock_query_nonsurr = MagicMock()
    mock_query_nonsurr.select.return_value = mock_query_nonsurr
    mock_query_nonsurr.eq.return_value = mock_query_nonsurr
    mock_query_nonsurr.execute.return_value = MagicMock(data=[mock_nonsurrendered])
    monkeypatch.setattr(supabase_config.supabase, "table", MagicMock(return_value=mock_query_nonsurr))

    res_not_surr = client.post("/api/animals/animal-surrender-1/claim")
    assert res_not_surr.status_code == 400
    assert "Only surrendered animals" in res_not_surr.json()["detail"]

    # 5. Race condition: atomic update matches 0 rows because another worker claimed first -> 409
    mock_query_race = MagicMock()
    mock_query_race.select.return_value = mock_query_race
    mock_query_race.eq.return_value = mock_query_race
    mock_query_race.is_.return_value = mock_query_race
    mock_query_race.update.return_value = mock_query_race
    mock_query_race.execute.side_effect = [
        MagicMock(data=[mock_unclaimed_animal]), # select succeeds
        MagicMock(data=[]), # atomic update returns empty because shelter_id was no longer null
    ]
    monkeypatch.setattr(supabase_config.supabase, "table", MagicMock(return_value=mock_query_race))

    res_race = client.post("/api/animals/animal-surrender-1/claim")
    assert res_race.status_code == 409
    assert "already claimed" in res_race.json()["detail"]

    app.dependency_overrides.clear()

def test_rescues_get_endpoints_require_auth():
    # Anonymous requests must return 401
    res_list = client.get("/api/rescues/")
    assert res_list.status_code in [401, 403]

    res_detail = client.get("/api/rescues/some-rescue-id")
    assert res_detail.status_code in [401, 403]

    res_timeline = client.get("/api/rescues/some-rescue-id/timeline")
    assert res_timeline.status_code in [401, 403]

def test_citizen_cannot_read_another_users_rescue(monkeypatch):
    mock_rescue = {
        "id": "rescue-target-1",
        "title": "Injured Dog",
        "description": "Found near highway",
        "species": "DOG",
        "severity": "HIGH",
        "status": "PENDING",
        "reporter_id": "citizen-reporter-2",
        "assigned_to": "volunteer-99",
        "latitude": 37.7749295,
        "longitude": -122.4194155,
        "address": "123 Main St",
        "images": [],
        "created_at": "2026-11-01T00:00:00Z",
        "updated_at": "2026-11-01T00:00:00Z",
    }

    mock_query = MagicMock()
    mock_query.select.return_value = mock_query
    mock_query.eq.return_value = mock_query
    mock_query.execute.return_value = MagicMock(data=[mock_rescue])
    monkeypatch.setattr(supabase_config.supabase, "table", MagicMock(return_value=mock_query))

    # Authenticated as an unrelated citizen
    app.dependency_overrides[get_current_user] = lambda: {
        "uid": "unrelated-citizen-1", "role": "CITIZEN"
    }
    try:
        # Detail request is Forbidden
        res_detail = client.get("/api/rescues/rescue-target-1")
        assert res_detail.status_code == 403

        # Timeline request is Forbidden
        res_timeline = client.get("/api/rescues/rescue-target-1/timeline")
        assert res_timeline.status_code == 403

        # List request: Even if citizen specifies reporterId=citizen-reporter-2,
        # query is forced to filter by caller's own uid
        mock_list_query = MagicMock()
        mock_list_query.select.return_value = mock_list_query
        mock_list_query.eq.return_value = mock_list_query
        mock_list_query.order.return_value = mock_list_query
        mock_list_query.range.return_value = mock_list_query
        mock_list_query.execute.return_value = MagicMock(data=[])
        monkeypatch.setattr(supabase_config.supabase, "table", MagicMock(return_value=mock_list_query))

        client.get("/api/rescues/?reporterId=citizen-reporter-2")
        mock_list_query.eq.assert_called_with("reporter_id", "unrelated-citizen-1")
    finally:
        app.dependency_overrides.clear()

def test_rescue_detail_and_timeline_authorized_readers(monkeypatch):
    mock_rescue = {
        "id": "rescue-case-1",
        "title": "Cat in tree",
        "description": "Near the park",
        "species": "CAT",
        "severity": "LOW",
        "status": "DISPATCHED",
        "reporter_id": "citizen-owner-1",
        "assigned_to": "volunteer-assigned-1",
        "latitude": 40.7128,
        "longitude": -74.0060,
        "address": "Park Ave",
        "images": [],
        "created_at": "2026-11-01T00:00:00Z",
        "updated_at": "2026-11-01T00:00:00Z",
    }
    mock_timeline_item = {
        "id": "t-1",
        "rescue_id": "rescue-case-1",
        "status": "DISPATCHED",
        "message": "Assigned",
        "updated_by": "volunteer-assigned-1",
        "updated_by_name": "Volunteer",
        "created_at": "2026-11-01T01:00:00Z",
    }

    def table_mock(name):
        q = MagicMock()
        q.select.return_value = q
        q.eq.return_value = q
        q.order.return_value = q
        q.range.return_value = q
        if name == "rescues":
            q.execute.return_value = MagicMock(data=[mock_rescue])
        elif name == "rescue_timeline":
            q.execute.return_value = MagicMock(data=[mock_timeline_item])
        return q

    monkeypatch.setattr(supabase_config.supabase, "table", table_mock)

    # 1. Reporter can read detail & timeline
    app.dependency_overrides[get_current_user] = lambda: {
        "uid": "citizen-owner-1", "role": "CITIZEN"
    }
    assert client.get("/api/rescues/rescue-case-1").status_code == 200
    assert client.get("/api/rescues/rescue-case-1/timeline").status_code == 200

    # 2. Assigned volunteer can read detail & timeline
    app.dependency_overrides[get_current_user] = lambda: {
        "uid": "volunteer-assigned-1", "role": "VOLUNTEER"
    }
    assert client.get("/api/rescues/rescue-case-1").status_code == 200
    assert client.get("/api/rescues/rescue-case-1/timeline").status_code == 200

    # 3. Staff (ADMIN) can read detail & timeline
    app.dependency_overrides[get_current_user] = lambda: {
        "uid": "admin-1", "role": "ADMIN"
    }
    assert client.get("/api/rescues/rescue-case-1").status_code == 200
    assert client.get("/api/rescues/rescue-case-1/timeline").status_code == 200

    app.dependency_overrides.clear()

def test_public_rescues_endpoint_anonymized(monkeypatch):
    mock_rescues = [
        {
            "id": "r-pub-1",
            "species": "DOG",
            "severity": "HIGH",
            "status": "PENDING",
            "latitude": 37.774929,
            "longitude": -122.419416,
            "created_at": "2026-11-01T00:00:00Z",
        }
    ]
    mock_query = MagicMock()
    mock_query.select.return_value = mock_query
    mock_query.neq.return_value = mock_query
    mock_query.eq.return_value = mock_query
    mock_query.order.return_value = mock_query
    mock_query.range.return_value = mock_query
    mock_query.execute.return_value = MagicMock(data=mock_rescues)
    monkeypatch.setattr(supabase_config.supabase, "table", MagicMock(return_value=mock_query))

    res = client.get("/api/rescues/public")
    assert res.status_code == 200
    data = res.json()
    assert len(data) == 1
    item = data[0]
    # Coordinates rounded to 2 decimals (~1km fuzz)
    assert item["location"]["latitude"] == 37.77
    assert item["location"]["longitude"] == -122.42
    # Sensitive fields strictly omitted
    assert "description" not in item
    assert "address" not in item
    assert "reporterId" not in item
    assert "photoUrls" not in item

    # Verify severity filter is accepted and applied
    res_sev = client.get("/api/rescues/public?severity=HIGH")
    assert res_sev.status_code == 200
    mock_query.eq.assert_any_call("severity", "HIGH")

def test_animals_endpoint_supports_shelter_filter(monkeypatch):
    mock_query = MagicMock()
    mock_query.select.return_value = mock_query
    mock_query.neq.return_value = mock_query
    mock_query.eq.return_value = mock_query
    mock_query.order.return_value = mock_query
    mock_query.range.return_value = mock_query
    mock_query.execute.return_value = MagicMock(data=[])
    monkeypatch.setattr(supabase_config.supabase, "table", MagicMock(return_value=mock_query))

    res = client.get("/api/animals/?shelterId=shelter-abc")
    assert res.status_code == 200
    mock_query.eq.assert_any_call("shelter_id", "shelter-abc")


def test_notifications_sent_on_system_events(monkeypatch):
    # Test notification created when volunteer assigned to rescue
    from routers import notifications
    notifications_created = []

    def mock_create_notification(user_id, notif_type, title, message, related_entity_id=None, related_entity_type=None):
        notifications_created.append({
            "user_id": user_id,
            "type": notif_type,
            "title": title,
            "message": message,
            "related_id": related_entity_id,
            "related_type": related_entity_type,
        })

    monkeypatch.setattr(notifications, "create_system_notification", mock_create_notification)
    import routers.rescues as rescues_module
    import routers.adoptions as adoptions_module
    import routers.animals as animals_module
    import routers.users as users_module
    monkeypatch.setattr(rescues_module, "create_system_notification", mock_create_notification)
    monkeypatch.setattr(adoptions_module, "create_system_notification", mock_create_notification)
    monkeypatch.setattr(animals_module, "create_system_notification", mock_create_notification)
    monkeypatch.setattr(users_module, "create_system_notification", mock_create_notification)

    # 1. Test rescue assignment notification
    app.dependency_overrides[get_current_user] = lambda: {
        "uid": "admin-1", "email": "admin@aniresq.org", "name": "Admin", "role": "ADMIN"
    }
    try:
        mock_table = MagicMock()
        mock_table.select.return_value = mock_table
        mock_table.update.return_value = mock_table
        mock_table.insert.return_value = mock_table
        mock_table.eq.return_value = mock_table
        # For volunteer check and rescue update
        mock_table.execute.side_effect = [
            MagicMock(data=[{"id": "r-1", "status": "PENDING", "assigned_to": None, "reporter_id": "citizen-1"}]), # existing_rescue check
            MagicMock(data=[{"id": "vol-1", "role": "VOLUNTEER", "display_name": "Volunteer Dave"}]), # vol_check
            MagicMock(data=[{"id": "r-1", "reporter_id": "citizen-1", "assigned_to": "vol-1"}]), # update rescue
            MagicMock(data=[]), # timeline insert
            MagicMock(data=[{"id": "audit-1"}]), # audit log insert
        ]
        monkeypatch.setattr(supabase_config.supabase, "table", MagicMock(return_value=mock_table))
        mock_rpc = MagicMock()
        mock_rpc.execute.side_effect = Exception("PGRST202 could not find the function public.admin_decline_role_request")
        monkeypatch.setattr(supabase_config.supabase, "rpc", lambda fn, params: mock_rpc)

        res = client.post("/api/rescues/r-1/assign", json={"volunteerId": "vol-1", "volunteerName": "Volunteer Dave"})
        assert res.status_code == 200
        # Check notifications for volunteer and reporter
        vol_notif = next((n for n in notifications_created if n["user_id"] == "vol-1"), None)
        rep_notif = next((n for n in notifications_created if n["user_id"] == "citizen-1"), None)
        assert vol_notif is not None
        assert vol_notif["type"] == "RESCUE_ASSIGNED"
        assert rep_notif is not None
        assert rep_notif["type"] == "RESCUE_UPDATE"
    finally:
        app.dependency_overrides.clear()

    # 2. Test adoption review decision notification
    app.dependency_overrides[get_current_user] = lambda: {
        "uid": "shelter-admin", "email": "shelter@aniresq.org", "name": "Shelter", "role": "SHELTER"
    }
    try:
        mock_table = MagicMock()
        mock_table.select.return_value = mock_table
        mock_table.update.return_value = mock_table
        mock_table.eq.return_value = mock_table
        mock_table.execute.side_effect = [
            MagicMock(data=[{"id": "app-10", "animal_id": "a-1", "applicant_id": "applicant-99"}]), # select app
            MagicMock(data=[{"id": "a-1", "shelter_id": "shelter-admin"}]), # check animal belongs to shelter
            MagicMock(data=[{"id": "app-10", "status": "APPROVED", "animal_id": "a-1", "applicant_id": "applicant-99", "living_environment": "HOUSE", "prior_pet_experience": "Many years", "family_members": 2}]), # update app
            MagicMock(data=[{"id": "a-1"}]), # update animal status
        ]
        monkeypatch.setattr(supabase_config.supabase, "table", MagicMock(return_value=mock_table))
        mock_rpc = MagicMock()
        mock_rpc.execute.side_effect = Exception("PGRST202 could not find the function public.admin_decline_role_request")
        monkeypatch.setattr(supabase_config.supabase, "rpc", lambda fn, params: mock_rpc)

        res = client.patch("/api/adoptions/app-10/status", json={"status": "APPROVED", "screeningNotes": "Great home"})
        assert res.status_code == 200
        app_notif = next((n for n in notifications_created if n["user_id"] == "applicant-99"), None)
        assert app_notif is not None
        assert app_notif["type"] == "ADOPTION_DECISION"
        assert "approved" in app_notif["message"]
    finally:
        app.dependency_overrides.clear()


def test_decline_role_request_preserves_existing_role(monkeypatch):
    from routers import users as users_module
    notifications_sent = []
    audits_inserted = []

    def mock_notif(user_id, notif_type, title, message, related_entity_id=None, related_entity_type=None):
        notifications_sent.append({"user_id": user_id, "type": notif_type, "title": title, "message": message})

    monkeypatch.setattr(users_module, "create_system_notification", mock_notif)

    # 1. Non-admin cannot decline role requests (403)
    app.dependency_overrides[get_current_user] = lambda: {
        "uid": "citizen-1", "email": "cit@test.com", "name": "Citizen", "role": "CITIZEN"
    }
    try:
        res = client.post("/api/users/vol-123/role-request/decline")
        assert res.status_code == 403
    finally:
        app.dependency_overrides.clear()

    # 2. Admin declines a VOLUNTEER who requested NGO -> role remains VOLUNTEER!
    app.dependency_overrides[get_current_user] = lambda: {
        "uid": "admin-1", "email": "admin@aniresq.org", "name": "Admin", "role": "ADMIN"
    }
    try:
        updated_payload = {}
        mock_table = MagicMock()
        mock_table.select.return_value = mock_table
        mock_table.update.side_effect = lambda data: updated_payload.update(data) or mock_table
        mock_table.insert.side_effect = lambda data: audits_inserted.append(data) or mock_table
        mock_table.eq.return_value = mock_table
        mock_table.execute.side_effect = [
            # 1. Fetch user (has role VOLUNTEER and requested_role NGO)
            MagicMock(data=[{"id": "vol-123", "role": "VOLUNTEER", "requested_role": "NGO", "display_name": "Dave Volunteer"}]),
            # 2. Update user
            MagicMock(data=[{"id": "vol-123", "role": "VOLUNTEER", "requested_role": None, "display_name": "Dave Volunteer"}]),
            # 3. Audit log insert
            MagicMock(data=[]),
        ]
        monkeypatch.setattr(supabase_config.supabase, "table", MagicMock(return_value=mock_table))
        mock_rpc = MagicMock()
        mock_rpc.execute.side_effect = Exception("PGRST202 could not find the function public.admin_decline_role_request")
        monkeypatch.setattr(supabase_config.supabase, "rpc", lambda fn, params: mock_rpc)

        res = client.post("/api/users/vol-123/role-request/decline")
        assert res.status_code == 200
        data = res.json()
        # Verify role was PRESERVED as VOLUNTEER, NOT demoted to CITIZEN!
        assert data["role"] == "VOLUNTEER"
        assert data["requestedRole"] is None
        # Verify only requested_role was updated in DB
        assert updated_payload == {"requested_role": None}

        # Verify audit record
        assert len(audits_inserted) == 1
        assert audits_inserted[0]["action"] == "ROLE_REQUEST_DECLINED"
        assert audits_inserted[0]["entity_id"] == "vol-123"

        # Verify user received notification that role is unchanged
        assert len(notifications_sent) == 1
        assert notifications_sent[0]["user_id"] == "vol-123"
        assert "Clearance Request Declined" in notifications_sent[0]["title"]
        assert "remains unchanged" in notifications_sent[0]["message"]
    finally:
        app.dependency_overrides.clear()


def test_shelter_cannot_edit_or_delete_other_shelter_animal(monkeypatch):
    mock_table = MagicMock()
    mock_table.select.return_value = mock_table
    mock_table.eq.return_value = mock_table
    # Animal belongs to shelter-B
    mock_table.execute.return_value = MagicMock(data=[{"id": "animal-1", "shelter_id": "shelter-B"}])
    monkeypatch.setattr(supabase_config.supabase, "table", MagicMock(return_value=mock_table))

    # Shelter A attempts to edit Shelter B's animal -> 403 Forbidden
    app.dependency_overrides[get_current_user] = lambda: {
        "uid": "shelter-A", "email": "sheltera@test.com", "name": "Shelter A", "role": "SHELTER"
    }
    try:
        res = client.patch("/api/animals/animal-1", json={"name": "Renamed By Unauthorized Shelter"})
        assert res.status_code == 403
        assert "Forbidden" in res.json()["detail"]

        del_res = client.delete("/api/animals/animal-1")
        assert del_res.status_code == 403
        assert "Forbidden" in del_res.json()["detail"]
    finally:
        app.dependency_overrides.clear()


def test_shelter_cannot_review_other_shelter_adoption_application(monkeypatch):
    # Application for animal-99 which belongs to shelter-B
    mock_table = MagicMock()
    mock_table.select.return_value = mock_table
    mock_table.eq.return_value = mock_table
    # 1. Fetch application -> animal_id: animal-99
    # 2. Fetch animal-99 -> shelter_id: shelter-B
    mock_table.execute.side_effect = [
        MagicMock(data=[{"id": "app-1", "animal_id": "animal-99", "applicant_id": "citizen-1"}]),
        MagicMock(data=[{"id": "animal-99", "shelter_id": "shelter-B"}]),
    ]
    monkeypatch.setattr(supabase_config.supabase, "table", MagicMock(return_value=mock_table))

    # Shelter A attempts to review Shelter B's animal application -> 403 Forbidden
    app.dependency_overrides[get_current_user] = lambda: {
        "uid": "shelter-A", "email": "sheltera@test.com", "name": "Shelter A", "role": "SHELTER"
    }
    try:
        res = client.patch("/api/adoptions/app-1/status", json={"status": "APPROVED"})
        assert res.status_code == 403
        assert "Forbidden: You can only review applications for animals in your shelter facility" in res.json()["detail"]
    finally:
        app.dependency_overrides.clear()


def test_adoption_status_notification_readable_labels(monkeypatch):
    from routers import adoptions as adoptions_module
    notifications_sent = []

    def mock_notif(user_id, notif_type, title, message, related_entity_id=None, related_entity_type=None):
        notifications_sent.append({"user_id": user_id, "title": title, "message": message})

    monkeypatch.setattr(adoptions_module, "create_system_notification", mock_notif)

    # Shelter reviews application to UNDER_REVIEW
    app.dependency_overrides[get_current_user] = lambda: {
        "uid": "shelter-A", "email": "sheltera@test.com", "name": "Shelter A", "role": "SHELTER"
    }
    try:
        mock_table = MagicMock()
        mock_table.select.return_value = mock_table
        mock_table.update.return_value = mock_table
        mock_table.eq.return_value = mock_table
        mock_table.execute.side_effect = [
            MagicMock(data=[{"id": "app-under-review", "animal_id": "animal-A", "applicant_id": "citizen-user"}]),
            MagicMock(data=[{"id": "animal-A", "shelter_id": "shelter-A"}]), # check animal belongs to shelter-A
            MagicMock(data=[{"id": "app-under-review", "animal_id": "animal-A", "status": "UNDER_REVIEW", "applicant_id": "citizen-user"}]),
        ]
        monkeypatch.setattr(supabase_config.supabase, "table", MagicMock(return_value=mock_table))
        mock_rpc = MagicMock()
        mock_rpc.execute.side_effect = Exception("PGRST202 could not find the function public.admin_decline_role_request")
        monkeypatch.setattr(supabase_config.supabase, "rpc", lambda fn, params: mock_rpc)

        res = client.patch("/api/adoptions/app-under-review/status", json={"status": "UNDER_REVIEW"})
        assert res.status_code == 200
        assert len(notifications_sent) == 1
        # Title must be "Adoption Application Under Review" (NOT Under_review)
        assert notifications_sent[0]["title"] == "Adoption Application Under Review"
        assert "is currently under review by our shelter team" in notifications_sent[0]["message"]
    finally:
        app.dependency_overrides.clear()


def test_high_severity_rescue_broadcasts_alert_to_volunteers(monkeypatch):
    from routers import rescues as rescues_module
    bulk_alerts_sent = []

    def mock_bulk_notif(notifications_list):
        bulk_alerts_sent.extend(notifications_list)

    monkeypatch.setattr(rescues_module, "create_bulk_system_notifications", mock_bulk_notif)

    app.dependency_overrides[get_current_user] = lambda: {
        "uid": "citizen-reporter", "email": "cit@test.com", "name": "Citizen", "role": "CITIZEN"
    }
    try:
        mock_table = MagicMock()
        mock_table.select.return_value = mock_table
        mock_table.insert.return_value = mock_table
        mock_table.in_.return_value = mock_table
        mock_table.is_.return_value = mock_table
        mock_table.eq.return_value = mock_table
        mock_table.execute.side_effect = [
            # 1. Insert rescue
            MagicMock(data=[{
                "id": "rescue-critical-1",
                "title": "Dog hit by car",
                "species": "DOG",
                "severity": "CRITICAL",
                "status": "PENDING",
                "reporter_id": "citizen-reporter",
                "latitude": 12.97,
                "longitude": 77.59,
                "address": "MG Road",
                "images": [],
                "created_at": "2026-11-23T00:00:00Z",
                "updated_at": "2026-11-23T00:00:00Z",
            }]),
            # 2. Timeline insert
            MagicMock(data=[]),
            # 3. Fetch active volunteers/NGOs without limit cap
            MagicMock(data=[{"id": "vol-1"}, {"id": "vol-2"}]),
        ]
        monkeypatch.setattr(supabase_config.supabase, "table", MagicMock(return_value=mock_table))
        mock_rpc = MagicMock()
        mock_rpc.execute.side_effect = Exception("PGRST202 could not find the function public.admin_decline_role_request")
        monkeypatch.setattr(supabase_config.supabase, "rpc", lambda fn, params: mock_rpc)

        res = client.post("/api/rescues/", json={
            "title": "Dog hit by car",
            "description": "Urgent assistance needed",
            "species": "DOG",
            "severity": "CRITICAL",
            "address": "MG Road",
            "location": {"latitude": 12.97, "longitude": 77.59},
            "photoUrls": []
        })
        assert res.status_code == 201
        # Volunteer responders vol-1 and vol-2 should have received RESCUE_ALERT notifications via single batch call
        assert len(bulk_alerts_sent) == 2
        alert_uids = {a["user_id"] for a in bulk_alerts_sent}
        assert alert_uids == {"vol-1", "vol-2"}
        assert "CRITICAL" in bulk_alerts_sent[0]["title"]
    finally:
        app.dependency_overrides.clear()


def test_vet_can_update_animal_health_records_on_any_animal(monkeypatch):
    mock_table = MagicMock()
    mock_table.select.return_value = mock_table
    mock_table.update.return_value = mock_table
    mock_table.eq.return_value = mock_table
    # Animal belongs to shelter-B
    mock_table.execute.side_effect = [
        MagicMock(data=[{"id": "animal-1", "shelter_id": "shelter-B"}]), # select animal
        MagicMock(data=[{
            "id": "animal-1",
            "name": "Buddy",
            "species": "DOG",
            "health_status": "RECOVERING",
            "vaccinations": ["Rabies", "DHPP"],
            "is_neutered": True,
            "special_needs": "Requires daily wound dressing",
            "shelter_id": "shelter-B",
            "created_at": "2026-11-01T00:00:00Z",
            "updated_at": "2026-11-23T00:00:00Z"
        }])
    ]
    monkeypatch.setattr(supabase_config.supabase, "table", MagicMock(return_value=mock_table))

    # Vet updating medical/health fields on shelter B's animal succeeds
    app.dependency_overrides[get_current_user] = lambda: {
        "uid": "vet-dr-smith", "email": "vet@clinic.com", "name": "Dr. Smith", "role": "VET"
    }
    try:
        res = client.patch("/api/animals/animal-1", json={
            "healthStatus": "RECOVERING",
            "vaccinations": ["Rabies", "DHPP"],
            "isNeutered": True,
            "specialNeeds": "Requires daily wound dressing"
        })
        assert res.status_code == 200
        data = res.json()
        assert data["healthStatus"] == "RECOVERING"
        assert data["isNeutered"] is True
    finally:
        app.dependency_overrides.clear()


def test_vet_cannot_update_administrative_fields_or_delete_animal(monkeypatch):
    mock_table = MagicMock()
    mock_table.select.return_value = mock_table
    mock_table.eq.return_value = mock_table
    mock_table.execute.return_value = MagicMock(data=[{"id": "animal-1", "shelter_id": "shelter-B"}])
    monkeypatch.setattr(supabase_config.supabase, "table", MagicMock(return_value=mock_table))

    app.dependency_overrides[get_current_user] = lambda: {
        "uid": "vet-dr-smith", "email": "vet@clinic.com", "name": "Dr. Smith", "role": "VET"
    }
    try:
        # VET attempting to change animal name or adoption status -> 403 Forbidden
        res = client.patch("/api/animals/animal-1", json={"name": "New Name"})
        assert res.status_code == 403
        assert "Veterinary providers can only update clinical health fields" in res.json()["detail"]

        res_adopt = client.patch("/api/animals/animal-1", json={"adoptionStatus": "ADOPTED"})
        assert res_adopt.status_code == 403
        assert "Veterinary providers can only update clinical health fields" in res_adopt.json()["detail"]

        # VET attempting to delete an animal -> 403 Forbidden
        del_res = client.delete("/api/animals/animal-1")
        assert del_res.status_code == 403
        assert "Forbidden" in del_res.json()["detail"]
    finally:
        app.dependency_overrides.clear()


def test_shelter_adoptions_uses_database_join(monkeypatch):
    mock_table = MagicMock()
    mock_table.select.return_value = mock_table
    mock_table.eq.return_value = mock_table
    mock_table.order.return_value = mock_table
    mock_table.range.return_value = mock_table
    mock_table.execute.return_value = MagicMock(data=[])
    monkeypatch.setattr(supabase_config.supabase, "table", MagicMock(return_value=mock_table))

    app.dependency_overrides[get_current_user] = lambda: {
        "uid": "shelter-X", "email": "shelterx@test.com", "name": "Shelter X", "role": "SHELTER"
    }
    try:
        res = client.get("/api/adoptions/")
        assert res.status_code == 200
        # Verify select used the PostgREST inner join on animals!inner(shelter_id)
        mock_table.select.assert_called_with("*, animals!inner(shelter_id)")
        mock_table.eq.assert_called_with("animals.shelter_id", "shelter-X")
    finally:
        app.dependency_overrides.clear()


def test_user_coordinates_redacted_for_third_parties(monkeypatch):
    mock_user_db = {
        "id": "vol-private",
        "display_name": "Private Volunteer",
        "email": "vol@example.com",
        "phone": "555-9876",
        "role": "VOLUNTEER",
        "latitude": 12.9716,
        "longitude": 77.5946,
        "service_radius_km": 20,
        "alerts_enabled": True,
        "created_at": "2026-11-01T00:00:00Z"
    }
    mock_table = MagicMock()
    mock_table.select.return_value = mock_table
    mock_table.eq.return_value = mock_table
    mock_table.execute.return_value = MagicMock(data=[mock_user_db])
    monkeypatch.setattr(supabase_config.supabase, "table", MagicMock(return_value=mock_table))

    # 1. Citizen viewing volunteer's profile: coordinates and alert settings must be redacted
    app.dependency_overrides[get_current_user] = lambda: {
        "uid": "other-citizen", "email": "citizen@test.com", "name": "Citizen", "role": "CITIZEN"
    }
    try:
        res = client.get("/api/users/vol-private")
        assert res.status_code == 200
        data = res.json()
        assert data["latitude"] is None
        assert data["longitude"] is None
        assert data["serviceRadiusKm"] is None
        assert data["alertsEnabled"] is None
    finally:
        app.dependency_overrides.clear()

    # 2. Volunteer viewing their own profile: coordinates and radius are available
    app.dependency_overrides[get_current_user] = lambda: {
        "uid": "vol-private", "email": "vol@example.com", "name": "Private Volunteer", "role": "VOLUNTEER"
    }
    try:
        res_self = client.get("/api/users/vol-private")
        assert res_self.status_code == 200
        self_data = res_self.json()
        assert self_data["latitude"] == 12.9716
        assert self_data["longitude"] == 77.5946
        assert self_data["serviceRadiusKm"] == 20
        assert self_data["alertsEnabled"] is True
    finally:
        app.dependency_overrides.clear()


def test_nearby_responder_alert_haversine_dispatch(monkeypatch):
    from routers import rescues as rescues_module
    dispatched_notifications = []

    def mock_bulk(notifs):
        dispatched_notifications.extend(notifs)

    monkeypatch.setattr(rescues_module, "create_bulk_system_notifications", mock_bulk)

    # Mock Haversine RPC returning nearby responder within 15km
    mock_rpc = MagicMock()
    mock_rpc.execute.return_value = MagicMock(data=[
        {"id": "vol-nearby-1", "distance_km": 4.2},
        {"id": "vol-nearby-2", "distance_km": 11.5},
    ])
    monkeypatch.setattr(supabase_config.supabase, "rpc", MagicMock(return_value=mock_rpc))

    rescues_module.dispatch_nearby_responder_alerts(
        rescue_id="rescue-loc-1",
        species="DOG",
        severity="HIGH",
        latitude=12.97,
        longitude=77.59,
        address="Koramangala 4th Block",
        reporter_id="citizen-reporter",
    )

    # Verify RPC called with correct coordinates
    supabase_config.supabase.rpc.assert_called_with("get_nearby_responders", {
        "p_lat": 12.97,
        "p_lon": 77.59,
        "p_max_radius_km": 100,
    })

    # Verify notifications dispatched
    assert len(dispatched_notifications) == 2
    uids = {n["user_id"] for n in dispatched_notifications}
    assert uids == {"vol-nearby-1", "vol-nearby-2"}
    assert "HIGH" in dispatched_notifications[0]["title"]


def test_nearby_responder_alert_fallback_to_unconfigured_responders_only(monkeypatch):
    """
    When no location-configured responders are within range, dispatch must ONLY fallback
    to active responders whose latitude IS NULL and alerts_enabled is True.
    Responders with explicit coordinates set elsewhere must NOT receive out-of-range alerts.
    """
    from routers import rescues as rescues_module
    dispatched_notifications = []

    def mock_bulk(notifs):
        dispatched_notifications.extend(notifs)

    monkeypatch.setattr(rescues_module, "create_bulk_system_notifications", mock_bulk)

    # 1. Haversine RPC returns 0 responders in range
    mock_rpc = MagicMock()
    mock_rpc.execute.return_value = MagicMock(data=[])
    monkeypatch.setattr(supabase_config.supabase, "rpc", MagicMock(return_value=mock_rpc))

    # 2. Mock users table query with chained filters (.in_, .is_, .eq_)
    mock_query = MagicMock()
    mock_query.select.return_value = mock_query
    mock_query.in_.return_value = mock_query
    mock_query.is_.return_value = mock_query
    mock_query.eq.return_value = mock_query
    # Return unconfigured responder
    mock_query.execute.return_value = MagicMock(data=[
        {"id": "vol-no-location-1"},
        {"id": "citizen-reporter"}, # should be skipped as reporter
    ])
    monkeypatch.setattr(supabase_config.supabase, "table", MagicMock(return_value=mock_query))

    rescues_module.dispatch_nearby_responder_alerts(
        rescue_id="rescue-remote-1",
        species="CAT",
        severity="HIGH",
        latitude=28.7041,
        longitude=77.1025,
        address="Rural Outpost",
        reporter_id="citizen-reporter",
    )

    # Verify users table was filtered for latitude is null and alerts_enabled is True
    mock_query.is_.assert_called_with("latitude", "null")
    mock_query.eq.assert_called_with("alerts_enabled", True)

    # Reporter was excluded, only unconfigured volunteer was alerted
    assert len(dispatched_notifications) == 1
    assert dispatched_notifications[0]["user_id"] == "vol-no-location-1"


def test_patch_user_profile_returns_complete_camelcase_and_no_500_on_empty(monkeypatch):
    """Test that PATCH /api/users/{uid} maps snake_case DB columns to camelCase UserResponse,
    and returns 200 without 500 when no update fields are passed."""
    mock_user_db = {
        "id": "user-patch-1",
        "display_name": "Patch User",
        "email": "patch@example.com",
        "phone": "+1234567890",
        "role": "CITIZEN",
        "requested_role": "VOLUNTEER",
        "avatar_url": "https://example.com/avatar.png",
        "address": "123 Green Way",
        "bio": "Animal lover",
        "latitude": 13.0827,
        "longitude": 80.2707,
        "service_radius_km": 25,
        "alerts_enabled": True,
        "created_at": "2026-11-24T00:00:00Z",
    }
    mock_table = MagicMock()
    mock_table.select.return_value = mock_table
    mock_table.update.return_value = mock_table
    mock_table.eq.return_value = mock_table
    mock_table.execute.return_value = MagicMock(data=[mock_user_db])
    monkeypatch.setattr(supabase_config.supabase, "table", MagicMock(return_value=mock_table))

    app.dependency_overrides[get_current_user] = lambda: {
        "uid": "user-patch-1", "email": "patch@example.com", "name": "Patch User", "role": "CITIZEN"
    }
    try:
        # 1. Empty PATCH payload should return 200 with full UserResponse (including uid and camelCase)
        res_empty = client.patch("/api/users/user-patch-1", json={})
        assert res_empty.status_code == 200
        data_empty = res_empty.json()
        assert data_empty["uid"] == "user-patch-1"
        assert data_empty["displayName"] == "Patch User"
        assert data_empty["avatarUrl"] == "https://example.com/avatar.png"
        assert data_empty["requestedRole"] == "VOLUNTEER"
        assert data_empty["serviceRadiusKm"] == 25
        assert data_empty["alertsEnabled"] is True

        # 2. PATCH with recognized fields should return complete camelCase shape without blank strings
        res_update = client.patch("/api/users/user-patch-1", json={"displayName": "Updated Patch Name"})
        assert res_update.status_code == 200
        data_update = res_update.json()
        assert data_update["uid"] == "user-patch-1"
        assert data_update["displayName"] == "Updated Patch Name"
        assert data_update["avatarUrl"] == "https://example.com/avatar.png"
        assert data_update["requestedRole"] == "VOLUNTEER"
    finally:
        app.dependency_overrides.clear()


def test_nullable_db_columns_safe_in_lostfound_and_animals(monkeypatch):
    """Test that NULL values in database columns (lost_and_found.color, animals.vaccinations,
    is_neutered, images) do not trigger ResponseValidationError 500s."""
    # 1. Lost and found with NULL color and images
    mock_lf_row = {
        "id": "lf-null-1",
        "type": "LOST",
        "title": "Lost Cat",
        "description": "Missing tabby",
        "species": "CAT",
        "breed": None,
        "color": None, # NULL in DB
        "contact_phone": "+1234567890",
        "contact_email": None,
        "latitude": 12.9716,
        "longitude": 77.5946,
        "last_seen_address": "Indiranagar",
        "last_seen_date": "2026-11-20",
        "reporter_id": "rep-1",
        "images": None, # NULL in DB
        "status": "ACTIVE",
        "created_at": "2026-11-20T10:00:00Z",
        "updated_at": None,
    }
    mock_lf_table = MagicMock()
    mock_lf_table.select.return_value = mock_lf_table
    mock_lf_table.order.return_value = mock_lf_table
    mock_lf_table.range.return_value = mock_lf_table
    mock_lf_table.execute.return_value = MagicMock(data=[mock_lf_row])

    # 2. Animals with NULL vaccinations, is_neutered, images
    mock_animal_row = {
        "id": "animal-null-1",
        "name": "Stray Pup",
        "species": "DOG",
        "breed": None,
        "age_estimate": "3 months",
        "gender": "UNKNOWN",
        "weight": None,
        "health_status": "HEALTHY",
        "adoption_status": "AVAILABLE",
        "description": "Friendly pup",
        "vaccinations": None, # NULL in DB
        "is_neutered": None, # NULL in DB
        "special_needs": None,
        "shelter_id": "shelter-1",
        "surrendered_by": None,
        "images": None, # NULL in DB
        "created_at": "2026-11-20T10:00:00Z",
        "updated_at": None,
    }
    mock_animal_table = MagicMock()
    mock_animal_table.select.return_value = mock_animal_table
    mock_animal_table.neq.return_value = mock_animal_table
    mock_animal_table.order.return_value = mock_animal_table
    mock_animal_table.range.return_value = mock_animal_table
    mock_animal_table.execute.return_value = MagicMock(data=[mock_animal_row])

    def mock_table_router(table_name):
        if table_name == "lost_and_found":
            return mock_lf_table
        elif table_name == "animals":
            return mock_animal_table
        return MagicMock()

    monkeypatch.setattr(supabase_config.supabase, "table", mock_table_router)

    res_lf = client.get("/api/lostfound/")
    assert res_lf.status_code == 200
    lf_items = res_lf.json()
    assert len(lf_items) == 1
    assert lf_items[0]["color"] is None
    assert lf_items[0]["photoUrls"] == []

    res_anim = client.get("/api/animals/")
    assert res_anim.status_code == 200
    anim_items = res_anim.json()
    assert len(anim_items) == 1
    assert anim_items[0]["vaccinations"] == []
    assert anim_items[0]["isNeutered"] is False
    assert anim_items[0]["photos"] == []











