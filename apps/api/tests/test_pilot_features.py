import pytest
from unittest.mock import patch, MagicMock

from tests.fake_supabase import FakeSupabaseClient
from rate_limiter import limiter

CITIZEN_ID = "11111111-1111-1111-1111-111111111111"
VOLUNTEER_ID = "22222222-2222-2222-2222-222222222222"
ADMIN_ID = "55555555-5555-5555-5555-555555555555"
RESCUE_ID = "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa"
POST_ID = "bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb"
REPLY_ID = "cccccccc-cccc-cccc-cccc-cccccccccccc"
REPORT_ID = "dddddddd-dddd-dddd-dddd-dddddddddddd"

@pytest.fixture
def pilot_db():
    fake = FakeSupabaseClient({
        "users": [
            {
                "id": CITIZEN_ID,
                "email": "citizen@test.com",
                "role": "CITIZEN",
                "is_disabled": False,
                "display_name": "Test Citizen",
                "id_card_last4": None,
                "terms_accepted_at": None,
                "terms_version": None,
            },
            {
                "id": VOLUNTEER_ID,
                "email": "volunteer@test.com",
                "role": "VOLUNTEER",
                "is_disabled": False,
                "display_name": "Test Volunteer",
                "id_card_last4": "1234",
                "terms_accepted_at": "2026-11-20T00:00:00Z",
                "terms_version": "2026-11-20",
            },
            {
                "id": ADMIN_ID,
                "email": "admin@test.com",
                "role": "ADMIN",
                "is_disabled": False,
                "display_name": "Test Admin",
            },
        ],
        "rescues": [
            {
                "id": RESCUE_ID,
                "title": "Injured Dog",
                "status": "REPORTED",
                "reporter_id": VOLUNTEER_ID,
            }
        ],
        "lost_and_found": [
            {
                "id": POST_ID,
                "title": "Lost Cat",
                "status": "OPEN",
                "reporter_id": VOLUNTEER_ID,
            }
        ],
        "lost_and_found_replies": [
            {
                "id": REPLY_ID,
                "post_id": POST_ID,
                "user_id": CITIZEN_ID,
                "content": "Saw this cat near the park",
            }
        ],
        "content_reports": [
            {
                "id": REPORT_ID,
                "reporter_id": CITIZEN_ID,
                "target_type": "LOST_FOUND",
                "target_id": POST_ID,
                "reason": "SPAM",
                "details": "Existing report",
                "status": "OPEN",
                "created_at": "2026-11-27T10:00:00Z",
            }
        ],
        "adoptions": [],
        "notifications": [
            {
                "id": "notif-1",
                "user_id": CITIZEN_ID,
                "title": "Welcome",
                "message": "Welcome to AniResQ",
                "created_at": "2026-11-20T00:00:00Z",
            }
        ],
        "audit_logs": [],
    })

    patches = [
        patch("routers.reports.supabase", fake),
        patch("routers.users.supabase", fake),
        patch("routers.lostfound.supabase", fake),
        patch("routers.audit.supabase", fake),
        patch("auth.supabase", fake),
        patch("supabase_config.supabase", fake),
    ]
    for p in patches:
        p.start()
    yield fake
    for p in reversed(patches):
        p.stop()

# -----------------------------------------------------------------------------
# Reports Endpoints (POST, GET, PATCH)
# -----------------------------------------------------------------------------

def test_create_report_happy_path(client, citizen_user, pilot_db):
    res = client.post(
        "/api/reports",
        headers=citizen_user["headers"],
        json={
            "targetType": "RESCUE",
            "targetId": RESCUE_ID,
            "reason": "ABUSE",
            "details": "This rescue contains abusive behavior."
        }
    )
    assert res.status_code == 201
    data = res.json()
    assert data["targetType"] == "RESCUE"
    assert data["targetId"] == RESCUE_ID
    assert data["reason"] == "ABUSE"
    assert data["status"] == "OPEN"

def test_create_report_target_not_found(client, citizen_user, pilot_db):
    res = client.post(
        "/api/reports",
        headers=citizen_user["headers"],
        json={
            "targetType": "RESCUE",
            "targetId": "00000000-0000-0000-0000-000000000000",
            "reason": "SPAM"
        }
    )
    assert res.status_code == 404

def test_create_report_self_report_forbidden(client, citizen_user, pilot_db):
    res = client.post(
        "/api/reports",
        headers=citizen_user["headers"],
        json={
            "targetType": "USER",
            "targetId": CITIZEN_ID,
            "reason": "SPAM"
        }
    )
    assert res.status_code == 422
    assert "cannot report" in str(res.json()["detail"]).lower()

def test_create_report_duplicate_open_conflict(client, citizen_user, pilot_db):
    # REPORT_ID already exists for (CITIZEN_ID, 'LOST_FOUND', POST_ID, status='OPEN')
    res = client.post(
        "/api/reports",
        headers=citizen_user["headers"],
        json={
            "targetType": "LOST_FOUND",
            "targetId": POST_ID,
            "reason": "SPAM"
        }
    )
    assert res.status_code == 409
    assert "already have an open report" in res.json()["detail"].lower()

def test_create_report_unauthenticated(client):
    res = client.post(
        "/api/reports",
        json={
            "targetType": "RESCUE",
            "targetId": RESCUE_ID,
            "reason": "SPAM"
        }
    )
    assert res.status_code == 401

def test_list_reports_admin_and_status_filter(client, admin_user, citizen_user, pilot_db):
    # Citizen cannot list reports
    res_citizen = client.get("/api/reports", headers=citizen_user["headers"])
    assert res_citizen.status_code == 403

    # Admin can list reports
    res_admin = client.get("/api/reports?status=OPEN&limit=10&offset=0", headers=admin_user["headers"])
    assert res_admin.status_code == 200
    data = res_admin.json()
    assert isinstance(data, list)
    assert len(data) >= 1
    assert data[0]["id"] == REPORT_ID

def test_patch_report_admin(client, admin_user, citizen_user, pilot_db):
    # Citizen cannot patch report
    res_citizen = client.patch(
        f"/api/reports/{REPORT_ID}",
        headers=citizen_user["headers"],
        json={"status": "ACTIONED"}
    )
    assert res_citizen.status_code == 403

    # Admin can patch report
    res_admin = client.patch(
        f"/api/reports/{REPORT_ID}",
        headers=admin_user["headers"],
        json={"status": "ACTIONED"}
    )
    assert res_admin.status_code == 200
    data = res_admin.json()
    assert data["status"] == "ACTIONED"

    # Verify audit log was recorded
    audit_events = [a for a in pilot_db.tables["audit_logs"] if a.get("action") == "REPORT_STATUS_UPDATED"]
    assert len(audit_events) == 1
    assert audit_events[0]["entity_id"] == REPORT_ID

# -----------------------------------------------------------------------------
# User Privacy Endpoints (Consent, Export, Delete)
# -----------------------------------------------------------------------------

def test_user_consent_happy_path(client, citizen_user, pilot_db):
    res = client.post(
        "/api/users/me/consent",
        headers=citizen_user["headers"],
        json={"termsVersion": "2026-11-27"}
    )
    assert res.status_code == 200
    data = res.json()
    assert data["termsVersion"] == "2026-11-27"
    assert data["termsAcceptedAt"] is not None

def test_user_export_happy_path(client, citizen_user, pilot_db):
    res = client.get("/api/users/me/export", headers=citizen_user["headers"])
    assert res.status_code == 200
    data = res.json()
    assert "profile" in data
    assert "rescues" in data
    assert "lostAndFoundPosts" in data
    assert "lostAndFoundReplies" in data
    assert "adoptionApplications" in data
    assert "notifications" in data
    assert data["profile"]["id"] == CITIZEN_ID
    assert "idCardUrl" not in data["profile"]
    assert "id_card_url" not in data["profile"]

def test_user_delete_self_service(client, citizen_user, pilot_db):
    # Bad confirm phrase
    res_bad = client.request(
        "DELETE",
        "/api/users/me",
        headers=citizen_user["headers"],
        json={"confirm": "wrong"}
    )
    assert res_bad.status_code == 422

    # Successful account deletion
    res_ok = client.request(
        "DELETE",
        "/api/users/me",
        headers=citizen_user["headers"],
        json={"confirm": "DELETE MY ACCOUNT"}
    )
    assert res_ok.status_code == 204

    # Verify user was deleted from supabase auth
    assert CITIZEN_ID not in pilot_db.auth.admin.users

    # Verify audit log was recorded with user id only
    delete_audits = [a for a in pilot_db.tables["audit_logs"] if a.get("action") == "ACCOUNT_DELETED"]
    assert len(delete_audits) == 1
    assert delete_audits[0]["entity_id"] == CITIZEN_ID
    assert "email" not in delete_audits[0]["new_value"]

def test_user_delete_last_admin_guarded(client, admin_user, pilot_db):
    res = client.request(
        "DELETE",
        "/api/users/me",
        headers=admin_user["headers"],
        json={"confirm": "DELETE MY ACCOUNT"}
    )
    assert res.status_code == 409
    assert "last active administrator" in res.json()["detail"].lower()

# -----------------------------------------------------------------------------
# User Account Disabling (POST /api/users/{id}/disable and /enable)
# -----------------------------------------------------------------------------

def test_disable_and_enable_user(client, admin_user, citizen_user, pilot_db):
    # Citizen cannot disable users
    res_non_admin = client.post(
        f"/api/users/{VOLUNTEER_ID}/disable",
        headers=citizen_user["headers"]
    )
    assert res_non_admin.status_code == 403

    # Admin self-disable rejected
    res_self = client.post(
        f"/api/users/{ADMIN_ID}/disable",
        headers=admin_user["headers"]
    )
    assert res_self.status_code == 400

    # Admin disables volunteer
    res_disable = client.post(
        f"/api/users/{VOLUNTEER_ID}/disable",
        headers=admin_user["headers"]
    )
    assert res_disable.status_code == 200
    assert res_disable.json()["isDisabled"] is True

    # Volunteer auth updated with ban_duration
    assert pilot_db.auth.admin.banned_users[VOLUNTEER_ID] == "876000h"

    # Admin enables volunteer
    res_enable = client.post(
        f"/api/users/{VOLUNTEER_ID}/enable",
        headers=admin_user["headers"]
    )
    assert res_enable.status_code == 200
    assert res_enable.json()["isDisabled"] is False
    assert pilot_db.auth.admin.banned_users[VOLUNTEER_ID] == "none"

# -----------------------------------------------------------------------------
# Lost & Found Reply Deletion
# -----------------------------------------------------------------------------

def test_delete_lostfound_reply(client, citizen_user, admin_user, volunteer_user, pilot_db):
    # Volunteer (neither author nor admin) -> 403
    res_vol = client.delete(
        f"/api/lostfound/replies/{REPLY_ID}",
        headers=volunteer_user["headers"]
    )
    assert res_vol.status_code == 403

    # Author (citizen) can delete their reply -> 200
    res_author = client.delete(
        f"/api/lostfound/replies/{REPLY_ID}",
        headers=citizen_user["headers"]
    )
    assert res_author.status_code == 200
    assert res_author.json()["deleted"] is True

    # Non-existent reply -> 404
    res_404 = client.delete(
        f"/api/lostfound/replies/{REPLY_ID}",
        headers=admin_user["headers"]
    )
    assert res_404.status_code == 404
