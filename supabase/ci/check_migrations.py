#!/usr/bin/env python3
"""
Migration verification script for AniResQ CI.
Validates:
1. Migration filename format and strictly chronological ordering.
2. SHA256 checksum integrity against supabase/ci/migrations.sha256.
3. Basic idempotency patterns (IF NOT EXISTS, IF EXISTS, CREATE OR REPLACE, ON CONFLICT).
"""
import hashlib
import re
import sys
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parent.parent.parent
MIGRATIONS_DIR = REPO_ROOT / "supabase" / "migrations"
CHECKSUMS_FILE = REPO_ROOT / "supabase" / "ci" / "migrations.sha256"

TIMESTAMP_PATTERN = re.compile(r"^(\d{14})_([a-z0-9_]+)\.sql$")

def check_migrations():
    if not MIGRATIONS_DIR.exists():
        print(f"ERROR: Migrations directory not found: {MIGRATIONS_DIR}")
        return 1

    files = sorted(list(MIGRATIONS_DIR.glob("*.sql")), key=lambda p: p.name)
    if not files:
        print("ERROR: No SQL migration files found in supabase/migrations/")
        return 1

    print(f"Verifying {len(files)} database migrations...")

    # 1. Order and format check
    last_timestamp = ""
    for f in files:
        match = TIMESTAMP_PATTERN.match(f.name)
        if not match:
            print(f"ERROR: Invalid migration filename format: {f.name}")
            return 1
        ts = match.group(1)
        if ts <= last_timestamp:
            print(f"ERROR: Migration timestamp out of order or duplicate: {f.name} (<= {last_timestamp})")
            return 1
        last_timestamp = ts

    print("PASS: Migration timestamps are strictly chronological and valid format.")

    # 2. Checksum verification
    if not CHECKSUMS_FILE.exists():
        print(f"ERROR: Checksums file not found: {CHECKSUMS_FILE}")
        return 1

    expected_checksums = {}
    for line in CHECKSUMS_FILE.read_text(encoding="utf-8").splitlines():
        line = line.strip()
        if not line or line.startswith("#"):
            continue
        parts = line.split(maxsplit=1)
        if len(parts) == 2:
            expected_checksums[parts[1].strip()] = parts[0].strip()

    mismatches = []
    missing_in_checksums = []
    for f in files:
        actual_hash = hashlib.sha256(f.read_bytes()).hexdigest()
        if f.name not in expected_checksums:
            missing_in_checksums.append(f.name)
        elif actual_hash != expected_checksums[f.name]:
            mismatches.append((f.name, expected_checksums[f.name], actual_hash))

    if missing_in_checksums:
        print("ERROR: Migrations missing from checksums file:")
        for name in missing_in_checksums:
            print(f"  - {name}")
        return 1

    if mismatches:
        print("ERROR: Checksum mismatch detected! Migration content was modified after release:")
        for name, exp, act in mismatches:
            print(f"  - {name}: expected {exp}, got {act}")
        return 1

    print("PASS: All migration SHA256 checksums match expected records.")

    # 3. Idempotency checks
    idempotency_patterns = [
        re.compile(r"IF NOT EXISTS", re.IGNORECASE),
        re.compile(r"IF EXISTS", re.IGNORECASE),
        re.compile(r"CREATE OR REPLACE", re.IGNORECASE),
        re.compile(r"ON CONFLICT", re.IGNORECASE),
        re.compile(r"DO \$\$", re.IGNORECASE),
    ]

    for f in files:
        content = f.read_text(encoding="utf-8")
        has_guard = any(p.search(content) for p in idempotency_patterns)
        if not has_guard:
            print(f"WARNING: Migration {f.name} may lack idempotency guards.")

    print("PASS: Database migration checks passed successfully.")
    return 0

if __name__ == "__main__":
    sys.exit(check_migrations())
