import PageContainer from "@/components/PageContainer";
import { formatCurrency } from "@/lib/format";
import { trpc } from "@/lib/trpc";
import { useState, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  FileText, Download, Users, ChevronRight, Building2,
  AlertCircle, Printer,
} from "lucide-react";

function fmtPct(v: number): string {
  return `${v.toFixed(1)}%`;
}

function fmtDateBR(d: Date): string {
  return d.toLocaleDateString("pt-BR");
}

export default function PartnerCommissionReport() {
  const [selectedPartnerId, setSelectedPartnerId] = useState<number | undefined>();
  const [selectedCampaignId, setSelectedCampaignId] = useState<number | null>(null);
  const reportRef = useRef<HTMLDivElement>(null);

  const { data: partnersList } = trpc.financial.listAllPartners.useQuery();
  const { data: campaignsList } = trpc.financial.listPartnerCampaigns.useQuery(
    { partnerId: selectedPartnerId },
    { enabled: !!selectedPartnerId }
  );
  const { data: report, isLoading: reportLoading } = trpc.financial.partnerCommissionReport.useQuery(
    { campaignId: selectedCampaignId! },
    { enabled: !!selectedCampaignId }
  );

  const handlePrint = () => {
    if (!reportRef.current) return;
    const printWindow = window.open("", "_blank");
    if (!printWindow) return;
    printWindow.document.write(`
      <html>
      <head>
        <title>Relatório de Comissão - ${report?.partnerName || ""}</title>
        <style>
          * { margin: 0; padding: 0; box-sizing: border-box; }
          body { font-family: 'Segoe UI', system-ui, sans-serif; padding: 40px; color: #1a1a1a; font-size: 13px; }
          .header { display: flex; justify-content: space-between; margin-bottom: 36px; }
          .header-left h1 { font-size: 22px; font-weight: 700; color: #111; }
          .header-left p { font-size: 12px; color: #666; margin-top: 3px; }
          .summary-box { border: 1px solid #ccc; border-radius: 6px; padding: 0; overflow: hidden; min-width: 260px; }
          .summary-row { display: flex; justify-content: space-between; padding: 8px 14px; border-bottom: 1px solid #eee; }
          .summary-row:last-child { border-bottom: none; background: #f0fdf4; font-weight: 700; }
          .summary-row .label { color: #555; }
          .summary-row .value { font-family: monospace; }
          .neg { color: #dc2626; }
          .pos { color: #16a34a; }
          table { width: 100%; border-collapse: collapse; margin-top: 28px; }
          th { text-align: left; padding: 8px 12px; border-bottom: 2px solid #ddd; font-size: 11px; text-transform: uppercase; color: #888; letter-spacing: 0.5px; }
          td { padding: 8px 12px; border-bottom: 1px solid #eee; }
          .section-header { background: #f3f4f6; font-weight: 700; font-size: 11px; text-transform: uppercase; color: #555; letter-spacing: 0.5px; }
          .highlight { background: #f0fdf4; font-weight: 700; }
          .highlight-green { background: #dcfce7; font-weight: 700; }
          .text-right { text-align: right; }
          .text-center { text-align: center; }
          .indent { padding-left: 28px; }
          .footer { margin-top: 40px; padding-top: 16px; border-top: 1px solid #ddd; }
          .footer p { font-size: 11px; color: #888; }
          .mono { font-family: monospace; }
          @media print { body { padding: 20px; } }
        </style>
      </head>
      <body>${reportRef.current.innerHTML}
        <div class="footer">
          <p><strong>Observações:</strong> O pagamento deverá ser realizado em até <strong>5 (cinco) dias úteis</strong> a partir da data de emissão deste relatório.</p>
        </div>
      </body>
      </html>
    `);
    printWindow.document.close();
    printWindow.print();
  };

  return (
    <PageContainer title="Relatório de Comissão" description="Comissão de parceiros por campanha">
      <div className="space-y-6">

        <div className="rounded-2xl border border-border/20 bg-card p-6">
          <div className="flex items-center gap-2 mb-4">
            <Users className="w-4 h-4 text-primary" />
            <span className="text-sm font-semibold">Selecionar Parceiro e Campanha</span>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="text-xs text-muted-foreground block mb-1.5">Parceiro</label>
              <select
                value={selectedPartnerId ?? ""}
                onChange={e => {
                  const v = e.target.value ? Number(e.target.value) : undefined;
                  setSelectedPartnerId(v);
                  setSelectedCampaignId(null);
                }}
                className="w-full h-9 rounded-lg border border-border/30 bg-background px-3 text-sm"
              >
                <option value="">Selecione um parceiro</option>
                {(partnersList || []).map(p => (
                  <option key={p.id} value={p.id}>{p.name} ({p.commissionPercent}%)</option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-xs text-muted-foreground block mb-1.5">Campanha</label>
              <select
                value={selectedCampaignId ?? ""}
                onChange={e => setSelectedCampaignId(e.target.value ? Number(e.target.value) : null)}
                disabled={!selectedPartnerId}
                className="w-full h-9 rounded-lg border border-border/30 bg-background px-3 text-sm disabled:opacity-50"
              >
                <option value="">Selecione uma campanha</option>
                {(campaignsList || []).map(c => (
                  <option key={c.campaignId} value={c.campaignId}>
                    {c.campaignName} — {c.clientName}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>

        {selectedCampaignId && reportLoading && (
          <div className="flex items-center justify-center h-40">
            <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
          </div>
        )}

        {report && !report.partnerId && (
          <div className="rounded-xl border border-amber-500/20 bg-amber-500/5 p-4 flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-amber-400 mt-0.5 shrink-0" />
            <div>
              <p className="text-sm font-semibold text-amber-400">Nenhum parceiro vinculado</p>
              <p className="text-xs text-muted-foreground mt-0.5">Esta campanha não possui um parceiro associado via cotação ou cliente.</p>
            </div>
          </div>
        )}

        {report && report.partnerId && (
          <>
            <div className="flex items-center justify-end gap-2">
              <Button variant="outline" size="sm" className="gap-1.5 text-xs" onClick={handlePrint}>
                <Printer className="w-3.5 h-3.5" /> Imprimir / PDF
              </Button>
            </div>

            <div className="rounded-2xl border border-border/20 bg-card p-8" ref={reportRef}>
              <div className="flex items-start justify-between mb-8" style={{ display: "flex", justifyContent: "space-between" }}>
                <div className="header-left">
                  <h1 style={{ fontSize: "20px", fontWeight: 700 }}>Relatório de Comissão</h1>
                  <p style={{ fontSize: "12px", color: "#999", marginTop: "4px" }}>{fmtDateBR(new Date())}</p>
                  <p style={{ fontSize: "12px", color: "#999" }}>Repasse ao Parceiro — {report.partnerName}</p>
                  <p style={{ fontSize: "12px", color: "#999" }}>Duração do contrato: {report.contractDuration} meses</p>
                </div>
                <div style={{ border: "1px solid hsl(var(--border))", borderRadius: "8px", overflow: "hidden", minWidth: "260px" }}>
                  <div className="flex justify-between px-4 py-2 border-b border-border/10">
                    <span className="text-xs text-muted-foreground">Base Comissão (R$)</span>
                    <span className="text-xs font-mono font-semibold">{formatCurrency(report.commissionBase)}</span>
                  </div>
                  <div className="flex justify-between px-4 py-2 bg-emerald-500/5">
                    <span className="text-xs text-muted-foreground">Total a Repassar (R$)</span>
                    <span className="text-xs font-mono font-bold text-emerald-400">{formatCurrency(report.totalToPartner)}</span>
                  </div>
                </div>
              </div>

              <table style={{ width: "100%", borderCollapse: "collapse" }}>
                <thead>
                  <tr style={{ borderBottom: "2px solid hsl(var(--border))" }}>
                    <th className="text-left py-2 px-3 text-[10px] uppercase tracking-wider text-muted-foreground font-medium">Descrição</th>
                    <th className="text-right py-2 px-3 text-[10px] uppercase tracking-wider text-muted-foreground font-medium">Valor (R$)</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td className="py-2.5 px-3 text-sm font-semibold text-emerald-400">Receita Bruta ({report.contractDuration}m)</td>
                    <td className="py-2.5 px-3 text-sm text-right font-mono font-semibold text-emerald-400">{formatCurrency(report.grossValue)}</td>
                  </tr>

                  <tr className="border-t border-border/10">
                    <td className="py-2 px-3 pl-6 text-sm text-red-400/80">(-) Impostos ({fmtPct(report.taxRate)} da receita)</td>
                    <td className="py-2 px-3 text-sm text-right font-mono text-red-400/80">{formatCurrency(report.taxDeduction)}</td>
                  </tr>
                  <tr className="bg-muted/20">
                    <td className="py-1.5 px-3 text-xs font-medium">= Base após Impostos</td>
                    <td className="py-1.5 px-3 text-xs text-right font-mono font-medium">{formatCurrency(report.afterTax)}</td>
                  </tr>

                  <tr className="border-t border-border/10">
                    <td className="py-2 px-3 pl-6 text-sm text-red-400/80">(-) Comissão Restaurante ({fmtPct(report.restaurantRate)} da base pós-impostos)</td>
                    <td className="py-2 px-3 text-sm text-right font-mono text-red-400/80">{formatCurrency(report.restaurantDeduction)}</td>
                  </tr>
                  <tr className="bg-muted/20">
                    <td className="py-1.5 px-3 text-xs font-medium">= Base após Comissões</td>
                    <td className="py-1.5 px-3 text-xs text-right font-mono font-medium">{formatCurrency(report.afterRestaurant)}</td>
                  </tr>

                  <tr className="border-t border-border/10">
                    <td className="py-2 px-3 pl-6 text-sm text-red-400/80">(-) Custo Produção ({report.contractDuration}m)</td>
                    <td className="py-2 px-3 text-sm text-right font-mono text-red-400/80">{formatCurrency(report.productionCost)}</td>
                  </tr>
                  {report.freightCost > 0 && (
                    <tr>
                      <td className="py-2 px-3 pl-6 text-sm text-red-400/80">(-) Custo Frete ({report.contractDuration}m)</td>
                      <td className="py-2 px-3 text-sm text-right font-mono text-red-400/80">{formatCurrency(report.freightCost)}</td>
                    </tr>
                  )}
                  <tr className="bg-blue-500/5 border-t border-border/20">
                    <td className="py-2.5 px-3 text-sm font-bold text-blue-400">= Base Comissão Parceiro</td>
                    <td className="py-2.5 px-3 text-sm text-right font-mono font-bold text-blue-400">{formatCurrency(report.commissionBase)}</td>
                  </tr>

                  <tr className="border-t border-border/10">
                    <td className="py-2 px-3 pl-6 text-sm text-purple-400/80">Comissão {report.partnerName} ({fmtPct(report.partnerCommissionPercent)} da base)</td>
                    <td className="py-2 px-3 text-sm text-right font-mono font-semibold text-purple-400">{formatCurrency(report.commissionValue)}</td>
                  </tr>

                  <tr className="bg-emerald-500/10 border-t-2 border-emerald-500/30">
                    <td className="py-3 px-3 text-sm font-bold text-emerald-400">TOTAL A REPASSAR AO PARCEIRO</td>
                    <td className="py-3 px-3 text-right font-mono text-lg font-bold text-emerald-400">{formatCurrency(report.totalToPartner)}</td>
                  </tr>
                </tbody>
              </table>
            </div>

            <div className="rounded-xl border border-amber-500/15 bg-amber-500/5 p-4">
              <p className="text-[11px] text-muted-foreground/70">
                <strong className="text-amber-400">Observações:</strong> O pagamento deverá ser realizado em até <strong>5 (cinco) dias úteis</strong> a partir da data de emissão deste relatório.
              </p>
            </div>
          </>
        )}

        {!selectedCampaignId && selectedPartnerId && campaignsList && campaignsList.length > 0 && (
          <div className="rounded-2xl border border-border/20 bg-card p-6">
            <div className="flex items-center gap-2 mb-4">
              <Building2 className="w-4 h-4 text-primary" />
              <span className="text-sm font-semibold">Campanhas do Parceiro</span>
            </div>
            <div className="space-y-2">
              {campaignsList.map(c => (
                <button
                  key={c.campaignId}
                  onClick={() => setSelectedCampaignId(c.campaignId)}
                  className="w-full flex items-center justify-between p-3 rounded-xl border border-border/10 bg-white/[0.02] hover:bg-white/[0.04] transition-colors text-left group"
                >
                  <div>
                    <p className="text-sm font-medium">{c.campaignName}</p>
                    <p className="text-[11px] text-muted-foreground">{c.clientName}</p>
                  </div>
                  <div className="flex items-center gap-3">
                    <Badge variant="outline" className="text-[10px]">{c.status}</Badge>
                    <ChevronRight className="w-4 h-4 text-muted-foreground/30 group-hover:text-muted-foreground/60 transition-colors" />
                  </div>
                </button>
              ))}
            </div>
          </div>
        )}

        {selectedPartnerId && campaignsList && campaignsList.length === 0 && (
          <div className="rounded-xl border border-border/20 bg-card p-8 text-center">
            <FileText className="w-10 h-10 text-muted-foreground/20 mx-auto mb-3" />
            <p className="text-sm text-muted-foreground">Nenhuma campanha encontrada para este parceiro.</p>
          </div>
        )}
      </div>
    </PageContainer>
  );
}
