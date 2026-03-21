import { parceiroProcedure, protectedProcedure, adminProcedure, router } from "./_core/trpc";
import { z } from "zod";
import { getDb } from "./db";
import { partners, leads, quotations, clients, users } from "../drizzle/schema";
import { eq, desc, and, sql } from "drizzle-orm";
import { TRPCError } from "@trpc/server";
import { authStorage } from "./replit_integrations/auth";

async function getDatabase() {
  const d = await getDb();
  if (!d) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database not available" });
  return d;
}

export const parceiroPortalRouter = router({
  getDashboard: parceiroProcedure
    .query(async ({ ctx }) => {
      const partnerId = ctx.user.partnerId;
      if (!partnerId) throw new TRPCError({ code: "FORBIDDEN", message: "Usuário não vinculado a nenhum parceiro." });

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
      const commissionEstimated = totalRevenue * Number(partner.commissionPercent) / 100;

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
        pendingQuotations: Number(pendingQuotations[0]?.count || 0),
      };
    }),

  getLeads: parceiroProcedure
    .query(async ({ ctx }) => {
      const partnerId = ctx.user.partnerId;
      if (!partnerId) throw new TRPCError({ code: "FORBIDDEN", message: "Usuário não vinculado a nenhum parceiro." });

      const db = await getDatabase();
      const rows = await db
        .select()
        .from(leads)
        .where(eq(leads.partnerId, partnerId))
        .orderBy(desc(leads.updatedAt));
      return rows;
    }),

  getQuotations: parceiroProcedure
    .query(async ({ ctx }) => {
      const partnerId = ctx.user.partnerId;
      if (!partnerId) throw new TRPCError({ code: "FORBIDDEN", message: "Usuário não vinculado a nenhum parceiro." });

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
      const role = input.partnerId !== null ? "parceiro" : "anunciante";
      const [updated] = await db
        .update(users)
        .set({ partnerId: input.partnerId, role, updatedAt: new Date() })
        .where(eq(users.id, input.userId))
        .returning();
      if (!updated) throw new TRPCError({ code: "NOT_FOUND", message: "Usuário não encontrado." });

      try {
        const { createClerkClient } = await import("@clerk/express");
        const clerkClient = createClerkClient({ secretKey: process.env.CLERK_SECRET_KEY! });
        const cu = await clerkClient.users.getUser(input.userId);
        await clerkClient.users.updateUser(input.userId, {
          publicMetadata: { ...cu.publicMetadata, role, partnerId: input.partnerId },
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
});
