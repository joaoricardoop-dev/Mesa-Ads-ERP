import PageContainer from "@/components/PageContainer";
import Section from "@/components/Section";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { formatCurrency } from "@/lib/format";
import { trpc } from "@/lib/trpc";
import {
  Users, TrendingUp, Download, ChevronRight, FileText,
  Calendar, CreditCard, BarChart3, Layers, Info,
} from "lucide-react";
import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";

type MetricsData = NonNullable<ReturnType<typeof trpc.financial.getMetrics.useQuery>["data"]>;
type InvoiceItem = MetricsData["invoiceList"][number];

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
  const months = ["Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
    "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"];
  return `${months[parseInt(m, 10) - 1]}/${y}`;
}

function exportCsv(startDate: string, endDate: string, data: MetricsData) {
  const s = data.summary;
  const rows: string[][] = [];
  rows.push(["RELATÓRIO FINANCEIRO UNIFICADO (Nossa Parte)"]);
  rows.push(["Período:", `${startDate} a ${endDate}`]);
  rows.push(["Fonte:", "getMetrics — Receita Líquida (NET_AMOUNT_SQL)"]);
  rows.push([]);
  rows.push(["RESUMO"]);
  rows.push(["Faturamento Bruto (clientes)", fmtNum(s.grossBilling)]);
  rows.push(["Deduções (com.restaurante + VIP + ISS)", fmtNum(s.deductions)]);
  rows.push(["Nossa Parte (Receita Líquida)", fmtNum(s.netBilling)]);
  rows.push(["Custos de Produção", fmtNum(s.productionCosts)]);
  rows.push(["Custos de Frete", fmtNum(s.freightCosts)]);
  rows.push(["Custos Totais", fmtNum(s.totalCosts)]);
  rows.push(["Resultado Bruto", fmtNum(s.grossResult)]);
  rows.push(["Margem %", `${(s.marginPct * 100).toFixed(1)}%`]);
  rows.push([]);
  rows.push(["FATURAMENTO MENSAL"]);
  rows.push(["Mês", "Bruto", "Nossa Parte"]);
  for (const m of data.byMonth) rows.push([fmtMonth(m.month), fmtNum(m.grossBilling), fmtNum(m.netBilling)]);
  rows.push([]);
  rows.push(["FATURAS DO PERÍODO"]);
  rows.push(["Nº Fatura", "Anunciante", "Campanha", "Emissão", "Vencimento", "Pgto", "Bruto", "Líquido (Nossa Parte)", "Método", "Status"]);
  for (const inv of data.invoiceList) {
    rows.push([
      inv.invoiceNumber, inv.clientName, inv.campaignName,
      fmtDateBR(inv.issueDate), fmtDateBR(inv.dueDate), fmtDateBR(inv.paymentDate),
      fmtNum(inv.grossAmount), fmtNum(inv.netAmount),
      inv.paymentMethod || "", inv.status,
    ]);
  }
  const csvContent = rows.map(row => row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(";")).join("\r\n");
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

type DrillTarget = { name: string; invoices: InvoiceItem[] };

function DrillDownModal({ target, onClose }: { target: DrillTarget | null; onClose: () => void }) {
  if (!target) return null;
  const totalGross = target.invoices.reduce((s, inv) => s + inv.grossAmount, 0);
  const totalNet = target.invoices.reduce((s, inv) => s + inv.netAmount, 0);
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
                    <p className="font-medium text-foreground/80">{inv.campaignName}</p>
                    <div className="flex items-center gap-3">
                      {inv.issueDate && <span className="flex items-center gap-1"><Calendar className="w-2.5 h-2.5" /> {fmtDateBR(inv.issueDate)}</span>}
                      {inv.paymentDate && <span className="flex items-center gap-1 text-emerald-400"><CreditCard className="w-2.5 h-2.5" /> {fmtDateBR(inv.paymentDate)}</span>}
                      {inv.paymentMethod && <span className="text-muted-foreground/70">{inv.paymentMethod}</span>}
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-bold font-mono">{formatCurrency(inv.netAmount)}</p>
                    {inv.grossAmount !== inv.netAmount && (
                      <p className="text-[10px] text-muted-foreground">Bruto: {formatCurrency(inv.grossAmount)}</p>
                    )}
                  </div>
                </div>
              </div>
            ))}
            <div className="flex items-center justify-between px-3 py-2 rounded-lg bg-muted/40 mt-2">
              <span className="text-xs font-semibold">Nossa Parte</span>
              <span className="text-sm font-bold font-mono text-primary">{formatCurrency(totalNet)}</span>
            </div>
            {totalGross !== totalNet && (
              <div className="flex items-center justify-between px-3 py-1 text-[11px] text-muted-foreground">
                <span>Bruto faturado ao cliente</span>
                <span className="font-mono">{formatCurrency(totalGross)}</span>
              </div>
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

export default function FinancialReport() {
  const now = new Date();
  const [startDate, setStartDate] = useState(
    `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-01`
  );
  const [endDate, setEndDate] = useState(
    new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().split("T")[0]
  );

  const { data, isLoading } = trpc.financial.getMetrics.useQuery(
    { startDate, endDate },
    { enabled: !!startDate && !!endDate }
  );

  const [drillTarget, setDrillTarget] = useState<DrillTarget | null>(null);

  return (
    <PageContainer title="Relatório Financeiro" description="Relatório consolidado por período — Receita Líquida (Nossa Parte)">
      <div className="flex items-end gap-4 flex-wrap">
        <div>
          <Label className="text-xs text-muted-foreground">Data Início</Label>
          <Input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} className="w-40" />
        </div>
        <div>
          <Label className="text-xs text-muted-foreground">Data Fim</Label>
          <Input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} className="w-40" />
        </div>
        <Button
          variant="outline" size="sm" className="gap-1.5"
          disabled={!data}
          onClick={() => { if (data) exportCsv(startDate, endDate, data); }}
        >
          <Download className="w-3.5 h-3.5" /> CSV
        </Button>
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
          {/* Banner explicativo */}
          <div className="flex items-start gap-2.5 rounded-lg border border-primary/20 bg-primary/5 px-4 py-3 text-xs text-muted-foreground">
            <Info className="w-3.5 h-3.5 text-primary mt-0.5 shrink-0" />
            <span>
              <strong className="text-foreground">Nossa Parte</strong> = faturamento bruto menos comissão do restaurante, repasse VIP e ISS retido.
              Mesma fórmula usada no <strong className="text-foreground">Dashboard</strong> e na aba <strong className="text-foreground">Custos</strong>.
            </span>
          </div>

          {/* KPIs */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="rounded-xl border border-border/30 bg-card p-4">
              <p className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1">Bruto (clientes)</p>
              <p className="text-xl font-bold text-foreground">{formatCurrency(data.summary.grossBilling)}</p>
            </div>
            <div className="rounded-xl border border-border/30 bg-card p-4">
              <p className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1">Nossa Parte</p>
              <p className="text-xl font-bold text-primary">{formatCurrency(data.summary.netBilling)}</p>
              {data.summary.deductions > 0 && (
                <p className="text-[10px] text-muted-foreground mt-0.5">— {formatCurrency(data.summary.deductions)} repasses</p>
              )}
            </div>
            <div className="rounded-xl border border-border/30 bg-card p-4">
              <p className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1">Custos (prod+frete)</p>
              <p className="text-xl font-bold text-red-400">{formatCurrency(data.summary.totalCosts)}</p>
            </div>
            <div className="rounded-xl border border-border/30 bg-card p-4">
              <p className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1">Resultado Bruto</p>
              <p className={`text-xl font-bold ${data.summary.grossResult >= 0 ? "text-emerald-400" : "text-red-400"}`}>
                {formatCurrency(data.summary.grossResult)}
              </p>
              <p className="text-[10px] text-muted-foreground mt-0.5">{(data.summary.marginPct * 100).toFixed(1).replace(".", ",")}% margem</p>
            </div>
          </div>

          {/* Por mês */}
          {data.byMonth.length > 0 && (
            <Section title="Faturamento Mensal" icon={BarChart3}>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border/20">
                      <th className="text-left px-3 py-2 font-medium text-muted-foreground">Mês</th>
                      <th className="text-right px-3 py-2 font-medium text-muted-foreground">Bruto</th>
                      <th className="text-right px-3 py-2 font-medium text-muted-foreground">Nossa Parte</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.byMonth.map((m, i) => (
                      <tr key={i} className="border-b border-border/10">
                        <td className="px-3 py-2 font-medium">{fmtMonth(m.month)}</td>
                        <td className="px-3 py-2 text-right text-muted-foreground">{formatCurrency(m.grossBilling)}</td>
                        <td className="px-3 py-2 text-right font-semibold text-primary">{formatCurrency(m.netBilling)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Section>
          )}

          {/* Por campanha */}
          <Section title="Por Campanha" icon={TrendingUp}>
            {data.byCampaign.length === 0 ? (
              <p className="text-sm text-muted-foreground">Nenhuma campanha no período</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border/20">
                      <th className="text-left px-3 py-2 font-medium text-muted-foreground">Campanha</th>
                      <th className="text-right px-3 py-2 font-medium text-muted-foreground">Bruto</th>
                      <th className="text-right px-3 py-2 font-medium text-muted-foreground">Nossa Parte</th>
                      <th className="text-right px-3 py-2 font-medium text-muted-foreground">Custos</th>
                      <th className="text-right px-3 py-2 font-medium text-muted-foreground">Resultado</th>
                      <th className="w-8" />
                    </tr>
                  </thead>
                  <tbody>
                    {data.byCampaign.map((c, i) => (
                      <tr
                        key={i}
                        className="border-b border-border/10 hover:bg-muted/30 cursor-pointer group transition-colors"
                        onClick={() => setDrillTarget({ name: c.name, invoices: c.invoices })}
                      >
                        <td className="px-3 py-2 font-medium group-hover:text-primary transition-colors">{c.name}</td>
                        <td className="px-3 py-2 text-right text-muted-foreground">{formatCurrency(c.grossBilling)}</td>
                        <td className="px-3 py-2 text-right font-semibold">{formatCurrency(c.netBilling)}</td>
                        <td className="px-3 py-2 text-right text-red-400">{formatCurrency(c.totalCosts)}</td>
                        <td className={`px-3 py-2 text-right font-semibold ${c.result >= 0 ? "text-emerald-400" : "text-red-400"}`}>
                          {formatCurrency(c.result)}
                        </td>
                        <td className="px-3 py-2 text-right">
                          <ChevronRight className="w-3.5 h-3.5 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                <p className="text-[11px] text-muted-foreground/60 mt-2 px-3">Clique para ver as faturas da campanha</p>
              </div>
            )}
          </Section>

          {/* Por anunciante */}
          <Section title="Por Anunciante" icon={Users}>
            {data.byClient.length === 0 ? (
              <p className="text-sm text-muted-foreground">Nenhum anunciante no período</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border/20">
                      <th className="text-left px-3 py-2 font-medium text-muted-foreground">Anunciante</th>
                      <th className="text-right px-3 py-2 font-medium text-muted-foreground">Bruto</th>
                      <th className="text-right px-3 py-2 font-medium text-muted-foreground">Nossa Parte</th>
                      <th className="w-8" />
                    </tr>
                  </thead>
                  <tbody>
                    {data.byClient.map((c, i) => (
                      <tr
                        key={i}
                        className="border-b border-border/10 hover:bg-muted/30 cursor-pointer group transition-colors"
                        onClick={() => setDrillTarget({ name: c.name, invoices: c.invoices })}
                      >
                        <td className="px-3 py-2 font-medium group-hover:text-primary transition-colors">{c.name}</td>
                        <td className="px-3 py-2 text-right text-muted-foreground">{formatCurrency(c.grossBilling)}</td>
                        <td className="px-3 py-2 text-right font-semibold">{formatCurrency(c.netBilling)}</td>
                        <td className="px-3 py-2 text-right">
                          <ChevronRight className="w-3.5 h-3.5 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                <p className="text-[11px] text-muted-foreground/60 mt-2 px-3">Clique para ver as faturas do anunciante</p>
              </div>
            )}
          </Section>

          {/* Lista de faturas */}
          <Section title="Faturas do Período" icon={Layers}>
            {data.invoiceList.length === 0 ? (
              <p className="text-sm text-muted-foreground">Nenhuma fatura no período</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border/20">
                      <th className="text-left px-3 py-2 font-medium text-muted-foreground">Nº</th>
                      <th className="text-left px-3 py-2 font-medium text-muted-foreground">Anunciante / Campanha</th>
                      <th className="text-right px-3 py-2 font-medium text-muted-foreground">Bruto</th>
                      <th className="text-right px-3 py-2 font-medium text-muted-foreground">Nossa Parte</th>
                      <th className="text-left px-3 py-2 font-medium text-muted-foreground">Emissão</th>
                      <th className="text-left px-3 py-2 font-medium text-muted-foreground">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.invoiceList.map((inv, i) => (
                      <tr key={i} className="border-b border-border/10">
                        <td className="px-3 py-2 font-mono text-xs text-muted-foreground">{inv.invoiceNumber}</td>
                        <td className="px-3 py-2">
                          <p className="font-medium">{inv.clientName}</p>
                          <p className="text-[11px] text-muted-foreground">{inv.campaignName}</p>
                        </td>
                        <td className="px-3 py-2 text-right text-muted-foreground">{formatCurrency(inv.grossAmount)}</td>
                        <td className="px-3 py-2 text-right font-semibold">{formatCurrency(inv.netAmount)}</td>
                        <td className="px-3 py-2 text-muted-foreground">{fmtDateBR(inv.issueDate)}</td>
                        <td className="px-3 py-2">
                          <Badge variant="outline" className={`text-[10px] ${STATUS_BADGE[inv.status] || "bg-muted text-muted-foreground"}`}>
                            {STATUS_LABEL[inv.status] || inv.status}
                          </Badge>
                        </td>
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
