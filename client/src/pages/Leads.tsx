import { useState, useEffect } from "react";
import PageContainer from "@/components/PageContainer";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Plus,
  Phone,
  Mail,
  MessageCircle,
  MapPin,
  StickyNote,
  ChevronRight,
  ChevronLeft,
  Building2,
  UtensilsCrossed,
  User,
  Calendar,
  Tag,
  Clock,
  Trash2,
  Pencil,
  Check,
  X,
} from "lucide-react";
import { toast } from "sonner";

const STAGES = [
  { key: "novo", label: "Novo", color: "bg-blue-500/10 text-blue-500 border-blue-500/20" },
  { key: "contato", label: "Contato", color: "bg-yellow-500/10 text-yellow-500 border-yellow-500/20" },
  { key: "qualificado", label: "Qualificado", color: "bg-purple-500/10 text-purple-500 border-purple-500/20" },
  { key: "proposta", label: "Proposta", color: "bg-orange-500/10 text-orange-500 border-orange-500/20" },
  { key: "negociacao", label: "Negociação", color: "bg-cyan-500/10 text-cyan-500 border-cyan-500/20" },
  { key: "ganho", label: "Ganho", color: "bg-green-500/10 text-green-500 border-green-500/20" },
  { key: "perdido", label: "Perdido", color: "bg-red-500/10 text-red-500 border-red-500/20" },
] as const;

const INTERACTION_TYPES = [
  { key: "call", label: "Ligação", icon: Phone },
  { key: "email", label: "E-mail", icon: Mail },
  { key: "whatsapp", label: "WhatsApp", icon: MessageCircle },
  { key: "visit", label: "Visita", icon: MapPin },
  { key: "note", label: "Nota", icon: StickyNote },
];

const ORIGINS = [
  "Indicação",
  "Site",
  "Instagram",
  "LinkedIn",
  "Telefone",
  "Evento",
  "Prospecção Ativa",
  "Outro",
];

type LeadType = "anunciante" | "restaurante";

interface LeadFormData {
  type: LeadType;
  name: string;
  company: string;
  contactName: string;
  contactPhone: string;
  contactEmail: string;
  contactWhatsApp: string;
  origin: string;
  tags: string;
  notes: string;
}

const emptyForm: LeadFormData = {
  type: "anunciante",
  name: "",
  company: "",
  contactName: "",
  contactPhone: "",
  contactEmail: "",
  contactWhatsApp: "",
  origin: "",
  tags: "",
  notes: "",
};

export default function Leads() {
  const [activeTab, setActiveTab] = useState<LeadType>("anunciante");
  const [createOpen, setCreateOpen] = useState(false);
  const [formData, setFormData] = useState<LeadFormData>(emptyForm);
  const [selectedLeadId, setSelectedLeadId] = useState<number | null>(null);
  const [interactionType, setInteractionType] = useState("note");
  const [interactionContent, setInteractionContent] = useState("");
  const [isEditing, setIsEditing] = useState(false);
  const [editData, setEditData] = useState<LeadFormData>(emptyForm);

  const utils = trpc.useUtils();

  const leadsQuery = trpc.lead.list.useQuery({ type: activeTab });
  const leads = leadsQuery.data ?? [];

  const selectedLead = trpc.lead.get.useQuery(
    { id: selectedLeadId! },
    { enabled: !!selectedLeadId }
  );

  const interactions = trpc.lead.listInteractions.useQuery(
    { leadId: selectedLeadId! },
    { enabled: !!selectedLeadId }
  );

  const createMutation = trpc.lead.create.useMutation({
    onSuccess: () => {
      toast.success("Lead criado com sucesso");
      setCreateOpen(false);
      setFormData(emptyForm);
      utils.lead.list.invalidate();
    },
    onError: (err) => toast.error(err.message),
  });

  const changeStageMutation = trpc.lead.changeStage.useMutation({
    onSuccess: () => {
      utils.lead.list.invalidate();
      utils.lead.get.invalidate();
      utils.lead.listInteractions.invalidate();
    },
    onError: (err) => toast.error(err.message),
  });

  const addInteractionMutation = trpc.lead.addInteraction.useMutation({
    onSuccess: () => {
      setInteractionContent("");
      utils.lead.listInteractions.invalidate();
      toast.success("Interação registrada");
    },
    onError: (err) => toast.error(err.message),
  });

  const deleteMutation = trpc.lead.delete.useMutation({
    onSuccess: () => {
      toast.success("Lead removido");
      setSelectedLeadId(null);
      utils.lead.list.invalidate();
    },
    onError: (err) => toast.error(err.message),
  });

  const updateMutation = trpc.lead.update.useMutation({
    onSuccess: () => {
      toast.success("Lead atualizado");
      setIsEditing(false);
      utils.lead.list.invalidate();
      utils.lead.get.invalidate();
    },
    onError: (err) => toast.error(err.message),
  });

  useEffect(() => {
    if (selectedLead.data && isEditing) {
      setEditData({
        type: selectedLead.data.type as LeadType,
        name: selectedLead.data.name ?? "",
        company: selectedLead.data.company ?? "",
        contactName: selectedLead.data.contactName ?? "",
        contactPhone: selectedLead.data.contactPhone ?? "",
        contactEmail: selectedLead.data.contactEmail ?? "",
        contactWhatsApp: selectedLead.data.contactWhatsApp ?? "",
        origin: selectedLead.data.origin ?? "",
        tags: selectedLead.data.tags ?? "",
        notes: selectedLead.data.notes ?? "",
      });
    }
  }, [isEditing, selectedLead.data]);

  function handleCreate() {
    if (!formData.name.trim()) {
      toast.error("Nome é obrigatório");
      return;
    }
    createMutation.mutate({ ...formData, type: activeTab });
  }

  function handleUpdate() {
    if (!selectedLeadId) return;
    if (!editData.name.trim()) {
      toast.error("Nome é obrigatório");
      return;
    }
    updateMutation.mutate({ id: selectedLeadId, ...editData });
  }

  function startEditing() {
    if (!selectedLead.data) return;
    setIsEditing(true);
  }

  function cancelEditing() {
    setIsEditing(false);
  }

  function moveStage(leadId: number, currentStage: string, direction: "next" | "prev") {
    const idx = STAGES.findIndex((s) => s.key === currentStage);
    if (idx === -1) return;
    const newIdx = direction === "next" ? idx + 1 : idx - 1;
    if (newIdx < 0 || newIdx >= STAGES.length) return;
    changeStageMutation.mutate({ id: leadId, stage: STAGES[newIdx].key });
  }

  function moveToStage(leadId: number, stage: string) {
    changeStageMutation.mutate({ id: leadId, stage });
  }

  function handleAddInteraction() {
    if (!selectedLeadId || !interactionContent.trim()) return;
    addInteractionMutation.mutate({
      leadId: selectedLeadId,
      type: interactionType,
      content: interactionContent,
    });
  }

  function getStageConfig(stage: string) {
    return STAGES.find((s) => s.key === stage) ?? STAGES[0];
  }

  function formatDate(d: string | Date | null | undefined) {
    if (!d) return "—";
    return new Date(d).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "2-digit" });
  }

  function formatDateTime(d: string | Date | null | undefined) {
    if (!d) return "—";
    return new Date(d).toLocaleDateString("pt-BR", {
      day: "2-digit",
      month: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    });
  }

  const leadsByStage = STAGES.map((stage) => ({
    ...stage,
    leads: leads.filter((l) => l.stage === stage.key),
  }));

  function renderLeadForm(data: LeadFormData, setData: (d: LeadFormData) => void) {
    return (
      <div className="grid gap-3">
        <div className="grid gap-1.5">
          <Label className="text-xs">Nome *</Label>
          <Input
            value={data.name}
            onChange={(e) => setData({ ...data, name: e.target.value })}
            placeholder="Nome do lead"
            className="h-8 text-sm"
          />
        </div>

        <div className="grid gap-1.5">
          <Label className="text-xs">Empresa</Label>
          <Input
            value={data.company}
            onChange={(e) => setData({ ...data, company: e.target.value })}
            placeholder="Nome da empresa"
            className="h-8 text-sm"
          />
        </div>

        <div className="grid grid-cols-2 gap-2">
          <div className="grid gap-1.5">
            <Label className="text-xs">Contato</Label>
            <Input
              value={data.contactName}
              onChange={(e) => setData({ ...data, contactName: e.target.value })}
              placeholder="Nome do contato"
              className="h-8 text-sm"
            />
          </div>
          <div className="grid gap-1.5">
            <Label className="text-xs">Telefone</Label>
            <Input
              value={data.contactPhone}
              onChange={(e) => setData({ ...data, contactPhone: e.target.value })}
              placeholder="(00) 00000-0000"
              className="h-8 text-sm"
            />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-2">
          <div className="grid gap-1.5">
            <Label className="text-xs">E-mail</Label>
            <Input
              value={data.contactEmail}
              onChange={(e) => setData({ ...data, contactEmail: e.target.value })}
              placeholder="email@exemplo.com"
              className="h-8 text-sm"
            />
          </div>
          <div className="grid gap-1.5">
            <Label className="text-xs">WhatsApp</Label>
            <Input
              value={data.contactWhatsApp}
              onChange={(e) => setData({ ...data, contactWhatsApp: e.target.value })}
              placeholder="(00) 00000-0000"
              className="h-8 text-sm"
            />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-2">
          <div className="grid gap-1.5">
            <Label className="text-xs">Origem</Label>
            <Select
              value={data.origin}
              onValueChange={(v) => setData({ ...data, origin: v })}
            >
              <SelectTrigger className="h-8 text-sm">
                <SelectValue placeholder="Selecione" />
              </SelectTrigger>
              <SelectContent>
                {ORIGINS.map((o) => (
                  <SelectItem key={o} value={o}>{o}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="grid gap-1.5">
            <Label className="text-xs">Tags</Label>
            <Input
              value={data.tags}
              onChange={(e) => setData({ ...data, tags: e.target.value })}
              placeholder="tag1, tag2"
              className="h-8 text-sm"
            />
          </div>
        </div>

        <div className="grid gap-1.5">
          <Label className="text-xs">Observações</Label>
          <Textarea
            value={data.notes}
            onChange={(e) => setData({ ...data, notes: e.target.value })}
            placeholder="Observações..."
            rows={2}
            className="text-sm"
          />
        </div>
      </div>
    );
  }

  return (
    <PageContainer
      title="Leads"
      description="CRM e pipeline de vendas"
      actions={
        <Button size="sm" onClick={() => { setFormData({ ...emptyForm, type: activeTab }); setCreateOpen(true); }}>
          <Plus className="w-4 h-4 mr-1" />
          Novo Lead
        </Button>
      }
    >
      <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as LeadType)}>
        <TabsList>
          <TabsTrigger value="anunciante" className="gap-1.5">
            <Building2 className="w-3.5 h-3.5" />
            Anunciantes
          </TabsTrigger>
          <TabsTrigger value="restaurante" className="gap-1.5">
            <UtensilsCrossed className="w-3.5 h-3.5" />
            Restaurantes
          </TabsTrigger>
        </TabsList>

        <TabsContent value={activeTab} className="mt-4">
          <div className="overflow-x-auto pb-4 -mx-2 px-2">
            <div className="inline-flex gap-3">
              {leadsByStage.map((column) => (
                <div key={column.key} className="w-[240px] shrink-0">
                  <div className="flex items-center gap-2 mb-3 px-1">
                    <Badge variant="outline" className={`text-[10px] px-1.5 py-0 ${column.color}`}>
                      {column.label}
                    </Badge>
                    <span className="text-[10px] text-muted-foreground font-medium">
                      {column.leads.length}
                    </span>
                  </div>

                  <div className="space-y-2 min-h-[120px]">
                    {column.leads.map((lead) => (
                      <Card
                        key={lead.id}
                        className="p-2.5 cursor-pointer hover:border-primary/40 transition-colors group"
                        onClick={() => { setSelectedLeadId(lead.id); setIsEditing(false); }}
                      >
                        <div className="min-w-0">
                          <p className="text-xs font-medium truncate leading-tight">{lead.name}</p>
                          {lead.company && (
                            <p className="text-[10px] text-muted-foreground truncate mt-0.5">{lead.company}</p>
                          )}
                        </div>

                        {lead.contactPhone && (
                          <div className="flex items-center gap-1 mt-1.5">
                            <Phone className="w-2.5 h-2.5 text-muted-foreground shrink-0" />
                            <span className="text-[10px] text-muted-foreground truncate">{lead.contactPhone}</span>
                          </div>
                        )}

                        {lead.origin && (
                          <div className="mt-1.5">
                            <Badge variant="secondary" className="text-[9px] h-3.5 px-1">
                              {lead.origin}
                            </Badge>
                          </div>
                        )}

                        <div className="flex items-center justify-between mt-1.5 opacity-0 group-hover:opacity-100 transition-opacity">
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-5 w-5"
                            onClick={(e) => { e.stopPropagation(); moveStage(lead.id, lead.stage, "prev"); }}
                            disabled={column.key === "novo"}
                          >
                            <ChevronLeft className="w-3 h-3" />
                          </Button>
                          <span className="text-[9px] text-muted-foreground">
                            {formatDate(lead.updatedAt)}
                          </span>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-5 w-5"
                            onClick={(e) => { e.stopPropagation(); moveStage(lead.id, lead.stage, "next"); }}
                            disabled={column.key === "perdido"}
                          >
                            <ChevronRight className="w-3 h-3" />
                          </Button>
                        </div>
                      </Card>
                    ))}

                    {column.leads.length === 0 && (
                      <div className="flex items-center justify-center h-[80px] rounded-lg border border-dashed border-border/40">
                        <p className="text-[10px] text-muted-foreground">Nenhum lead</p>
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </TabsContent>
      </Tabs>

      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Novo Lead — {activeTab === "anunciante" ? "Anunciante" : "Restaurante"}</DialogTitle>
          </DialogHeader>
          {renderLeadForm(formData, setFormData)}
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateOpen(false)}>Cancelar</Button>
            <Button onClick={handleCreate} disabled={createMutation.isPending}>
              {createMutation.isPending ? "Criando..." : "Criar Lead"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Sheet open={!!selectedLeadId} onOpenChange={(open) => { if (!open) { setSelectedLeadId(null); setIsEditing(false); } }}>
        <SheetContent className="w-full sm:max-w-md overflow-y-auto">
          {selectedLead.data && (
            <>
              <SheetHeader>
                <div className="flex items-center justify-between">
                  <SheetTitle className="flex items-center gap-2 text-base">
                    {selectedLead.data.type === "anunciante" ? (
                      <Building2 className="w-4 h-4 shrink-0" />
                    ) : (
                      <UtensilsCrossed className="w-4 h-4 shrink-0" />
                    )}
                    <span className="truncate">{selectedLead.data.name}</span>
                  </SheetTitle>
                  {!isEditing && (
                    <Button variant="outline" size="sm" className="gap-1 shrink-0 ml-2" onClick={startEditing}>
                      <Pencil className="w-3 h-3" />
                      Editar
                    </Button>
                  )}
                </div>
              </SheetHeader>

              <div className="mt-4 space-y-4">
                <div>
                  <div className="flex items-center gap-2 mb-2">
                    <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Estágio</span>
                    <Badge variant="outline" className={`text-[10px] ${getStageConfig(selectedLead.data.stage).color}`}>
                      {getStageConfig(selectedLead.data.stage).label}
                    </Badge>
                  </div>
                  <div className="flex flex-wrap gap-1">
                    {STAGES.map((stage) => (
                      <Button
                        key={stage.key}
                        variant={selectedLead.data!.stage === stage.key ? "default" : "outline"}
                        size="sm"
                        className="text-[10px] h-6 px-2"
                        onClick={() => moveToStage(selectedLead.data!.id, stage.key)}
                        disabled={selectedLead.data!.stage === stage.key}
                      >
                        {stage.label}
                      </Button>
                    ))}
                  </div>
                </div>

                <Separator />

                {isEditing ? (
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Editar Informações</span>
                    </div>
                    {renderLeadForm(editData, setEditData)}
                    <div className="flex items-center gap-2 pt-1">
                      <Button size="sm" className="gap-1 flex-1" onClick={handleUpdate} disabled={updateMutation.isPending}>
                        <Check className="w-3 h-3" />
                        {updateMutation.isPending ? "Salvando..." : "Salvar"}
                      </Button>
                      <Button variant="outline" size="sm" className="gap-1" onClick={cancelEditing}>
                        <X className="w-3 h-3" />
                        Cancelar
                      </Button>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-2">
                    <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Informações</span>
                    <div className="grid gap-1.5 text-sm">
                      {selectedLead.data.company && (
                        <div className="flex items-center gap-2">
                          <Building2 className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                          <span className="truncate">{selectedLead.data.company}</span>
                        </div>
                      )}
                      {selectedLead.data.contactName && (
                        <div className="flex items-center gap-2">
                          <User className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                          <span className="truncate">{selectedLead.data.contactName}</span>
                        </div>
                      )}
                      {selectedLead.data.contactPhone && (
                        <div className="flex items-center gap-2">
                          <Phone className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                          <span className="truncate">{selectedLead.data.contactPhone}</span>
                        </div>
                      )}
                      {selectedLead.data.contactEmail && (
                        <div className="flex items-center gap-2">
                          <Mail className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                          <span className="truncate">{selectedLead.data.contactEmail}</span>
                        </div>
                      )}
                      {selectedLead.data.contactWhatsApp && (
                        <div className="flex items-center gap-2">
                          <MessageCircle className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                          <span className="truncate">{selectedLead.data.contactWhatsApp}</span>
                        </div>
                      )}
                      {selectedLead.data.origin && (
                        <div className="flex items-center gap-2">
                          <Tag className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                          <span className="truncate">{selectedLead.data.origin}</span>
                        </div>
                      )}
                      {selectedLead.data.tags && (
                        <div className="flex items-center gap-2">
                          <Tag className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                          <div className="flex flex-wrap gap-1">
                            {selectedLead.data.tags.split(",").map((t, i) => (
                              <Badge key={i} variant="secondary" className="text-[10px] h-4">{t.trim()}</Badge>
                            ))}
                          </div>
                        </div>
                      )}
                      {selectedLead.data.nextFollowUp && (
                        <div className="flex items-center gap-2">
                          <Calendar className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                          <span>Follow-up: {formatDate(selectedLead.data.nextFollowUp)}</span>
                        </div>
                      )}
                    </div>

                    {selectedLead.data.notes && (
                      <div className="mt-2 p-2 rounded bg-muted/30 text-xs text-muted-foreground whitespace-pre-wrap">
                        {selectedLead.data.notes}
                      </div>
                    )}

                    {!selectedLead.data.company && !selectedLead.data.contactName && !selectedLead.data.contactPhone && !selectedLead.data.contactEmail && (
                      <p className="text-xs text-muted-foreground italic">Nenhuma informação adicional. Clique em Editar para completar.</p>
                    )}
                  </div>
                )}

                <Separator />

                <div className="space-y-2">
                  <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Nova Interação</span>
                  <div className="flex gap-2">
                    <Select value={interactionType} onValueChange={setInteractionType}>
                      <SelectTrigger className="w-[120px] h-8 text-xs">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {INTERACTION_TYPES.map((t) => (
                          <SelectItem key={t.key} value={t.key}>
                            <span className="flex items-center gap-1.5">
                              <t.icon className="w-3 h-3" />
                              {t.label}
                            </span>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="flex gap-2">
                    <Textarea
                      value={interactionContent}
                      onChange={(e) => setInteractionContent(e.target.value)}
                      placeholder="Descreva a interação..."
                      rows={2}
                      className="flex-1 text-sm"
                    />
                    <Button
                      size="sm"
                      className="self-end h-8"
                      onClick={handleAddInteraction}
                      disabled={!interactionContent.trim() || addInteractionMutation.isPending}
                    >
                      Salvar
                    </Button>
                  </div>
                </div>

                <Separator />

                <div className="space-y-2">
                  <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Histórico</span>
                  <ScrollArea className="max-h-[250px]">
                    <div className="space-y-2.5">
                      {interactions.data?.map((interaction) => {
                        const typeConfig = INTERACTION_TYPES.find((t) => t.key === interaction.type);
                        const Icon = typeConfig?.icon ?? StickyNote;
                        return (
                          <div key={interaction.id} className="flex gap-2.5 text-sm">
                            <div className="shrink-0 w-6 h-6 rounded-full bg-muted flex items-center justify-center mt-0.5">
                              <Icon className="w-3 h-3 text-muted-foreground" />
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-1.5">
                                <span className="font-medium text-[10px]">{typeConfig?.label ?? interaction.type}</span>
                                <span className="text-[9px] text-muted-foreground flex items-center gap-0.5">
                                  <Clock className="w-2.5 h-2.5" />
                                  {formatDateTime(interaction.createdAt)}
                                </span>
                              </div>
                              {interaction.content && (
                                <p className="text-[11px] text-muted-foreground mt-0.5 whitespace-pre-wrap break-words">
                                  {interaction.content}
                                </p>
                              )}
                            </div>
                          </div>
                        );
                      })}

                      {(!interactions.data || interactions.data.length === 0) && (
                        <p className="text-xs text-muted-foreground text-center py-4">
                          Nenhuma interação registrada
                        </p>
                      )}
                    </div>
                  </ScrollArea>
                </div>

                <Separator />

                <div className="flex justify-end pb-2">
                  <Button
                    variant="destructive"
                    size="sm"
                    className="text-xs h-7"
                    onClick={() => {
                      if (confirm("Tem certeza que deseja remover este lead?")) {
                        deleteMutation.mutate({ id: selectedLead.data!.id });
                      }
                    }}
                  >
                    <Trash2 className="w-3 h-3 mr-1" />
                    Remover Lead
                  </Button>
                </div>
              </div>
            </>
          )}

          {selectedLead.isLoading && (
            <div className="flex items-center justify-center py-20">
              <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
            </div>
          )}
        </SheetContent>
      </Sheet>
    </PageContainer>
  );
}
