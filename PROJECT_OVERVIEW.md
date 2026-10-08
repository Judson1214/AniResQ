# AniResQ - Project Overview & Architecture

## Introduction
AniResQ is a comprehensive, community-driven platform designed to streamline animal rescue operations, facilitate pet adoptions, and manage lost & found pet reports. By bridging the gap between citizens, NGOs, volunteers, shelters, veterinarians, and system administrators, AniResQ creates a unified ecosystem for animal welfare.

## Key Features & Workflows

1. **Rescue Operations (SOS)**
   - Citizens can instantly report animals in distress with real-time location mapping and image uploads.
   - Dispatchers and active volunteers receive localized alerts.
   - The platform provides an end-to-end timeline tracking the rescue from reporting to resolution.

2. **Adoption Platform**
   - Verified shelters and rescue organizations can post animals that are ready for adoption.
   - Prospective pet parents can seamlessly browse, filter, and submit comprehensive adoption applications directly through the platform.

3. **Lost & Found Network**
   - A centralized, interactive board utilizing geographic mapping (Leaflet) allows users to post reports of lost pets or animals they have found.
   - The community can leave replies and coordinate reunions.
   - **Gamification & Achievements**: Users are rewarded with "Achievements" on their dashboard (e.g., "Pet Reunited", "Hero Finder") when they successfully resolve a lost or found case, encouraging continued community engagement.

4. **Role-Based Access Control (RBAC)**
   - AniResQ provides tailored dashboards and capabilities based on user roles: *Citizen, NGO, Volunteer, Shelter, Vet, Admin*.
   - Each role is strictly governed and validated at both the frontend UI level and the database level.

## Architecture Overview

AniResQ is structured as a modern **Monorepo** using **Turborepo** and **pnpm workspaces**, ensuring excellent code sharing, robust typing, and fast build times.

### Monorepo Structure
- **`apps/web`**: The user-facing React frontend application.
- **`apps/api`**: The Python FastAPI backend service, designed for specialized business logic, background processing, and complex queries.
- **`packages/shared-types`**: Core TypeScript interfaces, enums, and types shared seamlessly across the ecosystem.
- **`packages/validation`**: Centralized Zod schemas used for robust, unified data validation on both client and server.

## Technologies Used

### Frontend (`apps/web`)
A highly responsive Single Page Application (SPA) designed for performance and accessibility.
* **Core Framework**: [React 18](https://react.dev/) / [Vite](https://vitejs.dev/)
* **Language**: [TypeScript](https://www.typescriptlang.org/)
* **Styling**: [Tailwind CSS](https://tailwindcss.com/) & [Radix UI](https://www.radix-ui.com/)
* **State Management**: [React Query (@tanstack/react-query)](https://tanstack.com/query/latest) for server state caching; [Zustand](https://github.com/pmndrs/zustand) for client-side state.
* **Forms & Validation**: [React Hook Form](https://react-hook-form.com/) + [Zod](https://zod.dev/)
* **Mapping**: [Leaflet](https://leafletjs.com/) and [React-Leaflet](https://react-leaflet.js.org/)

### Backend (`apps/api`)
A RESTful API built for high performance and strict type checking.
* **Framework**: [FastAPI](https://fastapi.tiangolo.com/) (Python 3)
* **Server**: [Uvicorn](https://www.uvicorn.org/)
* **Integration**: Interacts dynamically with Supabase via the [Supabase Python SDK](https://supabase.com/docs/reference/python/introduction).

### Database, Authentication & Cloud Services
The platform is powered entirely by the **Supabase** ecosystem, having recently completed a full migration from Firebase to establish a more robust, relational foundation.
* **Database**: **Supabase PostgreSQL** - A powerful relational database storing users, complex rescue timelines, adoption applications, and the newly migrated Lost & Found system.
* **Authentication**: **Supabase Auth (GoTrue)** - Handles user identities, JWT session management, and RBAC implementation.
* **Storage**: **Supabase Storage** - Manages media uploads such as pet photos, avatars, and rescue evidence.
* **Security Rules**: **PostgreSQL Row Level Security (RLS)** is heavily utilized to ensure data security directly at the database layer.

## Development Workflow

1. **Frontend Development**
   - From the repository root, run `pnpm dev`.
   - Turborepo will start the Vite server, accessible at `http://localhost:3000`.

2. **Backend Development**
   - Navigate to `apps/api`.
   - Ensure the virtual environment (`venv`) is active.
   - Start the API using `uvicorn main:app --reload --port 8000`.
   - Swagger documentation is automatically available at `http://localhost:8000/docs`.

3. **Database Management**
   - Schema definitions and migration scripts (e.g., `supabase_schema.sql`, `supabase_add_notifications.sql`) are available at the root level and can be executed via the Supabase Dashboard SQL Editor to keep environments synchronized.
