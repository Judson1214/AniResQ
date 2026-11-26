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
    # 1. Unauthenticated request -> 401
    res_anon = client.get("/api/audit-logs")
    assert res_anon.status_code == 401

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


