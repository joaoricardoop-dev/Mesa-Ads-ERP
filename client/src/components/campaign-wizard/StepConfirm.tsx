import { useEffect, useMemo } from "react";
import { trpc, type RouterOutputs } from "@/lib/trpc";
import { useWizardStore } from "./wizardStore";
import { WizardShell } from "./WizardShell";
import { OrderSummary } from "./OrderSummary";
import { toast } from "sonner";
import { quotePrice, type ProductLite, type PricingTier, type DiscountTier } from "./pricing";

type ProductGet = RouterOutputs["product"]["get"];
type CreateBuilderResult = RouterOutputs["quotation"]["createFromBuilder"];

interface Props {
  clientId: number | null;
  clientLabel: string | null;
  hasPartner: boolean;
  source: "self_service_anunciante" | "self_service_parceiro" | "internal";
}

export function StepConfirm({ clientId, clientLabel, hasPartner, source }: Props) {
  const productId = useWizardStore((s) => s.productId);
  const venueIds = useWizardStore((s) => s.venueIds);
  const volume = useWizardStore((s) => s.volume);
  const weeks = useWizardStore((s) => s.weeks);
  const creative = useWizardStore((s) => s.creative);
  const confirm = useWizardStore((s) => s.confirm);
  const setConfirm = useWizardStore((s) => s.setConfirm);
  const setSuccess = useWizardStore((s) => s.setSuccess);

  const { data: product } = trpc.product.get.useQuery(
    { id: productId ?? 0 },
    { enabled: !!productId },
  );
  const { data: tiers = [] } = trpc.product.getTiers.useQuery(
    { productId: productId ?? 0 },
    { enabled: !!productId },
  );
  const { data: discountTiers = [] } = trpc.product.listDiscountTiers.useQuery(
    { productId: productId ?? 0 },
    { enabled: !!productId },
  );

  const createMutation = trpc.quotation.createFromBuilder.useMutation({
    onSuccess: (created: CreateBuilderResult) => {
      toast.success(`Cotação ${created.quotationNumber} criada!`);
      setSuccess(created.quotationNumber, created.id);
    },
    onError: (err) => toast.error(`Erro: ${err.message}`),
  });

  const productData = product as ProductGet | undefined;
  const productName = productData?.name ?? "Produto";

  useEffect(() => {
    if (!confirm.campaignName && productData) {
      const date = new Date();
      const month = date.toLocaleString("pt-BR", { month: "long" });
      setConfirm({
        campaignName: `${productData.name} — ${month} ${date.getFullYear()}`,
      });
    }
  }, [productData, confirm.campaignName, setConfirm]);

  const productLite = productData
    ? ({
        id: productData.id,
        name: productData.name,
        irpj: productData.irpj ?? null,
        comRestaurante: productData.comRestaurante ?? null,
        comComercial: productData.comComercial ?? null,
        pricingMode: productData.pricingMode ?? null,
      } as ProductLite)
    : null;

  const estimated = useMemo(() => {
    if (!productLite || tiers.length === 0) return null;
    return quotePrice({
      product: productLite,
      tiers: tiers as PricingTier[],
      discountTiers: discountTiers as DiscountTier[],
      volume,
      weeks,
      hasPartner,
    });
  }, [productLite, tiers, discountTiers, volume, weeks, hasPartner]);

  const briefingParts = [creative.briefing.trim()].filter(Boolean);
  if (creative.choice === "own" && creative.fileUrl) {
    briefingParts.push(`Arte enviada: ${creative.fileName ?? creative.fileUrl}`);
  } else if (creative.choice === "agency") {
    briefingParts.push("Cliente solicitou criação de arte pela agência.");
  }
  if (confirm.notes.trim()) {
    briefingParts.push(`Observações: ${confirm.notes.trim()}`);
  }

  const handleSubmit = () => {
    if (!productId) return;
    createMutation.mutate({
      clientId,
      source,
      campaignName: confirm.campaignName,
      startDate: confirm.startDate || undefined,
      briefing: briefingParts.length ? briefingParts.join("\n\n") : undefined,
      venueIds: venueIds.length ? venueIds : undefined,
      estimatedTotal: estimated?.totalPrice,
      estimatedImpressions: volume * weeks,
      items: [
        {
          productId,
          productName,
          volume,
          weeks,
        },
      ],
    });
  };

  const valid = !!productId && confirm.campaignName.trim().length >= 3 && !!confirm.startDate;

  return (
    <WizardShell
      eyebrow="07 · revisão"
      title="Revisar e enviar"
      subtitle="Esta cotação será criada como rascunho. O time comercial revisa e envia para você."
      onNext={handleSubmit}
      nextLabel={createMutation.isPending ? "enviando…" : "enviar cotação"}
      nextDisabled={!valid || createMutation.isPending}
      isLoading={createMutation.isPending}
      summary={
        <OrderSummary
          product={productLite}
          tiers={tiers as PricingTier[]}
          discountTiers={discountTiers as DiscountTier[]}
          hasPartner={hasPartner}
          venueCount={venueIds.length}
          clientLabel={clientLabel}
        />
      }
    >
      <div className="rounded-2xl border border-hairline bg-ink-900/50 backdrop-blur-md p-6 sm:p-8 space-y-6 max-w-2xl">
        <Field label="nome da campanha *">
          <input
            type="text"
            value={confirm.campaignName}
            onChange={(e) => setConfirm({ campaignName: e.target.value })}
            placeholder="Ex: Lançamento Verão 2026"
            className="w-full h-12 rounded-xl bg-ink-950/60 border border-hairline px-4 text-[14px] text-chalk placeholder:text-chalk-dim outline-none focus:border-mesa-neon/60 focus:ring-2 focus:ring-mesa-neon/20 transition"
          />
        </Field>

        <Field label="data desejada de início *">
          <input
            type="date"
            value={confirm.startDate}
            onChange={(e) => setConfirm({ startDate: e.target.value })}
            min={new Date().toISOString().slice(0, 10)}
            className="w-full h-12 rounded-xl bg-ink-950/60 border border-hairline px-4 text-[14px] text-chalk placeholder:text-chalk-dim outline-none focus:border-mesa-neon/60 focus:ring-2 focus:ring-mesa-neon/20 transition [color-scheme:dark]"
          />
        </Field>

        <Field label="observações para o time comercial">
          <textarea
            value={confirm.notes}
            onChange={(e) => setConfirm({ notes: e.target.value })}
            placeholder="Algo que devemos saber? (opcional)"
            rows={4}
            className="w-full rounded-xl bg-ink-950/60 border border-hairline px-4 py-3 text-[14px] text-chalk placeholder:text-chalk-dim outline-none focus:border-mesa-neon/60 focus:ring-2 focus:ring-mesa-neon/20 transition resize-none"
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
