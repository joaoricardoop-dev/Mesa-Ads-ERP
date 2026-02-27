import { NOT_ADMIN_ERR_MSG, UNAUTHED_ERR_MSG } from '@shared/const';
import { initTRPC, TRPCError } from "@trpc/server";
import superjson from "superjson";
import type { TrpcContext } from "./context";

const t = initTRPC.context<TrpcContext>().create({
  transformer: superjson,
});

export const router = t.router;
export const publicProcedure = t.procedure;

const requireUser = t.middleware(async opts => {
  const { ctx, next } = opts;

  if (!ctx.user) {
    throw new TRPCError({ code: "UNAUTHORIZED", message: UNAUTHED_ERR_MSG });
  }

  return next({
    ctx: {
      ...ctx,
      user: ctx.user,
    },
  });
});

export const protectedProcedure = t.procedure.use(requireUser);

export const adminProcedure = t.procedure.use(
  t.middleware(async opts => {
    const { ctx, next } = opts;

    if (!ctx.user || ctx.user.role !== 'admin') {
      throw new TRPCError({ code: "FORBIDDEN", message: NOT_ADMIN_ERR_MSG });
    }

    return next({
      ctx: {
        ...ctx,
        user: ctx.user,
      },
    });
  }),
);

function createRoleProcedure(allowedRoles: string[]) {
  return t.procedure.use(
    t.middleware(async opts => {
      const { ctx, next } = opts;

      if (!ctx.user) {
        throw new TRPCError({ code: "UNAUTHORIZED", message: UNAUTHED_ERR_MSG });
      }

      const userRole = ctx.user.role || "user";
      if (userRole !== "admin" && !allowedRoles.includes(userRole)) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "Você não tem permissão para acessar este recurso.",
        });
      }

      return next({
        ctx: {
          ...ctx,
          user: ctx.user,
        },
      });
    }),
  );
}

export const comercialProcedure = createRoleProcedure(["comercial", "manager"]);
export const operacoesProcedure = createRoleProcedure(["operacoes", "manager"]);
export const financeiroProcedure = createRoleProcedure(["financeiro", "manager"]);
export const internalProcedure = createRoleProcedure(["comercial", "operacoes", "financeiro", "manager"]);
