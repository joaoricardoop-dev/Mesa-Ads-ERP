import { PREMISSAS_DEFAULTS } from "./premissas";

// Fonte única da MONTAGEM dos dados da proposta/OS.
//
// Antes, o parse das notes do item (semanas/spot/impressões) e o cálculo de
// pricePerRestaurant/monthlyTotal viviam duplicados em cada tela que exportava
// a proposta (QuotationDetail, Quotations) — risco clássico de divergência.
// Aqui há UMA derivação canônica, consumida por todas as telas internas e pela
// tela pública de assinatura, garantindo que o documento de OS assinada traga
// exatamente as mesmas informações da proposta.

export interface ProposalItem {
  productName: string;
  volume: number;
  semanas: number;
  unitPrice: number;
  totalPrice: number;
  spotSeconds?: 15 | 30 | null;
  impressionsPerRestaurant?: number;
  numRestaurants?: number;
}

export interface ProposalSignature {
  signerName: string;
  signerCpf?: string;
  signedAt: string;
  signatureHash?: string;
  ip?: string;
}

export interface ProposalPDFData {
  clientName: string;
  clientCompany?: string;
  clientCnpj?: string;
  clientEmail?: string;
  clientPhone?: string;
  quotationName?: string;
  coasterVolume: number;
  numRestaurants: number;
  coastersPerRestaurant: number;
  contractDuration: number;
  pricePerRestaurant: number;
  monthlyTotal: number;
  contractTotal: number;
  includesProduction: boolean;
  restaurants: Array<{
    name: string;
    neighborhood: string;
    coasters: number;
  }>;
  validityDays?: number;
  agencyCommissionPercent?: number;
  hasPartnerDiscount?: boolean;
  productName?: string;
  productUnitLabelPlural?: string;
  semanas?: number;
  /** Multi-product items from BudgetCreator. When provided, switches to multi-product PDF layout. */
  items?: ProposalItem[];
  isBonificada?: boolean;
  periodStart?: string;
  batchWeeks?: number;
  /** Custom product (Projeto Sob Medida) fields */
  isCustomProduct?: boolean;
  customProductName?: string;
  customProjectCost?: number;
  customPricingMode?: string;
  customMarginPercent?: number;
  customRestaurantCommission?: number;
  customPartnerCommission?: number;
  customSellerCommission?: number;
  customFinalPrice?: number;
  /** Telas (screen/TV) product fields */
  isTelas?: boolean;
  telasMonthlyCustomers?: number;
  telasImpressions30s?: number;
  telasImpressions15s?: number;
  /** IRPJ rate for the product (decimal, e.g. 0.06). Defaults to 6% if not provided. */
  irpj?: number;
  /** Task #197 — cronograma de parcelas (opcional). */
  billingSchedule?: Array<{ sequence: number; amount: string | number; dueDate: string; notes?: string | null }>;
  /**
   * Registro de assinatura digital — presente apenas para cotações
   * convertidas/assinadas. Origem única: quotations.signedAt / signedBy /
   * signatureData (campo JSON com name, cpf, ip, userAgent, hash). Quando
   * presente, o PDF mostra o registro do cliente em vez das linhas de
   * assinatura manual.
   */
  signature?: ProposalSignature;
}

/**
 * Monta o registro de assinatura digital de uma COTAÇÃO a partir da fonte
 * única `quotations.signatureData` (JSON: name, cpf, ip, hash) + `signedAt` +
 * `signedBy`. Retorna `undefined` quando não houver assinatura — nesse caso o
 * PDF mantém as linhas de assinatura manual. Regra: só monta quando `signedAt`
 * E `signatureData` existem.
 */
export function buildProposalSignature(input: {
  signedAt?: string | Date | null;
  signedBy?: string | null;
  signatureData?: string | null;
}): ProposalSignature | undefined {
  const { signedAt, signedBy, signatureData } = input;
  if (!signedAt || !signatureData) return undefined;
  const signedDate = signedAt instanceof Date ? signedAt : new Date(signedAt);
  if (Number.isNaN(signedDate.getTime())) return undefined;
  const signedAtIso = signedDate.toISOString();
  try {
    const parsed = JSON.parse(signatureData);
    return {
      signerName: parsed.name || signedBy || "Cliente",
      signerCpf: parsed.cpf || undefined,
      signedAt: signedAtIso,
      signatureHash: parsed.hash || undefined,
      ip: parsed.ip || undefined,
    };
  } catch {
    return { signerName: signedBy || "Cliente", signedAt: signedAtIso };
  }
}

/**
 * Monta o registro de assinatura digital de uma ORDEM DE SERVIÇO a partir da
 * fonte única `service_orders.signedByName` / `signedByCpf` / `signedAt` (+
 * `signatureHash`, que é o mesmo hash do `signatureData` da cotação ligada,
 * gravado na OS no momento da assinatura). Retorna `undefined` quando a OS não
 * estiver assinada — nesse caso o PDF mantém as linhas manuais. Regra: só monta
 * quando `signedAt` E `signedByName` existem.
 */
export function buildOSSignature(input: {
  signedAt?: string | Date | null;
  signedByName?: string | null;
  signedByCpf?: string | null;
  signatureHash?: string | null;
}): ProposalSignature | undefined {
  const { signedAt, signedByName, signedByCpf, signatureHash } = input;
  if (!signedAt || !signedByName) return undefined;
  const signedDate = signedAt instanceof Date ? signedAt : new Date(signedAt);
  if (Number.isNaN(signedDate.getTime())) return undefined;
  return {
    signerName: signedByName,
    signerCpf: signedByCpf || undefined,
    signedAt: signedDate.toISOString(),
    signatureHash: signatureHash || undefined,
  };
}

/** Linhas cruas (saved) que alimentam o assembler. */
export interface AssembleProposalInput {
  quotation: {
    clientName?: string | null;
    clientCompany?: string | null;
    clientCnpj?: string | null;
    clientEmail?: string | null;
    clientPhone?: string | null;
    leadName?: string | null;
    leadCompany?: string | null;
    quotationName?: string | null;
    quotationNumber?: string | null;
    coasterVolume: number;
    totalValue?: string | number | null;
    cycles?: number | null;
    includesProduction?: boolean | null;
    isBonificada?: boolean | null;
    hasPartnerDiscount?: boolean | null;
    productName?: string | null;
    productUnitLabelPlural?: string | null;
    periodStart?: string | null;
    batchWeeks?: number | null;
    isCustomProduct?: boolean | null;
    customProductName?: string | null;
    customProjectCost?: string | number | null;
    customPricingMode?: string | null;
    customMarginPercent?: string | number | null;
    customRestaurantCommission?: string | number | null;
    customPartnerCommission?: string | number | null;
    customSellerCommission?: string | number | null;
    customFinalPrice?: string | number | null;
    agencyCommissionPercent?: string | number | null;
  };
  restaurants: Array<{
    restaurantName?: string | null;
    restaurantAddress?: string | null;
    coasterQuantity?: number | null;
  }>;
  items: Array<{
    productName?: string | null;
    quantity: number | string;
    unitPrice?: string | number | null;
    totalPrice?: string | number | null;
    notes?: string | null;
  }>;
  billingSchedule?: Array<{ sequence: number; amount: string | number; dueDate: string; notes?: string | null }>;
  /**
   * Alíquota IRPJ (decimal, ex.: 0.06) — premissa global (system_config),
   * fonte única. Quando ausente, cai no PREMISSAS_DEFAULTS.irpj.
   */
  irpj?: number | null;
}

function num(v: string | number | null | undefined): number {
  if (v === null || v === undefined) return 0;
  const n = typeof v === "number" ? v : parseFloat(v);
  return Number.isFinite(n) ? n : 0;
}

function optNum(v: string | number | null | undefined): number | undefined {
  if (v === null || v === undefined || v === "") return undefined;
  const n = typeof v === "number" ? v : parseFloat(v);
  return Number.isFinite(n) ? n : undefined;
}

/**
 * Monta o ProposalPDFData canônico (sem `signature`) a partir das linhas
 * salvas da cotação. O bloco de assinatura é específico de cada origem
 * (interna lê quotations.signatureData; pública usa o retorno do POST de
 * assinatura) e portanto é adicionado pelo chamador.
 */
export function assembleProposalData(input: AssembleProposalInput): ProposalPDFData {
  const { quotation: q, restaurants: rawRestaurants, items: rawItems, billingSchedule } = input;

  const numRest = rawRestaurants.length;
  const duration = q.cycles || 1;
  const totalContractValue = num(q.totalValue);
  const monthlyTotal = duration > 0 ? totalContractValue / duration : totalContractValue;
  const effectiveNumRest = numRest > 0 ? numRest : 1;
  const pricePerRest = monthlyTotal / effectiveNumRest;

  const restaurants = rawRestaurants.map((r) => ({
    name: r.restaurantName || "Local",
    neighborhood: r.restaurantAddress || "",
    coasters: r.coasterQuantity || 0,
  }));

  const items: ProposalItem[] | undefined = rawItems.length > 0
    ? rawItems.map((item) => {
        const semanasMatch = item.notes?.match(/(\d+)sem/);
        const itemSemanas = semanasMatch ? parseInt(semanasMatch[1]) : duration * 4;
        const spotMatch = item.notes?.match(/Spot(30|15)s/);
        const insMatch = item.notes?.match(/(\d+)ins\/dia/);
        const cliMatch = item.notes?.match(/(\d+)cli\/mês/);
        const spotSec = spotMatch ? (parseInt(spotMatch[1]) as 15 | 30) : null;
        const insPerDay = insMatch ? parseInt(insMatch[1]) : null;
        const monthlyClients = cliMatch ? parseInt(cliMatch[1]) : null;
        const impressionsPerRestaurant = (insPerDay !== null && monthlyClients !== null)
          ? insPerDay * monthlyClients
          : undefined;
        return {
          productName: item.productName || "",
          volume: num(item.quantity),
          semanas: itemSemanas,
          unitPrice: num(item.unitPrice),
          totalPrice: num(item.totalPrice),
          spotSeconds: spotSec,
          impressionsPerRestaurant,
        };
      })
    : undefined;

  return {
    billingSchedule: (billingSchedule || []).map((b) => ({
      sequence: b.sequence,
      amount: b.amount,
      dueDate: b.dueDate,
      notes: b.notes,
    })),
    clientName: q.clientName || q.leadName || "Cliente",
    clientCompany: q.clientCompany || q.leadCompany || undefined,
    clientCnpj: q.clientCnpj || undefined,
    clientEmail: q.clientEmail || undefined,
    clientPhone: q.clientPhone || undefined,
    quotationName: q.quotationName || q.quotationNumber || undefined,
    coasterVolume: q.coasterVolume,
    numRestaurants: numRest,
    coastersPerRestaurant: numRest > 0 ? Math.round(q.coasterVolume / numRest) : q.coasterVolume,
    contractDuration: duration,
    semanas: items ? undefined : duration * 4,
    pricePerRestaurant: pricePerRest,
    monthlyTotal,
    contractTotal: totalContractValue,
    includesProduction: q.includesProduction ?? true,
    isBonificada: q.isBonificada ?? false,
    hasPartnerDiscount: q.hasPartnerDiscount ?? false,
    restaurants,
    productName: q.productName || undefined,
    productUnitLabelPlural: q.productUnitLabelPlural || undefined,
    items,
    periodStart: q.periodStart || undefined,
    batchWeeks: q.batchWeeks ?? 4,
    isCustomProduct: q.isCustomProduct ?? false,
    customProductName: q.customProductName || undefined,
    customProjectCost: optNum(q.customProjectCost),
    customPricingMode: q.customPricingMode || undefined,
    customMarginPercent: optNum(q.customMarginPercent),
    customRestaurantCommission: optNum(q.customRestaurantCommission),
    customPartnerCommission: optNum(q.customPartnerCommission),
    customSellerCommission: optNum(q.customSellerCommission),
    customFinalPrice: optNum(q.customFinalPrice),
    agencyCommissionPercent: optNum(q.agencyCommissionPercent),
    irpj: input.irpj != null ? input.irpj : PREMISSAS_DEFAULTS.irpj,
  };
}
