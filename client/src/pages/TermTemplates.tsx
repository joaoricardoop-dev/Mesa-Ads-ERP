import { useState } from "react";
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
import { FileText, Plus, Pencil, Trash2, Eye, EyeOff } from "lucide-react";
import RichTextEditor from "@/components/RichTextEditor";

const ROLE_OPTIONS = [
  { key: "restaurante", label: "Restaurante", color: "bg-emerald-500/20 text-emerald-400 border-emerald-500/30" },
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
      {isLoading ? (
        <div className="text-center text-muted-foreground py-12">Carregando...</div>
      ) : templates.length === 0 ? (
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
          {templates.map((template) => {
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
                placeholder="Ex: Termo de Parceria Restaurante"
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
