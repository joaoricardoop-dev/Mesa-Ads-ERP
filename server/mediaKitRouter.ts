import { adminProcedure, protectedProcedure, router } from "./_core/trpc";
import { z } from "zod";
import { getDb } from "./db";
import { mediaKitSettings, products } from "../drizzle/schema";
import { eq, asc } from "drizzle-orm";

export const mediaKitRouter = router({
  getPublicData: protectedProcedure.query(async () => {
    const db = await getDb();
    if (!db) throw new Error("DB unavailable");

    const rows = await db
      .select()
      .from(mediaKitSettings)
      .where(eq(mediaKitSettings.id, 1))
      .limit(1);

    const settings = rows[0] ?? null;

    const activeProducts = await db
      .select({
        id: products.id,
        name: products.name,
        description: products.description,
        tipo: products.tipo,
        unitLabel: products.unitLabel,
        unitLabelPlural: products.unitLabelPlural,
        imagemUrl: products.imagemUrl,
        defaultQtyPerLocation: products.defaultQtyPerLocation,
        defaultSemanas: products.defaultSemanas,
      })
      .from(products)
      .where(eq(products.isActive, true))
      .orderBy(asc(products.name));

    return { settings, products: activeProducts };
  }),

  updateSettings: adminProcedure
    .input(
      z.object({
        tagline: z.string().max(200).optional(),
        intro: z.string().optional(),
        contactName: z.string().max(100).optional(),
        contactEmail: z.string().max(100).optional(),
        contactPhone: z.string().max(50).optional(),
        website: z.string().max(200).optional(),
        footerText: z.string().optional(),
      })
    )
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("DB unavailable");

      await db
        .insert(mediaKitSettings)
        .values({ id: 1, ...input, updatedAt: new Date() })
        .onConflictDoUpdate({
          target: mediaKitSettings.id,
          set: { ...input, updatedAt: new Date() },
        });

      const rows = await db
        .select()
        .from(mediaKitSettings)
        .where(eq(mediaKitSettings.id, 1))
        .limit(1);

      return rows[0];
    }),
});
