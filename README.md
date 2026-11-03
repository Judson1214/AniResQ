# AniResQ

A community-driven animal rescue, adoption, and lost-and-found management platform.

[![React](https://img.shields.io/badge/React-18.3-61DAFB?style=for-the-badge&logo=react&logoColor=black)](https://react.dev/)
[![Vite](https://img.shields.io/badge/Vite-5.4-646CFF?style=for-the-badge&logo=vite&logoColor=white)](https://vitejs.dev/)
[![JavaScript](https://img.shields.io/badge/JavaScript-ES2024-F7DF1E?style=for-the-badge&logo=javascript&logoColor=black)](https://developer.mozilla.org/en-US/docs/Web/JavaScript)
[![FastAPI](https://img.shields.io/badge/FastAPI-0.115-009688?style=for-the-badge&logo=fastapi&logoColor=white)](https://fastapi.tiangolo.com/)
[![Python](https://img.shields.io/badge/Python-3.10%2B-3776AB?style=for-the-badge&logo=python&logoColor=white)](https://www.python.org/)
[![Supabase](https://img.shields.io/badge/Supabase-PostgreSQL%20%26%20Auth-3ECF8E?style=for-the-badge&logo=supabase&logoColor=white)](https://supabase.com/)
[![TailwindCSS](https://img.shields.io/badge/TailwindCSS-3.4-38B2AC?style=for-the-badge&logo=tailwind-css&logoColor=white)](https://tailwindcss.com/)

---

## Architecture & Technology Stack

AniResQ is engineered as a Turborepo monorepo with a decoupled FastAPI Python backend, a Vite + React modern frontend, and a managed Supabase database, authentication, and object storage layer:

- **Frontend (`apps/web`)**: Single-page application built with React 18, Vite, Tailwind CSS, TanStack React Query, Zustand, React Hook Form, Leaflet, and Lucide icons.
- **Backend API (`apps/api`)**: High-performance RESTful API built with FastAPI, Pydantic v2, HTTPBearer JWT token authentication, Pytest, and the Supabase Python SDK.
- **Database & Auth (`Supabase`)**:
  - **PostgreSQL**: Relational schema with strict foreign keys, enum types, automatic timestamp triggers, and Row-Level Security (RLS).
  - **GoTrue Auth**: Secure JWT-based authentication with role verification.
  - **Storage**: Storage bucket (`uploads`) with public read, authenticated upload, 10MB size limit, and image MIME type restrictions.
- **Shared Packages**:
  - `packages/shared-types`: Common interfaces, enums, and domain definitions shared across the monorepo.
  - `packages/validation`: Zod validation schemas for forms and API contracts.

---

## Key Features

1. **Emergency Rescue Operations (SOS)**
   - Real-time incident reporting with GPS reverse geocoding and image attachments.
   - Interactive Leaflet live map showing nearby rescues and priority color tags.
   - Dispatch system for assigning volunteers and logging chronological timeline events.
2. **Adoption Center & Animal Surrenders**
   - Listings directory with health status, medical history, age estimates, and vaccination records.
   - Citizen animal surrender request submission with intake review pipeline.
   - Comprehensive multi-step adoption application submission and staff review screening.
3. **Lost & Found Network**
   - Community bulletin board for missing and found animals with location coordinates.
   - Interactive comment and update threads for coordinating reunions.
4. **Role-Based Access Control (RBAC)**
   - 6 distinct roles: `CITIZEN`, `VOLUNTEER`, `NGO`, `SHELTER`, `VET`, and `ADMIN`.
   - Hardened with database-level triggers and RLS against unauthorized privilege escalation.

---

## Prerequisites

- **Node.js**: 18.0.0 or higher
- **pnpm**: 9.0.0 or higher
- **Python**: 3.10 or higher
- **Supabase Account**: A free project hosted on [supabase.com](https://supabase.com) (or a local Supabase CLI instance).

---

## Getting Started

### 1. Clone the Repository

```bash
git clone https://github.com/Judson1214/AniResQ.git
cd AniResQ
```

### 2. Supabase Setup

1. Log in to [supabase.com](https://supabase.com) and create a new project.
2. Navigate to the **SQL Editor** in the Supabase dashboard.
3. Open and run the complete database initialization script:
   - [`supabase/migrations/20261031000000_init_aniresq_schema.sql`](./supabase/migrations/20261031000000_init_aniresq_schema.sql)
   - Followed by incremental security fixes: [`supabase/migrations/20261103000000_security_fixes.sql`](./supabase/migrations/20261103000000_security_fixes.sql)
   *(Note: This creates all enums, tables, triggers, helper functions, indexes, and RLS policies).*
4. Configure the database setting for the avatar validation trigger:
   ```sql
   ALTER DATABASE postgres SET app.settings.supabase_url = 'https://<your-project-id>.supabase.co';
   ```
   *(Note: The avatar upload trigger fails closed with a clear exception if this setting is omitted).*
5. Navigate to **Storage** in the Supabase dashboard:
   - Verify that the `uploads` bucket exists and is set to **Public** (the migration script provisions this automatically with 10MB size limits, scoped user folder `{auth.uid()}/...` policies, and image MIME restrictions).
6. From **Project Settings -> API**, copy your **Project URL**, **anon public key**, and **service_role secret key**.

### 3. Environment Configuration

#### Backend Environment (`apps/api/.env`)
Copy the backend template:
```bash
cp apps/api/.env.example apps/api/.env
```
Fill in your Supabase credentials:
```env
SUPABASE_URL=https://<your-project-id>.supabase.co
SUPABASE_SERVICE_ROLE_KEY=<your-service-role-secret-key>
CORS_ORIGINS=http://localhost:3000,http://localhost:5173

# Rate limiting proxy configuration:
TRUST_PROXY_HEADERS=false
RATE_LIMIT_PER_MINUTE=120
```

> [!CAUTION]
> The `SUPABASE_SERVICE_ROLE_KEY` bypasses all Row Level Security. Never expose it in client code or commit `.env` files to git.

#### Frontend Environment (`apps/web/.env`)
Copy the frontend template:
```bash
cp apps/web/.env.example apps/web/.env
```
Fill in your public Supabase credentials:
```env
VITE_SUPABASE_URL=https://<your-project-id>.supabase.co
VITE_SUPABASE_ANON_KEY=<your-anon-public-key>
```

---

### 4. Backend Setup & Run

Navigate to `apps/api` and set up the Python virtual environment:

```bash
cd apps/api

# Create virtual environment
python -m venv venv

# Activate virtual environment
# Windows (PowerShell):
venv\Scripts\Activate.ps1
# Windows (Command Prompt):
venv\Scripts\activate.bat
# Linux/macOS:
source venv/bin/activate

# Install required dependencies
pip install -r requirements.txt

# (Optional) Seed initial administrator and demo citizen accounts:
python seed_users.py --admin-password "YourSecureAdminPassword123!"

# Start the FastAPI development server
uvicorn main:app --reload --port 8000
```

The interactive OpenAPI (Swagger) documentation is available at: **`http://127.0.0.1:8000/docs`**

---

### 5. Frontend Setup & Run

From the repository root:

```bash
# Install all workspace dependencies
pnpm install

# Start Vite development server
pnpm --filter @aniresq/web dev
```

The application will be live at: **`http://localhost:5173`**  
*(Vite proxies `/api` calls directly to `http://127.0.0.1:8000`).*

---

## Running Tests

### Backend Automated Test Suite
AniResQ includes automated pytest security and RBAC tests:

```bash
# Linux / macOS:
PYTHONPATH=apps/api pytest apps/api/tests/

# Windows (PowerShell):
$env:PYTHONPATH="apps/api"; apps\api\venv\Scripts\pytest apps/api/tests/

# Windows (Command Prompt):
set PYTHONPATH=apps/api && pytest apps/api/tests/
```

### Frontend Automated Test Suite
```bash
pnpm --filter @aniresq/web test
```

### Frontend Linting & Production Build
```bash
# Run ESLint
pnpm --filter @aniresq/web lint

# Verify type resolution and compile frontend assets
pnpm --filter @aniresq/web build
```

---

## Rate Limiting & Deployment Notes

The API enforces a sliding-window in-memory rate limiter per client IP:
- **Default IP Keying (`TRUST_PROXY_HEADERS=false`)**:
  - By default, the rate limiter keys directly on the TCP socket IP (`request.client.host`). Spoofed `X-Forwarded-For` headers from clients are completely ignored.
- **Behind Reverse Proxies (`TRUST_PROXY_HEADERS=true`)**:
  - Set `TRUST_PROXY_HEADERS=true` in `apps/api/.env` **only** if your backend runs behind a trusted reverse proxy (e.g. Nginx, Cloudflare, Traefik, AWS ALB, Render) that strips and overwrites `X-Forwarded-For`.
  - Without this flag behind a proxy, all client requests will share the single reverse proxy IP bucket.
- **Process Worker Scaling**:
  - The rate limiter operates in-memory per process. Running multiple Uvicorn workers (`--workers N`) multiplies effective throughput across worker processes. For distributed deployments across multiple VM nodes, consider backing the sliding window with Redis.
- **Tiered Endpoint Limits (per minute)**:
  - `POST /api/animals/surrender`: **10 req/min** (slow spam prevention)
  - `POST /api/rescues` & `POST /api/lostfound`: **15 req/min**
  - General mutations (`POST`, `PATCH`, `DELETE`): **40 req/min**
  - Read queries: **120 req/min** (configurable via `RATE_LIMIT_PER_MINUTE`)
- **Memory Safety**:
  - Idle keys with no active timestamps are evicted periodically to prevent memory leaks from high volumes of unique IP addresses.

---

## Security Model & RBAC

1. **Role Escalation Protection**:
   - The PostgreSQL `handle_new_user()` trigger automatically enforces `role = 'CITIZEN'::user_role` for all new signups, capturing any requested role in `requested_role` for administrator review. Requests for the `ADMIN` role via signup metadata are automatically rejected and sanitized.
   - The `protect_user_fields_update()` trigger rejects any role change, email change, or ID tampering unless executed by an authenticated administrator or the backend `service_role`.
   - Admin-only role management endpoint `PATCH /api/users/{uid}/role` provides secure role transitions with safeguards against demoting the sole administrator.
   - Role updates are audited to `public.audit_logs` (restricted strictly to `service_role` insertion to prevent forgery).
2. **Rescue & Animal Authorization**:
   - The `protect_rescue_update()` trigger ensures non-staff reporters cannot forge responder assignments or arbitrary status transitions, and freezes incident details once responders are dispatched.
   - Animal surrenders start as `NOT_READY` pending shelter review and are visible only to staff and the surrenderer.
3. **PII Isolation & User Access Control**:
   - **PostgreSQL Row Level Security (`public.users`)**: Policy enforces `auth.uid() = id OR public.is_admin() OR auth.role() = 'service_role'`. Regular users, VETs, NGOs, and shelters querying Supabase directly with client keys cannot view other users' records.
   - **Scoped Contact Details on Profile Endpoint**: `GET /api/users/{uid}` strictly redacts user contact information (`email`, `phoneNumber`, `address`) unless:
     - The requester is an administrator (`ADMIN`)
     - The requester is viewing their own profile
     - The requester is staff (`NGO`, `SHELTER`, `VOLUNTEER`) with an active case with the user (e.g., active adoption application for their animals, animal surrender, or assigned rescue dispatch).
   - `GET /api/users` (list users directory) forbids `VET` and non-staff (`403 Forbidden`), and redacts emails and phone numbers unless requested by an administrator.
4. **Backend Route Guarding & Media Validation**:
   - All mutating API endpoints require valid Bearer JWT tokens via `Depends(get_current_user)`.
   - Storage uploads are restricted to `{auth.uid()}/...` paths via storage RLS policies.
   - Photo and avatar uploads are verified against the official project storage bucket prefix; database triggers fail closed if the project URL setting is unconfigured.

---

## License

This project is licensed under the MIT License.
