import express from "express";
import multer from "multer";
import { getDb } from "./db";
import { objectStorageClient } from "./replit_integrations/object_storage";

// Upload do arquivo de material de veiculação (backoffice). Mesmo padrão do
// telaPhotoRouter: o endpoint só grava o arquivo no object storage e devolve a
// URL; o vínculo com campanha×local é feito via backoffice.screenMaterial.upsert
// (campos attachmentUrl/attachmentName), mantendo o banco como fonte única.

const ALLOWED_MIMES: Record<string, string> = {
  "image/png": "png",
  "image/jpeg": "jpg",
  "application/pdf": "pdf",
  "video/mp4": "mp4",
  "application/zip": "zip",
  "application/x-zip-compressed": "zip",
};

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 25 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    if (ALLOWED_MIMES[file.mimetype]) cb(null, true);
    else cb(new Error("Formato não aceito. Use PNG, JPG, PDF, MP4 ou ZIP."));
  },
});

function handleUpload(req: express.Request, res: express.Response): Promise<void> {
  return new Promise((resolve) => {
    upload.single("file")(req, res, (err) => {
      if (err) {
        if (err instanceof multer.MulterError && err.code === "LIMIT_FILE_SIZE") {
          res.status(400).json({ error: "Arquivo muito grande. Máximo: 25MB." });
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

export function setupBackofficeMaterialRoutes(app: express.Express) {
  app.get("/api/backoffice-material/serve/:objectName(*)", async (req, res) => {
    try {
      const objectName = req.params.objectName;
      if (!objectName || !objectName.startsWith("backoffice-material/")) {
        return res.status(400).json({ error: "Caminho inválido." });
      }
      const bucket = objectStorageClient.bucket(getBucketName());
      const gcsFile = bucket.file(objectName);
      const [exists] = await gcsFile.exists();
      if (!exists) return res.status(404).json({ error: "Arquivo não encontrado." });

      const [metadata] = await gcsFile.getMetadata();
      res.set({
        "Content-Type": (metadata.contentType as string) || "application/octet-stream",
        "Cache-Control": "public, max-age=31536000, immutable",
      });
      const stream = gcsFile.createReadStream();
      stream.on("error", (err) => {
        console.error("Backoffice material stream error:", err);
        if (!res.headersSent) res.status(500).json({ error: "Erro ao ler arquivo." });
      });
      stream.pipe(res);
    } catch (err: any) {
      console.error("Backoffice material serve error:", err);
      if (!res.headersSent) return res.status(500).json({ error: "Erro ao servir arquivo." });
    }
  });

  app.post("/api/backoffice-material/upload", async (req, res) => {
    try {
      await handleUpload(req, res);
      if (res.headersSent) return;

      const file = req.file;
      if (!file) return res.status(400).json({ error: "Nenhum arquivo enviado." });

      // Mesma resolução de usuário do telaPhotoRouter (dev cookie → Clerk).
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
      if (!userId) return res.status(401).json({ error: "Não autorizado." });

      const { users } = await import("../drizzle/schema");
      const db = await getDb();
      if (!db) return res.status(500).json({ error: "Banco de dados indisponível." });
      const { eq: eqOp } = await import("drizzle-orm");
      const [user] = await db.select({ role: users.role }).from(users).where(eqOp(users.id, userId)).limit(1);
      if (!user) return res.status(403).json({ error: "Usuário não encontrado." });

      const allowedRoles = ["admin", "manager", "backoffice"];
      if (!allowedRoles.includes(user.role || "")) {
        return res.status(403).json({ error: "Sem permissão para enviar material." });
      }

      const ext = ALLOWED_MIMES[file.mimetype] || "bin";
      const objectName = `backoffice-material/material-${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
      const bucket = objectStorageClient.bucket(getBucketName());
      await bucket.file(objectName).save(file.buffer, {
        contentType: file.mimetype,
        metadata: { cacheControl: "public, max-age=31536000" },
      });

      const url = `/api/backoffice-material/serve/${encodeURIComponent(objectName)}`;
      return res.json({ url, name: file.originalname });
    } catch (err: any) {
      console.error("Backoffice material upload error:", err);
      if (!res.headersSent) return res.status(500).json({ error: "Erro ao fazer upload do material." });
    }
  });
}
