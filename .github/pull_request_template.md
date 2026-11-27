## Summary of Changes
<!-- Provide a clear description of the functionality or security fix introduced. -->

## Checklist
- [ ] **Tests Passing**: Added or updated tests covering happy path, validation, authorization, and error handling.
- [ ] **Code Coverage**: Maintained line coverage $\ge 85\%$ for API routers and relevant frontend thresholds.
- [ ] **Security Review**:
  - [ ] No direct Supabase mutation from client code (all mutations mediated by backend API).
  - [ ] Rate limits and authorization guards verified.
  - [ ] PII and sensitive fields protected from unauthenticated access.
  - [ ] No hardcoded secrets, test credentials, or private keys committed.
- [ ] **Database Integrity**:
  - [ ] New migrations placed sequentially after latest migration without modifying existing migrations.
  - [ ] Checksum verification passes (`python supabase/ci/check_migrations.py`).
  - [ ] RLS enabled and direct mutation privileges revoked from `anon`/`authenticated`.
- [ ] **Contract Sync**:
  - [ ] Ran `pnpm run generate:openapi` and verified zero contract drift in `packages/shared-types`.

## Verification Commands Run Locally
```bash
# API tests with coverage
pytest apps/api/tests --cov=apps/api --cov-branch

# Frontend tests & lint
pnpm --filter @aniresq/web run test
pnpm --filter @aniresq/web run lint

# Database migration & integrity check
python supabase/ci/check_migrations.py
```
