import { useState, useMemo } from "react";

import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import PageContainer from "@/components/PageContainer";
import { formatCurrency, formatCompact, formatPercent } from "@/lib/format";
import {
  TrendingUp,
  DollarSign,
  Store,
  Megaphone,
  ChevronDown,
  ChevronRight,
  Calendar,
  BarChart3,
  ArrowUpRight,
  ArrowDownRight,
} from "lucide-react";

const MONTHS = [
  "Janeiro",
  "Fevereiro",
  "Março",
  "Abril",
  "Maio",
  "Junho",
  "Julho",
  "Agosto",
  "Setembro",
  "Outubro",
  "Novembro",
  "Dezembro",
];

export default function Economics() {
  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [expandedCampaigns, setExpandedCampaigns] = useState<Set<number>>(
    new Set()
  );

  const { data, isLoading } = trpc.economics.monthly.useQuery({
    year,
    month,
  });

  const toggleExpand = (id: number) => {
    setExpandedCampaigns((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const years = useMemo(() => {
    const current = now.getFullYear();
    return [current - 1, current, current + 1];
  }, []);

  const rawTotals = data?.totals;
  const totals = {
    revenue: rawTotals?.revenue ?? 0,
    commission: rawTotals?.commission ?? 0,
    production: rawTotals?.production ?? 0,
    profit: rawTotals?.profit ?? 0,
    margin: rawTotals?.margin ?? 0,
    campaignCount: rawTotals?.campaignCount ?? 0,
    restaurantCount: rawTotals?.restaurantCount ?? 0,
  };

  const campaigns = data?.campaigns || [];

  return (
    <PageContainer
      title="Economics"
      description="Visão financeira e indicadores da operação"
      actions={
        <div className="flex items-center gap-2">
          <Select
            value={String(month)}
            onValueChange={(v) => setMonth(parseInt(v))}
          >
            <SelectTrigger className="w-[140px] bg-card border-border/30">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {MONTHS.map((m, i) => (
                <SelectItem key={i + 1} value={String(i + 1)}>
                  {m}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select
            value={String(year)}
            onValueChange={(v) => setYear(parseInt(v))}
          >
            <SelectTrigger className="w-[100px] bg-card border-border/30">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {years.map((y) => (
                <SelectItem key={y} value={String(y)}>
                  {y}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      }
    >

      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-4">
        <div className="bg-card border border-border/30 rounded-lg p-4 col-span-1">
          <div className="flex items-center justify-between mb-2">
            <p className="text-xs text-muted-foreground">Campanhas</p>
            <Megaphone className="w-4 h-4 text-muted-foreground" />
          </div>
          <p className="text-2xl font-bold font-mono">{totals.campaignCount}</p>
        </div>
        <div className="bg-card border border-border/30 rounded-lg p-4 col-span-1">
          <div className="flex items-center justify-between mb-2">
            <p className="text-xs text-muted-foreground">Restaurantes</p>
            <Store className="w-4 h-4 text-muted-foreground" />
          </div>
          <p className="text-2xl font-bold font-mono">
            {totals.restaurantCount}
          </p>
        </div>
        <div className="bg-card border border-primary/30 rounded-lg p-4 col-span-1">
          <div className="flex items-center justify-between mb-2">
            <p className="text-xs text-muted-foreground">Faturamento</p>
            <DollarSign className="w-4 h-4 text-primary" />
          </div>
          <p className="text-xl font-bold font-mono text-primary">
            {formatCompact(totals.revenue)}
          </p>
        </div>
        <div className="bg-card border border-border/30 rounded-lg p-4 col-span-1">
          <div className="flex items-center justify-between mb-2">
            <p className="text-xs text-muted-foreground">Comissão Rest.</p>
            <ArrowDownRight className="w-4 h-4 text-orange-400" />
          </div>
          <p className="text-xl font-bold font-mono text-orange-400">
            {formatCompact(totals.commission)}
          </p>
        </div>
        <div className="bg-card border border-border/30 rounded-lg p-4 col-span-1">
          <div className="flex items-center justify-between mb-2">
            <p className="text-xs text-muted-foreground">Produção</p>
            <ArrowDownRight className="w-4 h-4 text-muted-foreground" />
          </div>
          <p className="text-xl font-bold font-mono">
            {formatCompact(totals.production)}
          </p>
        </div>
        <div className="bg-card border border-primary/30 rounded-lg p-4 col-span-1">
          <div className="flex items-center justify-between mb-2">
            <p className="text-xs text-muted-foreground">Lucro Mesa Ads</p>
            <TrendingUp className="w-4 h-4 text-primary" />
          </div>
          <p className="text-xl font-bold font-mono text-primary">
            {formatCompact(totals.profit)}
          </p>
        </div>
        <div className="bg-card border border-border/30 rounded-lg p-4 col-span-1">
          <div className="flex items-center justify-between mb-2">
            <p className="text-xs text-muted-foreground">Margem</p>
            <ArrowUpRight className="w-4 h-4 text-primary" />
          </div>
          <p
            className={`text-xl font-bold font-mono ${
              totals.margin >= 40
                ? "text-primary"
                : totals.margin >= 20
                ? "text-yellow-400"
                : "text-destructive"
            }`}
          >
            {formatPercent(totals.margin)}
          </p>
        </div>
      </div>

      {/* Campaigns Breakdown */}
      <div className="bg-card border border-border/30 rounded-lg overflow-hidden">
        <div className="p-4 border-b border-border/30">
          <h2 className="text-sm font-semibold flex items-center gap-2">
            <Calendar className="w-4 h-4 text-primary" />
            Campanhas em {MONTHS[month - 1]} {year}
          </h2>
        </div>

        {isLoading ? (
          <div className="p-8 text-center text-muted-foreground">
            Carregando dados...
          </div>
        ) : campaigns.length === 0 ? (
          <div className="p-8 text-center text-muted-foreground">
            Nenhuma campanha ativa neste período. Crie campanhas na aba
            "Campanhas" e defina datas que incluam este mês.
          </div>
        ) : (
          <div className="divide-y divide-border/20">
            {campaigns.map((campaign) => (
              <Collapsible
                key={campaign.id}
                open={expandedCampaigns.has(campaign.id)}
                onOpenChange={() => toggleExpand(campaign.id)}
              >
                <CollapsibleTrigger asChild>
                  <div className="flex items-center gap-4 p-4 hover:bg-card/80 cursor-pointer transition-colors">
                    <div className="flex items-center gap-2">
                      {expandedCampaigns.has(campaign.id) ? (
                        <ChevronDown className="w-4 h-4 text-muted-foreground" />
                      ) : (
                        <ChevronRight className="w-4 h-4 text-muted-foreground" />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="font-medium text-sm truncate">
                          {campaign.name}
                        </p>
                        <Badge
                          variant="outline"
                          className="text-[10px] border-border/40"
                        >
                          {campaign.clientName}
                        </Badge>
                      </div>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {campaign.daysInMonth} dias · {campaign.restaurantCount} restaurante(s)
                      </p>
                    </div>
                    <div className="hidden sm:flex items-center gap-6 text-sm">
                      <div className="text-right">
                        <p className="text-xs text-muted-foreground">
                          Faturamento
                        </p>
                        <p className="font-mono font-medium">
                          {formatCurrency(campaign.revenue)}
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="text-xs text-muted-foreground">
                          Lucro Mesa Ads
                        </p>
                        <p className="font-mono font-medium text-primary">
                          {formatCurrency(campaign.profit)}
                        </p>
                      </div>
                      <div className="text-right w-16">
                        <p className="text-xs text-muted-foreground">Margem</p>
                        <p
                          className={`font-mono font-medium ${
                            campaign.margin >= 40
                              ? "text-primary"
                              : campaign.margin >= 20
                              ? "text-yellow-400"
                              : "text-destructive"
                          }`}
                        >
                          {formatPercent(campaign.margin)}
                        </p>
                      </div>
                    </div>
                  </div>
                </CollapsibleTrigger>

                <CollapsibleContent>
                  <div className="px-4 pb-4 pl-10">
                    {/* Summary for mobile */}
                    <div className="sm:hidden grid grid-cols-3 gap-3 mb-4">
                      <div className="bg-background/50 rounded p-2">
                        <p className="text-[10px] text-muted-foreground">
                          Faturamento
                        </p>
                        <p className="font-mono text-sm font-medium">
                          {formatCurrency(campaign.revenue)}
                        </p>
                      </div>
                      <div className="bg-background/50 rounded p-2">
                        <p className="text-[10px] text-muted-foreground">
                          Lucro
                        </p>
                        <p className="font-mono text-sm font-medium text-primary">
                          {formatCurrency(campaign.profit)}
                        </p>
                      </div>
                      <div className="bg-background/50 rounded p-2">
                        <p className="text-[10px] text-muted-foreground">
                          Margem
                        </p>
                        <p className="font-mono text-sm font-medium">
                          {formatPercent(campaign.margin)}
                        </p>
                      </div>
                    </div>

                    {/* Campaign totals */}
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
                      <div className="bg-background/50 rounded-lg p-3">
                        <p className="text-[10px] text-muted-foreground">
                          Faturamento Total
                        </p>
                        <p className="font-mono text-sm font-bold">
                          {formatCurrency(campaign.revenue)}
                        </p>
                      </div>
                      <div className="bg-background/50 rounded-lg p-3">
                        <p className="text-[10px] text-muted-foreground">
                          Comissão Restaurantes
                        </p>
                        <p className="font-mono text-sm font-bold text-orange-400">
                          {formatCurrency(campaign.commission)}
                        </p>
                      </div>
                      <div className="bg-background/50 rounded-lg p-3">
                        <p className="text-[10px] text-muted-foreground">
                          Custo Produção
                        </p>
                        <p className="font-mono text-sm font-bold">
                          {formatCurrency(campaign.production)}
                        </p>
                      </div>
                      <div className="bg-background/50 rounded-lg p-3">
                        <p className="text-[10px] text-muted-foreground">
                          Lucro Mesa Ads
                        </p>
                        <p className="font-mono text-sm font-bold text-primary">
                          {formatCurrency(campaign.profit)}
                        </p>
                      </div>
                    </div>

                    {/* Restaurant breakdown table */}
                    {campaign.restaurants.length > 0 && (
                      <div className="border border-border/20 rounded-lg overflow-hidden">
                        <Table>
                          <TableHeader>
                            <TableRow className="border-border/20 hover:bg-transparent">
                              <TableHead className="text-[10px] text-muted-foreground font-medium">
                                RESTAURANTE
                              </TableHead>
                              <TableHead className="text-[10px] text-muted-foreground font-medium text-right">
                                COASTERS
                              </TableHead>
                              <TableHead className="text-[10px] text-muted-foreground font-medium text-right hidden md:table-cell">
                                IMPRESSÕES
                              </TableHead>
                              <TableHead className="text-[10px] text-muted-foreground font-medium text-right">
                                FATURAMENTO
                              </TableHead>
                              <TableHead className="text-[10px] text-muted-foreground font-medium text-right hidden md:table-cell">
                                COMISSÃO
                              </TableHead>
                              <TableHead className="text-[10px] text-muted-foreground font-medium text-right">
                                LUCRO
                              </TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {campaign.restaurants.map((r) => (
                              <TableRow
                                key={r.restaurantId}
                                className="border-border/10"
                              >
                                <TableCell className="text-sm">
                                  {r.restaurantName}
                                </TableCell>
                                <TableCell className="text-right font-mono text-xs">
                                  {r.coastersCount.toLocaleString("pt-BR")}
                                </TableCell>
                                <TableCell className="text-right font-mono text-xs hidden md:table-cell">
                                  {r.impressions.toLocaleString("pt-BR")}
                                </TableCell>
                                <TableCell className="text-right font-mono text-xs">
                                  {formatCurrency(r.revenue)}
                                </TableCell>
                                <TableCell className="text-right font-mono text-xs text-orange-400 hidden md:table-cell">
                                  {formatCurrency(r.commission)} (
                                  {r.commissionPercent}%)
                                </TableCell>
                                <TableCell className="text-right font-mono text-xs text-primary">
                                  {formatCurrency(r.profit)}
                                </TableCell>
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                      </div>
                    )}
                  </div>
                </CollapsibleContent>
              </Collapsible>
            ))}
          </div>
        )}
      </div>

      {/* Bottom summary bar */}
      {campaigns.length > 0 && (
        <div className="bg-card border border-primary/30 rounded-lg p-4">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-center gap-2">
              <TrendingUp className="w-5 h-5 text-primary" />
              <span className="text-sm font-semibold">
                Resumo {MONTHS[month - 1]} {year}
              </span>
            </div>
            <div className="flex flex-wrap items-center gap-6 text-sm">
              <div>
                <span className="text-muted-foreground">Faturamento: </span>
                <span className="font-mono font-bold">
                  {formatCurrency(totals.revenue)}
                </span>
              </div>
              <div>
                <span className="text-muted-foreground">Comissões: </span>
                <span className="font-mono font-bold text-orange-400">
                  -{formatCurrency(totals.commission)}
                </span>
              </div>
              <div>
                <span className="text-muted-foreground">Produção: </span>
                <span className="font-mono font-bold">
                  -{formatCurrency(totals.production)}
                </span>
              </div>
              <div>
                <span className="text-muted-foreground">
                  Lucro Mesa Ads:{" "}
                </span>
                <span className="font-mono font-bold text-primary">
                  {formatCurrency(totals.profit)}
                </span>
              </div>
              <div>
                <span className="text-muted-foreground">Margem: </span>
                <span
                  className={`font-mono font-bold ${
                    totals.margin >= 40
                      ? "text-primary"
                      : totals.margin >= 20
                      ? "text-yellow-400"
                      : "text-destructive"
                  }`}
                >
                  {formatPercent(totals.margin)}
                </span>
              </div>
            </div>
          </div>
        </div>
      )}
    </PageContainer>
  );
}
