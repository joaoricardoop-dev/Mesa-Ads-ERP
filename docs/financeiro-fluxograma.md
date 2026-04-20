# Fluxograma Financeiro — mesa.ads

Diagrama de referência do ciclo financeiro completo após a refatoração
(finrefac #1–#10). Para definição de cada termo, consulte
[`financeiro-glossario.md`](./financeiro-glossario.md).

---

## 1. Ciclo principal — Cotação → Recebimento

```mermaid
flowchart TD
  Q[Cotação<br/>quotations] -->|win + assinatura digital| C[Campanha<br/>campaigns]
  C -->|gera fases| OS[OS de Produção/Distribuição]
  OS -->|lança custos| AP_PROD[AP supplier_cost / freight_cost<br/>createdBySystem=true]

  C -->|emite NF| INV[Fatura<br/>invoices.status=emitida]
  INV -->|materializer<br/>createInvoice| AP_TAX[AP tax<br/>vinculado via invoiceId]

  INV -->|markInvoicePaid<br/>paymentDate| INV_PAGA[invoices.status=paga]
  INV_PAGA -->|materializer| AP_PARTNER[AP partner_commission<br/>agregado por mês]
  INV_PAGA -->|materializer<br/>se produto digital| AP_VIP[AP vip_repasse]
  INV_PAGA -->|materializer<br/>espelha pagamentos do mês| AP_REST[AP restaurant_commission]

  C -->|veiculação física| RP[restaurant_payments<br/>pendente]
  RP -->|mirror p/ ledger| AP_REST

  INV_PAGA -.->|opcional| BANK[Conciliação Bancária]
  AP_PROD -.->|opcional| BANK
  AP_REST -.->|opcional| BANK

  classDef ledger fill:#1f6f3a,stroke:#27d803,color:#fff
  classDef invoice fill:#0d3b66,stroke:#3aa0ff,color:#fff
  class AP_PROD,AP_TAX,AP_PARTNER,AP_VIP,AP_REST ledger
  class INV,INV_PAGA invoice
```

**Pontos-chave:**
- `accounts_payable` é o **ledger único**. Toda saída (humana ou automática)
  vive aqui com `sourceType` semântico.
- `createInvoice` tem garantia causal: ao menos 1 AP `tax` com `invoiceId` é
  criada. A spec `e2e/finance-invoice-lifecycle.spec.ts` valida.
- `markInvoicePaid` dispara dois materializadores idempotentes
  (`partner_commission`, `vip_repasse`) sob advisory lock por
  `(partnerId, competenceMonth)` para evitar lost-update.

---

## 2. Conciliação Bancária

```mermaid
flowchart LR
  EXT[Extrato CSV/OFX] -->|bank.confirmImport| TX[bank_transactions<br/>reconciled=false]
  TX -->|bank.reconcile<br/>1↔1 ou 1↔N| MATCH{Tipo da TX}

  MATCH -->|credit| INV2[invoices<br/>status=paga<br/>receivedDate=tx.date]
  MATCH -->|debit| AP2[accounts_payable<br/>status=pago<br/>paymentDate=tx.date]

  INV2 -->|undo| UNDO[Restaura prevStatus +<br/>prevReceivedDate]
  AP2 -->|undo| UNDO
  UNDO --> TX

  classDef ok fill:#1f6f3a,stroke:#27d803,color:#fff
  class INV2,AP2 ok
```

**Regras:**
- `credit` só concilia `invoice`; `debit` só concilia `accounts_payable`.
- Soma dos `matches` precisa bater com o valor da transação (tolerância R$ 0,01).
- `bank.undoReconcile` lê `prevStatus`, `prevReceivedDate`, `prevPaymentDate`
  salvos em cada match e restaura o estado anterior à conciliação.

---

## 3. DRE Dual (Competência vs Caixa)

```mermaid
flowchart TB
  subgraph Receita
    INV3[invoices]
    INV3 -->|regime=competencia| RC[issueDate]
    INV3 -->|regime=caixa| RX[paymentDate]
  end

  subgraph Despesa
    AP3[accounts_payable]
    AP3 -->|regime=competencia| DC[competenceMonth<br/>fallback: dueDate]
    AP3 -->|regime=caixa| DX[paymentDate]
  end

  RC --> DRE_C[DRE Competência]
  DC --> DRE_C
  RX --> DRE_X[DRE Caixa]
  DX --> DRE_X

  USR[users.preferences.dreRegime] -.->|escolhe| DRE_C
  USR -.->|escolhe| DRE_X
```

A escolha do regime persiste por usuário e propaga para todos os cards do
dashboard (DSO, aging 0-30/30-60/60-90/90+, funil, exportações CSV/PDF).

---

## 4. Auditoria

```mermaid
flowchart LR
  ACT[Mutação financeira<br/>create/update/mark_paid/<br/>revert_payment/reconcile] -->|wrapper audited()| AUD[audit_log]
  AUD -->|antes/depois + diff| UI[financial.listAuditLog]
```

Cobertura atual: `invoice`, `accounts_payable`, `restaurant_payment`,
`bank_transaction`. Diff é calculado pelo wrapper `audited()` em
`server/_finance/audit.ts` comparando `loadBefore` vs estado pós-mutação.

---

## 5. "Tela vs Bolacha" — bifurcação no materializador

```mermaid
flowchart TD
  PROD[products.tipo] -->|coaster / impressos / etc.| FIS[Comissão Restaurante<br/>+ Custo Produção<br/>+ Frete]
  PROD -->|telas / janelas_digitais| DIG[Repasse Sala VIP<br/>via vipProviders]
  FIS -.->|bolacha| AP_FIS[AP restaurant_commission +<br/>type=producao / type=frete]
  DIG -.->|tela/janela| AP_DIG[AP vip_repasse]
```

> Detecção em runtime: `isDigitalProduct()` em `server/finance/calc.ts`.

A regra é a única bifurcação no fluxo de materialização: produtos digitais
**pulam** comissão restaurante, custo de produção e frete; em vez disso,
geram repasse para o `vipProvider` vinculado.

---

_Última atualização: refatoração financeira #1–#10 concluída._
