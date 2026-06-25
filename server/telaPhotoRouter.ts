import express from "express";
import multer from "multer";
import { getDb } from "./db";
import { objectStorageClient } from "./replit_integrations/object_storage";

// Upload de fotos das telas. Diferente do logo do restaurante, este endpoint é
// DESACOPLADO do banco: ele apenas grava o arquivo no object storage e devolve
// a URL pública. A associação com a tela é feita depois via tela.create /
// tela.update (campo photoUrls), mantendo o banco como fonte única do vínculo.

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    if (file.mimetype === "image/png" || file.mimetype === "image/jpeg") {
      cb(null, true);
    } else {
      cb(new Error("Apenas arquivos PNG ou JPG são aceitos."));
    }
  },
});

function handleUpload(req: express.Request, res: express.Response): Promise<void> {
  return new Promise((resolve) => {
    upload.single("photo")(req, res, (err) => {
      if (err) {
        if (err instanceof multer.MulterError && err.code === "LIMIT_FILE_SIZE") {
          res.status(400).json({ error: "Arquivo muito grande. Máximo: 5MB." });
        } else {
          res.status(400).json({ error: err.message || "Erro no upload." });
        }
        return resolve();
      }
      resolve();
    });
  });
}

function getBucketName(): string {
  const searchPaths = process.env.PUBLIC_OBJECT_SEARCH_PATHS || "";
  const firstPath = searchPaths.split(",")[0]?.trim();
  if (firstPath) {
    const parts = firstPath.replace(/^\//, "").split("/");
    if (parts[0]) return parts[0];
  }
  throw new Error("PUBLIC_OBJECT_SEARCH_PATHS not configured — cannot determine storage bucket.");
}

export function setupPublicTelaPhotoRoutes(app: express.Express) {
  app.get("/api/tela-photo/serve/:objectName(*)", async (_req, res) => {
    try {
      const objectName = _req.params.objectName;
      if (!objectName || !objectName.startsWith("tela-photos/")) {
        return res.status(400).json({ error: "Caminho inválido." });
      }

      const bucketName = getBucketName();
      const bucket = objectStorageClient.bucket(bucketName);
      const gcsFile = bucket.file(objectName);

      const [exists] = await gcsFile.exists();
      if (!exists) {
        return res.status(404).json({ error: "Arquivo não encontrado." });
      }

      const [metadata] = await gcsFile.getMetadata();
      res.set({
        "Content-Type": (metadata.contentType as string) || "image/png",
        "Cache-Control": "public, max-age=31536000, immutable",
      });

      const stream = gcsFile.createReadStream();
      stream.on("error", (err) => {
        console.error("Tela photo stream error:", err);
        if (!res.headersSent) {
          res.status(500).json({ error: "Erro ao ler arquivo." });
        }
      });
      stream.pipe(res);
    } catch (err: any) {
      console.error("Tela photo serve error:", err);
      if (!res.headersSent) {
        return res.status(500).json({ error: "Erro ao servir imagem." });
      }
    }
  });
}

export function setupAuthenticatedTelaPhotoRoutes(app: express.Express) {
  app.post("/api/tela-photo/upload", async (req, res) => {
    try {
      await handleUpload(req, res);
      if (res.headersSent) return;

      const file = req.file;
      if (!file) {
        return res.status(400).json({ error: "Nenhum arquivo enviado." });
      }

      // Resolve o usuário do mesmo modo que /api/auth/user e o contexto tRPC:
      // em desenvolvimento o login usa o cookie dev_user_id (Clerk não enxerga),
      // então priorizamos esse cookie antes de cair no Clerk (produção).
      let userId: string | null = null;
      if (process.env.NODE_ENV === "development") {
        const devUserId = (req as any).cookies?.dev_user_id;
        if (devUserId) userId = String(devUserId);
      }
      if (!userId) {
        const { getAuth } = await import("@clerk/express");
        const auth = getAuth(req);
        userId = auth?.userId ?? null;
      }
      if (!userId) {
        return res.status(401).json({ error: "Não autorizado." });
      }

      const { users } = await import("../drizzle/schema");
      const db = await getDb();
      if (!db) return res.status(500).json({ error: "Banco de dados indisponível." });

      const { eq: eqOp } = await import("drizzle-orm");
      const [user] = await db
        .select({ role: users.role })
        .from(users)
        .where(eqOp(users.id, userId))
        .limit(1);

      if (!user) return res.status(403).json({ error: "Usuário não encontrado." });

      const allowedRoles = ["admin", "operacoes", "manager", "comercial", "restaurante"];
      if (!allowedRoles.includes(user.role || "")) {
        return res.status(403).json({ error: "Sem permissão para enviar fotos de telas." });
      }

      const ext = file.mimetype === "image/jpeg" ? "jpg" : "png";
      const objectName = `tela-photos/tela-${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;

      const bucketName = getBucketName();
      const bucket = objectStorageClient.bucket(bucketName);
      const gcsFile = bucket.file(objectName);

      await gcsFile.save(file.buffer, {
        contentType: file.mimetype,
        metadata: { cacheControl: "public, max-age=31536000" },
      });

      const url = `/api/tela-photo/serve/${encodeURIComponent(objectName)}`;
      return res.json({ url });
    } catch (err: any) {
      console.error("Tela photo upload error:", err);
      if (!res.headersSent) {
        return res.status(500).json({ error: "Erro ao fazer upload da foto da tela." });
      }
    }
  });
}
