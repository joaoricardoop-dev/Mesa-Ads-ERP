import { protectedProcedure, router } from "./_core/trpc";
import { z } from "zod";
import { getDb } from "./db";
import { telas, activeRestaurants } from "../drizzle/schema";
import { asc, eq } from "drizzle-orm";
import { TRPCError } from "@trpc/server";

async function getDatabase() {
  const d = await getDb();
  if (!d) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database not available" });
  return d;
}

// Campos editáveis de uma tela. lat/lng são numéricos no input e gravados como
// string (coluna decimal), seguindo o mesmo padrão de active_restaurants.
const telaFields = {
  nome: z.string().max(255).optional().nullable(),
  categoria: z.string().min(1).max(120),
  horarioFuncionamento: z.string().max(100).optional().nullable(),
  descricao: z.string().optional().nullable(),
  address: z.string().optional().nullable(),
  lat: z.number().optional().nullable(),
  lng: z.number().optional().nullable(),
  width: z.number().int().positive().optional().nullable(),
  height: z.number().int().positive().optional().nullable(),
  layout: z.enum(["landscape", "portrait", "square"]).optional().nullable(),
  cmsScreenId: z.string().max(100).optional().nullable(),
  spotDuration: z.number().int().min(0).optional().nullable(),
  loopDuration: z.number().int().min(0).optional().nullable(),
  dailyLoops: z.number().int().min(0).optional().nullable(),
  // Fotos da tela: array de URLs. Gravado como JSON text na coluna photoUrls.
  photoUrls: z.array(z.string()).optional().nullable(),
  status: z.enum(["active", "inactive"]).optional(),
};

// Converte o input do tRPC nos valores de coluna (lat/lng → string;
// photoUrls → JSON text).
function toColumns(input: Record<string, unknown>) {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(input)) {
    if (k === "restaurantId" || k === "id") continue;
    if (k === "lat" || k === "lng") {
      out[k] = v == null ? null : String(v);
    } else if (k === "photoUrls") {
      out[k] = Array.isArray(v) ? JSON.stringify(v) : null;
    } else {
      out[k] = v;
    }
  }
  return out;
}

// Faz o parse de photoUrls (JSON text) para string[] na saída, garantindo que
// telas (interna, página dedicada e ecommerce) leiam o mesmo formato.
export function parseTelaPhotoUrls(raw: unknown): string[] {
  if (!raw) return [];
  if (Array.isArray(raw)) return raw.filter((u): u is string => typeof u === "string");
  if (typeof raw === "string") {
    try {
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed.filter((u): u is string => typeof u === "string") : [];
    } catch {
      return [];
    }
  }
  return [];
}

function parseRow<T extends { photoUrls?: unknown } | undefined>(row: T): T {
  if (!row) return row;
  return { ...row, photoUrls: parseTelaPhotoUrls((row as any).photoUrls) } as T;
}

export const telaRouter = router({
  listByRestaurant: protectedProcedure
    .input(z.object({ restaurantId: z.number().int().positive() }))
    .query(async ({ input }) => {
      const db = await getDatabase();
      const rows = await db
        .select()
        .from(telas)
        .where(eq(telas.restaurantId, input.restaurantId))
        .orderBy(asc(telas.id));
      return rows.map(parseRow);
    }),

  // Lista todas as telas com o nome do local (active_restaurant). Usado pela
  // página dedicada "Locais > Telas" (cadastro centralizado).
  listAll: protectedProcedure.query(async () => {
    const db = await getDatabase();
    const rows = await db
      .select({
        tela: telas,
        restaurantName: activeRestaurants.name,
        restaurantNeighborhood: activeRestaurants.neighborhood,
        restaurantCity: activeRestaurants.city,
      })
      .from(telas)
      .leftJoin(activeRestaurants, eq(telas.restaurantId, activeRestaurants.id))
      .orderBy(asc(activeRestaurants.name), asc(telas.id));
    return rows.map((r) => ({
      ...parseRow(r.tela),
      restaurantName: r.restaurantName,
      restaurantNeighborhood: r.restaurantNeighborhood,
      restaurantCity: r.restaurantCity,
    }));
  }),

  get: protectedProcedure
    .input(z.object({ id: z.number().int().positive() }))
    .query(async ({ input }) => {
      const db = await getDatabase();
      const rows = await db.select().from(telas).where(eq(telas.id, input.id)).limit(1);
      return parseRow(rows[0]);
    }),

  create: protectedProcedure
    .input(z.object({ restaurantId: z.number().int().positive(), ...telaFields }))
    .mutation(async ({ input }) => {
      const db = await getDatabase();
      const [row] = await db
        .insert(telas)
        .values({ restaurantId: input.restaurantId, ...(toColumns(input) as any) })
        .returning();
      return parseRow(row);
    }),

  update: protectedProcedure
    .input(z.object({ id: z.number().int().positive(), ...telaFields, categoria: telaFields.categoria.optional() }))
    .mutation(async ({ input }) => {
      const db = await getDatabase();
      const [row] = await db
        .update(telas)
        .set({ ...(toColumns(input) as any), updatedAt: new Date() })
        .where(eq(telas.id, input.id))
        .returning();
      if (!row) throw new TRPCError({ code: "NOT_FOUND", message: "Tela não encontrada." });
      return parseRow(row);
    }),

  delete: protectedProcedure
    .input(z.object({ id: z.number().int().positive() }))
    .mutation(async ({ input }) => {
      const db = await getDatabase();
      const rows = await db.delete(telas).where(eq(telas.id, input.id)).returning();
      if (!rows.length) throw new TRPCError({ code: "NOT_FOUND", message: "Tela não encontrada." });
      return rows[0];
    }),
});
