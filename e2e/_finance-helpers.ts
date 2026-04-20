import type { APIRequestContext } from "@playwright/test";

export type DevUser = {
  id: string;
  email: string | null;
  role: string | null;
  clientId: number | null;
  restaurantId: number | null;
  partnerId: number | null;
};

export async function devLoginAdmin(request: APIRequestContext): Promise<DevUser> {
  const res = await request.post("/api/dev-login", { data: {} });
  if (!res.ok()) throw new Error(`dev-login admin failed: ${res.status()} ${await res.text()}`);
  return (await res.json()) as DevUser;
}

export async function devLoginAs(request: APIRequestContext, userId: string): Promise<DevUser> {
  const res = await request.post("/api/dev-login", { data: { userId } });
  if (!res.ok()) throw new Error(`dev-login ${userId} failed: ${res.status()} ${await res.text()}`);
  return (await res.json()) as DevUser;
}

// Após finrefac #9, todos os endpoints dev-ensure-* auto-criam o recurso
// quando ausente (CI sem skip). Mantemos o helper só p/ DRY de POST + erro.
async function devEnsure<T>(
  request: APIRequestContext,
  url: string,
  body: Record<string, unknown>,
): Promise<T> {
  const res = await request.post(url, { data: body });
  if (!res.ok()) {
    throw new Error(`${url} failed: ${res.status()} ${await res.text()}`);
  }
  return (await res.json()) as T;
}

export async function devEnsureRestaurante(
  request: APIRequestContext,
  restaurantId?: number,
): Promise<{ user: DevUser; restaurantId: number }> {
  return devEnsure(request, "/api/dev-ensure-restaurante", restaurantId ? { restaurantId } : {});
}

export async function devEnsureParceiro(
  request: APIRequestContext,
  partnerId?: number,
): Promise<{ user: DevUser; partnerId: number }> {
  return devEnsure(request, "/api/dev-ensure-parceiro", partnerId ? { partnerId } : {});
}

export async function devSeedRestaurantPayment(
  request: APIRequestContext,
  restaurantId: number,
  amount = "123.45",
): Promise<{ id: number; amount: string; status: string }> {
  const res = await request.post("/api/dev-seed-restaurant-payment", {
    data: { restaurantId, amount },
  });
  if (!res.ok()) {
    throw new Error(`dev-seed-restaurant-payment failed: ${res.status()} ${await res.text()}`);
  }
  return (await res.json()) as { id: number; amount: string; status: string };
}

export async function devSeedCampaignForPartner(
  request: APIRequestContext,
  partnerId: number,
): Promise<{ id: number; clientId: number; name: string }> {
  const res = await request.post("/api/dev-seed-campaign-for-partner", {
    data: { partnerId },
  });
  if (!res.ok()) {
    throw new Error(`dev-seed-campaign-for-partner failed: ${res.status()} ${await res.text()}`);
  }
  return (await res.json()) as { id: number; clientId: number; name: string };
}

export async function devEnsureCampaign(
  request: APIRequestContext,
): Promise<{ id: number; created: boolean }> {
  const res = await request.post("/api/dev-ensure-campaign", { data: {} });
  if (!res.ok()) {
    throw new Error(`dev-ensure-campaign failed: ${res.status()} ${await res.text()}`);
  }
  return (await res.json()) as { id: number; created: boolean };
}

export async function devEnsureBankAccount(
  request: APIRequestContext,
): Promise<{ id: number; created: boolean }> {
  const res = await request.post("/api/dev-ensure-bank-account", { data: {} });
  if (!res.ok()) {
    throw new Error(`dev-ensure-bank-account failed: ${res.status()} ${await res.text()}`);
  }
  return (await res.json()) as { id: number; created: boolean };
}

export async function devDeleteUser(request: APIRequestContext, userId: string): Promise<void> {
  if (!userId.startsWith("e2e-")) return;
  const res = await request.post("/api/dev-delete-user", { data: { userId } });
  if (!res.ok()) {
    // Cleanup falha não derruba o teste, mas precisa ser visível em logs
    // p/ evitar acumulação silenciosa de e2e-users no DB.
    console.warn(`[e2e cleanup] dev-delete-user(${userId}) falhou: ${res.status()}`);
  }
}

// ── tRPC helpers (superjson transformer) ──────────────────────────────────────
// Single-procedure endpoints (não batch) para simplicidade nos testes.

export async function trpcQuery<T = unknown>(
  request: APIRequestContext,
  procedure: string,
  input?: unknown,
): Promise<T> {
  const url =
    input === undefined
      ? `/api/trpc/${procedure}`
      : `/api/trpc/${procedure}?input=${encodeURIComponent(JSON.stringify({ json: input }))}`;
  const res = await request.get(url);
  const body = await res.text();
  if (!res.ok()) {
    throw new Error(`trpc query ${procedure} failed: ${res.status()} ${body}`);
  }
  const parsed = JSON.parse(body);
  if (parsed.error) {
    throw new Error(`trpc query ${procedure} error: ${JSON.stringify(parsed.error)}`);
  }
  return parsed.result?.data?.json as T;
}

export async function trpcMutation<T = unknown>(
  request: APIRequestContext,
  procedure: string,
  input?: unknown,
): Promise<T> {
  const res = await request.post(`/api/trpc/${procedure}`, {
    data: { json: input ?? null },
    headers: { "Content-Type": "application/json" },
  });
  const body = await res.text();
  if (!res.ok()) {
    throw new Error(`trpc mutation ${procedure} failed: ${res.status()} ${body}`);
  }
  const parsed = JSON.parse(body);
  if (parsed.error) {
    throw new Error(`trpc mutation ${procedure} error: ${JSON.stringify(parsed.error)}`);
  }
  return parsed.result?.data?.json as T;
}

export function todayIso(offsetDays = 0): string {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() + offsetDays);
  return d.toISOString().split("T")[0];
}

export function daysAgoIso(days: number): string {
  return todayIso(-days);
}

// Pega primeira campanha existente; se nenhuma, lança erro pra que o teste
// seja "skip" no nível superior.
export async function pickAnyCampaign(
  request: APIRequestContext,
): Promise<{ id: number; clientId: number; name: string } | null> {
  // campaign.list pode retornar Array<Campaign> diretamente ou um objeto
  // paginado dependendo do filtro; aceita ambos.
  const result = await trpcQuery<unknown>(request, "campaign.list");
  const rows: Array<{ id: number; clientId: number; name: string }> = Array.isArray(result)
    ? (result as Array<{ id: number; clientId: number; name: string }>)
    : ((result as { items?: Array<{ id: number; clientId: number; name: string }> })?.items ?? []);
  return rows.length > 0 ? rows[0] : null;
}

