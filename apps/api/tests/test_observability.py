import os
import json
import logging
import pytest
from starlette.testclient import TestClient
from main import app
from logging_config import redact_sensitive_string, LogScrubbingFilter, StructuredJsonFormatter
from sentry import sanitize_sentry_event
from metrics import metrics_collector

client = TestClient(app)

def test_log_scrubbing_masks_all_credentials_and_pii():
    """Verify log scrubbing masks Bearer tokens, JWTs, connection URLs, passwords, and phone numbers."""
    # 1. Bearer token
    msg = "User authenticated with Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjMifQ.abc-def_123"
    sanitized = redact_sensitive_string(msg)
    assert "Bearer [REDACTED_TOKEN]" in sanitized
    assert "eyJ" not in sanitized

    # 2. Database connection URL
    pg_msg = "Connecting to database postgres://postgres:SecretPass123!@db.supabase.co:5432/postgres"
    sanitized_pg = redact_sensitive_string(pg_msg)
    assert "postgres://postgres:***@db.supabase.co:5432/postgres" in sanitized_pg
    assert "SecretPass123!" not in sanitized_pg

    # 3. Redis connection URL
    redis_msg = "Connected to redis://default:SuperSecretRedisPass@redis.cloud.io:6379/0"
    sanitized_redis = redact_sensitive_string(redis_msg)
    assert "redis://default:***@redis.cloud.io:6379/0" in sanitized_redis
    assert "SuperSecretRedisPass" not in sanitized_redis

    # 4. Passwords
    pwd_msg = "Login failed for user test: password='SuperSecretPassword123'"
    sanitized_pwd = redact_sensitive_string(pwd_msg)
    assert "SuperSecretPassword123" not in sanitized_pwd
    assert "[REDACTED]" in sanitized_pwd

    # 5. Phone numbers
    phone_msg = "Citizen contact reported phone: +91 98765 43210 for emergency"
    sanitized_phone = redact_sensitive_string(phone_msg)
    assert "98765 43210" not in sanitized_phone
    assert "[REDACTED_PHONE]" in sanitized_phone

def test_log_scrubbing_filter_record_integration():
    """Verify LogScrubbingFilter scrubs record messages and arguments directly."""
    scrub_filter = LogScrubbingFilter()
    record = logging.LogRecord(
        name="test_logger",
        level=logging.INFO,
        pathname="test.py",
        lineno=10,
        msg="API error connecting to redis://:mypassword@localhost:6379",
        args=(),
        exc_info=None
    )
    scrub_filter.filter(record)
    assert "mypassword" not in record.msg
    assert "redis://:***@localhost:6379" in record.msg

def test_metrics_endpoint_unconfigured_returns_404(monkeypatch):
    """When METRICS_TOKEN is not set, GET /metrics returns 404."""
    monkeypatch.delenv("METRICS_TOKEN", raising=False)
    res = client.get("/metrics")
    assert res.status_code == 404

def test_metrics_endpoint_unauthorized_returns_401(monkeypatch):
    """When METRICS_TOKEN is set but token is missing or wrong, returns 401."""
    monkeypatch.setenv("METRICS_TOKEN", "super-secret-metrics-token-12345")
    
    # Missing header
    res_no_auth = client.get("/metrics")
    assert res_no_auth.status_code == 401

    # Wrong header (different length and same length)
    res_wrong_len = client.get("/metrics", headers={"Authorization": "Bearer wrong"})
    assert res_wrong_len.status_code == 401
    
    res_same_len = client.get("/metrics", headers={"Authorization": "Bearer super-secret-metrics-token-99999"})
    assert res_same_len.status_code == 401

def test_metrics_cardinality_bounded_under_5000_random_requests():
    """Verify that 5000 requests to random paths produce at most 1000 keys and dict does not grow past cap."""
    metrics_collector.reset()

    # Simulate 5000 distinct random endpoints
    for i in range(5000):
        metrics_collector.record("GET", f"/random-path-cardinality-test-{i}", 200, 0.001)

    # Must be strictly capped at 1000 distinct metric keys
    assert len(metrics_collector._metrics) <= 1000
    # Must have aggregated into __overflow__
    overflow_keys = [k for k in metrics_collector._metrics if k[1] == "__overflow__"]
    assert len(overflow_keys) >= 1
    # Total count across metrics must equal 5000
    total_recorded = sum(val[0] for val in metrics_collector._metrics.values())
    assert total_recorded == 5000

def test_metrics_records_route_template_for_parameterized_paths():
    """Verify that /api/animals/123 and /api/animals/456 record route template /api/animals/{id} as a single label."""
    metrics_collector.reset()

    # Both requests hit /api/animals/{id} route (FastAPI router matches template)
    res1 = client.get("/api/animals/123")
    res2 = client.get("/api/animals/456")

    summary = metrics_collector.get_summary_dict()
    routes = [r["route"] for r in summary["routes"]]

    # Parameterized route template must be recorded
    assert "/api/animals/{id}" in routes
    # Raw IDs must NOT be recorded as separate route labels
    assert not any("123" in r for r in routes)
    assert not any("456" in r for r in routes)

def test_metrics_endpoint_authorized_returns_prometheus_and_json(monkeypatch):
    """Authorized GET /metrics returns Prometheus text format and JSON format."""
    token = "secret-telemetry-token-test"
    monkeypatch.setenv("METRICS_TOKEN", token)

    # Generate some metrics
    client.get("/health")
    
    # Prometheus format
    res_prom = client.get("/metrics", headers={"Authorization": f"Bearer {token}"})
    assert res_prom.status_code == 200
    assert "aniresq_http_requests_total" in res_prom.text
    assert "text/plain" in res_prom.headers.get("content-type", "")

    # JSON format
    res_json = client.get("/metrics", headers={"Authorization": f"Bearer {token}", "Accept": "application/json"})
    assert res_json.status_code == 200
    data = res_json.json()
    assert "routes" in data
    assert any(r["route"] == "/health" for r in data["routes"])

def test_sentry_event_sanitizer():
    """Verify Sentry event sanitizer removes Authorization headers and request bodies."""
    event = {
        "request": {
            "headers": {
                "Authorization": "Bearer sensitive-jwt-token",
                "Cookie": "session=secret-session-id",
                "User-Agent": "Mozilla/5.0",
                "Accept": "application/json"
            },
            "data": {"username": "admin", "password": "SecretPassword123"}
        }
    }

    sanitized = sanitize_sentry_event(event, {})
    headers = sanitized["request"]["headers"]
    assert "Authorization" not in headers
    assert "Cookie" not in headers
    assert headers["User-Agent"] == "Mozilla/5.0"
    assert sanitized["request"]["data"] == "[STRIPPED_FOR_PRIVACY]"
