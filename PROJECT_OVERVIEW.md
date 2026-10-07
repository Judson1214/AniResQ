# AniResQ - Project Overview & Architecture

## Introduction
AniResQ is a comprehensive, community-driven platform designed to streamline animal rescue operations, facilitate pet adoptions, and manage lost & found pet reports. The project brings together citizens, NGOs, volunteers, shelters, veterinarians, and administrators into a cohesive ecosystem.

## How the Project Works

The application operates as a full-stack platform with a clear separation of concerns between the frontend client and the backend API, tied together by **Supabase** for core backend-as-a-service features (Database, Auth, Storage).

### Core Workflows
1. **Rescue Operations**: Citizens can report animals in distress (providing location via maps and images). Dispatchers and volunteers are notified, and rescue operations can be tracked from reporting to resolution.
2. **Adoption Platform**: Shelters and rescues can post animals available for adoption. Prospective pet parents can browse, filter, and submit adoption applications.
3. **Lost & Found**: A centralized board where users can post lost pets with locations (using Leaflet maps) or report found animals to facilitate reunions.
4. **Role-Based Access Control**: The platform restricts and grants access based on user roles (Citizen, NGO, Volunteer, Shelter, Vet, Admin), ensuring users only see relevant dashboards and capabilities.

### Architecture Overview
The project is structured as a **Monorepo** using **Turborepo** and **pnpm workspaces**. It is divided into distinct applications and shared packages:

- **`apps/web`**: The user-facing React frontend application.
- **`apps/api`**: The FastAPI backend service that handles specific business logic and rescues.
- **`packages/shared-types`**: TypeScript interfaces and types shared across the ecosystem.
- **`packages/validation`**: Zod schemas used for robust data validation.

## Technologies Used

### Frontend (`apps/web`)
The frontend is a modern Single Page Application (SPA) built for performance and responsive design.
* **Core Framework**: [React 18](https://react.dev/) initialized with [Vite](https://vitejs.dev/).
* **Language**: [TypeScript](https://www.typescriptlang.org/) for static type safety.
* **Styling**: [Tailwind CSS](https://tailwindcss.com/) for utility-first styling.
* **UI Components**: [Radix UI](https://www.radix-ui.com/) provides accessible, unstyled primitives.
* **State Management**:
  * [React Query (@tanstack/react-query)](https://tanstack.com/query/latest) for server state.
  * [Zustand](https://github.com/pmndrs/zustand) for client-side global state.
* **Forms & Validation**: [React Hook Form](https://react-hook-form.com/) integrated with [Zod](https://zod.dev/).
* **Mapping**: [Leaflet](https://leafletjs.com/) and [React-Leaflet](https://react-leaflet.js.org/).

### Backend (`apps/api`)
The backend is a RESTful API designed to handle operations that require admin-level processing.
* **Framework**: [FastAPI](https://fastapi.tiangolo.com/), a high-performance Python 3 framework.
* **Server**: [Uvicorn](https://www.uvicorn.org/), an ASGI web server.
* **Database & Auth SDK**: [Supabase Python SDK](https://supabase.com/docs/reference/python/introduction) for interactions with Postgres and Auth.

### Database, Authentication & Cloud Services
The platform relies entirely on the open-source **Supabase** ecosystem.
* **Database**: **Supabase PostgreSQL** - A powerful, relational database for storing users, rescues, adoptions, and timeline data.
* **Authentication**: **Supabase Auth (GoTrue)** - Manages secure user sign-ups, JWT sessions, and row-level access.
* **Storage**: **Supabase Storage** - Handles user uploads (pet photos, avatars) using public buckets.
* **Security Rules**: **PostgreSQL Row Level Security (RLS)** ensures data access is strictly governed directly at the database level.

## Development Workflow
1. **Frontend Development**: Run the frontend using `pnpm dev` at the root, which starts Vite on `http://localhost:3000`.
2. **Backend Development**: Start the Python API inside `apps/api` using `uvicorn main:app --reload --port 8000`.
3. **Database Migrations**: SQL scripts like `supabase_schema.sql` can be executed directly in the Supabase SQL Editor.
