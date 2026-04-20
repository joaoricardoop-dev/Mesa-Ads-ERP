# Mesa Ads ERP

ERP financeiro e operacional da mesa.ads — empresa brasileira de mídia
offline focada em publicidade em bolachas de chopp.

## Stack

- **Frontend**: React 19 + Vite + Tailwind 4 + shadcn/ui + tRPC client + TanStack Query
- **Backend**: Node.js + Express + tRPC + Drizzle ORM
- **Banco**: PostgreSQL (Neon serverless)
- **Auth**: Replit Auth (OIDC)
- **Storage**: Replit Object Storage (logos, comprovantes, contratos)
- **AI**: Anthropic SDK (`claude-sonnet-4`)

## Estrutura

```
client/      Frontend React + Vite
server/      Backend Express + tRPC
  _core/     bootstrap, sessões, dev-fixtures
  _finance/  audit wrapper, materializadores
  finance/   cálculos puros (taxes, comissões)
shared/      tipos e constantes compartilhadas
drizzle/     schema + migrations geradas
docs/        documentação operacional
e2e/         testes Playwright
```

## Rodando

```bash
pnpm install
pnpm run dev          # workflow "Start application"
pnpm run test:e2e     # suíte Playwright completa
```

Variáveis de ambiente vivem nos secrets do Replit
(`VITE_GOOGLE_MAPS_API_KEY`, etc.). Veja `.env.example` se necessário.

## Financeiro

A camada financeira passou por uma refatoração completa em 10 fases
(finrefac #1–#10) que unificou todas as obrigações de pagamento em um
**ledger único** (`accounts_payable`) com origem semântica tipada
(`sourceType`), introduziu materializadores idempotentes para comissões e
impostos, conciliação bancária, trilha de auditoria e DRE dual
(competência/caixa).

Para entender o sistema:

- [`docs/financeiro-glossario.md`](docs/financeiro-glossario.md) — definição
  canônica de cada termo financeiro, mapeamento para colunas do banco e
  enum de origens (`sourceType`) do ledger.
- [`docs/financeiro-fluxograma.md`](docs/financeiro-fluxograma.md) —
  diagramas Mermaid do ciclo Cotação → Fatura → Materialização de Payables
  → Conciliação Bancária → DRE.

Pontos-chave para um novo contador:

1. **Toda saída financeira vive em `accounts_payable`** com `sourceType`
   identificando a origem (`tax`, `partner_commission`, `restaurant_commission`,
   `vip_repasse`, `supplier_cost`, `freight_cost`, `seller_commission`,
   `manual`).
2. **Receita** vem de `invoices`. `createInvoice` materializa AP de imposto;
   `markInvoicePaid` materializa comissões (parceiro, restaurante e — para
   produtos digitais — repasse VIP) sob advisory lock idempotente.
3. **"Tela vs Bolacha"**: produtos digitais pulam comissão restaurante,
   produção e frete — geram repasse VIP em vez disso.
4. **DRE dual**: cada usuário escolhe regime (caixa ou competência) e a
   preferência persiste em `users.preferences`.
5. **Conciliação bancária**: importa CSV/OFX → casa transações com
   faturas (crédito) ou APs (débito). Suporta undo.
6. **Auditoria**: toda mutação financeira passa por `audited()` e grava
   antes/depois em `audit_log`.

## Testes E2E

`e2e/` contém specs Playwright cobrindo:

- Checkout aberto (`/montar-campanha`) — visitante e usuário interno.
- Suíte financeira (`finance-*.spec.ts`):
  - `finance-invoice-lifecycle` — emit → pay → DSO + AP `tax` materializada.
  - `finance-bank-reconciliation` — emit → CSV → reconcile → invoice paga.
  - `finance-restaurant-portal` — admin marca pagamento → restaurante vê.
  - `finance-partner-portal` — comissão materializa por competência.
  - `finance-audit-trail` — create + update gera entradas com diff.
  - `finance-dre-dual` — competência vs caixa divergem por mês.

Roda com `pnpm run test:e2e`. CI requer **todas as specs sem skip**.

## Deploy

`scripts/pre-deploy.sh` roda os testes Playwright antes do build de
produção. Falha em qualquer spec aborta o deploy.
