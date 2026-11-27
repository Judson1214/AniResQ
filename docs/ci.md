# AniResQ Continuous Integration & Testing Documentation

This document describes the AniResQ CI pipeline architecture, required quality gates, security controls, and instructions for running all checks locally.

---

## 1. Pipeline Overview

The CI pipeline runs on every pull request targeting `main` and on merges to `main`. It enforces strict zero-trust quality and security standards across the backend, frontend, database, and schema contracts.

### Quality & Security Gates

| Job | Description | Enforcement Criteria |
| --- | ----------- | -------------------- |
| **`lint`** | ESLint with jsx-a11y and Python Ruff | Zero warnings, zero errors |
| **`web-test`** | Vitest with JSDOM and v8 coverage | All tests pass, coverage thresholds met, clean production build |
| **`api-test`** | Pytest with randomized execution order (`pytest-randomly`) | $\ge 85\%$ line coverage overall, $\ge 80\%$ router line coverage |
| **`db-test`** | Empty PostgreSQL 16 container test | All 16 migrations apply cleanly, checksums match, `verify.sql` passes 21 catalog checks |
| **`contract-ci`** | OpenAPI schema generation & TypeScript types | Zero contract drift between FastAPI models and frontend types |
| **`security-scan`** | Dependency audits, SAST & secret scanning | `pip-audit`, `pnpm audit`, Bandit, Gitleaks |
| **`codeql`** | GitHub CodeQL static analysis | Scans Python and JavaScript/TypeScript code |
| **`summary`** | Pipeline Gatekeeper | Requires all antecedent jobs to succeed before PR can merge |

---

## 2. Running Checks Locally

### Backend API (`apps/api`)
```bash
# Activate virtual environment
source apps/api/venv/bin/activate  # Or apps/api/venv/Scripts/Activate.ps1 on Windows

# Run tests with coverage and random ordering
pytest apps/api/tests/ -v --cov=apps/api --cov-report=term-missing --cov-branch

# Verify OpenAPI contract sync
pytest apps/api/tests/test_contracts.py

# Run static application security testing (Bandit)
bandit -r apps/api -c bandit.yaml

# Run dependency vulnerability audit
pip-audit -r apps/api/requirements.txt
```

### Frontend Web (`apps/web`)
```bash
# Run unit & component tests
pnpm --filter @aniresq/web run test

# Run tests with coverage report
pnpm --filter @aniresq/web run test:coverage

# Run ESLint (including a11y checks)
pnpm --filter @aniresq/web run lint

# Check TypeScript types
pnpm --filter @aniresq/web exec tsc --noEmit

# Run production build
pnpm --filter @aniresq/web run build
```

### Database & Migrations (`supabase`)
```bash
# Validate migration ordering and SHA256 checksums
python supabase/ci/check_migrations.py

# Run full migration application and security verification on empty Postgres
DATABASE_URL=postgres://postgres:postgres@localhost:5432/aniresq_ci bash supabase/ci/run_db_checks.sh
```

---

## 3. Security Architecture & Defense in Depth

1. **Database Row Level Security (RLS)**:
   - All public tables have `relrowsecurity = true`.
   - Mutation permissions (`INSERT`, `UPDATE`, `DELETE`, `TRUNCATE`, `REFERENCES`, `TRIGGER`) are revoked from `anon` and `authenticated` roles.
2. **API Authorization & PII Protection**:
   - Contact numbers on Lost & Found posts and user profiles are strictly redacted for unauthenticated users and unauthorized third parties.
   - Partial unique indexes enforce application integrity at the database engine level (e.g., preventing duplicate open adoption applications).
3. **CI Pipeline Hardening**:
   - GitHub Actions workflows use top-level `permissions: contents: read` to adhere to the principle of least privilege.
   - All third-party GitHub Actions are pinned to full immutable commit SHAs with semantic version comments.
