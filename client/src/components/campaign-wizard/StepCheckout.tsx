import { useEffect, useMemo } from "react";
import { AlertTriangle } from "lucide-react";
import { trpc, type RouterOutputs } from "@/lib/trpc";
import { useWizardStore } from "./wizardStore";
import { WizardShell } from "./WizardShell";
import { CartSummary } from "./CartSummary";
import { toast } from "sonner";

type CreateBuilderResult = RouterOutputs["quotation"]["createFromBuilder"];

interface Props {
  clientId: number | null;
  clientLabel: string | null;
  hasPartner: boolean;
  source: "self_service_anunciante" | "self_service_parceiro" | "internal";
}

export function StepCheckout({ clientId, clientLabel, hasPartner: _hp, source }: Props) {
  const cart = useWizardStore((s) => s.cart);
  const startDate = useWizardStore((s) => s.startDate);
  const endDate = useWizardStore((s) => s.endDate);
  const confirm = useWizardStore((s) => s.confirm);
  const setConfirm = useWizardStore((s) => s.setConfirm);
  const setSuccess = useWizardStore((s) => s.setSuccess);

  // Verifica conflito de exclusividade de categoria via backend.
  const restaurantIds = useMemo(
    () => Array.from(new Set(cart.map((c) => c.restaurantId))),
    [cart],
  );
  const { data: conflictCheck = [] } = trpc.anunciantePortal.getProductsForLocations.useQuery(
    { restaurantIds, startDate, endDate },
    { enabled: restaurantIds.length > 0 },
  );

  const conflicts = (conflictCheck as RouterOutputs["anunciantePortal"]["getProductsForLocations"]).filter(
    (l) => l.categoryConflict,
  );

  useEffect(() => {
    if (!confirm.campaignName && cart.length > 0) {
      const date = new Date();
      const month = date.toLocaleString("pt-BR", { month: "long" });
      const productNames = Array.from(new Set(cart.map((c) => c.productName)));
      const head = productNames.slice(0, 2).join(" + ");
      setConfirm({
        campaignName: `${head} — ${month} ${date.getFullYear()}`,
        startDate: confirm.startDate || startDate,
      });
    }
  }, [cart, confirm.campaignName, confirm.startDate, startDate, setConfirm]);

  const utils = trpc.useUtils();

  const createMutation = trpc.quotation.createFromBuilder.useMutation({
    onSuccess: (created: CreateBuilderResult) => {
      toast.success(`Cotação ${created.quotationNumber} criada!`);
      // limpa o draft do servidor — a cotação está criada, não precisa mais
      if (clientId != null && source === "self_service_anunciante") {
        utils.anunciantePortal.loadCartDraft.invalidate();
        // best effort cleanup — não precisa esperar.
        try {
          (trpc as any)?.anunciantePortal?.clearCartDraft &&
            // ignore — handled via separate mutation in store via subscriber.
            null;
        } catch {}
      }
      setSuccess(created.quotationNumber, created.id);
    },
    onError: (err) => toast.error(`Erro: ${err.message}`),
  });

  const totalEstimated = cart.reduce((s, it) => s + (it.estimatedTotal ?? 0), 0);
  const totalImpressions = cart.reduce(
    (s, it) => s + it.volume * it.cycles,
    0,
  );

  const handleSubmit = () => {
    if (cart.length === 0) return;
    const items = cart.map((c) => ({
      productId: c.productId,
      productName: c.productName,
      volume: c.volume,
      weeks: c.cycles * c.cycleWeeks,
      restaurantId: c.restaurantId,
      shareIndex: c.shareIndex,
      cycleWeeks: c.cycleWeeks,
      cycles: c.cycles,
    }));
    const venueIds = Array.from(new Set(cart.map((c) => c.restaurantId)));
    createMutation.mutate({
      clientId,
      source,
      campaignName: confirm.campaignName,
      startDate: confirm.startDate || startDate,
      briefing: confirm.notes.trim() || undefined,
      venueIds,
      estimatedTotal: totalEstimated,
      estimatedImpressions: totalImpressions,
      items,
    });
  };

  const valid = cart.length > 0 && confirm.campaignName.trim().length >= 3 && !!confirm.startDate;

  return (
    <WizardShell
      eyebrow="05 · checkout"
      title="Revisar e enviar"
      subtitle="Esta cotação será criada como rascunho. Após aprovação, as fases são geradas automaticamente em ciclos de 4 semanas."
      onNext={handleSubmit}
      nextLabel={createMutation.isPending ? "enviando…" : "enviar cotação"}
      nextDisabled={!valid || createMutation.isPending}
      isLoading={createMutation.isPending}
      summary={<CartSummary clientLabel={clientLabel} />}
    >
      {conflicts.length > 0 && (
        <div className="mb-5 rounded-2xl border border-mesa-amber/40 bg-mesa-amber/10 p-4 flex items-start gap-3">
          <AlertTriangle className="w-5 h-5 text-mesa-amber shrink-0 mt-0.5" />
          <div className="text-[13px] text-mesa-amber">
            <div className="font-semibold mb-1">Aviso de exclusividade de categoria</div>
            <div>
              {conflicts.length} local(is) selecionado(s) {conflicts.length === 1 ? "tem" : "têm"} exclusividade
              para algumas categorias. A equipe mesa.ads validará se sua marca pode anunciar nestes locais
              antes de aprovar a cotação.
            </div>
            <ul className="list-disc ml-5 mt-2 text-[12px] text-mesa-amber/90">
              {conflicts.map((c) => (
                <li key={c.restaurantId}>{c.name}</li>
              ))}
            </ul>
          </div>
        </div>
      )}

      <div className="rounded-2xl border border-hairline bg-ink-900/50 backdrop-blur-md p-6 sm:p-8 space-y-6 max-w-2xl">
        <Field label="nome da campanha *">
          <input
            type="text"
            value={confirm.campaignName}
            onChange={(e) => setConfirm({ campaignName: e.target.value })}
            placeholder="Ex: Lançamento Verão 2026"
            className="w-full h-12 rounded-xl bg-ink-950/60 border border-hairline px-4 text-[14px] text-chalk placeholder:text-chalk-dim outline-none focus:border-mesa-neon/60 focus:ring-2 focus:ring-mesa-neon/20"
            data-testid="checkout-name"
          />
        </Field>

        <Field label="data desejada de início *">
          <input
            type="date"
            value={confirm.startDate || startDate}
            onChange={(e) => setConfirm({ startDate: e.target.value })}
            min={new Date().toISOString().slice(0, 10)}
            className="w-full h-12 rounded-xl bg-ink-950/60 border border-hairline px-4 text-[14px] text-chalk outline-none focus:border-mesa-neon/60 focus:ring-2 focus:ring-mesa-neon/20 [color-scheme:dark]"
            data-testid="checkout-start"
          />
        </Field>

        <Field label="observações para o time comercial">
          <textarea
            value={confirm.notes}
            onChange={(e) => setConfirm({ notes: e.target.value })}
            placeholder="Algo que devemos saber? (opcional)"
            rows={4}
            className="w-full rounded-xl bg-ink-950/60 border border-hairline px-4 py-3 text-[14px] text-chalk placeholder:text-chalk-dim outline-none focus:border-mesa-neon/60 focus:ring-2 focus:ring-mesa-neon/20 resize-none"
            data-testid="checkout-notes"
          />
        </Field>
      </div>
    </WizardShell>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-[10px] uppercase tracking-[0.22em] text-chalk-dim mb-2">
        {label}
      </label>
      {children}
    </div>
  );
}
