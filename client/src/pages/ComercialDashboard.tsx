import { useState } from "react";
import { Link } from "wouter";
import PageContainer from "@/components/PageContainer";
import Section from "@/components/Section";
import { trpc } from "@/lib/trpc";
import { formatCurrency } from "@/lib/format";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell,
} from "recharts";
import { chartColors, chartTooltipStyle, chartAxisTick } from "@/lib/chart-theme";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Users, FileText, Trophy, XCircle, Clock, TrendingUp, Filter, AlertTriangle,
  Handshake, ExternalLink, ChevronRight, ArrowUp, ArrowDown, ArrowUpDown,
} from "lucide-react";
import {
  QUOTATION_AGE_WARNING_DAYS,
  QUOTATION_AGE_DANGER_DAYS,
  ageRiskLevel,
} from "@shared/commercial-config";
import MetricCard from "@/components/MetricCard";

type PeriodDays = 30 | 90 | 180;

function fmtDays(v: number | null | undefined): string {
  if (v == null || !isFinite(v)) return "—";
  return `${v.toFixed(1)} d`;
}

function fmtPct(v: number | null | undefined): string {
  if (v == null || !isFinite(v)) return "—";
  return `${(v * 100).toFixed(1)}%`;
}

function KpiCard({ label, value, sub, icon: Icon, accent = "default" }: {
  label: string;
  value: string;
  sub?: string;
  icon?: any;
  accent?: "default" | "success" | "danger" | "warning";
}) {
  const toneMap = { default: "default", success: "positive", danger: "negative", warning: "warning" } as const;
  return (
    <MetricCard
      label={label}
      value={value}
      sub={sub}
      icon={Icon}
      tone={toneMap[accent]}
    />
  );
}

function PeriodSelect({ value, onChange }: { value: PeriodDays; onChange: (v: PeriodDays) => void }) {
  return (
    <Select value={String(value)} onValueChange={(v) => onChange(Number(v) as PeriodDays)}>
      <SelectTrigger className="w-[180px] h-9">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="30">Últimos 30 dias</SelectItem>
        <SelectItem value="90">Últimos 90 dias</SelectItem>
        <SelectItem value="180">Últimos 180 dias</SelectItem>
      </SelectContent>
    </Select>
  );
}

function ErrorState({ error }: { error: { message: string } }) {
  return (
    <div className="rounded-xl border border-red-500/30 bg-red-500/5 p-4 text-sm text-red-300">
      <div className="flex items-center gap-2 mb-1 font-medium">
        <AlertTriangle className="w-4 h-4" /> Falha ao carregar dados
      </div>
      <p className="text-xs text-red-300/80">{error.message}</p>
    </div>
  );
}

function LoadingState() {
  return <div className="text-sm text-muted-foreground">Carregando…</div>;
}

function FunnelTab({ days }: { days: PeriodDays }) {
  const { data, isLoading, error } = trpc.comercialDashboard.funnel.useQuery({ days });
  if (error) return <ErrorState error={error} />;
  if (isLoading || !data) return <LoadingState />;
  const c = data.counts;
  const v = data.values;
  const a = data.avgDays;
  const conv = data.conversion;

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
        <KpiCard label="Leads" value={String(c.leads)} icon={Users} />
        <KpiCard label="Cotações enviadas" value={String(c.quotationsSent)} icon={FileText} />
        <KpiCard label="Win" value={String(c.win)} sub={formatCurrency(v.win)} icon={Trophy} accent="success" />
        <KpiCard label="Perdidas" value={String(c.lost)} sub={formatCurrency(v.lost)} icon={XCircle} accent="danger" />
        <KpiCard label="Expiradas" value={String(c.expired)} sub={formatCurrency(v.expired)} icon={Clock} accent="warning" />
        <KpiCard label="Total fechadas" value={String(c.closed)} icon={TrendingUp} />
      </div>

      <Section title="Taxas de conversão" icon={Filter}>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <KpiCard label="Lead → Cotação enviada" value={fmtPct(conv.leadToQuotation)} sub={`${c.quotationsSent} de ${c.leads}`} />
          <KpiCard label="Cotação enviada → Win" value={fmtPct(conv.quotationToWin)} sub={`${c.win} de ${c.quotationsSent}`} />
          <KpiCard label="Win rate (fechadas)" value={fmtPct(conv.closedWinRate)} sub={`${c.win} de ${c.closed}`} />
        </div>
      </Section>

      <Section title="Tempo médio por etapa" icon={Clock}>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <KpiCard label="Lead → 1ª Cotação" value={fmtDays(a.leadToQuotation)} />
          <KpiCard label="Cotação → Win" value={fmtDays(a.quotationToWin)} />
          <KpiCard label="Cotação → Perdida" value={fmtDays(a.quotationToLost)} />
          <KpiCard label="Cotação → Expirada" value={fmtDays(a.quotationToExpired)} />
        </div>
      </Section>
    </div>
  );
}

function LossReasonsTab({ days }: { days: PeriodDays }) {
  const { data, isLoading, error } = trpc.comercialDashboard.lossReasons.useQuery({ days });
  if (error) return <ErrorState error={error} />;
  if (isLoading || !data) return <LoadingState />;
  const chartData = data.items.map((i) => ({
    name: i.label,
    Quantidade: i.count,
    Valor: i.lostValue,
  }));

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <KpiCard label="Total perdidas/expiradas" value={String(data.totalCount)} icon={XCircle} accent="danger" />
        <KpiCard label="Valor total perdido" value={formatCurrency(data.totalValue)} icon={AlertTriangle} accent="danger" />
      </div>

      <Section title="Ranking de motivos de perda">
        {data.items.length === 0 ? (
          <p className="text-sm text-muted-foreground py-6 text-center">Nenhuma cotação perdida ou expirada no período.</p>
        ) : (
          <>
            <div className="h-72 mb-6">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartData} layout="vertical" margin={{ left: 60, right: 16, top: 8, bottom: 8 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke={chartColors.grid} horizontal={false} />
                  <XAxis type="number" tick={chartAxisTick} stroke={chartColors.axis} />
                  <YAxis type="category" dataKey="name" tick={chartAxisTick} stroke={chartColors.axis} width={150} />
                  <Tooltip
                    contentStyle={chartTooltipStyle}
                    cursor={{ fill: "var(--muted)", opacity: 0.4 }}
                    formatter={(value: any, name: string) => name === "Valor" ? formatCurrency(Number(value)) : value}
                  />
                  <Bar dataKey="Valor" fill={chartColors.negative} radius={[0, 6, 6, 0]}>
                    {chartData.map((_, i) => (
                      <Cell key={i} fill={chartColors.negative} fillOpacity={0.85} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>

            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Motivo</TableHead>
                  <TableHead className="text-right">Qtd.</TableHead>
                  <TableHead className="text-right">Perdidas</TableHead>
                  <TableHead className="text-right">Expiradas</TableHead>
                  <TableHead className="text-right">R$ perdido</TableHead>
                  <TableHead className="text-right">% do total</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.items.map((i) => (
                  <TableRow key={i.reason}>
                    <TableCell className="font-medium">{i.label}</TableCell>
                    <TableCell className="text-right">{i.count}</TableCell>
                    <TableCell className="text-right text-muted-foreground">{i.byStatus.perdida || 0}</TableCell>
                    <TableCell className="text-right text-muted-foreground">{i.byStatus.expirada || 0}</TableCell>
                    <TableCell className="text-right font-mono">{formatCurrency(i.lostValue)}</TableCell>
                    <TableCell className="text-right text-muted-foreground">
                      {data.totalValue > 0 ? `${((i.lostValue / data.totalValue) * 100).toFixed(1)}%` : "—"}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </>
        )}
      </Section>
    </div>
  );
}

function RiskBadge({ ageDays, status }: { ageDays: number; status: string }) {
  const risk = ageRiskLevel(ageDays, status);
  if (risk === "danger") {
    return <Badge variant="outline" className="bg-red-500/10 text-red-400 border-red-500/30 text-[10px]">
      <AlertTriangle className="w-3 h-3 mr-1" /> {ageDays}d
    </Badge>;
  }
  if (risk === "warning") {
    return <Badge variant="outline" className="bg-amber-500/10 text-amber-400 border-amber-500/30 text-[10px]">
      <Clock className="w-3 h-3 mr-1" /> {ageDays}d
    </Badge>;
  }
  return <span className="text-xs text-muted-foreground">{ageDays}d</span>;
}

function ActivePipelineTab({ days }: { days: PeriodDays }) {
  const { data, isLoading, error } = trpc.comercialDashboard.activePipeline.useQuery({ days });
  if (error) return <ErrorState error={error} />;
  if (isLoading || !data) return <LoadingState />;

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <KpiCard label="Cotações abertas" value={String(data.totalOpen)} icon={FileText} />
        <KpiCard
          label="Risco (amarelo)"
          value={String(data.groups.reduce((s, g) => s + g.items.filter((i) => ageRiskLevel(i.ageDays, i.status) === "warning").length, 0))}
          accent="warning"
          sub={`> ${QUOTATION_AGE_WARNING_DAYS} dias`}
        />
        <KpiCard
          label="Risco (vermelho)"
          value={String(data.groups.reduce((s, g) => s + g.items.filter((i) => ageRiskLevel(i.ageDays, i.status) === "danger").length, 0))}
          accent="danger"
          sub={`> ${QUOTATION_AGE_DANGER_DAYS} dias`}
        />
      </div>

      {data.groups.length === 0 ? (
        <p className="text-sm text-muted-foreground py-6 text-center">Nenhuma cotação aberta.</p>
      ) : data.groups.map((g) => (
        <Section key={g.ownerId} title={g.ownerName} description={`${g.total} cotação${g.total !== 1 ? "ões" : ""} aberta${g.total !== 1 ? "s" : ""} · mais antiga: ${g.maxAge}d`}>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Cotação</TableHead>
                <TableHead>Cliente / Lead</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Valor</TableHead>
                <TableHead className="text-right">Idade</TableHead>
                <TableHead className="w-10"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {g.items.map((q) => (
                <TableRow key={q.id}>
                  <TableCell className="font-mono text-xs">{q.quotationNumber}</TableCell>
                  <TableCell className="text-sm">{q.targetLabel}</TableCell>
                  <TableCell><Badge variant="outline" className="text-[10px]">{q.status}</Badge></TableCell>
                  <TableCell className="text-right font-mono text-xs">{q.totalValue ? formatCurrency(Number(q.totalValue)) : "—"}</TableCell>
                  <TableCell className="text-right"><RiskBadge ageDays={q.ageDays} status={q.status} /></TableCell>
                  <TableCell>
                    <Link href={`/comercial/cotacoes/${q.id}`}>
                      <ChevronRight className="w-4 h-4 text-muted-foreground hover:text-foreground" />
                    </Link>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Section>
      ))}
    </div>
  );
}

type PartnerSortKey = "name" | "totalLeads" | "leadsWithQuotation" | "leadsWithWin" | "conversionRate" | "winRate";
type SortDir = "asc" | "desc";

function SortableHeader({
  label, align = "left", sortKey, currentKey, currentDir, onSort,
}: {
  label: string;
  align?: "left" | "right";
  sortKey: PartnerSortKey;
  currentKey: PartnerSortKey;
  currentDir: SortDir;
  onSort: (k: PartnerSortKey) => void;
}) {
  const active = currentKey === sortKey;
  const Icon = active ? (currentDir === "asc" ? ArrowUp : ArrowDown) : ArrowUpDown;
  return (
    <TableHead className={align === "right" ? "text-right" : undefined}>
      <button
        type="button"
        onClick={() => onSort(sortKey)}
        className={`inline-flex items-center gap-1 hover:text-foreground transition-colors ${active ? "text-foreground" : "text-muted-foreground"} ${align === "right" ? "flex-row-reverse" : ""}`}
      >
        <span>{label}</span>
        <Icon className="w-3 h-3" />
      </button>
    </TableHead>
  );
}

function PartnerHealthTab({ days }: { days: PeriodDays }) {
  const { data, isLoading, error } = trpc.comercialDashboard.partnerHealth.useQuery({ days });
  const [sortKey, setSortKey] = useState<PartnerSortKey>("conversionRate");
  const [sortDir, setSortDir] = useState<SortDir>("desc");

  if (error) return <ErrorState error={error} />;
  if (isLoading || !data) return <LoadingState />;

  function handleSort(k: PartnerSortKey) {
    if (k === sortKey) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(k);
      setSortDir(k === "name" ? "asc" : "desc");
    }
  }

  const sorted = [...data.partners].sort((a, b) => {
    const va = sortKey === "name" ? a.name : (a.health as any)[sortKey];
    const vb = sortKey === "name" ? b.name : (b.health as any)[sortKey];
    if (typeof va === "string" && typeof vb === "string") {
      const cmp = va.localeCompare(vb, "pt-BR");
      return sortDir === "asc" ? cmp : -cmp;
    }
    const cmp = (Number(va) || 0) - (Number(vb) || 0);
    return sortDir === "asc" ? cmp : -cmp;
  });

  return (
    <Section title={`Saúde de parceiros (últimos ${data.days} dias)`} icon={Handshake}>
      {data.partners.length === 0 ? (
        <p className="text-sm text-muted-foreground py-6 text-center">Nenhum parceiro ativo.</p>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <SortableHeader label="Parceiro" sortKey="name" currentKey={sortKey} currentDir={sortDir} onSort={handleSort} />
              <SortableHeader label="Leads" align="right" sortKey="totalLeads" currentKey={sortKey} currentDir={sortDir} onSort={handleSort} />
              <SortableHeader label="Cotações" align="right" sortKey="leadsWithQuotation" currentKey={sortKey} currentDir={sortDir} onSort={handleSort} />
              <SortableHeader label="Wins" align="right" sortKey="leadsWithWin" currentKey={sortKey} currentDir={sortDir} onSort={handleSort} />
              <SortableHeader label="Taxa conversão" align="right" sortKey="conversionRate" currentKey={sortKey} currentDir={sortDir} onSort={handleSort} />
              <SortableHeader label="Win rate" align="right" sortKey="winRate" currentKey={sortKey} currentDir={sortDir} onSort={handleSort} />
              <TableHead></TableHead>
              <TableHead className="w-10"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {sorted.map((p) => (
              <TableRow key={p.id}>
                <TableCell className="font-medium">{p.name}</TableCell>
                <TableCell className="text-right">{p.health.totalLeads}</TableCell>
                <TableCell className="text-right">{p.health.leadsWithQuotation}</TableCell>
                <TableCell className="text-right">{p.health.leadsWithWin}</TableCell>
                <TableCell className="text-right font-mono">{fmtPct(p.health.conversionRate)}</TableCell>
                <TableCell className="text-right font-mono">{fmtPct(p.health.winRate)}</TableCell>
                <TableCell>
                  {p.health.noConversionBadge && (
                    <Badge variant="outline" className="bg-red-500/10 text-red-400 border-red-500/30 text-[10px]">
                      Sem conversão
                    </Badge>
                  )}
                </TableCell>
                <TableCell>
                  <Link href={`/comercial/parceiros/${p.id}`}>
                    <ExternalLink className="w-3.5 h-3.5 text-muted-foreground hover:text-foreground" />
                  </Link>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </Section>
  );
}

export default function ComercialDashboard() {
  const [days, setDays] = useState<PeriodDays>(90);
  const [tab, setTab] = useState("funil");

  return (
    <PageContainer
      title="Dashboard Comercial"
      description="Visão consolidada do funil, motivos de perda, pipeline e saúde de parceiros"
      actions={<PeriodSelect value={days} onChange={setDays} />}
    >
      <Tabs value={tab} onValueChange={setTab}>
        <TabsList className="mb-6">
          <TabsTrigger value="funil">Funil</TabsTrigger>
          <TabsTrigger value="perdas">Motivos de perda</TabsTrigger>
          <TabsTrigger value="pipeline">Pipeline ativo</TabsTrigger>
          <TabsTrigger value="parceiros">Saúde de parceiros</TabsTrigger>
        </TabsList>
        <TabsContent value="funil"><FunnelTab days={days} /></TabsContent>
        <TabsContent value="perdas"><LossReasonsTab days={days} /></TabsContent>
        <TabsContent value="pipeline"><ActivePipelineTab days={days} /></TabsContent>
        <TabsContent value="parceiros"><PartnerHealthTab days={days} /></TabsContent>
      </Tabs>
    </PageContainer>
  );
}
