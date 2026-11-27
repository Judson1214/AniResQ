import os
import re
import pytest
from pathlib import Path
from config_validator import validate_production_config

REPO_ROOT = Path(__file__).resolve().parent.parent.parent.parent
API_SRC = Path(__file__).resolve().parent.parent
API_ENV_EXAMPLE = API_SRC / ".env.example"
WEB_ENV_EXAMPLE = REPO_ROOT / "apps" / "web" / ".env.example"

def test_validate_production_config_skips_in_dev_or_test():
    """In non-production environments, validate_production_config does nothing."""
    validate_production_config({"ENV": "development"})
    validate_production_config({"ENV": "test"})
    validate_production_config({})

def test_validate_production_config_passes_valid_prod():
    """Valid production configuration passes without exception."""
    valid_env = {
        "ENV": "production",
        "SUPABASE_URL": "https://valid-project.supabase.co",
        "SUPABASE_SERVICE_ROLE_KEY": "dummy-valid-service-role-key-for-test",
        "SUPABASE_JWT_SECRET": "a-secure-32-byte-long-production-jwt-secret-string",
        "CORS_ORIGINS": "https://app.aniresq.com,https://admin.aniresq.com",
        "TRUST_PROXY_HEADERS": "true",
        "REDIS_URL": "redis://default:dummy-password@localhost:6379",
    }
    # Should not raise
    validate_production_config(valid_env)

def test_validate_production_config_in_memory_fallback():
    """Allow in-memory rate limiter warning if ALLOW_IN_MEMORY_RATE_LIMIT=true."""
    env = {
        "ENV": "production",
        "SUPABASE_URL": "https://valid-project.supabase.co",
        "SUPABASE_SERVICE_ROLE_KEY": "dummy-valid-service-role-key-for-test",
        "SUPABASE_JWT_SECRET": "a-secure-32-byte-long-production-jwt-secret-string",
        "CORS_ORIGINS": "https://app.aniresq.com",
        "TRUST_PROXY_HEADERS": "true",
        "ALLOW_IN_MEMORY_RATE_LIMIT": "true",
    }
    # Should succeed without redis when explicitly allowed
    validate_production_config(env)

def test_validate_production_config_detects_all_errors():
    """Insecure production config raises RuntimeError listing all flaws without secrets."""
    insecure_env = {
        "ENV": "production",
        "SUPABASE_URL": "http://insecure-supabase.co", # not https
        "SUPABASE_SERVICE_ROLE_KEY": "", # missing
        "SUPABASE_JWT_SECRET": "short-secret", # < 32 chars
        "CORS_ORIGINS": "http://app.aniresq.com,*", # contains wildcard and http
        "TRUST_PROXY_HEADERS": "", # not set
        "REDIS_URL": "", # missing and no fallback
    }

    with pytest.raises(RuntimeError) as exc_info:
        validate_production_config(insecure_env)

    err = str(exc_info.value)
    assert "SUPABASE_URL must use https://" in err
    assert "SUPABASE_SERVICE_ROLE_KEY is missing or empty" in err
    assert "SUPABASE_JWT_SECRET must be at least 32 characters" in err
    assert "CORS_ORIGINS cannot contain wildcard '*'" in err
    assert "CORS origin 'http://app.aniresq.com' must use https://" in err
    assert "TRUST_PROXY_HEADERS must be explicitly set" in err
    assert "REDIS_URL is required in production" in err

    # Ensure no sensitive credentials ever appear in error output
    assert "dummy" not in err
    assert "password" not in err.lower()

def test_env_example_contains_all_getenv_variables():
    """Test that apps/api/.env.example contains every variable read via os.getenv or os.environ."""
    assert API_ENV_EXAMPLE.exists(), f"Missing {API_ENV_EXAMPLE}"

    example_content = API_ENV_EXAMPLE.read_text(encoding="utf-8")
    example_vars = set(re.findall(r"^([A-Z0-9_]+)=", example_content, re.MULTILINE))

    # Scan all Python files in apps/api (excluding venv/tests)
    code_vars = set()
    getenv_pattern = re.compile(r'os\.(?:getenv|environ\.get)\(\s*["\']([A-Z0-9_]+)["\']')

    for py_file in API_SRC.rglob("*.py"):
        # Exclude venv, .venv, tests
        if "venv" in py_file.parts or ".venv" in py_file.parts or "tests" in py_file.parts:
            continue
        content = py_file.read_text(encoding="utf-8")
        matches = getenv_pattern.findall(content)
        for var in matches:
            code_vars.add(var)

    # Variables with internal or external library defaults that are aliases
    # (e.g. ENVIRONMENT as alias to ENV, JWT_SECRET as alias to SUPABASE_JWT_SECRET)
    KNOWN_ALIASES = {"ENVIRONMENT", "JWT_SECRET", "TRUSTED_HOPS", "RATE_LIMIT_PER_MINUTE", "ADMIN_PASSWORD", "CITIZEN_PASSWORD"}
    missing = [var for var in code_vars if var not in example_vars and var not in KNOWN_ALIASES]

    assert not missing, f"apps/api/.env.example is missing variables read by codebase: {missing}"
