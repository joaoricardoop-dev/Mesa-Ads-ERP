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
import { LOGO_WHITE_BASE64 } from "@/lib/pdf-assets";

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
    if (!report) return;
    const printWindow = window.open("", "_blank");
    if (!printWindow) return;
    const r = report;
    const today = new Date().toLocaleDateString("pt-BR");

    printWindow.document.write(`
      <html>
      <head>
        <title>Relatório de Comissão - ${r.partnerName || ""}</title>
        <style>
          * { margin: 0; padding: 0; box-sizing: border-box; }
          body { font-family: 'Segoe UI', system-ui, sans-serif; color: #1a1a1a; font-size: 13px; }

          .top-bar { background: #111; padding: 24px 48px; display: flex; align-items: center; justify-content: space-between; }
          .top-bar img { height: 28px; }
          .top-bar .doc-type { color: #fff; font-size: 11px; text-transform: uppercase; letter-spacing: 2px; opacity: 0.6; }
          .green-line { height: 3px; background: #22c55e; }

          .content { padding: 48px; }

          .info-row { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 40px; }
          .info-left h1 { font-size: 20px; font-weight: 700; color: #111; margin-bottom: 6px; }
          .info-left p { font-size: 12px; color: #777; line-height: 1.7; }
          .info-right { text-align: right; }
          .info-right .label { font-size: 10px; color: #999; text-transform: uppercase; letter-spacing: 1px; margin-bottom: 4px; }
          .info-right .value { font-size: 24px; font-weight: 800; color: #16a34a; font-family: 'SF Mono', monospace; }

          table { width: 100%; border-collapse: collapse; margin-bottom: 40px; }
          thead th { text-align: left; padding: 10px 16px; border-bottom: 2px solid #e5e7eb; font-size: 10px; text-transform: uppercase; color: #999; letter-spacing: 1px; font-weight: 600; }
          thead th:last-child { text-align: right; }
          tbody td { padding: 12px 16px; border-bottom: 1px solid #f3f4f6; font-size: 13px; }
          tbody td:last-child { text-align: right; font-family: 'SF Mono', monospace; font-size: 12px; }

          .row-deduction td { color: #dc2626; padding-left: 32px; }
          .row-subtotal { background: #f9fafb; }
          .row-subtotal td { font-weight: 600; font-size: 12px; }
          .row-base { background: #eff6ff; }
          .row-base td { font-weight: 700; color: #2563eb; }
          .row-commission td { color: #7c3aed; padding-left: 32px; }
          .row-total { background: #f0fdf4; border-top: 2px solid #22c55e; }
          .row-total td { font-weight: 800; color: #16a34a; font-size: 14px; padding: 16px; }

          .footer { border-top: 1px solid #e5e7eb; padding: 24px 48px; }
          .footer p { font-size: 11px; color: #999; line-height: 1.6; }
          .footer strong { color: #555; }

          @media print {
            body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
            .top-bar { -webkit-print-color-adjust: exact; }
          }
        </style>
      </head>
      <body>
        <div class="top-bar">
          <img src="${LOGO_WHITE_BASE64}" alt="mesa.ads" />
          <span class="doc-type">Relatório de Comissão</span>
        </div>
        <div class="green-line"></div>

        <div class="content">
          <div class="info-row">
            <div class="info-left">
              <h1>Repasse ao Parceiro</h1>
              <p>
                Parceiro: <strong style="color:#111">${r.partnerName}</strong><br/>
                Campanha: <strong style="color:#111">${r.campaignName}</strong><br/>
                Cliente: <strong style="color:#111">${r.clientName}</strong><br/>
                Duração do contrato: <strong style="color:#111">${r.contractDuration} meses</strong><br/>
                Data de emissão: <strong style="color:#111">${today}</strong>
              </p>
            </div>
            <div class="info-right">
              <div class="label">Total a Repassar</div>
              <div class="value">${formatCurrency(r.totalToPartner)}</div>
            </div>
          </div>

          <table>
            <thead>
              <tr>
                <th>Descrição</th>
                <th>Valor (R$)</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td style="font-weight:700; color:#16a34a">Receita Bruta (${r.contractDuration}m)</td>
                <td style="font-weight:700; color:#16a34a">${formatCurrency(r.grossValue)}</td>
              </tr>
              <tr class="row-deduction">
                <td>(-) Impostos (${fmtPct(r.taxRate)} da receita)</td>
                <td>${formatCurrency(r.taxDeduction)}</td>
              </tr>
              <tr class="row-subtotal">
                <td>= Base após Impostos</td>
                <td>${formatCurrency(r.afterTax)}</td>
              </tr>
              <tr class="row-deduction">
                <td>(-) Comissão Restaurante (${fmtPct(r.restaurantRate)} da base pós-impostos)</td>
                <td>${formatCurrency(r.restaurantDeduction)}</td>
              </tr>
              <tr class="row-subtotal">
                <td>= Base após Comissões</td>
                <td>${formatCurrency(r.afterRestaurant)}</td>
              </tr>
              <tr class="row-deduction">
                <td>(-) Custo Produção (${r.contractDuration}m)</td>
                <td>${formatCurrency(r.productionCost)}</td>
              </tr>
              ${r.freightCost > 0 ? `
              <tr class="row-deduction">
                <td>(-) Custo Frete (${r.contractDuration}m)</td>
                <td>${formatCurrency(r.freightCost)}</td>
              </tr>` : ""}
              <tr class="row-base">
                <td>= Base Comissão Parceiro</td>
                <td>${formatCurrency(r.commissionBase)}</td>
              </tr>
              <tr class="row-commission">
                <td>Comissão ${r.partnerName} (${fmtPct(r.partnerCommissionPercent)} da base)</td>
                <td style="color:#7c3aed; font-weight:600">${formatCurrency(r.commissionValue)}</td>
              </tr>
              <tr class="row-total">
                <td>TOTAL A REPASSAR AO PARCEIRO</td>
                <td>${formatCurrency(r.totalToPartner)}</td>
              </tr>
            </tbody>
          </table>
          ${r.monthlyInstallments && r.monthlyInstallments.length > 1 ? `
          <div style="margin-bottom: 40px;">
            <h2 style="font-size: 14px; font-weight: 700; color: #111; margin-bottom: 16px;">Cronograma de Pagamento <span style="font-size: 11px; color: #999; font-weight: 400;">(${r.monthlyInstallments.length} parcelas)</span></h2>
            <table>
              <thead>
                <tr>
                  <th>Mês</th>
                  <th style="text-align: right;">Receita (R$)</th>
                  <th style="text-align: right;">Comissão (R$)</th>
                </tr>
              </thead>
              <tbody>
                ${r.monthlyInstallments.map((inst: { month: string; revenue: number; commission: number }, idx: number) => `
                <tr>
                  <td style="text-transform: capitalize;">${inst.month}</td>
                  <td style="text-align: right; font-family: 'SF Mono', monospace; font-size: 12px; color: #555;">${formatCurrency(inst.revenue)}</td>
                  <td style="text-align: right; font-family: 'SF Mono', monospace; font-size: 12px; color: #7c3aed; font-weight: 600;">${formatCurrency(inst.commission)}</td>
                </tr>`).join("")}
                <tr class="row-total">
                  <td>Total</td>
                  <td style="text-align: right;">${formatCurrency(r.grossValue)}</td>
                  <td style="text-align: right;">${formatCurrency(r.totalToPartner)}</td>
                </tr>
              </tbody>
            </table>
          </div>
          ` : ""}
        </div>

        <div class="footer">
          <p><strong>Observações:</strong> O pagamento deverá ser realizado em até <strong>5 (cinco) dias úteis</strong> a partir da data de emissão deste relatório.</p>
          <p style="margin-top:8px">Documento gerado automaticamente por <strong>mesa.ads</strong> em ${today}.</p>
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

            {report.monthlyInstallments && report.monthlyInstallments.length > 1 && (
              <div className="rounded-2xl border border-border/20 bg-card p-6">
                <div className="flex items-center gap-2 mb-4">
                  <FileText className="w-4 h-4 text-primary" />
                  <span className="text-sm font-semibold">Cronograma de Pagamento</span>
                  <span className="text-[10px] text-muted-foreground ml-1">({report.monthlyInstallments.length} parcelas)</span>
                </div>
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border/30">
                      <th className="text-left py-2 text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">Mês</th>
                      <th className="text-right py-2 text-[10px] uppercase tracking-wider text-muted-foreground font-semibold px-3">Receita</th>
                      <th className="text-right py-2 text-[10px] uppercase tracking-wider text-muted-foreground font-semibold px-3">Comissão ({fmtPct(report.partnerCommissionPercent)})</th>
                    </tr>
                  </thead>
                  <tbody>
                    {report.monthlyInstallments.map((inst: { month: string; revenue: number; commission: number }, idx: number) => (
                      <tr key={idx} className="border-b border-border/10">
                        <td className="py-2 capitalize">{inst.month}</td>
                        <td className="py-2 text-right px-3 font-mono text-muted-foreground">{formatCurrency(inst.revenue)}</td>
                        <td className="py-2 text-right px-3 font-mono font-semibold text-purple-400">{formatCurrency(inst.commission)}</td>
                      </tr>
                    ))}
                    <tr className="border-t-2 border-emerald-500/30 bg-emerald-500/5">
                      <td className="py-2.5 font-bold text-emerald-400">Total</td>
                      <td className="py-2.5 text-right px-3 font-mono font-bold text-emerald-400">{formatCurrency(report.grossValue)}</td>
                      <td className="py-2.5 text-right px-3 font-mono font-bold text-emerald-400">{formatCurrency(report.totalToPartner)}</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            )}

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
