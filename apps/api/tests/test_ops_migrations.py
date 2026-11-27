import re
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parent.parent.parent.parent
MIGRATIONS_DIR = REPO_ROOT / "supabase" / "migrations"
LIVE_AUDIT_FILE = REPO_ROOT / "supabase" / "ops" / "live_audit.sql"

def test_live_audit_migrations_up_to_date():
    """Assert that supabase/ops/live_audit.sql contains every migration in supabase/migrations/."""
    assert LIVE_AUDIT_FILE.exists(), f"live_audit.sql not found at {LIVE_AUDIT_FILE}"
    assert MIGRATIONS_DIR.exists(), f"migrations directory not found at {MIGRATIONS_DIR}"

    audit_sql = LIVE_AUDIT_FILE.read_text(encoding="utf-8")
    migration_files = sorted([f.name for f in MIGRATIONS_DIR.glob("*.sql")])

    assert len(migration_files) > 0, "No migration files found"

    missing = []
    for f in migration_files:
        if f not in audit_sql:
            missing.append(f)

    assert not missing, f"supabase/ops/live_audit.sql is missing migrations: {missing}"
