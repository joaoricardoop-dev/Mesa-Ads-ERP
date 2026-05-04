import { describe, expect, it, vi } from "vitest";
import {
  PG_UNIQUE_VIOLATION,
  describeDbError,
  isUniqueViolation,
  withUniqueRetry,
} from "./uniqueNumberRetry";

// ── isUniqueViolation ────────────────────────────────────────────────────────
describe("isUniqueViolation", () => {
  it("returns true for any 23505 when no constraint is given", () => {
    expect(isUniqueViolation({ code: PG_UNIQUE_VIOLATION })).toBe(true);
  });

  it("matches the constraint name on direct error", () => {
    expect(
      isUniqueViolation(
        { code: PG_UNIQUE_VIOLATION, constraint: "campaigns_campaignNumber_unique" },
        "campaigns_campaignNumber_unique",
      ),
    ).toBe(true);
  });

  it("rejects when constraint name does not match", () => {
    expect(
      isUniqueViolation(
        { code: PG_UNIQUE_VIOLATION, constraint: "other_unique" },
        "campaigns_campaignNumber_unique",
      ),
    ).toBe(false);
  });

  it("walks .cause to find code/constraint (drizzle/pg wrapping)", () => {
    const err = new Error("insert failed") as Error & { cause: unknown };
    err.cause = { code: PG_UNIQUE_VIOLATION, constraint: "campaigns_campaignNumber_unique" };
    expect(isUniqueViolation(err, "campaigns_campaignNumber_unique")).toBe(true);
  });

  it("returns false for unrelated errors", () => {
    expect(isUniqueViolation(new Error("boom"))).toBe(false);
    expect(isUniqueViolation({ code: "23503" })).toBe(false);
    expect(isUniqueViolation(null)).toBe(false);
    expect(isUniqueViolation(undefined)).toBe(false);
  });
});

// ── describeDbError ──────────────────────────────────────────────────────────
describe("describeDbError", () => {
  it("renders a specific message for unique violations", () => {
    const msg = describeDbError(
      { code: PG_UNIQUE_VIOLATION, constraint: "campaigns_campaignNumber_unique" },
      "fallback",
    );
    expect(msg).toContain("Conflito de unicidade");
    expect(msg).toContain("campaigns_campaignNumber_unique");
  });

  it("includes PG code for non-unique DB errors", () => {
    const msg = describeDbError(
      { code: "23503", constraint: "fk_blah", detail: "Key (foo)=(1) is not present" },
      "fallback",
    );
    expect(msg).toMatch(/23503/);
    expect(msg).toMatch(/fk_blah/);
  });

  it("falls back when error has no recognizable shape", () => {
    expect(describeDbError(undefined, "Erro ao processar")).toBe("Erro ao processar");
  });

  it("includes plain Error message when there is no PG code", () => {
    const msg = describeDbError(new Error("connection lost"), "Erro ao processar");
    expect(msg).toContain("Erro ao processar");
    expect(msg).toContain("connection lost");
  });
});

// ── withUniqueRetry ──────────────────────────────────────────────────────────
describe("withUniqueRetry", () => {
  it("returns the result on the first attempt when there is no error", async () => {
    const fn = vi.fn().mockResolvedValue("ok");
    await expect(withUniqueRetry(fn)).resolves.toBe("ok");
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it("retries and succeeds after a single 23505", async () => {
    const onRetry = vi.fn();
    let calls = 0;
    const fn = vi.fn(async () => {
      calls += 1;
      if (calls === 1) {
        const err = new Error("duplicate key") as Error & { code: string; constraint: string };
        err.code = PG_UNIQUE_VIOLATION;
        err.constraint = "campaigns_campaignNumber_unique";
        throw err;
      }
      return "second-try";
    });

    await expect(
      withUniqueRetry(fn, {
        constraintName: "campaigns_campaignNumber_unique",
        maxRetries: 5,
        onRetry,
      }),
    ).resolves.toBe("second-try");
    expect(fn).toHaveBeenCalledTimes(2);
    expect(onRetry).toHaveBeenCalledTimes(1);
    expect(onRetry).toHaveBeenCalledWith(1, expect.any(Error));
  });

  it("propagates non-unique errors without retrying", async () => {
    const fn = vi.fn(async () => {
      const err = new Error("connection lost") as Error & { code: string };
      err.code = "08006";
      throw err;
    });

    await expect(withUniqueRetry(fn)).rejects.toMatchObject({ code: "08006" });
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it("re-throws the last 23505 after exhausting retries", async () => {
    const fn = vi.fn(async () => {
      const err = new Error("duplicate") as Error & { code: string; constraint: string };
      err.code = PG_UNIQUE_VIOLATION;
      err.constraint = "campaigns_campaignNumber_unique";
      throw err;
    });

    await expect(
      withUniqueRetry(fn, {
        constraintName: "campaigns_campaignNumber_unique",
        maxRetries: 3,
      }),
    ).rejects.toMatchObject({ code: PG_UNIQUE_VIOLATION });
    expect(fn).toHaveBeenCalledTimes(3);
  });

  it("does NOT retry when the violation hits a different constraint than configured", async () => {
    const fn = vi.fn(async () => {
      const err = new Error("dup on fk") as Error & { code: string; constraint: string };
      err.code = PG_UNIQUE_VIOLATION;
      err.constraint = "some_other_unique";
      throw err;
    });

    await expect(
      withUniqueRetry(fn, { constraintName: "campaigns_campaignNumber_unique", maxRetries: 5 }),
    ).rejects.toMatchObject({ constraint: "some_other_unique" });
    expect(fn).toHaveBeenCalledTimes(1);
  });
});

// ── End-to-end: campaign-number generator + retry ────────────────────────────
// Reproduz exatamente o cenário do bug 30/abr (Fabio/SOLAR NEO):
// (a) gap por campanha deletada → usar MAX em vez de COUNT
// (b) duas inserções concorrentes → retry on 23505
describe("campaign number generator + withUniqueRetry (regression)", () => {
  // Replica do gerador real (publicSigningRouter.generateCampaignNumber),
  // parametrizado por uma fonte de MAX para podermos simular a condição
  // de corrida sem depender do PG real.
  async function generate(prefix: string, fetchMax: () => Promise<string | null>) {
    const maxStr = await fetchMax();
    let seqNum = 1;
    if (maxStr) {
      const lastSeq = parseInt(maxStr.slice(prefix.length), 10);
      if (!isNaN(lastSeq)) seqNum = lastSeq + 1;
    }
    return `${prefix}${String(seqNum).padStart(4, "0")}`;
  }

  it("(a) gap por campanha deletada — MAX retorna o último mesmo com IDs faltando", async () => {
    const prefix = "CMP-2026-";
    // Simula tabela com CMP-2026-0001 e CMP-2026-0050 (gap entre 2 e 49 por
    // deleções). COUNT retornaria 2 → CMP-2026-0003 (colisão com 0050 não,
    // mas NÃO sobe a sequência). MAX retorna "CMP-2026-0050" → próximo é
    // 0051, comportamento correto.
    const num = await generate(prefix, async () => "CMP-2026-0050");
    expect(num).toBe("CMP-2026-0051");
  });

  it("(a) gerador volta a 0001 quando ainda não há campanhas no ano", async () => {
    const num = await generate("CMP-2026-", async () => null);
    expect(num).toBe("CMP-2026-0001");
  });

  it("(b) duas inserções concorrentes — segunda sofre 23505, retry regenera e vence", async () => {
    const prefix = "CMP-2026-";
    // Estado inicial do "banco" simulado: o último campaignNumber comitado é 0010.
    const committed = new Set<string>(["CMP-2026-0010"]);

    // simula uma corrida: a primeira tentativa lê maxBefore (0010) e tenta
    // inserir 0011, mas a transação concorrente já comitou 0011 antes.
    // A segunda tentativa lerá maxAfter (0011) e inserirá 0012.
    let readCount = 0;
    const fetchMax = async () => {
      readCount += 1;
      // Antes da corrida vencer: 0010. Depois da corrida vencer: 0011.
      return readCount === 1 ? "CMP-2026-0010" : "CMP-2026-0011";
    };

    // Antes do primeiro retry, simula a transação concorrente comitando 0011.
    let raceWinnerCommitted = false;
    const insert = async (num: string) => {
      if (!raceWinnerCommitted) {
        // Outra requisição venceu a corrida e comitou 0011 antes desta:
        committed.add("CMP-2026-0011");
        raceWinnerCommitted = true;
      }
      if (committed.has(num)) {
        const err = new Error(`duplicate key value violates unique constraint "campaigns_campaignNumber_unique"`) as Error & {
          code: string;
          constraint: string;
        };
        err.code = PG_UNIQUE_VIOLATION;
        err.constraint = "campaigns_campaignNumber_unique";
        throw err;
      }
      committed.add(num);
      return num;
    };

    const onRetry = vi.fn();
    const result = await withUniqueRetry(
      async () => {
        const num = await generate(prefix, fetchMax);
        return insert(num);
      },
      { constraintName: "campaigns_campaignNumber_unique", maxRetries: 5, onRetry },
    );

    expect(result).toBe("CMP-2026-0012");
    expect(committed.has("CMP-2026-0011")).toBe(true);
    expect(committed.has("CMP-2026-0012")).toBe(true);
    expect(onRetry).toHaveBeenCalledTimes(1);
  });

  it("(b) retry esgota se o banco insistir em violar — propaga 23505 ao caller", async () => {
    const prefix = "CMP-2026-";
    const fetchMax = async () => "CMP-2026-0010";
    const insert = async (_num: string) => {
      const err = new Error("constant duplicate") as Error & { code: string; constraint: string };
      err.code = PG_UNIQUE_VIOLATION;
      err.constraint = "campaigns_campaignNumber_unique";
      throw err;
    };

    await expect(
      withUniqueRetry(
        async () => {
          const num = await generate(prefix, fetchMax);
          return insert(num);
        },
        { constraintName: "campaigns_campaignNumber_unique", maxRetries: 4 },
      ),
    ).rejects.toMatchObject({ code: PG_UNIQUE_VIOLATION });
  });
});
