import { getDb } from "./db";
import { integrationTokens } from "../drizzle/schema";
import { eq } from "drizzle-orm";

const PROVIDER = "melhor_envio";

function getBaseUrl(sandbox: boolean) {
  return sandbox
    ? "https://sandbox.melhorenvio.com.br"
    : "https://melhorenvio.com.br";
}

function isSandbox(): boolean {
  return process.env.MELHOR_ENVIO_SANDBOX === "true";
}

function getClientId(): string {
  return process.env.MELHOR_ENVIO_CLIENT_ID || "";
}

function getClientSecret(): string {
  return process.env.MELHOR_ENVIO_CLIENT_SECRET || "";
}

function getAppName(): string {
  return process.env.MELHOR_ENVIO_APP_NAME || "Mesa ADS (contato@mesaads.com.br)";
}

export function isConfigured(): boolean {
  return !!getClientId() && !!getClientSecret();
}

export function getAuthUrl(callbackUrl: string): string {
  const base = getBaseUrl(isSandbox());
  const scopes = ["shipping-calculate", "shipping-tracking"].join(" ");
  const params = new URLSearchParams({
    client_id: getClientId(),
    redirect_uri: callbackUrl,
    response_type: "code",
    scope: scopes,
  });
  return `${base}/oauth/authorize?${params.toString()}`;
}

export async function exchangeCode(code: string, callbackUrl: string): Promise<void> {
  const base = getBaseUrl(isSandbox());
  const res = await fetch(`${base}/oauth/token`, {
    method: "POST",
    headers: {
      "Accept": "application/json",
      "Content-Type": "application/json",
      "User-Agent": getAppName(),
    },
    body: JSON.stringify({
      grant_type: "authorization_code",
      client_id: Number(getClientId()),
      client_secret: getClientSecret(),
      redirect_uri: callbackUrl,
      code,
    }),
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Melhor Envio token error ${res.status}: ${body}`);
  }

  const data = await res.json();
  await storeToken(data);
}

async function storeToken(data: any): Promise<void> {
  const db = await getDb();
  if (!db) throw new Error("Database unavailable");

  const expiresAt = data.expires_in
    ? new Date(Date.now() + data.expires_in * 1000)
    : null;

  await db
    .insert(integrationTokens)
    .values({
      provider: PROVIDER,
      accessToken: data.access_token,
      refreshToken: data.refresh_token,
      tokenType: data.token_type || "Bearer",
      expiresAt: expiresAt ?? undefined,
      scopes: data.scope || null,
      updatedAt: new Date(),
    })
    .onConflictDoUpdate({
      target: integrationTokens.provider,
      set: {
        accessToken: data.access_token,
        refreshToken: data.refresh_token,
        tokenType: data.token_type || "Bearer",
        expiresAt: expiresAt ?? undefined,
        scopes: data.scope || null,
        updatedAt: new Date(),
      },
    });
}

async function refreshAccessToken(refreshToken: string): Promise<void> {
  const base = getBaseUrl(isSandbox());
  const res = await fetch(`${base}/oauth/token`, {
    method: "POST",
    headers: {
      "Accept": "application/json",
      "Content-Type": "application/json",
      "User-Agent": getAppName(),
    },
    body: JSON.stringify({
      grant_type: "refresh_token",
      client_id: Number(getClientId()),
      client_secret: getClientSecret(),
      refresh_token: refreshToken,
    }),
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Melhor Envio refresh error ${res.status}: ${body}`);
  }

  const data = await res.json();
  await storeToken(data);
}

async function getValidToken(): Promise<string> {
  const db = await getDb();
  if (!db) throw new Error("Database unavailable");

  const [row] = await db
    .select()
    .from(integrationTokens)
    .where(eq(integrationTokens.provider, PROVIDER))
    .limit(1);

  if (!row || !row.accessToken) {
    throw new Error("Melhor Envio não está conectado. Autorize nas configurações.");
  }

  const BUFFER_MS = 5 * 60 * 1000;
  if (row.expiresAt && row.expiresAt.getTime() - Date.now() < BUFFER_MS) {
    if (!row.refreshToken) throw new Error("Token expirado e sem refresh token. Reconecte nas configurações.");
    await refreshAccessToken(row.refreshToken);
    const [refreshed] = await db
      .select()
      .from(integrationTokens)
      .where(eq(integrationTokens.provider, PROVIDER))
      .limit(1);
    if (!refreshed?.accessToken) throw new Error("Falha ao renovar token. Reconecte nas configurações.");
    return refreshed.accessToken;
  }

  return row.accessToken;
}

export async function getConnectionStatus(): Promise<{
  connected: boolean;
  configured: boolean;
  sandbox: boolean;
  expiresAt: string | null;
  scopes: string | null;
}> {
  const configured = isConfigured();
  const sandbox = isSandbox();

  if (!configured) {
    return { connected: false, configured: false, sandbox, expiresAt: null, scopes: null };
  }

  const db = await getDb();
  if (!db) return { connected: false, configured, sandbox, expiresAt: null, scopes: null };

  const [row] = await db
    .select()
    .from(integrationTokens)
    .where(eq(integrationTokens.provider, PROVIDER))
    .limit(1);

  return {
    connected: !!row?.accessToken,
    configured,
    sandbox,
    expiresAt: row?.expiresAt ? row.expiresAt.toISOString() : null,
    scopes: row?.scopes || null,
  };
}

export async function disconnect(): Promise<void> {
  const db = await getDb();
  if (!db) return;
  await db.delete(integrationTokens).where(eq(integrationTokens.provider, PROVIDER));
}

export interface TrackingResult {
  trackingCode: string;
  status: string | null;
  events: Array<{
    date: string;
    description: string;
    location: string;
  }>;
  error?: string;
}

export async function trackShipments(trackingCodes: string[]): Promise<TrackingResult[]> {
  const token = await getValidToken();
  const base = getBaseUrl(isSandbox());

  const results: TrackingResult[] = [];

  for (const code of trackingCodes) {
    try {
      const res = await fetch(
        `${base}/api/v2/me/shipment/tracking?q=${encodeURIComponent(code)}`,
        {
          headers: {
            "Authorization": `Bearer ${token}`,
            "Accept": "application/json",
            "Content-Type": "application/json",
            "User-Agent": getAppName(),
          },
        }
      );

      if (!res.ok) {
        const body = await res.text();
        results.push({ trackingCode: code, status: null, events: [], error: `Erro ${res.status}: ${body}` });
        continue;
      }

      const data = await res.json();

      const shipmentData = Array.isArray(data) ? data[0] : data;
      const events = (shipmentData?.tracking?.events || []).map((ev: any) => ({
        date: ev.date || ev.created_at || "",
        description: ev.description || ev.message || "",
        location: ev.location || "",
      }));

      results.push({
        trackingCode: code,
        status: shipmentData?.tracking?.status || shipmentData?.status || null,
        events,
      });
    } catch (err: any) {
      results.push({ trackingCode: code, status: null, events: [], error: err.message });
    }
  }

  return results;
}

export interface FreightQuoteParams {
  fromPostalCode: string;
  toPostalCode: string;
  weight: number;
  height: number;
  width: number;
  length: number;
  quantity?: number;
}

export interface FreightQuoteResult {
  serviceId: number;
  serviceName: string;
  companyName: string;
  price: number;
  currency: string;
  deliveryDays: number | null;
  error?: string | null;
}

export async function calculateFreight(params: FreightQuoteParams): Promise<FreightQuoteResult[]> {
  const token = await getValidToken();
  const base = getBaseUrl(isSandbox());

  const body = {
    from: { postal_code: params.fromPostalCode.replace(/\D/g, "") },
    to: { postal_code: params.toPostalCode.replace(/\D/g, "") },
    products: [
      {
        id: "coaster-pack",
        width: params.width,
        height: params.height,
        length: params.length,
        weight: params.weight,
        insurance_value: 0,
        quantity: params.quantity || 1,
      },
    ],
    options: {
      receipt: false,
      own_hand: false,
    },
    services: "",
  };

  const res = await fetch(`${base}/api/v2/me/shipment/calculate`, {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${token}`,
      "Accept": "application/json",
      "Content-Type": "application/json",
      "User-Agent": getAppName(),
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const errBody = await res.text();
    throw new Error(`Melhor Envio calculate error ${res.status}: ${errBody}`);
  }

  const data = await res.json();
  const services: FreightQuoteResult[] = [];

  for (const s of Array.isArray(data) ? data : []) {
    if (s.error) {
      services.push({
        serviceId: s.id,
        serviceName: s.name || "",
        companyName: s.company?.name || "",
        price: 0,
        currency: "BRL",
        deliveryDays: null,
        error: s.error,
      });
    } else {
      services.push({
        serviceId: s.id,
        serviceName: s.name || "",
        companyName: s.company?.name || "",
        price: parseFloat(s.price || "0"),
        currency: s.currency || "BRL",
        deliveryDays: s.delivery_time || null,
        error: null,
      });
    }
  }

  return services;
}
