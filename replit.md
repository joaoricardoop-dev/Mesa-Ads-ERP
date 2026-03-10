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
- **Quotation Workflow**: Manages quotations through statuses (`rascunho` → `enviada` → `ativa` → `os_gerada` → `win` / `perdida` / `expirada`), including auto-generated naming, service order creation, and conversion to campaigns upon signing.
- **Simulator UI**: A comprehensive simulation tool with collapsible sections for operational parameters, production costs, pricing, and commercial/tax details, providing KPI cards, DRE, and tabbed analysis.
- **Restaurant Onboarding**: Supports both self-service public registration and invite-based onboarding for restaurant partners, with legal term acceptance tracking. Self-service onboarding fetches active term templates from `term_templates` table and requires individual acceptance of each.
- **Term Templates**: Admin-managed templates (`term_templates` table) with title, rich HTML content (via TipTap WYSIWYG editor), version tracking, and `requiredFor` role targeting. Managed at `/configuracoes/termos`. Used by onboarding and restaurant portal for dynamic term acceptance. HTML content is sanitized with DOMPurify before rendering.
- **Client Detail (Internal)**: Comprehensive internal view of each advertiser at `/clientes/:id` (`ClientDetail.tsx`) with 7 tabs: Painel (KPIs, summaries), Informações (company data, address, contact), Campanhas (all client campaigns with status), Cotações (quotations with conversion tracking), Financeiro (invoices, payment summary), Ordens de Serviço (service orders), Contas (linked users, impersonation). Mirrors the ActiveRestaurantProfile pattern. Backend endpoints under `advertiser.*` router.
- **Impersonation**: Internal users (admin, comercial, operacoes, financeiro, manager) can impersonate external accounts (anunciante, restaurante) via "Entrar como" buttons. Uses `window.__IMPERSONATION__` + custom event pattern, sends `x-impersonate-client-id`/`x-impersonate-restaurant-id` headers to backend. Banner in DashboardLayout shows active impersonation with exit button.
- **Roles & Permissions**: Granular access control based on roles (Admin, Comercial, Operações, Financeiro, Anunciante, Restaurante), enforced at both UI and API levels using tRPC procedures. No "user" role — all users must have an explicit role. Members page segments users into Internos/Externos tabs.
- **Pricing Engine**: Cost-based pricing with markup, calculating selling price using grossup formula: `CustoBruto = CustoPD / (1 - totalVarRate)`, then `SellingPrice = CustoBruto × (1 + markup%)`.
- **Restaurant Rating System**: A multi-dimensional rating system (Bronze, Prata, Ouro, Diamante) based on weighted factors (drinks flow, ticket, location, etc.) for classification.
- **Bonificação**: Campaigns and quotations can be marked as `isBonificada` (complimentary/bonus). Bonificada items have zero revenue, are visually indicated with amber badges, and are excluded from all financial KPIs and aggregations. The flag flows through the full lifecycle: quotation → signOS → campaign.
- **Campaign Batches**: Divides the year into 13 four-week batch cycles starting **April 15th** (not January). Batches span from Apr 15 of year N through ~Apr 7 of year N+1. Event-aware labels auto-detect overlap with Black Friday, Copa do Mundo, and Festival de Parintins. All campaign/quotation/OS periods are derived from batch selections — no free-form date inputs. Campaign creation, quotation signing (signOS), and service order generation all use batch pickers.
- **Term PDF Generation**: Branded mesa.ads PDF auto-downloads after term acceptance and can be re-downloaded from accepted terms list. Uses jsPDF with black header bar, green accent, signer details, and document hash.

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
- **Anthropic AI SDK**: `@anthropic-ai/sdk` for AI-powered features. Client configured in `server/anthropic.ts` using `ANTHROPIC_API_KEY` secret. Default model: `claude-sonnet-4-20250514`.