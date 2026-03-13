import express from "express";
import multer from "multer";
import { getDb } from "./db";
import { activeRestaurants } from "../drizzle/schema";
import { eq } from "drizzle-orm";
import { storagePut } from "./storage";
import { randomUUID } from "crypto";

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

async function saveLogoToStorage(file: Express.Multer.File, restaurantId: number, res: express.Response) {
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

const onboardingUploadTokens = new Map<string, { restaurantId: number; expiresAt: number }>();

export function createOnboardingUploadToken(restaurantId: number): string {
  const token = randomUUID();
  onboardingUploadTokens.set(token, {
    restaurantId,
    expiresAt: Date.now() + 5 * 60 * 1000,
  });
  return token;
}

export function setupPublicLogoUploadRoutes(app: express.Express) {
  app.post("/api/restaurant-logo/upload-public", async (req, res) => {
    try {
      await handleUpload(req, res);
      if (res.headersSent) return;

      const file = req.file;
      if (!file) {
        return res.status(400).json({ error: "Nenhum arquivo enviado." });
      }

      const uploadToken = req.body.uploadToken;
      if (!uploadToken) {
        return res.status(403).json({ error: "Token de upload não fornecido." });
      }

      const tokenData = onboardingUploadTokens.get(uploadToken);
      if (!tokenData || tokenData.expiresAt < Date.now()) {
        onboardingUploadTokens.delete(uploadToken);
        return res.status(403).json({ error: "Token de upload inválido ou expirado." });
      }

      const restaurantId = tokenData.restaurantId;
      onboardingUploadTokens.delete(uploadToken);

      await saveLogoToStorage(file, restaurantId, res);
    } catch (err: any) {
      console.error("Logo upload (public) error:", err);
      if (!res.headersSent) {
        return res.status(500).json({ error: "Erro ao fazer upload do logotipo." });
      }
    }
  });
}

export function setupAuthenticatedLogoUploadRoutes(app: express.Express) {
  app.post("/api/restaurant-logo/upload", async (req, res) => {
    try {
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

      const internalRoles = ["admin", "operacoes", "manager", "comercial"];
      const isInternal = internalRoles.includes(user.role || "");
      const isOwnRestaurant = user.role === "restaurante" && user.restaurantId === restaurantId;

      if (!isInternal && !isOwnRestaurant) {
        return res.status(403).json({ error: "Sem permissão para alterar o logotipo deste restaurante." });
      }

      await saveLogoToStorage(file, restaurantId, res);
    } catch (err: any) {
      console.error("Logo upload error:", err);
      if (!res.headersSent) {
        return res.status(500).json({ error: "Erro ao fazer upload do logotipo." });
      }
    }
  });
}
