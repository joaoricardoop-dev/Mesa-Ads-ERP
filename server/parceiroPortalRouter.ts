import { parceiroProcedure, adminProcedure, router } from "./_core/trpc";
import { z } from "zod";
import { getDb } from "./db";
import { partners, leads, quotations, clients, users, leadInteractions, products, productPricingTiers, productDiscountPriceTiers, accountsPayable, campaigns } from "../drizzle/schema";
import { eq, desc, and, sql, asc } from "drizzle-orm";
import { TRPCError } from "@trpc/server";
import { createCrmNotification } from "./notificationRouter";

async function getDatabase() {
  const d = await getDb();
  if (!d) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database not available" });
  return d;
}

function resolvePartnerId(
  ctx: { user: { role?: string | null; partnerId?: number | null } },
  adminPartnerId?: number,
): number {
  if (ctx.user.role === "admin" && adminPartnerId) return adminPartnerId;
  if (ctx.user.partnerId) return ctx.user.partnerId;
  throw new TRPCError({ code: "FORBIDDEN", message: "Usuário não vinculado a nenhum parceiro." });
}

export const parceiroPortalRouter = router({
  getDashboard: parceiroProcedure
    .input(z.object({ adminPartnerId: z.number().optional() }).optional())
    .query(async ({ ctx, input }) => {
      const partnerId = resolvePartnerId(ctx, input?.adminPartnerId);

      const db = await getDatabase();

      const [partner] = await db.select().from(partners).where(eq(partners.id, partnerId)).limit(1);
      if (!partner) throw new TRPCError({ code: "NOT_FOUND", message: "Parceiro não encontrado." });

      const totalLeads = await db
        .select({ count: sql<number>`COUNT(*)` })
        .from(leads)
        .where(eq(leads.partnerId, partnerId));

      const totalQuotations = await db
        .select({ count: sql<number>`COUNT(*)` })
        .from(quotations)
        .where(eq(quotations.partnerId, partnerId));

      const wonQuotations = await db
        .select({ totalValue: quotations.totalValue })
        .from(quotations)
        .where(and(eq(quotations.partnerId, partnerId), eq(quotations.status, "win")));

      const totalRevenue = wonQuotations.reduce((s, q) => s + Number(q.totalValue || 0), 0);

      // Comissão real do parceiro vive em accounts_payable (ledger único,
      // finrefac fase 2). sourceType='bv_campanha' agregada por
      // (partnerId, competenceMonth). Substitui o cálculo live sobre
      // quotations.status='win' (que ignorava recebimento real).
      const partnerIdStr = String(partnerId);
      const commissionRows = await db
        .select({
          id: accountsPayable.id,
          amount: accountsPayable.amount,
          status: accountsPayable.status,
          competenceMonth: accountsPayable.competenceMonth,
          paymentDate: accountsPayable.paymentDate,
          campaignId: accountsPayable.campaignId,
          campaignName: campaigns.name,
          campaignNumber: campaigns.campaignNumber,
          clientName: clients.name,
        })
        .from(accountsPayable)
        .leftJoin(campaigns, eq(campaigns.id, accountsPayable.campaignId))
        .leftJoin(clients, eq(clients.id, campaigns.clientId))
        .where(and(
          eq(accountsPayable.sourceType, "bv_campanha"),
          sql`${accountsPayable.sourceRef}->>'partnerId' = ${partnerIdStr}`,
        ));

      type CampaignItem = {
        accountPayableId: number;
        campaignId: number | null;
        campaignName: string | null;
        campaignNumber: string | null;
        clientName: string | null;
        amount: number;
        status: "paid" | "pending" | "cancelled";
        paymentDate: string | null;
      };
      type MonthEntry = {
        competenceMonth: string;
        paid: number;
        pending: number;
        total: number;
        items: CampaignItem[];
      };
      let commissionPaid = 0;
      let commissionPending = 0;
      const byMonthMap = new Map<string, MonthEntry>();
      for (const r of commissionRows) {
        const v = Number(r.amount || 0);
        const cm = r.competenceMonth || "—";
        const isPaid = r.status === "pago";
        const isCancelled = r.status === "cancelada";
        if (isPaid) commissionPaid += v;
        else if (!isCancelled) commissionPending += v;
        const entry = byMonthMap.get(cm) ?? { competenceMonth: cm, paid: 0, pending: 0, total: 0, items: [] };
        if (isPaid) entry.paid += v;
        else if (!isCancelled) entry.pending += v;
        entry.total = entry.paid + entry.pending;
        if (!isCancelled) {
          entry.items.push({
            accountPayableId: r.id,
            campaignId: r.campaignId,
            campaignName: r.campaignName,
            campaignNumber: r.campaignNumber,
            clientName: r.clientName,
            amount: v,
            status: isPaid ? "paid" : "pending",
            paymentDate: r.paymentDate ? String(r.paymentDate) : null,
          });
        }
        byMonthMap.set(cm, entry);
      }
      const commissionByMonth = Array.from(byMonthMap.values()).sort((a, b) => b.competenceMonth.localeCompare(a.competenceMonth));
      const commissionTotal = commissionPaid + commissionPending;
      // Mantém commissionEstimated como alias do total realizado/em-aberto
      // (compat com clientes antigos do dashboard).
      const commissionEstimated = commissionTotal;

      const pendingQuotations = await db
        .select({ count: sql<number>`COUNT(*)` })
        .from(quotations)
        .where(and(
          eq(quotations.partnerId, partnerId),
          sql`${quotations.status} IN ('rascunho','enviada','ativa')`
        ));

      return {
        partner,
        totalLeads: Number(totalLeads[0]?.count || 0),
        totalQuotations: Number(totalQuotations[0]?.count || 0),
        wonDeals: wonQuotations.length,
        totalRevenue,
        commissionEstimated,
        commissionPaid,
        commissionPending,
        commissionTotal,
        commissionByMonth,
        pendingQuotations: Number(pendingQuotations[0]?.count || 0),
      };
    }),

  getLeads: parceiroProcedure
    .input(z.object({
      stage: z.string().optional(),
      adminPartnerId: z.number().optional(),
    }).optional())
    .query(async ({ ctx, input }) => {
      const partnerId = resolvePartnerId(ctx, input?.adminPartnerId);

      const db = await getDatabase();
      const rows = await db
        .select()
        .from(leads)
        .where(
          input?.stage
            ? and(eq(leads.partnerId, partnerId), eq(leads.stage, input.stage))
            : eq(leads.partnerId, partnerId)
        )
        .orderBy(desc(leads.updatedAt));

      const enriched = await Promise.all(rows.map(async (lead) => {
        const leadQuotations = await db
          .select({
            id: quotations.id,
            quotationNumber: quotations.quotationNumber,
            totalValue: quotations.totalValue,
            status: quotations.status,
            createdAt: quotations.createdAt,
          })
          .from(quotations)
          .where(eq(quotations.leadId, lead.id))
          .orderBy(desc(quotations.createdAt))
          .limit(1);
        return {
          ...lead,
          latestQuotation: leadQuotations[0] || null,
          hasQuotation: leadQuotations.length > 0,
        };
      }));

      return enriched;
    }),

  getLeadDetail: parceiroProcedure
    .input(z.object({ leadId: z.number(), adminPartnerId: z.number().optional() }))
    .query(async ({ ctx, input }) => {
      const partnerId = resolvePartnerId(ctx, input.adminPartnerId);

      const db = await getDatabase();

      const [lead] = await db
        .select()
        .from(leads)
        .where(and(eq(leads.id, input.leadId), eq(leads.partnerId, partnerId)))
        .limit(1);

      if (!lead) throw new TRPCError({ code: "NOT_FOUND", message: "Lead não encontrado ou sem permissão." });

      const stageHistory = await db
        .select()
        .from(leadInteractions)
        .where(and(eq(leadInteractions.leadId, lead.id), eq(leadInteractions.type, "stage_change")))
        .orderBy(desc(leadInteractions.createdAt));

      const leadQuotations = await db
        .select({
          id: quotations.id,
          quotationNumber: quotations.quotationNumber,
          quotationName: quotations.quotationName,
          coasterVolume: quotations.coasterVolume,
          cycles: quotations.cycles,
          totalValue: quotations.totalValue,
          status: quotations.status,
          createdAt: quotations.createdAt,
          updatedAt: quotations.updatedAt,
          productId: quotations.productId,
          productName: products.name,
        })
        .from(quotations)
        .leftJoin(products, eq(quotations.productId, products.id))
        .where(eq(quotations.leadId, lead.id))
        .orderBy(desc(quotations.createdAt));

      return {
        ...lead,
        stageHistory,
        quotations: leadQuotations,
      };
    }),

  createLead: parceiroProcedure
    .input(z.object({
      name: z.string().min(1, "Nome é obrigatório"),
      company: z.string().optional(),
      cnpj: z.string().optional(),
      contactName: z.string().optional(),
      contactPhone: z.string().optional(),
      contactEmail: z.string().optional(),
      city: z.string().optional(),
      state: z.string().optional(),
      notes: z.string().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const partnerId = ctx.user.partnerId;
      if (!partnerId) throw new TRPCError({ code: "FORBIDDEN", message: "Usuário não vinculado a nenhum parceiro." });

      const db = await getDatabase();

      const [created] = await db.insert(leads).values({
        ...input,
        type: "anunciante",
        origin: "parceiro",
        stage: "novo",
        partnerId,
      }).returning();

      return created;
    }),

  convertLeadToClient: parceiroProcedure
    .input(z.object({
      leadId: z.number().int().positive(),
      adminPartnerId: z.number().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const partnerId = resolvePartnerId(ctx, input.adminPartnerId);
      const db = await getDatabase();

      const [lead] = await db
        .select()
        .from(leads)
        .where(and(eq(leads.id, input.leadId), eq(leads.partnerId, partnerId)))
        .limit(1);
      if (!lead) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Lead não encontrado ou sem permissão." });
      }

      if (lead.clientId) {
        const [existing] = await db
          .select()
          .from(clients)
          .where(eq(clients.id, lead.clientId))
          .limit(1);
        if (existing) return existing;
      }

      if (lead.cnpj) {
        const cleanCnpj = lead.cnpj.replace(/\D/g, "");
        if (cleanCnpj.length === 14) {
          const [match] = await db
            .select()
            .from(clients)
            .where(sql`regexp_replace(${clients.cnpj}, '[^0-9]', '', 'g') = ${cleanCnpj}`)
            .limit(1);
          if (match) {
            await db.update(leads)
              .set({ clientId: match.id, convertedToId: match.id, convertedToType: "client", updatedAt: new Date() })
              .where(eq(leads.id, lead.id));
            return match;
          }
        }
      }

      const [created] = await db.insert(clients).values({
        name: lead.contactName || lead.name,
        company: lead.company || lead.name,
        razaoSocial: lead.razaoSocial,
        cnpj: lead.cnpj,
        contactPhone: lead.contactPhone,
        contactEmail: lead.contactEmail,
        instagram: lead.instagram,
        address: lead.address,
        addressNumber: lead.addressNumber,
        neighborhood: lead.neighborhood,
        city: lead.city,
        state: lead.state,
        cep: lead.cep,
        partnerId,
        status: "active",
      }).returning();

      await db.update(leads)
        .set({
          clientId: created.id,
          convertedToId: created.id,
          convertedToType: "client",
          stage: "ganho",
          updatedAt: new Date(),
        })
        .where(eq(leads.id, lead.id));

      return created;
    }),

  getQuotations: parceiroProcedure
    .input(z.object({ adminPartnerId: z.number().optional() }).optional())
    .query(async ({ ctx, input }) => {
      const partnerId = resolvePartnerId(ctx, input?.adminPartnerId);

      const db = await getDatabase();
      const rows = await db
        .select({
          id: quotations.id,
          quotationNumber: quotations.quotationNumber,
          quotationName: quotations.quotationName,
          clientId: quotations.clientId,
          totalValue: quotations.totalValue,
          status: quotations.status,
          createdAt: quotations.createdAt,
          validUntil: quotations.validUntil,
          clientName: clients.name,
        })
        .from(quotations)
        .leftJoin(clients, eq(quotations.clientId, clients.id))
        .where(eq(quotations.partnerId, partnerId))
        .orderBy(desc(quotations.createdAt));
      return rows;
    }),

  getUsers: adminProcedure
    .input(z.object({ partnerId: z.number() }))
    .query(async ({ input }) => {
      const db = await getDatabase();
      const rows = await db
        .select({
          id: users.id,
          email: users.email,
          firstName: users.firstName,
          lastName: users.lastName,
          role: users.role,
          isActive: users.isActive,
          createdAt: users.createdAt,
        })
        .from(users)
        .where(eq(users.partnerId, input.partnerId));
      return rows;
    }),

  linkUser: adminProcedure
    .input(z.object({
      userId: z.string(),
      partnerId: z.number().nullable(),
    }))
    .mutation(async ({ input }) => {
      const db = await getDatabase();

      const [existing] = await db.select().from(users).where(eq(users.id, input.userId)).limit(1);
      if (!existing) throw new TRPCError({ code: "NOT_FOUND", message: "Usuário não encontrado." });

      const newRole = input.partnerId !== null ? "parceiro" : existing.role ?? "anunciante";

      const [updated] = await db
        .update(users)
        .set({ partnerId: input.partnerId, role: newRole, updatedAt: new Date() })
        .where(eq(users.id, input.userId))
        .returning();
      if (!updated) throw new TRPCError({ code: "NOT_FOUND", message: "Usuário não encontrado." });

      try {
        const { createClerkClient } = await import("@clerk/express");
        const clerkClient = createClerkClient({ secretKey: process.env.CLERK_SECRET_KEY! });
        const cu = await clerkClient.users.getUser(input.userId);
        await clerkClient.users.updateUser(input.userId, {
          publicMetadata: { ...cu.publicMetadata, role: newRole, partnerId: input.partnerId },
        });
      } catch (err) {
        console.error("Failed to update Clerk metadata for partner link:", err);
      }

      return {
        id: updated.id,
        email: updated.email,
        firstName: updated.firstName,
        lastName: updated.lastName,
        role: updated.role,
        partnerId: updated.partnerId,
        isActive: updated.isActive,
        updatedAt: updated.updatedAt,
      };
    }),

  completeOnboarding: parceiroProcedure
    .input(z.object({
      contactName: z.string().optional(),
      contactPhone: z.string().optional(),
      contactEmail: z.string().email().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const db = await getDatabase();
      await db
        .update(users)
        .set({ onboardingComplete: true, updatedAt: new Date() })
        .where(eq(users.id, ctx.user.id));

      if (ctx.user.partnerId && (input.contactName || input.contactPhone || input.contactEmail)) {
        const updateFields: Partial<typeof partners.$inferInsert> = {};
        if (input.contactName) updateFields.contactName = input.contactName;
        if (input.contactPhone) updateFields.contactPhone = input.contactPhone;
        if (input.contactEmail) updateFields.contactEmail = input.contactEmail;
        if (Object.keys(updateFields).length > 0) {
          await db
            .update(partners)
            .set({ ...updateFields, updatedAt: new Date() })
            .where(eq(partners.id, ctx.user.partnerId));
        }
      }

      return { success: true };
    }),

  getPriceTable: parceiroProcedure
    .input(z.object({ adminPartnerId: z.number().optional() }).optional())
    .query(async ({ ctx, input }) => {
      const partnerId = resolvePartnerId(ctx, input?.adminPartnerId);

      const db = await getDatabase();

      const [partner] = await db.select().from(partners).where(eq(partners.id, partnerId)).limit(1);
      if (!partner) throw new TRPCError({ code: "NOT_FOUND", message: "Parceiro não encontrado." });

      const visibleProducts = await db
        .select()
        .from(products)
        .where(and(eq(products.visibleToPartners, true), eq(products.isActive, true)))
        .orderBy(asc(products.name));

      const productsWithTiers = await Promise.all(
        visibleProducts.map(async (p) => {
          const [tiers, discountTiers] = await Promise.all([
            db.select().from(productPricingTiers).where(eq(productPricingTiers.productId, p.id)).orderBy(asc(productPricingTiers.volumeMin)),
            db.select().from(productDiscountPriceTiers).where(eq(productDiscountPriceTiers.productId, p.id)).orderBy(asc(productDiscountPriceTiers.priceMin)),
          ]);
          return { ...p, tiers, discountTiers };
        })
      );

      return {
        commissionPercent: Number(partner.commissionPercent),
        billingMode: partner.billingMode as "bruto" | "liquido",
        products: productsWithTiers,
      };
    }),

  updateBillingMode: parceiroProcedure
    .input(z.object({
      billingMode: z.enum(["bruto", "liquido"]),
    }))
    .mutation(async ({ ctx, input }) => {
      const partnerId = ctx.user.partnerId;
      if (!partnerId) throw new TRPCError({ code: "FORBIDDEN", message: "Usuário não vinculado a nenhum parceiro." });

      const db = await getDatabase();
      const [updated] = await db
        .update(partners)
        .set({ billingMode: input.billingMode, updatedAt: new Date() })
        .where(eq(partners.id, partnerId))
        .returning();
      if (!updated) throw new TRPCError({ code: "NOT_FOUND", message: "Parceiro não encontrado." });
      return { billingMode: updated.billingMode as "bruto" | "liquido" };
    }),

  createQuotation: parceiroProcedure
    .input(z.object({
      leadId: z.number(),
      productId: z.number(),
      volume: z.number().int().min(1),
      semanas: z.number().int().min(4),
      notes: z.string().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const partnerId = ctx.user.partnerId;
      if (!partnerId) throw new TRPCError({ code: "FORBIDDEN", message: "Usuário não vinculado a nenhum parceiro." });

      const db = await getDatabase();

      const [lead] = await db
        .select()
        .from(leads)
        .where(and(eq(leads.id, input.leadId), eq(leads.partnerId, partnerId)))
        .limit(1);
      if (!lead) throw new TRPCError({ code: "NOT_FOUND", message: "Lead não encontrado ou sem permissão." });

      const [product] = await db
        .select()
        .from(products)
        .where(and(eq(products.id, input.productId), eq(products.visibleToPartners, true), eq(products.isActive, true)))
        .limit(1);
      if (!product) throw new TRPCError({ code: "NOT_FOUND", message: "Produto não encontrado ou não disponível." });

      const [partner] = await db.select().from(partners).where(eq(partners.id, partnerId)).limit(1);
      if (!partner) throw new TRPCError({ code: "NOT_FOUND", message: "Parceiro não encontrado." });

      const [tiers, discountTiers] = await Promise.all([
        db.select().from(productPricingTiers).where(eq(productPricingTiers.productId, input.productId)).orderBy(asc(productPricingTiers.volumeMin)),
        db.select().from(productDiscountPriceTiers).where(eq(productDiscountPriceTiers.productId, input.productId)).orderBy(asc(productDiscountPriceTiers.priceMin)),
      ]);

      let matchedTier = tiers[0];
      for (const t of tiers) {
        if (input.volume >= t.volumeMin) matchedTier = t;
      }
      if (!matchedTier) throw new TRPCError({ code: "BAD_REQUEST", message: "Nenhuma faixa de preço encontrada para o volume informado." });

      const irpj = parseFloat(String(product.irpj ?? "6")) / 100;
      const comRestaurante = parseFloat(String(product.comRestaurante ?? "0")) / 100;
      const comComercialProduto = parseFloat(String(product.comComercial ?? "10")) / 100;
      const BV_PADRAO = 0.20; // preço público sempre com este BV
      const comParceiro = BV_PADRAO;
      const billingMode = (partner.billingMode ?? "bruto") as "bruto" | "liquido";
      const pricingMode = product.pricingMode ?? "cost_based";

      let serverUnitPrice: number;
      if (pricingMode === "price_based") {
        const precoBaseTier = parseFloat(String(matchedTier.precoBase ?? "0"));
        const grossUpDen = 1 - comParceiro - irpj;
        const precoTotal = grossUpDen > 0 ? precoBaseTier / grossUpDen : precoBaseTier;
        serverUnitPrice = input.volume > 0 ? precoTotal / input.volume : 0;
      } else {
        const denominadorBase = 1 - (parseFloat(String(matchedTier.margem)) / 100) - irpj - comRestaurante - comComercialProduto;
        const custoTotal = parseFloat(String(matchedTier.custoUnitario)) * (matchedTier.artes ?? 1) * input.volume + parseFloat(String(matchedTier.frete));
        const precoBase = denominadorBase > 0 && custoTotal > 0 ? custoTotal / denominadorBase : 0;
        const grossUpDen = 1 - comParceiro - irpj;
        const precoTotal = grossUpDen > 0 ? precoBase / grossUpDen : precoBase;
        serverUnitPrice = input.volume > 0 ? precoTotal / input.volume : 0;
      }

      const DESCONTOS_PRAZO: Record<number, number> = {
        4: 0, 8: 3, 12: 5, 16: 7, 20: 9, 24: 11, 28: 13, 32: 15, 36: 17, 40: 19, 44: 21, 48: 23, 52: 25,
      };
      const cycles = Math.ceil(input.semanas / 4);
      // Gross total before any discounts
      const precoBruto = serverUnitPrice * input.volume * cycles;
      // Faixa discount applied on bruto amount first
      const faixaTier = discountTiers.find(t => precoBruto >= parseFloat(String(t.priceMin)) && precoBruto <= parseFloat(String(t.priceMax)));
      const descFaixa = faixaTier ? parseFloat(String(faixaTier.discountPercent)) / 100 : 0;
      const precoPosFaixa = precoBruto * (1 - descFaixa);
      // Then prazo discount
      const dsc = (DESCONTOS_PRAZO[input.semanas] ?? 0) / 100;
      const serverTotalValue = precoPosFaixa * (1 - dsc);
      const effectiveUnitPrice = input.volume > 0 && cycles > 0 ? serverTotalValue / (input.volume * cycles) : serverUnitPrice;

      const entityName = lead.company || lead.name || "Lead";

      const year = new Date().getFullYear();
      const countResult = await db
        .select({ count: sql<number>`COUNT(*)` })
        .from(quotations)
        .where(sql`"quotationNumber" LIKE ${'QOT-' + year + '-%'}`);
      const seqNum = Number(countResult[0]?.count || 0) + 1;
      const quotationNumber = `QOT-${year}-${String(seqNum).padStart(4, "0")}`;

      const MONTH_NAMES = ["Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho", "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"];
      const d = new Date();
      const quotationName = `${MONTH_NAMES[d.getMonth()]} ${d.getFullYear()} | ${entityName} | ${input.volume.toLocaleString("pt-BR")} | ${product.name}`;

      const billingLabel = billingMode === "bruto" ? "Fat. Bruto" : "Fat. Líquido";
      const notesAuto = `Cotação criada pelo parceiro — ${product.name}: ${input.volume.toLocaleString("pt-BR")} un., ${input.semanas} semanas, ${billingLabel}`;

      const [created] = await db.insert(quotations).values({
        quotationNumber,
        quotationName,
        leadId: input.leadId,
        coasterVolume: input.volume,
        cycles,
        unitPrice: effectiveUnitPrice.toFixed(4),
        totalValue: serverTotalValue.toFixed(2),
        includesProduction: true,
        notes: input.notes ? `${notesAuto}\n${input.notes}` : notesAuto,
        productId: input.productId,
        partnerId,
        agencyCommissionPercent: partner.commissionPercent,
      }).returning();

      const partnerLabel = partner?.name || `Parceiro #${partnerId}`;
      await createCrmNotification(db, {
        eventType: "quotation_created",
        leadId: input.leadId,
        partnerId,
        message: `Cotação ${quotationNumber} criada por ${partnerLabel} para ${entityName} (${product.name})`,
      });

      return created;
    }),

  invitePartnerUser: adminProcedure
    .input(z.object({
      email: z.string().email(),
      firstName: z.string().min(1),
      lastName: z.string().optional(),
      partnerId: z.number(),
    }))
    .mutation(async ({ input }) => {
      const { createClerkClient } = await import("@clerk/express");
      const clerkClient = createClerkClient({ secretKey: process.env.CLERK_SECRET_KEY! });
      const email = input.email.toLowerCase().trim();

      try {
        const invitation = await clerkClient.invitations.createInvitation({
          emailAddress: email,
          publicMetadata: {
            role: "parceiro",
            partnerId: input.partnerId,
            firstName: input.firstName,
            lastName: input.lastName || null,
          },
          redirectUrl: undefined,
        });

        return {
          id: invitation.id,
          email,
          firstName: input.firstName,
          role: "parceiro",
          status: invitation.status,
        };
      } catch (err: any) {
        if (err?.errors?.[0]?.code === "form_identifier_exists") {
          throw new TRPCError({ code: "CONFLICT", message: "Já existe um convite ou usuário com este e-mail." });
        }
        throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: err?.message || "Erro ao convidar usuário." });
      }
    }),

  getMyClients: parceiroProcedure
    .input(z.object({ adminPartnerId: z.number().optional() }).optional())
    .query(async ({ ctx, input }) => {
      const partnerId = resolvePartnerId(ctx, input?.adminPartnerId);
      const db = await getDatabase();
      const rows = await db
        .select({
          id: clients.id,
          name: clients.name,
          company: clients.company,
          showAgencyPricing: clients.showAgencyPricing,
        })
        .from(clients)
        .where(eq(clients.partnerId, partnerId));
      return rows;
    }),

  getPriceTableForBuilder: parceiroProcedure
    .input(z.object({ adminPartnerId: z.number().optional() }).optional())
    .query(async ({ ctx, input }) => {
      resolvePartnerId(ctx, input?.adminPartnerId);
      const db = await getDatabase();
      const visibleProducts = await db
        .select()
        .from(products)
        .where(and(eq(products.isActive, true), eq(products.visibleToPartners, true)));
      const productsWithTiers = await Promise.all(
        visibleProducts.map(async (p) => {
          const [tiers, discountTiers] = await Promise.all([
            db.select().from(productPricingTiers).where(eq(productPricingTiers.productId, p.id)).orderBy(asc(productPricingTiers.volumeMin)),
            db.select().from(productDiscountPriceTiers).where(eq(productDiscountPriceTiers.productId, p.id)).orderBy(asc(productDiscountPriceTiers.priceMin)),
          ]);
          return { ...p, tiers, discountTiers };
        })
      );
      return productsWithTiers;
    }),
});
