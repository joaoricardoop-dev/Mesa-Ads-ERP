import { useState, useEffect } from "react";
import PageContainer from "@/components/PageContainer";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Switch } from "@/components/ui/switch";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { toast } from "sonner";
import { FileText, Plus, Pencil, Trash2, Eye, EyeOff, Link2, Copy, ExternalLink, FileSignature } from "lucide-react";
import RichTextEditor from "@/components/RichTextEditor";

const ROLE_OPTIONS = [
  { key: "restaurante", label: "Local", color: "bg-emerald-500/20 text-emerald-400 border-emerald-500/30" },
  { key: "anunciante", label: "Anunciante", color: "bg-blue-500/20 text-blue-400 border-blue-500/30" },
];

interface TemplateForm {
  title: string;
  content: string;
  requiredFor: string[];
  isActive: boolean;
}

const emptyForm: TemplateForm = { title: "", content: "", requiredFor: [], isActive: true };

export default function TermTemplates() {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [form, setForm] = useState<TemplateForm>(emptyForm);
  const [deleteId, setDeleteId] = useState<number | null>(null);

  const utils = trpc.useUtils();
  const { data: templates = [], isLoading } = trpc.termTemplate.list.useQuery();

  const createMutation = trpc.termTemplate.create.useMutation({
    onSuccess: () => {
      utils.termTemplate.list.invalidate();
      setDialogOpen(false);
      setForm(emptyForm);
      toast.success("Template criado com sucesso!");
    },
    onError: (err) => toast.error(`Erro: ${err.message}`),
  });

  const updateMutation = trpc.termTemplate.update.useMutation({
    onSuccess: () => {
      utils.termTemplate.list.invalidate();
      setDialogOpen(false);
      setEditingId(null);
      setForm(emptyForm);
      toast.success("Template atualizado!");
    },
    onError: (err) => toast.error(`Erro: ${err.message}`),
  });

  const deleteMutation = trpc.termTemplate.delete.useMutation({
    onSuccess: () => {
      utils.termTemplate.list.invalidate();
      setDeleteId(null);
      toast.success("Template excluído!");
    },
    onError: (err) => toast.error(`Erro: ${err.message}`),
  });

  // ── Documentos contratuais (contrato master + termo de campanha) ────────────
  const { data: contractDocs } = trpc.termTemplate.getContractDocs.useQuery();
  const [masterUrl, setMasterUrl] = useState("");
  const [masterUrlDirty, setMasterUrlDirty] = useState(false);
  const [campaignDialogOpen, setCampaignDialogOpen] = useState(false);
  const [campaignForm, setCampaignForm] = useState<{ title: string; content: string; isActive: boolean }>({
    title: "",
    content: "",
    isActive: true,
  });

  useEffect(() => {
    if (contractDocs && !masterUrlDirty) {
      setMasterUrl(contractDocs.masterContractUrl ?? "");
    }
  }, [contractDocs, masterUrlDirty]);

  const updateMasterUrlMutation = trpc.termTemplate.updateMasterContractUrl.useMutation({
    onSuccess: () => {
      utils.termTemplate.getContractDocs.invalidate();
      utils.termTemplate.getContractLinks.invalidate();
      setMasterUrlDirty(false);
      toast.success("URL do contrato master atualizada!");
    },
    onError: (err) => toast.error(`Erro: ${err.message}`),
  });

  const updateCampaignTermMutation = trpc.termTemplate.updateCampaignTerm.useMutation({
    onSuccess: () => {
      utils.termTemplate.getContractDocs.invalidate();
      utils.termTemplate.getContractLinks.invalidate();
      setCampaignDialogOpen(false);
      toast.success("Termo de campanha atualizado!");
    },
    onError: (err) => toast.error(`Erro: ${err.message}`),
  });

  function openCampaignEdit() {
    if (!contractDocs?.campaignTerm) return;
    setCampaignForm({
      title: contractDocs.campaignTerm.title,
      content: contractDocs.campaignTerm.content,
      isActive: contractDocs.campaignTerm.isActive,
    });
    setCampaignDialogOpen(true);
  }

  function handleSaveCampaignTerm() {
    if (!campaignForm.title.trim() || !campaignForm.content.trim()) {
      toast.error("Título e conteúdo são obrigatórios.");
      return;
    }
    updateCampaignTermMutation.mutate({
      title: campaignForm.title,
      content: campaignForm.content,
      isActive: campaignForm.isActive,
    });
  }

  function copyPublicUrl(url: string) {
    navigator.clipboard.writeText(url).then(
      () => toast.success("Link copiado!"),
      () => toast.error("Não foi possível copiar o link."),
    );
  }

  function openCreate() {
    setEditingId(null);
    setForm(emptyForm);
    setDialogOpen(true);
  }

  function openEdit(template: any) {
    setEditingId(template.id);
    let requiredFor: string[] = [];
    try { requiredFor = JSON.parse(template.requiredFor); } catch {}
    setForm({
      title: template.title,
      content: template.content,
      requiredFor,
      isActive: template.isActive,
    });
    setDialogOpen(true);
  }

  function handleSave() {
    if (!form.title.trim() || !form.content.trim()) {
      toast.error("Título e conteúdo são obrigatórios.");
      return;
    }
    if (form.requiredFor.length === 0) {
      toast.error("Selecione ao menos um tipo de usuário obrigatório.");
      return;
    }
    if (editingId) {
      updateMutation.mutate({ id: editingId, ...form });
    } else {
      createMutation.mutate(form);
    }
  }

  function toggleRole(roleKey: string) {
    setForm((prev) => ({
      ...prev,
      requiredFor: prev.requiredFor.includes(roleKey)
        ? prev.requiredFor.filter((r) => r !== roleKey)
        : [...prev.requiredFor, roleKey],
    }));
  }

  const isSaving = createMutation.isPending || updateMutation.isPending;
  const genericTemplates = templates.filter((t) => !(t as any).slug);

  return (
    <PageContainer
      title="Termos Padrão"
      description="Gerencie templates de termos e defina quais tipos de usuários devem assinar obrigatoriamente"
      actions={
        <Button onClick={openCreate}>
          <Plus className="w-4 h-4 mr-2" />
          Novo Template
        </Button>
      }
    >
      {/* ── Documentos contratuais ─────────────────────────────────────────── */}
      <div className="bg-card border border-border/30 rounded-lg p-5 mb-6 space-y-5">
        <div className="flex items-center gap-3">
          <FileSignature className="w-5 h-5 text-primary flex-shrink-0" />
          <div>
            <h3 className="text-sm font-semibold">Documentos contratuais</h3>
            <p className="text-xs text-muted-foreground">
              Referenciados automaticamente em todas as propostas e ordens de serviço.
            </p>
          </div>
        </div>

        {/* Contrato master */}
        <div className="space-y-2">
          <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Contrato master (Termos e Condições Gerais)
          </Label>
          <div className="flex flex-col sm:flex-row gap-2">
            <Input
              value={masterUrl}
              onChange={(e) => {
                setMasterUrl(e.target.value);
                setMasterUrlDirty(true);
              }}
              placeholder="https://..."
              className="flex-1"
            />
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => masterUrl && window.open(masterUrl, "_blank", "noopener")}
                disabled={!masterUrl}
                title="Abrir contrato master"
              >
                <ExternalLink className="w-4 h-4" />
              </Button>
              <Button
                size="sm"
                onClick={() => updateMasterUrlMutation.mutate({ url: masterUrl.trim() })}
                disabled={!masterUrlDirty || updateMasterUrlMutation.isPending}
              >
                Salvar URL
              </Button>
            </div>
          </div>
        </div>

        {/* Termo de contratação de campanha */}
        <div className="space-y-2 border-t border-border/30 pt-4">
          <div className="flex items-center gap-2 flex-wrap">
            <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Termo de Contratação de Campanha Publicitária
            </Label>
            {contractDocs?.campaignTerm && (
              <Badge variant="outline" className="text-[10px] px-1.5 py-0 font-mono">
                v{contractDocs.campaignTerm.version}
              </Badge>
            )}
            {contractDocs?.campaignTerm && !contractDocs.campaignTerm.isActive && (
              <Badge variant="outline" className="text-[10px] px-1.5 py-0 bg-red-500/10 text-red-400 border-red-500/30">
                Inativo
              </Badge>
            )}
          </div>
          {contractDocs?.campaignTerm ? (
            <>
              <div className="flex flex-col sm:flex-row gap-2 items-stretch sm:items-center">
                <div className="flex-1 flex items-center gap-2 min-w-0 bg-muted/40 rounded-md px-3 py-2">
                  <Link2 className="w-3.5 h-3.5 text-muted-foreground flex-shrink-0" />
                  <span className="text-xs text-muted-foreground truncate">
                    {contractDocs.campaignTerm.publicUrl}
                  </span>
                </div>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => copyPublicUrl(contractDocs.campaignTerm!.publicUrl)}
                    title="Copiar link público"
                  >
                    <Copy className="w-4 h-4" />
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => window.open(contractDocs.campaignTerm!.publicUrl, "_blank", "noopener")}
                    title="Abrir link público"
                  >
                    <ExternalLink className="w-4 h-4" />
                  </Button>
                  <Button size="sm" onClick={openCampaignEdit}>
                    <Pencil className="w-4 h-4 mr-2" />
                    Editar conteúdo
                  </Button>
                </div>
              </div>
            </>
          ) : (
            <p className="text-xs text-muted-foreground">Termo de campanha não encontrado.</p>
          )}
        </div>
      </div>

      {isLoading ? (
        <div className="text-center text-muted-foreground py-12">Carregando...</div>
      ) : genericTemplates.length === 0 ? (
        <div className="text-center py-16 space-y-3">
          <FileText className="w-12 h-12 text-muted-foreground/40 mx-auto" />
          <p className="text-muted-foreground">Nenhum template cadastrado</p>
          <Button variant="outline" onClick={openCreate}>
            <Plus className="w-4 h-4 mr-2" />
            Criar primeiro template
          </Button>
        </div>
      ) : (
        <div className="grid gap-4">
          {genericTemplates.map((template) => {
            let roles: string[] = [];
            try { roles = JSON.parse(template.requiredFor); } catch {}
            return (
              <div
                key={template.id}
                className={`bg-card border border-border/30 rounded-lg p-5 transition-opacity ${!template.isActive ? "opacity-50" : ""}`}
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-3 mb-2">
                      <FileText className="w-5 h-5 text-primary flex-shrink-0" />
                      <h3 className="text-sm font-semibold truncate">{template.title}</h3>
                      <Badge variant="outline" className="text-[10px] px-1.5 py-0 font-mono">
                        v{template.version}
                      </Badge>
                      {!template.isActive && (
                        <Badge variant="outline" className="text-[10px] px-1.5 py-0 bg-red-500/10 text-red-400 border-red-500/30">
                          Inativo
                        </Badge>
                      )}
                    </div>
                    <div className="flex items-center gap-2 mb-2">
                      <span className="text-[10px] text-muted-foreground uppercase tracking-wider">Obrigatório para:</span>
                      {roles.map((role) => {
                        const opt = ROLE_OPTIONS.find((r) => r.key === role);
                        return (
                          <Badge key={role} variant="outline" className={`text-[10px] px-1.5 py-0 ${opt?.color || ""}`}>
                            {opt?.label || role}
                          </Badge>
                        );
                      })}
                    </div>
                    <p className="text-xs text-muted-foreground line-clamp-2">
                      {template.content.replace(/<[^>]*>/g, "").substring(0, 200)}{template.content.length > 200 ? "..." : ""}
                    </p>
                  </div>
                  <div className="flex items-center gap-1 flex-shrink-0">
                    <Button variant="ghost" size="sm" className="h-8 w-8 p-0" onClick={() => openEdit(template)}>
                      <Pencil className="w-3.5 h-3.5" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-8 w-8 p-0 text-red-400 hover:text-red-300 hover:bg-red-500/10"
                      onClick={() => setDeleteId(template.id)}
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </Button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="bg-card border-border/30 max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FileText className="w-5 h-5 text-primary" />
              {editingId ? "Editar Template" : "Novo Template"}
            </DialogTitle>
            <DialogDescription>
              {editingId ? "Atualize o conteúdo do template. Alterar o conteúdo incrementa a versão." : "Crie um novo template de termo para uso no onboarding e portais."}
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-4 py-2">
            <div className="grid gap-2">
              <Label>Título *</Label>
              <Input
                value={form.title}
                onChange={(e) => setForm({ ...form, title: e.target.value })}
                placeholder="Ex: Termo de Parceria Local"
                className="bg-background border-border/30"
              />
            </div>

            <div className="grid gap-2">
              <Label>Obrigatório para *</Label>
              <div className="flex gap-4">
                {ROLE_OPTIONS.map((role) => (
                  <label key={role.key} className="flex items-center gap-2 cursor-pointer">
                    <Checkbox
                      checked={form.requiredFor.includes(role.key)}
                      onCheckedChange={() => toggleRole(role.key)}
                    />
                    <span className="text-sm">{role.label}</span>
                  </label>
                ))}
              </div>
            </div>

            <div className="grid gap-2">
              <Label>Conteúdo do Termo *</Label>
              <RichTextEditor
                value={form.content}
                onChange={(html) => setForm({ ...form, content: html })}
                placeholder="Digite o conteúdo completo do termo..."
              />
            </div>

            <div className="flex items-center gap-3">
              <Switch
                checked={form.isActive}
                onCheckedChange={(checked) => setForm({ ...form, isActive: checked })}
              />
              <Label className="flex items-center gap-2 cursor-pointer">
                {form.isActive ? <Eye className="w-4 h-4 text-primary" /> : <EyeOff className="w-4 h-4 text-muted-foreground" />}
                {form.isActive ? "Ativo" : "Inativo"}
              </Label>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={handleSave} disabled={isSaving}>
              {isSaving ? "Salvando..." : editingId ? "Salvar Alterações" : "Criar Template"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={campaignDialogOpen} onOpenChange={setCampaignDialogOpen}>
        <DialogContent className="bg-card border-border/30 max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FileSignature className="w-5 h-5 text-primary" />
              Editar Termo de Contratação de Campanha
            </DialogTitle>
            <DialogDescription>
              Este conteúdo é exibido no link público e referenciado nas propostas e ordens de serviço. Alterar o conteúdo incrementa a versão.
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-4 py-2">
            <div className="grid gap-2">
              <Label>Título *</Label>
              <Input
                value={campaignForm.title}
                onChange={(e) => setCampaignForm({ ...campaignForm, title: e.target.value })}
                placeholder="Ex: Termo de Contratação de Campanha Publicitária"
                className="bg-background border-border/30"
              />
            </div>

            <div className="grid gap-2">
              <Label>Conteúdo do Termo *</Label>
              <RichTextEditor
                value={campaignForm.content}
                onChange={(html) => setCampaignForm({ ...campaignForm, content: html })}
                placeholder="Digite o conteúdo completo do termo..."
              />
            </div>

            <div className="flex items-center gap-3">
              <Switch
                checked={campaignForm.isActive}
                onCheckedChange={(checked) => setCampaignForm({ ...campaignForm, isActive: checked })}
              />
              <Label className="flex items-center gap-2 cursor-pointer">
                {campaignForm.isActive ? <Eye className="w-4 h-4 text-primary" /> : <EyeOff className="w-4 h-4 text-muted-foreground" />}
                {campaignForm.isActive ? "Ativo (link público acessível)" : "Inativo (link público indisponível)"}
              </Label>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setCampaignDialogOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={handleSaveCampaignTerm} disabled={updateCampaignTermMutation.isPending}>
              {updateCampaignTermMutation.isPending ? "Salvando..." : "Salvar Alterações"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!deleteId} onOpenChange={(open) => !open && setDeleteId(null)}>
        <AlertDialogContent className="bg-card border-border/30">
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir template?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta ação é irreversível. O template será removido permanentemente.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => deleteId && deleteMutation.mutate({ id: deleteId })}
            >
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </PageContainer>
  );
}
