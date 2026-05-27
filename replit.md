# Mesa Ads ERP

## Overview
Mesa Ads ERP is a financial simulation and management SaaS designed for a Brazilian offline media company specializing in advertising on coasters. Its primary goal is to streamline operations, manage advertising campaigns from lead to invoicing, track finances, and facilitate onboarding for both advertisers and restaurant partners. Key capabilities include a comprehensive campaign workflow, quotation management, lead tracking with auto-classification, a detailed financial dashboard, a multi-dimensional restaurant rating system, and a flexible multi-product pricing engine. The project aims to enhance efficiency, provide robust financial insights, and support business growth in the niche advertising market.

## User Preferences
I prefer clear and concise communication. Focus on high-level concepts and architectural decisions. When making changes, prioritize modularity and maintainability. I prefer an iterative development approach, with regular updates on progress and potential roadblocks. Do not make changes to the `shared/rating-config.ts` file.

## System Architecture

### UI/UX Decisions
The application utilizes a sidebar-based layout built with `shadcn/ui`, offering a collapsible and resizable navigation experience. It supports both light and dark modes, defaulting to dark, and employs a consistent brand color scheme (Black: `#0d0d0d`, Green: `#27d803`) along with semantic colors for status indicators. Typography is based on DM Sans and JetBrains Mono. Reusable components like `PageContainer` and `Section` are used to maintain design consistency across the application. The design is mobile-first, implementing patterns like scrollable tabs, responsive form grids, flexible button groups, and adaptable KPI grids.

### Technical Implementations
- **Frontend**: React 19, Vite, Tailwind CSS 4, shadcn/ui, TanStack Query, tRPC, Recharts, wouter.
- **Backend**: Node.js, Express, tRPC, Drizzle ORM.
- **Authentication**: Clerk for identity management, roles (Admin, Comercial, Operações, Financeiro, Anunciante, Restaurante) are managed via Clerk's `publicMetadata.role` and synced to a local `users` table. Impersonation functionality is available for internal users.
- **Database**: PostgreSQL, powered by Neon Database (serverless), with Drizzle ORM for type-safe interactions.
- **Module-based Structure**: Organized into distinct modules (Comercial, Financeiro, Campanhas, Restaurantes, Biblioteca), each with dedicated tRPC routers and UI sections.
- **Custom Database Migrations**: A custom migration runner in `server/migrations.ts` handles all database schema changes using idempotent SQL. Drizzle CLI generated files are for reference only.
- **Campaign Workflow**: A 7-step automated pipeline (`briefing` → `design` → `aprovacao` → `producao` → `distribuicao` → `veiculacao` → `inativa`) with SLA tracking and automated production/distribution OS generation. Supports multiple freight trackings per service order.
- **Quotation Workflow**: Manages quotations through statuses (`rascunho` → `enviada` → `ativa` → `os_gerada` → `win` / `perdida` / `expirada`), supporting auto-naming, batch selection, and conversion to campaigns upon digital signing.
- **Financial Dashboard**: Comprehensive dashboard (`/financeiro/dashboard`) with executive KPIs, DRE, detailed revenue analysis, efficiency metrics (quotation funnel), and client performance. Includes server-side alerts based on financial metrics.
- **DRE Dual (Finrefac #7)**: Two regimes — Competência (revenue=issueDate, costs=competenceMonth) and Caixa (revenue=paymentDate, costs=paymentDate). User preference persisted in `users.preferences` jsonb. Dashboard exposes new cards: DSO with 90d trend, inadimplência por aging (0-30/30-60/60-90/90+), funil cotação→fatura→recebido. Relatório financeiro exporta CSV e PDF (jspdf + autotable) com regime selecionado.
- **Restaurant Onboarding**: Supports both self-service public registration and invite-based onboarding, including legal term acceptance with version tracking and profile photo uploads to Replit Object Storage.
- **Client Management**: Detailed internal view for advertisers (`/clientes/:id`) covering campaigns, quotations, finances, CRM contacts, account hierarchy (parent-child), and service orders. Leads are auto-classified as "upsell" or "new" based on existing client matching.
- **Pricing Engine**: Cost-based pricing with markup, supporting multiple products with volume-based pricing tiers, dynamic unit labels, and product-specific commission/tax rates. Features a multi-product budget creator and simulator.
- **Digital Signature**: Public signing flow for quotations and service orders, updating status, creating campaigns, and generating branded PDF contracts with audit-ready content hashing.
- **Contas a Pagar — Ledger Único (Finrefac #1–#10)**: Toda saída financeira vive em `accounts_payable` com `sourceType` semântico (`restaurant_commission`, `vip_repasse`, `supplier_cost`, `freight_cost`, `partner_commission`, `seller_commission`, `tax`, `manual`), `competenceMonth` (YYYY-MM) e `sourceRef` jsonb. Materializadores idempotentes: `createInvoice` → AP `tax`; `markInvoicePaid` → AP `partner_commission` (agregado por `(partnerId, month)` sob advisory lock) + `vip_repasse` (quando produto é digital); `restaurant_payments` espelhados em AP `restaurant_commission`. Regra "tela vs bolacha": produtos digitais pulam comissão restaurante / produção / frete e geram repasse VIP. Conciliação bancária 1↔1 e 1↔N (`bank.reconcile` / `bank.undoReconcile`) com restauração de `prevStatus`/`prevReceivedDate`/`prevPaymentDate`. Trilha de auditoria via wrapper `audited()` em `audit_log` (entityType: invoice / accounts_payable / restaurant_payment / bank_transaction). Documentação canônica: `docs/financeiro-glossario.md` (definições + mapeamento de colunas) e `docs/financeiro-fluxograma.md` (Mermaid do ciclo completo).
- **Bonificação**: Campaigns and quotations can be marked as `isBonificada`, excluding them from financial KPIs and aggregations.
- **Campaign Batches**: Divides the year into 13 four-week cycles, used for all campaign/quotation/OS period definitions, with event-aware labels.
- **System Version Tag**: Displays build-time version and environment (`dev`/`prod`) in the UI.
- **Banco de testes E2E isolado — defesa em camadas (Task #189 + #202)**: O `scripts/pre-deploy.sh` sobe um dev server durante o pipeline de deploy para rodar Playwright; os endpoints `/api/dev-*` fazem INSERT real (parceiros/clientes/campanhas "E2E ..."), então qualquer falha de configuração historicamente vazou lixo pra produção. Hoje há quatro camadas independentes, cada uma sozinha já barra o estrago:
  1. **Módulo isolado + flag de opt-in.** As rotas `/api/dev-*` vivem em `server/_dev/devEndpoints.ts` e só são `dynamic import`-adas quando `process.env.DEV_FIXTURES === "1"`. `npm run start` (produção) NUNCA seta essa flag — o esbuild até bundla o módulo, mas ele nunca é alcançado. `pnpm run dev` e o `pre-deploy.sh` setam a flag explicitamente.
  2. **Sentinel no banco de teste.** A migration `create_e2e_test_db_sentinel_task_202` cria a tabela `e2e_test_db_sentinel(allowed boolean primary key)` em TODOS os bancos. A LINHA `(true)` só é inserida pelo `devEndpoints.ts` no boot, e somente se o host da `DATABASE_URL` atual não bate com nenhum padrão de produção conhecido (`FORBIDDEN_HOST_PATTERNS` — atualmente `.neon.tech`). Antes de qualquer INSERT, cada endpoint faz `SELECT 1 FROM e2e_test_db_sentinel WHERE allowed=true` — sem a linha, responde 503. O banco de produção fisicamente não tem o sentinel.
  3. **Comparação por host:porta:database no pré-deploy.** O `pre-deploy.sh` parseia `DATABASE_URL_TEST` e `DATABASE_URL` com `new URL(...)` e aborta se host:porta:database baterem (querystring irrelevante). Também aborta se o host de teste cair em qualquer padrão proibido (mesma lista que o módulo dev).
  4. **DATABASE_URL_TEST automático via PG*.** O script resolve `DATABASE_URL_TEST` a partir dos secrets `PG*` (Postgres nativo Replit, isolado do Neon prod) quando o secret explícito não está setado, e exporta `DATABASE_URL=$DATABASE_URL_TEST` apenas no subprocess do dev server. O `DATABASE_URL` do build segue apontando para Neon prod para o `npm run build` subsequente.

  Schema do banco de teste é criado automaticamente por `runMigrations()` na primeira inicialização. Cleanup retroativo do lixo já emitido é feito por `inactivate_leaked_e2e_records_task_189` + `inactivate_leaked_e2e_records_task_202` (inativam em vez de DELETE para preservar trilha financeira de invoices reais associadas aos clientes E2E).
- **URL pública canônica**: O servidor resolve a URL pública via `server/_core/appUrl.ts` (helper `appUrl()`). Prioridade: `APP_URL` env → fallback hardcoded `https://app.mesaads.com.br` em produção → `REPLIT_DEV_DOMAIN` em dev. Use SEMPRE esse helper para construir links externos (convites Clerk, callbacks OAuth, links de assinatura digital) em vez de ler `process.env.APP_URL` direto — caso contrário, links em produção podem cair no workspace dev se o secret não estiver configurado. Em produção, manter `APP_URL=https://app.mesaads.com.br` setado é a configuração recomendada (o fallback é apenas rede de segurança).

### System Design Choices
- **Monorepo Structure**: Separation into `client/` (frontend), `server/` (backend), and `shared/` (common types and constants).
- **tRPC**: Ensures end-to-end type safety between frontend and backend APIs.
- **Drizzle ORM**: Provides type-safe database interactions and schema definition.

## External Dependencies
- **Clerk**: Authentication, user management, and authorization services.
- **Neon Database**: PostgreSQL database hosting.
- **Recharts**: JavaScript charting library for data visualization.
- **jsPDF + jspdf-autotable**: Client-side PDF generation, including branded documents with custom fonts and logos.
- **TipTap**: WYSIWYG rich text editor for managing term templates.
- **DOMPurify**: HTML sanitization to securely render rich text content.
- **Multer**: Middleware for handling multipart/form-data, used for file uploads.
- **Anthropic AI SDK**: `@anthropic-ai/sdk` for AI-powered features, using `claude-sonnet-4-20250514`.
- **Melhor Envio**: OAuth2-based freight integration for tracking shipments and calculating freight, with auto-refreshing tokens and a dedicated settings page.
- **Playwright**: End-to-end browser tests live in `e2e/` and run with `pnpm run test:e2e`. The open-checkout flow at `/montar-campanha` is covered for guest visitors (hero + product list, localStorage persistence) and internal/partner users (auto-routing to the client picker). Tests log internal users in via the dev `/api/dev-login` cookie.
  - **Rodando localmente**: na primeira execução, instale o navegador com `pnpm exec playwright install chromium`. Em seguida rode `pnpm run test:e2e`. O comando sobe o servidor dev em `http://localhost:5000` automaticamente (via `webServer` no `playwright.config.ts`); se o workflow `Start application` já estiver de pé, ele reaproveita.
  - **Relatório**: o reporter HTML do Playwright grava em `playwright-report/` (ignorado pelo Git). Abra `playwright-report/index.html` no navegador para ver o detalhe de cada teste, traces e screenshots de falhas. Resultados brutos (traces/screenshots) ficam em `test-results/`.
  - **Pré-deploy automático**: o build de deploy roda `bash scripts/pre-deploy.sh` antes de `npm run build`. O script instala o Chromium, executa `pnpm run test:e2e` e aborta o deploy (exit ≠ 0) se qualquer teste falhar — assim regressões no checkout aberto não chegam em produção.