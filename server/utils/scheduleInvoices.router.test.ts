import { describe, expect, it, vi, beforeEach } from "vitest";

// ── Typed fake DB ────────────────────────────────────────────────────────────
// Implements the subset of the Drizzle client API exercised by the procedures
// under test. Each `.select(...).from(...).where(...)` chain pops the next
// pre-queued result. `.insert(...).values(...)` records every batch so tests
// can assert on what was written. `.transaction(fn)` runs `fn(this)` inline.

type SelectChain<T> = Promise<T[]> & {
  from: (...args: unknown[]) => SelectChain<T>;
  where: (...args: unknown[]) => SelectChain<T>;
  orderBy: (...args: unknown[]) => SelectChain<T>;
  limit: (...args: unknown[]) => SelectChain<T>;
  leftJoin: (...args: unknown[]) => SelectChain<T>;
  innerJoin: (...args: unknown[]) => SelectChain<T>;
  groupBy: (...args: unknown[]) => SelectChain<T>;
};

type InsertReturning<T> = Promise<T[]> & {
  returning: () => Promise<T[]>;
};

type InsertChain<T> = {
  values: (vals: T | T[]) => InsertReturning<T>;
};

type UpdateWhere = Promise<{ rowCount: number }> & {
  where: (...args: unknown[]) => UpdateWhere;
};

type UpdateChain = {
  set: (vals: unknown) => UpdateWhere;
};

type DeleteChain = Promise<{ rowCount: number }> & {
  where: (...args: unknown[]) => Promise<{ rowCount: number }>;
};

type FakeDb = {
  select: (..._args: unknown[]) => SelectChain<Record<string, unknown>>;
  insert: <T>(table: unknown) => InsertChain<T>;
  update: (table: unknown) => UpdateChain;
  delete: (table: unknown) => DeleteChain;
  transaction: <R>(fn: (tx: FakeDb) => Promise<R>) => Promise<R>;
  execute: (..._args: unknown[]) => Promise<unknown>;
};

type FakeHandle = {
  db: FakeDb;
  inserted: Map<unknown, unknown[]>;
  updates: Array<{ table: unknown; set: unknown }>;
  queueSelect: (rows: unknown[]) => void;
  queueExecute: (rows: unknown[]) => void;
};

function makeFakeDb(): FakeHandle {
  const selectQueue: unknown[][] = [];
  const executeQueue: unknown[][] = [];
  const inserted = new Map<unknown, unknown[]>();
  const updates: Array<{ table: unknown; set: unknown }> = [];

  const buildSelectChain = <T>(rows: T[]): SelectChain<T> => {
    const promise: Promise<T[]> = Promise.resolve(rows);
    const chain = promise as SelectChain<T>;
    chain.from = () => chain;
    chain.where = () => chain;
    chain.orderBy = () => chain;
    chain.limit = () => chain;
    chain.leftJoin = () => chain;
    chain.innerJoin = () => chain;
    chain.groupBy = () => chain;
    return chain;
  };

  const buildInsertReturning = <T>(rows: T[]): InsertReturning<T> => {
    const promise: Promise<T[]> = Promise.resolve(rows);
    const chain = promise as InsertReturning<T>;
    chain.returning = () => Promise.resolve(rows);
    return chain;
  };

  const db: FakeDb = {
    select: () => {
      const next = selectQueue.shift() ?? [];
      return buildSelectChain(next as Record<string, unknown>[]);
    },
    insert: <T>(table: unknown): InsertChain<T> => ({
      values: (vals) => {
        const arr = (Array.isArray(vals) ? vals : [vals]) as T[];
        inserted.set(table, [...(inserted.get(table) ?? []), ...arr]);
        return buildInsertReturning(arr);
      },
    }),
    update: (table) => ({
      set: (vals) => {
        updates.push({ table, set: vals });
        const promise = Promise.resolve({ rowCount: 1 });
        const out = promise as UpdateWhere;
        out.where = () => out;
        return out;
      },
    }),
    delete: (_table) => {
      const promise = Promise.resolve({ rowCount: 1 });
      const out = promise as DeleteChain;
      out.where = () => Promise.resolve({ rowCount: 1 });
      return out;
    },
    transaction: async <R>(fn: (tx: FakeDb) => Promise<R>): Promise<R> => fn(db),
    // Task #173 — `nextNumber()` faz `db.execute(sql\`...\`)` e espera o
    // formato neon { rows: [{ next_value: N }] }. O queue permite que cada
    // teste enfileire o próximo valor retornado.
    execute: () => {
      const next = executeQueue.shift() ?? [];
      return Promise.resolve({ rows: next });
    },
  };

  return {
    db,
    inserted,
    updates,
    queueSelect: (rows) => {
      selectQueue.push(rows);
    },
    queueExecute: (rows) => {
      executeQueue.push(rows);
    },
  };
}

// ── Module mocks ─────────────────────────────────────────────────────────────
// Use a holder so each test can swap the active fake DB without leaking state.
const dbHolder: { current: FakeHandle } = { current: makeFakeDb() };

vi.mock("./scheduleInvoices", async () => {
  const actual = await vi.importActual<typeof import("./scheduleInvoices")>(
    "./scheduleInvoices",
  );
  return {
    ...actual,
    scheduleInvoicesForCampaign: vi.fn(async () => ({
      created: 1,
      skipped: 0,
      total: 1,
    })),
  };
});

vi.mock("../db", () => ({
  getDb: vi.fn(async () => dbHolder.current.db),
  // Stub out the rest of the legacy `./db` exports referenced by routers; they
  // are not exercised by the procedures under test but tRPC-loads everything.
  listRestaurants: vi.fn().mockResolvedValue([]),
  listClients: vi.fn().mockResolvedValue([]),
  listCampaigns: vi.fn().mockResolvedValue([]),
  listSuppliers: vi.fn().mockResolvedValue([]),
  listBudgets: vi.fn().mockResolvedValue([]),
  getMonthlyEconomics: vi.fn().mockResolvedValue({ totals: {}, campaigns: [] }),
  getCampaign: vi.fn().mockResolvedValue(null),
  getRestaurant: vi.fn().mockResolvedValue(null),
  getClient: vi.fn().mockResolvedValue(null),
  getCampaignRestaurants: vi.fn().mockResolvedValue([]),
  setCampaignRestaurants: vi.fn().mockResolvedValue({ success: true }),
  createRestaurant: vi.fn().mockResolvedValue({ id: 1 }),
  updateRestaurant: vi.fn().mockResolvedValue({ success: true }),
  deleteRestaurant: vi.fn().mockResolvedValue({ success: true }),
  createClient: vi.fn().mockResolvedValue({ id: 1 }),
  updateClient: vi.fn().mockResolvedValue({ success: true }),
  deleteClient: vi.fn().mockResolvedValue({ success: true }),
  createSupplier: vi.fn().mockResolvedValue({ id: 1 }),
  updateSupplier: vi.fn().mockResolvedValue({ success: true }),
  deleteSupplier: vi.fn().mockResolvedValue({ success: true }),
  createBudget: vi.fn().mockResolvedValue({ id: 1 }),
  updateBudget: vi.fn().mockResolvedValue({ success: true }),
  deleteBudget: vi.fn().mockResolvedValue({ success: true }),
  createCampaign: vi.fn().mockResolvedValue({ id: 1 }),
  updateCampaign: vi.fn().mockResolvedValue({ success: true }),
  deleteCampaign: vi.fn().mockResolvedValue({ success: true }),
  getBudgetItems: vi.fn().mockResolvedValue([]),
  updateRestaurantPayment: vi.fn().mockResolvedValue({ success: true }),
}));

import { appRouter } from "../routers";
import { scheduleInvoicesForCampaign } from "./scheduleInvoices";
import type { TrpcContext } from "../_core/context";
import { campaigns, quotations } from "../../drizzle/schema";

type MockedScheduler = ReturnType<typeof vi.fn> & typeof scheduleInvoicesForCampaign;
const scheduleSpy = scheduleInvoicesForCampaign as unknown as MockedScheduler;

function makeComercialContext(): TrpcContext {
  return {
    user: {
      id: 1,
      openId: "test-user",
      email: "test@example.com",
      name: "Test User",
      loginMethod: "manus",
      role: "comercial",
      createdAt: new Date(),
      updatedAt: new Date(),
      lastSignedIn: new Date(),
    },
    req: { protocol: "https", headers: {} } as TrpcContext["req"],
    res: { clearCookie: () => undefined } as unknown as TrpcContext["res"],
  };
}

function resetFakeDb(): FakeHandle {
  dbHolder.current = makeFakeDb();
  return dbHolder.current;
}

beforeEach(() => {
  scheduleSpy.mockClear();
  scheduleSpy.mockResolvedValue({ created: 1, skipped: 0, total: 1 });
  resetFakeDb();
});

describe("campaignPhase.createPhase auto-schedule", () => {
  it("calls scheduleInvoicesForCampaign by default for the new phase", async () => {
    const fake = dbHolder.current;
    fake.queueSelect([{ id: 100, clientId: 7 }]); // campaign lookup
    fake.queueSelect([{ max: 0 }]); // maxSeq

    const caller = appRouter.createCaller(makeComercialContext());
    await caller.campaignPhase.createPhase({
      campaignId: 100,
      label: "Ciclo 1",
      periodStart: "2026-05-01",
      periodEnd: "2026-05-28",
    });

    expect(scheduleSpy).toHaveBeenCalledTimes(1);
    const [, campaignArg, optsArg] = scheduleSpy.mock.calls[0];
    expect(campaignArg).toEqual({ id: 100, clientId: 7 });
    expect(optsArg).toMatchObject({ dueOffsetDays: 15 });
    expect(Array.isArray((optsArg as { restrictToPhaseIds: unknown }).restrictToPhaseIds)).toBe(true);
  });

  it("skips scheduling when autoSchedule is false (escape hatch)", async () => {
    const fake = dbHolder.current;
    fake.queueSelect([{ id: 101, clientId: 7 }]);
    fake.queueSelect([{ max: 2 }]);

    const caller = appRouter.createCaller(makeComercialContext());
    await caller.campaignPhase.createPhase({
      campaignId: 101,
      label: "Ciclo Extra",
      periodStart: "2026-06-01",
      periodEnd: "2026-06-28",
      autoSchedule: false,
    });

    expect(scheduleSpy).not.toHaveBeenCalled();
  });

  it("propagates failure from scheduleInvoicesForCampaign (no swallow)", async () => {
    const fake = dbHolder.current;
    fake.queueSelect([{ id: 102, clientId: 7 }]);
    fake.queueSelect([{ max: 0 }]);
    scheduleSpy.mockRejectedValueOnce(new Error("DB insert failed"));

    const caller = appRouter.createCaller(makeComercialContext());
    await expect(
      caller.campaignPhase.createPhase({
        campaignId: 102,
        label: "Falha",
        periodStart: "2026-07-01",
        periodEnd: "2026-07-28",
      }),
    ).rejects.toThrow(/DB insert failed/);
  });
});

describe("quotation.markWin auto-schedule", () => {
  it("invokes scheduleInvoicesForCampaign after converting a won quotation", async () => {
    const fake = dbHolder.current;
    // markWin select chain (in order):
    fake.queueSelect([
      // quotation row (isBonificada=true skips autoCreateInvoice's heavy path)
      {
        id: 9001,
        quotationNumber: "QOT-2026-0042",
        clientId: 7,
        cycles: 3,
        coasterVolume: 5000,
        notes: "test",
        isBonificada: true,
        productId: null,
        totalValue: "0",
        status: "ativa",
      },
    ]);
    // Task #173 — generateCampaignNumber agora usa nextNumber → db.execute.
    fake.queueExecute([{ next_value: 1 }]);
    fake.queueSelect([{ name: "Cliente Teste" }]); // client lookup
    fake.queueSelect([]); // quotationItems lookup → no shared items, skip phase loop

    const caller = appRouter.createCaller(makeComercialContext());
    await caller.quotation.markWin({
      id: 9001,
      startDate: "2026-05-01",
      endDate: "2026-08-01",
    });

    expect(scheduleSpy).toHaveBeenCalledTimes(1);
    const [, campaignArg] = scheduleSpy.mock.calls[0];
    expect(campaignArg).toMatchObject({ clientId: 7 });
  });

  it("propagates scheduling failure on markWin (no swallow)", async () => {
    const fake = dbHolder.current;
    fake.queueSelect([
      {
        id: 9002,
        quotationNumber: "QOT-2026-0043",
        clientId: 8,
        cycles: 1,
        coasterVolume: 1000,
        notes: null,
        isBonificada: true,
        productId: null,
        totalValue: "0",
        status: "ativa",
      },
    ]);
    // Task #173 — generateCampaignNumber agora usa nextNumber → db.execute.
    fake.queueExecute([{ next_value: 2 }]);
    fake.queueSelect([{ name: "Outro Cliente" }]);
    fake.queueSelect([]);
    scheduleSpy.mockRejectedValueOnce(new Error("schedule blew up"));

    const caller = appRouter.createCaller(makeComercialContext());
    await expect(
      caller.quotation.markWin({
        id: 9002,
        startDate: "2026-05-01",
        endDate: "2026-06-01",
      }),
    ).rejects.toThrow(/schedule blew up/);
  });
});

// Task #287 — conversão de cotação nascida de lead (sem clientId direto).
// Cobre a integração de resolveQuotationClientId nos fluxos internos: o caminho
// feliz (campanha criada + clientId gravado de volta) e o erro amigável
// (BAD_REQUEST em vez de erro de banco) quando não há como resolver o cliente.
describe("quotation conversion without a direct client (lead-based)", () => {
  it("markWin resolves a lead-based quotation: creates campaign and writes clientId back", async () => {
    const fake = dbHolder.current;
    // 1) quotation lookup — clientId NULL, leadId set (nasceu de lead).
    fake.queueSelect([
      {
        id: 9101,
        quotationNumber: "QOT-2026-0101",
        clientId: null,
        leadId: 555,
        cycles: 2,
        coasterVolume: 3000,
        notes: null,
        isBonificada: true, // pula schedule e autoCreateInvoice
        productId: null,
        totalValue: "0",
        status: "ativa",
      },
    ]);
    // 2) resolveQuotationClientId → busca o lead.
    fake.queueSelect([
      { id: 555, name: "Lead Co", company: "Lead Co", cnpj: null, contactEmail: "lead@co.com", contactPhone: null },
    ]);
    // 3) resolveQuotationClientId → cliente existente casado por e-mail (reuso).
    fake.queueSelect([{ id: 77 }]);
    // 4) lookup do nome do cliente para nomear a campanha.
    fake.queueSelect([{ name: "Lead Co" }]);
    fake.queueExecute([{ next_value: 10 }]); // generateCampaignNumber
    fake.queueSelect([]); // quotationItems → sem itens compartilhados

    const caller = appRouter.createCaller(makeComercialContext());
    const result = await caller.quotation.markWin({
      id: 9101,
      startDate: "2026-05-01",
      endDate: "2026-08-01",
    });

    expect(result.quotationId).toBe(9101);

    // Campanha criada com o clientId resolvido (77).
    const campaignInserts = fake.inserted.get(campaigns) as Array<{ clientId: number }> | undefined;
    expect(campaignInserts).toBeDefined();
    expect(campaignInserts).toHaveLength(1);
    expect(campaignInserts![0].clientId).toBe(77);

    // clientId gravado de volta na cotação (writeback do resolver).
    const quotationUpdates = fake.updates
      .filter((u) => u.table === quotations)
      .map((u) => u.set as Record<string, unknown>);
    expect(quotationUpdates.some((s) => s.clientId === 77)).toBe(true);
    // E a cotação foi marcada como "win".
    expect(quotationUpdates.some((s) => s.status === "win")).toBe(true);
  });

  it("markWin throws a friendly BAD_REQUEST (not a DB error) when there is no client and no lead", async () => {
    const fake = dbHolder.current;
    fake.queueSelect([
      {
        id: 9102,
        quotationNumber: "QOT-2026-0102",
        clientId: null,
        leadId: null,
        cycles: 1,
        coasterVolume: 1000,
        notes: null,
        isBonificada: true,
        productId: null,
        totalValue: "0",
        status: "ativa",
      },
    ]);

    const caller = appRouter.createCaller(makeComercialContext());
    await expect(
      caller.quotation.markWin({ id: 9102, startDate: "2026-05-01", endDate: "2026-06-01" }),
    ).rejects.toThrow(/cliente vinculado/i);

    // Nenhuma campanha deve ser inserida — falhou antes do INSERT NOT NULL.
    expect(fake.inserted.get(campaigns)).toBeUndefined();
  });

  it("signOS throws a friendly BAD_REQUEST (not a DB error) when there is no client and no lead", async () => {
    const fake = dbHolder.current;
    // 1) quotation (status os_gerada, bonificada para pular schedule), sem cliente/lead.
    fake.queueSelect([
      {
        id: 9103,
        quotationNumber: "QOT-2026-0103",
        clientId: null,
        leadId: null,
        coasterVolume: 1000,
        notes: null,
        isBonificada: true,
        productId: null,
        totalValue: "0",
        status: "os_gerada",
      },
    ]);
    // 2) restaurantes alocados (precisa ser não-vazio).
    fake.queueSelect([{ id: 1, commissionPercent: "20", coasterQuantity: 1000 }]);
    // 3) batches (precisa casar com input.batchIds.length === 1).
    fake.queueSelect([{ id: 1, startDate: "2026-05-01", endDate: "2026-05-28" }]);
    // 4) service order (precisa existir).
    fake.queueSelect([{ id: 50 }]);

    const caller = appRouter.createCaller(makeComercialContext());
    await expect(
      caller.quotation.signOS({
        quotationId: 9103,
        signatureUrl: "data:image/png;base64,AAAA",
        batchIds: [1],
      }),
    ).rejects.toThrow(/cliente vinculado/i);

    expect(fake.inserted.get(campaigns)).toBeUndefined();
  });
});
