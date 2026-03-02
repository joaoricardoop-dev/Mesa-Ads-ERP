import type { Express } from "express";
import bcrypt from "bcryptjs";
import { authStorage } from "./storage";
import { isAuthenticated } from "./replitAuth";
import { getDb } from "../../db";
import { users } from "@shared/models/auth";
import { clients } from "../../../drizzle/schema";
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
        {
          claims: { sub: user.id, email: user.email, first_name: user.firstName, last_name: user.lastName },
          expires_at: Math.floor(Date.now() / 1000) + 7 * 24 * 3600,
        },
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

        const [user] = await db.select().from(users).where(eq(users.id, String(userId)));
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

  app.post("/api/auth/register-advertiser", async (req: any, res) => {
    try {
      const { cnpj, email, password, firstName, lastName } = req.body;
      if (!cnpj || !email || !password || !firstName) {
        return res.status(400).json({ message: "CNPJ, nome, e-mail e senha são obrigatórios." });
      }
      if (password.length < 6) {
        return res.status(400).json({ message: "A senha deve ter pelo menos 6 caracteres." });
      }

      const db = await getDb();
      if (!db) return res.status(500).json({ message: "Database not available" });

      const cleanCnpj = cnpj.replace(/\D/g, "");
      const formattedCnpj = cleanCnpj.replace(
        /^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/,
        "$1.$2.$3/$4-$5"
      );

      const clientResults = await db.select().from(clients).where(eq(clients.cnpj, formattedCnpj));
      let client = clientResults[0];
      if (!client) {
        const clientResults2 = await db.select().from(clients).where(eq(clients.cnpj, cleanCnpj));
        client = clientResults2[0];
      }

      if (!client) {
        return res.status(404).json({ message: "CNPJ não encontrado no sistema. Entre em contato com a Mesa Ads." });
      }

      const normalizedEmail = email.toLowerCase().trim();
      const existingUser = await db.select().from(users).where(eq(users.email, normalizedEmail));
      if (existingUser.length > 0) {
        return res.status(409).json({ message: "Já existe uma conta com este e-mail." });
      }

      const existingAnunciante = await db.select().from(users).where(eq(users.clientId, client.id));
      if (existingAnunciante.length > 0) {
        return res.status(409).json({ message: "Já existe um usuário cadastrado para este CNPJ." });
      }

      const hash = await bcrypt.hash(password, 10);
      const [newUser] = await db.insert(users).values({
        email: normalizedEmail,
        firstName,
        lastName: lastName || null,
        role: "anunciante",
        isActive: true,
        passwordHash: hash,
        mustChangePassword: false,
        clientId: client.id,
      }).returning();

      await db.update(users).set({ lastLoginAt: new Date() }).where(eq(users.id, newUser.id));

      req.login(
        {
          claims: { sub: newUser.id, email: newUser.email, first_name: newUser.firstName, last_name: newUser.lastName },
          expires_at: Math.floor(Date.now() / 1000) + 7 * 24 * 3600,
        },
        (err: any) => {
          if (err) {
            console.error("Register session error:", err);
            return res.status(500).json({ message: "Conta criada, mas erro ao iniciar sessão. Faça login." });
          }
          const { passwordHash: _, ...safeUser } = newUser;
          res.json({
            ...safeUser,
            client: {
              id: client.id,
              name: client.name,
              company: client.company,
              razaoSocial: client.razaoSocial,
              cnpj: client.cnpj,
            },
          });
        }
      );
    } catch (error) {
      console.error("Register advertiser error:", error);
      res.status(500).json({ message: "Erro interno ao criar conta." });
    }
  });

  app.get("/api/auth/lookup-client", async (req: any, res) => {
    try {
      const cnpj = (req.query.cnpj as string || "").replace(/\D/g, "");
      if (cnpj.length !== 14) {
        return res.status(400).json({ message: "CNPJ inválido." });
      }

      const db = await getDb();
      if (!db) return res.status(500).json({ message: "Database not available" });

      const formattedCnpj = cnpj.replace(
        /^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/,
        "$1.$2.$3/$4-$5"
      );

      const results = await db.select({
        id: clients.id,
        name: clients.name,
        company: clients.company,
        razaoSocial: clients.razaoSocial,
        cnpj: clients.cnpj,
        segment: clients.segment,
        city: clients.city,
        state: clients.state,
      }).from(clients).where(eq(clients.cnpj, formattedCnpj));

      let client = results[0];
      if (!client) {
        const results2 = await db.select({
          id: clients.id,
          name: clients.name,
          company: clients.company,
          razaoSocial: clients.razaoSocial,
          cnpj: clients.cnpj,
          segment: clients.segment,
          city: clients.city,
          state: clients.state,
        }).from(clients).where(eq(clients.cnpj, cnpj));
        client = results2[0];
      }

      if (!client) {
        return res.status(404).json({ message: "CNPJ não cadastrado no sistema." });
      }

      res.json(client);
    } catch (error) {
      console.error("Lookup client error:", error);
      res.status(500).json({ message: "Erro interno." });
    }
  });

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
