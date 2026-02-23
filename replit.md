# Mesa Ads Simulator

Financial simulation and management SaaS for a Brazilian offline media company specializing in advertising on coasters (bolachas de chopp).

## Tech Stack

- **Frontend**: React 19, Vite, Tailwind CSS 4, shadcn/ui, TanStack Query, tRPC, Recharts, wouter
- **Backend**: Node.js, Express, tRPC, Drizzle ORM
- **Database**: PostgreSQL (Replit built-in, via @neondatabase/serverless + drizzle-orm/neon-serverless)
- **Package Manager**: pnpm

## Project Structure

- `client/` — React frontend
- `server/` — Backend (Express + tRPC)
- `server/_core/` — Server entry point, OAuth, Vite config
- `server/db.ts` — Database connection and query functions
- `shared/` — Shared types/constants
- `drizzle/` — Database schema and migrations

## Database Tables

- `users` — Auth users
- `restaurants` — Partner restaurants
- `clients` — Advertisers
- `campaigns` — Ad campaigns
- `campaign_restaurants` — N:N campaign-restaurant relationship
- `suppliers` — Production suppliers (print shops)
- `budgets` — Production budgets from suppliers
- `budget_items` — Price tiers within budgets

## Running

- `pnpm run dev` — Development mode (server on port 5000)
- `pnpm run build` — Production build
- `pnpm run start` — Production start
- `pnpm run db:push` — Generate and apply database migrations

## Entry Points

- Server: `server/_core/index.ts`
- Client: `client/src/main.tsx`

## Theme

- Light/dark mode with toggle in navigation bar
- Theme stored in localStorage, defaults to dark
- CSS variables in `client/src/index.css` (`:root` for light, `.dark` for dark)
- ThemeContext at `client/src/contexts/ThemeContext.tsx`
