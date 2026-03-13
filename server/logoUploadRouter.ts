import express from "express";
import multer from "multer";
import { getDb } from "./db";
import { activeRestaurants } from "../drizzle/schema";
import { eq } from "drizzle-orm";
import { storagePut } from "./storage";

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 2 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    if (file.mimetype === "image/png") {
      cb(null, true);
    } else {
      cb(new Error("Apenas arquivos PNG são aceitos."));
    }
  },
});

function handleUpload(req: express.Request, res: express.Response): Promise<void> {
  return new Promise((resolve) => {
    upload.single("logo")(req, res, (err) => {
      if (err) {
        if (err instanceof multer.MulterError && err.code === "LIMIT_FILE_SIZE") {
          res.status(400).json({ error: "Arquivo muito grande. Máximo: 2MB." });
        } else {
          res.status(400).json({ error: err.message || "Erro no upload." });
        }
        return resolve();
      }
      resolve();
    });
  });
}

async function processLogoUpload(req: express.Request, res: express.Response) {
  await handleUpload(req, res);
  if (res.headersSent) return;

  const file = req.file;
  if (!file) {
    return res.status(400).json({ error: "Nenhum arquivo enviado." });
  }

  const restaurantId = parseInt(req.body.restaurantId, 10);
  if (!restaurantId || isNaN(restaurantId)) {
    return res.status(400).json({ error: "ID do restaurante é obrigatório." });
  }

  const db = await getDb();
  if (!db) {
    return res.status(500).json({ error: "Banco de dados indisponível." });
  }

  const [restaurant] = await db
    .select({ id: activeRestaurants.id })
    .from(activeRestaurants)
    .where(eq(activeRestaurants.id, restaurantId))
    .limit(1);

  if (!restaurant) {
    return res.status(404).json({ error: "Restaurante não encontrado." });
  }

  const key = `logos/restaurant-${restaurantId}-${Date.now()}.png`;
  const { url } = await storagePut(key, file.buffer, "image/png");

  await db
    .update(activeRestaurants)
    .set({ logoUrl: url, updatedAt: new Date() })
    .where(eq(activeRestaurants.id, restaurantId));

  return res.json({ logoUrl: url });
}

export function setupLogoUploadRoutes(app: express.Express) {
  app.post("/api/restaurant-logo/upload", async (req, res) => {
    try {
      const { getAuth } = await import("@clerk/express");
      const auth = getAuth(req);
      if (!auth?.userId) {
        return res.status(401).json({ error: "Não autorizado." });
      }

      const { users } = await import("../drizzle/schema");
      const db = await getDb();
      if (!db) return res.status(500).json({ error: "Banco de dados indisponível." });

      const { eq: eqOp } = await import("drizzle-orm");
      const [user] = await db.select({ role: users.role, restaurantId: users.restaurantId })
        .from(users).where(eqOp(users.id, auth.userId)).limit(1);

      if (!user) return res.status(403).json({ error: "Usuário não encontrado." });

      const restaurantId = parseInt(req.body.restaurantId, 10);
      const internalRoles = ["admin", "operacoes", "manager", "comercial"];
      const isInternal = internalRoles.includes(user.role || "");
      const isOwnRestaurant = user.role === "restaurante" && user.restaurantId === restaurantId;

      if (!isInternal && !isOwnRestaurant) {
        return res.status(403).json({ error: "Sem permissão para alterar o logotipo deste restaurante." });
      }

      await processLogoUpload(req, res);
    } catch (err: any) {
      console.error("Logo upload error:", err);
      return res.status(500).json({ error: "Erro ao fazer upload do logotipo." });
    }
  });

  app.post("/api/restaurant-logo/upload-public", async (req, res) => {
    try {
      await processLogoUpload(req, res);
    } catch (err: any) {
      console.error("Logo upload (public) error:", err);
      return res.status(500).json({ error: "Erro ao fazer upload do logotipo." });
    }
  });
}
