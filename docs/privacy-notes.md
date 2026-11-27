# AniResQ Community Pilot Privacy Assessment & Implementation Notes

> [!WARNING]
> **TEMPLATE / DISCLAIMER**
> **THIS DOCUMENT AND ALL ASSOCIATED LEGAL TEXTS (TERMS OF SERVICE, PRIVACY POLICY, COMMUNITY SAFETY GUIDELINES, EMERGENCY NOTICES) ARE TEMPLATES ONLY.**
> They must be reviewed, adapted, and approved by a qualified attorney licensed in the operating jurisdiction prior to production launch.
> The AniResQ project, repository contributors, and software authors do not provide legal advice and **DO NOT CLAIM LEGAL COMPLIANCE** with GDPR, CCPA, DPDP, HIPAA, or any other regional data privacy legislation.

---

## 1. Architectural Privacy Assessment

The AniResQ platform architecture enforces privacy by design through strict database row-level security (RLS), architectural data minimization, boundary API mediation, and self-service user rights endpoints.

### 1.1 Data Minimization Principles
AniResQ limits data collection strictly to what is required to protect animal lives and coordinate emergency rescues:
1. **Citizens / Reporters**: Name, contact phone or email, and precise incident location. No tracking cookies or behavioral profiling are employed.
2. **Adoption Applicants**: Information necessary to assess household suitability for pet welfare (housing type, family members, existing pets, experience).
3. **Operators / Responders**: Identification clearance is minimized to prevent mass exposure of government identities (see Section 2).

---

## 2. PII Minimization Strategy: Operator Identification

Historically, volunteer platforms have collected full government ID numbers, creating substantial exposure risks. AniResQ implements an **Expand and Contract** minimization model:

### 2.1 The Last-4 Minimization Architecture
1. **Storage Reduction**:
   - The database schema introduces `id_card_last4 VARCHAR(4)` (`20261127110000_add_user_terms_and_id_last4.sql`).
   - The API layer (`apps/api/routers/users.py`) accepts and stores **only** the last 4 characters of the ID document.
   - The legacy `id_card_number` column is marked as deprecated, excluded from all API responses, and scheduled for removal in Phase 2 (documented in [10-drop-id-number.md](file:///d:/AniResQ/docs/ops/10-drop-id-number.md)).
2. **Physical Document Elimination**:
   - Volunteer identification documents (e.g., driver's licenses, national ID cards) are inspected during live onboarding verification and **must never be permanently stored or uploaded to cloud storage**.
   - If an identity document photo is temporarily reviewed during intake, it must be purged immediately following operator approval.

---

## 3. Storage Bucket Isolation & Access Control Policies

The platform utilizes Supabase Object Storage partitioned into strict functional buckets:

| Bucket Name | Access Model | Purpose | Protection Mechanism |
| :--- | :--- | :--- | :--- |
| `rescue-images` | Public Read / Authenticated Write | Incident photos (injured animals, location landmarks). | EXIF metadata stripped; file validation enforces MIME types (JPEG, PNG, WebP) and size limits (< 5MB). |
| `animal-images` | Public Read / Admin/Shelter Write | Adoptable pet gallery pictures. | Upload limited to verified shelters and administrators. |
| `lost-found-images`| Public Read / Authenticated Write | Missing pet photos. | Stripped of camera geolocation metadata before storage. |
| `operator-documents` (Private) | **STRICTLY RESTRICTED** | Temporary clearance docs (if ever uploaded). | Bucket is `public = false`. RLS policy revokes all public access; signed URLs with 15-minute TTL issued only to authorized `ADMIN`. |

---

## 4. User Rights: Portability & Erasure

To empower users with full sovereignty over their personal data, AniResQ implements self-service endpoints accessible directly in the user profile UI:

### 4.1 Right to Data Portability (Export)
- **Endpoint**: `GET /api/users/me/export`
- **Rate Limit**: Strictly throttled (default 2 requests per hour) via `rate_limiter.py`.
- **Payload Schema**:
  ```json
  {
    "user_id": "uuid",
    "export_date": "2026-11-27T00:00:00Z",
    "profile": { "full_name": "...", "email": "...", "phone": "..." },
    "consent_records": [ ... ],
    "rescue_requests": [ ... ],
    "lost_found_posts": [ ... ],
    "adoption_applications": [ ... ]
  }
  ```
- **Auditing**: Every data export request logs an `AUDIT_LOG` entry with the requesting IP and timestamp.

### 4.2 Right to Erasure (Account Deletion)
- **Endpoint**: `DELETE /api/users/me`
- **Business Rule Constraints**:
  - If a user is an operator currently assigned to an `IN_PROGRESS` animal rescue, deletion is refused (`400 Bad Request`) to avoid abandoning animals in critical distress. The rescue must first be transferred, completed, or cancelled.
- **Anonymization & Dissociation**:
  - The database uses `ON DELETE SET NULL` for `reporter_id` on rescue tickets and lost-and-found posts. This preserves historical animal medical cases and shelter history while severing personal identity links.
  - Personal profile data (name, email, phone, avatar) is wiped or randomized (`UUID@deleted.local`).
  - Auth credentials in `auth.users` are revoked, preventing future logins.
  - An immutable audit trail record `USER_DELETED` is logged for administrative transparency.

---

## 5. Security & Infrastructure Controls

1. **Row Level Security (RLS)**: Every database table has `ENABLE ROW LEVEL SECURITY`. No direct table privileges (`INSERT`, `UPDATE`, `DELETE`, `TRUNCATE`) are granted to `anon` or `authenticated` roles.
2. **Backend Gateway**: All mutation and data queries pass through the FastAPI backend (`apps/api`) using the `service_role` key, where business validation, rate limiting, and audit logging are strictly enforced.
3. **Content Security Policy**: Strong headers (CSP, COOP, CORP, X-Content-Type-Options, HSTS) are compiled and validated across both Vercel (`vercel.json`) and Netlify (`netlify.toml`) deployments.
4. **Secret Protection**: Automated pre-commit checks and CI scans prevent API keys, JWT secrets, or production database URLs from being committed to source control.
