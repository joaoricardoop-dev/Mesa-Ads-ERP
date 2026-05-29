// Guard de banco de teste para a suíte E2E (Task #220).
//
// O `pnpm run test:e2e` (quando NÃO recebe E2E_BASE_URL) sobe o dev server
// via `webServer` do Playwright, que por sua vez registra os endpoints
// /api/dev-* capazes de fazer INSERT real no banco. Se esse dev server
// herdar a DATABASE_URL de produção, os testes escreveriam direto na
// produção. Este módulo resolve e VALIDA a URL do banco de teste antes de
// qualquer teste rodar, falhando de forma clara (lança erro no load do
// playwright.config.ts) quando a configuração é insegura.
//
// Mesma fonte de verdade que `scripts/pre-deploy.sh`:
//   1. Resolve DATABASE_URL_TEST; se ausente, deriva dos secrets PG*
//      (Postgres nativo do Replit, isolado do Neon de produção).
//   2. Aborta se nem DATABASE_URL_TEST nem o conjunto PG* existirem.
//   3. Aborta se o banco de teste for, por host:porta:database, o MESMO
//      que a DATABASE_URL atual (querystring irrelevante).
//   4. Aborta se o host de teste bater com um padrão de produção
//      (PROD_DB_HOSTS, CSV; fallback `.neon.tech`).

type Hpd = { host: string; port: string; db: string; key: string };

function parseHpd(connStr: string): Hpd {
  const u = new URL(connStr);
  const host = (u.hostname || "").toLowerCase();
  const port = u.port || "5432";
  const db = (u.pathname || "").replace(/^\//, "");
  return { host, port, db, key: `${host}:${port}:${db}` };
}

// Padrões de host considerados PRODUÇÃO (substring match, lowercased).
// Configurável via env var `PROD_DB_HOSTS` (CSV). Fallback histórico
// `.neon.tech` só é seguro quando o banco de teste roda FORA do Neon
// (ex.: Postgres nativo Replit). Quando o banco de teste também é Neon
// (instância dedicada separada da produção), `PROD_DB_HOSTS` deve conter
// uma substring única do host de PRODUÇÃO para distinguir os dois.
function getForbiddenPatterns(): string[] {
  const raw = process.env.PROD_DB_HOSTS;
  if (raw && raw.trim().length > 0) {
    return raw
      .split(",")
      .map((s) => s.trim().toLowerCase())
      .filter((s) => s.length > 0);
  }
  return [".neon.tech"];
}

/**
 * Resolve e valida a URL do banco de teste. Lança um Error com mensagem
 * acionável quando a configuração não é segura. Retorna a connection
 * string a ser usada pelo dev server da suíte E2E.
 */
export function resolveTestDatabaseUrl(): string {
  let testUrl = process.env.DATABASE_URL_TEST;

  // (1) Fallback: deriva dos secrets PG* (Postgres nativo Replit).
  if (!testUrl || testUrl.trim().length === 0) {
    const { PGHOST, PGUSER, PGPASSWORD, PGDATABASE, PGPORT } = process.env;
    if (PGHOST && PGUSER && PGPASSWORD && PGDATABASE && PGPORT) {
      testUrl = `postgresql://${PGUSER}:${PGPASSWORD}@${PGHOST}:${PGPORT}/${PGDATABASE}`;
    } else {
      throw new Error(
        "[e2e] DATABASE_URL_TEST não está definida e os secrets PG* " +
          "(PGHOST/PGUSER/PGPASSWORD/PGDATABASE/PGPORT) também não estão. " +
          "Os testes E2E precisam de um Postgres dedicado, separado da " +
          "produção, para isolar os INSERTs dos endpoints /api/dev-*. " +
          "Configure o secret DATABASE_URL_TEST apontando para um banco de " +
          "teste isolado (veja replit.md → seção de testes E2E).",
      );
    }
  }

  // (2) Precisa ser uma URL postgres válida.
  let test: Hpd;
  try {
    test = parseHpd(testUrl);
  } catch {
    throw new Error(
      "[e2e] DATABASE_URL_TEST não pôde ser parseada como URL postgres://...",
    );
  }

  // (3) Não pode ser, fisicamente, o mesmo banco que a DATABASE_URL atual.
  if (process.env.DATABASE_URL && process.env.DATABASE_URL.trim().length > 0) {
    let live: Hpd | null = null;
    try {
      live = parseHpd(process.env.DATABASE_URL);
    } catch {
      live = null;
    }
    if (live && live.key === test.key) {
      throw new Error(
        `[e2e] DATABASE_URL_TEST e DATABASE_URL apontam para o MESMO banco ` +
          `físico (${test.key}). Os testes E2E precisam de um banco dedicado, ` +
          `separado da produção. Configure DATABASE_URL_TEST com um banco isolado.`,
      );
    }
  }

  // (4) O host de teste não pode bater com nenhum padrão de produção.
  const forbidden = getForbiddenPatterns();
  for (const pat of forbidden) {
    if (test.host.includes(pat)) {
      throw new Error(
        `[e2e] host de DATABASE_URL_TEST ('${test.host}') bate com o padrão ` +
          `de produção '${pat}'. O banco de teste precisa rodar fora da ` +
          `produção. Se o banco de teste é uma instância Neon dedicada, ` +
          `ajuste PROD_DB_HOSTS para conter apenas a substring do host de ` +
          `PRODUÇÃO (não '.neon.tech' genérico).`,
      );
    }
  }

  return testUrl;
}
