import { adminProcedure, internalProcedure, router } from "./_core/trpc";
import { z } from "zod";
import { TRPCError } from "@trpc/server";
import {
  isConfigured,
  getAuthUrl,
  getConnectionStatus,
  disconnect,
  trackShipments,
  calculateFreight,
} from "./melhorEnvioService";

function getCallbackUrl(): string {
  const domain = process.env.APP_URL || process.env.REPLIT_DEV_DOMAIN;
  if (!domain) return "";
  const base = domain.startsWith("http") ? domain : `https://${domain}`;
  return `${base}/api/melhor-envio/callback`;
}

export const melhorEnvioRouter = router({
  getStatus: internalProcedure.query(async () => {
    return getConnectionStatus();
  }),

  getAuthUrl: adminProcedure.query(() => {
    if (!isConfigured()) {
      throw new TRPCError({
        code: "PRECONDITION_FAILED",
        message: "Configure MELHOR_ENVIO_CLIENT_ID e MELHOR_ENVIO_CLIENT_SECRET nas variáveis de ambiente primeiro.",
      });
    }
    const callbackUrl = getCallbackUrl();
    if (!callbackUrl) {
      throw new TRPCError({
        code: "INTERNAL_SERVER_ERROR",
        message: "URL de callback não configurada. Defina APP_URL ou REPLIT_DEV_DOMAIN.",
      });
    }
    return { url: getAuthUrl(callbackUrl), callbackUrl };
  }),

  disconnect: adminProcedure.mutation(async () => {
    await disconnect();
    return { success: true };
  }),

  trackShipments: internalProcedure
    .input(z.object({ trackingCodes: z.array(z.string().min(1)).min(1).max(20) }))
    .query(async ({ input }) => {
      try {
        return await trackShipments(input.trackingCodes);
      } catch (err: any) {
        throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: err.message });
      }
    }),

  calculateFreight: internalProcedure
    .input(z.object({
      fromPostalCode: z.string().min(8).max(9),
      toPostalCode: z.string().min(8).max(9),
      weight: z.number().positive(),
      height: z.number().positive(),
      width: z.number().positive(),
      length: z.number().positive(),
      quantity: z.number().positive().optional(),
    }))
    .mutation(async ({ input }) => {
      try {
        return await calculateFreight(input);
      } catch (err: any) {
        throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: err.message });
      }
    }),
});
