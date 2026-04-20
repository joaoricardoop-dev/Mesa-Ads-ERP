import { useMemo } from "react";
import { Trash2, MapPin, Package } from "lucide-react";
import { useWizardStore } from "./wizardStore";
import { WizardShell } from "./WizardShell";
import { CartSummary } from "./CartSummary";

interface Props {
  clientLabel: string | null;
  hasPartner: boolean;
}

export function StepCarrinho({ clientLabel }: Props) {
  const cart = useWizardStore((s) => s.cart);
  const removeCartItem = useWizardStore((s) => s.removeCartItem);
  const next = useWizardStore((s) => s.next);

  const grouped = useMemo(() => {
    const map = new Map<number, { name: string; items: typeof cart }>();
    for (const it of cart) {
      const slot = map.get(it.restaurantId) ?? { name: it.restaurantName, items: [] };
      slot.items.push(it);
      map.set(it.restaurantId, slot);
    }
    return Array.from(map.entries());
  }, [cart]);

  const total = cart.reduce((s, it) => s + (it.estimatedTotal ?? 0), 0);

  return (
    <WizardShell
      eyebrow="04 · carrinho"
      title="Revise os shares e ciclos"
      subtitle="Você pode remover itens antes do checkout. O carrinho fica salvo automaticamente."
      onNext={next}
      nextDisabled={cart.length === 0}
      summary={<CartSummary clientLabel={clientLabel} />}
    >
      {cart.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-hairline p-10 text-center text-sm text-chalk-muted">
          Carrinho vazio.
        </div>
      ) : (
        <div className="space-y-4">
          {grouped.map(([rid, group]) => (
            <div key={rid} className="rounded-2xl border border-hairline bg-ink-900/50 p-5">
              <div className="flex items-center gap-2 text-mesa-neon mb-3">
                <MapPin className="w-4 h-4" />
                <span className="font-display font-semibold">{group.name}</span>
              </div>
              <ul className="divide-y divide-hairline">
                {group.items.map((it) => (
                  <li
                    key={`${it.productId}-${it.shareIndex}`}
                    className="py-3 flex items-center justify-between gap-3"
                    data-testid={`cart-line-${it.restaurantId}-${it.productId}-${it.shareIndex}`}
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <Package className="w-4 h-4 text-chalk-muted shrink-0" />
                      <div className="min-w-0">
                        <div className="text-chalk text-[14px] truncate">
                          {it.productName} · share {it.shareIndex}
                        </div>
                        <div className="text-[11px] text-chalk-dim uppercase tracking-[0.14em]">
                          {it.cycles} ciclo(s) · {it.cycleWeeks}sem · {it.volume.toLocaleString("pt-BR")} un/ciclo
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-3 shrink-0">
                      <span className="font-display font-semibold text-chalk tabular-nums">
                        {(it.estimatedTotal ?? 0).toLocaleString("pt-BR", {
                          style: "currency",
                          currency: "BRL",
                        })}
                      </span>
                      <button
                        type="button"
                        onClick={() => removeCartItem(it.restaurantId, it.productId, it.shareIndex)}
                        className="size-8 rounded-full border border-hairline-bold text-chalk-muted hover:text-mesa-red hover:border-mesa-red/40 grid place-items-center transition"
                        data-testid={`cart-remove-${it.restaurantId}-${it.productId}-${it.shareIndex}`}
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          ))}

          <div className="rounded-2xl border border-mesa-neon/40 bg-mesa-neon/5 p-5 flex items-center justify-between">
            <div>
              <div className="text-[10px] uppercase tracking-[0.18em] text-chalk-dim">total estimado</div>
              <div className="text-[11px] text-chalk-muted">
                Valor final pode incluir multiplicadores sazonais e descontos por prazo.
              </div>
            </div>
            <div className="text-right">
              <div className="font-display font-semibold text-mesa-neon text-2xl tabular-nums">
                {total.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
              </div>
            </div>
          </div>
        </div>
      )}
    </WizardShell>
  );
}
