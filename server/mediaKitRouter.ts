import { adminProcedure, protectedProcedure, router } from "./_core/trpc";
import { z } from "zod";
import { getDb } from "./db";
import { mediaKitSettings } from "../drizzle/schema";
import { eq } from "drizzle-orm";

export const mediaKitRouter = router({
  getPublicData: protectedProcedure.query(async () => {
    const db = await getDb();
    if (!db) throw new Error("DB unavailable");

    const rows = await db
      .select()
      .from(mediaKitSettings)
      .where(eq(mediaKitSettings.id, 1))
      .limit(1);

    return { pdfUrl: rows[0]?.pdfUrl ?? null, updatedAt: rows[0]?.updatedAt ?? null };
  }),

  updatePdfUrl: adminProcedure
    .input(z.object({ pdfUrl: z.string().nullable() }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("DB unavailable");

      await db
        .insert(mediaKitSettings)
        .values({ id: 1, pdfUrl: input.pdfUrl, updatedAt: new Date() })
        .onConflictDoUpdate({
          target: mediaKitSettings.id,
          set: { pdfUrl: input.pdfUrl, updatedAt: new Date() },
        });

      return { success: true };
    }),
});
