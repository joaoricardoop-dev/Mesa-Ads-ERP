const PRODUCTION_FALLBACK = "https://app.mesaads.com.br";

function normalize(raw: string): string {
  let url = raw.trim();
  if (!url) return "";
  if (!/^https?:\/\//i.test(url)) {
    url = `https://${url}`;
  }
  return url.replace(/\/+$/, "");
}

/**
 * Resolve a URL pública canônica do app.
 *
 * Prioridade:
 *   1. APP_URL (se setado) — fonte autoritária para qualquer ambiente.
 *   2. Em produção (NODE_ENV=production) sem APP_URL → cai no domínio
 *      hardcoded `https://app.mesaads.com.br` como rede de segurança.
 *   3. Em dev com REPLIT_DEV_DOMAIN → usa o domínio do workspace.
 *   4. Último fallback → o domínio canônico de produção.
 *
 * Garante que o retorno SEMPRE comece com `https://` e NUNCA termine
 * com `/`. Use `appUrl()` em vez de `process.env.APP_URL` direto pra
 * evitar links de convite Clerk / OAuth callbacks apontando pro
 * workspace dev em produção (o que já queimou um cliente em apresentação).
 */
export function appUrl(): string {
  const fromEnv = process.env.APP_URL;
  if (fromEnv && fromEnv.trim()) return normalize(fromEnv);

  if (process.env.NODE_ENV === "production") {
    return PRODUCTION_FALLBACK;
  }

  const dev = process.env.REPLIT_DEV_DOMAIN;
  if (dev && dev.trim()) return normalize(dev);

  return PRODUCTION_FALLBACK;
}
