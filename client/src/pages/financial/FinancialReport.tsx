import PageContainer from "@/components/PageContainer";
import Section from "@/components/Section";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { formatCurrency, formatPercent } from "@/lib/format";
import { trpc } from "@/lib/trpc";
import { Users, UtensilsCrossed, TrendingUp, Download, X, ChevronRight, FileText, Calendar, CreditCard } from "lucide-react";
import { useState } from "react";
import { generateFinancialPdf, type FinancialReportData } from "@/lib/generate-financial-pdf";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";

function fmtNum(v: number) {
  return v.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function fmtDateBR(dateStr: string | null): string {
  if (!dateStr) return "";
  const [y, m, d] = dateStr.split("-");
  return `${d}/${m}/${y}`;
}

function fmtMonth(monthStr: string): string {
  const [y, m] = monthStr.split("-");
  const months = ["Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho", "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"];
  return `${months[parseInt(m, 10) - 1]}/${y}`;
}

function exportCsv(startDate: string, endDate: string, data: FinancialReportData) {
  const rows: string[][] = [];
  rows.push(["RELATÓRIO FINANCEIRO"]);
  rows.push(["Período:", `${startDate} a ${endDate}`]);
  rows.push([]);
  rows.push(["RESUMO"]);
  rows.push(["Receita Total", fmtNum(data.totalRevenue)]);
  rows.push(["Custos Totais", fmtNum(data.totalCosts)]);
  rows.push(["Margem Bruta", fmtNum(data.margin)]);
  rows.push(["Margem %", `${data.marginPercent.toFixed(1)}%`]);
  rows.push([]);
  rows.push(["FATURAMENTO MENSAL"]);
  rows.push(["Mês", "Receita"]);
  for (const m of data.monthlyRevenue) rows.push([fmtMonth(m.month), fmtNum(m.revenue)]);
  rows.push(["Total", fmtNum(data.monthlyRevenue.reduce((s, m) => s + m.revenue, 0))]);
  rows.push([]);
  rows.push(["FATURAS DO PERÍODO"]);
  rows.push(["Nº Fatura", "Anunciante", "Campanha", "Emissão", "Vencimento", "Pagamento", "Valor", "Método", "Status"]);
  for (const inv of data.invoiceList) {
    rows.push([inv.invoiceNumber, inv.clientName, inv.campaignName, fmtDateBR(inv.issueDate), fmtDateBR(inv.dueDate), fmtDateBR(inv.paymentDate), fmtNum(inv.amount), inv.paymentMethod || "", inv.status]);
  }
  rows.push(["Total", "", "", "", "", "", fmtNum(data.invoiceList.reduce((s, inv) => s + inv.amount, 0)), "", ""]);
  const csvContent = rows.map((row) => row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(";")).join("\r\n");
  const BOM = "\uFEFF";
  const blob = new Blob([BOM + csvContent], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `relatorio-financeiro-${startDate}-${endDate}.csv`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

const STATUS_BADGE: Record<string, string> = {
  emitida:   "bg-amber-500/20 text-amber-400 border-amber-500/30",
  paga:      "bg-emerald-500/20 text-emerald-400 border-emerald-500/30",
  vencida:   "bg-red-500/20 text-red-400 border-red-500/30",
  cancelada: "bg-muted text-muted-foreground",
};
const STATUS_LABEL: Record<string, string> = {
  emitida: "Emitida", paga: "Paga", vencida: "Vencida", cancelada: "Cancelada",
};

// ─── Drill-down Modal ─────────────────────────────────────────────────────────

type DrillTarget = { type: "campaign"; name: string; invoices: FinancialReportData["invoiceList"] }
                 | { type: "client";   name: string; invoices: FinancialReportData["invoiceList"] };

function DrillDownModal({ target, onClose }: { target: DrillTarget | null; onClose: () => void }) {
  if (!target) return null;
  const total = target.invoices.reduce((s, inv) => s + inv.amount, 0);
  return (
    <Dialog open={!!target} onOpenChange={() => onClose()}>
      <DialogContent className="sm:max-w-xl bg-card border-border/30 max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-sm">
            <FileText className="w-4 h-4 text-primary" />
            Faturas — {target.name}
          </DialogTitle>
        </DialogHeader>
        {target.invoices.length === 0 ? (
          <p className="text-sm text-muted-foreground py-6 text-center">Nenhuma fatura neste período</p>
        ) : (
          <div className="space-y-2 py-2">
            {target.invoices.map((inv, i) => (
              <div key={i} className="px-3 py-2.5 rounded-lg bg-background border border-border/20 space-y-1">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs font-mono font-semibold text-muted-foreground">{inv.invoiceNumber}</span>
                  <Badge variant="outline" className={`text-[10px] ${STATUS_BADGE[inv.status] || "bg-muted text-muted-foreground"}`}>
                    {STATUS_LABEL[inv.status] || inv.status}
                  </Badge>
                </div>
                <div className="flex items-center justify-between">
                  <div className="text-xs text-muted-foreground space-y-0.5">
                    {target.type === "client" && inv.campaignName && (
                      <p className="font-medium text-foreground/80">{inv.campaignName}</p>
                    )}
                    {target.type === "campaign" && <p>{inv.clientName}</p>}
                    <div className="flex items-center gap-3">
                      {inv.issueDate && (
                        <span className="flex items-center gap-1"><Calendar className="w-2.5 h-2.5" /> {fmtDateBR(inv.issueDate)}</span>
                      )}
                      {inv.paymentDate && (
                        <span className="flex items-center gap-1 text-emerald-400"><CreditCard className="w-2.5 h-2.5" /> {fmtDateBR(inv.paymentDate)}</span>
                      )}
                      {inv.paymentMethod && (
                        <span className="text-muted-foreground/70">{inv.paymentMethod}</span>
                      )}
                    </div>
                  </div>
                  <span className="text-sm font-bold font-mono">{formatCurrency(inv.amount)}</span>
                </div>
              </div>
            ))}
            <div className="flex items-center justify-between px-3 py-2 rounded-lg bg-muted/40 mt-2">
              <span className="text-xs font-semibold">Total</span>
              <span className="text-sm font-bold font-mono text-primary">{formatCurrency(total)}</span>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

// ─── Main ─────────────────────────────────────────────────────────────────────

export default function FinancialReport() {
  const now = new Date();
  const [startDate, setStartDate] = useState(
    `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-01`
  );
  const [endDate, setEndDate] = useState(
    new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().split("T")[0]
  );

  const { data, isLoading } = trpc.financial.report.useQuery(
    { startDate, endDate },
    { enabled: !!startDate && !!endDate }
  );

  const [drillTarget, setDrillTarget] = useState<DrillTarget | null>(null);

  function openCampaignDrill(name: string) {
    if (!data) return;
    const invoices = data.invoiceList.filter((inv) => inv.campaignName === name);
    setDrillTarget({ type: "campaign", name, invoices });
  }

  function openClientDrill(name: string) {
    if (!data) return;
    const invoices = data.invoiceList.filter((inv) => inv.clientName === name);
    setDrillTarget({ type: "client", name, invoices });
  }

  return (
    <PageContainer title="Relatório Financeiro" description="Relatório consolidado por período">
      <div className="flex items-end gap-4 flex-wrap">
        <div>
          <Label className="text-xs text-muted-foreground">Data Início</Label>
          <Input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} className="w-40" />
        </div>
        <div>
          <Label className="text-xs text-muted-foreground">Data Fim</Label>
          <Input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} className="w-40" />
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" className="gap-1.5" disabled={!data}
            onClick={() => { if (!data) return; generateFinancialPdf({ startDate, endDate, ...data }); }}>
            <Download className="w-3.5 h-3.5" /> PDF
          </Button>
          <Button variant="outline" size="sm" className="gap-1.5" disabled={!data}
            onClick={() => { if (!data) return; exportCsv(startDate, endDate, { startDate, endDate, ...data }); }}>
            <Download className="w-3.5 h-3.5" /> CSV
          </Button>
        </div>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center h-40">
          <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
        </div>
      ) : !data ? (
        <div className="flex items-center justify-center h-40 text-sm text-muted-foreground">
          Selecione um período para gerar o relatório
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="rounded-xl border border-border/30 bg-card p-4">
              <p className="text-xs text-muted-foreground mb-1">Receita Total</p>
              <p className="text-2xl font-bold text-primary">{formatCurrency(data.totalRevenue)}</p>
            </div>
            <div className="rounded-xl border border-border/30 bg-card p-4">
              <p className="text-xs text-muted-foreground mb-1">Custos Totais</p>
              <p className="text-2xl font-bold">{formatCurrency(data.totalCosts)}</p>
            </div>
            <div className="rounded-xl border border-border/30 bg-card p-4">
              <p className="text-xs text-muted-foreground mb-1">Margem Bruta</p>
              <p className={`text-2xl font-bold ${data.margin >= 0 ? "text-emerald-500" : "text-red-500"}`}>
                {formatCurrency(data.margin)}
              </p>
              <p className="text-xs text-muted-foreground mt-1">{formatPercent(data.marginPercent)}</p>
            </div>
          </div>

          <Section title="Por Campanha" icon={TrendingUp}>
            {data.byCampaign.length === 0 ? (
              <p className="text-sm text-muted-foreground">Nenhuma campanha no período</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border/20">
                      <th className="text-left px-3 py-2 font-medium text-muted-foreground">Campanha</th>
                      <th className="text-right px-3 py-2 font-medium text-muted-foreground">Receita</th>
                      <th className="text-right px-3 py-2 font-medium text-muted-foreground">Custos</th>
                      <th className="text-right px-3 py-2 font-medium text-muted-foreground">Margem</th>
                      <th className="w-8" />
                    </tr>
                  </thead>
                  <tbody>
                    {data.byCampaign.map((c, i) => (
                      <tr
                        key={i}
                        className="border-b border-border/10 hover:bg-muted/30 cursor-pointer group transition-colors"
                        onClick={() => openCampaignDrill(c.name)}
                        title="Ver faturas desta campanha"
                      >
                        <td className="px-3 py-2 font-medium group-hover:text-primary transition-colors">{c.name}</td>
                        <td className="px-3 py-2 text-right">{formatCurrency(c.revenue)}</td>
                        <td className="px-3 py-2 text-right">{formatCurrency(c.costs)}</td>
                        <td className={`px-3 py-2 text-right font-medium ${c.margin >= 0 ? "text-emerald-500" : "text-red-500"}`}>
                          {formatCurrency(c.margin)}
                        </td>
                        <td className="px-3 py-2 text-right">
                          <ChevronRight className="w-3.5 h-3.5 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                <p className="text-[11px] text-muted-foreground/60 mt-2 px-3">
                  Clique em uma linha para ver as faturas da campanha
                </p>
              </div>
            )}
          </Section>

          <Section title="Por Anunciante" icon={Users}>
            {data.byClient.length === 0 ? (
              <p className="text-sm text-muted-foreground">Nenhum anunciante no período</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border/20">
                      <th className="text-left px-3 py-2 font-medium text-muted-foreground">Anunciante</th>
                      <th className="text-right px-3 py-2 font-medium text-muted-foreground">Receita</th>
                      <th className="w-8" />
                    </tr>
                  </thead>
                  <tbody>
                    {data.byClient.map((c, i) => (
                      <tr
                        key={i}
                        className="border-b border-border/10 hover:bg-muted/30 cursor-pointer group transition-colors"
                        onClick={() => openClientDrill(c.name)}
                        title="Ver faturas deste anunciante"
                      >
                        <td className="px-3 py-2 font-medium group-hover:text-primary transition-colors">{c.name}</td>
                        <td className="px-3 py-2 text-right">{formatCurrency(c.revenue)}</td>
                        <td className="px-3 py-2 text-right">
                          <ChevronRight className="w-3.5 h-3.5 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                <p className="text-[11px] text-muted-foreground/60 mt-2 px-3">
                  Clique em uma linha para ver as faturas do anunciante
                </p>
              </div>
            )}
          </Section>

          <Section title="Por Local" icon={UtensilsCrossed}>
            {data.byRestaurant.length === 0 ? (
              <p className="text-sm text-muted-foreground">Nenhum pagamento a local no período</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border/20">
                      <th className="text-left px-3 py-2 font-medium text-muted-foreground">Local</th>
                      <th className="text-right px-3 py-2 font-medium text-muted-foreground">Total Pago</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.byRestaurant.map((r, i) => (
                      <tr key={i} className="border-b border-border/10">
                        <td className="px-3 py-2">{r.name}</td>
                        <td className="px-3 py-2 text-right font-medium">{formatCurrency(r.total)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Section>
        </>
      )}

      <DrillDownModal target={drillTarget} onClose={() => setDrillTarget(null)} />
    </PageContainer>
  );
}
