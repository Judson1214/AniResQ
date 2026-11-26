import pytest
from unittest.mock import MagicMock
from starlette.testclient import TestClient

from main import app
from auth import get_current_user
from rate_limiter import limiter
import supabase_config

client = TestClient(app)

@pytest.fixture(autouse=True)
def reset_rate_limits():
    limiter.reset()
    yield
    limiter.reset()

def test_audit_logs_requires_admin(monkeypatch):
    """Test that only ADMIN role can access GET /api/audit-logs."""
    # 1. Unauthenticated request -> 401 or 403
    res_anon = client.get("/api/audit-logs")
    assert res_anon.status_code in [401, 403]

    # 2. Citizen caller -> 403
    app.dependency_overrides[get_current_user] = lambda: {
        "uid": "citizen-1", "email": "cit@test.com", "name": "Citizen", "role": "CITIZEN"
    }
    try:
        res_cit = client.get("/api/audit-logs")
        assert res_cit.status_code == 403
    finally:
        app.dependency_overrides.clear()

    # 3. Shelter caller -> 403
    app.dependency_overrides[get_current_user] = lambda: {
        "uid": "shelter-1", "email": "shelter@test.com", "name": "Shelter", "role": "SHELTER"
    }
    try:
        res_shelter = client.get("/api/audit-logs")
        assert res_shelter.status_code == 403
    finally:
        app.dependency_overrides.clear()

def test_audit_logs_admin_retrieval_and_filtering(monkeypatch):
    """Test that ADMIN caller can fetch and filter audit logs."""
    mock_logs = [
        {
            "id": "log-1",
            "action": "ROLE_CHANGE",
            "entity_type": "USER",
            "entity_id": "user-123",
            "performed_by": "admin-1",
            "old_value": {"role": "CITIZEN"},
            "new_value": {"role": "VOLUNTEER"},
            "created_at": "2026-11-25T10:00:00Z",
        },
        {
            "id": "log-2",
            "action": "ADOPTION_STATUS_UPDATE",
            "entity_type": "ADOPTION_APPLICATION",
            "entity_id": "app-456",
            "performed_by": "shelter-1",
            "old_value": {"status": "SUBMITTED"},
            "new_value": {"status": "APPROVED"},
            "created_at": "2026-11-25T11:00:00Z",
        },
    ]

    mock_table = MagicMock()
    mock_table.select.return_value = mock_table
    mock_table.eq.return_value = mock_table
    mock_table.order.return_value = mock_table
    mock_table.range.return_value = mock_table
    mock_table.execute.return_value = MagicMock(data=mock_logs)
    monkeypatch.setattr(supabase_config.supabase, "table", MagicMock(return_value=mock_table))

    app.dependency_overrides[get_current_user] = lambda: {
        "uid": "admin-1", "email": "admin@test.com", "name": "Admin", "role": "ADMIN"
    }
    try:
        # Fetch all logs
        res = client.get("/api/audit-logs")
        assert res.status_code == 200
        logs = res.json()
        assert len(logs) == 2
        assert logs[0]["action"] == "ROLE_CHANGE"
        assert logs[0]["entityType"] == "USER"
        assert logs[0]["performedBy"] == "admin-1"
        assert logs[0]["oldValue"] == {"role": "CITIZEN"}
        assert logs[0]["newValue"] == {"role": "VOLUNTEER"}
        assert logs[0]["createdAt"] == "2026-11-25T10:00:00Z"

        # Filter by action and entity_type
        res_filtered = client.get("/api/audit-logs?action=ROLE_CHANGE&entity_type=USER")
        assert res_filtered.status_code == 200
        mock_table.eq.assert_any_call("action", "ROLE_CHANGE")
        mock_table.eq.assert_any_call("entity_type", "USER")
    finally:
        app.dependency_overrides.clear()


def test_assign_volunteer_validates_rescue_state_and_logs_real_previous_state(monkeypatch):
    """Test that assign_volunteer rejects closed rescues, enforces coordinator authorization,
    and accurately captures real previous status/assignee in audit_logs."""
    captured_audit = []

    def mock_table_router(table_name):
        mock = MagicMock()
        mock.select.return_value = mock
        mock.update.return_value = mock
        mock.insert.return_value = mock
        mock.eq.return_value = mock

        if table_name == "audit_logs":
            mock.insert.side_effect = lambda entry: captured_audit.append(entry) or mock
            mock.execute.return_value = MagicMock(data=[{"id": "audit-1"}])
            return mock
        elif table_name == "users":
            # Return valid volunteer
            mock.execute.return_value = MagicMock(data=[{"id": "vol-2", "role": "VOLUNTEER", "display_name": "Vol Two"}])
            return mock
        elif table_name == "rescues":
            # Will be customized in test cases
            return mock
        return mock

    # 1. Closed rescue (RESOLVED) cannot be assigned -> 400
    mock_rescues_closed = MagicMock()
    mock_rescues_closed.select.return_value = mock_rescues_closed
    mock_rescues_closed.eq.return_value = mock_rescues_closed
    mock_rescues_closed.execute.return_value = MagicMock(data=[{"id": "r-closed", "status": "RESOLVED", "assigned_to": "vol-1"}])

    def router_closed(t):
        if t == "rescues": return mock_rescues_closed
        return mock_table_router(t)

    monkeypatch.setattr(supabase_config.supabase, "table", router_closed)

    app.dependency_overrides[get_current_user] = lambda: {
        "uid": "admin-1", "email": "admin@aniresq.org", "name": "Admin", "role": "ADMIN"
    }
    try:
        res_closed = client.post("/api/rescues/r-closed/assign", json={"volunteerId": "vol-2", "volunteerName": "Volunteer Two"})
        assert res_closed.status_code == 400
        assert "closed rescue" in res_closed.json()["detail"].lower()
    finally:
        app.dependency_overrides.clear()

    # 2. Reassignment records REAL previous state (dispatched to vol-1)
    mock_rescues_active = MagicMock()
    mock_rescues_active.select.return_value = mock_rescues_active
    mock_rescues_active.update.return_value = mock_rescues_active
    mock_rescues_active.eq.return_value = mock_rescues_active
    # First call: select existing, Second call: update
    mock_rescues_active.execute.side_effect = [
        MagicMock(data=[{"id": "r-active", "status": "DISPATCHED", "assigned_to": "vol-1", "reporter_id": "cit-1"}]),
        MagicMock(data=[{"id": "r-active", "status": "DISPATCHED", "assigned_to": "vol-2", "reporter_id": "cit-1"}]),
    ]

    def router_active(t):
        if t == "rescues": return mock_rescues_active
        return mock_table_router(t)

    monkeypatch.setattr(supabase_config.supabase, "table", router_active)

    app.dependency_overrides[get_current_user] = lambda: {
        "uid": "ngo-coord", "email": "ngo@aniresq.org", "name": "NGO Coord", "role": "NGO"
    }
    try:
        res_reassign = client.post("/api/rescues/r-active/assign", json={"volunteerId": "vol-2", "volunteerName": "Vol Two"})
        assert res_reassign.status_code == 200
        # Verify captured audit log records real previous state
        assert len(captured_audit) == 1
        audit_entry = captured_audit[0]
        assert audit_entry["action"] == "RESCUE_ASSIGNED"
        assert audit_entry["entity_id"] == "r-active"
        assert audit_entry["old_value"]["assigned_to"] == "vol-1"
        assert audit_entry["old_value"]["status"] == "DISPATCHED"
        assert audit_entry["new_value"]["assigned_to"] == "vol-2"
    finally:
        app.dependency_overrides.clear()


def test_audit_fail_closed_aborts_role_mutation(monkeypatch):
    """Test that when audit logging fails on a security role change, the request fails-closed (500)
    to prevent untracked privilege escalation."""
    mock_users = MagicMock()
    mock_users.select.return_value = mock_users
    mock_users.update.return_value = mock_users
    mock_users.eq.return_value = mock_users
    mock_users.is_.return_value = mock_users
    mock_users.execute.return_value = MagicMock(data=[{"id": "target-user", "role": "CITIZEN", "display_name": "Target"}])

    mock_audit = MagicMock()
    mock_audit.insert.return_value = mock_audit
    # Database fails on audit log insertion
    mock_audit.execute.side_effect = Exception("Postgres connection dropped")

    def router_failing_audit(t):
        if t == "audit_logs": return mock_audit
        return mock_users

    monkeypatch.setattr(supabase_config.supabase, "table", router_failing_audit)
    mock_rpc = MagicMock()
    mock_rpc.execute.side_effect = Exception("PGRST202 could not find the function public.admin_update_user_role")
    monkeypatch.setattr(supabase_config.supabase, "rpc", lambda fn, params: mock_rpc)

    app.dependency_overrides[get_current_user] = lambda: {
        "uid": "admin-1", "email": "admin@aniresq.org", "name": "Admin", "role": "ADMIN"
    }
    try:
        res = client.patch("/api/users/target-user/role", json={"role": "VOLUNTEER"})
        assert res.status_code == 500
        assert "audit logging failed" in res.json()["detail"].lower()
        # Verify compensating rollback was executed so no untracked role change persisted
        assert any(
            call.args and call.args[0] == {"role": "CITIZEN", "requested_role": None}
            for call in mock_users.update.call_args_list
        )
    finally:
        app.dependency_overrides.clear()


def test_rpc_audit_failure_fails_closed_without_fallback(monkeypatch):
    """Test that when transactional RPC admin_update_user_role fails (e.g. audit constraint error),
    the endpoint fails-closed immediately with 500 and NEVER falls back to direct table update."""
    mock_users = MagicMock()
    mock_users.select.return_value = mock_users
    mock_users.update.return_value = mock_users
    mock_users.eq.return_value = mock_users
    mock_users.is_.return_value = mock_users
    mock_users.execute.return_value = MagicMock(data=[{"id": "target-user", "role": "CITIZEN", "display_name": "Target"}])

    mock_rpc = MagicMock()
    # Transactional RPC fails inside PostgreSQL (e.g. audit constraint violation)
    mock_rpc.execute.side_effect = Exception("audit_logs constraint check failed: append-only violation")

    monkeypatch.setattr(supabase_config.supabase, "table", lambda t: mock_users)
    monkeypatch.setattr(supabase_config.supabase, "rpc", lambda fn, params: mock_rpc)

    app.dependency_overrides[get_current_user] = lambda: {
        "uid": "admin-1", "email": "admin@aniresq.org", "name": "Admin", "role": "ADMIN"
    }
    try:
        res = client.patch("/api/users/target-user/role", json={"role": "VOLUNTEER"})
        assert res.status_code == 500
        assert "audit logging failed" in res.json()["detail"].lower()
        # Verify table("users").update was NEVER called as a fallback!
        assert mock_users.update.call_count == 0
    finally:
        app.dependency_overrides.clear()


def test_volunteer_cannot_take_over_assigned_rescue(monkeypatch):
    """Test that a volunteer cannot take over a rescue already assigned to someone else.
    Only coordinators, current assignees, or self-assign on unassigned rescues are permitted."""
    mock_users = MagicMock()
    mock_users.select.return_value = mock_users
    mock_users.eq.return_value = mock_users
    mock_users.execute.return_value = MagicMock(data=[{"id": "vol-2", "role": "VOLUNTEER", "display_name": "Vol Two"}])

    mock_rescues = MagicMock()
    mock_rescues.select.return_value = mock_rescues
    mock_rescues.update.return_value = mock_rescues
    mock_rescues.eq.return_value = mock_rescues

    def router(t):
        if t == "users": return mock_users
        if t == "rescues": return mock_rescues
        mock = MagicMock()
        mock.insert.return_value = mock
        mock.execute.return_value = MagicMock(data=[])
        return mock

    monkeypatch.setattr(supabase_config.supabase, "table", router)

    # 1. Vol-2 tries to hijack a rescue already assigned to Vol-1 -> 403 Forbidden
    mock_rescues.execute.return_value = MagicMock(data=[{
        "id": "r-assigned", "status": "DISPATCHED", "assigned_to": "vol-1", "reporter_id": "cit-1"
    }])
    app.dependency_overrides[get_current_user] = lambda: {
        "uid": "vol-2", "email": "vol2@aniresq.org", "name": "Vol Two", "role": "VOLUNTEER"
    }
    try:
        res = client.post("/api/rescues/r-assigned/assign", json={"volunteerId": "vol-2", "volunteerName": "Vol Two"})
        assert res.status_code == 403
        assert "Forbidden" in res.json()["detail"]
    finally:
        app.dependency_overrides.clear()

    # 2. Rescue is UNASSIGNED (assigned_to: None) -> Vol-2 CAN self-assign
    mock_rescues.execute.side_effect = [
        MagicMock(data=[{"id": "r-unassigned", "status": "PENDING", "assigned_to": None, "reporter_id": "cit-1"}]), # select existing
        MagicMock(data=[{"id": "r-unassigned", "status": "DISPATCHED", "assigned_to": "vol-2", "reporter_id": "cit-1"}]), # update
    ]
    app.dependency_overrides[get_current_user] = lambda: {
        "uid": "vol-2", "email": "vol2@aniresq.org", "name": "Vol Two", "role": "VOLUNTEER"
    }
    try:
        res = client.post("/api/rescues/r-unassigned/assign", json={"volunteerId": "vol-2", "volunteerName": "Vol Two"})
        assert res.status_code == 200
        assert res.json()["assignedTo"] == "vol-2"
    finally:
        app.dependency_overrides.clear()

    # 3. Current assignee Vol-1 CAN hand off to Vol-2
    mock_rescues.execute.side_effect = [
        MagicMock(data=[{"id": "r-handoff", "status": "DISPATCHED", "assigned_to": "vol-1", "reporter_id": "cit-1"}]), # select existing
        MagicMock(data=[{"id": "r-handoff", "status": "DISPATCHED", "assigned_to": "vol-2", "reporter_id": "cit-1"}]), # update
    ]
    app.dependency_overrides[get_current_user] = lambda: {
        "uid": "vol-1", "email": "vol1@aniresq.org", "name": "Vol One", "role": "VOLUNTEER"
    }
    try:
        res = client.post("/api/rescues/r-handoff/assign", json={"volunteerId": "vol-2", "volunteerName": "Vol Two"})
        assert res.status_code == 200
        assert res.json()["assignedTo"] == "vol-2"
    finally:
        app.dependency_overrides.clear()


def test_claims_and_deletions_are_audited(monkeypatch):
    """Test that claiming an animal, deleting an animal, and deleting a rescue record
    accurate audit log snapshots (ANIMAL_CLAIMED, ANIMAL_DELETED, RESCUE_DELETED)."""
    captured_audit = []

    mock_animals = MagicMock()
    mock_animals.select.return_value = mock_animals
    mock_animals.update.return_value = mock_animals
    mock_animals.delete.return_value = mock_animals
    mock_animals.eq.return_value = mock_animals
    mock_animals.is_.return_value = mock_animals
    mock_animals.execute.side_effect = [
        # 1. Claim animal: select check (unclaimed)
        MagicMock(data=[{"id": "anim-1", "name": "Buster", "species": "DOG", "breed": "Beagle", "shelter_id": None, "adoption_status": "AVAILABLE", "surrendered_by": "cit-1"}]),
        # 2. Claim animal: update execution
        MagicMock(data=[{"id": "anim-1", "name": "Buster", "species": "DOG", "breed": "Beagle", "shelter_id": "shelter-1", "adoption_status": "AVAILABLE", "surrendered_by": "cit-1"}]),
        # 3. Delete animal: select check (owned by shelter-1)
        MagicMock(data=[{"id": "anim-1", "name": "Buster", "species": "DOG", "breed": "Beagle", "shelter_id": "shelter-1", "adoption_status": "AVAILABLE", "surrendered_by": "cit-1"}]),
        # 4. Delete animal: delete execution
        MagicMock(data=[]),
    ]

    mock_rescues = MagicMock()
    mock_rescues.select.return_value = mock_rescues
    mock_rescues.delete.return_value = mock_rescues
    mock_rescues.eq.return_value = mock_rescues
    mock_rescues.execute.return_value = MagicMock(data=[{
        "id": "rescue-1",
        "title": "Trapped puppy",
        "species": "DOG",
        "status": "PENDING",
        "severity": "HIGH",
        "reporter_id": "cit-1",
        "assigned_to": None,
        "address": "MG Road",
    }])

    def mock_table_router(table_name):
        if table_name == "animals":
            return mock_animals
        if table_name == "rescues":
            return mock_rescues
        if table_name == "audit_logs":
            mock = MagicMock()
            mock.insert.side_effect = lambda entry: captured_audit.append(entry) or mock
            mock.execute.return_value = MagicMock(data=[{"id": "audit-ok"}])
            return mock

        mock = MagicMock()
        mock.select.return_value = mock
        mock.insert.return_value = mock
        mock.update.return_value = mock
        mock.delete.return_value = mock
        mock.eq.return_value = mock
        mock.execute.return_value = MagicMock(data=[])
        return mock

    monkeypatch.setattr(supabase_config.supabase, "table", mock_table_router)

    app.dependency_overrides[get_current_user] = lambda: {
        "uid": "shelter-1", "email": "shelter@aniresq.org", "name": "Shelter One", "role": "SHELTER"
    }
    try:
        # 1. Claim animal
        res_claim = client.post("/api/animals/anim-1/claim")
        assert res_claim.status_code == 200
        claim_log = next((l for l in captured_audit if l["action"] == "ANIMAL_CLAIMED"), None)
        assert claim_log is not None
        assert claim_log["entity_id"] == "anim-1"
        assert claim_log["new_value"]["shelter_id"] == "shelter-1"

        # 2. Delete animal
        res_del_anim = client.delete("/api/animals/anim-1")
        assert res_del_anim.status_code == 200
        del_anim_log = next((l for l in captured_audit if l["action"] == "ANIMAL_DELETED"), None)
        assert del_anim_log is not None
        assert del_anim_log["entity_id"] == "anim-1"
        assert del_anim_log["old_value"]["name"] == "Buster"
    finally:
        app.dependency_overrides.clear()

    # 3. Delete rescue (admin)
    app.dependency_overrides[get_current_user] = lambda: {
        "uid": "admin-1", "email": "admin@aniresq.org", "name": "Admin", "role": "ADMIN"
    }
    try:
        res_del_rescue = client.delete("/api/rescues/rescue-1")
        assert res_del_rescue.status_code == 200
        del_rescue_log = next((l for l in captured_audit if l["action"] == "RESCUE_DELETED"), None)
        assert del_rescue_log is not None
        assert del_rescue_log["entity_id"] == "rescue-1"
        assert del_rescue_log["old_value"]["title"] == "Trapped puppy"
    finally:
        app.dependency_overrides.clear()


def test_audit_log_missing_table_fails_closed_when_required(monkeypatch):
    """Test that when fail_closed=True, log_audit_event raises HTTPException(500)
    even when the database returns PGRST205 (table missing from schema cache)."""
    from routers.audit import log_audit_event
    from fastapi import HTTPException

    mock_audit = MagicMock()
    mock_audit.insert.return_value = mock_audit
    mock_audit.execute.side_effect = Exception("PGRST205: could not find the table 'public.audit_logs' in the schema cache")
    monkeypatch.setattr(supabase_config.supabase, "table", lambda t: mock_audit)

    # 1. fail_closed=False -> swallowed with warning, does not raise
    log_audit_event(
        action="TEST_NON_CRITICAL",
        entity_type="TEST",
        entity_id="1",
        performed_by="user-1",
        fail_closed=False
    )

    # 2. fail_closed=True -> MUST raise 500
    with pytest.raises(HTTPException) as exc_info:
        log_audit_event(
            action="ROLE_CHANGE",
            entity_type="USER",
            entity_id="user-1",
            performed_by="admin-1",
            fail_closed=True
        )
    assert exc_info.value.status_code == 500
    assert "audit logging failed" in exc_info.value.detail.lower()


def test_production_guard_aborts_on_missing_rpc_function(monkeypatch):
    """Test that in production (is_test_environment()=False), any RPC failure (even missing function)
    fails closed immediately with 500 without direct update fallback."""
    import routers.users as users_router

    # Force is_test_environment to return False (production simulation)
    monkeypatch.setattr(users_router, "is_test_environment", lambda: False)

    mock_users = MagicMock()
    mock_users.select.return_value = mock_users
    mock_users.update.return_value = mock_users
    mock_users.eq.return_value = mock_users
    mock_users.is_.return_value = mock_users
    mock_users.execute.return_value = MagicMock(data=[{"id": "target-user", "role": "CITIZEN", "display_name": "Target"}])

    mock_rpc = MagicMock()
    mock_rpc.execute.side_effect = Exception("PGRST202: could not find the function public.admin_update_user_role")

    monkeypatch.setattr(supabase_config.supabase, "table", lambda t: mock_users)
    monkeypatch.setattr(supabase_config.supabase, "rpc", lambda fn, params: mock_rpc)

    app.dependency_overrides[get_current_user] = lambda: {
        "uid": "admin-1", "email": "admin@aniresq.org", "name": "Admin", "role": "ADMIN"
    }
    try:
        res = client.patch("/api/users/target-user/role", json={"role": "VOLUNTEER"})
        assert res.status_code == 500
        assert "audit logging failed" in res.json()["detail"].lower()
        # Direct update fallback MUST NOT run in production!
        assert mock_users.update.call_count == 0
    finally:
        app.dependency_overrides.clear()


def test_id_card_pii_not_leaked_in_bio_or_notifications(monkeypatch):
    """Test that ID card credentials are kept out of bio, never leak in notification text,
    and are hidden from non-admin/unauthorized callers."""
    created_notifications = []

    def mock_create_notification(**kwargs):
        created_notifications.append(kwargs)

    monkeypatch.setattr("routers.users.create_system_notification", mock_create_notification)

    mock_users = MagicMock()
    mock_users.select.return_value = mock_users
    mock_users.update.return_value = mock_users
    mock_users.eq.return_value = mock_users
    mock_users.is_.return_value = mock_users
    # Live row has clean bio
    mock_users.execute.return_value = MagicMock(data=[{
        "id": "op-1",
        "display_name": "Operator One",
        "email": "op@aniresq.org",
        "role": "CITIZEN",
        "bio": "Passionate animal lover",
        "id_card_type": "Passport",
        "id_card_number": "P12345678",
        "id_card_url": "https://storage.aniresq.org/uploads/op-1/id_verification/doc.png"
    }])
    monkeypatch.setattr(supabase_config.supabase, "table", lambda t: mock_users)

    # 1. Test clearance request endpoint
    app.dependency_overrides[get_current_user] = lambda: {
        "uid": "op-1", "email": "op@aniresq.org", "name": "Operator One", "role": "CITIZEN"
    }
    try:
        res = client.post("/api/users/request-clearance", json={
            "requestedRole": "VOLUNTEER",
            "idCardType": "Aadhaar Card",
            "idCardNumber": "9999-8888-7777",
            "idCardUrl": "op-1/aadhaar.png"
        })
        assert res.status_code == 200
        # Verify update call did NOT inject "[ID:" into bio
        update_calls = mock_users.update.call_args_list
        assert len(update_calls) > 0
        update_payload = update_calls[0].args[0]
        assert "[ID:" not in update_payload.get("bio", "")
        assert update_payload.get("id_card_number") == "9999-8888-7777"
        assert update_payload.get("id_card_type") == "Aadhaar Card"
        assert update_payload.get("id_card_url") == "op-1/aadhaar.png"

        # Verify notification dispatched to admin does NOT leak the card number
        assert len(created_notifications) > 0
        admin_notif = created_notifications[0]
        assert "9999-8888-7777" not in admin_notif["message"]
        assert "Aadhaar Card" in admin_notif["message"]
    finally:
        app.dependency_overrides.clear()


def test_id_card_url_path_validation_and_signing_safety(monkeypatch):
    """Test that:
    1. Unsafe idCardUrl input (e.g. javascript:... or cross-user path) is rejected with 422.
    2. In map_user, if signing fails, idCardUrl returns None and NEVER falls back to the raw string."""
    from routers.users import map_user

    mock_users = MagicMock()
    mock_users.select.return_value = mock_users
    mock_users.update.return_value = mock_users
    mock_users.eq.return_value = mock_users
    mock_users.is_.return_value = mock_users
    mock_users.execute.return_value = MagicMock(data=[{"id": "op-1", "role": "CITIZEN", "display_name": "Op"}])
    monkeypatch.setattr(supabase_config.supabase, "table", lambda t: mock_users)

    app.dependency_overrides[get_current_user] = lambda: {
        "uid": "op-1", "email": "op@aniresq.org", "name": "Op", "role": "CITIZEN"
    }
    try:
        # A. javascript: scheme rejected
        res_js = client.post("/api/users/request-clearance", json={
            "requestedRole": "VOLUNTEER",
            "idCardNumber": "12345",
            "idCardUrl": "javascript:alert(1)"
        })
        assert res_js.status_code == 422

        # B. Cross-user path rejected
        res_cross = client.post("/api/users/request-clearance", json={
            "requestedRole": "VOLUNTEER",
            "idCardNumber": "12345",
            "idCardUrl": "victim-user-id/id.png"
        })
        assert res_cross.status_code == 422

        # C. Path traversal rejected
        res_trav = client.post("/api/users/request-clearance", json={
            "requestedRole": "VOLUNTEER",
            "idCardNumber": "12345",
            "idCardUrl": "op-1/../../../etc/passwd"
        })
        assert res_trav.status_code == 422

        # D. Trailing newline rejected (re.fullmatch enforcement)
        res_newline = client.post("/api/users/request-clearance", json={
            "requestedRole": "VOLUNTEER",
            "idCardNumber": "12345",
            "idCardUrl": "op-1/valid.png\n"
        })
        assert res_newline.status_code == 422
    finally:
        app.dependency_overrides.clear()

    # E. Test map_user returns None if storage signing fails
    mock_storage = MagicMock()
    mock_storage.create_signed_url.side_effect = Exception("Storage error")
    monkeypatch.setattr(supabase_config.supabase.storage, "from_", lambda b: mock_storage)

    user_data = {
        "id": "00000000-0000-0000-0000-000000000001",
        "display_name": "Test User",
        "role": "CITIZEN",
        "id_card_url": "00000000-0000-0000-0000-000000000001/doc.png"
    }
    mapped = map_user(user_data, can_view_contact=True, can_view_sensitive=True)
    assert mapped["idCardUrl"] is None, "idCardUrl must be None when signing fails, not raw string!"

    # F. Test map_user converts relative signedURL to absolute URL
    mock_storage_rel = MagicMock()
    mock_storage_rel.create_signed_url.return_value = {
        "signedURL": "/storage/v1/object/sign/id-verification/00000000-0000-0000-0000-000000000001/doc.png?token=xyz"
    }
    monkeypatch.setattr(supabase_config.supabase.storage, "from_", lambda b: mock_storage_rel)
    monkeypatch.setenv("SUPABASE_URL", "https://test-project.supabase.co")

    mapped_rel = map_user(user_data, can_view_contact=True, can_view_sensitive=True)
    assert mapped_rel["idCardUrl"] == "https://test-project.supabase.co/storage/v1/object/sign/id-verification/00000000-0000-0000-0000-000000000001/doc.png?token=xyz"


def test_request_clearance_guards_and_validation(monkeypatch):
    """Test comprehensive security and validation guards for POST /api/users/request-clearance:
    - Admin rejection (calling as ADMIN or requesting ADMIN role)
    - Invalid role rejection
    - Bad storage path rejection (422)
    - idCardType whitelist & idCardNumber length bounds (422)
    - Redundant request rejection: user already holds target role (409)
    - Duplicate request rejection: clearance request already pending review (409)
    - Successful submission with notification dispatch (200)
    - Rate limiter blocks excessive requests (429)
    """
    mock_db = {
        "user-cit": {
            "id": "user-cit",
            "display_name": "Citizen User",
            "email": "cit@aniresq.org",
            "role": "CITIZEN",
            "requested_role": None,
            "bio": "Standard citizen bio"
        },
        "user-vol": {
            "id": "user-vol",
            "display_name": "Volunteer User",
            "email": "vol@aniresq.org",
            "role": "VOLUNTEER",
            "requested_role": None,
            "bio": ""
        },
        "user-pending": {
            "id": "user-pending",
            "display_name": "Pending User",
            "email": "pending@aniresq.org",
            "role": "CITIZEN",
            "requested_role": "SHELTER",
            "bio": ""
        }
    }

    class MockUserTable:
        def __init__(self):
            self.current_id = None
            self.action = None
            self.update_payload = None
            self.is_col = None
            self.is_val = None

        def select(self, *args, **kwargs):
            self.action = "select"
            return self

        def eq(self, col, val):
            self.current_id = val
            return self

        def is_(self, col, val):
            self.is_col = col
            self.is_val = val
            return self

        def update(self, payload):
            self.action = "update"
            self.update_payload = payload
            return self

        def execute(self):
            row = mock_db.get(self.current_id)
            if self.action == "select":
                return MagicMock(data=[dict(row)] if row else [])
            elif self.action == "update":
                if row:
                    if self.is_col == "requested_role" and self.is_val == "null":
                        if row.get("requested_role") is not None:
                            return MagicMock(data=[])
                    row.update(self.update_payload)
                    return MagicMock(data=[dict(row)])
                return MagicMock(data=[])
            return MagicMock(data=[])

    mock_table = MockUserTable()
    monkeypatch.setattr(supabase_config.supabase, "table", lambda t: mock_table)

    limiter.reset()

    # 1. Admin caller rejection -> 400
    app.dependency_overrides[get_current_user] = lambda: {
        "uid": "admin-1", "email": "admin@aniresq.org", "name": "Admin", "role": "ADMIN"
    }
    try:
        res = client.post("/api/users/request-clearance", json={
            "requestedRole": "VOLUNTEER",
            "idCardNumber": "DL-99887766",
            "idCardType": "Government Photo ID"
        })
        assert res.status_code == 400
        assert "Administrators already hold maximum clearance" in res.json()["detail"]
    finally:
        app.dependency_overrides.clear()

    # 2. Citizen requesting ADMIN role -> 400
    app.dependency_overrides[get_current_user] = lambda: {
        "uid": "user-cit", "email": "cit@aniresq.org", "name": "Citizen", "role": "CITIZEN"
    }
    try:
        res = client.post("/api/users/request-clearance", json={
            "requestedRole": "ADMIN",
            "idCardNumber": "DL-99887766",
            "idCardType": "Government Photo ID"
        })
        assert res.status_code == 400
        assert "Cannot request ADMIN or invalid role" in res.json()["detail"]

        # 3. Citizen requesting invalid non-existent role -> 400
        res_invalid = client.post("/api/users/request-clearance", json={
            "requestedRole": "SUPER_ADMIN_ROOT",
            "idCardNumber": "DL-99887766",
            "idCardType": "Government Photo ID"
        })
        assert res_invalid.status_code == 400

        # 4. Unknown idCardType -> 422
        res_bad_type = client.post("/api/users/request-clearance", json={
            "requestedRole": "VOLUNTEER",
            "idCardNumber": "DL-99887766",
            "idCardType": "Fake Unapproved ID Card"
        })
        assert res_bad_type.status_code == 422

        # 5. idCardNumber exceeding 64 chars -> 422
        res_long_id = client.post("/api/users/request-clearance", json={
            "requestedRole": "VOLUNTEER",
            "idCardNumber": "A" * 65,
            "idCardType": "Government Photo ID"
        })
        assert res_long_id.status_code == 422

        # 6. Blank idCardNumber -> 422
        res_blank_id = client.post("/api/users/request-clearance", json={
            "requestedRole": "VOLUNTEER",
            "idCardNumber": "   ",
            "idCardType": "Government Photo ID"
        })
        assert res_blank_id.status_code == 422

        # 7. Bad document path format -> 422
        res_bad_path = client.post("/api/users/request-clearance", json={
            "requestedRole": "VOLUNTEER",
            "idCardNumber": "DL-99887766",
            "idCardType": "Government Photo ID",
            "idCardUrl": "user-cit/../../escaped.png"
        })
        assert res_bad_path.status_code == 422

    finally:
        app.dependency_overrides.clear()

    # 8. Redundant request: caller already holds the target role -> 409
    app.dependency_overrides[get_current_user] = lambda: {
        "uid": "user-vol", "email": "vol@aniresq.org", "name": "Volunteer", "role": "VOLUNTEER"
    }
    try:
        res_already_held = client.post("/api/users/request-clearance", json={
            "requestedRole": "VOLUNTEER",
            "idCardNumber": "DL-11223344",
            "idCardType": "Government Photo ID"
        })
        assert res_already_held.status_code == 409
        assert "User already holds" in res_already_held.json()["detail"]
    finally:
        app.dependency_overrides.clear()

    # 9. Duplicate request: caller already has a pending clearance request -> 409
    app.dependency_overrides[get_current_user] = lambda: {
        "uid": "user-pending", "email": "pending@aniresq.org", "name": "Pending", "role": "CITIZEN"
    }
    try:
        res_dup = client.post("/api/users/request-clearance", json={
            "requestedRole": "NGO",
            "idCardNumber": "NGO-778899",
            "idCardType": "NGO Registration Certificate"
        })
        assert res_dup.status_code == 409
        assert "already pending administrator review" in res_dup.json()["detail"]
    finally:
        app.dependency_overrides.clear()

    # 10. Successful clearance submission -> 200
    limiter.reset()
    app.dependency_overrides[get_current_user] = lambda: {
        "uid": "user-cit", "email": "cit@aniresq.org", "name": "Citizen", "role": "CITIZEN"
    }
    try:
        res_ok = client.post("/api/users/request-clearance", json={
            "requestedRole": "VOLUNTEER",
            "idCardNumber": "DL-1420110012345",
            "idCardType": "Government Photo ID",
            "idCardUrl": "user-cit/doc.png"
        })
        assert res_ok.status_code == 200
        data = res_ok.json()
        assert data["requestedRole"] == "VOLUNTEER"
        assert data["idCardNumber"] == "DL-1420110012345"
        assert data["idCardType"] == "Government Photo ID"

        # 10b. Concurrent / repeat attempt where requested_role is already set returns 409
        res_conflict = client.post("/api/users/request-clearance", json={
            "requestedRole": "VOLUNTEER",
            "idCardNumber": "DL-1420110012345",
            "idCardType": "Government Photo ID",
            "idCardUrl": "user-cit/doc.png"
        })
        assert res_conflict.status_code == 409
        assert "already pending administrator review" in res_conflict.json()["detail"]
    finally:
        app.dependency_overrides.clear()

    # 11. Rate limiter test: 11th request in window blocked -> 429
    limiter.reset()
    app.dependency_overrides[get_current_user] = lambda: {
        "uid": "user-cit", "email": "cit@aniresq.org", "name": "Citizen", "role": "CITIZEN"
    }
    try:
        for _ in range(10):
            client.post("/api/users/request-clearance", json={
                "requestedRole": "ADMIN",
                "idCardNumber": "DL-12345",
                "idCardType": "Government Photo ID"
            })
        res_rate_limited = client.post("/api/users/request-clearance", json={
            "requestedRole": "ADMIN",
            "idCardNumber": "DL-12345",
            "idCardType": "Government Photo ID"
        })
        assert res_rate_limited.status_code == 429
    finally:
        app.dependency_overrides.clear()
        limiter.reset()


def test_withdraw_role_clearance_request(monkeypatch):
    """Test DELETE /api/users/request-clearance:
    - 400 when user has no pending clearance request
    - 200 when user has a pending clearance request, resetting requestedRole and ID credentials
    - Removes uploaded ID document from private storage bucket
    - Removes stale ROLE_REQUEST notifications from admin feeds
    - Rejects concurrent / race condition when clearance is already processed (409)
    - Rate limits excessive withdrawal requests (429)
    - User can submit a new clearance request after withdrawing without 409 conflict"""
    mock_db = {
        "user-cit": {
            "id": "user-cit",
            "display_name": "Citizen User",
            "email": "cit@aniresq.org",
            "role": "CITIZEN",
            "requested_role": None,
            "id_card_type": None,
            "id_card_number": None,
            "id_card_url": None,
            "bio": "Citizen Bio"
        },
        "user-pending": {
            "id": "user-pending",
            "display_name": "Pending User",
            "email": "pending@aniresq.org",
            "role": "CITIZEN",
            "requested_role": "SHELTER",
            "id_card_type": "Animal Shelter License",
            "id_card_number": "SHELTER-12345",
            "id_card_url": "user-pending/license.pdf",
            "bio": "Pending Bio"
        }
    }

    deleted_notifications = []
    removed_storage_paths = []

    class MockUserTable:
        def __init__(self, table_name="users"):
            self.table_name = table_name
            self.current_id = None
            self.action = None
            self.update_payload = None
            self.is_col = None
            self.is_val = None
            self.is_negated = False
            self.filters = {}

        @property
        def not_(self):
            self.is_negated = True
            return self

        def select(self, *args, **kwargs):
            self.action = "select"
            return self

        def eq(self, col, val):
            if col == "id":
                self.current_id = val
            self.filters[col] = val
            return self

        def is_(self, col, val):
            self.is_col = col
            self.is_val = val
            return self

        def update(self, payload):
            self.action = "update"
            self.update_payload = payload
            return self

        def delete(self, *args, **kwargs):
            self.action = "delete"
            return self

        def execute(self):
            if self.table_name == "notifications":
                if self.action == "delete":
                    deleted_notifications.append(dict(self.filters))
                    return MagicMock(data=[])
                return MagicMock(data=[])

            row = mock_db.get(self.current_id)
            if self.action == "select":
                return MagicMock(data=[dict(row)] if row else [])
            elif self.action == "update":
                if row:
                    if self.is_col == "requested_role" and self.is_val == "null":
                        if self.is_negated:
                            # Not null condition: must fail if requested_role IS null
                            if row.get("requested_role") is None:
                                return MagicMock(data=[])
                        else:
                            # Is null condition: must fail if requested_role is NOT null
                            if row.get("requested_role") is not None:
                                return MagicMock(data=[])
                    row.update(self.update_payload)
                    # Reset condition flags
                    self.is_col = None
                    self.is_val = None
                    self.is_negated = False
                    return MagicMock(data=[dict(row)])
                return MagicMock(data=[])
            return MagicMock(data=[])

    monkeypatch.setattr(supabase_config.supabase, "table", lambda t: MockUserTable(t))

    mock_storage = MagicMock()
    mock_storage.remove.side_effect = lambda paths: removed_storage_paths.extend(paths)
    monkeypatch.setattr(supabase_config.supabase.storage, "from_", lambda b: mock_storage)

    limiter.reset()

    # 1. User with no pending clearance request -> 400
    app.dependency_overrides[get_current_user] = lambda: {
        "uid": "user-cit", "email": "cit@aniresq.org", "name": "Citizen User", "role": "CITIZEN"
    }
    try:
        res = client.delete("/api/users/request-clearance")
        assert res.status_code == 400
        assert "No pending clearance request to withdraw" in res.json()["detail"]
    finally:
        app.dependency_overrides.clear()

    # 2. User with pending clearance request -> 200 and fields reset to None
    app.dependency_overrides[get_current_user] = lambda: {
        "uid": "user-pending", "email": "pending@aniresq.org", "name": "Pending User", "role": "CITIZEN"
    }
    try:
        res_withdraw = client.delete("/api/users/request-clearance")
        assert res_withdraw.status_code == 200
        data = res_withdraw.json()
        assert data["requestedRole"] is None
        assert data["idCardType"] is None
        assert data["idCardNumber"] is None
        assert data["idCardUrl"] is None

        # Verify database record updated
        assert mock_db["user-pending"]["requested_role"] is None
        assert mock_db["user-pending"]["id_card_number"] is None

        # Verify storage document was deleted from id-verification bucket
        assert "user-pending/license.pdf" in removed_storage_paths

        # Verify notifications were cleaned up
        assert any(
            n.get("related_entity_id") == "user-pending" and n.get("type") == "ROLE_REQUEST"
            for n in deleted_notifications
        )

        # 3. User can now submit a fresh clearance request without 409
        res_reapply = client.post("/api/users/request-clearance", json={
            "requestedRole": "NGO",
            "idCardNumber": "NGO-998877",
            "idCardType": "NGO Registration Certificate"
        })
        assert res_reapply.status_code == 200
        reapply_data = res_reapply.json()
        assert reapply_data["requestedRole"] == "NGO"
        assert reapply_data["idCardNumber"] == "NGO-998877"

        # 4. Concurrent race condition: if an admin approved / cleared between select and update -> 409
        mock_db["user-pending"]["requested_role"] = "NGO"
        class RaceMockTable(MockUserTable):
            def execute(self):
                if self.action == "update":
                    return MagicMock(data=[])
                return super().execute()
        monkeypatch.setattr(supabase_config.supabase, "table", lambda t: RaceMockTable(t) if t == "users" else MockUserTable(t))
        res_race = client.delete("/api/users/request-clearance")
        assert res_race.status_code == 409
        assert "already processed or withdrawn" in res_race.json()["detail"]
        monkeypatch.setattr(supabase_config.supabase, "table", lambda t: MockUserTable(t))

        # 5. Rate limiter test on DELETE /api/users/request-clearance
        limiter.reset()
        mock_db["user-pending"]["requested_role"] = "NGO"
        for _ in range(10):
            client.delete("/api/users/request-clearance")
        res_rate_limited = client.delete("/api/users/request-clearance")
        assert res_rate_limited.status_code == 429

    finally:
        app.dependency_overrides.clear()
        limiter.reset()
