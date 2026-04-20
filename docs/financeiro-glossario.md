# Glossário Financeiro — mesa.ads

Este documento define os termos canônicos usados em todo o módulo financeiro
(UI, API, schema e relatórios). Sempre que houver dúvida sobre nomenclatura, este
glossário é a fonte da verdade.

> Fase 1 da refatoração financeira. As colunas físicas do banco mantêm seus
> nomes atuais por compatibilidade — esta tabela mapeia cada **termo de negócio**
> à coluna real e ao componente de UI que o exibe.

---

## 1. Receita

| Termo de negócio | Definição | Coluna física | Onde aparece na UI |
|---|---|---|---|
| **Receita Bruta** | Valor total emitido na fatura, antes de qualquer dedução. | `invoices.amount` | Faturamento, DRE, dashboards |
| **Imposto sobre Receita** | Imposto calculado sobre a Receita Bruta (alíquota geral da campanha). | `campaigns.taxRate` (% aplicado a `invoices.amount`) | Relatório de comissão, DRE |
| **ISS Retido** | ISS retido pelo tomador (cliente) — sai do que recebemos. | `invoices.issRate` + `invoices.issRetained=true` | Faturamento, DRE |
| **Imposto Retido (cash)** | Valor em R$ efetivamente retido pelo cliente na nota. | `invoices.withheldTax` | Faturamento |
| **Receita Líquida** | Receita Bruta − Impostos retidos. **Calculado** em runtime via `NET_AMOUNT_SQL` (não persiste). | _computed_ | DRE, dashboards |
| **Recebimento** | Data em que o cliente efetivamente pagou a fatura. | `invoices.paymentDate` | Faturamento, conciliação |

## 2. Comissões e Repasses

| Termo de negócio | Definição | Coluna física | Onde aparece na UI |
|---|---|---|---|
| **Comissão Restaurante** | % devido ao restaurante pela veiculação em **bolacha física**. **Não se aplica** a produtos digitais (tela/janela VIP). | `campaigns.restaurantCommission` (%) → gera `restaurant_payments` | Pagamentos a Locais |
| **Repasse Restaurante** | Valor em R$ a pagar ao restaurante (calculado a partir da Comissão Restaurante). | `restaurantPayments.amount` | Pagamentos a Locais, Contas a Pagar |
| **Comissão Parceiro** | % devido ao parceiro indicador/agência sobre a base de cálculo definida (`bruto` ou `liquido`). | `partners.commissionPercent` + `partners.billingMode` | Comissão de Parceiros, Contas a Pagar |
| **Comissão Vendedor** | % devido ao vendedor interno sobre a venda. | `campaigns.sellerCommission` | Relatório de comissão |
| **Repasse Sala VIP** | Valor pago ao provedor de sala VIP (aeroporto, lounge etc.) pela veiculação em telas/janelas digitais — **substitui** a comissão restaurante quando o produto é digital. | `vipProviders.commissionPercent` + `vipProviders.billingMode` → gera `accountsPayable.type='repasse_vip'` | Provedores Sala VIP, Contas a Pagar |
| **Comissão Agência** | % adicional para agência de propaganda (quando aplicável). | `quotations.agencyCommissionPercent` | Cotações |

## 3. Custos Operacionais

| Termo de negócio | Definição | Coluna física | Onde aparece na UI |
|---|---|---|---|
| **Custo de Produção** | Custo de fabricar/imprimir o material físico (bolachas). **Não se aplica** a produtos 100% digitais. | `operationalCosts.productionCost` (consolidado) e `campaigns.productionCost` (snapshot) → `accountsPayable.type='producao'` | Custos, Contas a Pagar |
| **Custo de Frete** | Frete do material da gráfica até os restaurantes. | `operationalCosts.freightCost` / `campaigns.freightCost` → `accountsPayable.type='frete'` | Custos, Contas a Pagar |
| **Custo Operacional Total** | Custo de Produção + Frete por campanha. **Calculado**. | `productionCost + freightCost` | Custos, DRE |

## 4. Contas a Pagar (Ledger)

A tabela `accounts_payable` é o **ledger único** de saídas financeiras. Cada
título tem um `type` que indica a origem do compromisso:

| `type` | Significado | Origem |
|---|---|---|
| `producao` | Pagamento à gráfica/fornecedor pelo Custo de Produção. | Disparado ao registrar custo de produção. |
| `frete` | Pagamento da transportadora pelo frete. | Disparado ao registrar frete. |
| `comissao` | Repasse de comissão a parceiro/vendedor. | Disparado a partir de comissões devidas. |
| `repasse_vip` | Repasse ao provedor de Sala VIP (produto digital). | Disparado quando a campanha tem produto vinculado a `vipProviders`. |
| `outro` | Despesa avulsa. | Lançado manualmente. |

| Coluna | Significado |
|---|---|
| `accountsPayable.amount` | Valor em R$ a pagar. |
| `accountsPayable.dueDate` | Data de vencimento (quando é devido). |
| `accountsPayable.paymentDate` | Data do pagamento efetivo. |
| `accountsPayable.status` | `pendente` \| `pago` \| `cancelado`. |
| `accountsPayable.recipientType` | `fornecedor` \| `parceiro` \| `vip_provider` \| `restaurante`. |
| `accountsPayable.proofUrl` | Link do comprovante de pagamento. |

## 5. Faturas (Recebíveis)

| Status (`invoices.status`) | Significado |
|---|---|
| `emitida` | Fatura criada, ainda não enviada ao cliente. **Único status editável.** |
| `enviada` | Enviada ao cliente; aguardando pagamento. |
| `paga` | Cliente pagou (preencher `paymentDate`). |
| `vencida` | Passou da `dueDate` sem pagamento. |
| `cancelada` | Cancelada (não conta na receita). |

**Modo de faturamento (`invoices.billingType`):**
- `bruto` — fatura emitida pelo valor total cheio.
- `liquido` — fatura emitida apenas pela parte líquida (após repasse ao restaurante etc.).

## 6. Regra "Tela vs Bolacha"

| Condição | Comissão Restaurante | Custo Produção | Frete | Repasse Sala VIP |
|---|---|---|---|---|
| Produto físico (bolacha) | ✅ Devida | ✅ Devido | ✅ Devido | ❌ Não se aplica |
| Produto digital (tela/janela VIP) | ❌ **Pulada** | ❌ Pulado | ❌ Pulado | ✅ Devido ao provedor |

A regra é detectada por `products.deliveryMode` (`fisico` vs `digital`) e/ou
pela presença de `products.vipProviderId`.

---

## 7. DRE (Dual)

A DRE é apresentada em duas visões:

1. **DRE Caixa** — entradas e saídas pela data efetiva (`invoices.paymentDate`,
   `accountsPayable.paymentDate`).
2. **DRE Competência** — receita reconhecida pela `issueDate` da fatura;
   despesas pelo `dueDate` do título.

Ambas usam as definições deste glossário como fonte de verdade.

---

_Última atualização: refatoração financeira fase 1._
