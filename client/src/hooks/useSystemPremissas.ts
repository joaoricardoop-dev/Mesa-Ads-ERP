import { trpc } from "@/lib/trpc";

/**
 * Fallback usado enquanto a config global carrega (ou se ausente).
 * Espelha o seed de `system_config`. Premissas em **percentual**, BV em **decimal**.
 */
const FALLBACK = {
  irpj: 6,
  comissaoRestaurante: 15,
  comissaoComercial: 10,
  bvPadraoAgencia: 0.2,
};

/**
 * Lê as premissas globais (IRPJ/comissões/BV) de `system_config` — fonte de verdade
 * única, substituindo as constantes hardcoded espalhadas pelo frontend.
 *
 * `premissas` vem em **percentual** (ex.: irpj 6) para casar com `ItemPremissas`.
 * `bvAgencia` vem em **decimal** (ex.: 0.20) para casar com `BV_PADRAO_AGENCIA`.
 */
export function useSystemPremissas() {
  const { data, isLoading } = trpc.systemConfig.getAll.useQuery(undefined, {
    staleTime: 5 * 60 * 1000,
  });
  const values = data?.values;

  const pct = (key: keyof typeof FALLBACK): number => {
    const n = parseFloat(values?.[key] ?? "");
    return Number.isFinite(n) ? n * 100 : FALLBACK[key];
  };
  const dec = (key: keyof typeof FALLBACK): number => {
    const n = parseFloat(values?.[key] ?? "");
    return Number.isFinite(n) ? n : FALLBACK[key];
  };

  return {
    premissas: {
      irpj: pct("irpj"),
      comissaoRestaurante: pct("comissaoRestaurante"),
      comissaoComercial: pct("comissaoComercial"),
    },
    bvAgencia: dec("bvPadraoAgencia"),
    isLoading,
  };
}
