# Mesa Ads ERP

Financial simulation and management SaaS (ERP) for a Brazilian offline media company specializing in advertising on coasters (bolachas de chopp).

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
- `server/financialRouter.ts` — Financial module tRPC router
- `server/quotationRouter.ts` — Quotations tRPC router
- `server/leadRouter.ts` — Leads/CRM tRPC router
- `server/serviceOrderRouter.ts` — Service Orders tRPC router
- `server/termRouter.ts` — Restaurant Terms tRPC router
- `server/libraryRouter.ts` — Library tRPC router
- `shared/` — Shared types/constants
- `shared/models/auth.ts` — Auth schema (users, sessions tables)
- `shared/rating-config.ts` — Rating system configuration
- `shared/rating.ts` — Rating calculator functions
- `drizzle/` — Database schema and migrations

## Layout & Navigation

- **Sidebar layout** via `DashboardLayout.tsx` (shadcn Sidebar, collapsible, resizable)
- **No top navigation bar** — all navigation is in the sidebar
- **Module-based sidebar** with collapsible groups:
  - Dashboard (`/`) — operational overview with status cards, pipeline, activity
  - Comercial (group): Cotações (`/comercial/cotacoes`), Simulador (`/comercial/simulador`), Leads (`/comercial/leads`)
  - Anunciantes (`/clientes`) — top-level item
  - Campanhas (`/campanhas`)
  - Financeiro (group, admin only): Dashboard (`/financeiro`), Faturamento (`/financeiro/faturamento`), Pagamentos (`/financeiro/pagamentos`), Custos (`/financeiro/custos`), Relatórios (`/financeiro/relatorios`)
  - Parceiros (group): Prospecção (`/prospeccao`), Restaurantes (`/restaurantes`)
  - Biblioteca (`/biblioteca`)
  - Configurações (group): Economics (`/economics`), Produção (`/producao`), Gestão de Usuários (`/configuracoes/usuarios`, admin only)
- **Reusable layout components**:
  - `PageContainer` — page wrapper with title, description, actions
  - `Section` — card section with icon, title, description
- **Topbar** (inside SidebarInset): breadcrumb label + theme toggle
- **Landing page** (`LandingPage.tsx`) — shown when not authenticated
- **Restaurant Terms**: accessed from restaurant profile page (Termos tab), not a separate menu item

## Authentication

- Replit Auth via OpenID Connect (supports Google, GitHub, Apple, email)
- Landing page shown when not logged in
- Sidebar footer shows user avatar, name, role, and logout button
- Auth routes: `/api/login`, `/api/logout`, `/api/auth/user`
- Session stored in PostgreSQL `sessions` table

## Roles & Permissions

- **Admin**: Full access — all modules, user management, configurations
- **Comercial**: Cotações (create, WIN), Simulador, Leads/CRM, Cadastro Anunciantes, OS Anunciantes, Biblioteca
- **Operações**: Campanhas (all workflow steps), OS Produção, Biblioteca, Provas de execução
- **Financeiro**: Dashboard financeiro, Faturamento, Pagamentos, Custos, Relatórios
- **Anunciante**: Portal — view own campaigns, request new campaigns, edit own profile
- **Manager/User/Viewer**: Legacy roles (backward compatibility)
- Admin-only pages: Gestão de Usuários, Financeiro module

## Database Tables

- `users` — Auth users with role, isActive, lastLoginAt
- `sessions` — Auth sessions (Replit Auth)
- `restaurants` — Prospecting/leads for partner restaurants
- `active_restaurants` — Onboarded active restaurants with full operational data
- `clients` — Advertisers (47 imported with full address/contact/CNPJ data)
- `campaigns` — Campaigns with CMP-YYYY-NNNN numbering, 6-step workflow statuses, art URLs, veiculação dates
- `campaign_restaurants` — N:N campaign-restaurant relationship
- `campaign_history` — Audit trail for campaign status changes
- `campaign_proofs` — Weekly proof photos per restaurant per campaign
- `quotations` — Commercial quotations (QOT-YYYY-NNNN numbering, 6 statuses, quotationName auto-generated)
- `quotation_restaurants` — N:N quotation-restaurant allocation with coaster quantities + frozen commissionPercent
- `leads` — CRM leads (anunciante/restaurante types, kanban stages)
- `lead_interactions` — Interaction history per lead
- `service_orders` — OS for anunciantes and production (OS-ANT/OS-PROD numbering)
- `restaurant_terms` — Partnership terms per restaurant (TRM-YYYY-NNNN)
- `library_items` — Coaster art archive (auto-populated on campaign finalization)
- `invoices` — Billing invoices (FAT-YYYY-NNNN)
- `operational_costs` — Production + freight costs per campaign
- `restaurant_payments` — Payments to restaurant partners
- `suppliers` — Production suppliers
- `budgets` / `budget_items` — Production budgets

## Campaign Workflow (6-Step Automated Flow)

Statuses: `producao` → `transito` → `executar` → `veiculacao` → `inativa`

1. **Cotação WIN** → Creates campaign CMP-YYYY-NNNN with status `producao`
2. **Produção**: Upload art (PDF + images) → "Concluir Produção"
3. **Trânsito**: Auto-generates OS-PROD → "Confirmar chegada do material"
4. **Executar**: Allocate restaurants → "Iniciar Veiculação"
5. **Em Veiculação**: 4-week period, weekly proof photos → "Finalizar Campanha"
6. **Inativa**: Auto-archives to Biblioteca, read-only

## Quotation Workflow

Statuses: `rascunho` → `enviada` → `ativa` → `os_gerada` → `win` / `perdida` / `expirada`
- Quotation naming standard: auto-generated as `{Mês} | {Nome Anunciante} | {Volume}`
- Cotação ativa → "Gerar OS" creates OS-ANT service order linked to quotation
- OS gerada → Allocate restaurants (quotation_restaurants table) → Upload signature URL → Sign OS → auto-converts to WIN + creates campaign CMP-YYYY-NNNN with status `producao`
- Conversion gate: requires (1) restaurants allocated with coaster volumes, (2) OS signed with signature URL
- OS Anunciantes is NOT a separate menu item — managed within Cotações flow
- OS PDF generation: jsPDF + jspdf-autotable (client-side, `client/src/lib/generate-os-pdf.ts`)
- Supports duplicate, mark lost with reason

## Pricing Engine (calcPricing)

- Located in `client/src/hooks/useSimulator.ts`
- Grossup formula: CustoBruto = CustoPD / (1 - totalVarRate), then SellingPrice = CustoBruto × (1 + markup%)
- Multiplier applied post-grossup from restaurant rating

## Restaurant Rating System

- Tiers: Bronze, Prata, Ouro, Diamante (score bands)
- 6 weighted dimensions (drinks flow, ticket, location, tables, venue type, digital presence)
- Configuration in `shared/rating-config.ts`

## Theme & Visual Identity

- Brand colors: Black (#0d0d0d) + Orange (hsl 22 100% 50%)
- Light/dark mode with toggle, defaults to dark
- DM Sans + JetBrains Mono fonts
- Semantic colors: emerald (positive), red (negative), amber (warnings)

## Running

- `pnpm run dev` — Development mode (server on port 5000)
- `pnpm run build` — Production build
- `pnpm run start` — Production start
- `pnpm run db:push` — Generate and apply database migrations

## Entry Points

- Server: `server/_core/index.ts`
- Client: `client/src/main.tsx`
