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
- `shared/rating-config.ts` — Rating system configuration (weights, score ranges, tier definitions, label maps)
- `shared/rating.ts` — Rating calculator functions (calcularRating, temCamposRatingCompletos)
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
- `active_restaurants` — Onboarded active restaurants with full operational data (tables, seats, customers, monthlyDrinksSold, excluded ad categories, Pix, rating system fields, etc.)
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

## Restaurant Rating System

- Tiers: Bronze, Prata, Ouro, Diamante (visual labels by score band ≤2/≤3/≤4/≤5)
- Multiplier is continuous: score ≤ 2.0 → 1.00x; score > 2.0 → 1.0 + (score-2)/3, max 2.00x at score 5.0
- Rating uses 6 weighted dimensions:
  - Fluxo de bebidas / monthlyDrinksSold (25%)
  - Ticket médio / ticketMedio (20%)
  - Localização / locationRating 1-5 (20%)
  - Mesas / tableCount (10%)
  - Perfil do estabelecimento / venueType 1-5 (20%)
  - Presença digital / digitalPresence 1-5 (5%)
- Score calculated from 1.00 to 5.00 using `calcularRating()` from `shared/rating.ts`
- Multiplier helper: `calcularMultiplicador(score)` exported from `shared/rating-config.ts`
- Configuration centralized in `shared/rating-config.ts` (RATING_CONFIG object)
- Input fields in active_restaurants: ticketMedio, locationRating (1-5), venueType (1-5), digitalPresence (1-5), primaryDrink
- Calculated fields: ratingScore, ratingTier, ratingMultiplier, ratingUpdatedAt
- Auto-triggers: rating recalculates on create/update of any of the 6 rating fields in server/db.ts
- Admin bulk recalculation: `activeRestaurant.recalculateRatings` route (adminProcedure)
- Form section "Rating Interno" (merged into Operação section) with live preview in ActiveRestaurantForm.tsx
- Rating card displayed in ActiveRestaurantProfile.tsx Painel tab
- Rating badge shown in ActiveRestaurants.tsx list with tier filter and score sort
- Rating badge shown in CampaignDetail.tsx Distribuição tab

## Simulator Restaurant Allocation

- Restaurant selection panel in simulator overview tab (between Budget Selector and KPI Cards)
- Multi-select dropdown with search to add restaurants from the active restaurant database
- Per-restaurant coaster allocation with slider + numeric input
- Validation: sum of allocated coasters must equal total campaign coasters (coastersPerRestaurant × activeRestaurants)
- Weighted multiplier: calculated as weighted average of each restaurant's ratingMultiplier, weighted by coasters allocated
- Weighted score: calculated as weighted average of each restaurant's ratingScore, weighted by coasters allocated
- "Distribute evenly" button to split coasters equally across selected restaurants
- State persisted to localStorage (`mesa-ads-restaurant-allocations`)
- Hook: `client/src/hooks/useRestaurantAllocation.ts`
- Component: `client/src/components/RestaurantAllocationPanel.tsx`
- Expandable/collapsible panel with summary badge showing allocation status

## Theme & Visual Identity

- Brand colors: Black (#0d0d0d) + Orange (hsl 22 100% 50%) — consistent across landing page and app
- Light/dark mode with toggle in navigation bar, defaults to dark
- Landing page: Separate dark-only marketing design with Outfit font, framer-motion animations
- App: DM Sans + JetBrains Mono fonts, orange primary color, deep black backgrounds in dark mode
- CSS variables in `client/src/index.css` (`:root` for light, `.dark` for dark)
- ThemeContext at `client/src/contexts/ThemeContext.tsx`
- Semantic colors preserved: emerald for positive/profit, red for negative/destructive, amber for warnings
