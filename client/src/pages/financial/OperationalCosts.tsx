import PageContainer from "@/components/PageContainer";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { formatCurrency } from "@/lib/format";
import { trpc } from "@/lib/trpc";
import {
  Save, Calculator, BarChart3, Layers, TrendingUp, DollarSign,
  Truck, Factory, Percent, ChevronDown, ChevronUp, Users,
  Receipt, PiggyBank,
} from "lucide-react";
import { useState, useMemo } from "react";
import { toast } from "sonner";

function fmtPct(v: number): string {
  return `${(v ?? 0).toFixed(1).replace(".", ",")}%`;
}

const STATUS_CONFIG: Record<string, { label: string; color: string }> = {
  ativa: { label: "Ativa", color: "bg-emerald-500/10 text-emerald-400 border-emerald-500/30" },
  producao: { label: "Produção", color: "bg-blue-500/10 text-blue-400 border-blue-500/30" },
  entrega: { label: "Entrega", color: "bg-amber-500/10 text-amber-400 border-amber-500/30" },
  finalizada: { label: "Finalizada", color: "bg-gray-500/10 text-gray-400 border-gray-500/30" },
  cancelada: { label: "Cancelada", color: "bg-red-500/10 text-red-400 border-red-500/30" },
};

export default function OperationalCosts() {
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editProduction, setEditProduction] = useState("");
  const [editFreight, setEditFreight] = useState("");
  const [expandedId, setExpandedId] = useState<number | null>(null);

  const utils = trpc.useUtils();
  const { data: costs, isLoading } = trpc.financial.listCosts.useQuery();

  const upsertMutation = trpc.financial.upsertCost.useMutation({
    onSuccess: () => {
      utils.financial.listCosts.invalidate();
      utils.financial.dashboard.invalidate();
      setEditingId(null);
      toast.success("Custos atualizados");
    },
    onError: (err: any) => toast.error(err.message),
  });

  const totals = useMemo(() => {
    if (!costs?.length) return { totalCosts: 0, totalRevenue: 0, totalProduction: 0, totalFreight: 0, totalTax: 0, totalRestComm: 0, totalPartnerComm: 0, avgMargin: 0, totalCoasters: 0, campaignCount: 0 };
    const totalCosts = costs.reduce((s, c) => s + c.totalCosts, 0);
    const totalRevenue = costs.reduce((s, c) => s + c.revenue, 0);
    const totalProduction = costs.reduce((s, c) => s + c.productionTotal, 0);
    const totalFreight = costs.reduce((s, c) => s + c.freightTotal, 0);
    const totalTax = costs.reduce((s, c) => s + c.taxAmount, 0);
    const totalRestComm = costs.reduce((s, c) => s + c.restAmount, 0);
    const totalPartnerComm = costs.reduce((s, c) => s + c.partnerCommission, 0);
    const totalCoasters = costs.reduce((s, c) => s + c.coastersTotal, 0);
    const avgMargin = totalRevenue > 0 ? ((totalRevenue - totalCosts) / totalRevenue) * 100 : 0;
    return { totalCosts, totalRevenue, totalProduction, totalFreight, totalTax, totalRestComm, totalPartnerComm, avgMargin, totalCoasters, campaignCount: costs.length };
  }, [costs]);

  const startEditing = (c: NonNullable<typeof costs>[0]) => {
    setEditingId(c.campaignId);
    setEditProduction(String(c.productionPerMonth));
    setEditFreight(String(c.freightPerMonth));
  };

  const saveEdit = () => {
    if (editingId === null) return;
    upsertMutation.mutate({
      campaignId: editingId,
      productionCost: editProduction || "0",
      freightCost: editFreight || "0",
    });
  };

  return (
    <PageContainer title="Custos Operacionais" description="Visão completa de custos por campanha: produção, frete, impostos, comissões e margem">
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        <div className="rounded-xl border border-border/30 bg-card p-4">
          <div className="flex items-center gap-2 mb-2">
            <div className="p-1.5 rounded-lg bg-primary/10"><DollarSign className="w-3.5 h-3.5 text-primary" /></div>
            <span className="text-[10px] text-muted-foreground uppercase tracking-wider">Receita Total</span>
          </div>
          <p className="text-lg font-bold text-emerald-400">{formatCurrency(totals.totalRevenue)}</p>
        </div>
        <div className="rounded-xl border border-border/30 bg-card p-4">
          <div className="flex items-center gap-2 mb-2">
            <div className="p-1.5 rounded-lg bg-red-500/10"><Calculator className="w-3.5 h-3.5 text-red-500" /></div>
            <span className="text-[10px] text-muted-foreground uppercase tracking-wider">Custos Totais</span>
          </div>
          <p className="text-lg font-bold text-red-400">{formatCurrency(totals.totalCosts)}</p>
        </div>
        <div className="rounded-xl border border-border/30 bg-card p-4">
          <div className="flex items-center gap-2 mb-2">
            <div className="p-1.5 rounded-lg bg-emerald-500/10"><PiggyBank className="w-3.5 h-3.5 text-emerald-500" /></div>
            <span className="text-[10px] text-muted-foreground uppercase tracking-wider">Margem Média</span>
          </div>
          <p className={`text-lg font-bold ${totals.avgMargin >= 0 ? "text-emerald-400" : "text-red-400"}`}>{fmtPct(totals.avgMargin)}</p>
        </div>
        <div className="rounded-xl border border-border/30 bg-card p-4">
          <div className="flex items-center gap-2 mb-2">
            <div className="p-1.5 rounded-lg bg-blue-500/10"><Factory className="w-3.5 h-3.5 text-blue-500" /></div>
            <span className="text-[10px] text-muted-foreground uppercase tracking-wider">Produção</span>
          </div>
          <p className="text-lg font-bold">{formatCurrency(totals.totalProduction)}</p>
        </div>
        <div className="rounded-xl border border-border/30 bg-card p-4">
          <div className="flex items-center gap-2 mb-2">
            <div className="p-1.5 rounded-lg bg-amber-500/10"><Truck className="w-3.5 h-3.5 text-amber-500" /></div>
            <span className="text-[10px] text-muted-foreground uppercase tracking-wider">Frete</span>
          </div>
          <p className="text-lg font-bold">{formatCurrency(totals.totalFreight)}</p>
        </div>
        <div className="rounded-xl border border-border/30 bg-card p-4">
          <div className="flex items-center gap-2 mb-2">
            <div className="p-1.5 rounded-lg bg-purple-500/10"><Users className="w-3.5 h-3.5 text-purple-500" /></div>
            <span className="text-[10px] text-muted-foreground uppercase tracking-wider">Comissões</span>
          </div>
          <p className="text-lg font-bold">{formatCurrency(totals.totalRestComm + totals.totalPartnerComm)}</p>
        </div>
      </div>

      {!isLoading && costs && costs.length > 0 && (
        <div className="rounded-xl border border-border/30 bg-card p-4">
          <div className="flex items-center gap-2 mb-3">
            <Receipt className="w-4 h-4 text-primary" />
            <span className="text-sm font-semibold">Resumo Geral — {totals.campaignCount} campanhas</span>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-sm">
            <div>
              <p className="text-[10px] text-muted-foreground uppercase">Produção Total</p>
              <p className="font-mono font-bold">{formatCurrency(totals.totalProduction)}</p>
            </div>
            <div>
              <p className="text-[10px] text-muted-foreground uppercase">Frete Total</p>
              <p className="font-mono font-bold">{formatCurrency(totals.totalFreight)}</p>
            </div>
            <div>
              <p className="text-[10px] text-muted-foreground uppercase">Impostos Total</p>
              <p className="font-mono font-bold text-orange-400">{formatCurrency(totals.totalTax)}</p>
            </div>
            <div>
              <p className="text-[10px] text-muted-foreground uppercase">Comissões Total</p>
              <p className="font-mono font-bold text-purple-400">{formatCurrency(totals.totalRestComm + totals.totalPartnerComm)}</p>
            </div>
          </div>
        </div>
      )}

      {isLoading ? (
        <div className="flex items-center justify-center h-40">
          <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
        </div>
      ) : !costs?.length ? (
        <div className="flex flex-col items-center justify-center h-40 text-sm text-muted-foreground">
          <p>Nenhuma campanha encontrada</p>
        </div>
      ) : (
        <div className="space-y-2">
          {costs.map((c) => {
            const isExpanded = expandedId === c.campaignId;
            const isEditing = editingId === c.campaignId;
            const statusCfg = STATUS_CONFIG[c.status] || { label: c.status, color: "bg-gray-500/10 text-gray-400 border-gray-500/30" };
            const isBonificada = c.revenue === 0;
            const displayCosts = isBonificada ? c.productionTotal + c.freightTotal + c.restaurantCost : c.totalCosts;

            return (
              <div key={c.campaignId} className={`rounded-xl border bg-card overflow-hidden ${isBonificada ? "border-amber-500/20" : "border-border/30"}`}>
                <div
                  className="flex items-center justify-between p-4 cursor-pointer hover:bg-muted/5 transition-colors"
                  onClick={() => setExpandedId(isExpanded ? null : c.campaignId)}
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="flex flex-col min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-semibold truncate">{c.campaignName}</span>
                        <Badge variant="outline" className={`text-[9px] ${statusCfg.color}`}>{statusCfg.label}</Badge>
                        {isBonificada && <Badge variant="outline" className="text-[9px] bg-amber-500/10 text-amber-400 border-amber-500/30">Bonificada</Badge>}
                      </div>
                      <span className="text-[11px] text-muted-foreground">{c.contractDuration} meses · {c.coastersTotal.toLocaleString("pt-BR")} bolachas · {c.activeRestaurants} rest.</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-4">
                    {!isBonificada && c.revenue > 0 && (
                      <div className="text-right hidden sm:block">
                        <p className="text-[10px] text-muted-foreground">Receita</p>
                        <p className="text-xs font-mono font-semibold text-emerald-400">{formatCurrency(c.revenue)}</p>
                      </div>
                    )}
                    <div className="text-right hidden sm:block">
                      <p className="text-[10px] text-muted-foreground">{isBonificada ? "Custo (bonificação)" : "Custo Total"}</p>
                      <p className="text-xs font-mono font-semibold text-red-400">{formatCurrency(displayCosts)}</p>
                    </div>
                    {!isBonificada && (
                      <div className="text-right hidden sm:block">
                        <p className="text-[10px] text-muted-foreground">Margem</p>
                        <p className={`text-xs font-mono font-bold ${c.marginPct >= 0 ? "text-emerald-400" : "text-red-400"}`}>{fmtPct(c.marginPct)}</p>
                      </div>
                    )}
                    {isExpanded ? <ChevronUp className="w-4 h-4 text-muted-foreground" /> : <ChevronDown className="w-4 h-4 text-muted-foreground" />}
                  </div>
                </div>

                {isExpanded && (
                  <div className="border-t border-border/20 p-4 space-y-4">
                    {isBonificada && (
                      <div className="rounded-lg border border-amber-500/20 bg-amber-500/5 p-3 flex items-start gap-2">
                        <DollarSign className="w-4 h-4 text-amber-400 mt-0.5 shrink-0" />
                        <div>
                          <p className="text-xs font-semibold text-amber-400">Campanha Bonificada</p>
                          <p className="text-[11px] text-muted-foreground">Esta campanha não possui receita — os custos são absorvidos como bonificação.</p>
                        </div>
                      </div>
                    )}

                    <div className={`grid gap-3 ${isBonificada ? "grid-cols-2" : "grid-cols-2 sm:grid-cols-4"}`}>
                      <div className="rounded-lg border p-3">
                        <p className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1">Produção</p>
                        <p className="text-sm font-bold font-mono">{formatCurrency(c.productionTotal)}</p>
                        <p className="text-[10px] text-muted-foreground">{formatCurrency(c.productionPerMonth)}/mês × {c.contractDuration}</p>
                      </div>
                      <div className="rounded-lg border p-3">
                        <p className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1">Frete</p>
                        <p className="text-sm font-bold font-mono">{formatCurrency(c.freightTotal)}</p>
                        <p className="text-[10px] text-muted-foreground">{formatCurrency(c.freightPerMonth)}/mês × {c.contractDuration}</p>
                      </div>
                      {!isBonificada && (
                        <>
                          <div className="rounded-lg border p-3">
                            <p className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1">Impostos ({fmtPct(c.taxRate)})</p>
                            <p className="text-sm font-bold font-mono text-orange-400">{formatCurrency(c.taxAmount)}</p>
                          </div>
                          <div className="rounded-lg border p-3">
                            <p className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1">Com. Restaurante ({fmtPct(c.restRate)})</p>
                            <p className="text-sm font-bold font-mono text-amber-400">{formatCurrency(c.restAmount)}</p>
                          </div>
                        </>
                      )}
                    </div>

                    {!isBonificada && (c.partnerName || c.restaurantCost > 0) && (
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                        {c.partnerName && (
                          <div className="rounded-lg border p-3">
                            <p className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1">Com. Parceiro ({fmtPct(c.partnerPct)})</p>
                            <p className="text-sm font-bold font-mono text-purple-400">{formatCurrency(c.partnerCommission)}</p>
                            <p className="text-[10px] text-muted-foreground">{c.partnerName}</p>
                          </div>
                        )}
                        {c.restaurantCost > 0 && (
                          <div className="rounded-lg border p-3">
                            <p className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1">Remuneração Rest.</p>
                            <p className="text-sm font-bold font-mono text-cyan-400">{formatCurrency(c.restaurantCost)}</p>
                            <p className="text-[10px] text-muted-foreground">Pagamentos registrados</p>
                          </div>
                        )}
                      </div>
                    )}

                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b border-border/30">
                          <th className="text-left py-2 text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">Item</th>
                          <th className="text-right py-2 text-[10px] uppercase tracking-wider text-muted-foreground font-semibold px-3">Mensal</th>
                          <th className="text-right py-2 text-[10px] uppercase tracking-wider text-muted-foreground font-semibold px-3">Total ({c.contractDuration}m)</th>
                        </tr>
                      </thead>
                      <tbody>
                        {!isBonificada && c.revenue > 0 && (
                          <tr className="border-b border-border/10">
                            <td className="py-2 text-emerald-400 font-semibold">Receita Bruta</td>
                            <td className="py-2 text-right px-3 font-mono text-emerald-400">{formatCurrency(c.revenue / c.contractDuration)}</td>
                            <td className="py-2 text-right px-3 font-mono font-semibold text-emerald-400">{formatCurrency(c.revenue)}</td>
                          </tr>
                        )}
                        <tr className="border-b border-border/10">
                          <td className="py-2 pl-3 text-red-400/80">{isBonificada ? "Produção Gráfica" : "(-) Produção Gráfica"}</td>
                          <td className="py-2 text-right px-3 font-mono text-red-400/80">
                            {isEditing ? (
                              <Input type="number" step="0.01" className="w-24 ml-auto text-right h-7 text-xs" value={editProduction} onChange={(e) => setEditProduction(e.target.value)} />
                            ) : formatCurrency(c.productionPerMonth)}
                          </td>
                          <td className="py-2 text-right px-3 font-mono text-red-400/80">{formatCurrency(c.productionTotal)}</td>
                        </tr>
                        <tr className="border-b border-border/10">
                          <td className="py-2 pl-3 text-red-400/80">{isBonificada ? "Frete" : "(-) Frete"}</td>
                          <td className="py-2 text-right px-3 font-mono text-red-400/80">
                            {isEditing ? (
                              <Input type="number" step="0.01" className="w-24 ml-auto text-right h-7 text-xs" value={editFreight} onChange={(e) => setEditFreight(e.target.value)} />
                            ) : formatCurrency(c.freightPerMonth)}
                          </td>
                          <td className="py-2 text-right px-3 font-mono text-red-400/80">{formatCurrency(c.freightTotal)}</td>
                        </tr>
                        {!isBonificada && c.taxAmount > 0 && (
                          <tr className="border-b border-border/10">
                            <td className="py-2 pl-3 text-orange-400/80">(-) Impostos ({fmtPct(c.taxRate)})</td>
                            <td className="py-2 text-right px-3 font-mono text-orange-400/80">{formatCurrency(c.taxAmount / c.contractDuration)}</td>
                            <td className="py-2 text-right px-3 font-mono text-orange-400/80">{formatCurrency(c.taxAmount)}</td>
                          </tr>
                        )}
                        {!isBonificada && c.restAmount > 0 && (
                          <tr className="border-b border-border/10">
                            <td className="py-2 pl-3 text-amber-400/80">(-) Com. Restaurante ({fmtPct(c.restRate)})</td>
                            <td className="py-2 text-right px-3 font-mono text-amber-400/80">{formatCurrency(c.restAmount / c.contractDuration)}</td>
                            <td className="py-2 text-right px-3 font-mono text-amber-400/80">{formatCurrency(c.restAmount)}</td>
                          </tr>
                        )}
                        {!isBonificada && c.partnerCommission > 0 && (
                          <tr className="border-b border-border/10">
                            <td className="py-2 pl-3 text-purple-400/80">(-) Com. Parceiro ({fmtPct(c.partnerPct)})</td>
                            <td className="py-2 text-right px-3 font-mono text-purple-400/80">{formatCurrency(c.partnerCommission / c.contractDuration)}</td>
                            <td className="py-2 text-right px-3 font-mono text-purple-400/80">{formatCurrency(c.partnerCommission)}</td>
                          </tr>
                        )}
                        {c.restaurantCost > 0 && (
                          <tr className="border-b border-border/10">
                            <td className="py-2 pl-3 text-cyan-400/80">{isBonificada ? "Remuneração Rest." : "(-) Remuneração Rest."}</td>
                            <td className="py-2 text-right px-3 font-mono text-cyan-400/80">—</td>
                            <td className="py-2 text-right px-3 font-mono text-cyan-400/80">{formatCurrency(c.restaurantCost)}</td>
                          </tr>
                        )}
                        <tr className={`border-t-2 border-border/30 ${isBonificada ? "bg-amber-500/5" : "bg-muted/5"}`}>
                          <td className={`py-2.5 font-bold ${isBonificada ? "text-amber-400" : ""}`}>{isBonificada ? "Total Bonificação" : "Total Custos"}</td>
                          <td className={`py-2.5 text-right px-3 font-mono font-bold ${isBonificada ? "text-amber-400" : "text-red-400"}`}>{formatCurrency(displayCosts / c.contractDuration)}</td>
                          <td className={`py-2.5 text-right px-3 font-mono font-bold ${isBonificada ? "text-amber-400" : "text-red-400"}`}>{formatCurrency(displayCosts)}</td>
                        </tr>
                        {!isBonificada && c.revenue > 0 && (
                          <tr className={`${c.margin >= 0 ? "bg-emerald-500/5" : "bg-red-500/5"}`}>
                            <td className={`py-2.5 font-bold ${c.margin >= 0 ? "text-emerald-400" : "text-red-400"}`}>= Lucro ({fmtPct(c.marginPct)})</td>
                            <td className={`py-2.5 text-right px-3 font-mono font-bold ${c.margin >= 0 ? "text-emerald-400" : "text-red-400"}`}>{formatCurrency(c.margin / c.contractDuration)}</td>
                            <td className={`py-2.5 text-right px-3 font-mono font-bold ${c.margin >= 0 ? "text-emerald-400" : "text-red-400"}`}>{formatCurrency(c.margin)}</td>
                          </tr>
                        )}
                      </tbody>
                    </table>

                    <div className="flex justify-end gap-2">
                      {isEditing ? (
                        <>
                          <Button variant="ghost" size="sm" className="text-xs" onClick={() => setEditingId(null)}>Cancelar</Button>
                          <Button size="sm" className="text-xs gap-1.5" onClick={saveEdit} disabled={upsertMutation.isPending}>
                            <Save className="w-3 h-3" /> Salvar
                          </Button>
                        </>
                      ) : (
                        <Button variant="outline" size="sm" className="text-xs" onClick={() => startEditing(c)}>Editar Custos</Button>
                      )}
                    </div>
                  </div>
                )}
              </div>
            );
          })}

        </div>
      )}
    </PageContainer>
  );
}
