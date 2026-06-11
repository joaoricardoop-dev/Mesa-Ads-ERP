import express from "express";
import { getDb as getDatabase } from "./db";
import { getContractLinks } from "./contractLinks";

/**
 * Rotas públicas (não-logadas) para documentos contratuais:
 *  - GET /api/public-term/:slug  → conteúdo de um termo marcado como público
 *    (renderizado pela página /termo/:slug).
 *  - GET /api/contract-links     → links (contrato master + termo de campanha)
 *    impressos nos PDFs. Dados públicos por natureza.
 *
 * Registrado ANTES do setupClerkAuth para dispensar autenticação.
 */
export function setupPublicTermsRoutes(app: express.Express) {
  const router = express.Router();

  router.get("/public-term/:slug", async (req, res) => {
    try {
      const db = await getDatabase();
      if (!db) return res.status(503).json({ error: "Banco indisponível" });
      const { termTemplates } = await import("../drizzle/schema");
      const { and, eq } = await import("drizzle-orm");
      const [term] = await db
        .select({
          title: termTemplates.title,
          content: termTemplates.content,
          version: termTemplates.version,
          updatedAt: termTemplates.updatedAt,
        })
        .from(termTemplates)
        .where(and(eq(termTemplates.slug, req.params.slug), eq(termTemplates.isPublic, true), eq(termTemplates.isActive, true)))
        .limit(1);
      if (!term) return res.status(404).json({ error: "Termo não encontrado" });
      res.json(term);
    } catch (err: any) {
      console.error("Error fetching public term:", err);
      res.status(500).json({ error: "Erro interno do servidor" });
    }
  });

  router.get("/contract-links", async (_req, res) => {
    try {
      res.json(await getContractLinks());
    } catch (err: any) {
      console.error("Error fetching contract links:", err);
      res.status(500).json({ error: "Erro interno do servidor" });
    }
  });

  app.use("/api", router);
}
