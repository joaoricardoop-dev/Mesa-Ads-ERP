import { useMemo, useState } from "react";
import { ChevronDown, Loader2, Plus, Check, Minus, AlertTriangle } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { trpc, type RouterOutputs } from "@/lib/trpc";
import { useWizardStore } from "./wizardStore";
import { WizardShell } from "./WizardShell";
import { CartSummary } from "./CartSummary";
import { ShareAvailabilityBadge } from "./ShareAvailabilityBadge";
import { cn } from "@/lib/utils";

type LocalProdutos =
  RouterOutputs["anunciantePortal"]["getProductsForLocations"][number];

interface Props {
  clientLabel: string | null;
  hasPartner: boolean;
}

export function StepProdutosPorLocal({ clientLabel }: Props) {
  const locaisIds = useWizardStore((s) => s.locaisIds);
  const startDate = useWizardStore((s) => s.startDate);
  const endDate = useWizardStore((s) => s.endDate);
  const cart = useWizardStore((s) => s.cart);
  const addCartItem = useWizardStore((s) => s.addCartItem);
  const removeCartItem = useWizardStore((s) => s.removeCartItem);
  const next = useWizardStore((s) => s.next);

  const { data = [], isLoading } = trpc.anunciantePortal.getProductsForLocations.useQuery(
    { restaurantIds: locaisIds, startDate, endDate },
    { enabled: locaisIds.length > 0 },
  );

  const [open, setOpen] = useState<number | null>(null);

  const isInCart = (rid: number, pid: number, share: number) =>
    cart.some((c) => c.restaurantId === rid && c.productId === pid && c.shareIndex === share);

  const sharesInCartFor = (rid: number, pid: number) =>
    cart.filter((c) => c.restaurantId === rid && c.productId === pid).length;

  const cycleWeeksDefault = 4;

  // Calcula o "próximo share index disponível" considerando os já no carrinho.
  function pickNextShare(loc: LocalProdutos, prod: LocalProdutos["products"][number]): number | null {
    const taken = new Set(
      cart
        .filter((c) => c.restaurantId === loc.restaurantId && c.productId === prod.productId)
        .map((c) => c.shareIndex),
    );
    for (let i = 1; i <= prod.maxShares; i++) {
      if (!taken.has(i)) return i;
    }
    return null;
  }

  const totalCartItems = cart.length;

  return (
    <WizardShell
      eyebrow="02 · produtos"
      title="Quais produtos por local?"
      subtitle="Cada local oferece um conjunto de produtos com shares disponíveis. Adicione um share por vez — você pode adicionar vários do mesmo produto."
      onNext={next}
      nextDisabled={totalCartItems === 0}
      summary={<CartSummary clientLabel={clientLabel} />}
    >
      {isLoading ? (
        <div className="flex items-center gap-2 text-sm text-chalk-muted">
          <Loader2 className="w-4 h-4 animate-spin" /> carregando produtos…
        </div>
      ) : data.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-hairline p-10 text-center text-sm text-chalk-muted">
          Nenhum produto disponível nos locais selecionados.
        </div>
      ) : (
        <div className="space-y-3">
          {data.map((loc) => {
            const isOpen = open === loc.restaurantId || data.length === 1;
            const totalShares = loc.products.reduce((s, p) => s + p.maxShares, 0);
            const availableShares = loc.products.reduce((s, p) => s + p.availableShares, 0);
            return (
              <div
                key={loc.restaurantId}
                className="rounded-2xl border border-hairline bg-ink-900/50 backdrop-blur-md overflow-hidden"
              >
                <button
                  type="button"
                  onClick={() => setOpen(isOpen ? null : loc.restaurantId)}
                  className="w-full flex items-center justify-between gap-4 p-4 text-left hover:bg-ink-800/40 transition"
                  data-testid={`accordion-${loc.restaurantId}`}
                >
                  <div className="min-w-0">
                    <div className="font-display font-semibold text-chalk truncate">
                      {loc.name}
                    </div>
                    <div className="text-[11px] uppercase tracking-[0.14em] text-chalk-dim mt-0.5">
                      {loc.neighborhood || loc.city} · {loc.products.length} produto(s)
                    </div>
                  </div>
                  <div className="flex items-center gap-3 shrink-0">
                    <ShareAvailabilityBadge available={availableShares} total={totalShares} />
                    <ChevronDown
                      className={cn(
                        "w-4 h-4 text-chalk-muted transition-transform",
                        isOpen && "rotate-180",
                      )}
                    />
                  </div>
                </button>
                <AnimatePresence initial={false}>
                  {isOpen && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: "auto", opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.25 }}
                      className="border-t border-hairline"
                    >
                      <div className="p-4 grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
                        {loc.products.map((p) => {
                          const inCartCount = sharesInCartFor(loc.restaurantId, p.productId);
                          const remainingAvailable = p.availableShares - inCartCount;
                          const canAdd = remainingAvailable > 0;
                          const nextShare = pickNextShare(loc, p);
                          return (
                            <div
                              key={p.productId}
                              className={cn(
                                "rounded-xl border p-3 flex flex-col gap-2",
                                inCartCount > 0
                                  ? "border-mesa-neon/60 bg-mesa-neon/5"
                                  : "border-hairline bg-ink-950/40",
                                p.isFullyBooked && "opacity-60",
                              )}
                              data-testid={`product-card-${loc.restaurantId}-${p.productId}`}
                            >
                              <div className="flex items-start justify-between gap-2">
                                <div className="min-w-0">
                                  <div className="font-medium text-chalk text-[14px] truncate">
                                    {p.productName}
                                  </div>
                                  <div className="text-[10px] uppercase tracking-[0.16em] text-chalk-dim">
                                    {p.productTipo} · ciclo {p.cycleWeeks}sem
                                  </div>
                                </div>
                                <ShareAvailabilityBadge
                                  available={p.availableShares}
                                  total={p.maxShares}
                                />
                              </div>

                              <div className="flex items-center justify-between mt-1">
                                <div className="text-[11px] text-chalk-muted">
                                  {inCartCount > 0
                                    ? `${inCartCount} share(s) no carrinho`
                                    : "Adicione um share para configurar"}
                                </div>
                                <div className="flex items-center gap-1">
                                  {inCartCount > 0 && (
                                    <button
                                      type="button"
                                      onClick={() => {
                                        const item = [...cart]
                                          .reverse()
                                          .find(
                                            (c) =>
                                              c.restaurantId === loc.restaurantId &&
                                              c.productId === p.productId,
                                          );
                                        if (item) {
                                          removeCartItem(
                                            item.restaurantId,
                                            item.productId,
                                            item.shareIndex,
                                          );
                                        }
                                      }}
                                      className="size-7 rounded-full border border-hairline-bold text-chalk-muted hover:text-mesa-red hover:border-mesa-red/40 grid place-items-center transition"
                                      data-testid={`remove-${loc.restaurantId}-${p.productId}`}
                                    >
                                      <Minus className="w-3.5 h-3.5" />
                                    </button>
                                  )}
                                  <button
                                    type="button"
                                    disabled={!canAdd || nextShare == null}
                                    onClick={() => {
                                      if (!canAdd || nextShare == null) return;
                                      addCartItem({
                                        restaurantId: loc.restaurantId,
                                        restaurantName: loc.name,
                                        productId: p.productId,
                                        productName: p.productName,
                                        unitLabel: p.unitLabel,
                                        shareIndex: nextShare,
                                        cycles: 1,
                                        cycleWeeks: p.cycleWeeks ?? cycleWeeksDefault,
                                        volume: 1000,
                                        estimatedUnitPrice: null,
                                        estimatedTotal: null,
                                      });
                                    }}
                                    className={cn(
                                      "h-8 px-3 rounded-full text-[11px] uppercase tracking-[0.14em] font-semibold flex items-center gap-1 transition",
                                      canAdd
                                        ? "bg-mesa-neon text-ink-950 hover:brightness-110"
                                        : "bg-ink-800 text-chalk-dim cursor-not-allowed",
                                    )}
                                    data-testid={`add-${loc.restaurantId}-${p.productId}`}
                                  >
                                    {canAdd ? (
                                      <>
                                        <Plus className="w-3.5 h-3.5" /> share
                                      </>
                                    ) : (
                                      <>
                                        <Check className="w-3.5 h-3.5" /> esgotado
                                      </>
                                    )}
                                  </button>
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                      {loc.categoryConflict && (
                        <div className="mx-4 mb-4 rounded-xl border border-mesa-amber/40 bg-mesa-amber/10 p-3 flex items-start gap-2 text-[12px] text-mesa-amber">
                          <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
                          <div>
                            Este local possui exclusividade para algumas categorias. O time mesa.ads
                            confirmará se sua marca pode anunciar aqui.
                          </div>
                        </div>
                      )}
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            );
          })}
        </div>
      )}
    </WizardShell>
  );
}
