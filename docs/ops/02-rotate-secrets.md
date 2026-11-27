# Runbook 02: Secret Rotation and Credential Hygiene

This runbook outlines the required procedure for rotating Supabase API credentials, access tokens, administrative credentials, and GitHub repository secrets.

---

## 1. Revoke Temporary Supabase Personal Access Tokens

If a personal access token (PAT) was generated for temporary local access or CI/CD setup:

1. Log into your Supabase account: `https://supabase.com/dashboard/account/tokens`
2. Locate the active Personal Access Token used for the project.
3. Click **Revoke** and confirm the deletion.
4. Verify that no unrecognized tokens remain active under the account.

---

## 2. Rotate Administrator Account Credentials

1. Navigate to **Authentication > Users** in the Supabase Dashboard:
   `https://supabase.com/dashboard/project/<YOUR-PROJECT-REF>/auth/users`
2. Select your production administrator user account.
3. Click **Send Password Reset** or manually update the password with a strong, randomly generated passphrase (minimum 16 characters).
4. Log into the AniResQ admin console (`https://app.aniresq.com/login`) with the new password to confirm access.

---

## 3. Rotate Supabase Service-Role Key and JWT Secret

> [!WARNING]
> Rotating the JWT secret immediately invalidates all active user sessions and access tokens. All logged-in users and operators will be required to log in again. Backend API instances must be updated simultaneously to prevent downtime.

1. Navigate to **Project Settings > API**:
   `https://supabase.com/dashboard/project/<YOUR-PROJECT-REF>/settings/api`
2. In the **JWT Settings** section, click **Generate a new secret**.
3. Note the newly generated:
   - `JWT Secret`
   - `service_role` secret key
4. Update the environment variables on the API hosting provider (e.g. Render, Railway, AWS ECS, Fly.io):
   - `SUPABASE_SERVICE_ROLE_KEY=<NEW-SERVICE-ROLE-KEY>`
   - `SUPABASE_JWT_SECRET=<NEW-JWT-SECRET>`
5. Redeploy or restart the backend API processes.
6. Verify API health immediately:
   ```bash
   curl -I https://api.aniresq.com/health
   curl -I https://api.aniresq.com/ready
   ```

---

## 4. Regenerate Public Anon Key (If Abused)

Under normal operations, the anonymous key (`anon`) is a public client token. Rotate it only if active denial-of-service or scraping abuse is detected:

1. Under **Project Settings > API**, click **Rotate anon key**.
2. Update the frontend hosting environment variable on Netlify / Vercel:
   - `VITE_SUPABASE_ANON_KEY=<NEW-ANON-KEY>`
3. Trigger a production frontend rebuild and deployment.

---

## 5. Delete Default Seed Accounts

Default developer seed accounts must **never** remain in the production database:

1. Follow [`docs/ops/03-first-admin.md`](file:///d:/AniResQ/docs/ops/03-first-admin.md) to ensure at least one real production administrator exists.
2. In the Supabase Dashboard SQL Editor, verify and remove default accounts:
   ```sql
   -- Audit default seed accounts
   SELECT id, email, role FROM public.users 
   WHERE email IN ('admin@aniresq.com', 'citizen@aniresq.com', 'public@aniresq.com');

   -- Remove default test accounts from auth and public tables
   DELETE FROM auth.users 
   WHERE email IN ('admin@aniresq.com', 'citizen@aniresq.com', 'public@aniresq.com');
   ```
3. Run [`supabase/ops/live_audit.sql`](file:///d:/AniResQ/supabase/ops/live_audit.sql) to confirm admin presence shows only your real administrator account.

---

## 6. Update GitHub Repository Secrets & Variables

Navigate to **GitHub Repository > Settings > Secrets and variables > Actions**:
`https://github.com/<OWNER>/<REPO>/settings/secrets/actions`

Update the following secrets with fresh values:
- `SUPABASE_ACCESS_TOKEN` (CLI deployment access token)
- `SUPABASE_DB_PASSWORD` (Direct postgres connection password for migrations)
- `SUPABASE_ANON_KEY` (Used in post-deploy smoke verification)

Update the repository variables:
- `WEB_URL` (e.g., `https://app.aniresq.com`)
- `API_URL` (e.g., `https://api.aniresq.com`)
- `SUPABASE_URL` (e.g., `https://<YOUR-PROJECT-REF>.supabase.co`)

---

## 7. Verification

Run the automated live smoke verification to confirm all services communicate cleanly:

```bash
WEB_URL="https://app.aniresq.com" \
API_URL="https://api.aniresq.com" \
SUPABASE_URL="https://<YOUR-PROJECT-REF>.supabase.co" \
SUPABASE_ANON_KEY="<NEW-ANON-KEY>" \
bash scripts/verify_live.sh
```
