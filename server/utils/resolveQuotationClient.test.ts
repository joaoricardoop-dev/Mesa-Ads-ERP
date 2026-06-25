import { describe, expect, it } from "vitest";
import { resolveQuotationClientId } from "./resolveQuotationClient";
import { clients, leads, quotations } from "../../drizzle/schema";

// ── Table-aware fake DB ──────────────────────────────────────────────────────
// `resolveQuotationClientId` only exercises a small slice of the Drizzle client:
//   - select(...).from(<table>).where(...)[.limit(...)]
//   - insert(<table>).values(...).returning(...)
//   - update(<table>).set(...).where(...)
// We key results by the actual schema table reference so the fake is resilient
// to query reordering (no fragile sequential queue).

type Rows = Record<string, unknown>[];

function makeFakeDb(config: { leads?: Rows; clients?: Rows; newClientId?: number }) {
  const inserts: { table: unknown; values: Record<string, unknown> }[] = [];
  const updates: { table: unknown; set: Record<string, unknown> }[] = [];
  let nextId = config.newClientId ?? 999;

  const selectFor = (table: unknown): Rows => {
    if (table === leads) return config.leads ?? [];
    if (table === clients) return config.clients ?? [];
    return [];
  };

  const buildSelectChain = () => {
    let table: unknown;
    const chain: Record<string, unknown> = {
      from: (t: unknown) => {
        table = t;
        return chain;
      },
      where: () => chain,
      limit: () => chain,
      then: (resolve: (v: Rows) => unknown, reject: (e: unknown) => unknown) =>
        Promise.resolve(selectFor(table)).then(resolve, reject),
    };
    return chain;
  };

  const db = {
    select: () => buildSelectChain(),
    insert: (table: unknown) => ({
      values: (values: Record<string, unknown>) => {
        inserts.push({ table, values });
        const row = { id: nextId++, ...values };
        const ret = Promise.resolve([row]) as Promise<unknown[]> & {
          returning: () => Promise<unknown[]>;
        };
        ret.returning = () => Promise.resolve([row]);
        return ret;
      },
    }),
    update: (table: unknown) => ({
      set: (set: Record<string, unknown>) => {
        updates.push({ table, set });
        const ret = Promise.resolve({ rowCount: 1 }) as Promise<{ rowCount: number }> & {
          where: () => Promise<{ rowCount: number }>;
        };
        ret.where = () => Promise.resolve({ rowCount: 1 });
        return ret;
      },
    }),
  };

  return { db, inserts, updates };
}

describe("resolveQuotationClientId", () => {
  it("(a) returns the existing clientId unchanged without touching the DB", async () => {
    const { db, inserts, updates } = makeFakeDb({});
    const result = await resolveQuotationClientId(db, {
      id: 1,
      clientId: 42,
      leadId: null,
    });
    expect(result).toBe(42);
    // No client created, no quotation rewritten — it was already resolved.
    expect(inserts).toHaveLength(0);
    expect(updates).toHaveLength(0);
  });

  it("(b) reuses an existing client matched by the lead's e-mail", async () => {
    const { db, inserts, updates } = makeFakeDb({
      leads: [{ id: 7, name: "João", company: "Acme", cnpj: null, contactEmail: "joao@acme.com", contactPhone: null }],
      clients: [{ id: 55 }],
    });
    const result = await resolveQuotationClientId(db, {
      id: 10,
      clientId: null,
      leadId: 7,
    });
    expect(result).toBe(55);
    // Reused, not created.
    expect(inserts).toHaveLength(0);
    // clientId written back to the quotation.
    expect(updates).toHaveLength(1);
    expect(updates[0].table).toBe(quotations);
    expect(updates[0].set).toMatchObject({ clientId: 55 });
  });

  it("(c) creates a new client from the lead and writes the clientId back", async () => {
    const { db, inserts, updates } = makeFakeDb({
      leads: [{ id: 8, name: "Maria", company: "Beta Ltda", cnpj: "123", contactEmail: "maria@beta.com", contactPhone: "1199" }],
      clients: [], // nenhum cliente existente com esse e-mail
      newClientId: 200,
    });
    const result = await resolveQuotationClientId(db, {
      id: 11,
      clientId: null,
      leadId: 8,
    });
    expect(result).toBe(200);
    // Client created from lead data.
    expect(inserts).toHaveLength(1);
    expect(inserts[0].table).toBe(clients);
    expect(inserts[0].values).toMatchObject({
      name: "Maria",
      company: "Beta Ltda",
      cnpj: "123",
      contactEmail: "maria@beta.com",
      contactPhone: "1199",
      status: "active",
    });
    // New clientId persisted back onto the quotation.
    expect(updates).toHaveLength(1);
    expect(updates[0].table).toBe(quotations);
    expect(updates[0].set).toMatchObject({ clientId: 200 });
  });

  it("(d) returns null when there is neither a clientId nor a leadId", async () => {
    const { db, inserts, updates } = makeFakeDb({});
    const result = await resolveQuotationClientId(db, {
      id: 12,
      clientId: null,
      leadId: null,
    });
    expect(result).toBeNull();
    expect(inserts).toHaveLength(0);
    expect(updates).toHaveLength(0);
  });

  it("returns null when the referenced lead does not exist", async () => {
    const { db, inserts, updates } = makeFakeDb({ leads: [] });
    const result = await resolveQuotationClientId(db, {
      id: 13,
      clientId: null,
      leadId: 999,
    });
    expect(result).toBeNull();
    expect(inserts).toHaveLength(0);
    expect(updates).toHaveLength(0);
  });

  it("falls back to company name when the lead has no name", async () => {
    const { db, inserts } = makeFakeDb({
      leads: [{ id: 9, name: null, company: "Gamma SA", cnpj: null, contactEmail: null, contactPhone: null }],
      clients: [],
      newClientId: 300,
    });
    const result = await resolveQuotationClientId(db, {
      id: 14,
      clientId: null,
      leadId: 9,
    });
    expect(result).toBe(300);
    expect(inserts[0].values).toMatchObject({ name: "Gamma SA" });
  });
});
