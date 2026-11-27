# Runbook 10: Dropping Deprecated `id_card_number` Column

This document describes the second phase of the Expand and Contract pattern for PII minimization of responder identification numbers.

---

## 1. When to Run

> [!IMPORTANT]
> **DO NOT APPLY THIS MIGRATION PREMATURELY.**
> This migration must **only** be executed after:
> 1. The community pilot API release (which uses `id_card_last4` exclusively and stops reading/writing `id_card_number`) has been deployed to production and running for at least one full deployment cycle.
> 2. All active clearance requests have been reviewed or updated.
> 3. A complete database backup has been taken via `pg_dump` or Supabase snapshot.

---

## 2. Preconditions Verification Query

Execute the following SQL query in the Supabase SQL Editor to confirm that all existing rows with an `id_card_number` have had their `id_card_last4` populated:

```sql
SELECT COUNT(*) AS unmigrated_count
FROM public.users
WHERE id_card_number IS NOT NULL
  AND (id_card_last4 IS NULL OR id_card_last4 = '');
```

**Expected Result**: `unmigrated_count` must be `0`. If greater than zero, run the backfill query:

```sql
UPDATE public.users
SET id_card_last4 = RIGHT(id_card_number, 4)
WHERE id_card_number IS NOT NULL
  AND (id_card_last4 IS NULL OR id_card_last4 = '');
```

---

## 3. Migration SQL (Phase 2: Contract)

When the preconditions are satisfied, apply this SQL via a new versioned migration (e.g. `YYYYMMDDHHMMSS_drop_deprecated_id_card_number.sql`):

```sql
-- Phase 2 Contract: Drop deprecated PII column id_card_number
ALTER TABLE public.users
    DROP COLUMN IF EXISTS id_card_number;
```

---

## 4. Post-Execution Verification

Verify the column is removed and `id_card_last4` remains intact:

```sql
SELECT column_name, data_type
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'users'
  AND column_name IN ('id_card_number', 'id_card_last4');
```

**Expected Result**: Only `id_card_last4` is returned.
