import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import { cyclesForDays } from "@shared/period";
import {
  quotePrice,
  type PricingTier,
  type DiscountTier,
  type QuotePremissas,
} from "@/components/campaign-wizard/pricing";

// ─── Store do Ecommerce de Mídia (aba Orçamento interna) ─────────────────────
// Estado de seleção do inventário + configuração do plano de mídia. Pensado para
// ser reutilizado pelo construtor do cliente final (tarefa downstream).
//
// Fontes únicas que este store NÃO duplica (apenas guarda snapshots p/ derivar):
//   - preço de circuito DOOH → shared/cpm-pricing.ts (computeCircuitTotal)
//   - período/ciclos → shared/period.ts

// Um item selecionado = UM circuito DOOH (uma `telas` row). Preço = inserções/
// semana × custo/inserção × semanas (fonte única: shared/cpm-pricing.ts). Não há
// mais impressões/alcance — o circuito é a unidade de venda.
export interface MediaSelectedItem {
  telaId: number;
  restaurantId: number;
  restaurantName: string;
  neighborhood: string | null;
  circuitName: string;
  productId: number;
  productName: string;
  /** Snapshot da precificação do circuito (fonte: cadastro de telas). */
  insertionsPerWeek: number;
  costPerInsertion: number;
  /** Nº de cotas do circuito (default 1). O preço escala linearmente: total =
   *  (custo/semana × semanas) × cotas. Fonte única da multiplicação:
   *  computeCircuitLineTotal (shared/cpm-pricing.ts). */
  cotas?: number;
  /** Desconto da linha em % (0–100), aplicado ANTES do desconto global ("Cupom
   *  %"). Fonte única do líquido: applyLineDiscount (shared/proposal-line-pricing). */
  lineDiscountPercent?: number;
  /** Período de veiculação próprio da linha (opcional). Quando nulo, usa o
   *  período global do plano. Persiste em quotation_items.start_date/end_date. */
  startDate?: string | null;
  endDate?: string | null;
}

function todayISO(): string {
  return new Date().toISOString().slice(0, 10);
}
function plusDaysISO(iso: string, days: number): string {
  const d = new Date(iso + "T00:00:00Z");
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

let _uidSeq = 0;
function makeUid(prefix: string): string {
  _uidSeq += 1;
  return `${prefix}-${Date.now().toString(36)}-${_uidSeq}`;
}

/** Parcela do cronograma de pagamento (condições de pagamento). Espelha o
 *  DraftScheduleItem do builder clássico — fonte única do shape vai pro backend
 *  via billingSchedule.setForQuotation. */
export interface DraftParcela {
  sequence: number;
  amount: string;
  dueDate: string;
  notes: string;
}

// ─── Produtos por quantidade (bolachas/impressos e demais formatos) ──────────
// Diferente das telas, NÃO são presos a um local: são comprados por QUANTIDADE e
// distribuídos depois. Por isso a unidade de compra é a qtd, e o preço sai dos
// tiers de volume via o helper canônico `quotePrice` (fonte única de preço de
// produto físico — espelha o backend createFromBuilder).
export interface MediaQuantityItem {
  /** Identificador único da LINHA (não do produto) — permite recorrência: o
   *  mesmo produto pode aparecer em várias linhas com períodos/quantidades
   *  distintos (ex.: 4 veiculações de bolacha agendadas ao longo do ano). */
  uid: string;
  productId: number;
  productName: string;
  tipo: string | null;
  pricingMode: string | null;
  unitLabel: string;
  quantity: number;
  /** Desconto da linha em % (0–100), aplicado ANTES do desconto global ("Cupom
   *  %"). Fonte única do líquido: applyLineDiscount (shared/proposal-line-pricing). */
  lineDiscountPercent?: number;
  /** Período próprio da linha (recorrência). Quando nulo, usa o período global
   *  do plano. Persiste em quotation_items.start_date/end_date. */
  startDate?: string | null;
  endDate?: string | null;
  /** Snapshot dos tiers de volume do produto (origem: product.getPricingBundle). */
  tiers: PricingTier[];
  /** Snapshot dos tiers de desconto por valor do produto. */
  discountTiers: DiscountTier[];
}

/**
 * Semanas equivalentes ao período (para o desconto por prazo em produtos por
 * quantidade). Deriva do nº de ciclos do período (fonte única: shared/period.ts),
 * mantendo coerência com a precificação por ciclos de 4 semanas.
 */
export function quantityWeeksForDays(days: number): number {
  return Math.max(1, Math.max(1, cyclesForDays(days)) * 4);
}

/**
 * Mapeia um item por quantidade para o helper canônico `quotePrice`. ÚNICA ponte
 * media-shop → quotePrice: catálogo (preview) e plano usam esta função, nunca
 * recalculam preço inline.
 */
export function quoteQuantityItem(
  it: Pick<MediaQuantityItem, "productId" | "productName" | "pricingMode" | "tipo" | "tiers" | "discountTiers" | "quantity">,
  days: number,
  premissas: QuotePremissas,
) {
  return quotePrice({
    product: { id: it.productId, name: it.productName, pricingMode: it.pricingMode, tipo: it.tipo },
    tiers: it.tiers,
    discountTiers: it.discountTiers,
    volume: Math.max(1, it.quantity),
    weeks: quantityWeeksForDays(days),
    hasPartner: false,
    premissas,
  });
}

/** Modo de visualização do catálogo de inventário (InventoryCatalog). */
export type CatalogViewMode = "list" | "cards" | "map";

interface MediaShopState {
  clientId: number | null;
  leadId: number | null;
  startDate: string;
  endDate: string;
  category: string | null;
  neighborhood: string | null;
  /** Preferência de visualização do catálogo escolhida pelo usuário. `null` =
   *  nunca escolheu → o consumidor aplica o default por audiência. Persiste para
   *  respeitar a escolha entre visitas. */
  catalogView: CatalogViewMode | null;
  selected: MediaSelectedItem[];
  quantityItems: MediaQuantityItem[];
  campaignName: string;
  /** Cupom de desconto em % (0–100) aplicado sobre o subtotal (display). */
  couponPercent: number;
  /**
   * Âncora "valor final exato" do desconto global. Quando não-nula, o total do
   * plano É exatamente este valor (sem passar por % arredondada) e a % exibida
   * é derivada/informativa. Editar a % manualmente (setCoupon) limpa a âncora
   * — só existe UMA âncora ativa por vez (fonte única do desconto global).
   */
  targetTotal: number | null;
  notes: string;
  /** Bonificação: exclui a cotação dos KPIs financeiros e dispensa cronograma. */
  isBonificada: boolean;
  /** Condições de pagamento (parcelas). Vazio = parcela única default no backend. */
  schedule: DraftParcela[];

  setClient: (clientId: number | null) => void;
  setLead: (leadId: number | null) => void;
  setDates: (start: string, end: string) => void;
  setCategory: (category: string | null) => void;
  setNeighborhood: (neighborhood: string | null) => void;
  setCatalogView: (view: CatalogViewMode) => void;
  addItem: (item: MediaSelectedItem) => void;
  removeItem: (telaId: number) => void;
  toggleItem: (item: MediaSelectedItem) => void;
  isSelected: (telaId: number) => boolean;
  updateItem: (telaId: number, patch: Partial<MediaSelectedItem>) => void;
  /** Sempre adiciona uma NOVA linha (recorrência). uid é gerado aqui. */
  addQuantityItem: (item: Omit<MediaQuantityItem, "uid">) => void;
  removeQuantityItem: (uid: string) => void;
  updateQuantityItem: (uid: string, patch: Partial<MediaQuantityItem>) => void;
  /** Quantas linhas existem para um produto (display no catálogo). */
  quantityCountForProduct: (productId: number) => number;
  setBonificada: (isBonificada: boolean) => void;
  setSchedule: (schedule: DraftParcela[]) => void;
  setCampaignName: (name: string) => void;
  setCoupon: (pct: number) => void;
  /** Fixa o valor final exato (limpa quando `null`). */
  setTargetTotal: (value: number | null) => void;
  setNotes: (notes: string) => void;
  /** Mescla um snapshot (ex.: draft do servidor) sobre o estado atual. */
  hydrate: (partial: Partial<MediaShopState>) => void;
  reset: () => void;
}

const DEFAULT_START = todayISO();
const DEFAULT_END = plusDaysISO(DEFAULT_START, 27); // 4 semanas

export const useMediaShopStore = create<MediaShopState>()(
  persist(
    (set, get) => ({
  clientId: null,
  leadId: null,
  startDate: DEFAULT_START,
  endDate: DEFAULT_END,
  category: null,
  neighborhood: null,
  catalogView: null,
  selected: [],
  quantityItems: [],
  campaignName: "",
  couponPercent: 0,
  targetTotal: null,
  notes: "",
  isBonificada: false,
  schedule: [],

  setClient: (clientId) => set({ clientId, leadId: clientId != null ? null : get().leadId }),
  setLead: (leadId) => set({ leadId, clientId: leadId != null ? null : get().clientId }),
  setDates: (startDate, endDate) => set({ startDate, endDate }),
  setCategory: (category) => set({ category }),
  setNeighborhood: (neighborhood) => set({ neighborhood }),
  setCatalogView: (catalogView) => set({ catalogView }),
  addItem: (item) =>
    set((s) =>
      s.selected.some((i) => i.telaId === item.telaId)
        ? s
        : { selected: [...s.selected, item] },
    ),
  removeItem: (telaId) =>
    set((s) => ({ selected: s.selected.filter((i) => i.telaId !== telaId) })),
  toggleItem: (item) =>
    set((s) =>
      s.selected.some((i) => i.telaId === item.telaId)
        ? { selected: s.selected.filter((i) => i.telaId !== item.telaId) }
        : { selected: [...s.selected, item] },
    ),
  isSelected: (telaId) => get().selected.some((i) => i.telaId === telaId),
  updateItem: (telaId, patch) =>
    set((s) => ({
      selected: s.selected.map((i) => (i.telaId === telaId ? { ...i, ...patch } : i)),
    })),
  addQuantityItem: (item) =>
    set((s) => ({
      quantityItems: [...s.quantityItems, { ...item, uid: makeUid("q") }],
    })),
  removeQuantityItem: (uid) =>
    set((s) => ({ quantityItems: s.quantityItems.filter((i) => i.uid !== uid) })),
  updateQuantityItem: (uid, patch) =>
    set((s) => ({
      quantityItems: s.quantityItems.map((i) => (i.uid === uid ? { ...i, ...patch } : i)),
    })),
  quantityCountForProduct: (productId) =>
    get().quantityItems.filter((i) => i.productId === productId).length,
  setBonificada: (isBonificada) => set({ isBonificada }),
  setSchedule: (schedule) => set({ schedule }),
  setCampaignName: (campaignName) => set({ campaignName }),
  setCoupon: (couponPercent) =>
    set({ couponPercent: Math.min(100, Math.max(0, couponPercent)), targetTotal: null }),
  setTargetTotal: (targetTotal) =>
    set(
      targetTotal == null || !Number.isFinite(targetTotal) || targetTotal < 0
        ? { targetTotal: null }
        : { targetTotal, couponPercent: 0 },
    ),
  setNotes: (notes) => set({ notes }),
  hydrate: (partial) => set((s) => ({ ...s, ...partial })),
  reset: () =>
    set({
      selected: [],
      quantityItems: [],
      campaignName: "",
      couponPercent: 0,
      targetTotal: null,
      notes: "",
      isBonificada: false,
      schedule: [],
      category: null,
      neighborhood: null,
    }),
    }),
    {
      // Persiste a SELEÇÃO + plano (não a entidade interna clientId/leadId nem o
      // cronograma/bonificação internos) para que o trabalho em andamento
      // sobreviva a reload/login no fluxo /montar-campanha.
      name: "mesa-mediashop-v1",
      storage: createJSONStorage(() => localStorage),
      partialize: (s) => ({
        startDate: s.startDate,
        endDate: s.endDate,
        category: s.category,
        neighborhood: s.neighborhood,
        catalogView: s.catalogView,
        selected: s.selected,
        quantityItems: s.quantityItems,
        campaignName: s.campaignName,
        couponPercent: s.couponPercent,
        targetTotal: s.targetTotal,
        notes: s.notes,
      }),
    },
  ),
);
