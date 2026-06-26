import { useMemo, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { Trash2, Eye, Users, Repeat, Tv, Loader2, Package, Gift } from "lucide-react";
import { daysInRangeInclusive } from "@shared/period";
import { splitAmount, addDaysIso, scheduleMatchesTotal } from "@shared/billingSchedule";
import { computeScreenDailyPricing } from "@shared/cpm-pricing";
import { computeScreenMetrics } from "@shared/screen-metrics";
import { useSystemPremissas } from "@/hooks/useSystemPremissas";
import type { QuotePremissas } from "@/components/campaign-wizard/pricing";
import { formatCurrency } from "@/lib/format";
import {
  useMediaShopStore,
  cpmConfigForPricing,
  quoteQuantityItem,
  type MediaSelectedItem,
  type MediaQuantityItem,
  type DraftParcela,
} from "./mediaShopStore";

function formatInt(n: number): string {
  return Math.round(n).toLocaleString("pt-BR");
}

export interface MediaPlanComputedItem extends MediaSelectedItem {
  totalPrice: number;
  billedDays: number;
  exibicoes: number;
  alcance: number;
}

export interface MediaPlanQuantityItem extends MediaQuantityItem {
  totalPrice: number;
  unitPrice: number;
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
      // Período de veiculação por linha: quando definido, preço/métricas usam os
      // dias da linha; senão herda o período global do plano (fonte única:
      // daysInRangeInclusive de @shared/period).
      const lineDays =
        it.startDate && it.endDate
          ? daysInRangeInclusive(it.startDate, it.endDate)
          : days;
      const pricing = computeScreenDailyPricing(cpmConfigForPricing(it.cpm), lineDays);
      const metrics = computeScreenMetrics({
        insertionsPerDay: it.insertionsPerDay,
        impactsPerInsertion: it.cpm.impactsPerInsertion,
        monthlyCustomers: it.monthlyCustomers,
        days: lineDays,
        screens: it.screens,
      });
      return {
        ...it,
        totalPrice: pricing?.totalPrice ?? 0,
        billedDays: pricing?.billedDays ?? lineDays,
        exibicoes: metrics.exibicoes,
        alcance: metrics.alcance,
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
      return { ...it, totalPrice: quote.totalPrice, unitPrice: quote.unitPrice };
    });
    const screensSubtotal = items.reduce((s, i) => s + i.totalPrice, 0);
    const quantitySubtotal = qtyItems.reduce((s, i) => s + i.totalPrice, 0);
    const subtotal = screensSubtotal + quantitySubtotal;
    const discount = subtotal * (couponPercent / 100);
    const total = subtotal - discount;
    const exibicoes = items.reduce((s, i) => s + i.exibicoes, 0);
    const alcance = items.reduce((s, i) => s + i.alcance, 0);
    const frequencia = alcance > 0 ? exibicoes / alcance : 0;
    return {
      items,
      quantityItems: qtyItems,
      days,
      subtotal,
      discount,
      total,
      exibicoes,
      alcance,
      frequencia,
    };
  }, [selected, quantityItems, days, couponPercent, quotePremissas]);
}

export function MediaPlanPanel({
  onConfirm,
  isConfirming,
  canConfirm,
  confirmHint,
}: {
  onConfirm: () => void;
  isConfirming: boolean;
  canConfirm: boolean;
  confirmHint?: string;
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
            <div key={it.restaurantId} className="rounded-md border border-border p-3 space-y-2">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="font-medium text-sm truncate">{it.restaurantName}</p>
                  <p className="text-xs text-muted-foreground">{it.neighborhood || "—"}</p>
                </div>
                <Button
                  type="button"
                  size="icon"
                  variant="ghost"
                  className="h-7 w-7 shrink-0"
                  onClick={() => removeItem(it.restaurantId)}
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </div>

              <div className="flex items-center gap-3 text-xs text-muted-foreground">
                <span className="flex items-center gap-1">
                  <Tv className="h-3 w-3" /> {it.screens} tela(s)
                </span>
                <span className="flex items-center gap-1">
                  <Eye className="h-3 w-3" /> {formatInt(it.exibicoes)}
                </span>
                <span className="flex items-center gap-1">
                  <Users className="h-3 w-3" /> {formatInt(it.alcance)}
                </span>
              </div>

              <div className="flex items-end justify-between gap-2">
                <div className="space-y-1">
                  <Label className="label-mono text-[10px] text-muted-foreground">
                    Inserções/dia por tela
                  </Label>
                  <div className="flex items-center gap-1.5">
                    <Input
                      type="number"
                      min={0}
                      className="h-8 w-24"
                      value={Math.round(it.insertionsPerDay)}
                      onChange={(e) =>
                        updateItem(it.restaurantId, {
                          insertionsPerDay: Math.max(0, Number(e.target.value) || 0),
                        })
                      }
                    />
                    {Math.round(it.insertionsPerDay) !== Math.round(it.insertionsPerDayDefault) && (
                      <button
                        type="button"
                        className="text-[10px] text-primary underline"
                        onClick={() =>
                          updateItem(it.restaurantId, {
                            insertionsPerDay: it.insertionsPerDayDefault,
                          })
                        }
                      >
                        cadastro: {Math.round(it.insertionsPerDayDefault)}
                      </button>
                    )}
                  </div>
                </div>
                <p className="font-semibold text-sm">{formatCurrency(it.totalPrice)}</p>
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
                      updateItem(it.restaurantId, { startDate: e.target.value || null })
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
                      updateItem(it.restaurantId, { endDate: e.target.value || null })
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
                <p className="font-semibold text-sm">{formatCurrency(it.totalPrice)}</p>
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

      {/* Performance projetada */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Performance projetada</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-3 gap-2 text-center">
          <Stat icon={<Eye className="h-3.5 w-3.5" />} label="Exibições" value={formatInt(plan.exibicoes)} />
          <Stat icon={<Users className="h-3.5 w-3.5" />} label="Alcance" value={formatInt(plan.alcance)} />
          <Stat
            icon={<Repeat className="h-3.5 w-3.5" />}
            label="Frequência"
            value={plan.frequencia > 0 ? plan.frequencia.toFixed(1) : "—"}
          />
        </CardContent>
      </Card>

      {/* Valor */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Valor</CardTitle>
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
            <span className="font-semibold">Total</span>
            <span className="font-display text-xl font-semibold">{formatCurrency(plan.total)}</span>
          </div>

          {/* Bonificação: exclui dos KPIs financeiros e dispensa cronograma. */}
          <div className="flex items-center justify-between gap-2 pt-1">
            <Label className="text-sm flex items-center gap-1.5">
              <Gift className="h-3.5 w-3.5 text-muted-foreground" />
              Bonificação (cortesia)
            </Label>
            <Switch checked={isBonificada} onCheckedChange={setBonificada} />
          </div>

          {/* Condições de pagamento (parcelas) — escondidas quando bonificada. */}
          {!isBonificada && (
            <PaymentTermsEditor
              total={plan.total}
              startDate={startDate}
              schedule={schedule}
              onChange={setSchedule}
            />
          )}

          <div className="space-y-1.5 pt-1">
            <Label className="label-mono text-[11px]">Observações</Label>
            <Textarea
              rows={2}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Notas internas (opcional)"
            />
          </div>

          <Button
            type="button"
            className="w-full gap-2 mt-2"
            disabled={!canConfirm || isConfirming}
            onClick={onConfirm}
          >
            {isConfirming && <Loader2 className="h-4 w-4 animate-spin" />}
            Gerar orçamento
          </Button>
          {!canConfirm && confirmHint && (
            <p className="text-xs text-muted-foreground text-center">{confirmHint}</p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function Stat({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="rounded-md bg-muted/50 py-2">
      <div className="flex items-center justify-center gap-1 text-muted-foreground">
        {icon}
        <span className="label-mono text-[9px]">{label}</span>
      </div>
      <p className="text-base font-semibold mt-0.5">{value}</p>
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
