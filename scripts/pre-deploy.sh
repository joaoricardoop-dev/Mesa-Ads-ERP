#!/bin/bash
# Roda os testes ponta-a-ponta (Playwright) antes de qualquer build de deploy.
# Falha imediatamente se algum teste quebrar para impedir que regressões cheguem
# em produção.
#
# IMPORTANTE (Task #189): este script SOBE um dev server (NODE_ENV=development)
# que expõe endpoints /api/dev-* capazes de fazer INSERT real no banco.
# Antes da task #189 o script herdava DATABASE_URL do ambiente de build (=
# prod), e cada deploy injetava lixo "E2E Parceiro <ts>" / "E2E Client e2e-<ts>"
# diretamente na produção. Agora exigimos DATABASE_URL_TEST (banco Neon
# dedicado, isolado) e redirecionamos o dev server para lá.

set -euo pipefail

echo "=== Pre-deploy: instalando dependências ==="
pnpm install --frozen-lockfile 2>/dev/null || pnpm install

echo ""
echo "=== Pre-deploy: instalando o Chromium do Playwright ==="
pnpm exec playwright install chromium

# ── Guard rail: resolve DATABASE_URL_TEST ─────────────────────────────────────
# Sem isso, o dev server abaixo escreveria no DATABASE_URL herdado (= prod).
# Falhamos cedo e barulhento — preferimos abortar o deploy a poluir produção.
#
# Estratégia: se o secret DATABASE_URL_TEST não estiver setado, montamos a URL
# a partir dos secrets PG* (que apontam para o Postgres nativo Replit, isolado
# do Neon prod). Isso dispensa qualquer configuração manual: os PG* são
# provisionados automaticamente quando o projeto tem um banco Replit nativo.
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

if [ "${DATABASE_URL_TEST}" = "${DATABASE_URL:-}" ]; then
  echo "ERRO: DATABASE_URL_TEST é igual a DATABASE_URL (banco de produção)." >&2
  echo "Os dois precisam apontar para bancos físicos diferentes." >&2
  exit 1
fi

echo ""
echo "=== Pre-deploy: subindo dev server pra warm-up (banco de TESTE isolado) ==="
# O cloud builder (cr-2-4, 2 vCPU, 4GB) leva 30–60s na primeira compilação
# Vite. Sem warm-up, o primeiro spec paga esse custo dentro do timeout de
# teste e estoura. Subimos o server agora, esperamos ele atender, batemos
# uma rota crítica pra forçar a compilação, e só então rodamos a suite com
# E2E_BASE_URL setado pra que o Playwright reuse o mesmo processo (e não
# tente subir outro servidor).
#
# DATABASE_URL aqui é EXPORTADO só pro subprocess do dev server (e seus
# filhos): a `runMigrations()` na inicialização do server vai criar o
# schema no banco de teste se ainda não existir, e qualquer INSERT
# subsequente dos endpoints /api/dev-* fica contido ali.
# Exportamos DATABASE_URL_TEST junto pro processo filho para que o helper
# assertSafeForDevSeed (server/_core/index.ts) tenha o sinal armado mesmo
# quando a URL foi derivada dos PG* aqui (i.e. sem o secret explícito).
NODE_ENV=development DATABASE_URL="${DATABASE_URL_TEST}" DATABASE_URL_TEST="${DATABASE_URL_TEST}" pnpm run dev > /tmp/pre-deploy-dev.log 2>&1 &
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
# Timeout generoso (120s) por curl — cold compile do bundle 5.8MB pode
# levar bem mais que os 60s default de teste. Falha aqui não derruba o
# pipeline (pior caso o primeiro spec paga o custo).
curl -fs -o /dev/null --max-time 120 http://localhost:5000/ || true
curl -fs -o /dev/null --max-time 120 http://localhost:5000/montar-campanha || true

echo ""
echo "=== Pre-deploy: rodando testes ponta-a-ponta (pnpm run test:e2e) ==="
# E2E_BASE_URL faz o playwright.config pular o webServer e reusar o
# processo já aquecido acima.
E2E_BASE_URL=http://localhost:5000 pnpm run test:e2e

echo ""
echo "=== Pre-deploy: testes ponta-a-ponta passaram ✓ ==="
