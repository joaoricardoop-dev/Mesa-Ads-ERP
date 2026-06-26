import { useMemo } from "react";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import { cyclesForDays, daysInRangeInclusive } from "@shared/period";
import { InventoryCatalog } from "@/components/media-shop/InventoryCatalog";
import { MediaPlanPanel, useMediaPlan } from "@/components/media-shop/MediaPlanPanel";
import {
  useMediaShopStore,
  quantityWeeksForDays,
} from "@/components/media-shop/mediaShopStore";
import { useWizardStore } from "./wizardStore";
import { MesaAdsLogo } from "./mesa/MesaUI";
import { WizardTopBar } from "./WizardTopBar";

type Source = "self_service_anunciante" | "self_service_parceiro" | "internal";
type ResolvedRole = "anunciante" | "parceiro" | "internal";

interface Props {
  clientId: number | null;
  source: Source;
  role: ResolvedRole;
  clientLabel: string | null;
  hasPartner: boolean;
}

export function StepShop({ clientId, source, role, clientLabel }: Props) {
  const setSuccess = useWizardStore((s) => s.setSuccess);

  const { campaignName, startDate, endDate, notes, reset } = useMediaShopStore();
  const selected = useMediaShopStore((s) => s.selected);
  const quantityItems = useMediaShopStore((s) => s.quantityItems);
  const plan = useMediaPlan();

  const clearDraft = trpc.anunciantePortal.clearCartDraft.useMutation();

  const createMutation = trpc.quotation.createFromBuilder.useMutation({
    onSuccess: (res: any) => {
      if (role === "anunciante" && clientId != null) {
        clearDraft.mutate({ clientId });
      }
      reset();
      setSuccess(res?.quotationNumber ?? "", res?.id ?? 0);
    },
    onError: (err) => {
      toast.error(err.message);
    },
  });

  const hasItems = selected.length > 0 || quantityItems.length > 0;
  const canConfirm = campaignName.trim().length > 0 && hasItems;
  const confirmHint =
    campaignName.trim().length === 0
      ? "Defina o nome da campanha."
      : !hasItems
        ? "Adicione ao menos um local ou produto ao plano."
        : undefined;

  function handleConfirm() {
    if (!canConfirm) return;
    // Mapeamento idêntico ao Orçamento interno (MediaBudget): preço/dias/ciclos
    // por linha derivam das fontes únicas (shared/period). O cliente não envia
    // preço — o backend (createFromBuilder) recalcula como fonte de verdade.
    const screenItems = plan.items.map((it) => {
      const lineStart = it.startDate || startDate;
      const lineEnd = it.endDate || endDate;
      const lineDays =
        it.startDate && it.endDate
          ? Math.max(1, daysInRangeInclusive(it.startDate, it.endDate))
          : plan.days;
      const lineCycles = Math.max(1, cyclesForDays(lineDays));
      return {
        productId: it.productId,
        productName: it.productName,
        volume: Math.max(1, it.screens),
        weeks: Math.max(1, lineCycles * (it.cycleWeeks || 4)),
        restaurantId: it.restaurantId,
        shareIndex: it.shareIndex,
        cycleWeeks: it.cycleWeeks || 4,
        cycles: lineCycles,
        startDate: lineStart,
        endDate: lineEnd,
        days: lineDays,
      };
    });
    const qtyItems = plan.quantityItems.map((it) => {
      const lineStart = it.startDate || startDate;
      const lineEnd = it.endDate || endDate;
      const lineDays =
        it.startDate && it.endDate
          ? Math.max(1, daysInRangeInclusive(it.startDate, it.endDate))
          : plan.days;
      return {
        productId: it.productId,
        productName: it.productName,
        volume: Math.max(1, it.quantity),
        weeks: quantityWeeksForDays(lineDays),
        startDate: lineStart,
        endDate: lineEnd,
      };
    });

    createMutation.mutate({
      clientId: clientId ?? null,
      leadId: null,
      source,
      campaignName: campaignName.trim(),
      startDate,
      estimatedTotal: plan.total,
      estimatedImpressions: plan.exibicoes,
      briefing: notes.trim() || undefined,
      items: [...screenItems, ...qtyItems],
    });
  }

  return (
    <div className="relative min-h-screen text-chalk">
      <header className="relative z-20 px-6 sm:px-10 pt-6 pb-4 flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <a href="/" className="inline-flex items-center gap-3">
            <MesaAdsLogo className="text-xl" />
            <span className="hidden sm:inline-flex items-center gap-1.5 text-[10px] uppercase tracking-[0.22em] text-chalk-dim border-l border-hairline pl-3">
              auto-checkout
            </span>
          </a>
        </div>
        <WizardTopBar />
      </header>

      <main className="px-6 sm:px-10 pb-16 max-w-7xl mx-auto w-full">
        <div className="mb-6">
          <div className="text-[10px] uppercase tracking-[0.22em] text-mesa-neon mb-2">
            01 · inventário · plano de mídia
          </div>
          <h1
            className="font-display font-semibold tracking-[-0.03em] text-chalk text-balance"
            style={{ fontSize: "var(--text-title)" }}
          >
            Monte seu plano de mídia
          </h1>
          <p className="text-sm text-chalk-muted mt-2 max-w-2xl">
            Escolha os locais e produtos do inventário, ajuste o período e veja a
            performance projetada. {clientLabel ? `Cotação para ${clientLabel}.` : ""} O
            time mesa.ads revisa e finaliza a cotação.
          </p>
        </div>

        <div className="grid gap-6 lg:grid-cols-[1fr_380px]">
          <div className="space-y-4">
            <InventoryCatalog />
          </div>
          <div className="lg:sticky lg:top-4 lg:self-start">
            <MediaPlanPanel
              onConfirm={handleConfirm}
              isConfirming={createMutation.isPending}
              canConfirm={canConfirm}
              confirmHint={confirmHint}
              showBonificada={false}
              showPaymentTerms={false}
              indicativePricing
              notesLabel="Observações para o time comercial"
              notesPlaceholder="Algo que devemos saber? (opcional)"
              confirmLabel="Enviar cotação"
            />
          </div>
        </div>
      </main>
    </div>
  );
}
