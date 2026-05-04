#!/bin/bash
# Roda os testes ponta-a-ponta (Playwright) antes de qualquer build de deploy.
# Falha imediatamente se algum teste quebrar para impedir que regressões cheguem
# em produção.

set -euo pipefail

echo "=== Pre-deploy: instalando dependências ==="
pnpm install --frozen-lockfile 2>/dev/null || pnpm install

echo ""
echo "=== Pre-deploy: instalando o Chromium do Playwright ==="
pnpm exec playwright install chromium

echo ""
echo "=== Pre-deploy: subindo dev server pra warm-up ==="
# O cloud builder (cr-2-4, 2 vCPU, 4GB) leva 30–60s na primeira compilação
# Vite. Sem warm-up, o primeiro spec paga esse custo dentro do timeout de
# teste e estoura. Subimos o server agora, esperamos ele atender, batemos
# uma rota crítica pra forçar a compilação, e só então rodamos a suite com
# E2E_BASE_URL setado pra que o Playwright reuse o mesmo processo (e não
# tente subir outro servidor).
NODE_ENV=development pnpm run dev > /tmp/pre-deploy-dev.log 2>&1 &
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
