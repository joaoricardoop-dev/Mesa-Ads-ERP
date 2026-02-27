import PageContainer from "@/components/PageContainer";
import Section from "@/components/Section";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { formatCurrency, formatPercent } from "@/lib/format";
import { trpc } from "@/lib/trpc";
import { FileText, Users, UtensilsCrossed, TrendingUp, Download } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

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

  return (
    <PageContainer title="Relatório Financeiro" description="Relatório consolidado por período">
      <div className="flex items-end gap-4 flex-wrap">
        <div>
          <Label className="text-xs text-muted-foreground">Data Início</Label>
          <Input
            type="date"
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
            className="w-40"
          />
        </div>
        <div>
          <Label className="text-xs text-muted-foreground">Data Fim</Label>
          <Input
            type="date"
            value={endDate}
            onChange={(e) => setEndDate(e.target.value)}
            className="w-40"
          />
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            className="gap-1.5"
            onClick={() => toast.info("Exportação em desenvolvimento")}
          >
            <Download className="w-3.5 h-3.5" />
            PDF
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="gap-1.5"
            onClick={() => toast.info("Exportação em desenvolvimento")}
          >
            <Download className="w-3.5 h-3.5" />
            XLSX
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
                    </tr>
                  </thead>
                  <tbody>
                    {data.byCampaign.map((c, i) => (
                      <tr key={i} className="border-b border-border/10">
                        <td className="px-3 py-2">{c.name}</td>
                        <td className="px-3 py-2 text-right">{formatCurrency(c.revenue)}</td>
                        <td className="px-3 py-2 text-right">{formatCurrency(c.costs)}</td>
                        <td className={`px-3 py-2 text-right font-medium ${c.margin >= 0 ? "text-emerald-500" : "text-red-500"}`}>
                          {formatCurrency(c.margin)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
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
                    </tr>
                  </thead>
                  <tbody>
                    {data.byClient.map((c, i) => (
                      <tr key={i} className="border-b border-border/10">
                        <td className="px-3 py-2">{c.name}</td>
                        <td className="px-3 py-2 text-right font-medium">{formatCurrency(c.revenue)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Section>

          <Section title="Por Restaurante" icon={UtensilsCrossed}>
            {data.byRestaurant.length === 0 ? (
              <p className="text-sm text-muted-foreground">Nenhum pagamento a restaurante no período</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border/20">
                      <th className="text-left px-3 py-2 font-medium text-muted-foreground">Restaurante</th>
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
    </PageContainer>
  );
}
