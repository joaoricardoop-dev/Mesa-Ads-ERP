import { useMemo, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { Trash2, Loader2, Package, Gift } from "lucide-react";
import { daysInRangeInclusive } from "@shared/period";
import { splitAmount, addDaysIso, scheduleMatchesTotal } from "@shared/billingSchedule";
import { computeCircuitLineTotal, circuitWeeksForDays, clampCotas } from "@shared/cpm-pricing";
import { applyLineDiscount, clampLineDiscountPercent } from "@shared/proposal-line-pricing";
import { useSystemPremissas } from "@/hooks/useSystemPremissas";
import type { QuotePremissas } from "@/components/campaign-wizard/pricing";
import { formatCurrency } from "@/lib/format";
import {
  useMediaShopStore,
  quoteQuantityItem,
  type MediaSelectedItem,
  type MediaQuantityItem,
  type DraftParcela,
} from "./mediaShopStore";

function formatInt(n: number): string {
  return Math.round(n).toLocaleString("pt-BR");
}

export interface MediaPlanComputedItem extends MediaSelectedItem {
  /** Total líquido da linha (cotas + desconto de linha aplicados). */
  totalPrice: number;
  /** Semanas cobradas no período da linha (fonte: circuitWeeksForDays). */
  weeks: number;
  /** Custo por semana = inserções/semana × custo/inserção (referência, 1 cota). */
  weeklyCost: number;
  /** Nº de cotas (≥ 1). */
  cotas: number;
  /** Total bruto = custo/semana × semanas × cotas (antes do desconto de linha). */
  grossTotal: number;
  /** Desconto da linha normalizado (0–100). */
  lineDiscountPercent: number;
}

export interface MediaPlanQuantityItem extends MediaQuantityItem {
  /** Total líquido da linha (desconto de linha aplicado). */
  totalPrice: number;
  /** Custo unitário de referência (preço/un. bruto, antes do desconto de linha). */
  unitPrice: number;
  /** Total bruto da linha (antes do desconto de linha). */
  grossTotal: number;
  /** Desconto da linha normalizado (0–100). */
  lineDiscountPercent: number;
}

export function useMediaPlan() {
  const { selected, quantityItems, startDate, endDate, couponPercent } = useMediaShopStore();
  const sys = useSystemPremissas();
  const quotePremissas: QuotePremissas = useMemo(
    () => ({ ...sys.premissas, bvAgencia: sys.bvAgencia }),
    [sys],
  );
  const days = daysInRangeInclusive(startDate, endDate);

  return useMemo(() => {
    const items: MediaPlanComputedItem[] = selected.map((it) => {
      // Período de veiculação por linha: quando definido, o preço usa os dias da
      // linha; senão herda o período global do plano (fonte única:
      // daysInRangeInclusive de @shared/period). Preço do circuito DOOH vem do
      // helper canônico computeCircuitTotal (inserções/semana × custo/inserção ×
      // semanas) — nunca recalcular inline.
      const lineDays =
        it.startDate && it.endDate
          ? daysInRangeInclusive(it.startDate, it.endDate)
          : days;
      const cotas = clampCotas(it.cotas);
      // Fonte única: cotas (multiplicação) + desconto de linha (líquido) vivem
      // em computeCircuitLineTotal — nunca recalcular aqui.
      const line = computeCircuitLineTotal(it, lineDays, cotas, it.lineDiscountPercent);
      return {
        ...it,
        cotas,
        lineDiscountPercent: clampLineDiscountPercent(it.lineDiscountPercent),
        weeks: line?.weeks ?? circuitWeeksForDays(lineDays),
        weeklyCost: line?.weeklyCost ?? 0,
        grossTotal: line?.grossTotal ?? 0,
        totalPrice: line?.netTotal ?? 0,
      };
    });
    const qtyItems: MediaPlanQuantityItem[] = quantityItems.map((it) => {
      // Recorrência: cada linha pode ter período próprio. Quando definido, o
      // preço usa os dias da linha; senão herda o período global do plano.
      const lineDays =
        it.startDate && it.endDate
          ? daysInRangeInclusive(it.startDate, it.endDate)
          : days;
      const quote = quoteQuantityItem(it, lineDays, quotePremissas);
      // Fonte única do líquido pós-desconto de linha: applyLineDiscount.
      const netTotal = applyLineDiscount(quote.totalPrice, it.lineDiscountPercent);
      return {
        ...it,
        unitPrice: quote.unitPrice,
        grossTotal: quote.totalPrice,
        totalPrice: netTotal,
        lineDiscountPercent: clampLineDiscountPercent(it.lineDiscountPercent),
      };
    });
    const screensSubtotal = items.reduce((s, i) => s + i.totalPrice, 0);
    const quantitySubtotal = qtyItems.reduce((s, i) => s + i.totalPrice, 0);
    const subtotal = screensSubtotal + quantitySubtotal;
    const discount = subtotal * (couponPercent / 100);
    const total = subtotal - discount;
    return {
      items,
      quantityItems: qtyItems,
      days,
      subtotal,
      discount,
      couponPercent,
      total,
    };
  }, [selected, quantityItems, days, couponPercent, quotePremissas]);
}

export function MediaPlanPanel({
  onConfirm,
  isConfirming,
  canConfirm,
  confirmHint,
  showBonificada = true,
  showPaymentTerms = true,
  indicativePricing = false,
  notesLabel = "Observações",
  notesPlaceholder = "Notas internas (opcional)",
  confirmLabel = "Gerar orçamento",
}: {
  onConfirm: () => void;
  isConfirming: boolean;
  canConfirm: boolean;
  confirmHint?: string;
  /** Bonificação (cortesia) é controle interno — escondido no autosserviço. */
  showBonificada?: boolean;
  /** Condições de pagamento são definidas pelo comercial — escondidas no autosserviço. */
  showPaymentTerms?: boolean;
  /**
   * Autosserviço (anunciante/parceiro): o preço exibido aqui é apenas indicativo.
   * O valor final é calculado no servidor (quotation.createFromBuilder) e
   * confirmado pela equipe comercial. Quando `true`, o painel rotula o total como
   * estimativa para não passar a impressão de cotação fechada.
   */
  indicativePricing?: boolean;
  notesLabel?: string;
  notesPlaceholder?: string;
  confirmLabel?: string;
}) {
  const {
    campaignName,
    setCampaignName,
    startDate,
    endDate,
    setDates,
    couponPercent,
    setCoupon,
    notes,
    setNotes,
    updateItem,
    removeItem,
    updateQuantityItem,
    removeQuantityItem,
    isBonificada,
    setBonificada,
    schedule,
    setSchedule,
  } = useMediaShopStore();

  const plan = useMediaPlan();
  const totalItems = plan.items.length + plan.quantityItems.length;

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Plano de mídia</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="space-y-1.5">
            <Label className="label-mono text-[11px]">Nome da campanha</Label>
            <Input
              value={campaignName}
              onChange={(e) => setCampaignName(e.target.value)}
              placeholder="Ex.: Verão 2026 — Zona Sul"
            />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div className="space-y-1.5">
              <Label className="label-mono text-[11px]">Início</Label>
              <Input type="date" value={startDate} onChange={(e) => setDates(e.target.value, endDate)} />
            </div>
            <div className="space-y-1.5">
              <Label className="label-mono text-[11px]">Fim</Label>
              <Input
                type="date"
                value={endDate}
                min={startDate}
                onChange={(e) => setDates(startDate, e.target.value)}
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Itens selecionados */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">
            Itens selecionados ({totalItems})
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {totalItems === 0 && (
            <p className="text-sm text-muted-foreground py-4 text-center">
              Adicione locais ou produtos do catálogo para montar o plano.
            </p>
          )}
          {plan.items.map((it) => (
            <div key={it.telaId} className="rounded-md border border-border p-3 space-y-2">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="font-medium text-sm truncate">{it.restaurantName}</p>
                  <p className="text-xs text-muted-foreground truncate">{it.circuitName}</p>
                  <p className="text-xs text-muted-foreground">{it.neighborhood || "—"}</p>
                </div>
                <Button
                  type="button"
                  size="icon"
                  variant="ghost"
                  className="h-7 w-7 shrink-0"
                  onClick={() => removeItem(it.telaId)}
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </div>

              <div className="flex items-end justify-between gap-2">
                <div className="text-xs text-muted-foreground space-y-0.5">
                  <p>
                    {it.weeks} semana(s) × {formatCurrency(it.weeklyCost)}/sem
                    {it.cotas > 1 ? ` × ${it.cotas} cotas` : ""}
                  </p>
                  <p>
                    {formatInt(it.insertionsPerWeek)} inserções/sem ·{" "}
                    {formatCurrency(it.costPerInsertion)}/inserção
                  </p>
                </div>
                <div className="text-right">
                  {it.lineDiscountPercent > 0 && (
                    <p className="text-[11px] text-muted-foreground line-through">
                      {formatCurrency(it.grossTotal)}
                    </p>
                  )}
                  <p className="font-semibold text-sm">{formatCurrency(it.totalPrice)}</p>
                </div>
              </div>

              {/* Cotas + desconto da linha. Cotas escala o preço linearmente; o
                  desconto da linha é aplicado ANTES do desconto global (Cupom). */}
              <div className="grid grid-cols-2 gap-2 pt-1">
                <div className="space-y-1">
                  <Label className="label-mono text-[10px] text-muted-foreground">
                    Cotas
                  </Label>
                  <Input
                    type="number"
                    min={1}
                    className="h-8"
                    value={it.cotas}
                    onChange={(e) =>
                      updateItem(it.telaId, {
                        cotas: Math.max(1, Math.floor(Number(e.target.value) || 1)),
                      })
                    }
                    aria-label={`Cotas de ${it.circuitName}`}
                  />
                </div>
                <div className="space-y-1">
                  <Label className="label-mono text-[10px] text-muted-foreground">
                    Desconto da linha (%)
                  </Label>
                  <Input
                    type="number"
                    min={0}
                    max={100}
                    className="h-8"
                    value={it.lineDiscountPercent}
                    onChange={(e) =>
                      updateItem(it.telaId, {
                        lineDiscountPercent: Math.min(
                          100,
                          Math.max(0, Number(e.target.value) || 0),
                        ),
                      })
                    }
                    aria-label={`Desconto da linha de ${it.circuitName}`}
                  />
                </div>
              </div>

              {/* Período de veiculação próprio da linha (opcional). Vazio = usa o
                  período global do plano. */}
              <div className="grid grid-cols-2 gap-2 pt-1">
                <div className="space-y-1">
                  <Label className="label-mono text-[10px] text-muted-foreground">
                    Veiculação — início (opcional)
                  </Label>
                  <Input
                    type="date"
                    className="h-8"
                    value={it.startDate ?? ""}
                    onChange={(e) =>
                      updateItem(it.telaId, { startDate: e.target.value || null })
                    }
                  />
                </div>
                <div className="space-y-1">
                  <Label className="label-mono text-[10px] text-muted-foreground">
                    Veiculação — fim (opcional)
                  </Label>
                  <Input
                    type="date"
                    className="h-8"
                    min={it.startDate ?? undefined}
                    value={it.endDate ?? ""}
                    onChange={(e) =>
                      updateItem(it.telaId, { endDate: e.target.value || null })
                    }
                  />
                </div>
              </div>
            </div>
          ))}

          {plan.quantityItems.map((it) => (
            <div key={it.uid} className="rounded-md border border-border p-3 space-y-2">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="font-medium text-sm truncate flex items-center gap-1.5">
                    <Package className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                    {it.productName}
                  </p>
                  <p className="text-xs text-muted-foreground capitalize">
                    {(it.tipo || "produto").replace(/_/g, " ")}
                  </p>
                </div>
                <Button
                  type="button"
                  size="icon"
                  variant="ghost"
                  className="h-7 w-7 shrink-0"
                  onClick={() => removeQuantityItem(it.uid)}
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </div>

              <div className="flex items-end justify-between gap-2">
                <div className="space-y-1">
                  <Label className="label-mono text-[10px] text-muted-foreground">
                    Quantidade ({it.unitLabel})
                  </Label>
                  <Input
                    type="number"
                    min={1}
                    className="h-8 w-28"
                    value={it.quantity}
                    onChange={(e) =>
                      updateQuantityItem(it.uid, {
                        quantity: Math.max(1, Number(e.target.value) || 1),
                      })
                    }
                  />
                </div>
                <div className="text-right">
                  <p className="text-[11px] text-muted-foreground">
                    {formatCurrency(it.unitPrice)}/{it.unitLabel}
                  </p>
                  {it.lineDiscountPercent > 0 && (
                    <p className="text-[11px] text-muted-foreground line-through">
                      {formatCurrency(it.grossTotal)}
                    </p>
                  )}
                  <p className="font-semibold text-sm">{formatCurrency(it.totalPrice)}</p>
                </div>
              </div>

              {/* Desconto da linha, aplicado ANTES do desconto global (Cupom). */}
              <div className="space-y-1 pt-1">
                <Label className="label-mono text-[10px] text-muted-foreground">
                  Desconto da linha (%)
                </Label>
                <Input
                  type="number"
                  min={0}
                  max={100}
                  className="h-8"
                  value={it.lineDiscountPercent}
                  onChange={(e) =>
                    updateQuantityItem(it.uid, {
                      lineDiscountPercent: Math.min(
                        100,
                        Math.max(0, Number(e.target.value) || 0),
                      ),
                    })
                  }
                  aria-label={`Desconto da linha de ${it.productName}`}
                />
              </div>

              {/* Recorrência: agendamento próprio da linha (opcional). Vazio =
                  usa o período global do plano. */}
              <div className="grid grid-cols-2 gap-2 pt-1">
                <div className="space-y-1">
                  <Label className="label-mono text-[10px] text-muted-foreground">
                    Início (opcional)
                  </Label>
                  <Input
                    type="date"
                    className="h-8"
                    value={it.startDate ?? ""}
                    onChange={(e) =>
                      updateQuantityItem(it.uid, { startDate: e.target.value || null })
                    }
                  />
                </div>
                <div className="space-y-1">
                  <Label className="label-mono text-[10px] text-muted-foreground">
                    Fim (opcional)
                  </Label>
                  <Input
                    type="date"
                    className="h-8"
                    min={it.startDate ?? undefined}
                    value={it.endDate ?? ""}
                    onChange={(e) =>
                      updateQuantityItem(it.uid, { endDate: e.target.value || null })
                    }
                  />
                </div>
              </div>
            </div>
          ))}
        </CardContent>
      </Card>

      {/* Valor */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">{indicativePricing ? "Valor estimado" : "Valor"}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          <Row label="Subtotal" value={formatCurrency(plan.subtotal)} />
          <div className="flex items-center justify-between gap-2">
            <Label className="text-sm text-muted-foreground">Cupom (%)</Label>
            <Input
              type="number"
              min={0}
              max={100}
              className="h-8 w-20 text-right"
              value={couponPercent}
              onChange={(e) => setCoupon(Number(e.target.value) || 0)}
            />
          </div>
          {plan.discount > 0 && (
            <Row label="Desconto" value={`- ${formatCurrency(plan.discount)}`} />
          )}
          <Separator />
          <div className="flex items-center justify-between">
            <span className="font-semibold">{indicativePricing ? "Total estimado" : "Total"}</span>
            <span className="font-display text-xl font-semibold">{formatCurrency(plan.total)}</span>
          </div>
          {indicativePricing && (
            <p className="text-xs text-muted-foreground leading-snug">
              Valor indicativo, sujeito a confirmação. O preço final é calculado e
              validado pela nossa equipe comercial antes do fechamento.
            </p>
          )}

          {/* Bonificação: exclui dos KPIs financeiros e dispensa cronograma. */}
          {showBonificada && (
            <div className="flex items-center justify-between gap-2 pt-1">
              <Label className="text-sm flex items-center gap-1.5">
                <Gift className="h-3.5 w-3.5 text-muted-foreground" />
                Bonificação (cortesia)
              </Label>
              <Switch checked={isBonificada} onCheckedChange={setBonificada} />
            </div>
          )}

          {/* Condições de pagamento (parcelas) — escondidas quando bonificada. */}
          {showPaymentTerms && !isBonificada && (
            <PaymentTermsEditor
              total={plan.total}
              startDate={startDate}
              schedule={schedule}
              onChange={setSchedule}
            />
          )}

          <div className="space-y-1.5 pt-1">
            <Label className="label-mono text-[11px]">{notesLabel}</Label>
            <Textarea
              rows={2}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder={notesPlaceholder}
            />
          </div>

          <Button
            type="button"
            className="w-full gap-2 mt-2"
            disabled={!canConfirm || isConfirming}
            onClick={onConfirm}
          >
            {isConfirming && <Loader2 className="h-4 w-4 animate-spin" />}
            {confirmLabel}
          </Button>
          {!canConfirm && confirmHint && (
            <p className="text-xs text-muted-foreground text-center">{confirmHint}</p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between text-sm">
      <span className="text-muted-foreground">{label}</span>
      <span>{value}</span>
    </div>
  );
}

/**
 * Gera N parcelas default a partir do total e do início do plano. Usa as fontes
 * únicas de shared/billingSchedule (`splitAmount` p/ centavos, `addDaysIso` p/
 * vencimentos), espelhando o builder clássico: 1ª em +15d, demais +30d cada.
 */
function buildDefaultParcelas(total: number, parts: number, startISO: string): DraftParcela[] {
  if (!isFinite(total) || total <= 0 || parts <= 0) return [];
  const anchor = startISO && startISO.length >= 10 ? startISO : new Date().toISOString().slice(0, 10);
  const amounts = splitAmount(total, parts);
  return amounts.map((amount, i) => ({
    sequence: i + 1,
    amount,
    dueDate: addDaysIso(anchor, 15 + i * 30),
    notes: parts === 1 ? "Parcela única" : `Parcela ${i + 1}/${parts}`,
  }));
}

function PaymentTermsEditor({
  total,
  startDate,
  schedule,
  onChange,
}: {
  total: number;
  startDate: string;
  schedule: DraftParcela[];
  onChange: (next: DraftParcela[]) => void;
}) {
  const parts = schedule.length || 1;
  const balanced = scheduleMatchesTotal(schedule, total);

  // Semeia 1 parcela quando há total e nada definido ainda.
  useEffect(() => {
    if (schedule.length === 0 && total > 0) {
      onChange(buildDefaultParcelas(total, 1, startDate));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [schedule.length, total]);

  function setParts(n: number) {
    const clamped = Math.min(36, Math.max(1, n));
    onChange(buildDefaultParcelas(total, clamped, startDate));
  }

  function updateParcela(idx: number, patch: Partial<DraftParcela>) {
    onChange(schedule.map((it, i) => (i === idx ? { ...it, ...patch } : it)));
  }

  return (
    <div className="rounded-md border border-border p-3 space-y-2">
      <div className="flex items-center justify-between gap-2">
        <Label className="label-mono text-[11px]">Condições de pagamento</Label>
        <div className="flex items-center gap-1.5">
          <span className="text-[10px] text-muted-foreground">Parcelas</span>
          <Input
            type="number"
            min={1}
            max={36}
            className="h-7 w-16 text-right"
            value={parts}
            onChange={(e) => setParts(Number(e.target.value) || 1)}
          />
        </div>
      </div>

      <div className="space-y-1.5">
        {schedule.map((it, i) => (
          <div key={i} className="grid grid-cols-[1fr_1fr] gap-1.5">
            <Input
              type="date"
              className="h-8"
              value={it.dueDate}
              onChange={(e) => updateParcela(i, { dueDate: e.target.value })}
              aria-label={`Vencimento parcela ${i + 1}`}
            />
            <Input
              type="number"
              min={0}
              step="0.01"
              className="h-8 text-right"
              value={it.amount}
              onChange={(e) => updateParcela(i, { amount: e.target.value })}
              aria-label={`Valor parcela ${i + 1}`}
            />
          </div>
        ))}
      </div>

      <div className={`flex items-center justify-between text-[11px] ${balanced ? "text-muted-foreground" : "text-destructive"}`}>
        <span>Σ parcelas</span>
        <span>{balanced ? "fecha com o total" : "não fecha com o total"}</span>
      </div>
    </div>
  );
}
