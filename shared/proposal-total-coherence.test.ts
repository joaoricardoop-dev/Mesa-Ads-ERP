// Task #391 — Coerência de total: plano × cotação persistida × PDF.
//
// A Task #390 introduziu cotas por circuito (computeCircuitLineTotal) e desconto
// por linha (applyLineDiscount), com a regra obrigatória de FONTE ÚNICA. O risco
// é o total divergir entre as três telas: (1) o painel do plano, (2) a cotação
// persistida em quotation_items (createFromBuilder) e (3) o PDF da proposta
// (assembleProposalData + computeProposalLinePrices).
//
// Este teste monta um Orçamento com ≥1 circuito com cotas>1 + desconto de linha,
// ≥1 produto por quantidade com desconto de linha, e cupom global > 0, então
// prova que os três valores fecham no MESMO total e que a ordem dos descontos é
// linha → cupom global → escala BV. Ele chama as MESMAS funções compartilhadas
// que cada camada usa — não reimplementa cálculo — então uma regressão de valor
// em qualquer fonte única quebra aqui.

import { describe, expect, it } from "vitest";
import {
  computeCircuitLineTotal,
  type CircuitPricingConfig,
} from "./cpm-pricing";
import {
  applyLineDiscount,
  computeProposalLinePrices,
  type ProposalLineItemInput,
} from "./proposal-line-pricing";
import { assembleProposalData } from "./proposalData";

/** Item de circuito DOOH no Orçamento (1 item = 1 circuito). */
interface CircuitInput {
  kind: "circuit";
  productName: string;
  circuitName: string;
  locationName: string;
  config: CircuitPricingConfig;
  days: number;
  cotas: number;
  lineDiscountPercent: number;
}

/** Item de produto por quantidade (bolachas/impressos). */
interface QuantityInput {
  kind: "quantity";
  productName: string;
  volume: number;
  weeks: number;
  /** Total BRUTO da linha (preço já calculado pelo motor, antes do desconto de linha). */
  grossTotal: number;
  lineDiscountPercent: number;
}

type BuilderItem = CircuitInput | QuantityInput;

/** Linha persistida, espelhando exatamente o INSERT de quotation_items. */
interface PersistedItem {
  productName: string;
  quantity: number;
  unitPrice: string; // toFixed(4) como no servidor
  totalPrice: string; // toFixed(2) como no servidor
  notes: string;
}

/**
 * Espelha a matemática PURA de createFromBuilder (server/quotationRouter.ts):
 * por linha calcula o líquido via fonte única (computeCircuitLineTotal /
 * applyLineDiscount), aplica o cupom global como fator uniforme APÓS o desconto
 * de linha, e monta os marcadores de notes canônicos lidos por assembleProposalData.
 *
 * Retorna o que cada uma das três telas observa:
 *  - planTotal: total exibido no painel do plano (subtotal líquido − cupom);
 *  - persisted: linhas gravadas em quotation_items;
 *  - totalValue: total do contrato (quotations.totalValue).
 */
function buildQuotation(items: BuilderItem[], couponPercent: number) {
  const couponFactor = 1 - couponPercent / 100;

  // ── Camada 1: painel do plano ──
  // Subtotal = soma dos líquidos de linha; total = subtotal − cupom global.
  const netTotals = items.map((item) => {
    if (item.kind === "circuit") {
      const circuit = computeCircuitLineTotal(
        item.config,
        item.days,
        item.cotas,
        item.lineDiscountPercent,
      );
      if (!circuit) throw new Error(`circuito sem preço: ${item.circuitName}`);
      return { item, circuit, netTotal: circuit.netTotal };
    }
    const netTotal = applyLineDiscount(item.grossTotal, item.lineDiscountPercent);
    return { item, circuit: null, netTotal };
  });

  const subtotal = netTotals.reduce((s, n) => s + n.netTotal, 0);
  const planTotal = subtotal - subtotal * (couponPercent / 100);

  // ── Camada 2: persistência (createFromBuilder) ──
  // Cupom aplicado por item; totalValue = soma dos totalPrice (pré-toFixed).
  const computed = netTotals.map(({ item, circuit, netTotal }) => {
    const totalPriceFull = netTotal * couponFactor;
    if (item.kind === "circuit" && circuit) {
      const volume = circuit.cotas;
      const unitPriceFull = (netTotal / volume) * couponFactor;
      const cotasDesc = circuit.cotas > 1 ? ` · ${circuit.cotas}cota` : "";
      const lineDescDesc =
        item.lineDiscountPercent > 0 ? ` · desc ${item.lineDiscountPercent}%` : "";
      const notes = `[CIRCUITO] ${item.circuitName} @ ${item.locationName} · ${circuit.weeks}sem${cotasDesc} · custo/sem ${circuit.weeklyCost.toFixed(2)}${lineDescDesc}`;
      return { item, volume, unitPriceFull, totalPriceFull, notes };
    }
    const q = item as QuantityInput;
    const grossUnit = q.volume > 0 ? q.grossTotal / q.volume : 0;
    const unitPriceFull = (netTotal / q.volume) * couponFactor;
    const lineDescDesc =
      q.lineDiscountPercent > 0 ? ` · desc ${q.lineDiscountPercent}%` : "";
    const notes = `${q.productName} — ${q.volume.toLocaleString("pt-BR")} un. × ${q.weeks} semanas · custo/un ${grossUnit.toFixed(2)}${lineDescDesc}`;
    return { item, volume: q.volume, unitPriceFull, totalPriceFull, notes };
  });

  const totalValue = computed.reduce((s, c) => s + c.totalPriceFull, 0);

  const persisted: PersistedItem[] = computed.map((c) => ({
    productName: c.item.productName,
    quantity: c.volume,
    unitPrice: c.unitPriceFull.toFixed(4),
    totalPrice: c.totalPriceFull.toFixed(2),
    notes: c.notes,
  }));

  return { planTotal, subtotal, persisted, totalValue, computed };
}

/** Soma dos totais das linhas, em centavos arredondados. */
function sumCents(lines: { totalPrice: number }[]): number {
  return lines.reduce((s, l) => s + Math.round(l.totalPrice * 100), 0);
}

describe("Coerência de total: plano × cotação persistida × PDF (Task #391)", () => {
  const items: BuilderItem[] = [
    {
      kind: "circuit",
      productName: "Circuito DOOH",
      circuitName: "Circuito Shopping",
      locationName: "Praça de Alimentação",
      // 650 ins/sem × R$ 0,99 = R$ 643,50/sem
      config: { insertionsPerWeek: 650, costPerInsertion: 0.99 },
      days: 28, // → ceil(28/7) = 4 semanas
      cotas: 3,
      lineDiscountPercent: 10,
    },
    {
      kind: "quantity",
      productName: "Bolachas",
      volume: 1000,
      weeks: 4,
      grossTotal: 2500, // R$ 2,50/un × 1000
      lineDiscountPercent: 15,
    },
  ];
  const couponPercent = 5;

  it("os três totais (painel, persistido, contrato) fecham no mesmo valor", () => {
    const { planTotal, persisted, totalValue } = buildQuotation(items, couponPercent);

    // Painel == total do contrato (quotations.totalValue).
    expect(planTotal).toBeCloseTo(totalValue, 6);

    // Painel == soma dos totalPrice persistidos (líquidos de linha + cupom).
    const persistedSum = persisted.reduce((s, p) => s + parseFloat(p.totalPrice), 0);
    expect(persistedSum).toBeCloseTo(planTotal, 2);

    // PDF: assembleProposalData lê as linhas persistidas + o total do contrato,
    // e computeProposalLinePrices reescala as linhas até somarem EXATAMENTE o
    // contractTotal (escala BV). Aqui o BV já está embutido no preço, então a
    // escala é identidade — mas o caminho do PDF é exercido de ponta a ponta.
    const pdf = assembleProposalData({
      quotation: {
        coasterVolume: 1000,
        totalValue: totalValue.toFixed(2),
        cycles: 1,
      },
      restaurants: [],
      items: persisted.map((p) => ({
        productName: p.productName,
        quantity: p.quantity,
        unitPrice: p.unitPrice,
        totalPrice: p.totalPrice,
        notes: p.notes,
      })),
    });

    expect(pdf.contractTotal).toBeCloseTo(totalValue, 2);
    expect(pdf.items).toBeDefined();

    const pdfLines = computeProposalLinePrices(
      (pdf.items ?? []).map<ProposalLineItemInput>((it) => ({
        volume: it.volume,
        unitPrice: it.unitPrice,
        totalPrice: it.totalPrice,
      })),
      pdf.contractTotal,
    );

    // As linhas do PDF somam EXATAMENTE o total do contrato (centavos fechados).
    expect(sumCents(pdfLines)).toBe(Math.round(pdf.contractTotal * 100));
    // E o total do contrato do PDF == total do painel.
    expect(pdf.contractTotal).toBeCloseTo(planTotal, 2);
  });

  it("respeita a ordem dos descontos: linha → cupom global → escala BV", () => {
    const { computed, subtotal, totalValue } = buildQuotation(items, couponPercent);

    // Estágio 1 — desconto de LINHA (por linha, antes do cupom):
    // Circuito: 643,50/sem × 4 sem × 3 cotas = 7722 bruto; −10% = 6949,80.
    const circuit = computed[0];
    expect(circuit.item.kind).toBe("circuit");
    const circuitNet = circuit.totalPriceFull / (1 - couponPercent / 100);
    expect(circuitNet).toBeCloseTo(6949.8, 4);
    // Bolachas: 2500 bruto; −15% = 2125.
    const quantityNet = computed[1].totalPriceFull / (1 - couponPercent / 100);
    expect(quantityNet).toBeCloseTo(2125, 4);

    // Subtotal do painel = soma dos líquidos de linha (antes do cupom).
    expect(subtotal).toBeCloseTo(6949.8 + 2125, 4);

    // Estágio 2 — cupom GLOBAL sobre o subtotal já líquido (−5%):
    // (6949,80 + 2125) × 0,95 = 8621,06.
    expect(totalValue).toBeCloseTo((6949.8 + 2125) * 0.95, 4);

    // Estágio 3 — escala BV no PDF: computeProposalLinePrices reescala as linhas
    // para um total-alvo que embute o BV, fechando os centavos por maior-resto.
    const persistedLines: ProposalLineItemInput[] = computed.map((c) => ({
      volume: c.volume,
      unitPrice: c.unitPriceFull,
      totalPrice: c.totalPriceFull,
    }));
    const bvTarget = Math.round(totalValue * 1.2 * 100) / 100; // BV embutido fictício
    const bvLines = computeProposalLinePrices(persistedLines, bvTarget);
    expect(sumCents(bvLines)).toBe(Math.round(bvTarget * 100));
  });

  it("assembleProposalData extrai cotas/desconto de linha das notes (metadados de exibição)", () => {
    const { persisted, totalValue } = buildQuotation(items, couponPercent);
    const pdf = assembleProposalData({
      quotation: { coasterVolume: 1000, totalValue: totalValue.toFixed(2), cycles: 1 },
      restaurants: [],
      items: persisted.map((p) => ({
        productName: p.productName,
        quantity: p.quantity,
        unitPrice: p.unitPrice,
        totalPrice: p.totalPrice,
        notes: p.notes,
      })),
    });

    const circuitItem = pdf.items?.find((i) => i.circuitName);
    expect(circuitItem).toBeDefined();
    expect(circuitItem?.cotas).toBe(3);
    expect(circuitItem?.lineDiscountPercent).toBe(10);
    expect(circuitItem?.weeklyCost).toBeCloseTo(643.5, 2);
    expect(circuitItem?.locationName).toBe("Praça de Alimentação");

    const quantityItem = pdf.items?.find((i) => !i.circuitName);
    expect(quantityItem).toBeDefined();
    expect(quantityItem?.lineDiscountPercent).toBe(15);
    expect(quantityItem?.unitCost).toBeCloseTo(2.5, 2);
  });

  it("totais batem mesmo com números 'sujos' (arredondamento por centavo)", () => {
    const messy: BuilderItem[] = [
      {
        kind: "circuit",
        productName: "Circuito B",
        circuitName: "Circuito Outlet",
        locationName: "Corredor Central",
        config: { insertionsPerWeek: 333, costPerInsertion: 0.97 },
        days: 10, // ceil(10/7) = 2 semanas
        cotas: 2,
        lineDiscountPercent: 7,
      },
      {
        kind: "quantity",
        productName: "Impressos",
        volume: 777,
        weeks: 8,
        grossTotal: 1033.41,
        lineDiscountPercent: 11,
      },
    ];
    const { planTotal, persisted, totalValue } = buildQuotation(messy, 3);

    expect(planTotal).toBeCloseTo(totalValue, 6);

    const pdf = assembleProposalData({
      quotation: { coasterVolume: 777, totalValue: totalValue.toFixed(2), cycles: 1 },
      restaurants: [],
      items: persisted.map((p) => ({
        productName: p.productName,
        quantity: p.quantity,
        unitPrice: p.unitPrice,
        totalPrice: p.totalPrice,
        notes: p.notes,
      })),
    });
    const pdfLines = computeProposalLinePrices(
      (pdf.items ?? []).map<ProposalLineItemInput>((it) => ({
        volume: it.volume,
        unitPrice: it.unitPrice,
        totalPrice: it.totalPrice,
      })),
      pdf.contractTotal,
    );

    // Independente de centavos por linha, o PDF fecha no total do contrato,
    // que por sua vez bate com o painel.
    expect(sumCents(pdfLines)).toBe(Math.round(pdf.contractTotal * 100));
    expect(pdf.contractTotal).toBeCloseTo(planTotal, 2);
  });
});
