# Mesa Ads Simulator

Financial simulation and management SaaS for a Brazilian offline media company specializing in advertising on coasters (bolachas de chopp).

## Tech Stack

- **Frontend**: React 19, Vite, Tailwind CSS 4, shadcn/ui, TanStack Query, tRPC, Recharts, wouter
- **Backend**: Node.js, Express, tRPC, Drizzle ORM
- **Auth**: Replit Auth (OpenID Connect) — supports Google, GitHub, Apple, email login
- **Database**: PostgreSQL (Replit built-in, via @neondatabase/serverless + drizzle-orm/neon-serverless)
- **Package Manager**: pnpm

## Project Structure

- `client/` — React frontend
- `server/` — Backend (Express + tRPC)
- `server/_core/` — Server entry point, OAuth, Vite config
- `server/replit_integrations/auth/` — Auth module (Replit Auth OIDC)
- `server/db.ts` — Database connection and query functions
- `shared/` — Shared types/constants
- `shared/models/auth.ts` — Auth schema (users, sessions tables)
- `drizzle/` — Database schema and migrations

## Authentication

- Replit Auth via OpenID Connect (supports Google, GitHub, Apple, email)
- Landing page shown when not logged in (`client/src/pages/LandingPage.tsx`)
- AppNav shows user avatar, name, and logout button when logged in
- Auth routes: `/api/login`, `/api/logout`, `/api/auth/user`
- Session stored in PostgreSQL `sessions` table
- Auth hook: `client/src/hooks/use-auth.ts`

## Roles & Permissions

- **Administrador** (admin): Full access — manage members, approve quotations, CRUD all entities, delete records
- **Gerente** (manager): Approve quotations, CRUD campaigns/restaurants/clients, simulator, economics — no member management or deletion
- **Usuário** (user): Create quotations, view campaigns/restaurants/clients — no approval or deletion
- **Visualizador** (viewer): Read-only access to campaigns/restaurants/clients — no creation or editing
- Admin-only pages: `/membros` (Members management)
- Admin nav items highlighted in amber in AppNav

## Database Tables

- `users` — Auth users with role (admin/manager/user/viewer), isActive, lastLoginAt
- `sessions` — Auth sessions (Replit Auth)
- `restaurants` — Prospecting/leads for partner restaurants
- `active_restaurants` — Onboarded active restaurants with full operational data (tables, seats, customers, excluded ad categories, Pix, etc.)
- `clients` — Advertisers (47 imported with full address/contact/CNPJ data)
- `campaigns` — Ad campaigns with full financial parameters (grossup pricing, commissions, taxes, markup)
- `campaign_restaurants` — N:N campaign-restaurant relationship with coasters/usage allocation
- `campaign_history` — Audit trail for campaign status changes and updates
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

## Campaign Workflow

- Statuses: draft → quotation → active (approved) / archived
- Active campaigns can be paused, resumed, completed, or reactivated
- Simulator creates quotations (status "quotation"), not active campaigns
- Campaign detail page at `/campanhas/:id` with tabs: Painel, Financeiro, Distribuição, Cliente, Histórico
- Restaurant allocation enforces max count from campaign's `activeRestaurants` parameter
- Campaign history tracks all status changes with timestamps
- Pricing uses grossup formula: CustoBruto = CustoPD / (1 - varRates), then SellingPrice = CustoBruto × (1 + markup%)

## Theme & Visual Identity

- Brand colors: Black (#0d0d0d) + Orange (hsl 22 100% 50%) — consistent across landing page and app
- Light/dark mode with toggle in navigation bar, defaults to dark
- Landing page: Separate dark-only marketing design with Outfit font, framer-motion animations
- App: DM Sans + JetBrains Mono fonts, orange primary color, deep black backgrounds in dark mode
- CSS variables in `client/src/index.css` (`:root` for light, `.dark` for dark)
- ThemeContext at `client/src/contexts/ThemeContext.tsx`
- Semantic colors preserved: emerald for positive/profit, red for negative/destructive, amber for warnings
