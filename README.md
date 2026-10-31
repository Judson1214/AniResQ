# AniResQ

A community-driven animal rescue, adoption, and lost-and-found management platform.

## Architecture & Technology Stack

AniResQ is structured as a Turborepo monorepo with a decoupled FastAPI Python backend, a Vite + React modern frontend, and a Supabase (PostgreSQL) database, authentication, and object storage layer.

- **Frontend (`apps/web`)**: React 18, Vite, Tailwind CSS, TanStack React Query, Zustand, React Hook Form, Leaflet, Lucide icons.
- **Backend API (`apps/api`)**: FastAPI, Pydantic, Supabase Python Client, HTTPBearer JWT token authentication, Pytest.
- **Data & Auth (`Supabase`)**: PostgreSQL with Row-Level Security (RLS), custom triggers, JWT authentication, and Storage buckets.
- **Monorepo Packages**:
  - `packages/shared-types`: Shared TypeScript definitions and domain models.
  - `packages/validation`: Zod schemas for shared form and payload validation.

## Key Features

- **Emergency Rescue Reporting**: SOS report submission with GPS geolocation mapping, severity tagging, status updates, and chronological timeline logging.
- **Responder Dispatch**: Automated and manual assignment of rescue alerts to registered volunteers and NGOs.
- **Adoption Center**: Animal listing directory with medical records, vaccination logs, and adoption application screening.
- **Lost & Found Network**: Community reporting for lost and found pets with interactive comment and reply threads.
- **Role-Based Access Control (RBAC)**: Fine-grained permissions across 6 distinct roles: `CITIZEN`, `VOLUNTEER`, `NGO`, `SHELTER`, `VET`, and `ADMIN`.

## Prerequisites

- **Node.js**: 18+
- **pnpm**: 9+
- **Python**: 3.10+
- **Supabase**: A free Supabase cloud project or local Supabase instance.

---

## Getting Started

### 1. Database Setup

1. In your Supabase dashboard, navigate to the **SQL Editor**.
2. Run the initialization script from [`supabase_schema.sql`](./supabase_schema.sql).
3. If upgrading an existing database, run [`supabase_migration_security_and_fixes.sql`](./supabase_migration_security_and_fixes.sql) to apply the latest security locks, missing tables, and RLS policies.
4. Ensure the `uploads` storage bucket is created (the script will configure public read and authenticated write policies automatically).

### 2. Environment Configuration

Copy `.env.example` to both `apps/web/.env` and `apps/api/.env`:

```bash
# Frontend (apps/web/.env)
VITE_SUPABASE_URL=https://<your-project-id>.supabase.co
VITE_SUPABASE_ANON_KEY=<your-anon-key>

# Backend (apps/api/.env)
SUPABASE_URL=https://<your-project-id>.supabase.co
SUPABASE_SERVICE_ROLE_KEY=<your-service-role-key>
CORS_ORIGINS=http://localhost:3000,http://localhost:5173
```

> [!CAUTION]
> Never expose `SUPABASE_SERVICE_ROLE_KEY` in `apps/web` or any client-facing code. It must only reside in `apps/api/.env`.

### 3. Backend Setup & Run

```bash
cd apps/api

# Create and activate virtual environment (if not already created)
python -m venv venv
# On Windows:
venv\Scripts\activate
# On Linux/macOS:
source venv/bin/activate

# Install dependencies
pip install -r requirements.txt

# Run the API server
uvicorn main:app --reload --port 8000
```

The interactive OpenAPI documentation will be available at: `http://127.0.0.1:8000/docs`

### 4. Frontend Setup & Run

From the root directory:

```bash
# Install monorepo dependencies
pnpm install

# Start Vite development server
pnpm --filter @aniresq/web dev
```

The web application runs at: `http://localhost:3000` (API calls to `/api` are automatically proxied to port 8000).

---

## Security Model & RBAC

1. **Role Escalation Lockdown**:
   - The PostgreSQL `handle_new_user()` trigger strictly forces `role = 'CITIZEN'::user_role` upon signup, ignoring any client-sent metadata.
   - The `protect_user_role_update()` trigger rejects role modifications unless initiated by an verified administrator or the backend `service_role`.
   - Frontend services do not allow submitting role changes from user profile forms.

2. **PII Protection**:
   - `public.users` table Row Level Security restricts email and phone visibility so that regular users can only access their own contact details.
   - Responders and staff access contact info strictly within authorized rescue and adoption scopes.

3. **Backend Authorization**:
   - Every mutating route validates the caller's JWT through `Depends(get_current_user)`.
   - Timeline log entries and rescue status changes derive identity strictly from the verified JWT token, preventing request body spoofing.

---

## Running Tests

To run the backend test suite:

```bash
# From workspace root (or apps/api with virtualenv activated)
$env:PYTHONPATH="apps/api"; apps\api\venv\Scripts\pytest apps/api/tests/
```

To build and verify the web frontend:

```bash
pnpm --filter @aniresq/web build
```

---

## License

MIT License
