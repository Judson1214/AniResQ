# AniResQ - Project Overview & Architecture

## Introduction
AniResQ is a comprehensive, community-driven platform designed to streamline animal rescue operations, facilitate pet adoptions, and manage lost & found pet reports. The project brings together citizens, NGOs, volunteers, shelters, veterinarians, and administrators into a cohesive ecosystem.

## How the Project Works

The application operates as a full-stack platform with a clear separation of concerns between the frontend client and the backend API, tied together by Supabase for core backend-as-a-service features.

### Core Workflows
1. **Rescue Operations**: Citizens can report animals in distress (providing location via maps and images). Dispatchers and volunteers are notified, and rescue operations can be tracked from reporting to resolution.
2. **Adoption Platform**: Shelters and rescues can post animals available for adoption. Prospective pet parents can browse, filter, and submit adoption applications.
3. **Lost & Found**: A centralized board where users can post lost pets with locations (using Leaflet maps) or report found animals to facilitate reunions.
4. **Role-Based Access Control**: The platform restricts and grants access based on user roles (Citizen, NGO, Volunteer, Shelter, Vet, Admin), ensuring users only see relevant dashboards and capabilities.

### Architecture Overview
The project is structured as a **Monorepo** using **Turborepo** and **pnpm workspaces**. It is divided into distinct applications and shared packages:

- **`apps/web`**: The user-facing frontend application.
- **`apps/api`**: The backend API service that handles complex business logic and integrations.
- **`packages/shared-types`**: TypeScript interfaces and types shared across the JavaScript/TypeScript ecosystem.
- **`packages/validation`**: Zod schemas used for robust data validation across the frontend.

## Technologies Used

### Frontend (`apps/web`)
The frontend is a modern Single Page Application (SPA) built for performance and responsive design.
* **Core Framework**: [React 18](https://react.dev/) initialized with [Vite](https://vitejs.dev/) for lightning-fast HMR and building.
* **Language**: [TypeScript](https://www.typescriptlang.org/) for static type safety.
* **Styling**: [Tailwind CSS](https://tailwindcss.com/) for utility-first styling, combined with [tailwindcss-animate](https://github.com/jamiebuilds/tailwindcss-animate).
* **UI Components**: [Radix UI](https://www.radix-ui.com/) provides accessible, unstyled primitives for building robust components (Dialogs, Dropdowns, Tabs, etc.).
* **State Management**:
  * [React Query (@tanstack/react-query)](https://tanstack.com/query/latest) for fetching, caching, and synchronizing server state.
  * [Zustand](https://github.com/pmndrs/zustand) for lightweight client-side global state management.
* **Routing**: [React Router DOM](https://reactrouter.com/) for client-side routing.
* **Forms & Validation**: [React Hook Form](https://react-hook-form.com/) integrated with [Zod](https://zod.dev/) (via `@hookform/resolvers`) for highly performant, type-safe form handling.
* **Mapping**: [Leaflet](https://leafletjs.com/) and [React-Leaflet](https://react-leaflet.js.org/) for rendering interactive maps (essential for lost/found and rescue locations).
* **Animations**: [Framer Motion](https://www.framer.com/motion/) for smooth, declarative UI animations.
* **Icons**: [Lucide React](https://lucide.dev/).
* **HTTP Client**: [Axios](https://axios-http.com/).

### Backend (`apps/api`)
The backend is a robust RESTful API designed to handle operations that shouldn't be processed directly on the client.
* **Framework**: [FastAPI](https://fastapi.tiangolo.com/), a high-performance web framework for building APIs with Python 3.
* **Server**: [Uvicorn](https://www.uvicorn.org/), an ASGI web server implementation for Python.
* **Data Validation**: [Pydantic](https://docs.pydantic.dev/) for data parsing and validation, seamlessly integrated with FastAPI.
* **Database & Auth SDK**: [Supabase Python SDK](https://supabase.com/docs/reference/python/introduction) for server-side interaction with Supabase services.

### Database, Authentication & Cloud Services
The platform heavily relies on the Supabase ecosystem.
* **Database**: **Supabase PostgreSQL** - A powerful, open-source relational database for storing user profiles, rescue reports, adoption listings, and application data.
* **Authentication**: **Supabase Authentication** - Manages secure user sign-ups, logins, and session management using GoTrue.
* **Storage**: **Supabase Storage** - Handles user uploads such as pet photos, medical records, and user avatars.
* **Security Rules**: **PostgreSQL Row Level Security (RLS)** ensures data access is strictly governed directly at the database level.

### Monorepo Tooling
* **Package Manager**: [pnpm](https://pnpm.io/) for fast, disk-space efficient dependency management.
* **Build System**: [Turborepo](https://turbo.build/) to orchestrate tasks (linting, building) across workspaces efficiently with caching.
* **Code Quality**: ESLint and Prettier for code formatting and linting.

## Development Workflow
1. **Frontend Development**: Handled by running `vite` in the `apps/web` directory (via `pnpm dev` at the root).
2. **Backend Development**: Handled by running the Uvicorn server in `apps/api`.
3. **Shared Packages**: Changes in `shared-types` and `validation` are instantly reflected in the `web` application due to pnpm workspace linking.
