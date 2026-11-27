# Runbook 03: Creating the Initial Production Administrator

This runbook guides operators through the safe provisioning of the first production administrator account in AniResQ.

---

## 1. Why `seed_users.py` Must Never Run in Production

The local utility script [`apps/api/seed_users.py`](file:///d:/AniResQ/apps/api/seed_users.py) is strictly designed for local development and integration testing. It creates hardcoded test users with well-known email addresses (`admin@aniresq.com`, `citizen@aniresq.com`).

The script includes an explicit production guard (lines 72–75):
```python
    env_mode = (os.getenv("ENV") or os.getenv("ENVIRONMENT") or "").lower()
    if env_mode == "production":
        print("SECURITY ERROR: seed_users.py is disabled in production environments.")
        sys.exit(1)
```

Running `seed_users.py` in production will deliberately fail, preventing accidental credential compromise.

---

## 2. Step-by-Step Procedure: Creating the Production Administrator

To provision the first production administrator safely, follow these steps:

### Step 1: Create the User Account in Supabase Auth

1. Navigate to **Authentication > Users** in the Supabase Dashboard:
   `https://supabase.com/dashboard/project/<YOUR-PROJECT-REF>/auth/users`
2. Click **Add User** > **Create User**.
3. Fill in the fields:
   - **Email**: Enter the primary organization administrator email (e.g. `lead-ops@your-domain.com`).
   - **Password**: Generate a high-entropy passphrase (at least 16 characters, including numbers, uppercase, lowercase, and symbols).
   - **Auto-Confirm User**: Check **Yes** (or require email verification).
4. Click **Create User**.
5. Copy the generated **User UID** (UUID format, e.g. `a1b2c3d4-e5f6-7890-abcd-1234567890ab`).

### Step 2: Promote User to `ADMIN` Role via SQL Editor

Public registration triggers force all new accounts to the `CITIZEN` role. To promote the account to `ADMIN`, execute the secure database function [`public.admin_update_user_role`](file:///d:/AniResQ/supabase/migrations/20261125010000_transactional_role_audit.sql) in the Supabase SQL Editor:

1. Open the Supabase SQL Editor:
   `https://supabase.com/dashboard/project/<YOUR-PROJECT-REF>/sql/new`
2. Run the promotion query replacing `<NEW-ADMIN-UUID>` with the User UID from Step 1:
   ```sql
   -- Promote the new user to ADMIN and record transactional audit log
   SELECT public.admin_update_user_role(
     p_user_id := '<NEW-ADMIN-UUID>'::uuid,
     p_new_role := 'ADMIN'::public.user_role,
     p_performed_by := '<NEW-ADMIN-UUID>'::text
   );
   ```
3. Confirm the promotion and profile details:
   ```sql
   SELECT id, email, role, requested_role, is_disabled 
   FROM public.users 
   WHERE id = '<NEW-ADMIN-UUID>'::uuid;
   ```
   Verify that `role` is `ADMIN` and `is_disabled` is `false`.

---

## 3. Verification

1. Run [`supabase/ops/live_audit.sql`](file:///d:/AniResQ/supabase/ops/live_audit.sql) in the Supabase SQL Editor.
2. Confirm Check 8 (`Administrator Account Audit`) passes with status `PASS` and lists your administrator email.
3. Log into the AniResQ web application (`https://app.aniresq.com/login`) using the new administrator account.
4. Verify access to the Admin Dashboard at `https://app.aniresq.com/admin`.
