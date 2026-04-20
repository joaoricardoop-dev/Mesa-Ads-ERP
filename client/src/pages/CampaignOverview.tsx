import { useMemo } from "react";
import { useRoute, useLocation } from "wouter";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { formatCurrency } from "@/lib/format";
import {
  ArrowLeft,
  Calendar,
  ChevronRight,
  Cookie,
  Monitor,
  Gift,
  Layers,
  CircleDollarSign,
  Hash,
  FileText,
  ChevronDown,
  ExternalLink,
} from "lucide-react";
import { useState } from "react";

function QuotationSection({ quotationId }: { quotationId: number }) {
  const [, setLocation] = useLocation();
  const [open, setOpen] = useState(true);
  const { data: quotation, isLoading: loadingQ } = trpc.quotation.get.useQuery({ id: quotationId });
  const { data: items = [], isLoading: loadingI } = trpc.quotation.listItems.useQuery({ quotationId });

  const isLoading = loadingQ || loadingI;
  const itemsTotal = items.reduce((s, it) => s + parseFloat(it.totalPrice ?? "0"), 0);
  const headerTotal = quotation?.totalValue ? parseFloat(quotation.totalValue) : itemsTotal;

  const fmtDate = (s?: string | null) => {
    if (!s) return "—";
    const d = new Date(s.length === 10 ? `${s}T00:00:00` : s);
    return isNaN(d.getTime()) ? s : d.toLocaleDateString("pt-BR");
  };

  return (
    <section className="bg-card border border-border/30 rounded-xl overflow-hidden">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center justify-between gap-3 px-4 py-3 hover:bg-muted/30 transition-colors"
      >
        <div className="flex items-center gap-2">
          <FileText className="w-4 h-4 text-primary" />
          <h2 className="text-sm font-semibold uppercase tracking-wider">Orçamento Original</h2>
          {quotation?.quotationNumber && (
            <Badge variant="outline" className="text-[10px] uppercase tracking-wide">
              {quotation.quotationNumber}
            </Badge>
          )}
        </div>
        <div className="flex items-center gap-3">
          {!isLoading && (
            <span className="text-sm font-semibold tabular-nums">{formatCurrency(headerTotal)}</span>
          )}
          <ChevronDown className={`w-4 h-4 text-muted-foreground transition-transform ${open ? "rotate-180" : ""}`} />
        </div>
      </button>

      {open && (
        <div className="border-t border-border/30 p-4 space-y-4">
          {isLoading ? (
            <div className="text-sm text-muted-foreground py-4 text-center">Carregando orçamento…</div>
          ) : !quotation ? (
            <div className="text-sm text-muted-foreground py-4 text-center">Orçamento não encontrado.</div>
          ) : (
            <>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
                <div>
                  <div className="text-muted-foreground uppercase tracking-wide text-[10px] mb-0.5">Cliente</div>
                  <div className="font-medium">{quotation.clientName || quotation.leadName || "—"}</div>
                </div>
                <div>
                  <div className="text-muted-foreground uppercase tracking-wide text-[10px] mb-0.5">Status</div>
                  <div className="font-medium">{quotation.status ?? "—"}</div>
                </div>
                <div>
                  <div className="text-muted-foreground uppercase tracking-wide text-[10px] mb-0.5">Validade</div>
                  <div className="font-medium">{fmtDate(quotation.validUntil)}</div>
                </div>
                <div>
                  <div className="text-muted-foreground uppercase tracking-wide text-[10px] mb-0.5">Assinado em</div>
                  <div className="font-medium">{fmtDate(quotation.signedAt as unknown as string)}</div>
                </div>
              </div>

              <div className="rounded-lg border border-border/30 overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-muted/30">
                    <tr className="text-[10px] uppercase tracking-wide text-muted-foreground">
                      <th className="text-left px-3 py-2 font-medium">Produto</th>
                      <th className="text-right px-3 py-2 font-medium">Quantidade</th>
                      <th className="text-right px-3 py-2 font-medium">Preço Unit.</th>
                      <th className="text-right px-3 py-2 font-medium">Total</th>
                    </tr>
                  </thead>
                  <tbody>
                    {items.length === 0 ? (
                      <tr>
                        <td colSpan={4} className="px-3 py-6 text-center text-muted-foreground text-xs">
                          Sem itens detalhados — orçamento legado em formato consolidado.
                        </td>
                      </tr>
                    ) : (
                      items.map((it) => {
                        const unitLabel = it.quantity === 1
                          ? (it.productUnitLabel ?? "un")
                          : (it.productUnitLabelPlural ?? it.productUnitLabel ?? "un");
                        return (
                          <tr key={it.id} className="border-t border-border/30">
                            <td className="px-3 py-2">
                              <div className="font-medium">{it.productName}</div>
                              {it.notes && <div className="text-[11px] text-muted-foreground mt-0.5">{it.notes}</div>}
                            </td>
                            <td className="px-3 py-2 text-right tabular-nums">
                              {it.quantity.toLocaleString("pt-BR")} {unitLabel}
                            </td>
                            <td className="px-3 py-2 text-right tabular-nums text-muted-foreground">
                              {it.unitPrice ? formatCurrency(parseFloat(it.unitPrice)) : "—"}
                            </td>
                            <td className="px-3 py-2 text-right tabular-nums font-semibold">
                              {it.totalPrice ? formatCurrency(parseFloat(it.totalPrice)) : "—"}
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                  {items.length > 0 && (
                    <tfoot>
                      <tr className="border-t border-border/30 bg-muted/20">
                        <td className="px-3 py-2 text-xs uppercase tracking-wide text-muted-foreground" colSpan={3}>
                          Total do contrato
                        </td>
                        <td className="px-3 py-2 text-right tabular-nums font-bold text-primary">
                          {formatCurrency(itemsTotal)}
                        </td>
                      </tr>
                    </tfoot>
                  )}
                </table>
              </div>

              {quotation.notes && (
                <div className="text-xs">
                  <div className="text-muted-foreground uppercase tracking-wide text-[10px] mb-1">Observações</div>
                  <p className="whitespace-pre-wrap">{quotation.notes}</p>
                </div>
              )}

              <div className="flex justify-end pt-1">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setLocation(`/comercial/cotacoes/${quotationId}`)}
                  className="gap-1.5"
                >
                  <ExternalLink className="w-3.5 h-3.5" /> Abrir orçamento completo
                </Button>
              </div>
            </>
          )}
        </div>
      )}
    </section>
  );
}

type PhaseRow = {
  id: number;
  campaignId: number;
  sequence: number;
  label: string;
  periodStart: string;
  periodEnd: string;
  status: "planejada" | "ativa" | "concluida" | "cancelada";
  notes: string | null;
  items: Array<{
    id: number;
    productName: string;
    productTipo: string | null;
    quantity: number;
    resolvedTotalPrice: number;
  }>;
  expectedRevenue: number;
  expectedCosts: number;
};

const PHASE_STATUS_META: Record<string, { label: string; cls: string }> = {
  planejada: { label: "Planejada", cls: "bg-slate-500/15 text-slate-300 border-slate-500/30" },
  ativa: { label: "Ativa", cls: "bg-emerald-500/15 text-emerald-400 border-emerald-500/30" },
  concluida: { label: "Concluída", cls: "bg-blue-500/15 text-blue-400 border-blue-500/30" },
  cancelada: { label: "Cancelada", cls: "bg-red-500/15 text-red-400 border-red-500/30" },
};

const DIGITAL_TIPOS = new Set(["telas", "janelas_digitais"]);

function fmtPeriod(start: string, end: string): string {
  const fmt = (s: string) => {
    const d = new Date(s.length === 10 ? `${s}T00:00:00` : s);
    if (isNaN(d.getTime())) return s;
    return d.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" });
  };
  return `${fmt(start)} → ${fmt(end)}`;
}

function weeksBetween(start: string, end: string): number {
  const a = new Date(start.length === 10 ? `${start}T00:00:00` : start);
  const b = new Date(end.length === 10 ? `${end}T00:00:00` : end);
  if (isNaN(a.getTime()) || isNaN(b.getTime())) return 0;
  const days = Math.round((b.getTime() - a.getTime()) / 86400000) + 1;
  return Math.max(1, Math.round(days / 7));
}

function PhaseCard({
  phase,
  filterTipo,
  onOpen,
}: {
  phase: PhaseRow;
  filterTipo: "bolacha" | "tela";
  onOpen: () => void;
}) {
  const items = phase.items.filter((it) => {
    const isDigital = it.productTipo != null && DIGITAL_TIPOS.has(it.productTipo);
    return filterTipo === "tela" ? isDigital : !isDigital;
  });
  const total = items.reduce((s, it) => s + it.resolvedTotalPrice, 0);
  const totalQty = items.reduce((s, it) => s + it.quantity, 0);
  const meta = PHASE_STATUS_META[phase.status] ?? PHASE_STATUS_META.planejada;
  const weeks = weeksBetween(phase.periodStart, phase.periodEnd);

  return (
    <button
      onClick={onOpen}
      className="group text-left bg-card border border-border/30 rounded-2xl p-5 hover:border-primary/50 hover:bg-card/70 transition-all flex flex-col gap-4"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <div className="w-10 h-10 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center">
            {filterTipo === "tela"
              ? <Monitor className="w-5 h-5 text-primary" />
              : <Cookie className="w-5 h-5 text-primary" />}
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-sm text-muted-foreground">Batch</span>
              <span className="text-lg font-semibold tabular-nums">{phase.sequence}</span>
            </div>
            <div className="text-xs text-muted-foreground">{phase.label}</div>
          </div>
        </div>
        <Badge variant="outline" className={`text-[10px] uppercase tracking-wide ${meta.cls}`}>
          {meta.label}
        </Badge>
      </div>

      <div className="grid grid-cols-2 gap-2 text-xs">
        <div className="flex items-center gap-1.5 text-muted-foreground">
          <Calendar className="w-3.5 h-3.5" />
          <span>{fmtPeriod(phase.periodStart, phase.periodEnd)}</span>
        </div>
        <div className="flex items-center gap-1.5 text-muted-foreground justify-end">
          <span className="tabular-nums">{weeks} {weeks === 1 ? "semana" : "semanas"}</span>
        </div>
      </div>

      <div className="border-t border-border/20 pt-3 flex items-end justify-between gap-2">
        <div>
          <div className="text-[10px] uppercase text-muted-foreground tracking-wider">Receita prevista</div>
          <div className="text-lg font-semibold tabular-nums text-foreground">
            {formatCurrency(total)}
          </div>
        </div>
        <div className="text-right">
          <div className="text-[10px] uppercase text-muted-foreground tracking-wider flex items-center justify-end gap-1">
            <Hash className="w-3 h-3" /> {filterTipo === "tela" ? "telas" : "bolachas"}
          </div>
          <div className="text-sm font-medium tabular-nums text-muted-foreground">
            {totalQty.toLocaleString("pt-BR")}
          </div>
        </div>
      </div>

      <div className="flex items-center justify-end text-xs text-primary opacity-0 group-hover:opacity-100 transition-opacity">
        Abrir batch <ChevronRight className="w-3.5 h-3.5 ml-0.5" />
      </div>
    </button>
  );
}

export default function CampaignOverview() {
  const [, params] = useRoute<{ id: string }>("/campanhas/:id");
  const [, setLocation] = useLocation();
  const campaignId = Number(params?.id ?? 0);

  const { data: campaign, isLoading: loadingCamp } = trpc.campaign.get.useQuery(
    { id: campaignId },
    { enabled: campaignId > 0 },
  );
  const { data: phases = [], isLoading: loadingPhases } = trpc.campaignPhase.listByCampaign.useQuery(
    { campaignId },
    { enabled: campaignId > 0 },
  );

  const { hasBolacha, hasTela, totals } = useMemo(() => {
    let bolacha = false;
    let tela = false;
    let totalRevenue = 0;
    let totalQtyBolacha = 0;
    let totalQtyTela = 0;
    for (const p of phases as PhaseRow[]) {
      for (const it of p.items) {
        const isDigital = it.productTipo != null && DIGITAL_TIPOS.has(it.productTipo);
        if (isDigital) {
          tela = true;
          totalQtyTela += it.quantity;
        } else {
          bolacha = true;
          totalQtyBolacha += it.quantity;
        }
        totalRevenue += it.resolvedTotalPrice;
      }
    }
    return {
      hasBolacha: bolacha,
      hasTela: tela,
      totals: { totalRevenue, totalQtyBolacha, totalQtyTela },
    };
  }, [phases]);

  if (campaignId <= 0) return null;

  const isLoading = loadingCamp || loadingPhases;

  return (
    <div className="min-h-screen bg-background text-foreground">
      <div className="max-w-7xl mx-auto p-4 sm:p-6 space-y-6">
        <div className="flex items-center gap-3">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setLocation("/campanhas")}
            data-testid="button-back-campaigns"
          >
            <ArrowLeft className="w-4 h-4" />
          </Button>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="text-xl sm:text-2xl font-semibold truncate">
                {campaign?.name ?? "Campanha"}
              </h1>
              {campaign?.campaignNumber && (
                <Badge variant="outline" className="text-[10px] uppercase tracking-wide">
                  {campaign.campaignNumber}
                </Badge>
              )}
              {campaign?.isBonificada && (
                <Badge variant="outline" className="text-[10px] uppercase tracking-wide bg-amber-500/15 text-amber-400 border-amber-500/30">
                  <Gift className="w-3 h-3 mr-1" /> Bonificada
                </Badge>
              )}
            </div>
            <p className="text-sm text-muted-foreground mt-1">
              Selecione um batch para abrir o painel, timeline e operação.
            </p>
          </div>
        </div>

        {/* Resumo geral */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div className="bg-card border border-border/30 rounded-xl p-4">
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <Layers className="w-3.5 h-3.5" /> Batches
            </div>
            <div className="text-2xl font-semibold tabular-nums mt-1">
              {phases.length}
            </div>
          </div>
          <div className="bg-card border border-border/30 rounded-xl p-4">
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <CircleDollarSign className="w-3.5 h-3.5" /> Receita prevista total
            </div>
            <div className="text-2xl font-semibold tabular-nums mt-1">
              {formatCurrency(totals.totalRevenue)}
            </div>
          </div>
          <div className="bg-card border border-border/30 rounded-xl p-4">
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <Hash className="w-3.5 h-3.5" /> Volume
            </div>
            <div className="text-sm tabular-nums mt-1 leading-snug">
              {hasBolacha && (
                <div>{totals.totalQtyBolacha.toLocaleString("pt-BR")} bolachas</div>
              )}
              {hasTela && (
                <div>{totals.totalQtyTela.toLocaleString("pt-BR")} telas</div>
              )}
              {!hasBolacha && !hasTela && <div className="text-muted-foreground">—</div>}
            </div>
          </div>
        </div>

        {!loadingCamp && campaign?.quotationId && (
          <QuotationSection quotationId={campaign.quotationId} />
        )}

        {isLoading && (
          <div className="text-center py-12 text-sm text-muted-foreground">Carregando batches…</div>
        )}

        {!isLoading && phases.length === 0 && (
          <div className="bg-card border border-dashed border-border/40 rounded-xl p-10 text-center">
            <Layers className="w-10 h-10 mx-auto text-muted-foreground mb-2" />
            <div className="text-sm text-muted-foreground">
              Esta campanha ainda não tem batches cadastrados.
            </div>
          </div>
        )}

        {!isLoading && hasBolacha && (
          <section className="space-y-3">
            <header className="flex items-center gap-2">
              <Cookie className="w-4 h-4 text-primary" />
              <h2 className="text-sm font-semibold uppercase tracking-wider">Bolacha</h2>
              <span className="text-xs text-muted-foreground">
                ({(phases as PhaseRow[]).filter((p) => p.items.some((it) => !DIGITAL_TIPOS.has(it.productTipo ?? ""))).length} batches)
              </span>
            </header>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {(phases as PhaseRow[])
                .filter((p) => p.items.some((it) => !DIGITAL_TIPOS.has(it.productTipo ?? "")))
                .map((p) => (
                  <PhaseCard
                    key={`b-${p.id}`}
                    phase={p}
                    filterTipo="bolacha"
                    onOpen={() => setLocation(`/campanhas/${campaignId}/batch/${p.id}`)}
                  />
                ))}
            </div>
          </section>
        )}

        {!isLoading && hasTela && (
          <section className="space-y-3">
            <header className="flex items-center gap-2">
              <Monitor className="w-4 h-4 text-primary" />
              <h2 className="text-sm font-semibold uppercase tracking-wider">Telas / Janelas Digitais</h2>
              <span className="text-xs text-muted-foreground">
                ({(phases as PhaseRow[]).filter((p) => p.items.some((it) => DIGITAL_TIPOS.has(it.productTipo ?? ""))).length} batches)
              </span>
            </header>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {(phases as PhaseRow[])
                .filter((p) => p.items.some((it) => DIGITAL_TIPOS.has(it.productTipo ?? "")))
                .map((p) => (
                  <PhaseCard
                    key={`t-${p.id}`}
                    phase={p}
                    filterTipo="tela"
                    onOpen={() => setLocation(`/campanhas/${campaignId}/batch/${p.id}`)}
                  />
                ))}
            </div>
          </section>
        )}

        {!isLoading && phases.length > 0 && !hasBolacha && !hasTela && (
          <section className="space-y-3">
            <header className="flex items-center gap-2">
              <Layers className="w-4 h-4 text-primary" />
              <h2 className="text-sm font-semibold uppercase tracking-wider">Batches</h2>
            </header>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {(phases as PhaseRow[]).map((p) => (
                <PhaseCard
                  key={p.id}
                  phase={p}
                  filterTipo="bolacha"
                  onOpen={() => setLocation(`/campanhas/${campaignId}/batch/${p.id}`)}
                />
              ))}
            </div>
          </section>
        )}
      </div>
    </div>
  );
}
