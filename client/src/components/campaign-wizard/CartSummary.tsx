import { useMemo } from "react";
import { useWizardStore } from "./wizardStore";
import { MesaChip } from "./mesa/MesaUI";

interface Props {
  clientLabel: string | null;
}

// Resumo lateral (aside) do carrinho — versão Marketplace v2: mostra
// agrupamento por local, totais e contagem de itens.
export function CartSummary({ clientLabel }: Props) {
  const cart = useWizardStore((s) => s.cart);
  const startDate = useWizardStore((s) => s.startDate);
  const endDate = useWizardStore((s) => s.endDate);

  const grouped = useMemo(() => {
    const map = new Map<number, { name: string; items: typeof cart }>();
    for (const it of cart) {
      const slot = map.get(it.restaurantId) ?? { name: it.restaurantName, items: [] };
      slot.items.push(it);
      map.set(it.restaurantId, slot);
    }
    return Array.from(map.entries());
  }, [cart]);

  const total = useMemo(
    () => cart.reduce((s, it) => s + (it.estimatedTotal ?? 0), 0),
    [cart],
  );
  const totalShares = cart.reduce((s, it) => s + 1, 0);
  const totalCycles = cart.reduce((s, it) => s + it.cycles, 0);

  return (
    <div className="space-y-4">
      <div className="space-y-1">
        <div className="text-[10px] uppercase tracking-[0.22em] text-chalk-dim">cliente</div>
        <div className="text-sm text-chalk font-medium truncate">{clientLabel ?? "—"}</div>
      </div>
      <div className="flex items-center gap-2 text-[11px] text-chalk-muted">
        <MesaChip tone="ice" size="xs">{startDate}</MesaChip>
        <span>→</span>
        <MesaChip tone="ice" size="xs">{endDate}</MesaChip>
      </div>

      {cart.length === 0 ? (
        <div className="rounded-xl border border-dashed border-hairline p-4 text-center text-[12px] text-chalk-muted">
          Carrinho vazio. Selecione locais e adicione produtos.
        </div>
      ) : (
        <div className="space-y-3 max-h-[40vh] overflow-y-auto pr-1">
          {grouped.map(([rid, group]) => (
            <div key={rid} className="rounded-xl border border-hairline bg-ink-950/40 p-3">
              <div className="text-[11px] uppercase tracking-[0.16em] text-mesa-neon mb-1.5 truncate">
                {group.name}
              </div>
              <ul className="space-y-1">
                {group.items.map((it) => (
                  <li
                    key={`${it.productId}-${it.shareIndex}`}
                    className="flex items-center justify-between gap-2 text-[12px]"
                  >
                    <span className="text-chalk truncate">
                      {it.productName} <span className="text-chalk-dim">· share {it.shareIndex} · {it.cycles}c</span>
                    </span>
                    <span className="text-chalk-muted tabular-nums shrink-0">
                      {(it.estimatedTotal ?? 0).toLocaleString("pt-BR", {
                        style: "currency",
                        currency: "BRL",
                      })}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      )}

      <div className="border-t border-hairline pt-3 space-y-1.5">
        <Row label="shares" value={String(totalShares)} />
        <Row label="ciclos totais" value={String(totalCycles)} />
        <Row
          label="estimativa"
          value={total.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
          highlight
        />
      </div>
    </div>
  );
}

function Row({ label, value, highlight }: { label: string; value: string; highlight?: boolean }) {
  return (
    <div className="flex items-center justify-between text-[12px]">
      <span className="text-chalk-dim uppercase tracking-[0.14em]">{label}</span>
      <span
        className={
          highlight
            ? "text-mesa-neon font-display font-semibold tabular-nums"
            : "text-chalk tabular-nums"
        }
      >
        {value}
      </span>
    </div>
  );
}
