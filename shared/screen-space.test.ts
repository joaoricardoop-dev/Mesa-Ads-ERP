import { describe, it, expect } from "vitest";
import {
  deriveScreenSpace,
  telaWeeklyInsertions,
  telaSpacePendencias,
  TELA_PENDENCIA_LABELS,
  type TelaSpaceInput,
} from "./screen-space";

// Grade de 10 horas (seg 8h–17h)
const hours10 = Array.from({ length: 10 }, (_, i) => `1-${8 + i}`);
// Grade de 5 horas (ter 10h–14h)
const hours5 = Array.from({ length: 5 }, (_, i) => `2-${10 + i}`);

function tela(overrides: Partial<TelaSpaceInput> = {}): TelaSpaceInput {
  return {
    id: 1,
    nome: "Tela A",
    status: "active",
    loopDuration: 120, // 3600/120 = 30 inserções/hora
    insertionsPerWeek: null,
    costPerInsertion: "1.00",
    impactsPerInsertion: "30.00",
    screenOperatingHours: hours10,
    ...overrides,
  };
}

describe("telaWeeklyInsertions", () => {
  it("deriva de loop × horas da grade", () => {
    expect(telaWeeklyInsertions(tela())).toBe(300); // 30/h × 10h
  });
  it("cai no insertionsPerWeek quando falta loop/grade", () => {
    expect(telaWeeklyInsertions(tela({ loopDuration: null, insertionsPerWeek: 500 }))).toBe(500);
    expect(
      telaWeeklyInsertions(tela({ screenOperatingHours: [], insertionsPerWeek: 500 })),
    ).toBe(500);
  });
  it("null quando nenhuma origem disponível", () => {
    expect(telaWeeklyInsertions(tela({ loopDuration: null, insertionsPerWeek: null }))).toBeNull();
  });
});

describe("telaSpacePendencias", () => {
  it("vazio quando completa", () => {
    expect(telaSpacePendencias(tela())).toEqual([]);
  });
  it("lista o que falta", () => {
    const missing = telaSpacePendencias(
      tela({ loopDuration: null, insertionsPerWeek: null, screenOperatingHours: [], costPerInsertion: null, impactsPerInsertion: null }),
    );
    expect(missing).toContain(TELA_PENDENCIA_LABELS.insertions);
    expect(missing).toContain(TELA_PENDENCIA_LABELS.schedule);
    expect(missing).toContain(TELA_PENDENCIA_LABELS.cost);
    expect(missing).toContain(TELA_PENDENCIA_LABELS.impacts);
  });
});

describe("deriveScreenSpace", () => {
  it("null sem telas ativas (modo manual)", () => {
    expect(deriveScreenSpace([])).toBeNull();
    expect(deriveScreenSpace(null)).toBeNull();
    expect(deriveScreenSpace([tela({ status: "inactive" })])).toBeNull();
  });

  it("ignora telas inativas", () => {
    const d = deriveScreenSpace([tela(), tela({ id: 2, status: "inactive" })]);
    expect(d?.screensCount).toBe(1);
  });

  it("uma tela completa deriva tudo", () => {
    const d = deriveScreenSpace([tela()])!;
    expect(d.screensCount).toBe(1);
    expect(d.weeklyHours).toBe(10);
    expect(d.weeklyInsertions).toBe(300);
    expect(d.insertionsPerHour).toBe(30);
    expect(d.costPerInsertion).toBe(1);
    expect(d.impactsPerInsertion).toBe(30);
    expect(d.cpm).toBeCloseTo((1 * 1000) / 30, 6);
    expect(d.pendencias).toEqual([]);
    expect(d.isComplete).toBe(true);
  });

  it("duas telas: união de grades + médias ponderadas por inserções", () => {
    // Tela A: 30/h × 10h = 300 ins/sem, custo 1.00, impactos 30
    // Tela B: loop 60s → 60/h × 5h = 300 ins/sem, custo 2.00, impactos 60
    const d = deriveScreenSpace([
      tela(),
      tela({ id: 2, nome: "Tela B", loopDuration: 60, costPerInsertion: "2.00", impactsPerInsertion: "60.00", screenOperatingHours: hours5 }),
    ])!;
    expect(d.screensCount).toBe(2);
    expect(d.weeklyHours).toBe(15); // grades disjuntas
    expect(d.weeklyInsertions).toBe(600);
    expect(d.insertionsPerHour).toBe(40); // 600/15
    expect(d.costPerInsertion).toBeCloseTo(1.5); // (300×1 + 300×2)/600
    expect(d.impactsPerInsertion).toBeCloseTo(45); // (300×30 + 300×60)/600
    expect(d.cpm).toBeCloseTo((1.5 * 1000) / 45, 6);
    expect(d.isComplete).toBe(true);
  });

  it("união deduplica grades sobrepostas", () => {
    const d = deriveScreenSpace([tela(), tela({ id: 2, screenOperatingHours: hours10 })])!;
    expect(d.weeklyHours).toBe(10);
  });

  it("média parcial rejeitada: falta custo em UMA tela → custo e CPM null", () => {
    const d = deriveScreenSpace([tela(), tela({ id: 2, nome: "Tela B", costPerInsertion: null })])!;
    expect(d.costPerInsertion).toBeNull();
    expect(d.cpm).toBeNull();
    expect(d.impactsPerInsertion).not.toBeNull();
    expect(d.isComplete).toBe(false);
    expect(d.pendencias).toHaveLength(1);
    expect(d.pendencias[0].nome).toBe("Tela B");
    expect(d.pendencias[0].missing).toContain(TELA_PENDENCIA_LABELS.cost);
  });

  it("falta inserções em UMA tela → tudo dependente de inserções vira null", () => {
    const d = deriveScreenSpace([
      tela(),
      tela({ id: 2, loopDuration: null, insertionsPerWeek: null, screenOperatingHours: hours5 }),
    ])!;
    expect(d.weeklyInsertions).toBeNull();
    expect(d.insertionsPerHour).toBeNull();
    expect(d.costPerInsertion).toBeNull();
    expect(d.impactsPerInsertion).toBeNull();
    expect(d.cpm).toBeNull();
    expect(d.isComplete).toBe(false);
  });

  it("aceita valores decimais como string (colunas numeric)", () => {
    const d = deriveScreenSpace([tela({ costPerInsertion: "0.99", impactsPerInsertion: "33.04" })])!;
    expect(d.costPerInsertion).toBeCloseTo(0.99);
    expect(d.impactsPerInsertion).toBeCloseTo(33.04);
  });
});
