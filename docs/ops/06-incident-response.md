# Runbook 06: Production Incident Response

This runbook outlines emergency triage, containment, and mitigation protocols for production security and availability incidents.

---

## 1. Incident Response Team Contact Directory

| Role | Contact Name | Email | Phone / Pager |
| :--- | :--- | :--- | :--- |
| **Incident Commander** | `<INCIDENT-COMMANDER-NAME>` | `ops-lead@aniresq.com` | `+1-XXX-XXX-XXXX` |
| **Lead Security Engineer** | `<SECURITY-LEAD-NAME>` | `security@aniresq.com` | `+1-XXX-XXX-XXXX` |
| **Database Administrator**| `<DBA-LEAD-NAME>` | `dba@aniresq.com` | `+1-XXX-XXX-XXXX` |
| **Executive Escalation** | `<EXECUTIVE-SPONSOR>` | `exec@aniresq.com` | `+1-XXX-XXX-XXXX` |

---

## 2. Containment Procedures

### Scenario A: Leaked Credentials or API Keys (Service Role Key / JWT Secret)
1. **Immediate Revocation**: Follow [`docs/ops/02-rotate-secrets.md`](file:///d:/AniResQ/docs/ops/02-rotate-secrets.md) to rotate the Supabase JWT Secret and `service_role` key in the Supabase Dashboard.
2. **Update Hosting Config**: Immediately update the environment variables `SUPABASE_SERVICE_ROLE_KEY` and `SUPABASE_JWT_SECRET` on the API hosting provider.
3. **Restart API Services**: Force restart all API container instances.
4. **Audit Logs Review**: In the Supabase SQL Editor, inspect recent actions performed by the service role or unexpected callers:
   ```sql
   SELECT * FROM public.audit_logs 
   WHERE created_at > now() - INTERVAL '24 hours'
   ORDER BY created_at DESC;
   ```

### Scenario B: Data Exposure or Compromised User Account
1. **Disable the Compromised User**:
   Execute the following statement in the Supabase SQL Editor:
   ```sql
   UPDATE public.users 
   SET is_disabled = true 
   WHERE id = '<COMPROMISED-USER-UUID>';
   ```
   > [!NOTE]
   > The API authentication layer caches user clearance and disabled status with a 60-second TTL. The compromised user will be completely blocked on their next API request within 60 seconds.

2. **Revoke User Sessions**:
   In the Supabase Dashboard under **Authentication > Users**, select the user and click **Sign Out User** to immediately revoke their active refresh tokens.

### Scenario C: Failed or Corrupt Database Migration
1. **Halt Deployment Pipeline**: Cancel any in-flight CI/CD deployment jobs.
2. **Execute Rollback**: Follow Section 5 of [`docs/ops/01-apply-migrations.md`](file:///d:/AniResQ/docs/ops/01-apply-migrations.md) to restore the pre-migration snapshot or initiate Point-In-Time Recovery.
3. **Verify Integrity**: Run [`supabase/ops/live_audit.sql`](file:///d:/AniResQ/supabase/ops/live_audit.sql) to confirm all security constraints and table RLS policies are restored to a valid passing state.

### Scenario D: Service Outage / Downtime
1. Check external status dependencies: Supabase Status (`status.supabase.com`) and cloud host status.
2. Inspect API health probes:
   ```bash
   curl -I https://api.aniresq.com/health
   curl -I https://api.aniresq.com/ready
   ```
3. Check container logs on the API hosting provider for out-of-memory (OOM) errors, database connection pool exhaustion, or Redis connection errors.
4. Scale container memory or restart workers if memory ceiling was reached.

---

## 3. Post-Incident Review (PIR)
Within 48 hours of resolving any SEV-1 or SEV-2 incident, the Incident Commander must conduct a blameless post-mortem covering:
1. Root cause analysis (5 Whys).
2. Timeline of detection, triage, containment, and recovery.
3. Action items to eliminate recurrence, updated runbooks, and test cases added.
