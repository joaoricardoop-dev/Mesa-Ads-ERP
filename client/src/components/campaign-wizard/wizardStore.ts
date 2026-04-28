import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";

// Marketplace v2 — Novo fluxo: Locais → Produtos por local → Configurar →
// Carrinho → Checkout. O step "hero" continua sendo a landing inicial.
export type WizardStep =
  | "hero"
  | "locais"
  | "produtos"
  | "configurar"
  | "carrinho"
  | "checkout"
  | "success";

export const STEP_ORDER: WizardStep[] = [
  "hero",
  "locais",
  "produtos",
  "configurar",
  "carrinho",
  "checkout",
  "success",
];

export const STEP_LABELS: Record<WizardStep, string> = {
  hero: "Início",
  locais: "Locais",
  produtos: "Produtos",
  configurar: "Configurar",
  carrinho: "Carrinho",
  checkout: "Checkout",
  success: "Pronto",
};

// Item no carrinho — um por par (restaurante × produto × share).
export interface CartItem {
  restaurantId: number;
  restaurantName: string;
  productId: number;
  productName: string;
  unitLabel?: string | null;
  shareIndex: number; // 1..maxShares
  cycles: number; // número de ciclos de 4 semanas
  cycleWeeks: number; // tipicamente 4
  volume: number; // produção (qty) por ciclo
  estimatedUnitPrice?: number | null; // preço estimado por unidade (UI)
  estimatedTotal?: number | null; // total estimado para todos os ciclos
}

export interface ConfirmState {
  campaignName: string;
  startDate: string;
  notes: string;
}

interface WizardState {
  step: WizardStep;
  // Marketplace v2 fields
  locaisIds: number[];
  startDate: string; // YYYY-MM-DD (filtro de disponibilidade)
  endDate: string;   // YYYY-MM-DD
  cart: CartItem[];
  confirm: ConfirmState;
  quotationNumber: string | null;
  quotationId: number | null;
  draftLoaded: boolean;

  goTo: (s: WizardStep) => void;
  next: () => void;
  back: () => void;
  toggleLocal: (id: number) => void;
  setLocais: (ids: number[]) => void;
  setDates: (start: string, end: string) => void;
  addCartItem: (item: CartItem) => void;
  removeCartItem: (restaurantId: number, productId: number, shareIndex: number) => void;
  updateCartItem: (restaurantId: number, productId: number, shareIndex: number, patch: Partial<CartItem>) => void;
  clearCart: () => void;
  setConfirm: (patch: Partial<ConfirmState>) => void;
  setSuccess: (quotationNumber: string, quotationId: number) => void;
  hydrateFromDraft: (cart: Partial<WizardState>) => void;
  reset: () => void;
}

const INITIAL_CONFIRM: ConfirmState = {
  campaignName: "",
  startDate: "",
  notes: "",
};

function defaultRange(): { start: string; end: string } {
  const today = new Date();
  const start = new Date(today);
  start.setDate(start.getDate() + 14);
  const end = new Date(start);
  end.setDate(end.getDate() + 28); // 4 semanas
  const fmt = (d: Date) => d.toISOString().slice(0, 10);
  return { start: fmt(start), end: fmt(end) };
}

const { start: DEFAULT_START, end: DEFAULT_END } = defaultRange();

export const useWizardStore = create<WizardState>()(
  persist(
    (set, get) => ({
      step: "hero",
      locaisIds: [],
      startDate: DEFAULT_START,
      endDate: DEFAULT_END,
      cart: [],
      confirm: INITIAL_CONFIRM,
      quotationNumber: null,
      quotationId: null,
      draftLoaded: false,

      goTo: (s) => set({ step: s }),
      next: () => {
        const i = STEP_ORDER.indexOf(get().step);
        if (i >= 0 && i < STEP_ORDER.length - 1) set({ step: STEP_ORDER[i + 1] });
      },
      back: () => {
        const i = STEP_ORDER.indexOf(get().step);
        if (i > 0) set({ step: STEP_ORDER[i - 1] });
      },
      toggleLocal: (id) =>
        set((s) => ({
          locaisIds: s.locaisIds.includes(id)
            ? s.locaisIds.filter((v) => v !== id)
            : [...s.locaisIds, id],
        })),
      setLocais: (ids) => set({ locaisIds: ids }),
      setDates: (start, end) => set({ startDate: start, endDate: end }),
      addCartItem: (item) =>
        set((s) => {
          const exists = s.cart.find(
            (c) =>
              c.restaurantId === item.restaurantId &&
              c.productId === item.productId &&
              c.shareIndex === item.shareIndex,
          );
          if (exists) return s;
          return { cart: [...s.cart, item] };
        }),
      removeCartItem: (restaurantId, productId, shareIndex) =>
        set((s) => ({
          cart: s.cart.filter(
            (c) =>
              !(
                c.restaurantId === restaurantId &&
                c.productId === productId &&
                c.shareIndex === shareIndex
              ),
          ),
        })),
      updateCartItem: (restaurantId, productId, shareIndex, patch) =>
        set((s) => ({
          cart: s.cart.map((c) =>
            c.restaurantId === restaurantId &&
            c.productId === productId &&
            c.shareIndex === shareIndex
              ? { ...c, ...patch }
              : c,
          ),
        })),
      clearCart: () => set({ cart: [] }),
      setConfirm: (patch) => set((s) => ({ confirm: { ...s.confirm, ...patch } })),
      setSuccess: (quotationNumber, quotationId) =>
        set({ quotationNumber, quotationId, step: "success" }),
      hydrateFromDraft: (draft) =>
        set((s) => ({
          ...s,
          ...draft,
          draftLoaded: true,
        })),
      reset: () => {
        const r = defaultRange();
        set({
          step: "hero",
          locaisIds: [],
          startDate: r.start,
          endDate: r.end,
          cart: [],
          confirm: INITIAL_CONFIRM,
          quotationNumber: null,
          quotationId: null,
          draftLoaded: false,
        });
      },
    }),
    {
      name: "mesa-wizard-state-v2",
      storage: createJSONStorage(() => localStorage),
      partialize: (s) => ({
        locaisIds: s.locaisIds,
        startDate: s.startDate,
        endDate: s.endDate,
        cart: s.cart,
        confirm: s.confirm,
      }),
    },
  ),
);
