import { useEffect } from "react";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import { daysInRangeInclusive } from "@shared/period";
import { InventoryCatalog, type CatalogAudience } from "./InventoryCatalog";
import { MediaPlanPanel, useMediaPlan } from "./MediaPlanPanel";
import { useMediaShopStore, quantityWeeksForDays } from "./mediaShopStore";

// ─── Construtor de plano de mídia para o cliente final ───────────────────────
// Reaproveita os MESMOS componentes do ecommerce interno (InventoryCatalog +
// MediaPlanPanel + mediaShopStore) — sem duplicar inventário nem precificação.
// A diferença é apenas o contexto: cliente fixo (não há toggle cliente/lead),
// controles internos escondidos (bonificação, condições de pagamento) e a
// `source` correta para o backend validar o perfil (self_service_*).

type SelfServiceSource = "self_service_anunciante" | "self_service_parceiro";

interface MediaShopBuilderProps {
  /** Cliente ao qual a cotação será amarrada. Para anunciante = seu próprio
   *  client (ctx.user.clientId); para parceiro = um cliente do seu portfólio. */
  clientId: number;
  source: SelfServiceSource;
  onClose?: () => void;
  onSuccess?: () => void;
}

export function MediaShopBuilder({ clientId, source, onClose, onSuccess }: MediaShopBuilderProps) {
  const utils = trpc.useUtils();
  const { setClient, setLead, startDate, endDate, campaignName, notes, reset } =
    useMediaShopStore();
  const selected = useMediaShopStore((s) => s.selected);
  const quantityItems = useMediaShopStore((s) => s.quantityItems);

  const audience: CatalogAudience = source === "self_service_parceiro" ? "parceiro" : "anunciante";

  // Limpa o store e amarra ao cliente ao montar; limpa de novo ao desmontar para
  // não vazar seleção entre aberturas do diálogo.
  useEffect(() => {
    reset();
    setClient(clientId);
    setLead(null);
    return () => {
      reset();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clientId]);

  const plan = useMediaPlan();

  const createMutation = trpc.quotation.createFromBuilder.useMutation({
    onSuccess: (res: any) => {
      toast.success(
        res?.quotationNumber
          ? `Proposta ${res.quotationNumber} enviada! Nossa equipe entrará em contato.`
          : "Proposta enviada! Nossa equipe entrará em contato.",
      );
      utils.quotation.list?.invalidate?.();
      reset();
      onSuccess?.();
      onClose?.();
    },
    onError: (err) => {
      toast.error(err.message || "Erro ao enviar proposta. Tente novamente.");
    },
  });

  const hasItems = selected.length > 0 || quantityItems.length > 0;
  const canConfirm = campaignName.trim().length > 0 && hasItems;
  const confirmHint =
    campaignName.trim().length === 0
      ? "Defina o nome da campanha."
      : !hasItems
        ? "Adicione ao menos um local ou produto."
        : undefined;

  function handleConfirm() {
    if (!canConfirm) return;
    // 1 linha = 1 circuito DOOH. Período por linha quando definido; senão herda o
    // global. Enviamos só a identidade do circuito (telaId) + período; o backend
    // recalcula o preço da `telas` row (fonte única).
    const screenItems = plan.items.map((it) => {
      const lineStart = it.startDate || startDate;
      const lineEnd = it.endDate || endDate;
      const lineDays =
        it.startDate && it.endDate
          ? Math.max(1, daysInRangeInclusive(it.startDate, it.endDate))
          : plan.days;
      return {
        productId: it.productId,
        productName: it.productName,
        telaId: it.telaId,
        volume: Math.max(1, it.cotas),
        cotas: it.cotas,
        lineDiscountPercent: it.lineDiscountPercent,
        weeks: Math.max(1, it.weeks),
        restaurantId: it.restaurantId,
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
        lineDiscountPercent: it.lineDiscountPercent,
        weeks: quantityWeeksForDays(lineDays),
        startDate: lineStart,
        endDate: lineEnd,
      };
    });
    const items = [...screenItems, ...qtyItems];

    createMutation.mutate({
      clientId,
      source,
      campaignName: campaignName.trim(),
      startDate,
      endDate,
      // Mensagem do cliente vira briefing da cotação (campo livre do painel).
      briefing: notes.trim() || undefined,
      estimatedTotal: plan.total,
      couponPercent: plan.couponPercent,
      // Autosserviço nunca é bonificação e não define parcelas — o backend semeia
      // o cronograma default e o comercial ajusta depois.
      isBonificada: false,
      items,
    });
  }

  return (
    <div className="flex-1 min-h-0 overflow-y-auto px-6 py-4">
      <div className="grid gap-6 lg:grid-cols-[1fr_360px]">
        <div className="min-w-0">
          <InventoryCatalog audience={audience} />
        </div>
        <div className="lg:sticky lg:top-0 lg:self-start">
          <MediaPlanPanel
            onConfirm={handleConfirm}
            isConfirming={createMutation.isPending}
            canConfirm={canConfirm}
            confirmHint={confirmHint}
            showBonificada={false}
            showPaymentTerms={false}
            indicativePricing
            notesLabel="Mensagem para a equipe (opcional)"
            notesPlaceholder="Conte objetivos, datas ou observações da campanha"
            confirmLabel="Enviar proposta"
          />
        </div>
      </div>
    </div>
  );
}
