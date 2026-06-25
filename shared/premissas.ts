// ─────────────────────────────────────────────────────────────────────────────
// Fonte única canônica das premissas globais (IRPJ / comissões / BV).
//
// Esta é a ÚNICA origem dos valores-padrão usados como fallback enquanto a
// `system_config` não está populada. Servidor (systemConfigRouter, finance/calc)
// e cliente (useSystemPremissas, useBudgetCalculator) importam daqui para que
// não existam mais constantes duplicadas espalhadas pelo código.
//
// Valores em DECIMAL (ex.: 0.06 = 6%). Telas que precisam de percentual
// multiplicam por 100 no edge.
// ─────────────────────────────────────────────────────────────────────────────

export type SystemPremissas = {
  irpj: number;
  comissaoRestaurante: number;
  comissaoComercial: number;
  bvPadraoAgencia: number;
};

export const PREMISSAS_DEFAULTS: SystemPremissas = {
  irpj: 0.06,
  comissaoRestaurante: 0.15,
  comissaoComercial: 0.1,
  bvPadraoAgencia: 0.2,
};
