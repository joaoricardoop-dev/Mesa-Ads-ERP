import { Badge } from "@/components/ui/badge";
import { formatCurrency } from "@/lib/format";
import { trpc } from "@/lib/trpc";
import {
  TrendingUp, TrendingDown, Target, DollarSign, Receipt,
  CircleDollarSign, Package, CalendarRange, CheckCircle2, AlertCircle,
} from "lucide-react";

function fmtPct(v: number): string {
  return `${v.toFixed(1).replace(".", ",")}%`;
}

function fmtDate(d: string | null | undefined): string {
  if (!d) return "—";
  const [y, m, day] = d.split("-");
  return `${day}/${m}/${y}`;
}

const STATUS_LABELS: Record<string, string> = {
  planejada: "Planejada",
  ativa: "Ativa",
  concluida: "Concluída",
  cancelada: "Cancelada",
};
const STATUS_COLORS: Record<string, string> = {
  planejada: "bg-zinc-500/10 text-zinc-400 border-zinc-500/30",
  ativa: "bg-emerald-500/10 text-emerald-400 border-emerald-500/30",
  concluida: "bg-blue-500/10 text-blue-400 border-blue-500/30",
  cancelada: "bg-red-500/10 text-red-400 border-red-500/30",
};

export default function CampaignConsolidation({ campaignId }: { campaignId: number }) {
  const { data, isLoading } = trpc.campaignPhase.consolidation.useQuery({ campaignId });

  if (isLoading) {
    return <div className="p-4 text-sm text-muted-foreground">Carregando consolidação…</div>;
  }
  if (!data) {
    return <div className="p-4 text-sm text-muted-foreground">Sem dados.</div>;
  }

  const s = data.summary;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div>
          <h3 className="text-lg font-bold flex items-center gap-2">
            <CircleDollarSign className="w-5 h-5 text-primary" />
            Consolidação Financeira
          </h3>
          <p className="text-xs text-muted-foreground">
            {fmtDate(data.campaign.startDate)} → {fmtDate(data.campaign.endDate)}
            {data.campaign.isBonificada && (
              <span className="ml-2 px-1.5 py-0.5 rounded text-[10px] bg-amber-500/10 text-amber-400 border border-amber-500/30">
                Bonificada
              </span>
            )}
          </p>
        </div>
      </div>

      {/* Cards de topo: previsto vs realizado */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
        <div className="rounded-xl border border-border/30 bg-gradient-to-br from-emerald-500/10 via-card to-card p-4">
          <div className="flex items-center gap-2 mb-1">
            <TrendingUp className="w-4 h-4 text-emerald-400" />
            <span className="text-[10px] uppercase tracking-wider text-muted-foreground">Receita prevista</span>
          </div>
          <p className="text-2xl font-bold font-mono">{formatCurrency(s.expectedRevenue)}</p>
          <p className="text-[10px] text-muted-foreground mt-1">
            Faturado: {formatCurrency(s.invoiced)} ({fmtPct(s.invoicedVsExpectedPct)})
          </p>
        </div>

        <div className="rounded-xl border border-border/30 bg-gradient-to-br from-cyan-500/10 via-card to-card p-4">
          <div className="flex items-center gap-2 mb-1">
            <DollarSign className="w-4 h-4 text-cyan-400" />
            <span className="text-[10px] uppercase tracking-wider text-muted-foreground">Recebido</span>
          </div>
          <p className="text-2xl font-bold font-mono text-cyan-400">{formatCurrency(s.received)}</p>
          <p className="text-[10px] text-muted-foreground mt-1">
            {fmtPct(s.receivedVsInvoicedPct)} do faturado
          </p>
        </div>

        <div className="rounded-xl border border-border/30 bg-gradient-to-br from-red-500/10 via-card to-card p-4">
          <div className="flex items-center gap-2 mb-1">
            <TrendingDown className="w-4 h-4 text-red-400" />
            <span className="text-[10px] uppercase tracking-wider text-muted-foreground">Custo previsto</span>
          </div>
          <p className="text-2xl font-bold font-mono">{formatCurrency(s.expectedCosts)}</p>
          <p className="text-[10px] text-muted-foreground mt-1">
            A pagar: {formatCurrency(s.payableDue)} · Pago: {formatCurrency(s.paid)}
          </p>
        </div>

        <div className={`rounded-xl border border-border/30 bg-gradient-to-br ${s.realMargin >= 0 ? "from-emerald-500/10" : "from-red-500/10"} via-card to-card p-4`}>
          <div className="flex items-center gap-2 mb-1">
            <Target className="w-4 h-4" style={{ color: s.realMargin >= 0 ? "rgb(52 211 153)" : "rgb(248 113 113)" }} />
            <span className="text-[10px] uppercase tracking-wider text-muted-foreground">Margem REAL</span>
          </div>
          <p className={`text-2xl font-bold font-mono ${s.realMargin >= 0 ? "text-emerald-400" : "text-red-400"}`}>
            {formatCurrency(s.realMargin)}
          </p>
          <p className="text-[10px] text-muted-foreground mt-1">
            {fmtPct(s.realMarginPct)} · prev: {formatCurrency(s.expectedMargin)} ({fmtPct(s.expectedMarginPct)})
          </p>
        </div>
      </div>

      {/* Status execution bar */}
      <div className="rounded-xl border border-border/30 bg-card p-4">
        <div className="flex items-center gap-2 mb-3">
          <CheckCircle2 className="w-4 h-4 text-primary" />
          <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
            Status de execução
          </span>
        </div>
        <div className="space-y-3">
          <StatusBar
            label="Faturamento emitido"
            current={s.invoiced}
            target={s.expectedRevenue}
            color="emerald"
          />
          <StatusBar
            label="Recebido"
            current={s.received}
            target={s.invoiced}
            color="cyan"
          />
          <StatusBar
            label="Pago a fornecedores"
            current={s.paid}
            target={s.payableDue}
            color="amber"
          />
        </div>
      </div>

      {/* Breakdown por fase */}
      <div className="rounded-xl border border-border/30 bg-card overflow-hidden">
        <div className="px-4 py-3 border-b border-border/20 flex items-center gap-2">
          <CalendarRange className="w-4 h-4 text-primary" />
          <h4 className="text-sm font-semibold">Por fase ({data.phaseBreakdown.length})</h4>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead className="bg-muted/10">
              <tr>
                <th className="text-left p-2 text-muted-foreground font-medium">#</th>
                <th className="text-left p-2 text-muted-foreground font-medium">Fase</th>
                <th className="text-left p-2 text-muted-foreground font-medium">Período</th>
                <th className="text-right p-2 text-muted-foreground font-medium">Itens</th>
                <th className="text-right p-2 text-muted-foreground font-medium">Prev. Receita</th>
                <th className="text-right p-2 text-muted-foreground font-medium">Faturado</th>
                <th className="text-right p-2 text-muted-foreground font-medium">Recebido</th>
                <th className="text-right p-2 text-muted-foreground font-medium">Pago</th>
                <th className="text-right p-2 text-muted-foreground font-medium">Margem real</th>
              </tr>
            </thead>
            <tbody>
              {data.phaseBreakdown.length === 0 ? (
                <tr>
                  <td colSpan={9} className="p-6 text-center text-muted-foreground">
                    Campanha sem fases cadastradas.
                  </td>
                </tr>
              ) : (
                data.phaseBreakdown.map((p) => (
                  <tr key={p.phaseId} className="border-t border-border/20">
                    <td className="p-2 font-mono">{p.sequence}</td>
                    <td className="p-2">
                      <div className="flex items-center gap-1.5">
                        {p.label}
                        <Badge variant="outline" className={`text-[8px] ${STATUS_COLORS[p.status] ?? ""}`}>
                          {STATUS_LABELS[p.status] ?? p.status}
                        </Badge>
                      </div>
                    </td>
                    <td className="p-2 text-muted-foreground">
                      {fmtDate(p.periodStart)}→{fmtDate(p.periodEnd)}
                    </td>
                    <td className="p-2 text-right font-mono">{p.itemCount}</td>
                    <td className="p-2 text-right font-mono text-emerald-400/80">{formatCurrency(p.expectedRevenue)}</td>
                    <td className="p-2 text-right font-mono">{formatCurrency(p.invoiced)}</td>
                    <td className="p-2 text-right font-mono text-cyan-400">{formatCurrency(p.received)}</td>
                    <td className="p-2 text-right font-mono text-red-400/80">{formatCurrency(p.paid)}</td>
                    <td className={`p-2 text-right font-mono font-semibold ${p.realMargin >= 0 ? "text-emerald-400" : "text-red-400"}`}>
                      {formatCurrency(p.realMargin)}
                      <div className="text-[9px] text-muted-foreground">{fmtPct(p.realMarginPct)}</div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Breakdown por produto */}
      {data.productBreakdown.length > 0 && (
        <div className="rounded-xl border border-border/30 bg-card overflow-hidden">
          <div className="px-4 py-3 border-b border-border/20 flex items-center gap-2">
            <Package className="w-4 h-4 text-primary" />
            <h4 className="text-sm font-semibold">Por produto ({data.productBreakdown.length})</h4>
          </div>
          <table className="w-full text-xs">
            <thead className="bg-muted/10">
              <tr>
                <th className="text-left p-2 text-muted-foreground font-medium">Produto</th>
                <th className="text-right p-2 text-muted-foreground font-medium">Fases</th>
                <th className="text-right p-2 text-muted-foreground font-medium">Qtd total</th>
                <th className="text-right p-2 text-muted-foreground font-medium">Receita</th>
                <th className="text-right p-2 text-muted-foreground font-medium">Produção</th>
                <th className="text-right p-2 text-muted-foreground font-medium">Frete</th>
                <th className="text-right p-2 text-muted-foreground font-medium">Repasse VIP</th>
                <th className="text-right p-2 text-muted-foreground font-medium">Margem bruta</th>
              </tr>
            </thead>
            <tbody>
              {data.productBreakdown.map((pr) => {
                const vipRepasse = pr.totalVipRepasse ?? 0;
                const total = pr.totalRevenue - pr.totalProductionCost - pr.totalFreightCost - vipRepasse;
                return (
                  <tr key={pr.productId} className="border-t border-border/20">
                    <td className="p-2">
                      <div className="flex items-center gap-1.5">
                        <Package className="w-3 h-3 text-muted-foreground" />
                        {pr.productName}
                        {pr.productTipo && (
                          <span className="text-[9px] text-muted-foreground">({pr.productTipo})</span>
                        )}
                      </div>
                    </td>
                    <td className="p-2 text-right font-mono">{pr.phaseCount}</td>
                    <td className="p-2 text-right font-mono">{pr.totalQuantity.toLocaleString("pt-BR")}</td>
                    <td className="p-2 text-right font-mono text-emerald-400">{formatCurrency(pr.totalRevenue)}</td>
                    <td className="p-2 text-right font-mono text-red-400/80">{formatCurrency(pr.totalProductionCost)}</td>
                    <td className="p-2 text-right font-mono text-red-400/80">{formatCurrency(pr.totalFreightCost)}</td>
                    <td className="p-2 text-right font-mono text-red-400/80">{vipRepasse > 0 ? formatCurrency(vipRepasse) : "—"}</td>
                    <td className={`p-2 text-right font-mono font-semibold ${total >= 0 ? "text-emerald-400" : "text-red-400"}`}>
                      {formatCurrency(total)}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Alertas */}
      {(s.invoiced < s.expectedRevenue || s.paid < s.payableDue) && (
        <div className="rounded-xl border border-amber-500/30 bg-amber-500/5 p-4 flex items-start gap-3">
          <AlertCircle className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
          <div className="space-y-1">
            <p className="text-xs font-semibold text-amber-400">Pendências desta campanha</p>
            {s.invoiced < s.expectedRevenue && (
              <p className="text-[11px] text-muted-foreground">
                • Faturamento a emitir: <strong>{formatCurrency(s.expectedRevenue - s.invoiced)}</strong>
              </p>
            )}
            {s.received < s.invoiced && (
              <p className="text-[11px] text-muted-foreground">
                • A receber de clientes: <strong>{formatCurrency(s.invoiced - s.received)}</strong>
              </p>
            )}
            {s.paid < s.payableDue && (
              <p className="text-[11px] text-muted-foreground">
                • Contas a pagar pendentes: <strong>{formatCurrency(s.payableDue - s.paid)}</strong>
              </p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function StatusBar({ label, current, target, color }: {
  label: string; current: number; target: number; color: "emerald" | "cyan" | "amber";
}) {
  const pct = target > 0 ? Math.min((current / target) * 100, 100) : 0;
  const colorMap = {
    emerald: { bg: "bg-emerald-500/20", fill: "bg-emerald-500", text: "text-emerald-400" },
    cyan: { bg: "bg-cyan-500/20", fill: "bg-cyan-500", text: "text-cyan-400" },
    amber: { bg: "bg-amber-500/20", fill: "bg-amber-500", text: "text-amber-400" },
  }[color];

  return (
    <div>
      <div className="flex items-center justify-between mb-1">
        <span className="text-xs text-muted-foreground">{label}</span>
        <span className={`text-xs font-mono font-semibold ${colorMap.text}`}>
          {formatCurrency(current)} / {formatCurrency(target)} · {pct.toFixed(1)}%
        </span>
      </div>
      <div className={`w-full h-2 rounded-full ${colorMap.bg}`}>
        <div className={`h-full rounded-full ${colorMap.fill}`} style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}
