import pytest
from unittest.mock import MagicMock
from starlette.testclient import TestClient

from main import app
from auth import get_current_user
import supabase_config

client = TestClient(app)

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
