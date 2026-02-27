import type { Express } from "express";
import bcrypt from "bcryptjs";
import { authStorage } from "./storage";
import { isAuthenticated } from "./replitAuth";
import { getDb } from "../../db";
import { users } from "@shared/models/auth";
import { eq } from "drizzle-orm";

export function registerAuthRoutes(app: Express): void {
  app.get("/api/auth/user", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const user = await authStorage.getUser(userId);
      if (!user) return res.status(404).json({ message: "User not found" });
      const { passwordHash: _, ...safeUser } = user;
      res.json(safeUser);
    } catch (error) {
      console.error("Error fetching user:", error);
      res.status(500).json({ message: "Failed to fetch user" });
    }
  });

  app.post("/api/auth/email-login", async (req: any, res) => {
    try {
      const { email, password } = req.body;
      if (!email || !password) {
        return res.status(400).json({ message: "E-mail e senha são obrigatórios." });
      }

      const db = await getDb();
      if (!db) return res.status(500).json({ message: "Database not available" });

      const [user] = await db.select().from(users).where(eq(users.email, email.toLowerCase().trim()));
      if (!user) {
        return res.status(401).json({ message: "E-mail ou senha inválidos." });
      }
      if (!user.passwordHash) {
        return res.status(401).json({ message: "Esta conta usa login social. Use o login com Google/GitHub." });
      }
      if (user.isActive === false) {
        return res.status(403).json({ message: "Conta desativada. Contate o administrador." });
      }

      const valid = await bcrypt.compare(password, user.passwordHash);
      if (!valid) {
        return res.status(401).json({ message: "E-mail ou senha inválidos." });
      }

      await db.update(users).set({ lastLoginAt: new Date() }).where(eq(users.id, user.id));

      req.login(
        { claims: { sub: user.id, email: user.email, first_name: user.firstName, last_name: user.lastName } },
        (err: any) => {
          if (err) {
            console.error("Login session error:", err);
            return res.status(500).json({ message: "Erro ao criar sessão." });
          }
          const { passwordHash: _, ...safeUser } = user;
          res.json({ ...safeUser, mustChangePassword: user.mustChangePassword });
        }
      );
    } catch (error) {
      console.error("Email login error:", error);
      res.status(500).json({ message: "Erro interno." });
    }
  });

  if (process.env.NODE_ENV === "development") {
    app.post("/api/auth/test-login", async (req: any, res) => {
      try {
        const { userId } = req.body;
        if (!userId) {
          return res.status(400).json({ message: "userId is required" });
        }

        const db = await getDb();
        if (!db) return res.status(500).json({ message: "Database not available" });

        const [user] = await db.select().from(users).where(eq(users.id, parseInt(userId)));
        if (!user) {
          return res.status(404).json({ message: "User not found" });
        }

        await db.update(users).set({ lastLoginAt: new Date() }).where(eq(users.id, user.id));

        const sessionUser = {
          claims: { sub: user.id, email: user.email, first_name: user.firstName, last_name: user.lastName },
          expires_at: Math.floor(Date.now() / 1000) + 7 * 24 * 3600,
        };

        req.login(sessionUser, (err: any) => {
          if (err) {
            return res.status(500).json({ message: "Session error" });
          }
          const { passwordHash: _, ...safeUser } = user;
          res.json(safeUser);
        });
      } catch (error) {
        console.error("Test login error:", error);
        res.status(500).json({ message: "Internal error" });
      }
    });
  }

  app.post("/api/auth/change-password", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const { currentPassword, newPassword } = req.body;

      if (!newPassword || newPassword.length < 6) {
        return res.status(400).json({ message: "A nova senha deve ter pelo menos 6 caracteres." });
      }

      const db = await getDb();
      if (!db) return res.status(500).json({ message: "Database not available" });

      const [user] = await db.select().from(users).where(eq(users.id, userId));
      if (!user) return res.status(404).json({ message: "Usuário não encontrado." });

      if (user.passwordHash && !user.mustChangePassword) {
        if (!currentPassword) {
          return res.status(400).json({ message: "Senha atual é obrigatória." });
        }
        const valid = await bcrypt.compare(currentPassword, user.passwordHash);
        if (!valid) {
          return res.status(401).json({ message: "Senha atual incorreta." });
        }
      }

      const hash = await bcrypt.hash(newPassword, 10);
      await db.update(users).set({
        passwordHash: hash,
        mustChangePassword: false,
        updatedAt: new Date(),
      }).where(eq(users.id, userId));

      res.json({ success: true });
    } catch (error) {
      console.error("Change password error:", error);
      res.status(500).json({ message: "Erro interno." });
    }
  });
}
