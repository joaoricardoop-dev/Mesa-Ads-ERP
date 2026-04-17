import { create } from "zustand";

export type WizardStep =
  | "hero"
  | "venues"
  | "volume"
  | "duration"
  | "upsell"
  | "creative"
  | "confirm"
  | "success";

export const STEP_ORDER: WizardStep[] = [
  "hero",
  "venues",
  "volume",
  "duration",
  "upsell",
  "creative",
  "confirm",
  "success",
];

export const STEP_LABELS: Record<WizardStep, string> = {
  hero: "Produto",
  venues: "Locais",
  volume: "Volume",
  duration: "Duração",
  upsell: "Adicionais",
  creative: "Arte",
  confirm: "Revisar",
  success: "Pronto",
};

export interface CreativeState {
  choice: "own" | "agency" | null;
  fileUrl: string | null;
  fileName: string | null;
  briefing: string;
}

export interface ConfirmState {
  campaignName: string;
  startDate: string;
  notes: string;
}

interface WizardState {
  step: WizardStep;
  productId: number | null;
  venueIds: number[];
  volume: number;
  weeks: number;
  addOnIds: number[];
  creative: CreativeState;
  confirm: ConfirmState;
  quotationNumber: string | null;
  quotationId: number | null;

  goTo: (s: WizardStep) => void;
  next: () => void;
  back: () => void;
  setProduct: (id: number | null) => void;
  toggleVenue: (id: number) => void;
  setVenues: (ids: number[]) => void;
  setVolume: (n: number) => void;
  setWeeks: (w: number) => void;
  toggleAddOn: (id: number) => void;
  setCreativeChoice: (c: "own" | "agency") => void;
  setCreativeFile: (url: string | null, name: string | null) => void;
  setBriefing: (t: string) => void;
  setConfirm: (patch: Partial<ConfirmState>) => void;
  setSuccess: (quotationNumber: string, quotationId: number) => void;
  reset: () => void;
}

const INITIAL_CREATIVE: CreativeState = {
  choice: null,
  fileUrl: null,
  fileName: null,
  briefing: "",
};

const INITIAL_CONFIRM: ConfirmState = {
  campaignName: "",
  startDate: "",
  notes: "",
};

export const useWizardStore = create<WizardState>((set, get) => ({
  step: "hero",
  productId: null,
  venueIds: [],
  volume: 5000,
  weeks: 12,
  addOnIds: [],
  creative: INITIAL_CREATIVE,
  confirm: INITIAL_CONFIRM,
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
  setProduct: (id) => set({ productId: id }),
  toggleVenue: (id) =>
    set((s) => ({
      venueIds: s.venueIds.includes(id) ? s.venueIds.filter((v) => v !== id) : [...s.venueIds, id],
    })),
  setVenues: (ids) => set({ venueIds: ids }),
  setVolume: (n) => set({ volume: Math.max(100, Math.floor(n)) }),
  setWeeks: (w) => set({ weeks: w }),
  toggleAddOn: (id) =>
    set((s) => ({
      addOnIds: s.addOnIds.includes(id) ? s.addOnIds.filter((a) => a !== id) : [...s.addOnIds, id],
    })),
  setCreativeChoice: (c) => set((s) => ({ creative: { ...s.creative, choice: c } })),
  setCreativeFile: (url, name) =>
    set((s) => ({ creative: { ...s.creative, fileUrl: url, fileName: name } })),
  setBriefing: (t) => set((s) => ({ creative: { ...s.creative, briefing: t } })),
  setConfirm: (patch) => set((s) => ({ confirm: { ...s.confirm, ...patch } })),
  setSuccess: (quotationNumber, quotationId) =>
    set({ quotationNumber, quotationId, step: "success" }),
  reset: () =>
    set({
      step: "hero",
      productId: null,
      venueIds: [],
      volume: 5000,
      weeks: 12,
      addOnIds: [],
      creative: INITIAL_CREATIVE,
      confirm: INITIAL_CONFIRM,
      quotationNumber: null,
      quotationId: null,
    }),
}));
