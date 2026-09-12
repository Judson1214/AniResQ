# AniResQ

A community-driven animal rescue & adoption platform.

## Tech Stack
![React](https://img.shields.io/badge/react-%2320232a.svg?style=for-the-badge&logo=react&logoColor=%2361DAFB)
![TypeScript](https://img.shields.io/badge/typescript-%23007ACC.svg?style=for-the-badge&logo=typescript&logoColor=white)
![TailwindCSS](https://img.shields.io/badge/tailwindcss-%2338B2AC.svg?style=for-the-badge&logo=tailwind-css&logoColor=white)
![Firebase](https://img.shields.io/badge/firebase-%23039BE5.svg?style=for-the-badge&logo=firebase)

## Features
- Animal Rescue Reporting & Dispatching
- Pet Adoption Listings & Applications
- Lost & Found Posts
- Real-time Notifications
- Role-based Access (Citizen, NGO, Volunteer, Shelter, Vet, Admin)

## Prerequisites
- Node.js 18+
- pnpm 9+
- Firebase project setup

## Getting Started

1. Clone the repository
```bash
git clone https://github.com/your-username/AniResQ.git
cd AniResQ
```

2. Install dependencies
```bash
pnpm install
```

3. Setup Firebase Configuration
Copy `.env.example` to `apps/web/.env.local` and fill in your Firebase config credentials.

4. Start development server
```bash
pnpm dev
```

## Project Structure
This is a Turborepo monorepo.
- `apps/web`: The React frontend
- `packages/shared-types`: Shared TypeScript interfaces/enums
- `packages/validation`: Zod schemas for form validation

## Contributing
1. Fork it
2. Create your feature branch (`git checkout -b feature/fooBar`)
3. Commit your changes (`git commit -am 'Add some fooBar'`)
4. Push to the branch (`git push origin feature/fooBar`)
5. Create a new Pull Request

## License
MIT License
