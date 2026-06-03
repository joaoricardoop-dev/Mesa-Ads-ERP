import { useMemo } from "react";
import { trpc } from "@/lib/trpc";

export type ConfigOptionType = "loss_reason" | "origin_category";

/**
 * Hook único para ler as listas paramétricas (config_options) compartilhadas
 * por Oportunidades e Cotações. Garante que todos os selects/exibições leiam
 * da MESMA fonte (banco), via router configOption.
 *
 * - `options`: itens ativos do tipo, já ordenados.
 * - `labelOf(code)`: mapeia o valor gravado (code) para o rótulo de exibição,
 *   com fallback para o próprio valor quando não encontrado (dados legados).
 */
export function useConfigOptions(type: ConfigOptionType) {
  const q = trpc.configOption.list.useQuery({ type });
  const options = q.data ?? [];

  const labelMap = useMemo(() => {
    const m = new Map<string, string>();
    for (const o of options) m.set(o.code, o.label);
    return m;
  }, [options]);

  const labelOf = (code?: string | null) => {
    if (!code) return "—";
    return labelMap.get(code) ?? code;
  };

  return { options, labelOf, isLoading: q.isLoading };
}
