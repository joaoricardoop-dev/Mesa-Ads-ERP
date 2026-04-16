# Contexto — Mesa Ads ERP (app.mesaads.com.br)

**O que é o sistema**

Mesa Ads é uma plataforma de mídia OOH (Out-of-Home) que gerencia campanhas publicitárias veiculadas em locais parceiros (bares, restaurantes, cafeterias). O produto principal são porta-copos (coasters) com anúncios, além de telas digitais, displays, totens e ativações. O ERP controla todo o ciclo: prospecção → cotação → produção → distribuição → veiculação → relatório.

---

## Stack tecnológica

- **Frontend:** React 19 + Vite, TypeScript, TailwindCSS 4, shadcn/ui, Recharts
- **Roteamento:** Wouter (não é React Router)
- **Estado/dados:** tRPC + React Query (sem Redux, sem Context para dados remotos)
- **Backend:** Express + tRPC, Node.js
- **Banco:** PostgreSQL + Drizzle ORM
- **Auth:** Clerk
- **Upload de arquivos:** Uppy + presigned URLs S3
- **PDF:** jsPDF + jspdf-autotable com fontes base64 em `client/src/lib/pdf-assets.ts`
- **Notificações in-app:** tabela `notifications` + tRPC

---

## Estrutura de pastas relevantes

```
/client/src/pages/          — páginas (uma por rota)
/client/src/components/     — componentes reutilizáveis
/client/src/hooks/          — hooks (useBudgetCalculator.ts é o mais crítico)
/client/src/lib/            — utilitários, geradores de PDF
/server/                    — routers tRPC (um arquivo por domínio)
/drizzle/schema.ts          — schema completo do banco (fonte da verdade)
/server/db.ts               — funções de acesso ao banco
/server/routers.ts          — agrega todos os sub-routers
```

---

## Tipos de usuário e portais

| Role | Acesso |
|------|--------|
| admin, manager, comercial, operacoes, financeiro | Interface interna completa |
| anunciante | AnunciantePortal — campanhas e cotações próprias |
| parceiro | ParceiroPortal — leads, cotações, tabela de preços com BV |
| restaurante | RestaurantePortal — campanhas do local, termos, pagamentos |

O roteamento por role está em `client/src/App.tsx`. Portais externos têm seus próprios routers (`AnuncianteRouter`, `ParceiroRouter`, `RestauranteRouter`). O layout interno usa `DashboardLayout.tsx` com sidebar configurável.

---

## Conceitos de negócio críticos

### Precificação
Existem dois modos por produto: `cost_based` (markup sobre custo) e `price_based` (preço de tabela fixo). A função central é `calcUnitPriceAdv()` em `client/src/lib/campaign-builder-utils.ts`. O gross-up de BV é aplicado via fórmula `preço / (1 - BV - IRPJ)`. `BV_PADRAO_AGENCIA = 0.20` (20%) é a constante padrão. O preço público sempre embute este BV — quem fica com ele depende se há agência vinculada ao cliente.

### Produtos
Cadastrados em `products` com tiers de volume em `productPricingTiers`. Cada produto tem `tipo` (coaster, telas, display, totem, adesivo, porta_guardanapo, impressos, eletronicos, outro), `pricingMode`, `visibleToAdvertisers`, `visibleToPartners`. Produtos têm `distributionType`: `rede` (qualquer local) ou `local_especifico` (locais fixos via `productLocations`).

### Locais parceiros
Tabela `activeRestaurants` (label visual: "Locais"). Campos relevantes para cálculo de impressões: `monthlyCustomers`, `seatCount`, `tableCount`, `avgStayMinutes`. Sistema de rating com score calculado e tiers: bronze/prata/ouro/diamante.

### Impressões
Fórmula por tipo de produto, definida no cadastro do produto (`impressionFormulaType`): `por_coaster` usa `qtd × usos × pessoas_por_mesa × fator_atenção`; `por_tela` usa `clientes_por_dia × aparições_por_visita × fator_atenção`. Função centralizada: `calcImpressions()` em `useBudgetCalculator.ts`.

### Ciclo da campanha
Status em `campaignStatusEnum`: draft → briefing → design → aprovacao → producao → distribuicao → veiculacao → inativa. O workflow é dinâmico por produto — definido em `workflowSteps` (JSON) no cadastro do produto. Para telas: briefing → aprovacao_material → material_recebido → veiculacao → inativa.

### Cotações
`quotationStatusEnum`: rascunho → enviada → ativa → os_gerada → win/perdida/expirada. Ao marcar como `win` ou assinar a OS, a campanha é criada automaticamente. Multi-produto via `quotationItems`.

### Relatórios de campanha
Tabelas `campaignReports` e `campaignReportPhotos`. Criados pelo time interno, publicados ao anunciante via `publishedAt`. Visíveis no portal via `trpc.campaignReport.getForPortal`.

---

## Padrões de código que devem ser seguidos

- **Mutations tRPC:** `trpc.dominio.procedure.useMutation()` com `onSuccess: () => utils.dominio.list.invalidate()`
- **Queries:** `trpc.dominio.procedure.useQuery(input, { enabled: !!id })`
- **Toasts:** `import { toast } from "sonner"` — `toast.success()`, `toast.error()`
- **Formulários:** shadcn/ui `Input`, `Select`, `Label`, `Dialog`, `Sheet`
- **Datas:** string `YYYY-MM-DD` no banco, sem conversão de timezone
- **Dinheiro:** `decimal` no banco, `Number()` para cálculo, `toLocaleString("pt-BR", { style: "currency", currency: "BRL" })` para exibição
- **Novos routers:** criar em `server/nomeRouter.ts`, importar e registrar em `server/routers.ts`
- **Schema:** editar `drizzle/schema.ts`, rodar `npm run db:push`
- **Procedures:** `protectedProcedure` (staff), `adminProcedure`, `anuncianteProcedure`, `restauranteProcedure`, `comercialProcedure`, `internalProcedure`

---

## Arquivos mais importantes

| Arquivo | O que faz |
|---------|-----------|
| `drizzle/schema.ts` | Fonte da verdade do banco — ler antes de qualquer mudança |
| `server/routers.ts` | Registra todos os sub-routers tRPC |
| `client/src/App.tsx` | Todas as rotas e lógica de role |
| `client/src/hooks/useBudgetCalculator.ts` | Toda lógica de cálculo de preço e impressões |
| `client/src/lib/campaign-builder-utils.ts` | `calcUnitPriceAdv`, `BV_PADRAO_AGENCIA`, constantes de preço |
| `client/src/pages/CampaignDetail.tsx` | Página mais complexa — workflow, financeiro, distribuição |
| `client/src/pages/AnunciantePortal.tsx` | Portal do anunciante com shopping de produtos |
| `client/src/components/DashboardLayout.tsx` | Shell do app, sidebar, navegação |
| `client/src/lib/generate-proposal-pdf.ts` | Padrão de geração de PDF (replicar para novos PDFs) |

---

## O que NÃO fazer

- Não usar React Router — o projeto usa Wouter (`useLocation`, `useRoute`, `Switch`, `Route`)
- Não criar Context API para dados remotos — usar tRPC + React Query
- Não renomear tabelas do banco diretamente — sempre via schema + `npm run db:push`
- Não hardcodar strings de status — usar os valores exatos dos enums em `schema.ts`
- Não adicionar comentários explicativos de código — apenas comentários de "por quê" quando não óbvio
- Não criar arquivos de documentação `.md` sem pedido explícito
