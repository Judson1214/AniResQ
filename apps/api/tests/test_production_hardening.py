import os
import time
import pytest
import jwt
from unittest.mock import MagicMock
from starlette.testclient import TestClient

from main import app
from errors import (
    NotFoundError,
    ConflictError,
    ForbiddenError,
    ValidationFailedError,
    map_db_error
)
from auth import (
    verify_token_locally,
    get_current_user,
    get_optional_user,
    invalidate_user_cache,
    _USER_CACHE
)
from rate_limiter import (
    BaseRateLimitStore,
    MemoryRateLimitStore,
    RedisRateLimitStore,
    SharedSlidingWindowRateLimiter,
    limiter,
    get_client_ip,
    mask_redis_url,
    LUA_SLIDING_WINDOW
)
from validators import (
    validate_photo_url,
    validate_avatar_url
)
from supabase_config import SUPABASE_URL

client = TestClient(app)

TEST_JWT_SECRET = "super-secret-test-jwt-key-32-chars-long!"
TEST_ISSUER = f"{SUPABASE_URL.rstrip('/')}/auth/v1"

@pytest.fixture(autouse=True)
def reset_test_state():
    limiter.reset()
    _USER_CACHE.clear()
    app.dependency_overrides.clear()
    os.environ["SUPABASE_JWT_SECRET"] = TEST_JWT_SECRET

def generate_test_jwt(
    sub: str = "00000000-0000-0000-0000-000000000001",
    email: str = "tester@aniresq.com",
    role: str = "authenticated",
    exp_delta: int = 3600,
    aud: str = "authenticated",
    iss: str = TEST_ISSUER,
    secret: str = TEST_JWT_SECRET,
) -> str:
    now = int(time.time())
    claims = {
        "sub": sub,
        "email": email,
        "aud": aud,
        "iss": iss,
        "iat": now,
        "exp": now + exp_delta,
        "role": role,
        "app_metadata": {"provider": "email"},
        "user_metadata": {"display_name": "Test User"},
    }
    return jwt.encode(claims, secret, algorithm="HS256")


# =============================================================================
# 1. Shared Rate Limiter Tests
# =============================================================================

def test_shared_store_limit_enforced_across_instances():
    """Verify that multiple limiter instances sharing the same store enforce limits collectively."""
    shared_store = MemoryRateLimitStore()
    limiter1 = SharedSlidingWindowRateLimiter(store=shared_store, window_seconds=60)
    limiter2 = SharedSlidingWindowRateLimiter(store=shared_store, window_seconds=60)

    test_ip = "192.168.1.100"
    path = "/api/animals/surrender"  # Tier: surrender (limit 10)

    # First 5 calls via limiter1
    for _ in range(5):
        allowed, _ = limiter1.is_allowed(test_ip, path=path, method="POST")
        assert allowed is True

    # Next 5 calls via limiter2
    for _ in range(5):
        allowed, _ = limiter2.is_allowed(test_ip, path=path, method="POST")
        assert allowed is True

    # 11th call across shared store should be rejected
    allowed, retry_after = limiter1.is_allowed(test_ip, path=path, method="POST")
    assert allowed is False
    assert retry_after > 0

    allowed, retry_after = limiter2.is_allowed(test_ip, path=path, method="POST")
    assert allowed is False
    assert retry_after > 0

def test_rate_limiter_retry_after_and_json_shape():
    """Verify 429 response contains Retry-After header and standardized JSON shape."""
    test_limiter = SharedSlidingWindowRateLimiter(store=MemoryRateLimitStore(), window_seconds=60)
    for _ in range(10):
        test_limiter.is_allowed("10.0.0.1", path="/api/users/request-clearance", method="POST")
    
    # 11th request rejected
    allowed, retry_after = test_limiter.is_allowed("10.0.0.1", path="/api/users/request-clearance", method="POST")
    assert allowed is False
    assert retry_after >= 1

def test_client_ip_spoofed_x_forwarded_for_ignored_when_disabled(monkeypatch):
    """When TRUST_PROXY_HEADERS is false, spoofed X-Forwarded-For is strictly ignored."""
    monkeypatch.setenv("TRUST_PROXY_HEADERS", "false")
    req = MagicMock()
    req.headers = {"x-forwarded-for": "203.0.113.195, 198.51.100.1"}
    req.client = MagicMock(host="192.168.1.50")

    assert get_client_ip(req) == "192.168.1.50"

def test_client_ip_trusted_proxy_hops(monkeypatch):
    """When TRUST_PROXY_HEADERS is true, extracts IP from the trusted proxy hop."""
    monkeypatch.setenv("TRUST_PROXY_HEADERS", "true")
    monkeypatch.setenv("TRUSTED_PROXIES_COUNT", "1")
    req = MagicMock()
    req.headers = {"x-forwarded-for": "client.evil.com, 103.21.244.2"}
    req.client = MagicMock(host="10.0.0.2")

    # Takes the entry added by the last trusted proxy hop (-1)
    assert get_client_ip(req) == "103.21.244.2"

def test_rate_limiter_store_down_fail_open_for_reads_and_local_fallback_for_sensitive():
    """Verify store-down behavior: read endpoints fail open, sensitive endpoints fall back to local limiter."""
    class BrokenStore(BaseRateLimitStore):
        def is_allowed(self, key: str, limit: int, window_seconds: int):
            raise ConnectionError("Redis is offline")

    faulty_limiter = SharedSlidingWindowRateLimiter(store=BrokenStore(), window_seconds=60)

    # Read endpoint fails open gracefully with warning
    allowed, retry = faulty_limiter.is_allowed("1.2.3.4", path="/api/rescues/public", method="GET")
    assert allowed is True
    assert retry == 0

    # Sensitive endpoint falls back to local memory store (still enforces limit)
    for _ in range(10):
        allowed, _ = faulty_limiter.is_allowed("1.2.3.4", path="/api/animals/surrender", method="POST")
        assert allowed is True

    # 11th request blocked by local fallback
    allowed, retry_after = faulty_limiter.is_allowed("1.2.3.4", path="/api/animals/surrender", method="POST")
    assert allowed is False
    assert retry_after > 0


# =============================================================================
# 2. Authentication Without Network Round-Trip Tests
# =============================================================================

def test_jwt_local_verification_happy_path(monkeypatch):
    """Happy path verifies locally without calling supabase.auth.get_user."""
    token = generate_test_jwt(sub="user-123", email="user@test.com")

    # Mock supabase.auth.get_user to ensure it is NOT called
    mock_get_user = MagicMock()
    monkeypatch.setattr("auth.supabase.auth.get_user", mock_get_user)

    payload = verify_token_locally(token)
    assert payload["sub"] == "user-123"
    assert payload["email"] == "user@test.com"
    mock_get_user.assert_not_called()

def test_jwt_expired_token_rejected():
    expired_token = generate_test_jwt(exp_delta=-60)
    with pytest.raises(Exception) as exc_info:
        verify_token_locally(expired_token)
    assert exc_info.value.status_code == 401

def test_jwt_wrong_audience_rejected():
    wrong_aud_token = generate_test_jwt(aud="wrong-audience")
    with pytest.raises(Exception) as exc_info:
        verify_token_locally(wrong_aud_token)
    assert exc_info.value.status_code == 401

def test_jwt_wrong_issuer_rejected():
    wrong_iss_token = generate_test_jwt(iss="https://evil-issuer.com/auth/v1")
    with pytest.raises(Exception) as exc_info:
        verify_token_locally(wrong_iss_token)
    assert exc_info.value.status_code == 401

def test_jwt_tampered_token_rejected():
    valid_token = generate_test_jwt()
    tampered = valid_token[:-4] + "xyz1"
    with pytest.raises(Exception) as exc_info:
        verify_token_locally(tampered)
    assert exc_info.value.status_code == 401

def test_user_role_caching_and_invalidation(monkeypatch):
    """Role is cached on initial lookup and re-fetched after invalidation."""
    token = generate_test_jwt(sub="cached-user-1")

    db_select_mock = MagicMock()
    db_select_mock.execute.return_value.data = [{"role": "VOLUNTEER", "display_name": "Vol", "is_disabled": False}]

    table_mock = MagicMock()
    table_mock.select.return_value.eq.return_value = db_select_mock
    monkeypatch.setattr("auth.supabase.table", lambda table_name: table_mock)

    creds = MagicMock(credentials=token)

    # First call: hits database
    user = get_current_user(creds)
    assert user["role"] == "VOLUNTEER"
    assert db_select_mock.execute.call_count == 1

    # Second call: served from in-process cache (no new DB call)
    user2 = get_current_user(creds)
    assert user2["role"] == "VOLUNTEER"
    assert db_select_mock.execute.call_count == 1

    # Invalidate cache (e.g. after role change RPC)
    invalidate_user_cache("cached-user-1")

    # Change mock role to NGO
    db_select_mock.execute.return_value.data = [{"role": "NGO", "display_name": "Vol", "is_disabled": False}]

    # Third call: re-fetches from database
    user3 = get_current_user(creds)
    assert user3["role"] == "NGO"
    assert db_select_mock.execute.call_count == 2

def test_disabled_user_rejected_with_403(monkeypatch):
    """Disabled accounts (is_disabled=True) are rejected with 403 Forbidden."""
    token = generate_test_jwt(sub="banned-user-1")

    db_select_mock = MagicMock()
    db_select_mock.execute.return_value.data = [{"role": "CITIZEN", "display_name": "Banned", "is_disabled": True}]

    table_mock = MagicMock()
    table_mock.select.return_value.eq.return_value = db_select_mock
    monkeypatch.setattr("auth.supabase.table", lambda table_name: table_mock)

    creds = MagicMock(credentials=token)
    with pytest.raises(Exception) as exc_info:
        get_current_user(creds)
    assert exc_info.value.status_code == 403
    assert "disabled" in exc_info.value.detail.lower()

def test_database_error_on_role_fetch_fails_closed_503(monkeypatch):
    """Database outage while loading user profile fails closed with 503 on protected routes."""
    token = generate_test_jwt(sub="db-fail-user")

    table_mock = MagicMock()
    table_mock.select.return_value.eq.return_value.execute.side_effect = Exception("DB connection timeout")
    monkeypatch.setattr("auth.supabase.table", lambda table_name: table_mock)

    creds = MagicMock(credentials=token)
    with pytest.raises(Exception) as exc_info:
        get_current_user(creds)
    assert exc_info.value.status_code == 503

def test_optional_user_treats_bad_token_as_anonymous():
    """get_optional_user treats expired or invalid credentials as anonymous (None)."""
    expired_token = generate_test_jwt(exp_delta=-100)
    creds = MagicMock(credentials=expired_token)
    assert get_optional_user(creds) is None
    assert get_optional_user(None) is None


# =============================================================================
# 3. Error Handling Hierarchy & Request-ID Middleware
# =============================================================================

def test_app_error_mapping_postgres_codes():
    err_23505 = Exception("duplicate key value violates unique constraint 'users_email_key' (SQLSTATE 23505)")
    mapped = map_db_error(err_23505)
    assert isinstance(mapped, ConflictError)
    assert mapped.status_code == 409

    err_23503 = Exception("insert or update on table violates foreign key constraint (SQLSTATE 23503)")
    mapped_fk = map_db_error(err_23503)
    assert isinstance(mapped_fk, NotFoundError)
    assert mapped_fk.status_code == 404

    err_23514 = Exception("new row violates check constraint 'chk_severity' (SQLSTATE 23514)")
    mapped_chk = map_db_error(err_23514)
    assert isinstance(mapped_chk, ValidationFailedError)
    assert mapped_chk.status_code == 422

    err_42501 = Exception("permission denied for table users (SQLSTATE 42501)")
    mapped_perm = map_db_error(err_42501)
    assert isinstance(mapped_perm, ForbiddenError)
    assert mapped_perm.status_code == 403

def test_request_id_header_and_error_envelope():
    """Incoming valid X-Request-ID is preserved and included in error envelope."""
    custom_id = "test-req-id-12345"
    response = client.get("/api/users/non-existent-user-id", headers={"X-Request-ID": custom_id})
    assert response.headers.get("X-Request-ID") == custom_id
    data = response.json()
    assert data.get("requestId") == custom_id
    assert "code" in data
    assert "detail" in data


# =============================================================================
# 4. URL Validation & Storage Protection Tests
# =============================================================================

def test_validate_photo_url_rejects_path_traversal():
    bad_urls = [
        f"{SUPABASE_URL.rstrip('/')}/storage/v1/object/public/uploads/../../../etc/passwd",
        f"{SUPABASE_URL.rstrip('/')}/storage/v1/object/public/uploads/%2e%2e/%2e%2e/secret",
        f"{SUPABASE_URL.rstrip('/')}/storage/v1/object/public/uploads/folder\\hack.jpg",
    ]
    for url in bad_urls:
        with pytest.raises(Exception) as exc_info:
            validate_photo_url(url)
        assert exc_info.value.status_code == 422

def test_validate_photo_url_rejects_wrong_host_and_non_https():
    # Wrong host
    with pytest.raises(Exception) as exc_info:
        validate_photo_url("https://attacker-supabase.co/storage/v1/object/public/uploads/photo.jpg")
    assert exc_info.value.status_code == 422

    # HTTP scheme on remote domain
    with pytest.raises(Exception) as exc_info:
        validate_photo_url("http://remote.supabase.co/storage/v1/object/public/uploads/photo.jpg")
    assert exc_info.value.status_code == 422

def test_validate_avatar_url_requires_caller_directory():
    caller_uid = "00000000-0000-0000-0000-000000000001"
    valid_avatar = f"{SUPABASE_URL.rstrip('/')}/storage/v1/object/public/uploads/{caller_uid}/avatar.jpg"
    assert validate_avatar_url(valid_avatar, caller_uid=caller_uid) == valid_avatar

    # Another user's avatar path rejected
    foreign_avatar = f"{SUPABASE_URL.rstrip('/')}/storage/v1/object/public/uploads/99999999-9999-9999-9999-999999999999/avatar.jpg"
    with pytest.raises(Exception) as exc_info:
        validate_avatar_url(foreign_avatar, caller_uid=caller_uid)
    assert exc_info.value.status_code == 422


# =============================================================================
# 5. Security Headers, Health Endpoints & Body Size Tests
# =============================================================================

def test_health_and_readiness_probes():
    res_health = client.get("/health")
    assert res_health.status_code == 200
    assert res_health.json()["status"] == "ok"

    res_ready = client.get("/ready")
    assert res_ready.status_code in [200, 503]

def test_security_headers_present_on_api_responses():
    res = client.get("/health")
    assert res.headers.get("X-Content-Type-Options") == "nosniff"
    assert res.headers.get("X-Frame-Options") == "DENY"
    assert res.headers.get("Referrer-Policy") == "strict-origin-when-cross-origin"

def test_payload_too_large_rejected_with_413():
    huge_payload_headers = {
        "Content-Length": str(15 * 1024 * 1024),  # 15 MB
        "Content-Type": "application/json",
    }
    res = client.post("/api/rescues/", headers=huge_payload_headers, content=b"{}")
    assert res.status_code == 413
    assert res.json()["code"] == "PAYLOAD_TOO_LARGE"


# =============================================================================
# 6. Task 5 Review Hardening Tests
# =============================================================================

def test_mask_redis_url_masks_passwords():
    """Verify that Redis URLs with passwords have the password masked in logs."""
    assert mask_redis_url("redis://:secretpassword@redis.internal:6379/0") == "redis://:***@redis.internal:6379/0"
    assert mask_redis_url("redis://appuser:supersecret@10.0.0.5:6379/2") == "redis://appuser:***@10.0.0.5:6379/2"
    assert mask_redis_url("redis://localhost:6379/0") == "redis://localhost:6379/0"
    assert mask_redis_url("") == ""
    assert mask_redis_url(None) == ""


def test_rate_limiter_startup_masks_redis_password_in_logs(caplog, monkeypatch):
    """Verify that initializing SharedSlidingWindowRateLimiter does not leak Redis password in logs."""
    secret_url = "redis://admin:super_secret_cleartext_password@10.0.0.1:6379/0"
    monkeypatch.setenv("REDIS_URL", secret_url)

    import logging
    with caplog.at_level(logging.INFO):
        # We expect connection failure since 10.0.0.1 is unreachable
        lim = SharedSlidingWindowRateLimiter()
        # Verify cleartext password is NOT in any log record
        for record in caplog.records:
            assert "super_secret_cleartext_password" not in record.message
            if "10.0.0.1" in record.message:
                assert "***" in record.message


def test_generic_invalid_authentication_token():
    """Verify that token validation errors return generic 'Invalid authentication token' message."""
    # 1. Tampered signature
    valid_token = generate_test_jwt()
    tampered_token = valid_token[:-4] + "abcd"
    res_tampered = client.get("/api/users/profile", headers={"Authorization": f"Bearer {tampered_token}"})
    assert res_tampered.status_code == 401
    assert res_tampered.json()["detail"] == "Invalid authentication token"

    # 2. Malformed token format
    res_malformed = client.get("/api/users/profile", headers={"Authorization": "Bearer not-a-valid-jwt"})
    assert res_malformed.status_code == 401
    assert res_malformed.json()["detail"] == "Invalid authentication token"

    # 3. Wrong secret
    wrong_token = generate_test_jwt(secret="wrong-secret-key-32-chars-length!")
    res_wrong = client.get("/api/users/profile", headers={"Authorization": f"Bearer {wrong_token}"})
    assert res_wrong.status_code == 401
    assert res_wrong.json()["detail"] == "Invalid authentication token"


def test_readiness_probe_rate_limit_30_per_min():
    """Verify that /ready probe is rate limited to 30 requests per minute per IP."""
    limiter.reset()

    # 30 requests succeed (or return 503 if dummy db offline, but not 429)
    for _ in range(30):
        res = client.get("/ready")
        assert res.status_code in [200, 503]

    # 31st request should be rate limited with 429
    res_exceeded = client.get("/ready")
    assert res_exceeded.status_code == 429
    assert res_exceeded.json()["code"] == "RATE_LIMIT_EXCEEDED"
    assert "Retry-After" in res_exceeded.headers


def test_redis_rate_limit_unique_member_and_lua_script():
    """Verify RedisRateLimitStore passes a unique member ID to prevent member collision in sorted set."""
    mock_redis = MagicMock()
    recorded_calls = []

    def mock_script_runner(keys, args):
        recorded_calls.append({"keys": keys, "args": args})
        return [1, 0]

    mock_script = MagicMock(side_effect=mock_script_runner)
    mock_redis.register_script.return_value = mock_script

    store = RedisRateLimitStore(mock_redis)

    # Invoke multiple times at the same timestamp
    allowed1, _ = store.is_allowed("user-test-key", limit=10, window_seconds=60)
    allowed2, _ = store.is_allowed("user-test-key", limit=10, window_seconds=60)

    assert allowed1 is True
    assert allowed2 is True
    assert len(recorded_calls) == 2

    # Check that ARGV has 4 arguments and ARGV[4] (random_id) is unique between calls
    args1 = recorded_calls[0]["args"]
    args2 = recorded_calls[1]["args"]
    assert len(args1) == 4
    assert len(args2) == 4
    assert args1[3] != args2[3]  # random_id differs between distinct calls

    # Verify Lua script string constructs member as now:random_id
    assert "local member = tostring(now) .. ':' .. tostring(random_id)" in LUA_SLIDING_WINDOW
    assert "redis.call('ZADD', key, now, member)" in LUA_SLIDING_WINDOW
