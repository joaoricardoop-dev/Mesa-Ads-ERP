# Glossário Financeiro — mesa.ads

Este documento define os termos canônicos usados em todo o módulo financeiro
(UI, API, schema, relatórios e auditoria). Sempre que houver dúvida sobre
nomenclatura, **este glossário é a fonte da verdade**.

> Refatoração financeira (finrefac) #1–#10 concluída. As colunas físicas do
> banco mantêm seus nomes históricos por compatibilidade — esta tabela mapeia
> cada **termo de negócio** à coluna real e ao componente de UI que o exibe.
> Veja também `docs/financeiro-fluxograma.md` para o ciclo completo.

---

## 1. Receita

| Termo de negócio | Definição | Coluna física | Onde aparece na UI |
|---|---|---|---|
| **Receita Bruta** | Valor total emitido na fatura, antes de qualquer dedução. | `invoices.amount` | Faturamento, DRE, dashboards |
| **Imposto sobre Receita** | Imposto calculado sobre a Receita Bruta (alíquota geral da campanha). | `campaigns.taxRate` (% aplicado a `invoices.amount`) | Relatório de comissão, DRE |
| **ISS Retido** | ISS retido pelo tomador (cliente) — sai do que recebemos. | `invoices.issRate` + `invoices.issRetained=true` | Faturamento, DRE |
| **Imposto Retido (cash)** | Valor em R$ efetivamente retido pelo cliente na nota. | `invoices.withheldTax` | Faturamento |
| **Receita Líquida** | Receita Bruta − Impostos retidos. **Calculada** em runtime via `NET_AMOUNT_SQL` (não persiste). | _computed_ | DRE, dashboards |
| **Recebimento** | Data em que o cliente efetivamente pagou a fatura. | `invoices.paymentDate` | Faturamento, conciliação |
| **Recebido em** | Data em que o pagamento caiu no extrato bancário (após reconciliação). | `invoices.receivedDate` | Faturamento ("Recebido em") |

## 2. Comissões e Repasses

| Termo de negócio | Definição | Coluna física | Onde aparece na UI |
|---|---|---|---|
| **Comissão Restaurante** | % devido ao restaurante pela veiculação em **bolacha física**. **Não se aplica** a produtos digitais (tela/janela VIP). | `campaigns.restaurantCommission` (%) → gera `restaurant_payments` | Pagamentos a Locais |
| **Repasse Restaurante** | Valor em R$ a pagar ao restaurante (calculado a partir da Comissão Restaurante). | `restaurantPayments.amount` | Pagamentos a Locais, Contas a Pagar |
| **Comissão Parceiro** | % devido ao parceiro indicador/agência sobre a base de cálculo definida (`bruto` ou `liquido`). Agregada por `(partnerId, competenceMonth)` no ledger. | `partners.commissionPercent` + `partners.billingMode` (ou `campaigns.agencyBvPercent` quando `hasAgencyBv=true`) | Comissão de Parceiros, Contas a Pagar, Portal Parceiro |
| **Comissão Vendedor** | % devido ao vendedor interno sobre a venda. | `campaigns.sellerCommission` | Relatório de comissão |
| **Repasse Sala VIP** | Valor pago ao provedor de sala VIP (aeroporto, lounge etc.) pela veiculação em telas/janelas digitais — **substitui** a comissão restaurante quando o produto é digital. | `vipProviders.commissionPercent` + `vipProviders.billingMode` → AP `sourceType='vip_repasse'` | Provedores Sala VIP, Contas a Pagar |
| **Comissão Agência** | % adicional para agência de propaganda (quando aplicável). | `quotations.agencyCommissionPercent` | Cotações |

## 3. Custos Operacionais

| Termo de negócio | Definição | Coluna física | Onde aparece na UI |
|---|---|---|---|
| **Custo de Produção** | Custo de fabricar/imprimir o material físico (bolachas). **Não se aplica** a produtos 100% digitais. | `operationalCosts.productionCost` (consolidado) e `campaigns.productionCost` (snapshot) → AP `sourceType='supplier_cost'` | Custos, Contas a Pagar |
| **Custo de Frete** | Frete do material da gráfica até os restaurantes. | `operationalCosts.freightCost` / `campaigns.freightCost` → AP `sourceType='freight_cost'` | Custos, Contas a Pagar |
| **Custo Operacional Total** | Custo de Produção + Frete por campanha. **Calculado**. | `productionCost + freightCost` | Custos, DRE |

## 4. Contas a Pagar (Ledger Único)

A tabela `accounts_payable` é o **ledger único** de saídas financeiras desde a
finrefac #2. Toda obrigação de pagamento — gerada por humano ou por
materializador automático — vive aqui. O glossário canônico de origens é
`accountsPayableSourceTypeEnum`:

| `sourceType` | Significado | Origem (materializador) |
|---|---|---|
| `restaurant_commission` | Repasse para restaurante por bolacha física vendida. | Espelhado de `restaurant_payments` (ver §2). |
| `vip_repasse` | Repasse para provedor Sala VIP em produto digital. | Materializador de `vip_providers` quando invoice é paga. |
| `supplier_cost` | Custo de produção (gráfica/fornecedor). Enum disponível, mas o sync atual de custos por campanha (`syncCampaignCostPayables`) ainda insere essas linhas usando apenas o campo legado `type='producao'` — o `sourceType` permanece com o default `manual`. Lançamentos manuais via `accountsPayable.create` podem definir `supplier_cost` explicitamente. |
| `freight_cost` | Frete (material → restaurantes). Mesma observação de `supplier_cost`: o sync por campanha usa `type='frete'` e default `manual`; ajustes manuais podem definir `freight_cost`. |
| `partner_commission` | Comissão de parceiro/agência, agregada por `(partnerId, competenceMonth)`. | Materializador disparado em `markInvoicePaid`. |
| `seller_commission` | Comissão de vendedor interno. Enum reservado; **ainda não há materializador em runtime** — registros são criados manualmente. |
| `tax` | Imposto a recolher derivado de uma fatura emitida. | Materializador disparado em `createInvoice` (causal: spec exige ≥1 AP `tax` com `invoiceId` setado). |
| `manual` | Despesa avulsa lançada por humano. | Lançada na UI de Contas a Pagar. |

| Coluna | Significado |
|---|---|
| `accountsPayable.amount` | Valor em R$ a pagar. |
| `accountsPayable.dueDate` | Data de vencimento. |
| `accountsPayable.paymentDate` | Data do pagamento efetivo. |
| `accountsPayable.status` | `pendente` \| `pago` \| `cancelada`. |
| `accountsPayable.recipientType` | `fornecedor` \| `parceiro` \| `vip_provider` \| `restaurante`. |
| `accountsPayable.proofUrl` | Link do comprovante de pagamento. |
| `accountsPayable.sourceType` | Enum acima — origem semântica. |
| `accountsPayable.sourceRef` | jsonb com ids da entidade-origem (ex.: `{restaurantPaymentId, invoiceId, partnerId, invoiceIds}`). |
| `accountsPayable.competenceMonth` | Mês de competência `YYYY-MM` para DRE. |
| `accountsPayable.invoiceId` | FK para a fatura que originou (quando aplicável). |
| `accountsPayable.createdBySystem` | `true` quando gerada por materializador, `false` quando por humano. |

> **Tipo `type` legado**: a coluna `accountsPayable.type` (`producao` \| `frete`
> \| `comissao` \| `repasse_vip` \| `outro`) ainda existe para compat com telas
> antigas, mas **`sourceType` é a fonte de verdade**. Migration
> `finrefac_02_accounts_payable_ledger_columns` mantém ambos sincronizados.

## 5. Faturas (Recebíveis)

| Status (`invoices.status`) | Significado |
|---|---|
| `emitida` | Fatura criada, aguardando pagamento. **Único status editável.** |
| `paga` | Cliente pagou (preencher `paymentDate`). |
| `vencida` | Passou da `dueDate` sem pagamento. |
| `cancelada` | Cancelada (não conta na receita). |

**Modo de faturamento (`invoices.billingType`):**
- `bruto` — fatura emitida pelo valor total cheio.
- `liquido` — fatura emitida apenas pela parte líquida (após repasse ao restaurante etc.).

**Lifecycle hooks (causais)**:
- `createInvoice` materializa pelo menos 1 AP `sourceType='tax'` vinculada via `invoiceId`.
- `markInvoicePaid` dispara, sob advisory lock idempotente, os materializadores
  de `partner_commission`, `vip_repasse` (apenas para itens de produto digital)
  e `restaurant_commission` (espelhando os `restaurant_payments` do mês).
- `bank.reconcile` em transação `credit` casando uma fatura → status vira `paga` + `receivedDate` recebe a data da transação.

## 6. Regra "Tela vs Bolacha"

| Condição | Comissão Restaurante | Custo Produção | Frete | Repasse Sala VIP |
|---|---|---|---|---|
| Produto físico (bolacha) | ✅ Devida | ✅ Devido | ✅ Devido | ❌ Não se aplica |
| Produto digital (tela/janela VIP) | ❌ **Pulada** | ❌ Pulado | ❌ Pulado | ✅ Devido ao provedor |

A regra é detectada pela função `isDigitalProduct(product)` em
`server/finance/calc.ts`, que considera o produto digital quando
`products.tipo` é `telas` ou `janelas_digitais`. Produtos digitais costumam
ter um `vipProviderId` associado para roteamento do repasse.

## 7. DRE (Dual)

A DRE é apresentada em duas visões, ambas configuráveis em
`users.preferences.dreRegime`:

1. **DRE Caixa** — entradas pelo `invoices.paymentDate`; saídas pelo
   `accountsPayable.paymentDate`.
2. **DRE Competência** — receita pelo `invoices.issueDate`; despesas pelo
   `accountsPayable.competenceMonth` (ou `dueDate` quando `competenceMonth` é
   nulo).

Ambas usam as definições deste glossário como fonte de verdade. O regime
selecionado é persistido por usuário e refletido em todos os cards do
dashboard financeiro (DSO, aging, funil cotação→fatura→recebido).

## 8. Conciliação Bancária

| Termo | Definição | Coluna física |
|---|---|---|
| **Conta Bancária** | Conta cadastrada no sistema para conciliação. | `bank_accounts` |
| **Transação Bancária** | Lançamento importado do extrato (CSV/OFX). | `bank_transactions` |
| **Conciliação 1↔1** | Match entre 1 transação e 1 fatura (crédito) ou 1 AP (débito). | `bank.reconcile` |
| **Conciliação 1↔N (multi)** | 1 transação cobrindo múltiplas faturas/APs (soma deve casar). | `matches[]` em `bank_transactions` |
| **Undo de conciliação** | Reverte para o estado anterior (status + receivedDate/paymentDate restaurados). | `bank.undoReconcile` (lê `prevStatus`/`prevReceivedDate`/`prevPaymentDate` salvos no match). |

Constraint: transação `credit` só pode conciliar `invoice`; `debit` só pode
conciliar `accounts_payable`. Soma dos matches tem de bater com o valor da
transação (tolerância R$ 0,01).

## 9. Trilha de Auditoria

A tabela `financial_audit_log` registra todas as mutações financeiras críticas
(`create`, `update`, `mark_paid`, `revert_payment`, `cancel`, `generate`, etc.)
com `before`/`after` e diff calculado pelo wrapper `audited()` em
`server/finance/audit.ts`. `entityType` suportados:
`invoice`, `accounts_payable`, `operational_cost`, `vip_provider`, `partner`,
`restaurant_payment`. Acessível via `financial.auditLog` (admin-only) e
`financial.auditLogActors` para popular filtros de UI.

## 10. KPIs e Indicadores

| Termo | Definição | Endpoint |
|---|---|---|
| **DSO** (Days Sales Outstanding) | Média de dias entre `issueDate` e `paymentDate` das faturas pagas na janela. | `financial.dso` |
| **Inadimplência por aging** | Buckets `0-30`, `30-60`, `60-90`, `90+` dias de atraso. | `financial.aging` |
| **Funil cotação→fatura→recebido** | Conversão por estágio. | `financial.funnel` |

---

_Última atualização: refatoração financeira #1–#10 concluída._
