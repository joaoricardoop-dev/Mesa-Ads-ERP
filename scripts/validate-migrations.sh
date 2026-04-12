#!/bin/bash
# Verifica que toda tabela criada em arquivos drizzle/*.sql recentes
# também está registrada em server/migrations.ts com CREATE TABLE IF NOT EXISTS.
#
# Arquivos 0000-0019 são históricos (aplicados antes do custom runner) e são ignorados.
# Arquivos 0020+ devem ter entrada correspondente em server/migrations.ts.

set -euo pipefail

MIGRATIONS_FILE="server/migrations.ts"
FAIL=0

echo "=== Validando migrations de banco de dados ==="

for sql_file in drizzle/[0-9]*.sql; do
  [ -f "$sql_file" ] || continue

  filename=$(basename "$sql_file")
  num="${filename%%_*}"

  # Ignorar arquivos históricos (antes do custom migration runner)
  if [ "$((10#$num))" -lt 20 ]; then
    continue
  fi

  # Extrair nomes de tabelas de CREATE TABLE e CREATE TABLE IF NOT EXISTS
  tables=$(grep -oP 'CREATE TABLE\s+(?:IF\s+NOT\s+EXISTS\s+)?"?\K[^"\s(]+' "$sql_file" 2>/dev/null | tr -d '"' || true)

  for table in $tables; do
    if grep -q "\"$table\"" "$MIGRATIONS_FILE"; then
      echo "  OK  $table"
    else
      echo "  FAIL  $table  (em $sql_file mas ausente de $MIGRATIONS_FILE)"
      FAIL=1
    fi
  done
done

echo ""
if [ "$FAIL" -eq 0 ]; then
  echo "Todas as migrations de tabelas recentes estão registradas em server/migrations.ts"
else
  echo "ERRO: Existem tabelas faltando em server/migrations.ts."
  echo "Adicione entradas CREATE TABLE IF NOT EXISTS para as tabelas listadas acima."
  exit 1
fi
