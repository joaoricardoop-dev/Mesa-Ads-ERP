import { describe, it, expect } from "vitest";
import { assembleProposalData } from "./proposalData";

// Trava a regressão do "Período de veiculação" do PDF: cotações com itens
// derivam as semanas totais do período persistido (periodStart→periodEnd,
// convenção do builder: dias inclusivos, ceil/7). Cotações antigas sem
// periodEnd caem para a maior duração entre as linhas — nunca mais o default
// de 4 semanas (1 lote) que divergia do orçamento cadastrado.

const baseQuotation = {
  quotationName: "Build Atlas | 2 Cotas | Steak Mix",
  clientName: "EXITHUS",
  coasterVolume: 2,
  totalValue: "42563.66",
  cycles: null,
  periodStart: "2026-08-01",
  batchWeeks: 4,
} as any;

const circuitItems = [
  {
    productName: '02 Telas de 40"',
    quantity: 2,
    unitPrice: "21281.83",
    totalPrice: "42563.66",
    notes: '[CIRCUITO] 02 Telas de 40" @ MIX STEAK BAR · 53sem · 2cota · custo/sem 772.20 · desc 48%',
  },
] as any;

describe("assembleProposalData — semanas do período de veiculação", () => {
  it("deriva semanas de periodStart→periodEnd (convenção ceil/7 do builder)", () => {
    const data = assembleProposalData({
      quotation: { ...baseQuotation, periodEnd: "2027-08-01" },
      restaurants: [],
      items: circuitItems,
      billingSchedule: [],
    });
    // 01/08/2026 → 01/08/2027 = 366 dias inclusivos → ceil(366/7) = 53 semanas
    expect(data.semanas).toBe(53);
    expect(data.periodEnd).toBe("2027-08-01");
  });

  it("sem periodEnd (cotação antiga), usa a maior duração entre as linhas", () => {
    const data = assembleProposalData({
      quotation: { ...baseQuotation },
      restaurants: [],
      items: circuitItems,
      billingSchedule: [],
    });
    expect(data.semanas).toBe(53);
    expect(data.periodEnd).toBeUndefined();
  });

  it("sem itens, mantém o comportamento legado (cycles × 4)", () => {
    const data = assembleProposalData({
      quotation: { ...baseQuotation, cycles: 3 },
      restaurants: [],
      items: [],
      billingSchedule: [],
    });
    expect(data.semanas).toBe(12);
  });
});
