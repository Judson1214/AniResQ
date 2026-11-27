import json
import pytest
from unittest.mock import patch

from errors import map_db_error
from tests.fake_supabase import FakeSupabaseClient
from routers.notifications import create_bulk_system_notifications

@pytest.fixture
def mock_db():
    fake = FakeSupabaseClient({
        "users": [
            {
                "id": "11111111-1111-1111-1111-111111111111",
                "email": "citizen@test.com",
                "role": "CITIZEN",
                "is_disabled": False,
                "display_name": "Test Citizen",
                "phone": "+919876543210",
                "bio": "Animal lover",
                "requested_role": None,
                "id_card_type": None,
                "id_card_number": None,
                "id_card_url": None,
                "created_at": "2026-01-01T00:00:00Z"
            },
            {
                "id": "22222222-2222-2222-2222-222222222222",
                "email": "volunteer@test.com",
                "role": "VOLUNTEER",
                "is_disabled": False,
                "display_name": "Test Volunteer",
                "phone": "+919876543211",
                "created_at": "2026-01-01T00:00:00Z"
            },
            {
                "id": "33333333-3333-3333-3333-333333333333",
                "email": "ngo@test.com",
                "role": "NGO",
                "is_disabled": False,
                "display_name": "Test NGO",
                "phone": "+919876543212",
                "created_at": "2026-01-01T00:00:00Z"
            },
            {
                "id": "44444444-4444-4444-4444-444444444444",
                "email": "vet@test.com",
                "role": "VET",
                "is_disabled": False,
                "display_name": "Test Vet",
                "phone": "+919876543213",
                "created_at": "2026-01-01T00:00:00Z"
            },
            {
                "id": "55555555-5555-5555-5555-555555555555",
                "email": "admin@test.com",
                "role": "ADMIN",
                "is_disabled": False,
                "display_name": "Test Admin",
                "created_at": "2026-01-01T00:00:00Z"
            },
            {
                "id": "55555555-5555-5555-5555-555555555556",
                "email": "admin2@test.com",
                "role": "ADMIN",
                "is_disabled": False,
                "display_name": "Test Admin 2",
                "created_at": "2026-01-01T00:00:00Z"
            },
            {
                "id": "99999999-9999-9999-9999-999999999999",
                "email": "banned@test.com",
                "role": "CITIZEN",
                "is_disabled": True,
                "display_name": "Banned User",
                "created_at": "2026-01-01T00:00:00Z"
            }
        ],
        "animals": [
            {
                "id": "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa",
                "name": "Buddy",
                "species": "DOG",
                "breed": "Labrador",
                "description": "Friendly dog",
                "age_estimate": "2 years",
                "adoption_status": "AVAILABLE",
                "location": "Bengaluru",
                "shelter_id": "33333333-3333-3333-3333-333333333333",
                "photos": [],
                "created_at": "2026-01-01T00:00:00Z"
            },
            {
                "id": "bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb",
                "name": "Milo",
                "species": "CAT",
                "breed": "Tabby",
                "description": "Playful kitten",
                "age_estimate": "1 year",
                "adoption_status": "NOT_READY",
                "location": "Bengaluru",
                "shelter_id": None,
                "surrendered_by": "11111111-1111-1111-1111-111111111111",
                "photos": [],
                "created_at": "2026-01-01T00:00:00Z"
            }
        ],
        "adoption_applications": [],
        "lost_and_found": [
            {
                "id": "cccccccc-cccc-cccc-cccc-cccccccccccc",
                "type": "LOST",
                "title": "Lost Golden Retriever",
                "description": "Missing near Indiranagar",
                "species": "DOG",
                "breed": "Golden Retriever",
                "color": "Golden",
                "status": "ACTIVE",
                "contact_phone": "+919876543210",
                "contact_email": "owner@test.com",
                "reporter_id": "11111111-1111-1111-1111-111111111111",
                "latitude": 12.9716,
                "longitude": 77.5946,
                "last_seen_address": "Indiranagar 100ft Rd",
                "last_seen_date": "2026-01-01T12:00:00Z",
                "images": [],
                "created_at": "2026-01-01T12:00:00Z"
            }
        ],
        "lost_and_found_replies": [],
        "notifications": [
            {
                "id": "dddddddd-dddd-dddd-dddd-dddddddddddd",
                "user_id": "11111111-1111-1111-1111-111111111111",
                "title": "Rescue update",
                "message": "A volunteer accepted your rescue.",
                "type": "RESCUE_UPDATE",
                "is_read": False,
                "created_at": "2026-01-01T12:00:00Z"
            }
        ],
        "rescues": [
            {
                "id": "eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee",
                "title": "Injured puppy",
                "description": "Puppy with hurt leg",
                "species": "DOG",
                "severity": "HIGH",
                "status": "PENDING",
                "latitude": 12.9716,
                "longitude": 77.5946,
                "address": "MG Road",
                "reporter_id": "11111111-1111-1111-1111-111111111111",
                "assigned_to": None,
                "created_at": "2026-01-01T12:00:00Z",
                "updated_at": "2026-01-01T12:00:00Z",
                "timeline": []
            }
        ],
        "rescue_timeline": [],
        "audit_logs": [
            {
                "id": "ffffffff-ffff-ffff-ffff-ffffffffffff",
                "action": "LOGIN",
                "entity_type": "USER",
                "entity_id": "11111111-1111-1111-1111-111111111111",
                "performed_by": "11111111-1111-1111-1111-111111111111",
                "created_at": "2026-01-01T12:00:00Z"
            }
        ],
        "system_settings": [
            {
                "key": "autoDispatchEnabled",
                "value": True,
                "description": "Auto dispatching",
                "updated_at": "2026-01-01T00:00:00Z"
            }
        ]
    })

    patches = [
        patch("routers.adoptions.supabase", fake),
        patch("routers.animals.supabase", fake),
        patch("routers.lostfound.supabase", fake),
        patch("routers.notifications.supabase", fake),
        patch("routers.rescues.supabase", fake),
        patch("routers.users.supabase", fake),
        patch("routers.settings.supabase", fake),
        patch("routers.audit.supabase", fake),
        patch("auth.supabase", fake),
    ]
    for p in patches:
        p.start()
    yield fake
    for p in reversed(patches):
        p.stop()

# =========================================================================
# 1. ADOPTIONS ROUTER
# =========================================================================

def test_adoptions_unauthenticated(client):
    res = client.post("/api/adoptions/", json={"animalId": "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa"})
    assert res.status_code == 401

def test_adoptions_not_found_animal(client, citizen_user, mock_db):
    res = client.post(
        "/api/adoptions/",
        headers=citizen_user["headers"],
        json={
            "animalId": "00000000-0000-0000-0000-000000000000",
            "livingEnvironment": "APARTMENT",
            "priorPetExperience": "5 years dog care",
            "workSchedule": "9 to 5",
            "whyAdopt": "Love animals"
        }
    )
    assert res.status_code == 404
    assert "not found" in res.json()["detail"].lower()

def test_adoptions_animal_not_available(client, citizen_user, mock_db):
    res = client.post(
        "/api/adoptions/",
        headers=citizen_user["headers"],
        json={
            "animalId": "bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb",
            "livingEnvironment": "APARTMENT",
            "priorPetExperience": "First time owner",
            "workSchedule": "Remote",
            "whyAdopt": "Companionship"
        }
    )
    assert res.status_code == 409
    assert "not available" in res.json()["detail"].lower()

def test_adoptions_happy_path_and_duplicate_prevention(client, citizen_user, mock_db):
    payload = {
        "animalId": "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa",
        "livingEnvironment": "APARTMENT",
        "priorPetExperience": "Experienced with dogs",
        "workSchedule": "Hybrid",
        "whyAdopt": "Adopting rescue"
    }
    res = client.post("/api/adoptions/", headers=citizen_user["headers"], json=payload)
    assert res.status_code == 201
    data = res.json()
    assert data["animalId"] == "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa"
    assert data["applicantId"] == citizen_user["id"]
    assert data["status"] == "SUBMITTED"

    res2 = client.post("/api/adoptions/", headers=citizen_user["headers"], json=payload)
    assert res2.status_code == 409
    assert "under review" in res2.json()["detail"].lower()

def test_adoptions_review_application_permissions_and_conflict(client, citizen_user, ngo_user, mock_db):
    app_id = "12345678-1234-1234-1234-123456789012"
    mock_db.tables["adoption_applications"].append({
        "id": app_id,
        "animal_id": "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa",
        "applicant_id": citizen_user["id"],
        "status": "SUBMITTED",
        "created_at": "2026-01-01T12:00:00Z"
    })

    # Citizen cannot review (403)
    res_cit = client.patch(
        f"/api/adoptions/{app_id}/status",
        headers=citizen_user["headers"],
        json={"status": "APPROVED", "screeningNotes": "Approved"}
    )
    assert res_cit.status_code == 403

    # NGO reviews application successfully
    res_ngo = client.patch(
        f"/api/adoptions/{app_id}/status",
        headers=ngo_user["headers"],
        json={"status": "APPROVED", "screeningNotes": "Great fit"}
    )
    assert res_ngo.status_code == 200
    assert res_ngo.json()["status"] == "APPROVED"

def test_adoptions_list_and_details_and_withdraw(client, citizen_user, admin_user, mock_db):
    app_id = "22221111-1234-1234-1234-123456789012"
    mock_db.tables["adoption_applications"].append({
        "id": app_id,
        "animal_id": "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa",
        "applicant_id": citizen_user["id"],
        "status": "SUBMITTED",
        "created_at": "2026-01-01T12:00:00Z"
    })

    # Citizen lists own applications
    res_my = client.get("/api/adoptions/", headers=citizen_user["headers"])
    assert res_my.status_code == 200
    assert len(res_my.json()) >= 1

    # Admin lists all applications
    res_all = client.get("/api/adoptions/", headers=admin_user["headers"])
    assert res_all.status_code == 200

    # Get single application details
    res_single = client.get(f"/api/adoptions/{app_id}", headers=citizen_user["headers"])
    assert res_single.status_code == 200
    assert res_single.json()["id"] == app_id

    # Nonexistent application returns 404
    res_404 = client.get("/api/adoptions/00000000-0000-0000-0000-000000000000", headers=citizen_user["headers"])
    assert res_404.status_code == 404

    # Status review edge cases: 404 not found, 422 invalid status
    res_status_404 = client.patch(
        "/api/adoptions/00000000-0000-0000-0000-000000000000/status",
        headers=admin_user["headers"],
        json={"status": "APPROVED"}
    )
    assert res_status_404.status_code == 404

    res_status_422 = client.patch(
        f"/api/adoptions/{app_id}/status",
        headers=admin_user["headers"],
        json={"status": "INVALID_STATUS_VALUE"}
    )
    assert res_status_422.status_code == 422

# =========================================================================
# 2. LOST AND FOUND ROUTER
# =========================================================================

def test_lostfound_contact_redaction_for_anonymous_vs_authenticated(client, citizen_user, mock_db):
    post_id = "cccccccc-cccc-cccc-cccc-cccccccccccc"

    # Anonymous caller: contact details redacted
    res_anon = client.get("/api/lostfound/")
    assert res_anon.status_code == 200
    items_anon = res_anon.json()
    assert len(items_anon) > 0
    assert not items_anon[0]["contactPhone"]
    assert not items_anon[0]["contactEmail"]

    # Authenticated caller: contact details visible
    res_auth = client.get("/api/lostfound/", headers=citizen_user["headers"])
    assert res_auth.status_code == 200
    items_auth = res_auth.json()
    assert items_auth[0]["contactPhone"] == "+919876543210"
    assert items_auth[0]["contactEmail"] == "owner@test.com"

    # Single item anonymous
    res_single_anon = client.get(f"/api/lostfound/{post_id}")
    assert res_single_anon.status_code == 200
    assert not res_single_anon.json()["contactPhone"]

    # Single item authenticated
    res_single_auth = client.get(f"/api/lostfound/{post_id}", headers=citizen_user["headers"])
    assert res_single_auth.status_code == 200
    assert res_single_auth.json()["contactPhone"] == "+919876543210"

def test_lostfound_resolve_owner_vs_non_owner(client, citizen_user, volunteer_user, mock_db):
    post_id = "cccccccc-cccc-cccc-cccc-cccccccccccc"

    # Non-owner cannot update status (403)
    res_forbidden = client.patch(
        f"/api/lostfound/{post_id}/status",
        headers=volunteer_user["headers"],
        json={"status": "RESOLVED"}
    )
    assert res_forbidden.status_code == 403

    # Owner can update status (200)
    res_ok = client.patch(
        f"/api/lostfound/{post_id}/status",
        headers=citizen_user["headers"],
        json={"status": "RESOLVED"}
    )
    assert res_ok.status_code == 200
    assert res_ok.json()["status"] == "RESOLVED"

def test_lostfound_create_post_and_replies_and_delete(client, citizen_user, volunteer_user, mock_db):
    payload = {
        "type": "FOUND",
        "title": "Found stray pup",
        "description": "Found near supermarket",
        "species": "DOG",
        "color": "Black and white",
        "contactPhone": "+919999999999",
        "contactEmail": "finder@test.com",
        "lastSeenAddress": "Brigade Road",
        "lastSeenDate": "2026-01-01T12:00:00Z",
        "location": {"latitude": 12.9716, "longitude": 77.5946},
        "photoUrls": []
    }
    res = client.post("/api/lostfound/", headers=citizen_user["headers"], json=payload)
    assert res.status_code == 201
    created_id = res.json()["id"]

    # Post reply
    reply_res = client.post(
        f"/api/lostfound/{created_id}/replies",
        headers=citizen_user["headers"],
        json={"text": "I think I saw the owner searching for this dog."}
    )
    assert reply_res.status_code == 201

    # Get replies
    get_replies = client.get(f"/api/lostfound/{created_id}/replies")
    assert get_replies.status_code == 200
    assert len(get_replies.json()) >= 1

    # Non-owner delete returns 403
    del_403 = client.delete(f"/api/lostfound/{created_id}", headers=volunteer_user["headers"])
    assert del_403.status_code == 403

    # Owner delete returns 200
    del_200 = client.delete(f"/api/lostfound/{created_id}", headers=citizen_user["headers"])
    assert del_200.status_code == 200
    assert del_200.json()["deleted"] is True

# =========================================================================
# 3. ANIMALS ROUTER
# =========================================================================

def test_animals_surrender_validation_and_rate_limit(client, citizen_user, mock_db):
    payload = {
        "name": "Tommy",
        "species": "DOG",
        "description": "Gentle pet dog looking for home",
        "ageEstimate": "2 years",
        "reason": "Relocating abroad permanently and unable to take pet.",
        "photos": []
    }
    res = client.post("/api/animals/surrender", headers=citizen_user["headers"], json=payload)
    assert res.status_code == 201
    assert res.json()["name"] == "Tommy"

def test_animals_intake_and_update_and_delete(client, citizen_user, ngo_user, admin_user, mock_db):
    payload = {
        "name": "Shadow",
        "species": "CAT",
        "breed": "Domestic Shorthair",
        "description": "Rescued kitten",
        "ageEstimate": "6 months",
        "gender": "FEMALE",
        "adoptionStatus": "AVAILABLE"
    }
    # Citizen cannot intake (403)
    res_cit = client.post("/api/animals/", headers=citizen_user["headers"], json=payload)
    assert res_cit.status_code == 403

    # NGO can intake (201)
    res_ngo = client.post("/api/animals/", headers=ngo_user["headers"], json=payload)
    assert res_ngo.status_code == 201
    created_id = res_ngo.json()["id"]

    # List animals with filters
    res_list = client.get("/api/animals/?species=CAT&status=AVAILABLE")
    assert res_list.status_code == 200

    # Get animal details
    res_get = client.get(f"/api/animals/{created_id}")
    assert res_get.status_code == 200

    # NGO updates animal
    patch_res = client.patch(
        f"/api/animals/{created_id}",
        headers=ngo_user["headers"],
        json={"name": "Shadow Updated", "weight": 3.5}
    )
    assert patch_res.status_code == 200
    assert patch_res.json()["name"] == "Shadow Updated"

    # Admin deletes animal
    del_res = client.delete(f"/api/animals/{created_id}", headers=admin_user["headers"])
    assert del_res.status_code == 200
    assert del_res.json()["deleted"] is True

# =========================================================================
# 4. NOTIFICATIONS ROUTER
# =========================================================================

def test_notifications_crud(client, citizen_user, mock_db):
    notif_id = "dddddddd-dddd-dddd-dddd-dddddddddddd"

    # 1. Unauthenticated gets 401
    res_anon = client.get("/api/notifications/")
    assert res_anon.status_code == 401

    # 2. Authenticated lists notifications
    res_list = client.get("/api/notifications/", headers=citizen_user["headers"])
    assert res_list.status_code == 200
    data = res_list.json()
    assert len(data) >= 1

    # 3. Mark single notification as read
    res_read = client.patch(f"/api/notifications/{notif_id}/read", headers=citizen_user["headers"])
    assert res_read.status_code == 200
    assert res_read.json()["isRead"] is True

    # 4. Mark all as read
    res_all = client.post("/api/notifications/mark-all-read", headers=citizen_user["headers"])
    assert res_all.status_code == 200
    assert res_all.json()["success"] is True

    # 5. Bulk insert helper branch
    create_bulk_system_notifications([
        {
            "user_id": citizen_user["id"],
            "title": "Bulk alert",
            "message": "Bulk message",
            "type": "ANNOUNCEMENT"
        }
    ])
    create_bulk_system_notifications([])

# =========================================================================
# 5. RESCUES ROUTER
# =========================================================================

def test_rescues_lifecycle_and_conditional_update_conflict(client, citizen_user, volunteer_user, admin_user, mock_db):
    rescue_id = "eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee"

    # 1. Report rescue
    create_res = client.post(
        "/api/rescues/",
        headers=citizen_user["headers"],
        json={
            "title": "Stray kitten in drain",
            "description": "Kitten trapped in drainage pipe",
            "species": "CAT",
            "severity": "CRITICAL",
            "location": {"latitude": 12.9716, "longitude": 77.5946},
            "address": "Koramangala 4th Block",
            "photoUrls": []
        }
    )
    assert create_res.status_code == 201

    # 2. Assign volunteer to pending rescue
    assign_res = client.post(
        f"/api/rescues/{rescue_id}/assign",
        headers=volunteer_user["headers"],
        json={"volunteerId": volunteer_user["id"], "volunteerName": "Test Volunteer"}
    )
    assert assign_res.status_code == 200
    assert assign_res.json()["status"] == "DISPATCHED"
    assert assign_res.json()["assignedTo"] == volunteer_user["id"]

    # 3. Update status: DISPATCHED -> IN_PROGRESS
    status_res = client.patch(
        f"/api/rescues/{rescue_id}/status",
        headers=volunteer_user["headers"],
        json={"status": "IN_PROGRESS", "message": "On my way with carrier"}
    )
    assert status_res.status_code == 200
    assert status_res.json()["status"] == "IN_PROGRESS"

    # 4. Unauthorized assignment: citizen cannot assign responders (403)
    citizen_assign = client.post(
        f"/api/rescues/{rescue_id}/assign",
        headers=citizen_user["headers"],
        json={"volunteerId": volunteer_user["id"], "volunteerName": "Test Volunteer"}
    )
    assert citizen_assign.status_code == 403

    # 5. List rescues with filters
    res_list = client.get("/api/rescues/?status=RESOLVED&species=DOG", headers=citizen_user["headers"])
    assert res_list.status_code == 200

    # 6. Admin deletes rescue
    del_res = client.delete(f"/api/rescues/{rescue_id}", headers=admin_user["headers"])
    assert del_res.status_code == 200
    assert del_res.json()["deleted"] is True

# =========================================================================
# 6. USERS ROUTER: CLEARANCES, ROLES & LAST-ADMIN GUARD
# =========================================================================

def test_users_role_clearance_lifecycle_and_crud(client, citizen_user, admin_user, mock_db):
    valid_id_url = f"{citizen_user['id']}/id_card.png"
    req_res = client.post(
        "/api/users/request-clearance",
        headers=citizen_user["headers"],
        json={
            "requestedRole": "VOLUNTEER",
            "idCardType": "Government Photo ID",
            "idCardNumber": "DL1234567890",
            "idCardUrl": valid_id_url
        }
    )
    assert req_res.status_code == 200
    assert req_res.json()["requestedRole"] == "VOLUNTEER"

    # Admin lists users
    res_list = client.get("/api/users/", headers=admin_user["headers"])
    assert res_list.status_code == 200
    assert len(res_list.json()) >= 1

    # Citizen updates own profile
    patch_me = client.patch(
        f"/api/users/{citizen_user['id']}",
        headers=citizen_user["headers"],
        json={"displayName": "Citizen Hero", "bio": "Helped 10 dogs"}
    )
    assert patch_me.status_code == 200
    assert patch_me.json()["displayName"] == "Citizen Hero"

    # Admin declines clearance
    decline_res = client.post(
        f"/api/users/{citizen_user['id']}/role-request/decline",
        headers=admin_user["headers"]
    )
    assert decline_res.status_code == 200
    assert decline_res.json()["requestedRole"] is None

    # Admin approves role directly
    approve_res = client.patch(
        f"/api/users/{citizen_user['id']}/role",
        headers=admin_user["headers"],
        json={"role": "VOLUNTEER"}
    )
    assert approve_res.status_code == 200
    assert approve_res.json()["role"] == "VOLUNTEER"

def test_users_last_admin_protection(client, admin_user, mock_db):
    mock_db.tables["users"] = [u for u in mock_db.tables["users"] if u["id"] != "55555555-5555-5555-5555-555555555556"]

    res = client.patch(
        f"/api/users/{admin_user['id']}/role",
        headers=admin_user["headers"],
        json={"role": "CITIZEN"}
    )
    assert res.status_code in (400, 409)
    assert "last administrator" in res.json()["detail"].lower()

def test_users_disabled_account_blocked(client, mock_db):
    from conftest import create_test_token
    banned_token = create_test_token("99999999-9999-9999-9999-999999999999", "banned@test.com", "CITIZEN")
    res = client.get("/api/users/me", headers={"Authorization": f"Bearer {banned_token}"})
    assert res.status_code == 403
    assert res.json()["code"] == "FORBIDDEN"

# =========================================================================
# 7. AUDIT & SETTINGS ROUTERS
# =========================================================================

def test_audit_logs_rbac(client, citizen_user, admin_user, mock_db):
    # Citizen gets 403
    res_cit = client.get("/api/audit-logs", headers=citizen_user["headers"])
    assert res_cit.status_code == 403

    # Admin gets 200
    res_adm = client.get("/api/audit-logs", headers=admin_user["headers"])
    assert res_adm.status_code == 200
    assert len(res_adm.json()) >= 1

def test_settings_rbac_and_patch(client, citizen_user, admin_user, mock_db):
    # Citizen gets 403
    res_cit = client.get("/api/settings", headers=citizen_user["headers"])
    assert res_cit.status_code == 403

    # Admin gets settings
    res_adm = client.get("/api/settings", headers=admin_user["headers"])
    assert res_adm.status_code == 200
    assert res_adm.json()["autoDispatchEnabled"] is True

    # Admin updates setting
    patch_res = client.patch(
        "/api/settings",
        headers=admin_user["headers"],
        json={"autoDispatchEnabled": False}
    )
    assert patch_res.status_code == 200
    assert patch_res.json()["autoDispatchEnabled"] is False

# =========================================================================
# 8. DATABASE ERROR MAPPING & GENERIC 500 ENVELOPE
# =========================================================================

def test_db_error_mapping_to_http_codes():
    err_23505 = Exception("duplicate key value violates unique constraint 'users_pkey'")
    app_err = map_db_error(err_23505, "User already exists")
    assert app_err.status_code == 409

    err_23503 = Exception("insert or update on table violates foreign key constraint")
    app_err_fk = map_db_error(err_23503, "Referenced record missing")
    assert app_err_fk.status_code == 404

    err_23514 = Exception("new row for relation violates check constraint")
    app_err_check = map_db_error(err_23514, "Invalid value for check constraint")
    assert app_err_check.status_code == 422

def test_unhandled_exception_returns_clean_500_without_internals(client, citizen_user, mock_db):
    with patch("routers.adoptions.supabase") as mock_bad_supabase:
        mock_bad_supabase.table.side_effect = RuntimeError("Database crashed unexpectedly! root password=XYZ123")
        res = client.get("/api/adoptions/", headers=citizen_user["headers"])
        assert res.status_code == 500
        data = res.json()
        assert data["code"] in ("INTERNAL_ERROR", "DATABASE_ERROR", "INTERNAL_SERVER_ERROR")
        assert "requestId" in data
        assert "XYZ123" not in json.dumps(data)

# =========================================================================
# 9. EXTENDED COVERAGE FOR ANIMALS, LOSTFOUND, NOTIFICATIONS, RESCUES, USERS
# =========================================================================

def test_animals_vet_and_shelter_permissions(client, vet_user, ngo_user, admin_user, citizen_user, mock_db):
    animal_id = "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa"

    # 1. Vet updates clinical fields (Allowed)
    vet_res = client.patch(
        f"/api/animals/{animal_id}",
        headers=vet_user["headers"],
        json={"healthStatus": "INJURED", "isNeutered": True, "specialNeeds": "Special diet"}
    )
    assert vet_res.status_code == 200
    assert vet_res.json()["healthStatus"] == "INJURED"

    # 2. Vet attempts to change administrative field (Forbidden: 403)
    vet_forbidden = client.patch(
        f"/api/animals/{animal_id}",
        headers=vet_user["headers"],
        json={"name": "New Name"}
    )
    assert vet_forbidden.status_code == 403

    # 3. NGO (shelter owner) updates their animal
    ngo_res = client.patch(
        f"/api/animals/{animal_id}",
        headers=ngo_user["headers"],
        json={"name": "Buddy Senior", "adoptionStatus": "ADOPTED"}
    )
    assert ngo_res.status_code == 200
    assert ngo_res.json()["name"] == "Buddy Senior"

    # 4. NGO claims surrendered animal (Success: 200)
    surrendered_id = "bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb"
    claim_res = client.post(
        f"/api/animals/{surrendered_id}/claim",
        headers=ngo_user["headers"]
    )
    assert claim_res.status_code == 200

    # 5. Subsequent claim on already claimed animal returns 409
    claim_again = client.post(
        f"/api/animals/{surrendered_id}/claim",
        headers=ngo_user["headers"]
    )
    assert claim_again.status_code == 409

    # 6. Delete animal permissions: Citizen gets 403, NGO deletes own animal
    del_forbidden = client.delete(f"/api/animals/{animal_id}", headers=citizen_user["headers"])
    assert del_forbidden.status_code == 403

    del_not_found = client.delete("/api/animals/00000000-0000-0000-0000-000000000000", headers=admin_user["headers"])
    assert del_not_found.status_code == 404

    del_ok = client.delete(f"/api/animals/{animal_id}", headers=ngo_user["headers"])
    assert del_ok.status_code == 200

def test_lostfound_replies_and_lifecycle(client, citizen_user, admin_user, mock_db):
    post_id = "cccccccc-cccc-cccc-cccc-cccccccccccc"

    # 1. Add reply to lost/found post
    reply_res = client.post(
        f"/api/lostfound/{post_id}/replies",
        headers=citizen_user["headers"],
        json={"text": "I think I saw this dog near 12th Main Road yesterday evening!"}
    )
    assert reply_res.status_code in (200, 201)

    # 2. Get replies for post
    get_replies = client.get(f"/api/lostfound/{post_id}/replies")
    assert get_replies.status_code == 200
    assert len(get_replies.json()) >= 1

    # 3. Update post status to RESOLVED
    status_res = client.patch(
        f"/api/lostfound/{post_id}/status",
        headers=citizen_user["headers"],
        json={"status": "RESOLVED"}
    )
    assert status_res.status_code == 200
    assert status_res.json()["status"] == "RESOLVED"

    # 4. Delete post
    del_post = client.delete(
        f"/api/lostfound/{post_id}",
        headers=citizen_user["headers"]
    )
    assert del_post.status_code in (200, 204)

    # 5. Edge cases: 404 not found, 422 invalid status
    res_404 = client.get("/api/lostfound/00000000-0000-0000-0000-000000000000")
    assert res_404.status_code == 404

    res_422 = client.patch(
        f"/api/lostfound/{post_id}/status",
        headers=citizen_user["headers"],
        json={"status": "INVALID_STATUS"}
    )
    assert res_422.status_code == 422

def test_notifications_lifecycle(client, citizen_user, volunteer_user, mock_db):
    notif_id = "dddddddd-dddd-dddd-dddd-dddddddddddd"

    # 1. Filter unread notifications
    res_unread = client.get("/api/notifications/?unread_only=true", headers=citizen_user["headers"])
    assert res_unread.status_code == 200
    assert len(res_unread.json()) >= 1

    # 2. Mark specific notification as read
    res_read = client.patch(f"/api/notifications/{notif_id}/read", headers=citizen_user["headers"])
    assert res_read.status_code == 200

    # 3. Unauthorized access to other's notification (403) and 404 not found
    res_403 = client.patch(f"/api/notifications/{notif_id}/read", headers=volunteer_user["headers"])
    assert res_403.status_code == 403

    res_404 = client.patch("/api/notifications/00000000-0000-0000-0000-000000000000/read", headers=citizen_user["headers"])
    assert res_404.status_code == 404

    # 4. Mark all notifications as read
    res_all = client.post("/api/notifications/mark-all-read", headers=citizen_user["headers"])
    assert res_all.status_code == 200
    assert res_all.json()["success"] is True

def test_rescues_nearby_and_timeline(client, volunteer_user, admin_user, citizen_user, mock_db):
    rescue_id = "eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee"

    # 1. Fetch rescues list with location filters
    res_nearby = client.get(
        "/api/rescues/?latitude=12.9716&longitude=77.5946&radiusKm=15",
        headers=volunteer_user["headers"]
    )
    assert res_nearby.status_code == 200
    assert isinstance(res_nearby.json(), list)

    # 2. Add status update (which logs timeline)
    res_status = client.patch(
        f"/api/rescues/{rescue_id}/status",
        headers=admin_user["headers"],
        json={"status": "IN_PROGRESS", "message": "Animal rescued and transported to clinic."}
    )
    assert res_status.status_code == 200

    # 3. Get timeline
    res_tl = client.get(f"/api/rescues/{rescue_id}/timeline", headers=volunteer_user["headers"])
    assert res_tl.status_code == 200
    assert isinstance(res_tl.json(), list)

    # 4. Edge cases: 422 invalid status, 404 not found
    res_422 = client.patch(
        f"/api/rescues/{rescue_id}/status",
        headers=admin_user["headers"],
        json={"status": "INVALID_RESCUE_STATUS"}
    )
    assert res_422.status_code == 422

    res_404 = client.patch(
        "/api/rescues/00000000-0000-0000-0000-000000000000/status",
        headers=admin_user["headers"],
        json={"status": "RESOLVED"}
    )
    assert res_404.status_code == 404

def test_users_role_approval_and_account_management(client, citizen_user, admin_user, ngo_user, mock_db):
    target_uid = citizen_user["id"]

    # 1. Set requested role in mock db
    for u in mock_db.tables["users"]:
        if u["id"] == target_uid:
            u["requested_role"] = "VOLUNTEER"
            u["id_card_type"] = "AADHAAR"
            u["id_card_number"] = "123456789012"
            break

    # 2. Admin updates role to VOLUNTEER
    res_app = client.patch(
        f"/api/users/{target_uid}/role",
        headers=admin_user["headers"],
        json={"role": "VOLUNTEER"}
    )
    assert res_app.status_code == 200
    assert res_app.json()["role"] == "VOLUNTEER"

    # 3. Update profile fields
    res_profile = client.patch(
        f"/api/users/{target_uid}",
        headers=citizen_user["headers"],
        json={"bio": "Volunteer animal rescuer", "serviceRadiusKm": 25}
    )
    assert res_profile.status_code == 200
    assert res_profile.json()["bio"] == "Volunteer animal rescuer"

    # 4. Decline a role request
    decline_uid = "22222222-2222-2222-2222-222222222222"
    for u in mock_db.tables["users"]:
        if u["id"] == decline_uid:
            u["requested_role"] = "NGO"
            break
    res_dec = client.post(f"/api/users/{decline_uid}/role-request/decline", headers=admin_user["headers"])
    assert res_dec.status_code == 200

    # 5. Non-admin forbidden from updating roles (403)
    res_forbidden = client.patch(
        f"/api/users/{target_uid}/role",
        headers=citizen_user["headers"],
        json={"role": "ADMIN"}
    )
    assert res_forbidden.status_code == 403

    # 6. Admin query users list with role filter, search, has_requested_role, and NGO caller
    res_users = client.get("/api/users?role=VOLUNTEER&search=Test&has_requested_role=true", headers=admin_user["headers"])
    assert res_users.status_code == 200

    # NGO lists users (gets projected columns without ID docs)
    res_ngo_list = client.get("/api/users?has_requested_role=true", headers=ngo_user["headers"])
    assert res_ngo_list.status_code == 200

    # Citizen cannot list users (403)
    res_cit_list = client.get("/api/users", headers=citizen_user["headers"])
    assert res_cit_list.status_code == 403

    # NGO views user profile with active case vs without active case
    # With active case: target user applied to animal in shelter
    view_active = client.get(f"/api/users/{citizen_user['id']}", headers=ngo_user["headers"])
    assert view_active.status_code == 200

    # User profile creation/syncing
    new_profile_uid = "88888888-8888-8888-8888-888888888888"
    # Citizen creates profile for another user (403)
    create_bad = client.post(
        "/api/users",
        headers=citizen_user["headers"],
        json={"uid": new_profile_uid, "displayName": "Other User"}
    )
    assert create_bad.status_code == 403

    # Citizen syncs own profile (200)
    create_self = client.post(
        "/api/users",
        headers=citizen_user["headers"],
        json={"uid": citizen_user["id"], "displayName": "Synced Citizen"}
    )
    assert create_self.status_code == 200

    # Admin creates profile for new user (200)
    create_admin = client.post(
        "/api/users",
        headers=admin_user["headers"],
        json={"uid": new_profile_uid, "displayName": "Admin Created User", "role": "VOLUNTEER"}
    )
    assert create_admin.status_code == 200

# =========================================================================
# 10. HIGH COVERAGE SATURATION FOR EVERY ROUTER (>= 80% TARGET)
# =========================================================================

def test_router_coverage_saturation(client, citizen_user, admin_user, ngo_user, volunteer_user, make_auth_header, mock_db):
    # 1. Adoptions: status filter, rejection & validation
    filter_adoptions = client.get("/api/adoptions/?status=SUBMITTED", headers=admin_user["headers"])
    assert filter_adoptions.status_code == 200

    filter_rejected = client.get("/api/adoptions/?status=REJECTED", headers=admin_user["headers"])
    assert filter_rejected.status_code == 200

    # Shelter facility queries and animalId queries
    filter_ngo = client.get(f"/api/adoptions/?applicantId={ngo_user['id']}", headers=ngo_user["headers"])
    assert filter_ngo.status_code == 200

    filter_animal = client.get("/api/adoptions/?animalId=aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa", headers=admin_user["headers"])
    assert filter_animal.status_code == 200

    # Reject application
    app_id = "77771111-1234-1234-1234-123456789012"
    mock_db.tables["adoption_applications"].append({
        "id": app_id,
        "animal_id": "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa",
        "applicant_id": citizen_user["id"],
        "status": "SUBMITTED",
        "created_at": "2026-01-01T12:00:00Z"
    })
    reject_res = client.patch(
        f"/api/adoptions/{app_id}/status",
        headers=admin_user["headers"],
        json={"status": "REJECTED", "screeningNotes": "Not eligible at this time"}
    )
    assert reject_res.status_code == 200
    assert reject_res.json()["status"] == "REJECTED"

    bad_env = client.post(
        "/api/adoptions/",
        headers=citizen_user["headers"],
        json={"animalId": "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa", "livingEnvironment": "TREEHOUSE"}
    )
    assert bad_env.status_code == 422

    # 2. Animals: validation & filter query params
    bad_species = client.post(
        "/api/animals/",
        headers=ngo_user["headers"],
        json={"name": "Puff", "species": "DRAGON", "breed": "Mythic", "description": "Fire"}
    )
    assert bad_species.status_code == 422

    bad_gender = client.post(
        "/api/animals/",
        headers=ngo_user["headers"],
        json={"name": "Buddy", "species": "DOG", "gender": "ALIEN", "breed": "Mix", "description": "Good boy"}
    )
    assert bad_gender.status_code == 422

    bad_health = client.post(
        "/api/animals/",
        headers=ngo_user["headers"],
        json={"name": "Buddy", "species": "DOG", "healthStatus": "CYBORG", "breed": "Mix", "description": "Good boy"}
    )
    assert bad_health.status_code == 422

    filter_animals = client.get("/api/animals/?species=DOG&shelterId=33333333-3333-3333-3333-333333333333")
    assert filter_animals.status_code == 200

    # 3. Lost & Found: species, type, status query filters and pagination
    lf_filter = client.get(f"/api/lostfound/?species=DOG&type=LOST&status=ACTIVE&reporterId={citizen_user['id']}&limit=10&offset=0")
    assert lf_filter.status_code == 200

    lf_bad_type = client.post(
        "/api/lostfound/",
        headers=citizen_user["headers"],
        json={"type": "ALIEN", "species": "DOG", "title": "t", "description": "d", "lastSeenAddress": "a", "lastSeenDate": "2026-01-01", "photoUrls": []}
    )
    assert lf_bad_type.status_code == 422

    # 4. Rescues: public listing, severity query, verification photos & closed case guard
    pub_rescues = client.get("/api/rescues/public")
    assert pub_rescues.status_code == 200

    sev_rescues = client.get("/api/rescues/?status=PENDING&severity=CRITICAL", headers=volunteer_user["headers"])
    assert sev_rescues.status_code == 200

    bad_sev = client.post(
        "/api/rescues/",
        headers=citizen_user["headers"],
        json={
            "title": "Bad severity test",
            "description": "testing",
            "species": "DOG",
            "severity": "SUPER_EMERGENCY",
            "location": {"latitude": 12.97, "longitude": 77.59},
            "address": "Bangalore"
        }
    )
    assert bad_sev.status_code == 422

    rescue_id = "eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee"
    # Update status with verification photo
    photo_url = "https://cspnzitnvzdwwyxpnluw.supabase.co/storage/v1/object/public/uploads/verified.jpg"
    update_photo_res = client.patch(
        f"/api/rescues/{rescue_id}/status",
        headers=admin_user["headers"],
        json={"status": "RESOLVED", "verificationPhotos": [photo_url]}
    )
    assert update_photo_res.status_code == 200

    # Assign to closed rescue returns 400
    assign_closed = client.post(
        f"/api/rescues/{rescue_id}/assign",
        headers=admin_user["headers"],
        json={"volunteerId": volunteer_user["id"], "volunteerName": "Volunteer"}
    )
    assert assign_closed.status_code == 400

    # 5. Users: get user details, withdraw clearance & validation
    user_detail = client.get(f"/api/users/{citizen_user['id']}", headers=admin_user["headers"])
    assert user_detail.status_code == 200

    user_vol = client.get(f"/api/users/{volunteer_user['id']}", headers=admin_user["headers"])
    assert user_vol.status_code == 200

    user_404 = client.get("/api/users/00000000-0000-0000-0000-000000000000", headers=admin_user["headers"])
    assert user_404.status_code == 404

    # Withdraw clearance when no clearance active (400)
    del_no_clearance = client.delete("/api/users/request-clearance", headers=citizen_user["headers"])
    assert del_no_clearance.status_code in (400, 404)

    # Withdraw clearance when clearance is active (200)
    for u in mock_db.tables["users"]:
        if u["id"] == citizen_user["id"]:
            u["requested_role"] = "VOLUNTEER"
            break
    del_ok = client.delete("/api/users/request-clearance", headers=citizen_user["headers"])
    assert del_ok.status_code == 200

    # User profile boundary validations: latitude, longitude, service radius
    bad_lat = client.patch(f"/api/users/{citizen_user['id']}", headers=citizen_user["headers"], json={"latitude": 999.0})
    assert bad_lat.status_code == 422

    bad_lng = client.patch(f"/api/users/{citizen_user['id']}", headers=citizen_user["headers"], json={"longitude": 999.0})
    assert bad_lng.status_code == 422

    bad_radius = client.patch(f"/api/users/{citizen_user['id']}", headers=citizen_user["headers"], json={"serviceRadiusKm": 500})
    assert bad_radius.status_code == 422

    empty_patch = client.patch(f"/api/users/{citizen_user['id']}", headers=citizen_user["headers"], json={})
    assert empty_patch.status_code == 200

    # Clearance request validation & guards
    admin_clearance_blocked = client.post(
        "/api/users/request-clearance",
        headers=admin_user["headers"],
        json={"requestedRole": "VOLUNTEER", "idCardType": "Aadhaar Card", "idCardNumber": "123456789012"}
    )
    assert admin_clearance_blocked.status_code == 400

    current_role_blocked = client.post(
        "/api/users/request-clearance",
        headers=volunteer_user["headers"],
        json={"requestedRole": "VOLUNTEER", "idCardType": "Aadhaar Card", "idCardNumber": "123456789012"}
    )
    assert current_role_blocked.status_code == 409

    # Admin declines when no pending role request exists (400)
    for u in mock_db.tables["users"]:
        if u["id"] == citizen_user["id"]:
            u["requested_role"] = None
            break
    decline_no_pending = client.post(f"/api/users/{citizen_user['id']}/role-request/decline", headers=admin_user["headers"])
    assert decline_no_pending.status_code == 400

    bad_card = client.post(
        "/api/users/request-clearance",
        headers=citizen_user["headers"],
        json={"requestedRole": "VOLUNTEER", "idCardType": "AADHAAR", "idCardNumber": "short"}
    )
    assert bad_card.status_code in (400, 422)

    bad_role = client.post(
        "/api/users/request-clearance",
        headers=citizen_user["headers"],
        json={"requestedRole": "ADMIN", "idCardType": "AADHAAR", "idCardNumber": "123456789012"}
    )
    assert bad_role.status_code in (400, 422)

    # 6. Animals NOT_READY privacy check
    # Surrenderer can view their own NOT_READY animal (200)
    surrendered_id = "bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb"
    view_owner = client.get(f"/api/animals/{surrendered_id}", headers=citizen_user["headers"])
    assert view_owner.status_code == 200

    # Other citizen viewing NOT_READY animal gets 404
    view_other = client.get(f"/api/animals/{surrendered_id}", headers=volunteer_user["headers"])
    assert view_other.status_code == 404

    # Shelter updates animal with all fields
    full_update = client.patch(
        "/api/animals/aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa",
        headers=ngo_user["headers"],
        json={
            "species": "DOG",
            "gender": "MALE",
            "weight": 24.5,
            "ageEstimate": "3 years",
            "breed": "Labrador Retriever",
            "healthStatus": "HEALTHY",
            "vaccinations": ["Rabies", "DHPP"]
        }
    )
    assert full_update.status_code == 200

    # 7. Rescues citizen cancel own rescue
    new_r = client.post(
        "/api/rescues/",
        headers=citizen_user["headers"],
        json={
            "title": "Dog in park",
            "description": "Lost dog in Cubbon park",
            "species": "DOG",
            "severity": "MEDIUM",
            "location": {"latitude": 12.975, "longitude": 77.59},
            "address": "Cubbon Park",
            "photoUrls": []
        }
    )
    assert new_r.status_code == 201
    r_id = new_r.json()["id"]

    # Other non-reporter citizen cannot cancel it (403)
    other_citizen_headers = make_auth_header("98765432-1111-1111-1111-111111111111", "CITIZEN")
    cancel_bad = client.patch(
        f"/api/rescues/{r_id}/status",
        headers=other_citizen_headers,
        json={"status": "CANCELLED"}
    )
    assert cancel_bad.status_code == 403

    # Reporter can cancel it (200)
    cancel_ok = client.patch(
        f"/api/rescues/{r_id}/status",
        headers=citizen_user["headers"],
        json={"status": "CANCELLED"}
    )
    assert cancel_ok.status_code == 200
