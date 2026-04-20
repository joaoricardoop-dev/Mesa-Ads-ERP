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
echo "=== Pre-deploy: rodando testes ponta-a-ponta (pnpm run test:e2e) ==="
# O Playwright sobe o servidor dev em http://localhost:5000 via webServer.
pnpm run test:e2e

echo ""
echo "=== Pre-deploy: testes ponta-a-ponta passaram ✓ ==="
