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

function formatDate(d: string | Date | null | undefined) {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("pt-BR");
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
    if (myClients.length === 0) return;
    if (myClients.length === 1) {
      setSelectedClientId(myClients[0].id);
      setBuilderOpen(true);
    } else {
      setClientSelectorOpen(true);
    }
  }

  const hasPartner = true;

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
          {myClients.length > 0 && builderProducts.length > 0 && (
            <Button variant="outline" className="gap-2" onClick={openBuilder}>
              <ShoppingCart className="w-4 h-4" /> Montar Campanha para Cliente
            </Button>
          )}
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
                  <div key={lead.id} className="flex items-center justify-between px-5 py-3">
                    <div>
                      <p className="text-sm font-medium">{lead.name}</p>
                      <p className="text-xs text-muted-foreground">
                        {lead.company || "—"} · {formatDate(lead.createdAt)}
                      </p>
                    </div>
                    <Badge variant="outline" className={`text-xs ${stage.color}`}>
                      {stage.label}
                    </Badge>
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
            <p className="text-sm text-muted-foreground mb-3">Para qual cliente deseja montar a campanha?</p>
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
