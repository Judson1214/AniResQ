import os
import sys
import time
from typing import Optional
import pytest
import jwt
from pathlib import Path
from starlette.testclient import TestClient

api_dir = Path(__file__).resolve().parent
if str(api_dir) not in sys.path:
    sys.path.insert(0, str(api_dir))

from main import app
from auth import _USER_CACHE
from rate_limiter import limiter
from supabase_config import SUPABASE_URL
from routers.settings import _RUNTIME_SETTINGS, DEFAULT_SETTINGS

TEST_JWT_SECRET = "super-secret-test-jwt-key-32-chars-long!"
os.environ["SUPABASE_JWT_SECRET"] = TEST_JWT_SECRET
os.environ["ENV"] = "test"

@pytest.fixture(autouse=True)
def reset_global_state():
    limiter.reset()
    _USER_CACHE.clear()
    app.dependency_overrides.clear()
    _RUNTIME_SETTINGS.clear()
    _RUNTIME_SETTINGS.update(DEFAULT_SETTINGS)
    yield
    limiter.reset()
    _USER_CACHE.clear()
    app.dependency_overrides.clear()
    _RUNTIME_SETTINGS.clear()
    _RUNTIME_SETTINGS.update(DEFAULT_SETTINGS)

@pytest.fixture
def client():
    return TestClient(app)

def create_test_token(user_id: str, email: str, role: str) -> str:
    now = int(time.time())
    payload = {
        "sub": user_id,
        "email": email,
        "aud": "authenticated",
        "iss": f"{SUPABASE_URL.rstrip('/')}/auth/v1",
        "exp": now + 3600,
        "iat": now,
        "app_metadata": {"role": role},
        "user_metadata": {"name": f"Test {role}"}
    }
    return jwt.encode(payload, TEST_JWT_SECRET, algorithm="HS256")

@pytest.fixture
def make_auth_header():
    def _make(user_id: str, role: str = "CITIZEN", email: Optional[str] = None):
        email = email or f"{role.lower()}_{user_id[:8]}@test.com"
        token = create_test_token(user_id, email, role)
        return {"Authorization": f"Bearer {token}"}
    return _make

@pytest.fixture
def citizen_user():
    uid = "11111111-1111-1111-1111-111111111111"
    return {
        "id": uid,
        "uid": uid,
        "email": "citizen@test.com",
        "role": "CITIZEN",
        "is_disabled": False,
        "headers": {"Authorization": f"Bearer {create_test_token(uid, 'citizen@test.com', 'CITIZEN')}"}
    }

@pytest.fixture
def volunteer_user():
    uid = "22222222-2222-2222-2222-222222222222"
    return {
        "id": uid,
        "uid": uid,
        "email": "volunteer@test.com",
        "role": "VOLUNTEER",
        "is_disabled": False,
        "headers": {"Authorization": f"Bearer {create_test_token(uid, 'volunteer@test.com', 'VOLUNTEER')}"}
    }

@pytest.fixture
def ngo_user():
    uid = "33333333-3333-3333-3333-333333333333"
    return {
        "id": uid,
        "uid": uid,
        "email": "ngo@test.com",
        "role": "NGO",
        "is_disabled": False,
        "headers": {"Authorization": f"Bearer {create_test_token(uid, 'ngo@test.com', 'NGO')}"}
    }

@pytest.fixture
def vet_user():
    uid = "44444444-4444-4444-4444-444444444444"
    return {
        "id": uid,
        "uid": uid,
        "email": "vet@test.com",
        "role": "VET",
        "is_disabled": False,
        "headers": {"Authorization": f"Bearer {create_test_token(uid, 'vet@test.com', 'VET')}"}
    }

@pytest.fixture
def admin_user():
    uid = "55555555-5555-5555-5555-555555555555"
    return {
        "id": uid,
        "uid": uid,
        "email": "admin@test.com",
        "role": "ADMIN",
        "is_disabled": False,
        "headers": {"Authorization": f"Bearer {create_test_token(uid, 'admin@test.com', 'ADMIN')}"}
    }
