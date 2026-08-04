# Diagnóstico Pré-Migração — Mesa Ads ERP

> **Escopo:** relatório SOMENTE LEITURA. Nenhum arquivo foi modificado,
> corrigido ou removido. O objetivo é mapear o acoplamento ao Replit (e ao
> Manus) para preparar a migração para edição local + hospedagem externa.
>
> **Data:** 2026-08-04 · **Branch analisado:** `claude/mesa-ads-pre-migration-audit-dr52yw`

---

## 1. Resumo executivo

O Mesa Ads ERP é uma aplicação **Node + Express + tRPC + React (Vite)** com
banco **PostgreSQL relacional** (Neon serverless) acessado via **Drizzle ORM**.
A camada de dados é a parte **mais fácil** de migrar: é Postgres padrão, com
schema versionado e um runner de migrations próprio — nada de key-value/Replit
DB.

O acoplamento crítico está em **duas camadas de infraestrutura de plataforma**,
não no banco:

1. **Replit Object Storage** — todo upload/serve de arquivos (logos,
   comprovantes, contratos, fotos) passa por um *sidecar* Replit em
   `http://127.0.0.1:1106` (GCS via credencial `external_account`). **Não
   funciona fora do Replit** sem reescrita.
2. **Proxy "Forge" da Manus** (`forge.manus.im`) — LLM, Google Maps, geração de
   imagem, transcrição de voz e "data API" passam por um proxy autenticado com
   `BUILT_IN_FORGE_API_*`. É um segundo acoplamento de plataforma, **de origem
   Manus**, independente do Replit.

Além disso há um **problema de segurança grave e imediato**: o arquivo
`.replit` versionado contém **segredos em texto claro** (chaves Clerk de test e
**de produção**, incluindo `CLERK_SECRET_KEY`). Isso precisa ser rotacionado e
removido do histórico antes/durante a migração.

O bind de rede já é portável (`0.0.0.0` + `process.env.PORT`), e boa parte das
integrações "de produto" (Clerk, Anthropic SDK, Resend, Melhor Envio, Google
Maps direto) já usa envs padrão e migra sem dor. O maior esforço será
**substituir o object storage** e **decidir o destino do proxy Forge/Manus**.

---

## 2. Configuração específica do Replit

**Arquivos:** `.replit`, `replit.nix`, `replit.md` (doc), `scripts/post-merge.sh`

### `.replit`
- **Módulos/runtime declarados:** `nodejs-20`, `javascript`, `python-3.11`,
  `postgresql-16` (linha `modules = [...]`).
  - ⚠️ Divergência: o container atual roda **Node v22.22.2** (ver seção 6), não
    o `nodejs-20` declarado. `python-3.11` aparece mas não há código Python de
    aplicação evidente.
- **Integrações Replit** (`[agent] integrations`):
  `javascript_log_in_with_replit:2.0.0`, `javascript_anthropic:1.0.0`,
  `javascript_object_storage:2.0.0`.
- **Nix channel:** `stable-25_05`, pacote extra `unzip`.
- **Workflows** (`[[workflows.workflow]]`):
  - `Start application`: `DATABASE_URL="$DATABASE_URL_TEST" DEV_FIXTURES=1 GEOCODE_STUB_LATLNG="-23.55052,-46.633308" pnpm run dev`, `waitForPort 5000`.
  - `schema-drift`: `pnpm run check:schema-drift` (validação).
- **Deploy** (`[deployment]`): `deploymentTarget = "autoscale"`,
  `build = ["npm","run","build"]`, `run = ["npm","run","start"]`,
  `publicDir = "dist/public"`.
- **postMerge hook:** `path = "scripts/post-merge.sh"` (timeout 120s) — roda
  `pnpm install --frozen-lockfile` + `bash scripts/validate-migrations.sh`.
- **Ports:** `localPort 5000 → externalPort 80`; `localPort 5001 → externalPort 3000`.
- **`[userenv]` — SEGREDOS EM TEXTO CLARO** (ver seção 3, tratado como Alto/Crítico).

### `replit.nix`
- Lista de libs de sistema para rodar **Chromium headless** (Playwright): `mesa`,
  `cairo`, `pango`, `nss`, `nspr`, `at-spi2-*`, `libgbm`, `cups`, `alsa-lib`,
  vários `xorg.*`, `libxkbcommon`, `dbus`, `freetype`, `fontconfig` etc. Sem
  dependências de runtime da aplicação — é só o ambiente gráfico para os testes
  E2E.

### Pastas de config
- **Não há** `.config/` nem `.upm/`.
- Existem `.manus/`, `.agents/`, `.canvas/` (artefatos de ferramenta/IDE Manus)
  e o plugin `vite-plugin-manus-runtime` + coletor de debug Manus no
  `vite.config.ts`.

| Achado | Arquivo | Risco | O que muda |
|---|---|---|---|
| Runtime/módulos declarados só no `.replit` | `.replit` | **Médio** | Recriar como `engines` no `package.json` + Dockerfile/CI; reconciliar Node 20 vs 22 (seção 6). |
| Workflows de dev/validação atados ao Replit | `.replit` | **Baixo** | Reescrever como scripts npm / tarefas de CI (os comandos em si já são `pnpm run ...`). |
| Deploy `autoscale` + build/run | `.replit` `[deployment]` | **Médio** | Traduzir para o alvo novo (Docker/CI). Comandos `npm run build`/`start` já são padrão. |
| postMerge hook Replit | `.replit` + `scripts/post-merge.sh` | **Baixo** | Migrar para git hook local ou passo de CI. |
| Deps de sistema via Nix | `replit.nix` | **Médio** | Fora do Nix, instalar libs do Chromium no host/imagem (ou usar Playwright com browsers embutidos). |

---

## 3. Secrets e variáveis de ambiente

> Apenas **NOMES** de variáveis abaixo — nenhum valor foi reproduzido.

### 🚨 Achado crítico de segurança
O `.replit` (versionado no git) contém **valores de segredos em texto claro**
sob `[userenv.development]` e `[userenv.production]`, incluindo chaves Clerk de
**produção** (`CLERK_SECRET_KEY`, `CLERK_PUBLISHABLE_KEY`,
`VITE_CLERK_PUBLISHABLE_KEY`) e um host de banco em `[userenv.shared]`
(`PROD_DB_HOSTS`). **Recomendação:** tratar essas chaves como comprometidas,
**rotacionar no Clerk**, remover do arquivo e purgar do histórico do git antes
de tornar o repo acessível fora do Replit. — **Risco: Alto/Crítico.**

### Inventário de variáveis usadas no código (nomes + onde)

| Variável (nome) | Onde é usada (arquivos) | Categoria |
|---|---|---|
| `DATABASE_URL` | `server/db.ts`, `server/migrations.ts`, `server/_core/env.ts`, `drizzle.config.ts`, `server/_dev/devEndpoints.ts` | Banco (obrigatória) |
| `DATABASE_URL_TEST` | `e2e/test-db.ts`, `e2e/*.spec.ts`, `.replit` (workflow) | Banco de teste E2E |
| `PROD_DB_HOSTS` | `server/_dev/devEndpoints.ts`, `e2e/test-db.ts` | Guard anti-escrita em prod |
| `NODE_ENV` | vários (`index.ts`, `appUrl.ts`, `env.ts`, `vite.config.ts`) | Runtime |
| `PORT` | `server/_core/index.ts` | Rede |
| `APP_URL` | `server/_core/appUrl.ts`, `server/melhorEnvioRouter.ts` | URL pública canônica |
| `REPLIT_DEV_DOMAIN` | `server/_core/appUrl.ts`, `server/melhorEnvioRouter.ts` | **Específica Replit** (fallback dev) |
| `CLERK_SECRET_KEY` | `server/_core/index.ts`, `server/_core/context.ts`, `server/clerkWebhook.ts`, `server/restaurantOnboardingRouter.ts`, `server/parceiroPortalRouter.ts` | Auth Clerk |
| `CLERK_PUBLISHABLE_KEY` / `VITE_CLERK_PUBLISHABLE_KEY` | `client/src/main.tsx` | Auth Clerk (client) |
| `CLERK_WEBHOOK_SECRET` | `server/clerkWebhook.ts` | Webhook Clerk (svix) |
| `ANTHROPIC_API_KEY` | `server/anthropic.ts` | IA (Anthropic SDK direto) |
| `BUILT_IN_FORGE_API_URL` / `BUILT_IN_FORGE_API_KEY` | `server/_core/env.ts`, `server/_core/llm.ts`, `server/_core/map.ts`, `server/_core/imageGeneration.ts`, `server/_core/voiceTranscription.ts`, `server/_core/dataApi.ts`, `server/storage.ts` | **Proxy Forge/Manus** |
| `GOOGLE_MAPS_API_KEY` / `VITE_GOOGLE_MAPS_API_KEY` | `server/_core/geocode.ts`, `client/src/components/Map.tsx`, `client/src/lib/googleMaps.ts` | Maps (uso direto) |
| `JWT_SECRET` | `server/_core/env.ts` | Cookie/sessão |
| `RESEND_API_KEY` / `RESEND_FROM` | `server/email.ts` | E-mail (Resend) |
| `MELHOR_ENVIO_CLIENT_ID` / `MELHOR_ENVIO_CLIENT_SECRET` / `MELHOR_ENVIO_APP_NAME` / `MELHOR_ENVIO_SANDBOX` | `server/melhorEnvioRouter.ts`, `server/melhorEnvioService.ts` | Integração frete |
| `PUBLIC_OBJECT_SEARCH_PATHS` / `PRIVATE_OBJECT_DIR` | `server/replit_integrations/object_storage/objectStorage.ts` (+ routers de upload) | **Object Storage Replit** |
| `VITE_APP_ID` / `OAUTH_SERVER_URL` / `OWNER_OPEN_ID` | `server/_core/env.ts` | Herança template Manus |
| `LEAD_SLA_FALLBACK_USER_ID` / `DISABLE_LEAD_SLA_JOB` | `server/_core/leadSlaConfig.ts`, scheduler | Config de job SLA |
| `DEV_FIXTURES` / `GEOCODE_STUB_LATLNG` | `server/_core/index.ts`, `server/_core/geocode.ts` | Fixtures/dev |
| `INVOICE_NUMBERING_STRICT` | `server/utils/numberCounter.ts` (numeração) | Config financeira |
| `E2E_BASE_URL` / `RUN_REAL_MAPS` | testes E2E / `playwright.config.ts` | Teste |

> ⚠️ O `README.md` menciona um `.env.example` ("Veja `.env.example` se
> necessário"), **mas o arquivo não existe** no repo. Não há inventário
> canônico de envs além deste relatório. — **Risco: Médio** (facilmente
> resolvido criando o `.env.example`).

---

## 4. Banco de dados

**Arquivos-chave:** `server/db.ts`, `drizzle.config.ts`, `drizzle/schema.ts`,
`drizzle/*.sql`, `server/migrations.ts`

### 🔴 Determinação explícita (crítico para o plano)
**O banco é um PostgreSQL RELACIONAL com schema, NÃO um key-value store.**
Evidências inequívocas:
- ORM **Drizzle** sobre Postgres: `drizzle-orm/neon-serverless`, `Pool` do
  `@neondatabase/serverless`, `neonConfig.webSocketConstructor = ws`
  (`server/db.ts:3-5,40-51`).
- `drizzle.config.ts`: `dialect: "postgresql"`.
- **~68 tabelas** com schema tipado em `drizzle/schema.ts` (`pgTable(...)`),
  FKs, enums (ex.: `accounts_payable_source_type`), CHECK constraints,
  colunas `jsonb`, SQL relacional complexo com `JOIN`/`leftJoin`/subqueries
  (ver `server/db.ts`).
- Migrations SQL versionadas em `drizzle/0000_*.sql … 0024_*.sql`.

### Como a conexão é feita hoje
- String de conexão: **`process.env.DATABASE_URL`** (e `DATABASE_URL_TEST` para
  E2E). Sem fallback — se ausente, `getDb()` retorna `null`
  (`server/db.ts:44-58`).
- Driver: **Neon serverless** com WebSocket (`ws`). Isso é específico do
  **provedor Neon**, não do Replit. Fora do Neon (ex.: Postgres gerenciado
  RDS/Cloud SQL/self-hosted), **provavelmente será preciso trocar** o driver
  `neon-serverless` por `drizzle-orm/node-postgres` + `pg` (o pacote `pg` já
  está nas deps) ou manter Neon como provedor externo.

### Dependência "replit" ligada ao banco no arquivo de dependências
- **Não há** nenhum pacote `@replit/*` no `package.json`/`pnpm-lock.yaml`.
  Nenhuma dependência de banco atrelada ao Replit. O acoplamento Replit ao
  banco é **zero** — só a *provisão* da env `DATABASE_URL` vinha do Replit.

### Runner de migrations (atenção)
- **Não usa `drizzle-kit` para migrar em produção.** O script `db:push` está
  propositalmente desativado (`package.json:15`). As migrations são aplicadas
  por um **runner custom idempotente** em `server/migrations.ts`, chamado no
  boot (`runMigrations()` em `server/_core/index.ts`). Num fresh DB ele aplica
  `drizzle/*.sql` e depois as migrations custom `MIGRATIONS[]`.
- **Implicação p/ migração:** para popular um banco novo basta subir o app
  (boot roda `runMigrations()`), mas o processo é **próprio** — documentar bem.
  Há lógica de "schema drift" (`pnpm run check:schema-drift`) que assume o
  fluxo de Publish do Replit; ver `replit.md` "Publish dev↔prod drift".

### Tabelas encontradas (schema.ts) — ~68
`users`, `restaurants`, `active_restaurants`, `user_restaurants`, `clients`,
`contacts`, `campaigns`, `campaign_restaurants`, `campaign_history`,
`campaign_drafts`, `campaign_items`, `campaign_products`, `campaign_phases`,
`campaign_proofs`, `campaign_reports`, `campaign_report_photos`,
`campaign_batches`, `campaign_batch_assignments`, `products`,
`product_locations`, `product_pricing_tiers`, `product_discount_price_tiers`,
`quotations`, `quotation_items`, `quotation_restaurants`, `suppliers`,
`budgets`, `budget_items`, `partners`, `vip_providers`, `service_orders`,
`service_order_items`, `service_order_trackings`, `invoices`,
`billing_schedule_items`, `accounts_payable`, `operational_costs`,
`financial_audit_log`, `bank_accounts`, `bank_transactions`, `permutas`,
`permuta_consumptions`, `leads`, `lead_interactions`, `opportunities`,
`restaurant_payments`, `restaurant_photos`, `restaurant_terms`,
`term_templates`, `term_acceptances`, `telas`, `screen`/backoffice:
`backoffice_production_orders`, `backoffice_production_logs`,
`backoffice_distribution_movements`, `backoffice_stock_counts`,
`backoffice_reports`, `backoffice_checklist_completions`,
`backoffice_screen_checks`, `backoffice_screen_check_logs`,
`backoffice_screen_material`, `library_items`, `media_kit_settings`,
`seasonal_multipliers`, `config_options`, `system_config`,
`integration_tokens`, `crm_notifications`.

### Estimativa de volume de dados
- **Não determinável a partir do código.** Não há dump nem acesso ao banco
  vivo nesta sessão. Há apenas fixtures de dev (`server/seed-data.ts`) e 4
  arquivos de query de amostra em `.manus/db/*.json` (ex.: inserts de
  `budget_items`), que **não** indicam volume de produção. → **Ponto de
  incerteza** (seção 8).

| Achado | Risco | O que muda |
|---|---|---|
| Postgres relacional / Drizzle | **Baixo** | Portável. Migrar dados via `pg_dump`/`pg_restore` para o Postgres de destino. |
| Driver Neon serverless (WebSocket) | **Médio** | Se sair do Neon, trocar para `pg` + `drizzle-orm/node-postgres`. Se mantiver Neon, só apontar `DATABASE_URL`. |
| Runner de migrations custom no boot | **Médio** | Documentar/validar fora do Replit; garantir que `runMigrations()` roda no novo deploy. O `check:schema-drift` pressupõe fluxo Publish do Replit. |
| `db:push` desativado de propósito | **Baixo** | Comportamento intencional; manter. |

---

## 5. Storage / arquivos

**Arquivos:** `server/replit_integrations/object_storage/*`,
`server/logoUploadRouter.ts`, `server/telaPhotoRouter.ts`,
`server/backofficeMaterialRouter.ts`, `server/storage.ts`

### 🔴 Acoplamento Alto — Replit Object Storage (sidecar)
`server/replit_integrations/object_storage/objectStorage.ts:12-31`:
```
const REPLIT_SIDECAR_ENDPOINT = "http://127.0.0.1:1106";
new Storage({ credentials: { audience: "replit", token_url: `${SIDECAR}/token`,
  type: "external_account", credential_source: { url: `${SIDECAR}/credential`, ... } } })
```
- Toda a autenticação com o Google Cloud Storage é obtida do **sidecar local do
  Replit** em `127.0.0.1:1106` (`/token`, `/credential`,
  `/object-storage/signed-object-url`). **Isso não existe fora do Replit.**
- Envs associadas: `PUBLIC_OBJECT_SEARCH_PATHS`, `PRIVATE_OBJECT_DIR`,
  `DEFAULT_OBJECT_STORAGE_BUCKET_ID` (documentado em
  `docs/gcs-validation-report.md`), com paths no formato
  `/replit-objstore-<uuid>/...`.
- Consumidores: upload/serve de **logos de restaurante**
  (`logoUploadRouter.ts`), **fotos de tela** (`telaPhotoRouter.ts`),
  **materiais de backoffice** (`backofficeMaterialRouter.ts`), fotos e
  comprovantes. Também há dependências client: `@uppy/*`, `@aws-sdk/client-s3`
  + `@aws-sdk/s3-request-presigner` (fluxo de presigned URL).
- Código mensura o próprio acoplamento: mensagem
  `"make sure you're running on Replit"` em `objectStorage.ts:293`.

### Segundo caminho de storage — proxy Forge/Manus
`server/storage.ts` implementa um **helper de storage alternativo** que usa o
proxy `BUILT_IN_FORGE_API_URL` (`/v1/storage/upload`, `/v1/storage/downloadUrl`)
— herança do template Manus. Coexiste com o Replit Object Storage; é preciso
confirmar qual está de fato em uso em produção. → **Ponto de incerteza.**

| Achado | Arquivo/linha | Risco | O que muda |
|---|---|---|---|
| Credencial GCS via sidecar Replit | `objectStorage.ts:12-31,281,293` | **Alto** | Reescrever para GCS com service account JSON (`GOOGLE_APPLICATION_CREDENTIALS`) **ou** trocar por S3/R2 (o AWS SDK já está instalado). Refatorar `objectStorageClient`. |
| Paths `replit-objstore-*` acoplados | envs + `docs/gcs-validation-report.md` | **Médio** | Redefinir `PUBLIC_OBJECT_SEARCH_PATHS`/`PRIVATE_OBJECT_DIR` para o novo bucket; migrar arquivos existentes. |
| Dois caminhos de storage (Replit vs Forge) | `storage.ts` vs `replit_integrations/` | **Médio** | Consolidar num só provedor durante a migração. |

---

## 6. Binding de rede e runtime

**Arquivos:** `server/_core/index.ts`, `package.json`, `.replit`, `replit.nix`

### Bind de rede — ✅ já portável
- `server/_core/index.ts:258,267`:
  `const preferredPort = parseInt(process.env.PORT || "5000")` e
  `server.listen(port, "0.0.0.0", ...)`.
- Usa `process.env.PORT` e faz bind em `0.0.0.0` — **padrão, não depende de
  Replit**. Há também um `findAvailablePort()` de fallback (dev). Mapeamento de
  portas externas (`5000→80`) hoje é feito pelo `.replit`; no destino isso vira
  responsabilidade do proxy/hosting.

### Runtime / `engines`
- **Não há campo `engines`** no `package.json`. A versão de Node vem só do
  `.replit` (`nodejs-20`). **Container atual roda Node v22.22.2** e
  **pnpm 10.4.1** (o `packageManager` fixa `pnpm@10.4.1`).
- ⚠️ **Divergência declarado vs. instalado:** `.replit` diz `nodejs-20`, o
  ambiente roda **Node 22**. Definir explicitamente a versão alvo (recomendo
  fixar via `engines` + `.nvmrc`/imagem base) para evitar surpresa fora do
  Replit. — **Risco: Médio.**

### Dependências nativas / específicas de SO
- **Playwright/Chromium** (`@playwright/test`) — precisa das libs gráficas que
  o `replit.nix` fornecia. Fora do Nix, instalar essas libs no host/imagem de
  CI (ou usar a imagem oficial do Playwright).
- **`sharp`** (processamento de imagem, binário nativo) — em `onlyBuilt`/deps
  transitivas; recompila por plataforma.
- **`esbuild`** (`onlyBuiltDependencies`), **`@tailwindcss/oxide`**,
  **`lightningcss`**, **`@rollup/rollup-linux-*`** — binários nativos
  com variantes `linux-x64-gnu`/`musl`. Cuidado ao mudar de distro
  (glibc vs musl/Alpine).
- `python-3.11` está nos módulos do `.replit`, mas **não há dependência de
  runtime Python** aparente da aplicação (provável resíduo de template).

| Achado | Risco | O que muda |
|---|---|---|
| Bind `0.0.0.0` + `PORT` | **Baixo** | Nada; já compatível. Só configurar `PORT` no host. |
| Sem `engines`; Node 20 (declarado) vs 22 (real) | **Médio** | Fixar versão de Node (engines/.nvmrc/Dockerfile). |
| Binários nativos (Chromium, sharp, esbuild, oxide, rollup, lightningcss) | **Médio** | Garantir instalação/compilação na plataforma/distro alvo (evitar Alpine/musl sem testar). |
| Portas externas via `.replit` | **Baixo** | Configurar no reverse-proxy/hosting. |

---

## 7. Build e deploy

**Arquivos:** `package.json` (scripts), `.replit` (`[deployment]`),
`scripts/*`, `vite.config.ts`, `playwright.config.ts`

### Processo atual
- **Build:** `vite build && esbuild server/_core/index.ts --platform=node --packages=external --bundle --format=esm --outfile=dist/index.js` (`package.json:8`). Vite gera `dist/public` (front); esbuild empacota o server em `dist/index.js`.
- **Start (prod):** `NODE_ENV=production node dist/index.js` (`package.json:9`).
- **Dev:** `NODE_ENV=development DEV_FIXTURES=1 tsx watch server/_core/index.ts`.
- **Deploy Replit:** `[deployment]` com `autoscale`, `build=npm run build`,
  `run=npm run start`, `publicDir=dist/public`.
- Scripts auxiliares: `scripts/pre-deploy.sh` (hoje manual — roda E2E),
  `scripts/validate-migrations.sh`, `scripts/check-schema-drift.ts`,
  `scripts/post-merge.sh`.

### Automação / CI-CD
- **Não há GitHub Actions** (`.github/` não existe). Nenhum workflow CI
  versionado.
- A automação hoje é **do Replit**: workflows em `.replit` (Start + schema-drift),
  `[postMerge]` hook → `scripts/post-merge.sh` (install + validate-migrations),
  e o botão **Publish** do Replit (o `docs/gcs-validation-report.md` observa que
  só o app principal/usuário consegue disparar o Publish).
- **Vite dev server** (`vite.config.ts`) tem `allowedHosts` fixos de domínios
  **Manus** (`.manus.computer`, `.manusvm.computer`, etc.) e plugins Manus
  (`vite-plugin-manus-runtime`, coletor de debug `/__manus__/logs`). Só afeta
  **dev**, mas precisa incluir o novo domínio de dev ou usar `allowedHosts: true`.

| Achado | Arquivo | Risco | O que muda |
|---|---|---|---|
| Build/start já padrão (vite+esbuild+node) | `package.json` | **Baixo** | Reaproveitável direto num Dockerfile/CI. |
| Deploy definido só no `.replit` (autoscale/Publish) | `.replit` | **Médio** | Recriar pipeline (Docker + provedor, ou CI → host). Boot roda `runMigrations()`. |
| Zero CI versionado (`.github` ausente) | — | **Médio** | Criar GitHub Actions (build, test, test:e2e, deploy). |
| `allowedHosts` e plugins Manus no Vite dev | `vite.config.ts` | **Baixo** | Adicionar domínio dev novo; avaliar remover plugins Manus. |
| E2E depende de banco de teste isolado + Chromium | `playwright.config.ts`, `e2e/*` | **Médio** | Prover `DATABASE_URL_TEST` e Chromium no CI. |

---

## 8. Achados Replit/Manus adicionais (fora da lista original)

- **`REPLIT_DEV_DOMAIN`** é usado como fallback de URL pública em dev
  (`server/_core/appUrl.ts:35`, `server/melhorEnvioRouter.ts`). Em produção o
  `appUrl()` já cai no hardcode `https://app.mesaads.com.br`, então o impacto é
  só em dev — mas a mensagem de erro do Melhor Envio ainda cita
  `REPLIT_DEV_DOMAIN`. — **Risco: Baixo.**
- **Domínio hardcoded de produção:** `https://app.mesaads.com.br`
  (`server/_core/appUrl.ts:1,32`) — **não** é domínio Replit; é o domínio real
  do produto. Manter, mas confirmar que continua válido pós-migração.
- **Referência a `*.replit.dev`/`*.replit.app`** em texto de **ajuda de UI**
  sobre restrição da chave do Google Maps
  (`client/src/pages/RestaurantsMap.tsx:328`). É instrução ao usuário, não
  configuração executável — atualizar o texto para o domínio novo. — **Risco:
  Baixo.**
- **Camada "Manus/Forge" inteira** (`server/_core/{llm,map,imageGeneration,voiceTranscription,dataApi}.ts`, `server/storage.ts`, `server/_core/env.ts`):
  proxy `forge.manus.im` autenticado por `BUILT_IN_FORGE_API_*`. Fallback de URL
  do LLM aponta para `https://forge.manus.im/v1/chat/completions`
  (`server/_core/llm.ts:214-215`). **Segundo acoplamento de plataforma**, tão ou
  mais crítico que o Replit para funcionalidades de IA/Maps/voz. Note que **já
  existe SDK Anthropic direto** (`server/anthropic.ts`, `ANTHROPIC_API_KEY`) e
  **uso direto do Google Maps** (`GOOGLE_MAPS_API_KEY`) — então há caminho para
  substituir o Forge por chaves próprias, mas exige reescrever esses módulos.
  — **Risco: Alto** para as features que dependem do Forge.
- **`javascript_log_in_with_replit`** consta como integração no `.replit`, mas o
  código de auth em produção é **Clerk** (`@clerk/express`, `@clerk/clerk-react`).
  O `loginMethod: "manus"` aparece em testes. Confirmar que **não** há caminho de
  login Replit ativo (aparentemente já 100% Clerk). — **Ver incerteza.**

---

## 9. Pontos de incerteza (confirmar manualmente)

1. **Volume de dados em produção** — não determinável pelo código. Rodar
   `pg_dump`/consultas de contagem no banco vivo para dimensionar a migração de
   dados.
2. **Provedor de banco de destino** — mantém **Neon** (só reaponta
   `DATABASE_URL`) ou migra para outro Postgres? Se migrar, é preciso trocar o
   driver `neon-serverless` por `pg`/`node-postgres`. Decisão de negócio.
3. **Storage de destino** — GCS com service account próprio (menor reescrita) ou
   S3/Cloudflare R2 (AWS SDK já instalado)? E **qual dos dois caminhos de storage
   está realmente em uso** hoje (Replit sidecar vs. proxy Forge em
   `server/storage.ts`)?
4. **Destino do proxy Forge/Manus** — substituir por chaves diretas
   (Anthropic/Google/serviço de voz) ou continuar consumindo `forge.manus.im`?
   Impacta LLM, Maps server-side, geração de imagem, transcrição de voz e "data
   API".
5. **Segredos comprometidos** — as chaves Clerk (test **e prod**) e o
   `PROD_DB_HOSTS` no `.replit` precisam ser rotacionados e removidos do
   histórico git. Confirmar quais outras chaves foram commitadas em algum ponto.
6. **`.env.example` inexistente** — o README o referencia, mas não existe. O
   inventário de envs desta auditoria (seção 3) é a melhor fonte atual; validar
   se falta alguma env provisionada só via painel do Replit (ex.:
   `DEFAULT_OBJECT_STORAGE_BUCKET_ID`, `OWNER_OPEN_ID`, `OAUTH_SERVER_URL`,
   `VITE_APP_ID`, `JWT_SECRET`, `MELHOR_ENVIO_*`, `RESEND_*`).
7. **Node 20 vs 22** — declarado `nodejs-20` no `.replit`, mas o ambiente roda
   Node 22. Confirmar em qual versão validar/rodar em produção.
8. **Login Replit** — a integração `javascript_log_in_with_replit` está
   declarada, mas o auth parece ser 100% Clerk. Confirmar que nenhum fluxo de
   login Replit está ativo antes de remover a integração.
9. **`check:schema-drift` / fluxo Publish** — a lógica de drift assume o Publish
   dev↔prod do Replit (`replit.md`). Confirmar como o schema será promovido para
   produção no novo pipeline.
10. **Buckets/paths existentes** (`replit-objstore-<uuid>`) — mapear os arquivos
    já armazenados que precisarão ser copiados para o novo bucket.

---

### Apêndice — arquivos inspecionados (amostra)
`.replit`, `replit.nix`, `replit.md`, `package.json`, `pnpm-lock.yaml`,
`drizzle.config.ts`, `drizzle/schema.ts`, `drizzle/*.sql`, `server/db.ts`,
`server/migrations.ts`, `server/_core/index.ts`, `server/_core/env.ts`,
`server/_core/appUrl.ts`, `server/_core/llm.ts`, `server/_core/map.ts`,
`server/_core/geocode.ts`, `server/storage.ts`, `server/anthropic.ts`,
`server/replit_integrations/**`, `server/melhorEnvioRouter.ts`,
`server/email.ts`, `vite.config.ts`, `tsconfig.json`, `playwright.config.ts`,
`scripts/*`, `README.md`, `.gitignore`, `docs/gcs-validation-report.md`.
</content>
</invoke>
