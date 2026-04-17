import { Loader2, Package } from "lucide-react";
import { trpc, type RouterOutputs } from "@/lib/trpc";
import { useWizardStore } from "./wizardStore";
import { WizardShell } from "./WizardShell";
import { OrderSummary } from "./OrderSummary";
import { cn } from "@/lib/utils";
import type { ProductLite, PricingTier, DiscountTier } from "./pricing";

type ProductRow = RouterOutputs["product"]["list"][number];

interface Props {
  role: "anunciante" | "parceiro" | "internal";
  clientLabel: string | null;
  hasPartner: boolean;
}

export function StepHero({ role, clientLabel, hasPartner }: Props) {
  const productId = useWizardStore((s) => s.productId);
  const setProduct = useWizardStore((s) => s.setProduct);
  const next = useWizardStore((s) => s.next);

  const { data: products = [], isLoading } = trpc.product.list.useQuery();

  const productList = products as ProductRow[];

  const visible = productList.filter((p) => {
    if (!p.isActive) return false;
    if (role === "anunciante") return p.visibleToAdvertisers;
    if (role === "parceiro") return p.visibleToPartners;
    return true;
  });

  const product = productList.find((p) => p.id === productId) ?? null;

  const { data: tiers = [] } = trpc.product.getTiers.useQuery(
    { productId: productId ?? 0 },
    { enabled: !!productId },
  );
  const { data: discountTiers = [] } = trpc.product.listDiscountTiers.useQuery(
    { productId: productId ?? 0 },
    { enabled: !!productId },
  );

  return (
    <WizardShell
      title="Qual é o seu produto?"
      subtitle="Escolha o formato de mídia para sua campanha em locais parceiros."
      onNext={next}
      nextDisabled={!productId}
      summary={
        <OrderSummary
          product={product as ProductLite | null}
          tiers={tiers as PricingTier[]}
          discountTiers={discountTiers as DiscountTier[]}
          hasPartner={hasPartner}
          venueCount={0}
          clientLabel={clientLabel}
        />
      }
    >
      {isLoading ? (
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="w-4 h-4 animate-spin" /> Carregando produtos...
        </div>
      ) : visible.length === 0 ? (
        <div className="rounded-lg border border-dashed border-border/40 p-8 text-center text-sm text-muted-foreground">
          Nenhum produto disponível para o seu perfil no momento.
        </div>
      ) : (
        <div className="grid sm:grid-cols-2 gap-3">
          {visible.map((p) => {
            const active = p.id === productId;
            return (
              <button
                key={p.id}
                type="button"
                onClick={() => setProduct(p.id)}
                className={cn(
                  "group text-left rounded-xl border p-5 transition-all",
                  active
                    ? "border-primary bg-primary/5 shadow-[0_0_0_1px_hsl(var(--primary))]"
                    : "border-border/40 hover:border-border bg-card/40",
                )}
              >
                <div className="flex items-center gap-3 mb-3">
                  <div
                    className={cn(
                      "size-10 rounded-lg flex items-center justify-center",
                      active ? "bg-primary/15 text-primary" : "bg-muted text-muted-foreground",
                    )}
                  >
                    <Package className="w-5 h-5" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="font-semibold truncate">{p.name}</div>
                    <div className="text-[11px] uppercase tracking-wide text-muted-foreground">
                      {p.tipo}
                    </div>
                  </div>
                </div>
                {p.description && (
                  <p className="text-sm text-muted-foreground line-clamp-3">{p.description}</p>
                )}
              </button>
            );
          })}
        </div>
      )}
    </WizardShell>
  );
}
