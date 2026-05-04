import { describe, expect, it, vi } from "vitest";
import {
  formatNumber,
  nextCounterValue,
  nextNumber,
  type CounterScope,
} from "./numberCounter";

function makeFakeDb(replies: Array<unknown>) {
  const calls: Array<{ query: unknown }> = [];
  const queue = [...replies];
  return {
    calls,
    db: {
      execute: vi.fn(async (query: unknown) => {
        calls.push({ query });
        if (queue.length === 0) {
          throw new Error("[fakeDb] no more queued replies");
        }
        return queue.shift();
      }),
    },
  };
}

describe("formatNumber", () => {
  it("zero-pads to 4 digits and uses scope prefix", () => {
    expect(formatNumber("campaign", 2026, 1)).toBe("CMP-2026-0001");
    expect(formatNumber("invoice", 2026, 42)).toBe("FAT-2026-0042");
    expect(formatNumber("quotation", 2025, 9999)).toBe("QOT-2025-9999");
  });

  it("does not truncate values with more than 4 digits", () => {
    expect(formatNumber("campaign", 2026, 12345)).toBe("CMP-2026-12345");
  });

  it("uses the OS-* prefixes for service orders", () => {
    expect(formatNumber("os_anunciante", 2026, 7)).toBe("OS-ANT-2026-0007");
    expect(formatNumber("os_producao", 2026, 7)).toBe("OS-PROD-2026-0007");
    expect(formatNumber("os_distribuicao", 2026, 7)).toBe("OS-DIST-2026-0007");
  });
});

describe("nextCounterValue", () => {
  it("returns the integer from { rows: [{ next_value }] } (neon shape)", async () => {
    const fake = makeFakeDb([{ rows: [{ next_value: 1 }] }]);
    const v = await nextCounterValue(fake.db, "campaign", 2026);
    expect(v).toBe(1);
    expect(fake.db.execute).toHaveBeenCalledTimes(1);
  });

  it("supports the array-direct shape some drivers return", async () => {
    const fake = makeFakeDb([[{ next_value: 17 }]]);
    const v = await nextCounterValue(fake.db, "invoice", 2026);
    expect(v).toBe(17);
  });

  it("parses string-encoded bigints (pg returns bigint as string)", async () => {
    const fake = makeFakeDb([{ rows: [{ next_value: "42" }] }]);
    const v = await nextCounterValue(fake.db, "quotation", 2026);
    expect(v).toBe(42);
  });

  it("throws a descriptive error when the driver returns no rows", async () => {
    const fake = makeFakeDb([{ rows: [] }]);
    await expect(nextCounterValue(fake.db, "campaign", 2026)).rejects.toThrow(
      /Falha ao obter próximo valor.*scope=campaign.*year=2026/,
    );
  });

  it("propagates DB errors (driver crash / connection lost)", async () => {
    const db = {
      execute: vi.fn(async () => {
        throw new Error("connection lost");
      }),
    };
    await expect(nextCounterValue(db, "campaign", 2026)).rejects.toThrow(
      /connection lost/,
    );
  });
});

describe("nextNumber", () => {
  it("composes nextCounterValue + formatNumber for the current year by default", async () => {
    const fake = makeFakeDb([{ rows: [{ next_value: 5 }] }]);
    const currentYear = new Date().getFullYear();
    const out = await nextNumber(fake.db, "campaign");
    expect(out).toBe(`CMP-${currentYear}-0005`);
  });

  it("honors an explicit year override (used by financial backdated invoices)", async () => {
    const fake = makeFakeDb([{ rows: [{ next_value: 13 }] }]);
    const out = await nextNumber(fake.db, "invoice", 2024);
    expect(out).toBe("FAT-2024-0013");
  });

  it.each<[CounterScope, string]>([
    ["campaign", "CMP"],
    ["quotation", "QOT"],
    ["invoice", "FAT"],
    ["os_anunciante", "OS-ANT"],
    ["os_producao", "OS-PROD"],
    ["os_distribuicao", "OS-DIST"],
  ])("scope %s renders prefix %s", async (scope, prefix) => {
    const fake = makeFakeDb([{ rows: [{ next_value: 1 }] }]);
    const out = await nextNumber(fake.db, scope, 2026);
    expect(out).toBe(`${prefix}-2026-0001`);
  });
});

// ── Atomicidade conceitual ──────────────────────────────────────────────────
// Não conseguimos provar atomicidade real sem um Postgres real, mas podemos
// provar que o helper NÃO faz mais SELECT MAX + INSERT separados: chama
// db.execute UMA vez por número, com um único SQL que combina INSERT e
// ON CONFLICT DO UPDATE RETURNING. Isso é a garantia que substituiu
// withUniqueRetry no caminho feliz.
describe("nextCounterValue — atomicidade do upsert (regression task #173)", () => {
  it("emits a SINGLE execute() call (not select-then-insert)", async () => {
    const fake = makeFakeDb([{ rows: [{ next_value: 1 }] }]);
    await nextCounterValue(fake.db, "campaign", 2026);
    expect(fake.db.execute).toHaveBeenCalledTimes(1);
  });

  it("the query is an INSERT ... ON CONFLICT DO UPDATE ... RETURNING", async () => {
    const fake = makeFakeDb([{ rows: [{ next_value: 1 }] }]);
    await nextCounterValue(fake.db, "campaign", 2026);
    // drizzle SQL fragments expõem uma representação serializável; aceitamos
    // qualquer forma desde que conjuntos de palavras-chave estejam presentes.
    const fragment = fake.calls[0].query as { queryChunks?: unknown };
    const serialized = JSON.stringify(fragment);
    expect(serialized).toMatch(/INSERT INTO/i);
    expect(serialized).toMatch(/number_counters/);
    expect(serialized).toMatch(/ON CONFLICT/i);
    expect(serialized).toMatch(/DO UPDATE/i);
    expect(serialized).toMatch(/RETURNING/i);
  });
});
