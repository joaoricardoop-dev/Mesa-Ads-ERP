import { useState } from "react";
import { useLocation, Link } from "wouter";
import { trpc } from "@/lib/trpc";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { formatCurrency } from "@/lib/format";
import type { LucideIcon } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DollarSign,
  Users,
  FileText,
  TrendingUp,
  CheckCircle2,
  Handshake,
  Plus,
  ShoppingCart,
  ChevronRight,
  Download,
  CircleDot,
  Phone,
  Trophy,
  XCircle,
  History,
  CalendarDays,
} from "lucide-react";
import { CampaignBuilder } from "@/components/CampaignBuilder";

const QUOTATION_STATUS_CONFIG: Record<string, { label: string; color: string }> = {
  rascunho: { label: "Rascunho", color: "bg-gray-500/10 text-gray-400 border-gray-500/30" },
  enviada: { label: "Enviada", color: "bg-blue-500/10 text-blue-400 border-blue-500/30" },
  ativa: { label: "Ativa", color: "bg-emerald-500/10 text-emerald-400 border-emerald-500/30" },
  os_gerada: { label: "OS Gerada", color: "bg-cyan-500/10 text-cyan-400 border-cyan-500/30" },
  win: { label: "Aprovada", color: "bg-green-500/10 text-green-400 border-green-500/30" },
  perdida: { label: "Perdida", color: "bg-red-500/10 text-red-400 border-red-500/30" },
  expirada: { label: "Expirada", color: "bg-orange-500/10 text-orange-400 border-orange-500/30" },
};

const STAGE_LABELS: Record<string, { label: string; color: string }> = {
  novo: { label: "Novo", color: "bg-blue-500/10 text-blue-400 border-blue-500/30" },
  contato: { label: "Contato", color: "bg-yellow-500/10 text-yellow-400 border-yellow-500/30" },
  qualificado: { label: "Qualificado", color: "bg-purple-500/10 text-purple-400 border-purple-500/30" },
  proposta: { label: "Proposta", color: "bg-orange-500/10 text-orange-400 border-orange-500/30" },
  negociacao: { label: "Negociação", color: "bg-cyan-500/10 text-cyan-400 border-cyan-500/30" },
  ganho: { label: "Ganho", color: "bg-green-500/10 text-green-400 border-green-500/30" },
  perdido: { label: "Perdido", color: "bg-red-500/10 text-red-400 border-red-500/30" },
};

const LEAD_TIMELINE_STAGES = [
  { key: "novo",       label: "Indicado",  icon: CircleDot },
  { key: "contato",    label: "Contato",   icon: Phone },
  { key: "proposta",   label: "Cotação",   icon: FileText },
  { key: "ganho",      label: "Fechado",   icon: Trophy },
];

const STAGE_ORDER: Record<string, number> = {
  novo: 0, contato: 1, qualificado: 1, proposta: 2, negociacao: 2, ganho: 3, perdido: -1,
};

function formatDate(d: string | Date | null | undefined) {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("pt-BR");
}

function LeadTimeline({ stage }: { stage: string }) {
  const currentIdx = STAGE_ORDER[stage] ?? 0;
  const isPerdido = stage === "perdido";

  return (
    <div className="flex items-center gap-0 mt-2">
      {LEAD_TIMELINE_STAGES.map((s, i) => {
        const done = currentIdx > i && !isPerdido;
        const current = currentIdx === i && !isPerdido;
        const StageIcon = s.icon;
        return (
          <div key={s.key} className="flex items-center flex-1 min-w-0">
            <div className="flex flex-col items-center relative flex-1">
              {i > 0 && (
                <div className={`absolute right-1/2 left-0 h-0.5 top-3 ${done || current ? "bg-primary" : "bg-border"}`} style={{ marginRight: "50%" }} />
              )}
              {i < LEAD_TIMELINE_STAGES.length - 1 && (
                <div className={`absolute left-1/2 right-0 h-0.5 top-3 ${done ? "bg-primary" : "bg-border"}`} style={{ marginLeft: "50%" }} />
              )}
              <div className={`relative z-10 w-6 h-6 rounded-full flex items-center justify-center ${
                done
                  ? "bg-primary"
                  : current
                  ? "bg-primary/20 border-2 border-primary"
                  : "bg-muted/50 border border-border"
              }`}>
                {done ? (
                  <CheckCircle2 className="w-3 h-3 text-primary-foreground" />
                ) : (
                  <StageIcon className={`w-3 h-3 ${current ? "text-primary" : "text-muted-foreground/30"}`} />
                )}
              </div>
              <p className={`mt-1 text-[9px] text-center leading-tight ${
                current ? "text-primary font-semibold" : done ? "text-muted-foreground" : "text-muted-foreground/30"
              }`}>{s.label}</p>
            </div>
          </div>
        );
      })}
      {isPerdido && (
        <div className="flex items-center gap-1 ml-2 px-2 py-0.5 rounded-full bg-red-500/10 border border-red-500/20">
          <XCircle className="w-3 h-3 text-red-400" />
          <span className="text-[9px] text-red-400 font-medium">Perdido</span>
        </div>
      )}
    </div>
  );
}

function KpiCard({
  icon: Icon,
  label,
  value,
  sub,
  color,
}: {
  icon: LucideIcon;
  label: string;
  value: string | number;
  sub?: string;
  color: string;
}) {
  return (
    <div className="bg-card border border-border/30 rounded-xl p-5">
      <div className="flex items-start gap-4">
        <div className={`p-2.5 rounded-lg ${color}`}>
          <Icon className="w-5 h-5" />
        </div>
        <div>
          <p className="text-xs text-muted-foreground mb-0.5">{label}</p>
          <p className="text-2xl font-bold font-mono">{value}</p>
          {sub && <p className="text-xs text-muted-foreground mt-0.5">{sub}</p>}
        </div>
      </div>
    </div>
  );
}

export default function ParceiroPortal() {
  const [, navigate] = useLocation();
  const adminPartnerId = (window as any).__IMPERSONATION__?.partnerId as number | undefined;
  const { data: dashboard, isLoading: loadingDash } = trpc.parceiroPortal.getDashboard.useQuery({ adminPartnerId });
  const { data: leads = [], isLoading: loadingLeads } = trpc.parceiroPortal.getLeads.useQuery({ adminPartnerId });
  const { data: quotations = [], isLoading: loadingQuotations } = trpc.parceiroPortal.getQuotations.useQuery({ adminPartnerId });
  const { data: myClients = [] } = trpc.parceiroPortal.getMyClients.useQuery({ adminPartnerId });
  const { data: builderProducts = [] } = trpc.parceiroPortal.getPriceTableForBuilder.useQuery({ adminPartnerId });
  const { data: mediaKitData } = trpc.mediaKit.getPublicData.useQuery();

  const [builderOpen, setBuilderOpen] = useState(false);
  const [selectedClientId, setSelectedClientId] = useState<number | null>(null);
  const [clientSelectorOpen, setClientSelectorOpen] = useState(false);

  const recentLeads = leads.slice(0, 5);
  const recentQuotations = quotations.slice(0, 5);

  const selectedClient = myClients.find((c: any) => c.id === selectedClientId);

  function openBuilder() {
    if (myClients.length === 0) {
      setClientSelectorOpen(true);
      return;
    }
    if (myClients.length === 1) {
      setSelectedClientId(myClients[0].id);
      setBuilderOpen(true);
    } else {
      setClientSelectorOpen(true);
    }
  }

  const hasPartner = true;

  const now = new Date();
  const currentMonth = now.toLocaleString("pt-BR", { month: "long", year: "numeric" });
  const commissionPercent = dashboard?.partner?.commissionPercent ?? 0;

  // BV agora vem do ledger (accounts_payable, sourceType='partner_commission')
  // agregado por competenceMonth pelo backend. Substitui o cálculo live sobre
  // quotations.status='win' que ignorava recebimento real.
  const commissionByMonth = (dashboard?.commissionByMonth ?? []) as Array<{
    competenceMonth: string;
    paid: number;
    pending: number;
    total: number;
  }>;
  const pad2 = (n: number) => String(n).padStart(2, "0");
  const currentCm = `${now.getFullYear()}-${pad2(now.getMonth() + 1)}`;
  const lastMonthDate = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const lastCm = `${lastMonthDate.getFullYear()}-${pad2(lastMonthDate.getMonth() + 1)}`;
  const lastMonthName = lastMonthDate.toLocaleString("pt-BR", { month: "long" });
  const currentMonthEntry = commissionByMonth.find((m) => m.competenceMonth === currentCm);
  const lastMonthEntry = commissionByMonth.find((m) => m.competenceMonth === lastCm);
  const bvEstimadoMes = currentMonthEntry?.total ?? 0;
  const bvLastMonth = lastMonthEntry?.total ?? 0;
  const bvCurrentPaid = currentMonthEntry?.paid ?? 0;
  const bvCurrentPending = currentMonthEntry?.pending ?? 0;
  const commissionPaidTotal = dashboard?.commissionPaid ?? 0;
  const commissionPendingTotal = dashboard?.commissionPending ?? 0;

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      <div className="flex items-center gap-4">
        <div className="p-3 rounded-xl bg-primary/10">
          <Handshake className="w-6 h-6 text-primary" />
        </div>
        <div className="flex-1 min-w-0">
          <h1 className="text-2xl font-bold">Portal do Parceiro</h1>
          {dashboard?.partner && (
            <div className="flex flex-wrap items-center gap-2 mt-0.5">
              <p className="text-sm text-muted-foreground">
                {dashboard.partner.name}
                {dashboard.partner.company ? ` · ${dashboard.partner.company}` : ""}
              </p>
              {dashboard.partner.type && (
                <Badge variant="outline" className={
                  dashboard.partner.type === "agencia"
                    ? "text-violet-400 border-violet-500/30 bg-violet-500/10"
                    : dashboard.partner.type === "indicador"
                    ? "text-blue-400 border-blue-500/30 bg-blue-500/10"
                    : "text-amber-400 border-amber-500/30 bg-amber-500/10"
                }>
                  {dashboard.partner.type === "agencia" ? "Agência" :
                   dashboard.partner.type === "indicador" ? "Indicador" :
                   dashboard.partner.type === "consultor" ? "Consultor" :
                   dashboard.partner.type}
                </Badge>
              )}
              {dashboard.partner.commissionPercent != null && (
                <Badge variant="outline" className="text-emerald-400 border-emerald-500/30 bg-emerald-500/10">
                  {dashboard.partner.commissionPercent}% comissão
                </Badge>
              )}
            </div>
          )}
        </div>
        <div className="flex items-center gap-2 shrink-0 flex-wrap justify-end">
          <Button variant="outline" className="gap-2" onClick={openBuilder}>
            <ShoppingCart className="w-4 h-4" /> Montar Campanha para Cliente
          </Button>
          {mediaKitData?.pdfUrl && (
            <Button variant="outline" className="gap-2" asChild>
              <a href={mediaKitData.pdfUrl} target="_blank" rel="noopener noreferrer">
                <Download className="w-4 h-4" /> Media Kit
              </a>
            </Button>
          )}
          <Link href="/leads">
            <Button className="gap-2">
              <Plus className="w-4 h-4" /> Indicar Lead
            </Button>
          </Link>
        </div>
      </div>

      {!loadingDash && dashboard && (
        <div className="rounded-xl border border-amber-500/30 bg-amber-50 dark:bg-amber-950/20 overflow-hidden">
          <div className="px-5 py-4 flex items-center gap-3 border-b border-amber-500/20">
            <div className="p-2 rounded-lg bg-amber-500/15">
              <DollarSign className="w-4 h-4 text-amber-600 dark:text-amber-400" />
            </div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-foreground">BV Estimado do Mês</p>
              <p className="text-xs text-muted-foreground capitalize">{currentMonth}</p>
            </div>
          </div>
          <div className="px-5 py-4 flex items-center gap-6 flex-wrap">
            <div>
              <p className="text-[10px] uppercase tracking-wider text-muted-foreground mb-0.5">Estimativa {now.toLocaleString("pt-BR", { month: "short" })}</p>
              <p className="text-3xl font-black text-amber-600 dark:text-amber-400 font-mono tabular-nums">{formatCurrency(bvEstimadoMes)}</p>
              <p className="text-[10px] text-muted-foreground mt-0.5">
                {formatCurrency(bvCurrentPaid)} pago{bvCurrentPaid !== 1 ? "s" : ""} · {formatCurrency(bvCurrentPending)} a receber
              </p>
            </div>
            <div className="w-px h-10 bg-border hidden sm:block" />
            <div className="flex items-center gap-4 flex-wrap">
              <div>
                <p className="text-[10px] uppercase tracking-wider text-muted-foreground mb-0.5">
                  <History className="w-3 h-3 inline mr-1" />
                  {lastMonthName}
                </p>
                <p className="text-lg font-bold font-mono text-muted-foreground">{formatCurrency(bvLastMonth)}</p>
                <p className="text-[10px] text-muted-foreground">
                  {formatCurrency(lastMonthEntry?.paid ?? 0)} pago
                </p>
              </div>
              <div>
                <p className="text-[10px] uppercase tracking-wider text-muted-foreground mb-0.5">
                  <CalendarDays className="w-3 h-3 inline mr-1" />
                  Acumulado
                </p>
                <p className="text-lg font-bold font-mono text-muted-foreground" data-testid="text-commission-total">
                  {formatCurrency(commissionPaidTotal + commissionPendingTotal)}
                </p>
                <p className="text-[10px] text-muted-foreground">
                  {formatCurrency(commissionPaidTotal)} pago · {formatCurrency(commissionPendingTotal)} a receber
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      {loadingDash ? (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="bg-card border border-border/30 rounded-xl p-5 h-28 animate-pulse" />
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <KpiCard
            icon={Users}
            label="Leads Indicados"
            value={dashboard?.totalLeads ?? 0}
            color="bg-blue-500/10 text-blue-500"
          />
          <KpiCard
            icon={FileText}
            label="Cotações"
            value={dashboard?.totalQuotations ?? 0}
            sub={`${dashboard?.wonDeals ?? 0} aprovadas`}
            color="bg-purple-500/10 text-purple-500"
          />
          <KpiCard
            icon={TrendingUp}
            label="Faturamento Gerado"
            value={formatCurrency(dashboard?.totalRevenue ?? 0)}
            color="bg-emerald-500/10 text-emerald-500"
          />
          <KpiCard
            icon={DollarSign}
            label="Comissão Estimada"
            value={formatCurrency(dashboard?.commissionEstimated ?? 0)}
            color="bg-amber-500/10 text-amber-500"
          />
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-card border border-border/30 rounded-xl overflow-hidden">
          <div className="flex items-center justify-between px-5 py-4 border-b border-border/20">
            <h2 className="font-semibold text-sm flex items-center gap-2">
              <Users className="w-4 h-4 text-primary" /> Últimos Leads
            </h2>
            <Link href="/leads" className="text-xs text-primary hover:underline">
              Ver todos
            </Link>
          </div>
          {loadingLeads ? (
            <div className="p-8 text-center text-muted-foreground text-sm">Carregando...</div>
          ) : recentLeads.length === 0 ? (
            <div className="p-8 text-center text-muted-foreground text-sm">
              Nenhum lead indicado ainda.
            </div>
          ) : (
            <div className="divide-y divide-border/20">
              {recentLeads.map((lead: any) => {
                const stage = STAGE_LABELS[lead.stage] || { label: lead.stage, color: "" };
                return (
                  <div key={lead.id} className="px-5 py-3">
                    <div className="flex items-center justify-between gap-2">
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium truncate">{lead.name}</p>
                        <p className="text-xs text-muted-foreground">
                          {lead.company || "—"} · {formatDate(lead.createdAt)}
                        </p>
                      </div>
                      <Badge variant="outline" className={`text-xs shrink-0 ${stage.color}`}>
                        {stage.label}
                      </Badge>
                    </div>
                    <LeadTimeline stage={lead.stage} />
                  </div>
                );
              })}
            </div>
          )}
        </div>

        <div className="bg-card border border-border/30 rounded-xl overflow-hidden">
          <div className="flex items-center justify-between px-5 py-4 border-b border-border/20">
            <h2 className="font-semibold text-sm flex items-center gap-2">
              <FileText className="w-4 h-4 text-primary" /> Últimas Cotações
            </h2>
            {quotations.length > 5 && (
              <span className="text-xs text-muted-foreground">{quotations.length} no total</span>
            )}
          </div>
          {loadingQuotations ? (
            <div className="p-8 text-center text-muted-foreground text-sm">Carregando...</div>
          ) : recentQuotations.length === 0 ? (
            <div className="p-8 text-center text-muted-foreground text-sm">
              Nenhuma cotação associada ainda.
            </div>
          ) : (
            <div className="divide-y divide-border/20">
              {recentQuotations.map((q: any) => {
                const statusCfg = QUOTATION_STATUS_CONFIG[q.status] || { label: q.status, color: "" };
                return (
                  <div key={q.id} className="flex items-center justify-between px-5 py-3">
                    <div>
                      <p className="text-sm font-medium">{q.quotationNumber}</p>
                      <p className="text-xs text-muted-foreground">
                        {q.clientName || "—"} · {formatDate(q.createdAt)}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      {q.totalValue && (
                        <span className="text-xs font-mono text-muted-foreground">
                          {formatCurrency(Number(q.totalValue))}
                        </span>
                      )}
                      <Badge variant="outline" className={`text-xs ${statusCfg.color}`}>
                        {statusCfg.label}
                      </Badge>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {dashboard && (
        <div className="bg-card border border-border/30 rounded-xl p-5">
          <h3 className="font-semibold text-sm mb-4 flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-500" /> Resumo da Parceria
          </h3>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="text-center">
              <p className="text-2xl font-bold font-mono text-primary">{dashboard.partner.commissionPercent}%</p>
              <p className="text-xs text-muted-foreground mt-1">Comissão</p>
            </div>
            <div className="text-center">
              <p className="text-2xl font-bold font-mono text-blue-400">{dashboard.totalLeads}</p>
              <p className="text-xs text-muted-foreground mt-1">Leads indicados</p>
            </div>
            <div className="text-center">
              <p className="text-2xl font-bold font-mono text-emerald-400">{dashboard.wonDeals}</p>
              <p className="text-xs text-muted-foreground mt-1">Negócios fechados</p>
            </div>
            <div className="text-center">
              <p className="text-2xl font-bold font-mono text-amber-400">
                {dashboard.totalQuotations > 0
                  ? `${Math.round((dashboard.wonDeals / dashboard.totalQuotations) * 100)}%`
                  : "—"}
              </p>
              <p className="text-xs text-muted-foreground mt-1">Taxa de conversão</p>
            </div>
          </div>
        </div>
      )}

      <Dialog open={clientSelectorOpen} onOpenChange={setClientSelectorOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Selecione o Cliente</DialogTitle>
          </DialogHeader>
          <div className="space-y-2 py-2">
            {myClients.length === 0 ? (
              <div className="flex flex-col items-center gap-3 py-6 text-center">
                <Users className="w-10 h-10 text-muted-foreground/40" />
                <div>
                  <p className="font-medium text-sm">Nenhum cliente cadastrado</p>
                  <p className="text-xs text-muted-foreground mt-1">Cadastre um cliente antes de montar uma campanha.</p>
                </div>
              </div>
            ) : (
              <p className="text-sm text-muted-foreground mb-3">Para qual cliente deseja montar a campanha?</p>
            )}
            {myClients.map((client: any) => (
              <button
                key={client.id}
                onClick={() => {
                  setSelectedClientId(client.id);
                  setClientSelectorOpen(false);
                  setBuilderOpen(true);
                }}
                className="w-full flex items-center justify-between gap-3 px-4 py-3 rounded-xl border border-border/30 hover:border-primary/40 hover:bg-accent/30 transition-all text-left"
              >
                <div>
                  <p className="font-medium text-sm">{client.company || client.name}</p>
                  {client.company && client.name !== client.company && (
                    <p className="text-xs text-muted-foreground">{client.name}</p>
                  )}
                </div>
                <ChevronRight className="w-4 h-4 text-muted-foreground/50 shrink-0" />
              </button>
            ))}
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={builderOpen} onOpenChange={setBuilderOpen}>
        <DialogContent className="max-w-5xl w-full h-[90vh] flex flex-col p-0 gap-0">
          <DialogHeader className="px-6 pt-5 pb-0 shrink-0">
            <DialogTitle className="flex items-center gap-2">
              <ShoppingCart className="w-5 h-5 text-primary" />
              Montar Campanha para Cliente
              {selectedClient && (
                <span className="font-normal text-muted-foreground text-sm">
                  — {selectedClient.company || selectedClient.name}
                </span>
              )}
            </DialogTitle>
          </DialogHeader>
          {selectedClientId && (
            <CampaignBuilder
              clientId={selectedClientId}
              hasPartner={hasPartner}
              isPartner={true}
              products={builderProducts}
              onClose={() => setBuilderOpen(false)}
            />
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
