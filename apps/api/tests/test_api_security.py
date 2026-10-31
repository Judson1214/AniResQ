import pytest
from starlette.testclient import TestClient
from main import app
from auth import get_current_user

client = TestClient(app)

def test_root_endpoint():
    response = client.get("/")
    assert response.status_code == 200
    assert response.json()["status"] == "healthy"

def test_users_api_requires_auth():
    # Unauthenticated GET
    res_get = client.get("/api/users/non-existent-uid")
    assert res_get.status_code == 401 or res_get.status_code == 403

    # Unauthenticated POST
    res_post = client.post("/api/users", json={
        "uid": "test-uid",
        "email": "hacker@test.com",
        "displayName": "Hacker",
        "role": "ADMIN"
    })
    assert res_post.status_code == 401 or res_post.status_code == 403

    # Unauthenticated PATCH
    res_patch = client.patch("/api/users/test-uid", json={"displayName": "Hacker"})
    assert res_patch.status_code == 401 or res_patch.status_code == 403

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
        # A CITIZEN should NOT be allowed to insert an animal
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

def test_pagination_query_parameters():
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
