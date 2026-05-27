#!/bin/bash
# Roda os testes ponta-a-ponta (Playwright) antes de qualquer build de deploy.
# Falha imediatamente se algum teste quebrar para impedir que regressões cheguem
# em produção.
#
# IMPORTANTE (Task #189 / #202): este script SOBE um dev server que expõe
# endpoints /api/dev-* capazes de fazer INSERT real no banco. Defesas em
# camadas (cada uma sozinha já segura o estrago):
#   1. Os endpoints só ficam registrados se DEV_FIXTURES=1 (exportada aqui).
#   2. O módulo `server/_dev/devEndpoints.ts` recusa inserir o sentinel se o
#      host da DATABASE_URL bater com qualquer padrão de produção conhecido.
#   3. Cada endpoint /api/dev-* faz SELECT no sentinel antes de qualquer
#      INSERT — sem a linha (true), retorna 503.
#   4. Este script (camada externa) parseia DATABASE_URL_TEST e DATABASE_URL
#      por host:porta:database e aborta se baterem, mesmo com querystrings
#      diferentes. Também aborta se DATABASE_URL_TEST cair num host listado
#      como proibido.

set -euo pipefail

# Hosts/padrões considerados PRODUÇÃO. Mesma fonte de verdade que
# `FORBIDDEN_HOST_PATTERNS` em `server/_dev/devEndpoints.ts`. Substring match.
FORBIDDEN_HOST_PATTERNS=(".neon.tech")

echo "=== Pre-deploy: instalando dependências ==="
pnpm install --frozen-lockfile 2>/dev/null || pnpm install

echo ""
echo "=== Pre-deploy: instalando o Chromium do Playwright ==="
pnpm exec playwright install chromium

# ── Guard rail: resolve DATABASE_URL_TEST ─────────────────────────────────────
# Sem isso, o dev server abaixo escreveria no DATABASE_URL herdado (= prod).
if [ -z "${DATABASE_URL_TEST:-}" ]; then
  if [ -n "${PGHOST:-}" ] && [ -n "${PGUSER:-}" ] && [ -n "${PGPASSWORD:-}" ] \
     && [ -n "${PGDATABASE:-}" ] && [ -n "${PGPORT:-}" ]; then
    DATABASE_URL_TEST="postgresql://${PGUSER}:${PGPASSWORD}@${PGHOST}:${PGPORT}/${PGDATABASE}"
    echo "DATABASE_URL_TEST derivado dos secrets PG* (host=${PGHOST}, db=${PGDATABASE})."
  else
    echo "ERRO: nem DATABASE_URL_TEST nem o conjunto PG* (PGHOST/PGUSER/PGPASSWORD/PGDATABASE/PGPORT) estão definidos." >&2
    echo "Os testes E2E precisam de um Postgres dedicado para isolar inserts" >&2
    echo "dos endpoints /api/dev-* do banco de produção." >&2
    exit 1
  fi
fi

# Parseia uma URL postgres://... em "host:port:database" (lowercased).
# Usamos Node (já presente como dependência do projeto) em vez de regex
# bash p/ lidar corretamente com credenciais, querystrings e portas default.
parse_hpd() {
  node -e '
    try {
      const u = new URL(process.argv[1]);
      const host = (u.hostname || "").toLowerCase();
      const port = u.port || "5432";
      const db = (u.pathname || "").replace(/^\//, "");
      console.log(host + ":" + port + ":" + db);
    } catch (e) { process.exit(2); }
  ' "$1"
}

TEST_HPD=$(parse_hpd "${DATABASE_URL_TEST}" || true)
LIVE_HPD=""
if [ -n "${DATABASE_URL:-}" ]; then
  LIVE_HPD=$(parse_hpd "${DATABASE_URL}" || true)
fi

if [ -z "${TEST_HPD}" ]; then
  echo "ERRO: DATABASE_URL_TEST não pôde ser parseada como URL." >&2
  exit 1
fi

# Comparação por host:port:database (querystring irrelevante).
if [ -n "${LIVE_HPD}" ] && [ "${TEST_HPD}" = "${LIVE_HPD}" ]; then
  echo "ERRO: DATABASE_URL_TEST e DATABASE_URL apontam para o mesmo banco físico (${TEST_HPD})." >&2
  echo "Os dois precisam ser bancos diferentes." >&2
  exit 1
fi

# Defesa adicional: o host do test não pode bater com nenhum padrão de
# produção, mesmo que não bata exatamente com a DATABASE_URL atual (caso
# DATABASE_URL não esteja setada no momento do build, por exemplo).
TEST_HOST="${TEST_HPD%%:*}"
for pat in "${FORBIDDEN_HOST_PATTERNS[@]}"; do
  if [[ "${TEST_HOST}" == *"${pat}"* ]]; then
    echo "ERRO: host de DATABASE_URL_TEST ('${TEST_HOST}') bate com padrão de produção '${pat}'." >&2
    echo "O banco de teste precisa rodar fora dos provedores de produção." >&2
    exit 1
  fi
done

echo ""
echo "=== Pre-deploy: subindo dev server pra warm-up (banco de TESTE isolado) ==="
# DATABASE_URL é EXPORTADO só pro subprocess do dev server: a `runMigrations()`
# vai criar o schema no banco de teste na primeira inicialização. Setamos
# DEV_FIXTURES=1 para registrar os endpoints /api/dev-* (sem essa flag o
# módulo nem é importado, mesmo com NODE_ENV=development).
NODE_ENV=development \
  DEV_FIXTURES=1 \
  DATABASE_URL="${DATABASE_URL_TEST}" \
  DATABASE_URL_TEST="${DATABASE_URL_TEST}" \
  pnpm run dev > /tmp/pre-deploy-dev.log 2>&1 &
DEV_PID=$!
trap "kill ${DEV_PID} 2>/dev/null || true" EXIT

echo "=== Pre-deploy: aguardando dev server atender em :5000 ==="
SERVER_READY=0
for i in $(seq 1 90); do
  if curl -fs -o /dev/null --max-time 3 http://localhost:5000/; then
    SERVER_READY=1
    echo "Dev server respondeu após ${i}s"
    break
  fi
  sleep 1
done

if [ "${SERVER_READY}" -ne 1 ]; then
  echo "ERRO: dev server não respondeu em 90s. Log:" >&2
  tail -n 80 /tmp/pre-deploy-dev.log >&2 || true
  exit 1
fi

echo "=== Pre-deploy: aquecendo bundle Vite (rotas críticas) ==="
curl -fs -o /dev/null --max-time 120 http://localhost:5000/ || true
curl -fs -o /dev/null --max-time 120 http://localhost:5000/montar-campanha || true

echo ""
echo "=== Pre-deploy: rodando testes ponta-a-ponta (pnpm run test:e2e) ==="
E2E_BASE_URL=http://localhost:5000 pnpm run test:e2e

echo ""
echo "=== Pre-deploy: testes ponta-a-ponta passaram ✓ ==="
