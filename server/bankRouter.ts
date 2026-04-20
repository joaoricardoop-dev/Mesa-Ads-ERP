import { protectedProcedure, router } from "./_core/trpc";
import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { and, asc, desc, eq, gte, inArray, lte, sql } from "drizzle-orm";
import { randomUUID } from "node:crypto";
import { getDb } from "./db";
import {
  bankAccounts,
  bankTransactions,
  invoices,
  accountsPayable,
  campaigns,
  clients,
  suppliers,
} from "../drizzle/schema";
import { audited } from "./finance/auditMiddleware";
import { recordAudit } from "./finance/audit";
import type { DbClient } from "./finance/payables";
import { parseOfx } from "./bank/parsers/ofx";
import { parseCsv } from "./bank/parsers/csv";
import type { ParsedTransaction } from "./bank/parsers/types";

function requireFinancialAccess(role: string | null) {
  if (role !== "admin" && role !== "financeiro" && role !== "manager") {
    throw new TRPCError({ code: "FORBIDDEN", message: "Acesso restrito ao módulo financeiro" });
  }
}

async function getDatabase() {
  const d = await getDb();
  if (!d) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database not available" });
  return d as unknown as DbClient;
}

// Limite defensivo de upload: 5 MB e 50_000 transações por arquivo.
const MAX_UPLOAD_BYTES = 5 * 1024 * 1024;
const MAX_TRANSACTIONS = 50_000;

function decodeUpload(content: string, encoding: "utf8" | "base64"): string {
  if (content.length > MAX_UPLOAD_BYTES * 2) {
    throw new TRPCError({ code: "PAYLOAD_TOO_LARGE", message: "Arquivo excede o limite de 5MB" });
  }
  const decoded = encoding === "base64" ? Buffer.from(content, "base64").toString("utf8") : content;
  if (decoded.length > MAX_UPLOAD_BYTES) {
    throw new TRPCError({ code: "PAYLOAD_TOO_LARGE", message: "Arquivo excede o limite de 5MB" });
  }
  return decoded;
}

function detectKindFromName(filename: string): "ofx" | "csv" {
  const lower = filename.toLowerCase();
  if (lower.endsWith(".ofx") || lower.endsWith(".qfx")) return "ofx";
  return "csv";
}

// ── Matching engine ─────────────────────────────────────────────────────────
// Score por valor (peso 70) + proximidade de data (peso 30). Janela máxima
// de ±3 dias. Descrição entra como bônus de até 10 pontos quando contém o
// nome do cliente/fornecedor.
function scoreMatch(
  txn: { amount: string; date: string; description: string },
  candidate: { amount: string; date: string | null; counterpartName?: string | null },
): number {
  const txAmt = Number(txn.amount);
  const cAmt = Number(candidate.amount);
  if (!Number.isFinite(txAmt) || !Number.isFinite(cAmt)) return 0;
  const amtDiff = Math.abs(txAmt - cAmt);
  if (amtDiff > 0.01) return 0; // Exigir match exato de valor (1↔1).

  let score = 70;
  if (candidate.date) {
    const dDiff = Math.abs(
      (new Date(txn.date).getTime() - new Date(candidate.date).getTime()) / (1000 * 60 * 60 * 24),
    );
    if (dDiff > 3) return 0;
    score += Math.max(0, 30 - Math.round(dDiff * 10));
  }

  if (candidate.counterpartName) {
    const norm = (s: string) => s.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
    const desc = norm(txn.description);
    const name = norm(candidate.counterpartName);
    if (name.length > 3 && desc.includes(name.split(" ")[0])) {
      score += 10;
    }
  }

  return Math.min(110, score);
}

export const bankRouter = router({
  // ── Bank accounts CRUD ──────────────────────────────────────────────────
  listAccounts: protectedProcedure.query(async ({ ctx }) => {
    requireFinancialAccess(ctx.user.role);
    const db = await getDatabase();
    return db
      .select()
      .from(bankAccounts)
      .orderBy(desc(bankAccounts.active), asc(bankAccounts.name));
  }),

  createAccount: protectedProcedure
    .input(z.object({
      name: z.string().min(1),
      bank: z.string().min(1),
      agency: z.string().optional(),
      account: z.string().optional(),
      initialBalance: z.string().optional(),
      currency: z.string().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      requireFinancialAccess(ctx.user.role);
      const db = await getDatabase();
      const [row] = await db
        .insert(bankAccounts)
        .values({
          name: input.name,
          bank: input.bank,
          agency: input.agency ?? null,
          account: input.account ?? null,
          initialBalance: input.initialBalance ?? "0",
          currency: input.currency ?? "BRL",
        })
        .returning();
      return row;
    }),

  updateAccount: protectedProcedure
    .input(z.object({
      id: z.number(),
      name: z.string().optional(),
      bank: z.string().optional(),
      agency: z.string().nullable().optional(),
      account: z.string().nullable().optional(),
      active: z.boolean().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      requireFinancialAccess(ctx.user.role);
      const db = await getDatabase();
      const { id, ...fields } = input;
      const updates: Record<string, unknown> = { updatedAt: new Date() };
      for (const [k, v] of Object.entries(fields)) {
        if (v !== undefined) updates[k] = v;
      }
      const [row] = await db
        .update(bankAccounts)
        .set(updates)
        .where(eq(bankAccounts.id, id))
        .returning();
      return row;
    }),

  deleteAccount: protectedProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ ctx, input }) => {
      requireFinancialAccess(ctx.user.role);
      const db = await getDatabase();
      await db.delete(bankAccounts).where(eq(bankAccounts.id, input.id));
      return { ok: true };
    }),

  // ── Import OFX/CSV ───────────────────────────────────────────────────────
  // previewImport apenas roda o parser e detecta duplicatas — não escreve.
  previewImport: protectedProcedure
    .input(z.object({
      bankAccountId: z.number(),
      filename: z.string(),
      encoding: z.enum(["utf8", "base64"]).default("utf8"),
      content: z.string(),
      kind: z.enum(["ofx", "csv"]).optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      requireFinancialAccess(ctx.user.role);
      const db = await getDatabase();

      const text = decodeUpload(input.content, input.encoding);
      const kind = input.kind ?? detectKindFromName(input.filename);
      const parsed = kind === "ofx" ? parseOfx(text) : parseCsv(text);
      if (parsed.transactions.length > MAX_TRANSACTIONS) {
        throw new TRPCError({
          code: "PAYLOAD_TOO_LARGE",
          message: `Arquivo contém ${parsed.transactions.length} transações; limite é ${MAX_TRANSACTIONS}`,
        });
      }

      // Duplicatas: já existe transação com mesmo (bankAccountId, externalId).
      const externalIds = parsed.transactions.map((t) => t.externalId).filter(Boolean);
      let existingIds = new Set<string>();
      if (externalIds.length > 0) {
        const existing = await db
          .select({ externalId: bankTransactions.externalId })
          .from(bankTransactions)
          .where(and(
            eq(bankTransactions.bankAccountId, input.bankAccountId),
            inArray(bankTransactions.externalId, externalIds),
          ));
        existingIds = new Set(existing.map((r) => r.externalId).filter((v): v is string => !!v));
      }

      const items = parsed.transactions.map((t) => ({
        ...t,
        duplicate: existingIds.has(t.externalId),
      }));
      return {
        bank: parsed.bank,
        account: parsed.account ?? null,
        agency: parsed.agency ?? null,
        kind,
        total: items.length,
        duplicates: items.filter((i) => i.duplicate).length,
        items,
      };
    }),

  // confirmImport persiste após o usuário confirmar o preview. Idempotente
  // pelo unique (bankAccountId, externalId).
  confirmImport: protectedProcedure
    .input(z.object({
      bankAccountId: z.number(),
      filename: z.string(),
      encoding: z.enum(["utf8", "base64"]).default("utf8"),
      content: z.string(),
      kind: z.enum(["ofx", "csv"]).optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      requireFinancialAccess(ctx.user.role);
      const db = await getDatabase();

      const text = decodeUpload(input.content, input.encoding);
      const kind = input.kind ?? detectKindFromName(input.filename);
      const parsed = kind === "ofx" ? parseOfx(text) : parseCsv(text);
      if (parsed.transactions.length > MAX_TRANSACTIONS) {
        throw new TRPCError({
          code: "PAYLOAD_TOO_LARGE",
          message: `Arquivo contém ${parsed.transactions.length} transações; limite é ${MAX_TRANSACTIONS}`,
        });
      }

      if (parsed.transactions.length === 0) {
        return { imported: 0, skipped: 0, importBatchId: null };
      }

      const importBatchId = randomUUID();
      const rows = parsed.transactions.map((t: ParsedTransaction) => ({
        bankAccountId: input.bankAccountId,
        date: t.date,
        amount: t.amount,
        type: t.type,
        description: t.description,
        externalId: t.externalId,
        importBatchId,
      }));

      // Insere com ON CONFLICT DO NOTHING via raw SQL (drizzle não suporta o
      // helper p/ unique nomeado em todas as versões, mas o constraint dispara).
      let imported = 0;
      let skipped = 0;
      for (const row of rows) {
        try {
          const inserted = await db
            .insert(bankTransactions)
            .values(row)
            .onConflictDoNothing({ target: [bankTransactions.bankAccountId, bankTransactions.externalId] })
            .returning({ id: bankTransactions.id });
          if (inserted.length > 0) imported++;
          else skipped++;
        } catch {
          skipped++;
        }
      }

      await recordAudit(db, ctx, {
        entityType: "accounts_payable", // tipo genérico do enum; ação descreve.
        entityId: null,
        action: "generate",
        before: null,
        after: { importBatchId, imported, skipped, bankAccountId: input.bankAccountId, kind },
        metadata: { source: "bank_import", filename: input.filename, bank: parsed.bank },
      });

      return { imported, skipped, importBatchId };
    }),

  // ── Transações: listagem ────────────────────────────────────────────────
  listTransactions: protectedProcedure
    .input(z.object({
      bankAccountId: z.number(),
      reconciled: z.boolean().optional(),
      startDate: z.string().optional(),
      endDate: z.string().optional(),
      type: z.enum(["credit", "debit"]).optional(),
    }))
    .query(async ({ ctx, input }) => {
      requireFinancialAccess(ctx.user.role);
      const db = await getDatabase();
      const cond = [eq(bankTransactions.bankAccountId, input.bankAccountId)];
      if (input.reconciled !== undefined) cond.push(eq(bankTransactions.reconciled, input.reconciled));
      if (input.type) cond.push(eq(bankTransactions.type, input.type));
      if (input.startDate) cond.push(gte(bankTransactions.date, input.startDate));
      if (input.endDate) cond.push(lte(bankTransactions.date, input.endDate));
      return db
        .select()
        .from(bankTransactions)
        .where(and(...cond))
        .orderBy(desc(bankTransactions.date), desc(bankTransactions.id));
    }),

  // listOpenItems: itens em aberto pra conciliar.
  // - credit (entrada): faturas com status=emitida.
  // - debit (saída): contas a pagar com status=pendente.
  listOpenItems: protectedProcedure
    .input(z.object({
      type: z.enum(["credit", "debit"]),
    }))
    .query(async ({ ctx, input }) => {
      requireFinancialAccess(ctx.user.role);
      const db = await getDatabase();

      if (input.type === "credit") {
        const rows = await db
          .select({
            id: invoices.id,
            kind: sql<string>`'invoice'`.as("kind"),
            invoiceNumber: invoices.invoiceNumber,
            amount: invoices.amount,
            date: invoices.dueDate,
            status: invoices.status,
            campaignId: invoices.campaignId,
            clientId: invoices.clientId,
            counterpartName: clients.name,
          })
          .from(invoices)
          .leftJoin(clients, eq(clients.id, invoices.clientId))
          .where(eq(invoices.status, "emitida"))
          .orderBy(asc(invoices.dueDate));
        return rows;
      }

      const rows = await db
        .select({
          id: accountsPayable.id,
          kind: sql<string>`'accounts_payable'`.as("kind"),
          invoiceNumber: sql<string | null>`NULL`.as("invoiceNumber"),
          amount: accountsPayable.amount,
          date: accountsPayable.dueDate,
          status: accountsPayable.status,
          campaignId: accountsPayable.campaignId,
          clientId: sql<number | null>`NULL`.as("clientId"),
          counterpartName: suppliers.name,
          description: accountsPayable.description,
          sourceType: accountsPayable.sourceType,
        })
        .from(accountsPayable)
        .leftJoin(suppliers, eq(suppliers.id, accountsPayable.supplierId))
        .where(eq(accountsPayable.status, "pendente"))
        .orderBy(asc(accountsPayable.dueDate));
      return rows;
    }),

  // suggestMatches: para uma transação, calcula candidatos com score.
  suggestMatches: protectedProcedure
    .input(z.object({ transactionId: z.number() }))
    .query(async ({ ctx, input }) => {
      requireFinancialAccess(ctx.user.role);
      const db = await getDatabase();
      const [txn] = await db
        .select()
        .from(bankTransactions)
        .where(eq(bankTransactions.id, input.transactionId));
      if (!txn) throw new TRPCError({ code: "NOT_FOUND", message: "Transação não encontrada" });

      const candidates: Array<{
        kind: "invoice" | "accounts_payable";
        id: number;
        amount: string;
        date: string | null;
        counterpartName: string | null;
        label: string;
        score: number;
      }> = [];

      if (txn.type === "credit") {
        const rows = await db
          .select({
            id: invoices.id,
            amount: invoices.amount,
            date: invoices.dueDate,
            invoiceNumber: invoices.invoiceNumber,
            counterpartName: clients.name,
          })
          .from(invoices)
          .leftJoin(clients, eq(clients.id, invoices.clientId))
          .where(eq(invoices.status, "emitida"));
        for (const r of rows) {
          const score = scoreMatch(
            { amount: txn.amount, date: txn.date, description: txn.description },
            { amount: r.amount, date: r.date, counterpartName: r.counterpartName },
          );
          if (score > 0) {
            candidates.push({
              kind: "invoice",
              id: r.id,
              amount: r.amount,
              date: r.date,
              counterpartName: r.counterpartName ?? null,
              label: `Fatura ${r.invoiceNumber} — ${r.counterpartName ?? ""}`,
              score,
            });
          }
        }
      } else {
        const rows = await db
          .select({
            id: accountsPayable.id,
            amount: accountsPayable.amount,
            date: accountsPayable.dueDate,
            description: accountsPayable.description,
            counterpartName: suppliers.name,
          })
          .from(accountsPayable)
          .leftJoin(suppliers, eq(suppliers.id, accountsPayable.supplierId))
          .where(eq(accountsPayable.status, "pendente"));
        for (const r of rows) {
          const score = scoreMatch(
            { amount: txn.amount, date: txn.date, description: txn.description },
            { amount: r.amount, date: r.date, counterpartName: r.counterpartName },
          );
          if (score > 0) {
            candidates.push({
              kind: "accounts_payable",
              id: r.id,
              amount: r.amount,
              date: r.date,
              counterpartName: r.counterpartName ?? null,
              label: `${r.description} — ${r.counterpartName ?? "—"}`,
              score,
            });
          }
        }
      }

      candidates.sort((a, b) => b.score - a.score);
      return candidates.slice(0, 10);
    }),

  // ── Reconciliação ───────────────────────────────────────────────────────
  // Suporta 1↔1 (matches com 1 item) e 1↔N (várias faturas/contas que
  // somadas batem com o valor da transação ±0,01).
  reconcile: audited(protectedProcedure, {
    entityType: "accounts_payable",
    action: "mark_paid",
    loadBefore: async (input: { transactionId: number }, db) => {
      const [row] = await db
        .select()
        .from(bankTransactions)
        .where(eq(bankTransactions.id, input.transactionId));
      return row ?? null;
    },
    buildMetadata: (input: { transactionId: number; matches?: Array<{ kind: string; id: number }> }) =>
      ({ source: "bank_reconciliation", transactionId: input.transactionId, matchCount: input.matches?.length ?? 0 }),
  })
    .input(z.object({
      transactionId: z.number(),
      matches: z.array(z.object({
        kind: z.enum(["invoice", "accounts_payable"]),
        id: z.number(),
      })).min(1),
    }))
    .mutation(async ({ ctx, input }) => {
      requireFinancialAccess(ctx.user.role);
      const db = await getDatabase();

      const [txn] = await db
        .select()
        .from(bankTransactions)
        .where(eq(bankTransactions.id, input.transactionId));
      if (!txn) throw new TRPCError({ code: "NOT_FOUND", message: "Transação não encontrada" });
      if (txn.reconciled) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "Transação já está conciliada" });
      }

      // Validações: tipo da transação ↔ tipo dos matches.
      for (const m of input.matches) {
        if (txn.type === "credit" && m.kind !== "invoice") {
          throw new TRPCError({ code: "BAD_REQUEST", message: "Crédito só pode conciliar faturas" });
        }
        if (txn.type === "debit" && m.kind !== "accounts_payable") {
          throw new TRPCError({ code: "BAD_REQUEST", message: "Débito só pode conciliar contas a pagar" });
        }
      }

      // Rejeita IDs duplicados no mesmo match.
      const dedupKey = new Set(input.matches.map((m) => `${m.kind}:${m.id}`));
      if (dedupKey.size !== input.matches.length) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "IDs duplicados em matches" });
      }

      // Carrega entidades do BD pra validar status + computar soma autoritativa.
      // NUNCA confiar em valores do cliente para mutações financeiras.
      const resolved: Array<{ kind: "invoice" | "accounts_payable"; id: number; amount: string }> = [];
      for (const m of input.matches) {
        if (m.kind === "invoice") {
          const [row] = await db.select().from(invoices).where(eq(invoices.id, m.id));
          if (!row) throw new TRPCError({ code: "NOT_FOUND", message: `Fatura ${m.id} não encontrada` });
          if (row.status !== "emitida") {
            throw new TRPCError({ code: "BAD_REQUEST", message: `Fatura ${m.id} não está em aberto (status=${row.status})` });
          }
          resolved.push({ kind: "invoice", id: m.id, amount: row.amount });
        } else {
          const [row] = await db.select().from(accountsPayable).where(eq(accountsPayable.id, m.id));
          if (!row) throw new TRPCError({ code: "NOT_FOUND", message: `Conta a pagar ${m.id} não encontrada` });
          if (row.status !== "pendente") {
            throw new TRPCError({ code: "BAD_REQUEST", message: `Conta a pagar ${m.id} não está pendente (status=${row.status})` });
          }
          resolved.push({ kind: "accounts_payable", id: m.id, amount: row.amount });
        }
      }

      const sumMatches = resolved.reduce((acc, m) => acc + Number(m.amount), 0);
      const txAmount = Number(txn.amount);
      if (Math.abs(sumMatches - txAmount) > 0.01) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: `Soma dos matches (${sumMatches.toFixed(2)}) difere do valor da transação (${txAmount.toFixed(2)})`,
        });
      }

      const single = resolved.length === 1 ? resolved[0] : null;

      await db.transaction(async (tx: DbClient) => {
        // 1) Marca transação como conciliada.
        await tx
          .update(bankTransactions)
          .set({
            reconciled: true,
            reconciledAt: new Date(),
            reconciledBy: ctx.user?.id ?? null,
            matchedEntityType: single?.kind ?? "multi",
            matchedEntityId: single?.id ?? null,
            matches: resolved.map((m) => ({ entityType: m.kind, entityId: m.id, amount: m.amount })),
            updatedAt: new Date(),
          })
          .where(eq(bankTransactions.id, txn.id));

        // 2) Atualiza cada item conciliado.
        for (const m of input.matches) {
          if (m.kind === "invoice") {
            await tx
              .update(invoices)
              .set({ receivedDate: txn.date, updatedAt: new Date() })
              .where(eq(invoices.id, m.id));
          } else {
            await tx
              .update(accountsPayable)
              .set({ status: "pago", paymentDate: txn.date, updatedAt: new Date() })
              .where(eq(accountsPayable.id, m.id));
          }
        }
      });

      return { ok: true };
    }),

  // Desfaz reconciliação: zera receivedDate / volta accountsPayable a pendente.
  undoReconcile: audited(protectedProcedure, {
    entityType: "accounts_payable",
    action: "revert_payment",
    loadBefore: async (input: { transactionId: number }, db) => {
      const [row] = await db
        .select()
        .from(bankTransactions)
        .where(eq(bankTransactions.id, input.transactionId));
      return row ?? null;
    },
  })
    .input(z.object({ transactionId: z.number() }))
    .mutation(async ({ ctx, input }) => {
      requireFinancialAccess(ctx.user.role);
      const db = await getDatabase();
      const [txn] = await db
        .select()
        .from(bankTransactions)
        .where(eq(bankTransactions.id, input.transactionId));
      if (!txn) throw new TRPCError({ code: "NOT_FOUND", message: "Transação não encontrada" });
      if (!txn.reconciled) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "Transação não está conciliada" });
      }

      const matches = txn.matches ?? [];

      await db.transaction(async (tx: DbClient) => {
        for (const m of matches) {
          if (m.entityType === "invoice") {
            await tx
              .update(invoices)
              .set({ receivedDate: null, updatedAt: new Date() })
              .where(eq(invoices.id, m.entityId));
          } else if (m.entityType === "accounts_payable") {
            await tx
              .update(accountsPayable)
              .set({ status: "pendente", paymentDate: null, updatedAt: new Date() })
              .where(eq(accountsPayable.id, m.entityId));
          }
        }
        await tx
          .update(bankTransactions)
          .set({
            reconciled: false,
            reconciledAt: null,
            reconciledBy: null,
            matchedEntityType: null,
            matchedEntityId: null,
            matches: null,
            updatedAt: new Date(),
          })
          .where(eq(bankTransactions.id, txn.id));
      });

      return { ok: true, transactionId: txn.id };
    }),

  // ── Resumo (header da tela) ─────────────────────────────────────────────
  summary: protectedProcedure
    .input(z.object({ bankAccountId: z.number() }))
    .query(async ({ ctx, input }) => {
      requireFinancialAccess(ctx.user.role);
      const db = await getDatabase();
      const [unrec] = await db
        .select({
          count: sql<number>`COUNT(*)::int`,
          sumCredit: sql<string>`COALESCE(SUM(CASE WHEN ${bankTransactions.type} = 'credit' THEN ${bankTransactions.amount}::numeric ELSE 0 END), 0)::text`,
          sumDebit: sql<string>`COALESCE(SUM(CASE WHEN ${bankTransactions.type} = 'debit' THEN ${bankTransactions.amount}::numeric ELSE 0 END), 0)::text`,
        })
        .from(bankTransactions)
        .where(and(
          eq(bankTransactions.bankAccountId, input.bankAccountId),
          eq(bankTransactions.reconciled, false),
        ));
      const [rec] = await db
        .select({ count: sql<number>`COUNT(*)::int` })
        .from(bankTransactions)
        .where(and(
          eq(bankTransactions.bankAccountId, input.bankAccountId),
          eq(bankTransactions.reconciled, true),
        ));
      return {
        unreconciledCount: unrec?.count ?? 0,
        unreconciledCredits: unrec?.sumCredit ?? "0",
        unreconciledDebits: unrec?.sumDebit ?? "0",
        reconciledCount: rec?.count ?? 0,
      };
    }),
});
