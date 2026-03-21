import { useState } from "react";
import { useLocation } from "wouter";
import { trpc } from "@/lib/trpc";
import type { AppRouter } from "../../../server/routers";
import type { inferRouterOutputs } from "@trpc/server";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { formatCurrency } from "@/lib/format";
import {
  Plus,
  Building2,
  Phone,
  Mail,
  MapPin,
  FileText,
  ArrowLeft,
  Clock,
  Loader2,
  Users,
} from "lucide-react";

type RouterOutput = inferRouterOutputs<AppRouter>;
type LeadListItem = RouterOutput["parceiroPortal"]["getLeads"][number];
type LeadDetail = RouterOutput["parceiroPortal"]["getLeadDetail"];
type LeadDetailQuotation = LeadDetail["quotations"][number];
type StageHistoryItem = LeadDetail["stageHistory"][number];

const STAGES = [
  { key: "novo", label: "Novo", color: "bg-blue-500/10 text-blue-400 border-blue-500/30" },
  { key: "contato", label: "Contato", color: "bg-yellow-500/10 text-yellow-400 border-yellow-500/30" },
  { key: "qualificado", label: "Qualificado", color: "bg-purple-500/10 text-purple-400 border-purple-500/30" },
  { key: "proposta", label: "Proposta", color: "bg-orange-500/10 text-orange-400 border-orange-500/30" },
  { key: "negociacao", label: "Negociação", color: "bg-cyan-500/10 text-cyan-400 border-cyan-500/30" },
  { key: "ganho", label: "Ganho", color: "bg-green-500/10 text-green-400 border-green-500/30" },
  { key: "perdido", label: "Perdido", color: "bg-red-500/10 text-red-400 border-red-500/30" },
] as const;

type StageKey = (typeof STAGES)[number]["key"];

const STAGE_MAP = Object.fromEntries(STAGES.map((s) => [s.key, s])) as Record<StageKey, { key: StageKey; label: string; color: string }>;

const QUOTATION_STATUS: Record<string, { label: string; color: string }> = {
  rascunho: { label: "Rascunho", color: "bg-gray-500/10 text-gray-400 border-gray-500/30" },
  enviada: { label: "Enviada", color: "bg-blue-500/10 text-blue-400 border-blue-500/30" },
  ativa: { label: "Ativa", color: "bg-emerald-500/10 text-emerald-400 border-emerald-500/30" },
  os_gerada: { label: "OS Gerada", color: "bg-cyan-500/10 text-cyan-400 border-cyan-500/30" },
  win: { label: "Aprovada", color: "bg-green-500/10 text-green-400 border-green-500/30" },
  perdida: { label: "Perdida", color: "bg-red-500/10 text-red-400 border-red-500/30" },
  expirada: { label: "Expirada", color: "bg-orange-500/10 text-orange-400 border-orange-500/30" },
};

function formatDate(d: string | Date | null | undefined) {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("pt-BR");
}

function getStageConfig(stage: string | null): { label: string; color: string } {
  if (!stage) return { label: "—", color: "" };
  return STAGE_MAP[stage as StageKey] ?? { label: stage, color: "" };
}

interface LeadFormData {
  name: string;
  company: string;
  cnpj: string;
  contactName: string;
  contactPhone: string;
  contactEmail: string;
  city: string;
  state: string;
  notes: string;
}

const emptyForm: LeadFormData = {
  name: "",
  company: "",
  cnpj: "",
  contactName: "",
  contactPhone: "",
  contactEmail: "",
  city: "",
  state: "",
  notes: "",
};

function StageTimeline({ stageHistory }: { stageHistory: StageHistoryItem[] }) {
  if (stageHistory.length === 0) {
    return (
      <div className="text-xs text-muted-foreground py-2">
        Nenhuma mudança de estágio registrada.
      </div>
    );
  }
  return (
    <div className="space-y-2">
      {stageHistory.map((item) => (
        <div key={item.id} className="flex items-start gap-3 text-xs">
          <Clock className="w-3 h-3 text-muted-foreground mt-0.5 shrink-0" />
          <div>
            <p className="text-foreground">{item.content || "Estágio atualizado"}</p>
            <p className="text-muted-foreground mt-0.5">{formatDate(item.createdAt)}</p>
          </div>
        </div>
      ))}
    </div>
  );
}

function QuotationCard({ quotation }: { quotation: LeadDetailQuotation }) {
  const statusCfg = QUOTATION_STATUS[quotation.status] ?? { label: quotation.status, color: "" };
  const monthlyValue =
    quotation.totalValue && quotation.cycles && Number(quotation.cycles) > 0
      ? Number(quotation.totalValue) / Number(quotation.cycles)
      : null;

  return (
    <div className="bg-muted/20 border border-border/30 rounded-lg p-4 space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <FileText className="w-4 h-4 text-primary" />
          <span className="text-sm font-semibold">{quotation.quotationNumber}</span>
        </div>
        <Badge variant="outline" className={`text-xs ${statusCfg.color}`}>
          {statusCfg.label}
        </Badge>
      </div>
      {quotation.quotationName && (
        <p className="text-xs text-muted-foreground">{quotation.quotationName}</p>
      )}
      <div className="grid grid-cols-2 gap-2 text-xs">
        {quotation.productName && (
          <div>
            <p className="text-muted-foreground">Produto</p>
            <p className="font-medium">{quotation.productName}</p>
          </div>
        )}
        {quotation.coasterVolume != null && (
          <div>
            <p className="text-muted-foreground">Volume</p>
            <p className="font-medium font-mono">{Number(quotation.coasterVolume).toLocaleString("pt-BR")} un.</p>
          </div>
        )}
        {quotation.cycles != null && (
          <div>
            <p className="text-muted-foreground">Período</p>
            <p className="font-medium">{quotation.cycles} {quotation.cycles === 1 ? "mês" : "meses"}</p>
          </div>
        )}
        {quotation.totalValue && Number(quotation.totalValue) > 0 && (
          <div>
            <p className="text-muted-foreground">Valor Total</p>
            <p className="font-medium font-mono text-primary">{formatCurrency(Number(quotation.totalValue))}</p>
          </div>
        )}
        {monthlyValue != null && monthlyValue > 0 && (
          <div>
            <p className="text-muted-foreground">Valor Mensal</p>
            <p className="font-medium font-mono">{formatCurrency(monthlyValue)}</p>
          </div>
        )}
      </div>
      <p className="text-[10px] text-muted-foreground">Criada em {formatDate(quotation.createdAt)}</p>
    </div>
  );
}

function InfoRow({
  label,
  value,
  icon: Icon,
}: {
  label: string;
  value: string | null | undefined;
  icon?: React.ComponentType<{ className?: string }>;
}) {
  if (!value) return null;
  return (
    <div className="flex items-start gap-2">
      {Icon && <Icon className="w-3.5 h-3.5 text-muted-foreground mt-0.5 shrink-0" />}
      <div className="min-w-0">
        <p className="text-[10px] text-muted-foreground uppercase tracking-wide">{label}</p>
        <p className="text-sm truncate">{value}</p>
      </div>
    </div>
  );
}

function LeadDetailPanel({ leadId, onClose }: { leadId: number; onClose: () => void }) {
  const adminPartnerId = (window as any).__IMPERSONATION__?.partnerId as number | undefined;
  const { data: lead, isLoading } = trpc.parceiroPortal.getLeadDetail.useQuery({ leadId, adminPartnerId });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-48">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!lead) {
    return (
      <div className="p-8 text-center text-muted-foreground text-sm">Lead não encontrado.</div>
    );
  }

  const stage = getStageConfig(lead.stage);

  return (
    <div className="space-y-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2 flex-wrap">
            <h2 className="text-lg font-bold">{lead.name}</h2>
            <Badge variant="outline" className={`text-xs ${stage.color}`}>{stage.label}</Badge>
            {lead.quotations.length > 0 && (
              <Badge variant="outline" className="text-xs bg-primary/10 text-primary border-primary/30">
                <FileText className="w-2.5 h-2.5 mr-1" /> Com cotação
              </Badge>
            )}
          </div>
          {lead.company && <p className="text-sm text-muted-foreground mt-0.5">{lead.company}</p>}
        </div>
        <Button variant="ghost" size="sm" onClick={onClose}>
          <ArrowLeft className="w-4 h-4 mr-1" /> Voltar
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="bg-card border border-border/30 rounded-xl p-4 space-y-3">
          <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-2">
            <Building2 className="w-3.5 h-3.5" /> Dados da Empresa
          </h3>
          <InfoRow label="Empresa" value={lead.company} />
          <InfoRow label="CNPJ" value={lead.cnpj} />
          {(lead.city || lead.state) && (
            <InfoRow
              label="Cidade/Estado"
              value={[lead.city, lead.state].filter(Boolean).join(", ")}
              icon={MapPin}
            />
          )}
        </div>

        <div className="bg-card border border-border/30 rounded-xl p-4 space-y-3">
          <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-2">
            <Users className="w-3.5 h-3.5" /> Contato
          </h3>
          <InfoRow label="Nome" value={lead.contactName} />
          <InfoRow label="Telefone" value={lead.contactPhone} icon={Phone} />
          <InfoRow label="E-mail" value={lead.contactEmail} icon={Mail} />
        </div>
      </div>

      {lead.notes && (
        <div className="bg-card border border-border/30 rounded-xl p-4">
          <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">Observações</h3>
          <p className="text-sm text-muted-foreground whitespace-pre-wrap">{lead.notes}</p>
        </div>
      )}

      <div className="bg-card border border-border/30 rounded-xl p-4">
        <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-2">
          <Clock className="w-3.5 h-3.5" /> Histórico de Estágios
        </h3>
        <StageTimeline stageHistory={lead.stageHistory} />
      </div>

      {lead.quotations.length > 0 ? (
        <div className="space-y-3">
          <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-2">
            <FileText className="w-3.5 h-3.5" /> Cotações
          </h3>
          {lead.quotations.map((q) => (
            <QuotationCard key={q.id} quotation={q} />
          ))}
        </div>
      ) : (
        <div className="bg-card border border-border/30 rounded-xl p-4 text-center text-sm text-muted-foreground">
          Nenhuma cotação gerada para este lead ainda.
        </div>
      )}
    </div>
  );
}

function LeadCard({ lead, onClick }: { lead: LeadListItem; onClick: () => void }) {
  const stage = getStageConfig(lead.stage);
  return (
    <div
      className="bg-card border border-border/30 rounded-lg p-3 cursor-pointer hover:border-primary/30 hover:bg-card/80 transition-colors space-y-2"
      onClick={onClick}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium truncate">{lead.name}</p>
          {lead.company && <p className="text-xs text-muted-foreground truncate">{lead.company}</p>}
        </div>
        {lead.hasQuotation && (
          <FileText className="w-3.5 h-3.5 text-primary shrink-0 mt-0.5" />
        )}
      </div>
      <div className="flex items-center justify-between">
        <p className="text-[10px] text-muted-foreground">{formatDate(lead.updatedAt)}</p>
        {lead.latestQuotation && lead.latestQuotation.totalValue && Number(lead.latestQuotation.totalValue) > 0 && (
          <span className="text-[10px] font-mono text-primary">
            {formatCurrency(Number(lead.latestQuotation.totalValue))}
          </span>
        )}
      </div>
    </div>
  );
}

export default function ParceiroLeads() {
  const [, navigate] = useLocation();
  const [selectedLeadId, setSelectedLeadId] = useState<number | null>(null);
  const [stageFilter, setStageFilter] = useState<string>("all");
  const [viewMode, setViewMode] = useState<"kanban" | "list">("kanban");
  const [createOpen, setCreateOpen] = useState(false);
  const [formData, setFormData] = useState<LeadFormData>(emptyForm);

  const utils = trpc.useUtils();
  const adminPartnerId = (window as any).__IMPERSONATION__?.partnerId as number | undefined;
  const { data: leads = [], isLoading } = trpc.parceiroPortal.getLeads.useQuery(
    stageFilter !== "all" ? { stage: stageFilter, adminPartnerId } : { adminPartnerId }
  );

  const createMutation = trpc.parceiroPortal.createLead.useMutation({
    onSuccess: () => {
      toast.success("Lead indicado com sucesso!");
      setCreateOpen(false);
      setFormData(emptyForm);
      utils.parceiroPortal.getLeads.invalidate();
      utils.parceiroPortal.getDashboard.invalidate();
    },
    onError: (err) => toast.error(err.message),
  });

  const handleSubmit = () => {
    const nameValue = formData.company.trim() || formData.name.trim();
    if (!nameValue) {
      toast.error("Informe o nome da empresa ou do responsável");
      return;
    }
    createMutation.mutate({
      ...formData,
      name: nameValue,
    });
  };

  const leadsByStage = STAGES.reduce<Record<string, LeadListItem[]>>((acc, stage) => {
    acc[stage.key] = leads.filter((l) => l.stage === stage.key);
    return acc;
  }, {});

  const totalByStage = STAGES.reduce<Record<string, number>>((acc, stage) => {
    acc[stage.key] = leads.filter((l) => l.stage === stage.key).length;
    return acc;
  }, {});

  if (selectedLeadId !== null) {
    return (
      <div className="p-6 max-w-4xl mx-auto">
        <LeadDetailPanel
          leadId={selectedLeadId}
          onClose={() => setSelectedLeadId(null)}
        />
      </div>
    );
  }

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-5">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Users className="w-6 h-6 text-primary" /> Meus Leads
          </h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            {leads.length} {leads.length === 1 ? "lead indicado" : "leads indicados"}
          </p>
        </div>
        <Button onClick={() => setCreateOpen(true)} className="gap-2">
          <Plus className="w-4 h-4" /> Indicar Lead
        </Button>
      </div>

      <div className="flex items-center gap-3 flex-wrap">
        <div className="flex items-center gap-1 bg-muted/30 rounded-lg p-1">
          <button
            onClick={() => setViewMode("kanban")}
            className={`px-3 py-1 rounded text-xs font-medium transition-colors ${
              viewMode === "kanban" ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
            }`}
          >
            Kanban
          </button>
          <button
            onClick={() => setViewMode("list")}
            className={`px-3 py-1 rounded text-xs font-medium transition-colors ${
              viewMode === "list" ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
            }`}
          >
            Lista
          </button>
        </div>

        <Select value={stageFilter} onValueChange={setStageFilter}>
          <SelectTrigger className="w-44 h-8 text-xs">
            <SelectValue placeholder="Filtrar por estágio" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos os estágios</SelectItem>
            {STAGES.map((s) => (
              <SelectItem key={s.key} value={s.key}>
                {s.label}
                {totalByStage[s.key] > 0 && ` (${totalByStage[s.key]})`}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-16">
          <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
        </div>
      ) : leads.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <Users className="w-12 h-12 text-muted-foreground/30 mb-4" />
          <p className="text-muted-foreground">Nenhum lead indicado ainda.</p>
          <Button variant="outline" className="mt-4 gap-2" onClick={() => setCreateOpen(true)}>
            <Plus className="w-4 h-4" /> Indicar primeiro lead
          </Button>
        </div>
      ) : viewMode === "kanban" ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 items-start">
          {STAGES.filter((s) => {
            if (stageFilter !== "all") return s.key === stageFilter;
            return (leadsByStage[s.key]?.length ?? 0) > 0 || ["novo", "contato", "qualificado"].includes(s.key);
          }).map((stage) => (
            <div key={stage.key} className="space-y-2">
              <div className="flex items-center justify-between px-1">
                <Badge variant="outline" className={`text-xs ${stage.color}`}>
                  {stage.label}
                </Badge>
                <span className="text-xs text-muted-foreground">{leadsByStage[stage.key]?.length ?? 0}</span>
              </div>
              <div className="space-y-2">
                {(leadsByStage[stage.key] ?? []).map((lead) => (
                  <LeadCard
                    key={lead.id}
                    lead={lead}
                    onClick={() => setSelectedLeadId(lead.id)}
                  />
                ))}
                {(leadsByStage[stage.key]?.length ?? 0) === 0 && (
                  <div className="border border-dashed border-border/30 rounded-lg p-3 text-center text-xs text-muted-foreground">
                    Nenhum lead
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="bg-card border border-border/30 rounded-xl overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-muted/30 text-xs text-muted-foreground border-b border-border/20">
                <th className="text-left px-4 py-3 font-medium">Empresa / Contato</th>
                <th className="text-left px-4 py-3 font-medium hidden sm:table-cell">Cidade</th>
                <th className="text-left px-4 py-3 font-medium">Estágio</th>
                <th className="text-left px-4 py-3 font-medium hidden md:table-cell">Cotação</th>
                <th className="text-left px-4 py-3 font-medium hidden md:table-cell">Atualizado</th>
              </tr>
            </thead>
            <tbody>
              {leads.map((lead) => {
                const stage = getStageConfig(lead.stage);
                const hasQuotationValue =
                  lead.hasQuotation &&
                  lead.latestQuotation?.totalValue &&
                  Number(lead.latestQuotation.totalValue) > 0;
                return (
                  <tr
                    key={lead.id}
                    className="border-t border-border/20 hover:bg-muted/20 cursor-pointer transition-colors"
                    onClick={() => setSelectedLeadId(lead.id)}
                  >
                    <td className="px-4 py-3">
                      <p className="font-medium truncate max-w-[200px]">{lead.name}</p>
                      {lead.company && (
                        <p className="text-xs text-muted-foreground truncate">{lead.company}</p>
                      )}
                    </td>
                    <td className="px-4 py-3 text-muted-foreground hidden sm:table-cell">
                      {lead.city && lead.state ? `${lead.city}, ${lead.state}` : lead.city || lead.state || "—"}
                    </td>
                    <td className="px-4 py-3">
                      <Badge variant="outline" className={`text-xs ${stage.color}`}>
                        {stage.label}
                      </Badge>
                    </td>
                    <td className="px-4 py-3 hidden md:table-cell">
                      {lead.hasQuotation ? (
                        <div className="flex items-center gap-1 text-primary text-xs">
                          <FileText className="w-3 h-3" />
                          {hasQuotationValue
                            ? formatCurrency(Number(lead.latestQuotation!.totalValue))
                            : "Sim"}
                        </div>
                      ) : (
                        <span className="text-muted-foreground text-xs">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-muted-foreground hidden md:table-cell text-xs">
                      {formatDate(lead.updatedAt)}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Plus className="w-5 h-5 text-primary" /> Indicar Novo Lead
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <p className="text-xs text-muted-foreground">
              Indique um novo anunciante. Após o envio, nossa equipe entrará em contato e você poderá acompanhar o progresso aqui.
            </p>

            <div className="grid grid-cols-1 gap-3">
              <div className="space-y-1">
                <Label className="text-xs">Nome da Empresa <span className="text-destructive">*</span></Label>
                <Input
                  placeholder="Ex: Padaria São João Ltda"
                  value={formData.company}
                  onChange={(e) => setFormData({ ...formData, company: e.target.value })}
                />
              </div>

              <div className="space-y-1">
                <Label className="text-xs">Nome do Responsável</Label>
                <Input
                  placeholder="Ex: João Silva"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                />
              </div>

              <div className="space-y-1">
                <Label className="text-xs">CNPJ</Label>
                <Input
                  placeholder="00.000.000/0000-00"
                  value={formData.cnpj}
                  onChange={(e) => setFormData({ ...formData, cnpj: e.target.value })}
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label className="text-xs">Cidade</Label>
                  <Input
                    placeholder="São Paulo"
                    value={formData.city}
                    onChange={(e) => setFormData({ ...formData, city: e.target.value })}
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Estado</Label>
                  <Input
                    placeholder="SP"
                    maxLength={2}
                    value={formData.state}
                    onChange={(e) => setFormData({ ...formData, state: e.target.value.toUpperCase() })}
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label className="text-xs">Telefone / WhatsApp</Label>
                  <Input
                    placeholder="(11) 99999-9999"
                    value={formData.contactPhone}
                    onChange={(e) => setFormData({ ...formData, contactPhone: e.target.value })}
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">E-mail</Label>
                  <Input
                    type="email"
                    placeholder="contato@empresa.com"
                    value={formData.contactEmail}
                    onChange={(e) => setFormData({ ...formData, contactEmail: e.target.value })}
                  />
                </div>
              </div>

              <div className="space-y-1">
                <Label className="text-xs">Nome do Contato na Empresa</Label>
                <Input
                  placeholder="Ex: Maria Souza"
                  value={formData.contactName}
                  onChange={(e) => setFormData({ ...formData, contactName: e.target.value })}
                />
              </div>

              <div className="space-y-1">
                <Label className="text-xs">Observações</Label>
                <Textarea
                  placeholder="Contexto do lead, como conheceu, interesse, etc."
                  value={formData.notes}
                  onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                  rows={3}
                />
              </div>
            </div>
          </div>

          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setCreateOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={handleSubmit} disabled={createMutation.isPending} className="gap-2">
              {createMutation.isPending && <Loader2 className="w-4 h-4 animate-spin" />}
              Indicar Lead
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
