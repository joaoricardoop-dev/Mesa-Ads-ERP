import { describe, it, expect, vi, afterEach } from "vitest";
import { businessToday, mondayOfISO } from "./backofficeRouter";

// Garante que o "hoje" do checklist/checks segue America/Sao_Paulo:
// entre 21:00 e 23:59 locais, o dia UTC já virou, mas o dia do negócio não.
describe("businessToday (America/Sao_Paulo)", () => {
  afterEach(() => vi.useRealTimers());

  it("não vira o dia junto com o UTC (22:30 local = 01:30 UTC do dia seguinte)", () => {
    vi.useFakeTimers();
    // 2026-08-01T01:30:00Z == 2026-07-31 22:30 em São Paulo (UTC-3)
    vi.setSystemTime(new Date("2026-08-01T01:30:00Z"));
    expect(new Date().toISOString().slice(0, 10)).toBe("2026-08-01"); // UTC já virou
    expect(businessToday()).toBe("2026-07-31"); // negócio ainda não
  });

  it("bate com o UTC durante o horário comercial", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-07-31T15:00:00Z")); // 12:00 em SP
    expect(businessToday()).toBe("2026-07-31");
  });

  it("23:59 local ainda é o mesmo dia; 00:00 local vira", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-08-01T02:59:00Z")); // 23:59 SP
    expect(businessToday()).toBe("2026-07-31");
    vi.setSystemTime(new Date("2026-08-01T03:00:00Z")); // 00:00 SP
    expect(businessToday()).toBe("2026-08-01");
  });
});

describe("mondayOfISO", () => {
  it("retorna a segunda-feira da semana (Seg–Dom)", () => {
    expect(mondayOfISO("2026-07-31")).toBe("2026-07-27"); // sexta
    expect(mondayOfISO("2026-07-27")).toBe("2026-07-27"); // segunda
    expect(mondayOfISO("2026-08-02")).toBe("2026-07-27"); // domingo fecha a semana
    expect(mondayOfISO("2026-08-03")).toBe("2026-08-03"); // nova semana
  });
});
