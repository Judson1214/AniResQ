# AniResQ - Project Overview & Architecture

## 1. Introduction
AniResQ is a full-stack, community-driven animal welfare platform designed to streamline emergency rescue operations, facilitate pet adoptions, and manage lost-and-found pet reports. By bridging the gap between citizens, NGOs, volunteers, shelters, veterinarians, and system administrators, AniResQ provides a unified, real-time ecosystem for animal rescue and care.

---

## 2. Core Modules & Workflows

### 2.1 Rescue Operations (SOS)
- **Reporting**: Citizens can report animals in distress with real-time GPS geolocation reverse geocoding, severity classifications (`CRITICAL`, `HIGH`, `MEDIUM`, `LOW`), and photo uploads.
- **Interactive Map**: Responders view emergency requests on an interactive Leaflet live map with color-coded severity markers.
- **Dispatching**: Shelters, NGOs, and administrators can assign responders and volunteers to active rescues.
- **Timeline Tracking**: Every status transition (`PENDING`, `DISPATCHED`, `IN_PROGRESS`, `RESOLVED`, `CANCELLED`) automatically creates an immutable, chronological timeline event attributing the action to the authenticated user.

### 2.2 Adoption Center
- **Listings Directory**: Verified shelters and NGOs can post animals available for adoption, including species, breed, medical history, vaccination records, neuter status, and special needs.
- **Application Process**: Prospective pet parents submit multi-step adoption applications covering living environment, household details, prior experience, and schedule.
- **Screening Workflow**: Authorized shelter staff and administrators review applications, record internal screening notes, and update application statuses (`SUBMITTED`, `UNDER_REVIEW`, `APPROVED`, `REJECTED`).

### 2.3 Lost & Found Network
- **Community Board**: Users report lost pets or found animals with last-seen locations, physical descriptions, and contact info.
- **Interactive Threads**: Community members can post comment updates and sightings to coordinate reunions.
- **Gamification**: Citizens receive milestone badges and dashboard achievements when a case is marked resolved.

### 2.4 Notifications & Real-Time Alerts
- **Notification Inbox**: Users receive notifications on rescue updates, adoption application reviews, and community sightings.
- **Mark as Read**: Integrated endpoints support marking individual or all notifications as read.

---

## 3. Architecture & Monorepo Structure

AniResQ is organized as a Turborepo monorepo with pnpm workspaces, maintaining a clean boundary between frontend presentation, backend business logic, and shared schemas:

```
AniResQ/
├── apps/
│   ├── api/                       # FastAPI REST backend service (Python 3.10+)
│   │   ├── routers/               # Modular route handlers (rescues, users, animals, etc.)
│   │   ├── tests/                 # Automated pytest security and regression suite
│   │   ├── auth.py                # JWT Bearer token authentication & RBAC dependencies
│   │   ├── main.py                # FastAPI app initialization, CORS, and middleware
│   │   ├── seed_users.py          # Secure Supabase Auth & user profile seeder
│   │   ├── supabase_config.py     # Supabase client initialization (service-role)
│   │   └── requirements.txt       # Python dependencies
│   │
│   └── web/                       # React 18 single-page application (Vite)
│       ├── src/
│       │   ├── components/        # Reusable UI & layout components (Radix UI, Tailwind)
│       │   ├── hooks/             # Custom React hooks (useAuth, useGeolocation, etc.)
│       │   ├── pages/             # Lazy-loaded route views (Dashboard, Rescue, etc.)
│       │   ├── services/          # Supabase client and backend API abstraction layer
│       │   └── store/             # Zustand client-side application state
│       ├── package.json
│       └── vite.config.js
│
├── packages/
│   ├── shared-types/              # Shared TypeScript definitions, interfaces, and enums
│   └── validation/                # Centralized Zod schemas for forms and API contracts
│
├── supabase/
│   └── migrations/                # Versioned PostgreSQL migrations
│       ├── 20261031000000_init_aniresq_schema.sql      # Full unified base schema
│       └── 20261031000001_security_and_fixes.sql       # Hardened RLS & trigger patch
│
├── .env.example                   # Root environment configuration template
├── package.json                   # Monorepo root scripts & dev tools
├── pnpm-workspace.yaml            # Monorepo workspace configuration
└── turbo.json                     # Turborepo task pipeline configuration
```

---

## 4. Technology Stack

### 4.1 Frontend (`apps/web`)
- **Framework**: React 18 with Vite
- **Styling**: Tailwind CSS & Radix UI primitives
- **Server State & Caching**: TanStack React Query v5
- **Client State**: Zustand
- **Form Management**: React Hook Form with Zod resolvers
- **Mapping**: Leaflet and React-Leaflet
- **Icons**: Lucide React

### 4.2 Backend (`apps/api`)
- **Framework**: FastAPI (Python 3.10+)
- **Validation**: Pydantic v2
- **Database Client**: Supabase Python SDK (`supabase>=2.0.0`)
- **Server**: Uvicorn ASGI
- **Testing**: Pytest with HTTPX

### 4.3 Database, Auth & Storage (`Supabase`)
- **PostgreSQL**: Relational storage utilizing native ENUMs, cascading foreign keys, and automatic `updated_at` triggers.
- **GoTrue Auth**: Secure JWT-based user session management and user metadata handling.
- **Supabase Storage**: Managed object storage bucket (`uploads`) with configured public read and authenticated upload policies.
- **Row Level Security (RLS)**: Enforced across all tables to isolate user data and restrict operations by role.

---

## 5. Security & RBAC Model

### 5.1 Role-Based Access Control (6 Distinct Roles)
1. **`CITIZEN`**: Default role on signup. Can report rescues, apply for adoption, post lost/found notices, and update their own profile.
2. **`VOLUNTEER`**: Responds to rescue alerts, accepts dispatch assignments, and updates rescue incident statuses.
3. **`NGO`**: Coordinates rescue missions, manages adoptable animals, and reviews adoption applications.
4. **`SHELTER`**: Creates animal profiles, screens adoption applications, and coordinates animal care.
5. **`VET`**: Provides medical assessments and updates health records for rescued/sheltered animals.
6. **`ADMIN`**: Full administrative access across all records, user role management, and system-wide dispatch.

### 5.2 Key Security Controls
- **Privilege Escalation Prevention**: The database trigger `handle_new_user()` strictly sets `role = 'CITIZEN'::user_role` for all signups, ignoring client-submitted metadata. The `protect_user_role_update()` trigger rejects client role changes unless initiated by a verified administrator or backend `service_role`.
- **PII Isolation**: `public.users` table RLS restricts sensitive columns (email, phone number) so they are only readable by the profile owner or authorized staff.
- **JWT Verification & Timeline Integrity**: FastAPI routes verify Bearer JWT tokens via `get_current_user`. Timeline entries derive author identifiers strictly from the verified token rather than request bodies.
- **CORS Hardening**: CORS origins are restricted to configured frontend domains rather than wildcard origins with credentials.

---

## 6. Development & Operational Commands

### 6.1 Database Migration
Execute in the Supabase Dashboard SQL Editor:
- Base Schema: [`supabase/migrations/20261031000000_init_aniresq_schema.sql`](./supabase/migrations/20261031000000_init_aniresq_schema.sql)
- Security Updates: [`supabase/migrations/20261031000001_security_and_fixes.sql`](./supabase/migrations/20261031000001_security_and_fixes.sql)

### 6.2 Running Backend Services
```bash
cd apps/api
python -m venv venv
venv\Scripts\activate       # Windows PowerShell: venv\Scripts\Activate.ps1
pip install -r requirements.txt
uvicorn main:app --reload --port 8000
```

### 6.3 Running Frontend Application
```bash
# From workspace root
pnpm install
pnpm --filter @aniresq/web dev
```

### 6.4 Verification & Testing
```bash
# Run backend pytest suite
$env:PYTHONPATH="apps/api"; apps\api\venv\Scripts\pytest apps/api/tests/

# Verify web build
pnpm --filter @aniresq/web build
```
