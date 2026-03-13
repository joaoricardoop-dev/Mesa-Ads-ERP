# Mesa Ads ERP

## Overview
Mesa Ads ERP is a financial simulation and management SaaS for a Brazilian offline media company specializing in advertising on coasters. The project aims to streamline operations, manage campaigns, track finances, and facilitate advertiser and restaurant partner onboarding. Key capabilities include a comprehensive campaign workflow, quotation management, lead tracking, a financial dashboard, and a restaurant rating system.

## User Preferences
I prefer clear and concise communication. Focus on high-level concepts and architectural decisions. When making changes, prioritize modularity and maintainability. I prefer an iterative development approach, with regular updates on progress and potential roadblocks. Do not make changes to the `shared/rating-config.ts` file.

## System Architecture

### UI/UX Decisions
The application features a sidebar-based layout using `shadcn/ui` with a collapsible and resizable design for navigation. There is no top navigation bar. The design incorporates a light/dark mode toggle, defaulting to dark, with brand colors (Black: `#0d0d0d`, Green: `#27d803`) and semantic colors for status indicators. Fonts used are DM Sans and JetBrains Mono. Reusable components like `PageContainer` and `Section` ensure consistency.

### Technical Implementations
- **Frontend**: React 19, Vite, Tailwind CSS 4, shadcn/ui, TanStack Query, tRPC, Recharts, wouter.
- **Backend**: Node.js, Express, tRPC, Drizzle ORM.
- **Authentication**: Clerk for user identity management, handling logins, sessions, and user roles. User roles are managed via Clerk's `publicMetadata.role` and synced to a local `users` table.
- **Database**: PostgreSQL (via @neondatabase/serverless + drizzle-orm/neon-serverless) for all data persistence.
- **Module-based Structure**: The application is organized into distinct modules for Comercial, Financeiro, Campanhas, Restaurantes, and Biblioteca, each with its own tRPC router and dedicated UI sections.
- **Dev Tools Panel**: A development-only panel allows role simulation and client impersonation for testing various user perspectives.

### Feature Specifications
- **Campaign Workflow**: A 6-step automated workflow (`producao` → `transito` → `executar` → `veiculacao` → `inativa`) covering creation, art upload, material confirmation, restaurant allocation, execution, and archival.
- **Quotation Workflow**: Manages quotations through statuses (`rascunho` → `enviada` → `ativa` → `os_gerada` → `win` / `perdida` / `expirada`), including auto-generated naming, service order creation, and conversion to campaigns upon signing. Batch IDs are stored in `batchSelectionJson` on the OS during creation and pre-populated in signing/link dialogs. Status regression protection prevents reverting to pre-OS states (`rascunho`/`enviada`/`ativa`) when an OS already exists. The `generateOS` mutation self-heals if called on a quotation that already has an OS.
- **Simulator UI**: A comprehensive simulation tool with collapsible sections for operational parameters, production costs, pricing, and commercial/tax details, providing KPI cards, DRE, and tabbed analysis.
- **Restaurant Onboarding**: Supports both self-service public registration and invite-based onboarding for restaurant partners, with legal term acceptance tracking. Self-service onboarding fetches active term templates from `term_templates` table and requires individual acceptance of each. Includes optional profile photo upload (PNG or JPG, max 2MB) stored via Replit Object Storage (GCS bucket). Photos served through `/api/restaurant-logo/serve/:objectName` route with long-term caching.
- **Restaurant Avatar**: `RestaurantAvatar` component (`client/src/components/RestaurantAvatar.tsx`) displays restaurant logo if `logoUrl` exists, otherwise shows deterministic initials + hash-based background color fallback. Sizes: xs/sm/md/lg/xl. Used in restaurant list cards, profile header, allocation panels, and restaurant portal.
- **Term Templates**: Admin-managed templates (`term_templates` table) with title, rich HTML content (via TipTap WYSIWYG editor), version tracking, and `requiredFor` role targeting. Managed at `/configuracoes/termos`. Used by onboarding and restaurant portal for dynamic term acceptance. HTML content is sanitized with DOMPurify before rendering.
- **Client Detail (Internal)**: Comprehensive internal view of each advertiser at `/clientes/:id` (`ClientDetail.tsx`) with 9 tabs: Painel (KPIs, summaries), Informações (company data, address, contact), Campanhas (all client campaigns with status), Cotações (quotations with conversion tracking), Financeiro (invoices, payment summary), Contatos (CRM contacts with add/edit/delete, primary marking), Filiais (parent/child hierarchy with link/unlink), Ordens de Serviço (service orders), Contas (linked users, impersonation). Backend endpoints under `advertiser.*` router.
- **CRM Contacts**: Global contacts management at `/comercial/contatos` (`Contacts.tsx`). Each contact belongs to either a client (anunciante), a restaurant, or a lead via nullable `clientId` / `restaurantId` / `leadId` FKs on the `contacts` table. Fields: name, email, phone, role, notes, isPrimary. Global page shows type filter (Anunciante/Restaurante), company filter, CSV export with type column. Restaurant profile has Contatos tab with add/edit/delete. Lead detail Sheet has inline contacts section with add/delete and "copy to client account" action. Backend: `server/contactRouter.ts` with CRUD + listAll + copyToClient (copies a lead contact to a client account without leadId). **Auto-sync**: Platform users are automatically registered as CRM contacts when created or linked to a restaurant/client account. Utility `server/contactSync.ts` provides `ensureContact()` (dedup by email OR name per entity) and `backfillContacts()` (runs at startup to sync existing users/restaurants). Hooks in: Clerk webhook, restaurant onboarding submit/accept-invite, activeRestaurant.linkUser, advertiser.linkUser, advertiser.completeOnboarding.
- **Account Hierarchy**: Clients can have parent-child relationships via `parentId` column on `clients` table. ClientDetail Filiais tab shows parent (matrix) link and child (branch) list. Backend: `advertiser.getChildren`, `advertiser.getParent`, `advertiser.setParent` endpoints.
- **Lead Auto-Classification**: When creating an advertiser lead, the system auto-matches CNPJ or company name against existing clients. If a match is found, the lead is auto-linked (`clientId`) and classified as "upsell". Otherwise classified as "new". Logic in `server/leadRouter.ts` create mutation.
- **Impersonation**: Internal users (admin, comercial, operacoes, financeiro, manager) can impersonate external accounts (anunciante, restaurante) via "Entrar como" buttons. Uses `window.__IMPERSONATION__` + custom event pattern, sends `x-impersonate-client-id`/`x-impersonate-restaurant-id` headers to backend. Banner in DashboardLayout shows active impersonation with exit button.
- **Roles & Permissions**: Granular access control based on roles (Admin, Comercial, Operações, Financeiro, Anunciante, Restaurante), enforced at both UI and API levels using tRPC procedures. No "user" role — all users must have an explicit role. Members page segments users into Internos/Externos tabs.
- **Pricing Engine**: Cost-based pricing with markup, calculating selling price using grossup formula: `CustoBruto = CustoPD / (1 - totalVarRate)`, then `SellingPrice = CustoBruto × (1 + markup%)`.
- **Restaurant Rating System**: A multi-dimensional rating system (Bronze, Prata, Ouro, Diamante) based on weighted factors (drinks flow, ticket, location, etc.) for classification.
- **Bonificação**: Campaigns and quotations can be marked as `isBonificada` (complimentary/bonus). Bonificada items have zero revenue, are visually indicated with amber badges, and are excluded from all financial KPIs and aggregations. The flag flows through the full lifecycle: quotation → signOS → campaign.
- **Campaign Batches**: Divides the year into 13 four-week batch cycles starting **April 15th** (not January). Batches span from Apr 15 of year N through ~Apr 7 of year N+1. Event-aware labels auto-detect overlap with Black Friday, Copa do Mundo, and Festival de Parintins. All campaign/quotation/OS periods are derived from batch selections — no free-form date inputs. Campaign creation, quotation signing (signOS), and service order generation all use batch pickers.
- **System Version Tag**: Build-time version (`__APP_VERSION__` from `package.json`) and environment label (`__APP_ENV__`: `dev`/`prod`) injected via Vite `define` in `vite.config.ts`, declared in `client/src/env.d.ts`, and displayed discreetly in the sidebar footer of `DashboardLayout.tsx`.
- **Term PDF Generation**: Branded mesa.ads PDF auto-downloads after term acceptance and can be re-downloaded from accepted terms list. Uses jsPDF with black header bar, green accent, signer details, and document hash.
- **Digital Signature (Quotation/OS)**: Public signing flow for advertisers. Internal user generates a signing link (with batch pre-selection) from QuotationDetail when status is `os_gerada`. Advertiser opens `/cotacao/assinar/:token` (public, no auth), sees quotation/OS details, signs with name + CPF + acceptance checkbox. Signing atomically (DB transaction): updates quotation to `win`, OS to `assinada`, creates campaign + batch assignments + restaurant allocations + history. SHA-256 hash of content for audit. Auto-downloads branded mesa.ads PDF. CPF is masked in campaign history. AnunciantePortal has "Ordens de Serviço" tab showing OS list with signing status and contract PDF re-download. Backend: `server/publicSigningRouter.ts` (public Express routes), `generateSigningLink` mutation in `quotationRouter.ts`. Frontend: `QuotationSign.tsx`, `generate-quotation-pdf.ts`.

### System Design Choices
- **Monorepo Structure**: `client/` for frontend, `server/` for backend, and `shared/` for common types and constants.
- **tRPC**: Utilized for end-to-end type safety between frontend and backend APIs.
- **Drizzle ORM**: Used for type-safe database interactions and migrations.

## External Dependencies
- **Clerk**: For authentication, user management, and authorization.
- **Neon Database**: Provides the PostgreSQL database infrastructure.
- **Recharts**: For data visualization in the UI.
- **jsPDF + jspdf-autotable**: For client-side PDF generation (e.g., Service Orders, Term acceptance PDFs).
- **TipTap**: Rich text (WYSIWYG) editor for term template content (`@tiptap/react`, `@tiptap/starter-kit`, `@tiptap/extension-underline`).
- **DOMPurify**: HTML sanitization for rendering rich text content safely.
- **Multer**: Multipart form-data handling for file uploads (restaurant logo upload).
- **Anthropic AI SDK**: `@anthropic-ai/sdk` for AI-powered features. Client configured in `server/anthropic.ts` using `ANTHROPIC_API_KEY` secret. Default model: `claude-sonnet-4-20250514`.

### Mobile Responsiveness Patterns
The application uses consistent mobile-first responsive patterns:
- **Scrollable Tabs**: `TabsList` components with many items are wrapped in `<div className="overflow-x-auto -mx-1 px-1 scrollbar-hide">` with the TabsList using `inline-flex w-auto min-w-full sm:w-auto`. The `.scrollbar-hide` utility is defined in `client/src/index.css`.
- **Form Grids**: Dialog/form grids use `grid-cols-1 sm:grid-cols-2` pattern to collapse to single column on mobile.
- **Button Groups**: Action button containers use `flex-wrap` to wrap on narrow screens instead of overflowing.
- **Tables**: Raw `<table>` elements are wrapped in `overflow-x-auto` containers with `min-w-[600px]` on the table for proper horizontal scrolling.
- **KPI Grids**: Use progressive breakpoints (e.g., `grid-cols-1 sm:grid-cols-3` or `grid-cols-2 sm:grid-cols-3 lg:grid-cols-6`) for readable card sizes on all screens.