#!/bin/bash
# Ferramenta MANUAL de validação ponta-a-ponta (Playwright).
#
# DESACOPLADO DO DEPLOY (Task #219): este script NÃO é mais invocado pelo build
# de deploy (que agora roda apenas `npm run build`). Rode-o sob demanda ANTES de
# publicar para validar o checkout aberto e a coerência da tela de assinatura.
# Falha imediatamente (exit ≠ 0) se algum teste quebrar.
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

# Hosts/padrões considerados PRODUÇÃO (substring match). Mesma fonte de
# verdade que `getForbiddenPatterns()` em `server/_dev/devEndpoints.ts`.
# Configurável via env var `PROD_DB_HOSTS` (CSV); fallback histórico é
# `.neon.tech` — só serve quando o banco de teste roda fora do Neon
# (ex.: Postgres nativo Replit). Se o teste também é Neon, seta
# `PROD_DB_HOSTS=<substring-unica-do-host-prod>` pra distinguir.
if [ -n "${PROD_DB_HOSTS:-}" ]; then
  IFS=',' read -ra FORBIDDEN_HOST_PATTERNS <<< "${PROD_DB_HOSTS}"
else
  FORBIDDEN_HOST_PATTERNS=(".neon.tech")
fi

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
echo "=== Pre-deploy: subindo dev server (banco de TESTE isolado) ==="
# DATABASE_URL é EXPORTADO só pro subprocess do dev server: a `runMigrations()`
# vai criar o schema no banco de teste na primeira inicialização. Setamos
# DEV_FIXTURES=1 para registrar os endpoints /api/dev-* (sem essa flag o
# módulo nem é importado, mesmo com NODE_ENV=development).
#
# IMPORTANTE — buffering e PTY:
#   Node em stdout não-TTY (= redirecionado pra arquivo) usa block-buffer
#   ~64KB com write() direto via libuv. `stdbuf` (que opera na libc) NÃO
#   tem efeito em Node — daí 180s de silêncio nos deploys anteriores
#   mesmo com `stdbuf -oL`. A única forma de forçar line-buffering em
#   Node sem mudar código é alocar um pseudo-TTY com `script` (util-linux).
#   `-q` suprime o header "Script started", `-f` flush após cada write,
#   `-e` propaga exit code do filho.
#
# IMPORTANTE — tsx watch:
#   `pnpm run dev` usa `tsx watch`, que no cloud builder com FS cold tenta
#   recursar `node_modules` pra setar fs.watchers. Pre-deploy não precisa
#   de hot-reload, então chamamos `tsx` puro.
# Marcador ANTES do tsx: se este `[pre-deploy] launching tsx` não
# aparece no /tmp/pre-deploy-dev.log, o problema é o próprio `script`
# (PTY não está flushando). Se aparece e nada mais, o problema é
# tsx cold-start travando antes de carregar server/_core/index.ts.
script -qfec "echo '[pre-deploy] launching tsx at '\$(date -u +%FT%TZ) && \
  NODE_ENV=development \
  DEV_FIXTURES=1 \
  DATABASE_URL='${DATABASE_URL_TEST}' \
  DATABASE_URL_TEST='${DATABASE_URL_TEST}' \
  exec pnpm exec tsx server/_core/index.ts" /tmp/pre-deploy-dev.log > /dev/null 2>&1 &
DEV_PID=$!
# Mata o grupo inteiro (script + filhos) na saída — kill -PID negativo
# só funciona pra grupos, então usamos pkill -P como fallback.
trap "pkill -P ${DEV_PID} 2>/dev/null; kill ${DEV_PID} 2>/dev/null || true" EXIT

echo "Dev server PID=${DEV_PID}, aguardando atender em :5000..."

# Verifica de cara que o processo ainda está vivo (se `pnpm exec tsx` falhou
# pra encontrar tsx ou crashou no `import`, o `&` não capturou — precisamos
# checar `kill -0`).
sleep 2
if ! kill -0 "${DEV_PID}" 2>/dev/null; then
  echo "ERRO: dev server morreu em <2s. Log:" >&2
  cat /tmp/pre-deploy-dev.log >&2 || true
  exit 1
fi

# Cold-start em cloud builder (2 vCPU, Neon serverless RT ~100ms, ~200
# statements de migration, bundle Vite no boot via `setupVite`) chega
# perto de 2min em pior caso. 180s dá folga.
SERVER_READY=0
WAIT_SECS=180
for i in $(seq 1 ${WAIT_SECS}); do
  if curl -fs -o /dev/null --max-time 3 http://localhost:5000/; then
    SERVER_READY=1
    echo "Dev server respondeu após ${i}s"
    break
  fi
  # Detecta morte do processo (crash silencioso) sem esperar timeout completo.
  if ! kill -0 "${DEV_PID}" 2>/dev/null; then
    echo "ERRO: dev server morreu após ${i}s. Log completo:" >&2
    cat /tmp/pre-deploy-dev.log >&2 || true
    exit 1
  fi
  # Snapshot a cada 5s nos primeiros 30s (pra ver `[pre-deploy] launching
  # tsx` + `[boot] entry loaded` rapidamente), depois a cada 15s.
  SNAP=0
  if [ "$i" -le 30 ] && [ $((i % 5)) -eq 0 ]; then SNAP=1; fi
  if [ "$i" -gt 30 ] && [ $((i % 15)) -eq 0 ]; then SNAP=1; fi
  if [ "${SNAP}" -eq 1 ]; then
    echo "--- ainda esperando (${i}s/${WAIT_SECS}s), últimas linhas do dev server: ---"
    tail -n 20 /tmp/pre-deploy-dev.log 2>/dev/null || true
    echo "--- (processo $(kill -0 ${DEV_PID} 2>/dev/null && echo VIVO || echo MORTO)) fim do snapshot ---"
  fi
  sleep 1
done

if [ "${SERVER_READY}" -ne 1 ]; then
  echo "ERRO: dev server não respondeu em ${WAIT_SECS}s. Log completo:" >&2
  cat /tmp/pre-deploy-dev.log >&2 || true
  echo "--- estado do processo: $(kill -0 ${DEV_PID} 2>/dev/null && echo VIVO || echo MORTO) ---" >&2
  exit 1
fi

echo "=== Pre-deploy: aquecendo bundle Vite (rotas críticas) ==="
curl -fs -o /dev/null --max-time 120 http://localhost:5000/ || true
curl -fs -o /dev/null --max-time 120 http://localhost:5000/montar-campanha || true

echo ""
echo "=== Pre-deploy: rodando testes ponta-a-ponta (pnpm run test:e2e) ==="
# DATABASE_URL_TEST é exportado para que o spec `migrations-fresh-db.spec.ts`
# (Task #212) crie o DB temporário no mesmo Postgres de teste isolado — e
# nunca no banco de produção herdado em DATABASE_URL do build.
export DATABASE_URL_TEST
# `|| true` desabilita o set -e desta linha pra capturar o exit code.
set +e
E2E_BASE_URL=http://localhost:5000 pnpm run test:e2e
E2E_EXIT=$?
set -e

if [ "${E2E_EXIT}" -ne 0 ]; then
  echo ""
  echo "=== E2E falhou — dump do log do dev server (stderr inclui console.error) ==="
  cat /tmp/pre-deploy-dev.log 2>/dev/null || true
  echo "=== fim do log do dev server ==="
  exit "${E2E_EXIT}"
fi

echo ""
echo "=== Pre-deploy: testes ponta-a-ponta passaram ✓ ==="
