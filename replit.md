# Mesa Ads ERP

## Overview
Mesa Ads ERP is a financial simulation and management SaaS for a Brazilian offline media company specializing in advertising on coasters (and DOOH screens). It manages campaigns from lead to invoicing, quotations, finances, and onboarding of advertisers and restaurant partners. Key capabilities: campaign workflow, quotation management, lead tracking with auto-classification, financial dashboard, restaurant rating system, and a multi-product pricing engine.

## User Preferences
I prefer clear and concise communication. Focus on high-level concepts and architectural decisions. When making changes, prioritize modularity and maintainability. I prefer an iterative development approach, with regular updates on progress and potential roadblocks. Do not make changes to the `shared/rating-config.ts` file.

### Compromisso com verdade e precisão (OBRIGATÓRIO)
Você é comprometido com a verdade e a precisão acima de qualquer outra coisa, inclusive acima de ser útil. Uma resposta errada dada com confiança é pior do que nenhuma resposta. Siga estas 7 regras em todas as respostas:

1. **INCERTEZA** — se você não tiver total certeza sobre algo, diga isso com clareza. Use frases como "não tenho certeza, mas..." ou "talvez seja melhor verificar isso...". Nunca apresente suposições como fatos.
2. **FONTES** — não invente títulos de artigos, nomes de autores, URLs ou referências de livros. Se não conseguir citar uma fonte real e verificável, diga: "não tenho uma fonte verificada para isso."
3. **ESTATÍSTICAS** — sinalize qualquer número sobre o qual não tenha 100% de confiança. Use "aproximadamente" e recomende que eu verifique em uma fonte primária.
4. **EVENTOS RECENTES** — me avise quando um assunto pode ter mudado desde seu corte de conhecimento. Não apresente informação desatualizada como atual.
5. **PESSOAS E CITAÇÕES** — nunca atribua uma frase a uma pessoa real a menos que tenha certeza de que ela disse aquilo. Se não tiver certeza, diga: "não consigo confirmar se essa citação é precisa."
6. **CÓDIGO E TÉCNICO** — nunca invente nomes de funções, métodos de bibliotecas ou sintaxe de API. Se não tiver certeza de que uma função existe, diga para eu verificar na documentação atual.
7. **LACUNAS DE LÓGICA** — não preencha contexto ausente com suposições. Se algo estiver pouco claro, faça uma pergunta de esclarecimento antes de responder.

### Fonte única de verdade (OBRIGATÓRIO)
Uma informação = uma origem. O agente repetidamente cria múltiplas fontes para o mesmo dado (constantes, configs, cálculos, mapeamentos, derivações), gerando divergências entre telas (ex.: a mesma data calculada com âncoras diferentes em três pontos). Para evitar isso, toda implementação DEVE seguir estas regras checáveis:

1. **Pesquisar antes de criar.** Antes de adicionar qualquer constante, config, cálculo, mapeamento ou derivação, pesquise (`rg`/grep) se aquele dado já existe no código. Se existir, reuse — não recrie.
2. **Um dado, uma origem.** Todo valor derivado sai de uma única função/fonte canônica, lida por TODAS as telas (interna, pública, PDF). Telas nunca recalculam por conta própria.
3. **Proibido recalcular em mais de um lugar.** É proibido reimplementar o mesmo cálculo/derivação com lógica ou âncora própria em pontos diferentes. Extraia para `shared/` (ou um helper canônico) e chame em todos os pontos.
4. **Na dúvida, pergunte.** Se não tiver certeza se um valor novo é o mesmo dado de um já existente, pergunte ao usuário antes de duplicar.
5. **Liste as fontes ao concluir.** Ao finalizar uma feature, liste no resumo as fontes de dado usadas, confirmando explicitamente que não há duplicação de origem.

## System Architecture

### Stack
- **Frontend**: React 19, Vite, Tailwind CSS 4, shadcn/ui, TanStack Query, tRPC, Recharts, wouter.
- **Backend**: Node.js, Express, tRPC, Drizzle ORM, PostgreSQL (Neon serverless).
- **Monorepo**: `client/` (frontend), `server/` (backend), `shared/` (common types/constants). tRPC gives end-to-end type safety.
- **Auth**: Clerk; roles (Admin, Comercial, Operações, Financeiro, Anunciante, Restaurante) via `publicMetadata.role`, synced to local `users` table. Impersonation available for internal users.

### UI/UX
Sidebar layout (shadcn/ui), light/dark with **light default** (Mesa.ads paper identity). Palette: neon green primary (`#00c238`/`#00e640`), magenta destructive/accent (`#e51e75`/`#ff2e8a`), amber/ice/orange for charts; warm paper neutrals (light) / deep ink `#0a0a0c` (dark), hairline borders. Typography: DM Sans (body), Bricolage Grotesque (`font-display`), Instrument Serif italic (`font-serif-display`), JetBrains Mono (`label-mono`). Reusable `PageContainer`/`Section`. Mobile-first.

### Domain modules
- **Campaign Workflow**: 7-step pipeline (`briefing` → `design` → `aprovacao` → `producao` → `distribuicao` → `veiculacao` → `inativa`) with SLA tracking and auto production/distribution OS generation; multiple freight trackings per OS.
- **Quotation Workflow**: statuses `rascunho` → `enviada` → `ativa` → `os_gerada` → `win`/`perdida`/`expirada`; auto-naming, batch selection, conversion to campaign on digital signing.
- **Pricing Engine**: cost-based with markup; multiple products, volume tiers, dynamic unit labels, product-specific commission/tax; multi-product budget creator and simulator.
- **Financial Dashboard** (`/financeiro/dashboard`): executive KPIs, DRE, revenue analysis, quotation funnel, client performance, server-side alerts. **DRE Dual**: regimes Competência (revenue=issueDate, costs=competenceMonth) and Caixa (both=paymentDate); preference in `users.preferences` jsonb; DSO, aging de inadimplência, funil cotação→fatura→recebido; export CSV/PDF.
- **Contas a Pagar — Ledger Único**: toda saída financeira vive em `accounts_payable` com `sourceType` semântico (`restaurant_commission`, `vip_repasse`, `supplier_cost`, `freight_cost`, `partner_commission`, `seller_commission`, `tax`, `manual`), `competenceMonth` (YYYY-MM) e `sourceRef` jsonb. Materializadores idempotentes (invoice → tax; invoice paga → partner_commission agregada sob advisory lock + vip_repasse para digitais; restaurant_payments espelhados). Regra "tela vs bolacha": digitais pulam comissão restaurante/produção/frete e geram repasse VIP. Conciliação bancária 1↔1 e 1↔N com restauração de estado anterior. Auditoria via wrapper `audited()` em `audit_log`. Docs canônicos: `docs/financeiro-glossario.md` e `docs/financeiro-fluxograma.md`.
- **Client Management** (`/clientes/:id`): campaigns, quotations, finances, CRM contacts, account hierarchy, service orders. Leads auto-classified "upsell"/"new" by client matching.
- **Digital Signature**: public signing flow for quotations/OS; updates status, creates campaigns, generates branded PDF contracts with content hashing.
- **Restaurant Onboarding**: self-service public registration + invite-based; legal terms with version tracking; photos in Replit Object Storage.
- **Bonificação**: `isBonificada` campaigns/quotations excluded from financial KPIs.
- **Campaign Batches**: year divided into 13 four-week cycles, used for all period definitions; event-aware labels.
- **System Version Tag**: build-time version + env (`dev`/`prod`) in the UI.

### Google Maps
- Loader único: `client/src/lib/googleMaps.ts` (`loadGoogleMaps()`) — SEMPRE use ele; curto-circuita se o SDK já carregou. Chave `VITE_GOOGLE_MAPS_API_KEY` (secret): ausente → rejeita com `GoogleMapsKeyMissingError` antes de injetar o script e as telas renderizam fallback ("Mapa indisponível…") sem quebrar o resto; inválida/sem billing → overlay do Google + `window.gm_authFailure` logado. Comportamento idêntico em todas as telas com mapa (CatalogMap, `RestaurantsMap`).
- CatalogMap (builder `/montar-campanha` e Orçamento interno): um pin por local, `InfoWindow` via DOM `textContent` (nunca HTML interpolado), preço/período da fonte única `locationMetrics`.
- E2E: `e2e/builder-locais.spec.ts` usa SDK fake determinístico; SDK real coberto por `e2e/builder-locais-real-maps.spec.ts`, gated por `RUN_REAL_MAPS=1` (custo/flakiness). Checklist manual: abrir `/montar-campanha` como anunciante → visão "Mapa" → mapa renderiza, pins aparecem, popup mostra preço correto, "Adicionar" põe o local no plano.

### Banco de dados e migrations
- **Runner custom**: `server/migrations.ts` roda no boot (`runMigrations()`), SQL idempotente rastreado por nome em `_applied_migrations`. Arquivos gerados pelo Drizzle CLI são só referência. **Toda coluna/tabela nova em `drizzle/schema.ts` PRECISA de migration custom** — bancos novos (teste/E2E) e produção só recebem o que o runner aplica.
- **Check de drift**: `pnpm run check:schema-drift` (`scripts/check-schema-drift.ts`) roda as migrations no banco de teste isolado e compara com `drizzle/schema.ts`; falha listando o que falta. Registrado como validação `schema-drift`. Rode antes de publicar mudanças de schema.
- **Armadilha do Publish (drop de colunas em prod)**: o fluxo de Publish do Replit diffa o banco dev gerenciado pelo Replit contra produção e pode propor/aplicar **DROPs destrutivos** de objetos que só existem em prod (o app nunca migra esse banco dev). Isso já apagou colunas de prod DEPOIS das migrations terem sido registradas (ex.: `quotations.periodEnd`), e o runner não re-aplica (pula por nome). Regras: nunca aceitar DROPs no Publish; manter o banco dev Replit alinhado ao `schema.ts` completo (DDL aditivo via executeSql); recuperação = nova migration idempotente com nome novo + sync do dev. Detalhe completo em `.agents/memory/publish-dev-prod-drift.md`.
- **URL pública canônica**: `server/_core/appUrl.ts` (`appUrl()`): `APP_URL` env → fallback `https://app.mesaads.com.br` em prod → `REPLIT_DEV_DOMAIN` em dev. SEMPRE use o helper para links externos (convites Clerk, OAuth callbacks, assinatura digital). Em prod, manter `APP_URL` setado.

### Testes E2E (Playwright) e banco de teste isolado
- Testes em `e2e/`, rodam com `pnpm run test:e2e` (primeira vez: `pnpm exec playwright install chromium`). O config sobe o dev server em `localhost:5000` automaticamente (reaproveita o workflow se já estiver de pé). Relatório HTML em `playwright-report/`; brutos em `test-results/`. Login interno via cookie `/api/dev-login`.
- **Banco de teste isolado (defesa em camadas)**: o dev server da suíte é SEMPRE forçado ao banco de teste (`DATABASE_URL_TEST`, ou derivado dos secrets `PG*` se ausente). Camadas: (1) endpoints `/api/dev-*` vivem em `server/_dev/devEndpoints.ts` e só carregam com `DEV_FIXTURES=1` (produção nunca seta); (2) sentinel `e2e_test_db_sentinel` — endpoints respondem 503 sem a linha `allowed=true`, que só é inserida em bancos não-produção; (3) `e2e/test-db.ts` (`resolveTestDatabaseUrl()`) valida que o banco de teste NÃO é produção (host:porta:database ≠ `DATABASE_URL`; host fora de `PROD_DB_HOSTS`) e aborta com erro claro antes de qualquer teste; (4) `scripts/pre-deploy.sh` replica as mesmas validações em bash.
- **`PROD_DB_HOSTS`** (env, escopo shared): substring única do host de PRODUÇÃO (ex.: `empty-scene-ae775drh`) — é o discriminador que permite um banco de teste Neon dedicado enquanto barra o host de prod. Fallback sem ela: `.neon.tech`.
- **E2E desacoplado do deploy**: o build de deploy roda APENAS `npm run build` (não sobe dev server, não toca banco). `scripts/pre-deploy.sh` é ferramenta MANUAL opcional pré-publicação.
- Schema do banco de teste é criado por `runMigrations()` no primeiro boot.

## External Dependencies
- **Clerk**: auth/user management. **Neon**: PostgreSQL hosting.
- **Recharts** (charts); **jsPDF + jspdf-autotable** (branded client-side PDFs); **TipTap** (rich text de templates de termos); **DOMPurify** (sanitização de HTML); **Multer** (uploads).
- **Anthropic AI SDK** (`@anthropic-ai/sdk`, model `claude-sonnet-4-20250514`).
- **Melhor Envio**: frete via OAuth2 com refresh automático de tokens e página de configurações.
- **Playwright**: E2E (ver seção acima).
