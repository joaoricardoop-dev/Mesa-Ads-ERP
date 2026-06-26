import { useMemo, useState } from "react";
import { useLocation } from "wouter";
import PageContainer from "@/components/PageContainer";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Building2, UserPlus } from "lucide-react";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import { cyclesForDays, daysInRangeInclusive } from "@shared/period";
import { cn } from "@/lib/utils";
import { InventoryCatalog } from "@/components/media-shop/InventoryCatalog";
import { MediaPlanPanel, useMediaPlan } from "@/components/media-shop/MediaPlanPanel";
import { useMediaShopStore, quantityWeeksForDays } from "@/components/media-shop/mediaShopStore";

type EntityMode = "cliente" | "lead";

export default function MediaBudget() {
  const [, navigate] = useLocation();
  const utils = trpc.useUtils();

  const {
    clientId,
    setClient,
    leadId,
    setLead,
    campaignName,
    startDate,
    endDate,
    isBonificada,
    schedule,
    reset,
  } = useMediaShopStore();
  const selected = useMediaShopStore((s) => s.selected);
  const [entityMode, setEntityMode] = useState<EntityMode>("cliente");

  const { data: clientsData } = trpc.advertiser.list.useQuery();
  const clientsList = useMemo(() => (clientsData?.items ?? []) as any[], [clientsData]);

  const { data: leadsRaw } = trpc.lead.list.useQuery({ type: "anunciante" });
  const leadsList = useMemo(() => (leadsRaw as any[]) ?? [], [leadsRaw]);

  const plan = useMediaPlan();

  const createMutation = trpc.quotation.createFromBuilder.useMutation({
    onSuccess: (res: any) => {
      toast.success(
        res?.quotationNumber
          ? `Cotação ${res.quotationNumber} gerada com sucesso.`
          : "Cotação gerada com sucesso.",
      );
      utils.quotation.list?.invalidate?.();
      reset();
      if (res?.id) navigate(`/comercial/cotacoes/${res.id}`);
      else navigate("/comercial/cotacoes");
    },
    onError: (err) => {
      toast.error(err.message);
    },
  });

  const quantityItems = useMediaShopStore((s) => s.quantityItems);
  const hasItems = selected.length > 0 || quantityItems.length > 0;
  const hasEntity = clientId != null || leadId != null;

  const canConfirm =
    hasEntity && campaignName.trim().length > 0 && hasItems;

  const confirmHint = !hasEntity
    ? "Selecione um cliente ou lead para continuar."
    : campaignName.trim().length === 0
      ? "Defina o nome da campanha."
      : !hasItems
        ? "Adicione ao menos um local ou produto."
        : undefined;

  function handleConfirm() {
    if (!canConfirm || !hasEntity) return;
    const screenItems = plan.items.map((it) => {
      // Período de veiculação por linha: quando definido, dias/ciclos derivam do
      // período próprio (fonte única: daysInRangeInclusive / cyclesForDays);
      // senão herda o período global do plano.
      const lineStart = it.startDate || startDate;
      const lineEnd = it.endDate || endDate;
      const lineDays = it.startDate && it.endDate
        ? Math.max(1, daysInRangeInclusive(it.startDate, it.endDate))
        : plan.days;
      const lineCycles = Math.max(1, cyclesForDays(lineDays));
      return {
        productId: it.productId,
        productName: it.productName,
        volume: Math.max(1, it.screens),
        weeks: Math.max(1, lineCycles * (it.cycleWeeks || 4)),
        restaurantId: it.restaurantId,
        shareIndex: it.shareIndex,
        cycleWeeks: it.cycleWeeks || 4,
        cycles: lineCycles,
        startDate: lineStart,
        endDate: lineEnd,
        days: lineDays,
      };
    });
    // Produtos por quantidade: sem restaurantId (não amarrados a local) — preço
    // por tiers de volume no backend. weeks deriva do período (fonte única).
    // Recorrência: cada linha pode ter período próprio; quando ausente, herda o
    // período global do plano.
    const qtyItems = plan.quantityItems.map((it) => {
      const lineStart = it.startDate || startDate;
      const lineEnd = it.endDate || endDate;
      const lineDays = it.startDate && it.endDate
        ? Math.max(1, daysInRangeInclusive(it.startDate, it.endDate))
        : plan.days;
      return {
        productId: it.productId,
        productName: it.productName,
        volume: Math.max(1, it.quantity),
        weeks: quantityWeeksForDays(lineDays),
        startDate: lineStart,
        endDate: lineEnd,
      };
    });
    const items = [...screenItems, ...qtyItems];

    createMutation.mutate({
      clientId: clientId ?? null,
      leadId: leadId ?? null,
      source: "internal",
      campaignName: campaignName.trim(),
      startDate,
      estimatedTotal: plan.total,
      estimatedImpressions: plan.exibicoes,
      isBonificada,
      schedule: isBonificada ? [] : schedule,
      items,
    });
  }

  return (
    <PageContainer
      title="Orçamento"
      description="Monte um plano de mídia a partir do inventário de telas e gere a cotação."
    >
      <div className="grid gap-6 lg:grid-cols-[1fr_380px]">
        <div className="space-y-4">
          {/* Entidade: Cliente ou Lead (anunciante) */}
          <Card>
            <CardContent className="p-4 space-y-3">
              {/* Toggle Cliente / Lead — escolhe a quem a cotação será amarrada. */}
              <div className="inline-flex rounded-md border border-border p-0.5">
                <button
                  type="button"
                  onClick={() => {
                    setEntityMode("cliente");
                    setLead(null);
                  }}
                  className={cn(
                    "flex items-center gap-1.5 rounded px-3 py-1 text-xs font-medium transition-colors",
                    entityMode === "cliente"
                      ? "bg-primary text-primary-foreground"
                      : "text-muted-foreground hover:text-foreground",
                  )}
                >
                  <Building2 className="h-3.5 w-3.5" /> Cliente
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setEntityMode("lead");
                    setClient(null);
                  }}
                  className={cn(
                    "flex items-center gap-1.5 rounded px-3 py-1 text-xs font-medium transition-colors",
                    entityMode === "lead"
                      ? "bg-primary text-primary-foreground"
                      : "text-muted-foreground hover:text-foreground",
                  )}
                >
                  <UserPlus className="h-3.5 w-3.5" /> Lead
                </button>
              </div>

              <div className="flex flex-col sm:flex-row sm:items-end gap-3">
                <div className="flex-1 space-y-1.5">
                  {entityMode === "cliente" ? (
                    <>
                      <Label className="label-mono text-[11px] flex items-center gap-1">
                        <Building2 className="h-3.5 w-3.5" /> Cliente
                      </Label>
                      <Select
                        value={clientId != null ? String(clientId) : ""}
                        onValueChange={(v) => setClient(v ? Number(v) : null)}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Selecione o anunciante" />
                        </SelectTrigger>
                        <SelectContent>
                          {clientsList.map((c) => (
                            <SelectItem key={c.id} value={String(c.id)}>
                              {c.company || c.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </>
                  ) : (
                    <>
                      <Label className="label-mono text-[11px] flex items-center gap-1">
                        <UserPlus className="h-3.5 w-3.5" /> Lead
                      </Label>
                      <Select
                        value={leadId != null ? String(leadId) : ""}
                        onValueChange={(v) => setLead(v ? Number(v) : null)}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Selecione o lead" />
                        </SelectTrigger>
                        <SelectContent>
                          {leadsList.map((l) => (
                            <SelectItem key={l.id} value={String(l.id)}>
                              {l.company || l.name || l.contactName || `Lead #${l.id}`}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => navigate("/comercial/orcamento-classico")}
                  >
                    Orçamento clássico
                  </Button>
                  {hasItems && (
                    <Badge variant="secondary">{selected.length + quantityItems.length} no plano</Badge>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>

          <InventoryCatalog />
        </div>

        <div className="lg:sticky lg:top-4 lg:self-start">
          <MediaPlanPanel
            onConfirm={handleConfirm}
            isConfirming={createMutation.isPending}
            canConfirm={canConfirm}
            confirmHint={confirmHint}
          />
        </div>
      </div>
    </PageContainer>
  );
}
