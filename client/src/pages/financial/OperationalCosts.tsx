import PageContainer from "@/components/PageContainer";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { formatCurrency } from "@/lib/format";
import { trpc } from "@/lib/trpc";
import { Save, Calculator, BarChart3, Layers } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

export default function OperationalCosts() {
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editProduction, setEditProduction] = useState("");
  const [editFreight, setEditFreight] = useState("");

  const utils = trpc.useUtils();
  const { data: costs, isLoading } = trpc.financial.listCosts.useQuery();

  const upsertMutation = trpc.financial.upsertCost.useMutation({
    onSuccess: () => {
      utils.financial.listCosts.invalidate();
      utils.financial.dashboard.invalidate();
      setEditingId(null);
      toast.success("Custos atualizados");
    },
    onError: (err) => toast.error(err.message),
  });

  const totalCosts = costs?.reduce((sum, c) => sum + c.total, 0) || 0;
  const avgPerCampaign = costs?.length ? totalCosts / costs.length : 0;
  const totalCoasters = costs?.reduce((sum, c) => sum + c.coastersTotal, 0) || 1;
  const avgPerCoaster = totalCosts / totalCoasters;

  const startEditing = (c: NonNullable<typeof costs>[0]) => {
    setEditingId(c.campaignId);
    setEditProduction(String(c.production));
    setEditFreight(String(c.freight));
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
    <PageContainer title="Custos Operacionais" description="Custos de produção, frete e remuneração por campanha">
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="rounded-xl border border-border/30 bg-card p-4">
          <div className="flex items-center gap-2 mb-2">
            <div className="p-2 rounded-lg bg-primary/10">
              <Calculator className="w-4 h-4 text-primary" />
            </div>
            <span className="text-xs text-muted-foreground">Custo Total do Período</span>
          </div>
          <p className="text-xl font-bold">{formatCurrency(totalCosts)}</p>
        </div>
        <div className="rounded-xl border border-border/30 bg-card p-4">
          <div className="flex items-center gap-2 mb-2">
            <div className="p-2 rounded-lg bg-blue-500/10">
              <BarChart3 className="w-4 h-4 text-blue-500" />
            </div>
            <span className="text-xs text-muted-foreground">Custo Médio / Campanha</span>
          </div>
          <p className="text-xl font-bold">{formatCurrency(avgPerCampaign)}</p>
        </div>
        <div className="rounded-xl border border-border/30 bg-card p-4">
          <div className="flex items-center gap-2 mb-2">
            <div className="p-2 rounded-lg bg-amber-500/10">
              <Layers className="w-4 h-4 text-amber-500" />
            </div>
            <span className="text-xs text-muted-foreground">Custo Médio / Coaster</span>
          </div>
          <p className="text-xl font-bold">{formatCurrency(avgPerCoaster)}</p>
        </div>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center h-40">
          <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
        </div>
      ) : !costs?.length ? (
        <div className="flex flex-col items-center justify-center h-40 text-sm text-muted-foreground">
          <p>Nenhuma campanha encontrada</p>
        </div>
      ) : (
        <div className="rounded-xl border border-border/30 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm min-w-[600px]">
              <thead>
                <tr className="border-b border-border/20 bg-muted/5">
                  <th className="text-left px-4 py-3 font-medium text-muted-foreground">Campanha</th>
                  <th className="text-right px-4 py-3 font-medium text-muted-foreground">Produção Gráfica</th>
                  <th className="text-right px-4 py-3 font-medium text-muted-foreground">Frete</th>
                  <th className="text-right px-4 py-3 font-medium text-muted-foreground">Remuneração Rest.</th>
                  <th className="text-right px-4 py-3 font-medium text-muted-foreground">Total</th>
                  <th className="text-right px-4 py-3 font-medium text-muted-foreground">Ações</th>
                </tr>
              </thead>
              <tbody>
                {costs.map((c) => (
                  <tr key={c.campaignId} className="border-b border-border/10 hover:bg-muted/5 transition-colors">
                    <td className="px-4 py-3 font-medium">{c.campaignName}</td>
                    <td className="px-4 py-3 text-right">
                      {editingId === c.campaignId ? (
                        <Input
                          type="number"
                          step="0.01"
                          className="w-20 sm:w-28 ml-auto text-right h-8"
                          value={editProduction}
                          onChange={(e) => setEditProduction(e.target.value)}
                        />
                      ) : (
                        formatCurrency(c.production)
                      )}
                    </td>
                    <td className="px-4 py-3 text-right">
                      {editingId === c.campaignId ? (
                        <Input
                          type="number"
                          step="0.01"
                          className="w-20 sm:w-28 ml-auto text-right h-8"
                          value={editFreight}
                          onChange={(e) => setEditFreight(e.target.value)}
                        />
                      ) : (
                        formatCurrency(c.freight)
                      )}
                    </td>
                    <td className="px-4 py-3 text-right text-muted-foreground">
                      {formatCurrency(c.restaurantCost)}
                    </td>
                    <td className="px-4 py-3 text-right font-bold">{formatCurrency(c.total)}</td>
                    <td className="px-4 py-3 text-right">
                      {editingId === c.campaignId ? (
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7 text-emerald-500"
                          onClick={saveEdit}
                          disabled={upsertMutation.isPending}
                        >
                          <Save className="w-3.5 h-3.5" />
                        </Button>
                      ) : (
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-7 text-xs"
                          onClick={() => startEditing(c)}
                        >
                          Editar
                        </Button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </PageContainer>
  );
}
