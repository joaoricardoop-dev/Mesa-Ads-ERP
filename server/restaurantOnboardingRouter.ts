import express from "express";
import { z } from "zod";
import { getDb } from "./db";
import { activeRestaurants, restaurantTerms, termAcceptances, termTemplates } from "../drizzle/schema";
import { users } from "../shared/models/auth";
import { eq, and, sql } from "drizzle-orm";
import { createHash, randomUUID } from "crypto";
import { ensureContact } from "./contactSync";
import { createOnboardingUploadToken } from "./logoUploadRouter";

const DEFAULT_TERMS = `TERMOS DE PARCERIA — mesa.ads

1. OBJETO
O presente Termo de Parceria tem por objetivo formalizar a parceria entre o Restaurante Parceiro e a mesa.ads para a veiculação de mídia publicitária em bolachas de chopp no estabelecimento do Parceiro.

2. OBRIGAÇÕES DO RESTAURANTE PARCEIRO
2.1. Disponibilizar o espaço para colocação das bolachas de chopp nos pontos de consumo;
2.2. Utilizar exclusivamente as bolachas fornecidas pela mesa.ads durante o período de vigência;
2.3. Manter as bolachas em bom estado de conservação e apresentação;
2.4. Permitir a realização de registros fotográficos para comprovação da veiculação;
2.5. Informar imediatamente qualquer indisponibilidade ou problema com o material.

3. OBRIGAÇÕES DA MESA.ADS
3.1. Fornecer as bolachas de chopp em quantidade adequada ao estabelecimento;
3.2. Realizar a logística de entrega e reposição do material;
3.3. Efetuar o pagamento da comissão conforme percentual acordado;
3.4. Respeitar as categorias de anunciantes excluídas pelo Parceiro.

4. REMUNERAÇÃO
O Restaurante Parceiro receberá comissão sobre o valor de veiculação, conforme percentual definido em seu cadastro, pago mensalmente via PIX ou transferência bancária.

5. VIGÊNCIA
Este termo tem vigência indeterminada, podendo ser rescindido por qualquer das partes mediante comunicação prévia de 30 (trinta) dias.

6. CONFIDENCIALIDADE
As partes se comprometem a manter sigilo sobre informações comerciais e financeiras compartilhadas durante a parceria.

7. FORO
Fica eleito o foro da Comarca de São Paulo/SP para dirimir quaisquer dúvidas oriundas do presente Termo.`;

function hashContent(content: string): string {
  return createHash("sha256").update(content).digest("hex");
}

async function getDatabase() {
  const d = await getDb();
  if (!d) throw new Error("Database not available");
  return d;
}

export function setupRestaurantOnboardingRoutes(app: express.Express) {
  const router = express.Router();

  router.get("/terms", async (_req, res) => {
    try {
      const db = await getDatabase();
      const templates = await db
        .select()
        .from(termTemplates)
        .where(and(eq(termTemplates.isActive, true)));

      const restaurantTemplates = templates.filter((t) => {
        try {
          const roles = JSON.parse(t.requiredFor);
          return Array.isArray(roles) && roles.includes("restaurante");
        } catch {
          return false;
        }
      });

      if (restaurantTemplates.length > 0) {
        res.json({
          templates: restaurantTemplates.map((t) => ({
            id: t.id,
            title: t.title,
            content: t.content,
            version: t.version,
          })),
        });
      } else {
        res.json({
          templates: [{ id: null, title: "Termos de Parceria", content: DEFAULT_TERMS, version: 1 }],
        });
      }
    } catch (err) {
      console.error("Get terms error:", err);
      res.json({
        templates: [{ id: null, title: "Termos de Parceria", content: DEFAULT_TERMS, version: 1 }],
      });
    }
  });

  router.get("/invite/:token", async (req, res) => {
    try {
      const db = await getDatabase();
      const { token } = req.params;

      const termRows = await db
        .select()
        .from(restaurantTerms)
        .where(eq(restaurantTerms.inviteToken, token))
        .limit(1);

      const term = termRows[0];
      if (!term) {
        return res.status(404).json({ error: "Convite não encontrado ou expirado" });
      }

      if (term.status === "assinado" || term.status === "vigente") {
        return res.status(400).json({ error: "Este convite já foi aceito" });
      }

      const restRows = await db
        .select()
        .from(activeRestaurants)
        .where(eq(activeRestaurants.id, term.restaurantId))
        .limit(1);

      const restaurant = restRows[0];
      if (!restaurant) {
        return res.status(404).json({ error: "Restaurante não encontrado" });
      }

      const termContent = [
        term.conditions,
        term.remunerationRule,
        term.restaurantObligations,
        term.mesaObligations,
      ].filter(Boolean).join("\n\n") || DEFAULT_TERMS;

      res.json({
        restaurant: {
          id: restaurant.id,
          name: restaurant.name,
          address: restaurant.address,
          neighborhood: restaurant.neighborhood,
          city: restaurant.city,
          state: restaurant.state,
          cnpj: restaurant.cnpj,
          commissionPercent: restaurant.commissionPercent,
        },
        term: {
          id: term.id,
          termNumber: term.termNumber,
          validFrom: term.validFrom,
          validUntil: term.validUntil,
        },
        termContent,
      });
    } catch (err) {
      console.error("Get invite error:", err);
      res.status(500).json({ error: "Erro interno" });
    }
  });

  router.post("/accept-invite", async (req, res) => {
    try {
      const schema = z.object({
        token: z.string().min(1),
        acceptedByName: z.string().min(1),
        acceptedByCpf: z.string().min(11),
        email: z.string().email(),
        password: z.string().min(6),
      });

      const input = schema.parse(req.body);
      const db = await getDatabase();

      const termRows = await db
        .select()
        .from(restaurantTerms)
        .where(eq(restaurantTerms.inviteToken, input.token))
        .limit(1);

      const term = termRows[0];
      if (!term) {
        return res.status(404).json({ error: "Convite não encontrado ou expirado" });
      }
      if (term.status === "assinado" || term.status === "vigente") {
        return res.status(400).json({ error: "Este convite já foi aceito" });
      }

      const restRows = await db
        .select()
        .from(activeRestaurants)
        .where(eq(activeRestaurants.id, term.restaurantId))
        .limit(1);
      const restaurant = restRows[0];
      if (!restaurant) {
        return res.status(404).json({ error: "Restaurante não encontrado" });
      }

      const termContent = [
        term.conditions,
        term.remunerationRule,
        term.restaurantObligations,
        term.mesaObligations,
      ].filter(Boolean).join("\n\n") || DEFAULT_TERMS;

      const { createClerkClient } = await import("@clerk/express");
      const clerkClient = createClerkClient({ secretKey: process.env.CLERK_SECRET_KEY! });

      const clerkUser = await clerkClient.users.createUser({
        emailAddress: [input.email],
        password: input.password,
        firstName: input.acceptedByName.split(" ")[0],
        lastName: input.acceptedByName.split(" ").slice(1).join(" ") || undefined,
        publicMetadata: {
          role: "restaurante",
          restaurantId: restaurant.id,
        },
      });

      const { authStorage } = await import("./replit_integrations/auth");
      await authStorage.upsertUser({
        id: clerkUser.id,
        email: input.email,
        firstName: clerkUser.firstName,
        lastName: clerkUser.lastName,
        profileImageUrl: clerkUser.imageUrl,
        role: "restaurante",
        restaurantId: restaurant.id,
        onboardingComplete: true,
        selfRegistered: false,
      });

      await db.insert(termAcceptances).values({
        restaurantId: restaurant.id,
        termId: term.id,
        termContent,
        termHash: hashContent(termContent),
        acceptedByName: input.acceptedByName,
        acceptedByCpf: input.acceptedByCpf,
        acceptedByEmail: input.email,
        ipAddress: (req.headers["x-forwarded-for"] as string || req.socket.remoteAddress || "").split(",")[0].trim(),
        userAgent: req.headers["user-agent"] || null,
        inviteToken: input.token,
      });

      await db
        .update(restaurantTerms)
        .set({ status: "assinado", updatedAt: new Date() })
        .where(eq(restaurantTerms.id, term.id));

      try {
        await ensureContact({
          restaurantId: restaurant.id,
          name: input.acceptedByName,
          email: input.email,
          isPrimary: false,
        });
      } catch (err) {
        console.error("Failed to create contact on accept-invite:", err);
      }

      res.json({ success: true, message: "Conta criada e termos aceitos com sucesso!" });
    } catch (err: any) {
      console.error("Accept invite error:", err);
      if (err?.errors?.[0]?.code === "form_identifier_exists") {
        return res.status(400).json({ error: "Este email já está cadastrado. Faça login na plataforma." });
      }
      if (err?.name === "ZodError") {
        return res.status(400).json({ error: "Dados inválidos. Verifique os campos obrigatórios." });
      }
      res.status(500).json({ error: "Erro ao processar cadastro" });
    }
  });

  router.post("/submit", async (req, res) => {
    try {
      const schema = z.object({
        name: z.string().min(1),
        cnpj: z.string().optional(),
        razaoSocial: z.string().optional(),
        address: z.string().min(1),
        neighborhood: z.string().min(1),
        city: z.string().optional(),
        state: z.string().optional(),
        cep: z.string().optional(),
        googleMapsLink: z.string().optional(),
        instagram: z.string().optional(),
        contactType: z.enum(["proprietario", "gerente", "marketing", "outro"]).optional(),
        contactName: z.string().min(1),
        contactRole: z.string().min(1),
        whatsapp: z.string().min(1),
        email: z.string().email(),
        financialEmail: z.string().optional(),
        tableCount: z.number().int().min(0),
        seatCount: z.number().int().min(0),
        monthlyCustomers: z.number().int().min(0),
        monthlyDrinksSold: z.number().int().min(0).optional(),
        busyDays: z.string().optional(),
        busyHours: z.string().optional(),
        ticketMedio: z.number().min(0).optional(),
        excludedCategories: z.string().optional(),
        photoAuthorization: z.enum(["sim", "nao"]).optional(),
        pixKey: z.string().optional(),
        notes: z.string().optional(),
        acceptedByName: z.string().min(1),
        acceptedByCpf: z.string().min(11),
        accountEmail: z.string().email(),
        accountPassword: z.string().min(6),
        termTemplateIds: z.array(z.number()).optional(),
      });

      const input = schema.parse(req.body);
      const db = await getDatabase();

      const { createClerkClient } = await import("@clerk/express");
      const clerkClient = createClerkClient({ secretKey: process.env.CLERK_SECRET_KEY! });

      let tempClerkUser: any;
      try {
        tempClerkUser = await clerkClient.users.createUser({
          emailAddress: [input.accountEmail],
          password: input.accountPassword,
          firstName: input.acceptedByName.split(" ")[0],
          lastName: input.acceptedByName.split(" ").slice(1).join(" ") || undefined,
          publicMetadata: {
            role: "restaurante",
          },
        });
      } catch (clerkErr: any) {
        const code = clerkErr?.errors?.[0]?.code;
        if (code === "form_password_pwned") {
          return res.status(400).json({ error: "Esta senha foi encontrada em vazamentos de dados. Por segurança, escolha uma senha diferente." });
        }
        if (code === "form_identifier_exists") {
          return res.status(400).json({ error: "Este email já está cadastrado. Faça login na plataforma." });
        }
        if (code === "form_password_length_too_short") {
          return res.status(400).json({ error: "A senha deve ter pelo menos 8 caracteres." });
        }
        throw clerkErr;
      }

      const [restaurant] = await db.insert(activeRestaurants).values({
        name: input.name,
        cnpj: input.cnpj,
        razaoSocial: input.razaoSocial,
        address: input.address,
        neighborhood: input.neighborhood,
        city: input.city,
        state: input.state,
        cep: input.cep,
        googleMapsLink: input.googleMapsLink,
        instagram: input.instagram,
        contactType: input.contactType || "gerente",
        contactName: input.contactName,
        contactRole: input.contactRole,
        whatsapp: input.whatsapp,
        email: input.email,
        financialEmail: input.financialEmail,
        tableCount: input.tableCount,
        seatCount: input.seatCount,
        monthlyCustomers: input.monthlyCustomers,
        monthlyDrinksSold: input.monthlyDrinksSold,
        busyDays: input.busyDays,
        busyHours: input.busyHours,
        ticketMedio: input.ticketMedio ? String(input.ticketMedio) : "0",
        excludedCategories: input.excludedCategories,
        photoAuthorization: input.photoAuthorization || "sim",
        pixKey: input.pixKey,
        notes: input.notes,
      }).returning();

      await clerkClient.users.updateUser(tempClerkUser.id, {
        publicMetadata: {
          role: "restaurante",
          restaurantId: restaurant.id,
        },
      });

      const clerkUser = tempClerkUser;

      const { authStorage } = await import("./replit_integrations/auth");
      await authStorage.upsertUser({
        id: clerkUser.id,
        email: input.accountEmail,
        firstName: clerkUser.firstName,
        lastName: clerkUser.lastName,
        profileImageUrl: clerkUser.imageUrl,
        role: "restaurante",
        restaurantId: restaurant.id,
        onboardingComplete: true,
        selfRegistered: true,
      });

      try {
        await ensureContact({
          restaurantId: restaurant.id,
          name: input.contactName,
          email: input.email,
          phone: input.whatsapp,
          isPrimary: true,
        });
      } catch (err) {
        console.error("Failed to create contact on submit:", err);
      }

      const ipAddress = (req.headers["x-forwarded-for"] as string || req.socket.remoteAddress || "").split(",")[0].trim();
      const userAgent = req.headers["user-agent"] || null;

      const allActiveTemplates = await db
        .select()
        .from(termTemplates)
        .where(eq(termTemplates.isActive, true));

      const requiredTemplates = allActiveTemplates.filter((t) => {
        try {
          const roles = JSON.parse(t.requiredFor || "[]");
          return Array.isArray(roles) && roles.includes("restaurante");
        } catch { return false; }
      });

      const generateTermNum = async () => {
        const year = new Date().getFullYear();
        const pattern = `TRM-${year}-%`;
        const countResult = await db
          .select({ count: sql<number>`COUNT(*)` })
          .from(restaurantTerms)
          .where(sql`${restaurantTerms.termNumber} LIKE ${pattern}`);
        const seqNum = Number(countResult[0]?.count || 0) + 1;
        return `TRM-${year}-${String(seqNum).padStart(4, "0")}`;
      };

      if (requiredTemplates.length > 0) {
        const providedIds = input.termTemplateIds || [];
        const missingIds = requiredTemplates.filter((t) => !providedIds.includes(t.id));
        if (missingIds.length > 0) {
          return res.status(400).json({
            error: `É obrigatório aceitar todos os termos: ${missingIds.map(t => t.title).join(", ")}`,
          });
        }

        for (const tmpl of requiredTemplates) {
          const termNumber = await generateTermNum();
          const [term] = await db.insert(restaurantTerms).values({
            termNumber,
            restaurantId: restaurant.id,
            conditions: tmpl.content,
            status: "assinado",
            inviteEmail: input.accountEmail,
          }).returning();

          await db.insert(termAcceptances).values({
            restaurantId: restaurant.id,
            termId: term.id,
            templateId: tmpl.id,
            termContent: tmpl.content,
            termHash: hashContent(tmpl.content),
            acceptedByName: input.acceptedByName,
            acceptedByCpf: input.acceptedByCpf,
            acceptedByEmail: input.accountEmail,
            ipAddress,
            userAgent,
          });
        }
      } else {
        const termNumber = await generateTermNum();
        const [term] = await db.insert(restaurantTerms).values({
          termNumber,
          restaurantId: restaurant.id,
          conditions: DEFAULT_TERMS,
          status: "assinado",
          inviteEmail: input.accountEmail,
        }).returning();

        await db.insert(termAcceptances).values({
          restaurantId: restaurant.id,
          termId: term.id,
          termContent: DEFAULT_TERMS,
          termHash: hashContent(DEFAULT_TERMS),
          acceptedByName: input.acceptedByName,
          acceptedByCpf: input.acceptedByCpf,
          acceptedByEmail: input.accountEmail,
          ipAddress,
          userAgent,
        });
      }

      const logoUploadToken = createOnboardingUploadToken(restaurant.id);
      res.json({ success: true, message: "Restaurante cadastrado com sucesso!", restaurantId: restaurant.id, logoUploadToken });
    } catch (err: any) {
      console.error("Submit onboarding error:", err);
      const clerkCode = err?.errors?.[0]?.code;
      if (clerkCode === "form_identifier_exists") {
        return res.status(400).json({ error: "Este email já está cadastrado. Faça login na plataforma." });
      }
      if (clerkCode === "form_password_pwned") {
        return res.status(400).json({ error: "Esta senha foi encontrada em vazamentos de dados. Por segurança, escolha uma senha diferente." });
      }
      if (err?.name === "ZodError") {
        return res.status(400).json({ error: "Dados inválidos. Verifique os campos obrigatórios." });
      }
      const message = err?.errors?.[0]?.longMessage || err?.errors?.[0]?.message || "Erro ao processar cadastro";
      res.status(500).json({ error: message });
    }
  });

  app.use("/api/restaurant-onboarding", router);
}
