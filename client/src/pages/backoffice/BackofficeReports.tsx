import { useState } from "react";
import PageContainer from "@/components/PageContainer";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { toast } from "sonner";
import { Plus, FileBarChart } from "lucide-react";

const REPORT_LABELS: Record<string, string> = {
  relatoria_diaria_telas: "Relatoria diária — Telas",
  relatoria_semanal_telas: "Relatoria semanal — Telas",
  relatorio_semanal_bolachas: "Relatório semanal — Bolachas",
  relatorio_semanal_interno: "Relatório semanal — Interno",
  relatoria_mensal_telas: "Relatoria mensal — Telas",
  relatorio_mensal_geral: "Relatório mensal — Geral",
};

const EMPTY_FORM = {
  campaignId: "",
  reportType: "relatoria_semanal_telas",
  referenceLabel: "",
  recipientLabel: "",
  sentAt: new Date().toISOString().slice(0, 10),
  sentBy: "",
  linkUrl: "",
  notes: "",
};

export default function BackofficeReports() {
  const utils = trpc.useUtils();
  const { data: reports = [], isLoading } = trpc.backoffice.report.list.useQuery({});
  const { data: campaignsData } = trpc.campaign.list.useQuery();
  const campaignsList = campaignsData?.items ?? [];
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);

  const createReport = trpc.backoffice.report.create.useMutation({
    onSuccess: () => {
      utils.backoffice.report.list.invalidate();
      setOpen(false);
      setForm(EMPTY_FORM);
      toast.success("Relatório registrado!");
    },
    onError: (err) => toast.error(`Erro: ${err.message}`),
  });

  return (
    <PageContainer
      title="Relatórios"
      description="Log de toda relatoria enviada — diária, semanal e mensal."
      actions={<Button size="sm" onClick={() => setOpen(true)}><Plus className="w-4 h-4 mr-1.5" />Registrar envio</Button>}
    >
      <div className="rounded-lg border border-border/30 overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Enviado em</TableHead>
              <TableHead>Tipo</TableHead>
              <TableHead>Campanha</TableHead>
              <TableHead>Referência</TableHead>
              <TableHead>Destinatário</TableHead>
              <TableHead>Por</TableHead>
              <TableHead>Link</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow><TableCell colSpan={7} className="text-center text-muted-foreground py-8">Carregando...</TableCell></TableRow>
            ) : reports.length === 0 ? (
              <TableRow><TableCell colSpan={7} className="text-center text-muted-foreground py-8">
                <FileBarChart className="w-6 h-6 mx-auto mb-2 opacity-40" /> Nenhum relatório registrado ainda.
              </TableCell></TableRow>
            ) : (
              reports.map((r: any) => (
                <TableRow key={r.id}>
                  <TableCell className="text-xs">{r.sentAt}</TableCell>
                  <TableCell className="text-xs">{REPORT_LABELS[r.reportType] || r.reportType}</TableCell>
                  <TableCell className="text-xs text-muted-foreground">{r.campaignName || "—"}</TableCell>
                  <TableCell className="text-sm">{r.referenceLabel}</TableCell>
                  <TableCell className="text-xs text-muted-foreground">{r.recipientLabel || "—"}</TableCell>
                  <TableCell className="text-xs text-muted-foreground">{r.sentBy || "—"}</TableCell>
                  <TableCell className="text-xs">
                    {r.linkUrl ? <a href={r.linkUrl} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">abrir</a> : "—"}
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>Registrar envio de relatório</DialogTitle></DialogHeader>
          <div className="grid gap-3 py-2">
            <div className="grid gap-2">
              <Label>Tipo *</Label>
              <Select value={form.reportType} onValueChange={(v) => setForm({ ...form, reportType: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {Object.entries(REPORT_LABELS).map(([v, l]) => <SelectItem key={v} value={v}>{l}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-2">
              <Label>Campanha (opcional)</Label>
              <Select value={form.campaignId || "none"} onValueChange={(v) => setForm({ ...form, campaignId: v === "none" ? "" : v })}>
                <SelectTrigger><SelectValue placeholder="Sem campanha vinculada" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Sem campanha vinculada</SelectItem>
                  {campaignsList.map((c: any) => <SelectItem key={c.id} value={String(c.id)}>{c.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-2">
              <Label>Referência *</Label>
              <Input value={form.referenceLabel} onChange={(e) => setForm({ ...form, referenceLabel: e.target.value })} placeholder="Ex: Semana 20/07 ou Julho/2026" />
            </div>
            <div className="grid gap-2">
              <Label>Destinatário</Label>
              <Input value={form.recipientLabel} onChange={(e) => setForm({ ...form, recipientLabel: e.target.value })} placeholder="Cliente / grupo" />
            </div>
            <div className="grid gap-2">
              <Label>Data do envio *</Label>
              <Input type="date" value={form.sentAt} onChange={(e) => setForm({ ...form, sentAt: e.target.value })} />
            </div>
            <div className="grid gap-2">
              <Label>Enviado por</Label>
              <Input value={form.sentBy} onChange={(e) => setForm({ ...form, sentBy: e.target.value })} placeholder="Gabriel" />
            </div>
            <div className="grid gap-2">
              <Label>Link / onde está</Label>
              <Input value={form.linkUrl} onChange={(e) => setForm({ ...form, linkUrl: e.target.value })} placeholder="Drive, WhatsApp, etc." />
            </div>
            <div className="grid gap-2">
              <Label>Observações</Label>
              <Textarea value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} rows={2} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Cancelar</Button>
            <Button
              disabled={createReport.isPending}
              onClick={() => {
                if (!form.referenceLabel.trim()) { toast.error("Informe a referência."); return; }
                createReport.mutate({
                  campaignId: form.campaignId ? Number(form.campaignId) : undefined,
                  reportType: form.reportType as any,
                  referenceLabel: form.referenceLabel.trim(),
                  recipientLabel: form.recipientLabel.trim() || undefined,
                  sentAt: form.sentAt,
                  sentBy: form.sentBy.trim() || undefined,
                  linkUrl: form.linkUrl.trim() || undefined,
                  notes: form.notes.trim() || undefined,
                });
              }}
            >
              {createReport.isPending ? "Salvando..." : "Registrar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </PageContainer>
  );
}
