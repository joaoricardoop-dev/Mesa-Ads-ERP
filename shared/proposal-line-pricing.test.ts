import { describe, expect, it } from "vitest";
import {
  computeProposalLinePrices,
  type ProposalLineItemInput,
} from "./proposal-line-pricing";

/** Soma dos totais das linhas, em centavos arredondados. */
function sumCents(lines: { totalPrice: number }[]): number {
  return lines.reduce((s, l) => s + Math.round(l.totalPrice * 100), 0);
}

describe("computeProposalLinePrices", () => {
  it("multi-produto com BV: linhas somam exatamente o total exibido", () => {
    const items: ProposalLineItemInput[] = [
      { volume: 1000, unitPrice: 2, totalPrice: 2000 },
      { volume: 500, unitPrice: 3, totalPrice: 1500 },
      { volume: 250, unitPrice: 4, totalPrice: 1000 },
    ];
    // rawTotal = 4500; total-alvo embute fator BV (ex.: comissão de parceiro).
    const targetTotal = 5400;

    const lines = computeProposalLinePrices(items, targetTotal);

    expect(sumCents(lines)).toBe(Math.round(targetTotal * 100));
    // unitPrice é coerente com o totalPrice escalado.
    for (const line of lines) {
      expect(line.unitPrice * line.volume).toBeCloseTo(line.totalPrice, 6);
    }
  });

  it("sem BV (target == rawTotal): preserva os valores crus", () => {
    const items: ProposalLineItemInput[] = [
      { volume: 1000, unitPrice: 2, totalPrice: 2000 },
      { volume: 500, unitPrice: 3, totalPrice: 1500 },
    ];
    const rawTotal = 3500;

    const lines = computeProposalLinePrices(items, rawTotal);

    expect(sumCents(lines)).toBe(Math.round(rawTotal * 100));
    expect(lines[0].totalPrice).toBeCloseTo(2000, 6);
    expect(lines[1].totalPrice).toBeCloseTo(1500, 6);
    expect(lines[0].unitPrice).toBeCloseTo(2, 6);
    expect(lines[1].unitPrice).toBeCloseTo(3, 6);
  });

  it("item único: a linha recebe o total-alvo inteiro", () => {
    const items: ProposalLineItemInput[] = [
      { volume: 800, unitPrice: 5, totalPrice: 4000 },
    ];
    const targetTotal = 4567.89;

    const lines = computeProposalLinePrices(items, targetTotal);

    expect(lines).toHaveLength(1);
    expect(sumCents(lines)).toBe(Math.round(targetTotal * 100));
    expect(lines[0].totalPrice).toBeCloseTo(targetTotal, 6);
    expect(lines[0].unitPrice).toBeCloseTo(targetTotal / 800, 6);
  });

  it("muitos itens com escala fracionária: fechamento de centavos exato", () => {
    // 7 itens iguais com total-alvo que não divide igualmente em centavos,
    // forçando a distribuição do resíduo por maior-resto.
    const items: ProposalLineItemInput[] = Array.from({ length: 7 }, () => ({
      volume: 10,
      unitPrice: 10,
      totalPrice: 100,
    }));
    const targetTotal = 1000.01; // 100001 centavos / 7 não é inteiro.

    const lines = computeProposalLinePrices(items, targetTotal);

    expect(lines).toHaveLength(7);
    // A soma fecha exatamente no total-alvo em centavos.
    expect(sumCents(lines)).toBe(Math.round(targetTotal * 100));
    // Nenhuma linha desvia mais de 1 centavo da fração ideal.
    const idealCents = Math.round((targetTotal / 7) * 100);
    for (const line of lines) {
      const diff = Math.abs(Math.round(line.totalPrice * 100) - idealCents);
      expect(diff).toBeLessThanOrEqual(1);
    }
  });

  it("rawTotal zero (bonificada/sem preço): soma fecha no total-alvo", () => {
    const items: ProposalLineItemInput[] = [
      { volume: 1000, unitPrice: 0, totalPrice: 0 },
      { volume: 500, unitPrice: 0, totalPrice: 0 },
    ];

    // Bonificada: total-alvo zero → todas as linhas zeram.
    const zeroLines = computeProposalLinePrices(items, 0);
    expect(sumCents(zeroLines)).toBe(0);
    for (const line of zeroLines) {
      expect(line.totalPrice).toBe(0);
    }

    // Caso degenerado: rawTotal zero mas total-alvo > 0 (scale=1, sem base
    // para distribuir) — a soma das linhas ainda deve fechar no alvo.
    const targetLines = computeProposalLinePrices(items, 300);
    expect(sumCents(targetLines)).toBe(Math.round(300 * 100));
  });

  it("lista vazia retorna vazio", () => {
    expect(computeProposalLinePrices([], 1000)).toEqual([]);
  });
});
