export type ImpressionFormulaType = "por_coaster" | "por_tela" | "legacy";

export interface ProductImpressionParams {
  impressionFormulaType?: string | null;
  attentionFactor?: string | number | null;
  defaultPessoasPorMesa?: string | number | null;
  loopDurationSeconds?: string | number | null;
  frequenciaAparicoes?: string | number | null;
}

export interface LocationData {
  seatCount?: number | null;
  tableCount?: number | null;
  monthlyCustomers?: number | null;
  avgStayMinutes?: number | null;
}

export interface CoasterLocationInput {
  qtdCoasters: number;
  usosporCoaster?: number | null;
  location?: LocationData | null;
  product: ProductImpressionParams;
  daysPerMonth?: number;
}

export interface TelaLocationInput {
  location?: LocationData | null;
  product: ProductImpressionParams;
  daysPerMonth?: number;
}

export interface LocationImpressionInput {
  formula: ImpressionFormulaType;
  product: ProductImpressionParams;
  location?: LocationData | null;
  qtdCoasters?: number;
  usosporCoaster?: number | null;
  daysPerMonth?: number;
}

function n(v: string | number | null | undefined, fallback = 0): number {
  if (v == null) return fallback;
  const parsed = typeof v === "number" ? v : parseFloat(String(v));
  return isNaN(parsed) ? fallback : parsed;
}

export function calcPessoasPorMesa(location: LocationData | null | undefined, defaultPessoasPorMesa: number): number {
  if (location && location.seatCount && location.tableCount && location.tableCount > 0) {
    return location.seatCount / location.tableCount;
  }
  return defaultPessoasPorMesa;
}

export function calcClientesPorDia(location: LocationData | null | undefined, daysPerMonth: number): number | null {
  if (location && location.monthlyCustomers && location.monthlyCustomers > 0) {
    const dias = daysPerMonth > 0 ? daysPerMonth : 26;
    return location.monthlyCustomers / dias;
  }
  return null;
}

export function calcAparicosPorVisita(location: LocationData | null | undefined, product: ProductImpressionParams): number {
  const loopSec = n(product.loopDurationSeconds, 30);
  const avgStay = location?.avgStayMinutes ?? 0;
  if (loopSec > 0 && avgStay > 0) {
    return (avgStay * 60) / loopSec;
  }
  return n(product.frequenciaAparicoes, 1);
}

export function calcImpressionsByLocation(input: LocationImpressionInput): number {
  const { formula, product, location, qtdCoasters, usosporCoaster, daysPerMonth = 26 } = input;
  const atencao = n(product.attentionFactor, 1);
  const defaultPPM = n(product.defaultPessoasPorMesa, 3);

  if (formula === "por_coaster") {
    const coasters = qtdCoasters ?? 0;
    const usos = usosporCoaster != null ? n(usosporCoaster) : 2;
    const pessoasPorMesa = calcPessoasPorMesa(location, defaultPPM);
    return coasters * usos * pessoasPorMesa * atencao;
  }

  if (formula === "por_tela") {
    const clientesPorDia = calcClientesPorDia(location, daysPerMonth);
    const aparicoes = calcAparicosPorVisita(location, product);
    if (clientesPorDia === null) {
      return 0;
    }
    return clientesPorDia * aparicoes * atencao * daysPerMonth;
  }

  const coasters = qtdCoasters ?? 0;
  const usos = usosporCoaster != null ? n(usosporCoaster) : 2;
  return coasters * usos;
}

export function calcTotalImpressions(
  locations: Array<{ location?: LocationData | null; qtdCoasters?: number; usosporCoaster?: number | null }>,
  product: ProductImpressionParams,
  daysPerMonth = 26,
): number {
  const formula = (product.impressionFormulaType ?? "por_coaster") as ImpressionFormulaType;
  return locations.reduce((sum, loc) => {
    return sum + calcImpressionsByLocation({
      formula,
      product,
      location: loc.location,
      qtdCoasters: loc.qtdCoasters,
      usosporCoaster: loc.usosporCoaster,
      daysPerMonth,
    });
  }, 0);
}

export function calcImpressionsSimple(params: {
  formula?: string | null;
  qtdCoasters?: number;
  usosporCoaster?: number | null;
  attentionFactor?: string | number | null;
  pessoasPorMesa?: number;
  clientesPorDia?: number;
  aparicoesPorVisita?: number;
  daysPerMonth?: number;
}): number {
  const formula = (params.formula ?? "por_coaster") as ImpressionFormulaType;
  const atencao = n(params.attentionFactor, 1);
  const dias = params.daysPerMonth ?? 26;

  if (formula === "por_coaster") {
    const coasters = params.qtdCoasters ?? 0;
    const usos = params.usosporCoaster != null ? n(params.usosporCoaster) : 2;
    const ppm = params.pessoasPorMesa ?? 3;
    return coasters * usos * ppm * atencao;
  }

  if (formula === "por_tela") {
    const cpd = params.clientesPorDia ?? 0;
    const apar = params.aparicoesPorVisita ?? 1;
    return cpd * apar * atencao * dias;
  }

  const coasters = params.qtdCoasters ?? 0;
  const usos = params.usosporCoaster != null ? n(params.usosporCoaster) : 2;
  return coasters * usos;
}
