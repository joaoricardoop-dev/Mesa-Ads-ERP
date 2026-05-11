import { clerkMiddleware } from "@clerk/express";
import type { Express, Request, Response, NextFunction } from "express";

// Cookies que o Clerk usa pra rastrear sessão e handshake. Quando estão
// inválidos ou de outra instância (ex.: rotação de chave pública, cookie
// vazado de outro ambiente), o middleware tenta um handshake 307 que pode
// terminar em 403 cru pro usuário. Esses são todos os nomes que a gente
// limpa quando precisa "resetar" a sessão.
const CLERK_COOKIE_NAMES = [
  "__session",
  "__client_uat",
  "__clerk_db_jwt",
  "__clerk_handshake",
  "__clerk_handshake_nonce",
];

function clearClerkCookies(req: Request, res: Response): void {
  const host = req.hostname || "";
  const parts = host.split(".").filter(Boolean);
  const parentDomain =
    parts.length >= 2 ? `.${parts.slice(-2).join(".")}` : undefined;
  for (const name of CLERK_COOKIE_NAMES) {
    res.clearCookie(name, { path: "/" });
    if (parentDomain) res.clearCookie(name, { path: "/", domain: parentDomain });
  }
}

function isHtmlNavigation(req: Request): boolean {
  if (req.method !== "GET" && req.method !== "HEAD") return false;
  const p = req.path;
  if (p.startsWith("/api/")) return false;
  if (p.startsWith("/assets/")) return false;
  if (p.startsWith("/static/")) return false;
  const accept = (req.headers.accept || "").toLowerCase();
  return accept.includes("text/html") || accept === "*/*" || accept === "";
}

export function setupClerkAuth(app: Express): void {
  app.set("trust proxy", 1);
  const clerk = clerkMiddleware();

  app.use((req: Request, res: Response, next: NextFunction) => {
    const nav = isHtmlNavigation(req);

    // Pra rotas que NÃO são navegação HTML (APIs, assets, etc.) deixamos o
    // Clerk se comportar normalmente, mas absorvemos qualquer erro pra não
    // quebrar a request — tRPC e routers de API já tratam ausência de auth
    // retornando 401 limpo.
    if (!nav) {
      return clerk(req, res, (err?: unknown) => {
        if (err) {
          const msg = err instanceof Error ? err.message : String(err);
          console.warn(`[Clerk] erro non-nav em ${req.path}: ${msg}`);
          return next();
        }
        next();
      });
    }

    // Pra navegações HTML (o usuário abrindo o app no navegador): se o Clerk
    // decidir que a sessão está em estado ruim (handshake 307, ou erro
    // cuspido por next(err)), interceptamos. Limpamos os cookies podres e
    // deixamos a SPA renderizar — a useAuth no client vai ver "deslogado" e
    // mostrar a tela de login normalmente. Sem isso o usuário ficava preso
    // num 403 Forbidden cru sem caminho de saída.
    let intercepted = false;
    const originalStatus = res.status.bind(res);
    const originalEnd = res.end.bind(res);

    res.status = ((code: number) => {
      if (
        !intercepted &&
        (code === 307 || code === 401 || code === 403) &&
        !res.headersSent
      ) {
        intercepted = true;
        console.warn(
          `[Clerk] suprimindo ${code} em ${req.path} — limpando cookies e renderizando SPA como deslogado`,
        );
        clearClerkCookies(req, res);
        // Tira qualquer Location que o Clerk tenha pendurado pro handshake
        res.removeHeader("Location");
        // Restaura status real pra SPA poder chamar res.status(200).send(...)
        res.status = originalStatus as Response["status"];
        res.end = originalEnd as Response["end"];

        // Devolve um sink encadeável: quando o Clerk chamar .end() depois do
        // res.status(307), em vez de finalizar a resposta, encaminha pro
        // próximo middleware (que vai servir o index.html da SPA).
        let forwarded = false;
        const forwardOnce = () => {
          if (forwarded) return sink;
          forwarded = true;
          next();
          return sink;
        };
        const sink: Record<string, (..._args: unknown[]) => unknown> = {
          end: forwardOnce,
          send: forwardOnce,
          json: forwardOnce,
          sendStatus: forwardOnce,
          setHeader: () => sink,
          removeHeader: () => sink,
          appendHeader: () => sink,
          status: () => sink,
          links: () => sink,
          type: () => sink,
          set: () => sink,
          header: () => sink,
        };
        return sink as unknown as Response;
      }
      return originalStatus(code);
    }) as Response["status"];

    clerk(req, res, (err?: unknown) => {
      if (err) {
        const msg = err instanceof Error ? err.message : String(err);
        console.warn(`[Clerk] erro nav em ${req.path}: ${msg}`);
        clearClerkCookies(req, res);
      }
      if (!intercepted) {
        // Restaura originais antes de seguir
        res.status = originalStatus as Response["status"];
        res.end = originalEnd as Response["end"];
        next(); // descarta `err` de propósito — auth ruim vira deslogado
      }
      // Se intercepted=true, o sink.end já chamou next() ou ainda vai chamar.
    });
  });
}
