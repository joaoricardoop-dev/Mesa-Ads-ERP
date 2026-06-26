import { create } from "zustand";

// Marketplace v2 — Fluxo do cliente final reusa o "ecommerce de mídia" interno
// (InventoryCatalog + MediaPlanPanel) numa única tela "shop". A seleção/plano
// vive no `mediaShopStore` (fonte única, com persistência em localStorage).
// Este store guarda apenas a NAVEGAÇÃO do wizard e o resultado da cotação.
export type WizardStep = "hero" | "shop" | "success";

export const STEP_ORDER: WizardStep[] = ["hero", "shop", "success"];

export const STEP_LABELS: Record<WizardStep, string> = {
  hero: "Início",
  shop: "Plano de mídia",
  success: "Pronto",
};

interface WizardState {
  step: WizardStep;
  quotationNumber: string | null;
  quotationId: number | null;

  goTo: (s: WizardStep) => void;
  next: () => void;
  back: () => void;
  setSuccess: (quotationNumber: string, quotationId: number) => void;
  reset: () => void;
}

export const useWizardStore = create<WizardState>()((set, get) => ({
  step: "hero",
  quotationNumber: null,
  quotationId: null,

  goTo: (s) => set({ step: s }),
  next: () => {
    const i = STEP_ORDER.indexOf(get().step);
    if (i >= 0 && i < STEP_ORDER.length - 1) set({ step: STEP_ORDER[i + 1] });
  },
  back: () => {
    const i = STEP_ORDER.indexOf(get().step);
    if (i > 0) set({ step: STEP_ORDER[i - 1] });
  },
  setSuccess: (quotationNumber, quotationId) =>
    set({ quotationNumber, quotationId, step: "success" }),
  reset: () => set({ step: "hero", quotationNumber: null, quotationId: null }),
}));
