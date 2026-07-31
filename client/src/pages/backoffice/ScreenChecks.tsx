import { useState } from "react";
import PageContainer from "@/components/PageContainer";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { toast } from "sonner";
import { Monitor, FileVideo, CheckCircle2, XCircle, HelpCircle } from "lucide-react";

const today = () => new Date().toISOString().slice(0, 10);

export default function ScreenChecks() {
  const utils = trpc.useUtils();
  const { data: todayChecks = [], isLoading } = trpc.backoffice.screenCheck.today.useQuery();
  const { data: campaignsData } = trpc.campaign.list.useQuery();
  const campaignsList = campaignsData?.items ?? [];
  const { data: restaurants = [] } = trpc.activeRestaurant.list.useQuery();
  const { data: materialList = [] } = trpc.backoffice.screenMaterial.list.useQuery({});

  const [checkDialog, setCheckDialog] = useState<{ telaId: number; telaNome: string } | null>(null);
  const [checkForm, setCheckForm] = useState({ isOnline: true, internetOk: true, issue: "", actionTaken: "", performedBy: "" });
  const upsertCheck = trpc.backoffice.screenCheck.upsert.useMutation({
    onSuccess: () => {
      utils.backoffice.screenCheck.today.invalidate();
      setCheckDialog(null);
      toast.success("Verificação registrada!");
    },
    onError: (err) => toast.error(`Erro: ${err.message}`),
  });

  const [materialOpen, setMaterialOpen] = useState(false);
  const [materialForm, setMaterialForm] = useState({ campaignId: "", restaurantId: "", materialReceived: true, materialReceivedAt: today(), reportingFrequency: "" });
  const upsertMaterial = trpc.backoffice.screenMaterial.upsert.useMutation({
    onSuccess: () => {
      utils.backoffice.screenMaterial.list.invalidate();
      setMaterialOpen(false);
      toast.success("Material atualizado!");
    },
    onError: (err) => toast.error(`Erro: ${err.message}`),
  });

  const pendingCount = todayChecks.filter((t: any) => !t.checkId).length;
  const offlineCount = todayChecks.filter((t: any) => t.checkId && (t.isOnline === false || t.internetOk === false) && !t.resolvedAt).length;

  const openCheckDialog = (t: any) => {
    setCheckForm({
      isOnline: t.isOnline ?? true,
      internetOk: t.internetOk ?? true,
      issue: "",
      actionTaken: "",
      performedBy: "",
    });
    setCheckDialog({ telaId: t.telaId, telaNome: t.telaNome || `Tela #${t.telaId}` });
  };

  return (
    <PageContainer
      title="Telas"
      description="Verificação diária (online / internet) e material recebido para veiculação."
      actions={
        <div className="flex gap-2">
          <Badge variant="outline" className={pendingCount > 0 ? "text-amber-400 border-amber-500/30" : "text-emerald-400 border-emerald-500/30"}>
            {pendingCount} sem verificar hoje
          </Badge>
          {offlineCount > 0 && (
            <Badge variant="outline" className="text-red-400 border-red-500/30">{offlineCount} com problema</Badge>
          )}
        </div>
      }
    >
      <Tabs defaultValue="verificacao">
        <TabsList>
          <TabsTrigger value="verificacao"><Monitor className="w-3.5 h-3.5 mr-1.5" />Verificação diária</TabsTrigger>
          <TabsTrigger value="material"><FileVideo className="w-3.5 h-3.5 mr-1.5" />Material / veiculação</TabsTrigger>
        </TabsList>

        <TabsContent value="verificacao" className="space-y-3">
          <div className="rounded-lg border border-border/30 overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Tela</TableHead>
                  <TableHead>Restaurante</TableHead>
                  <TableHead>Online?</TableHead>
                  <TableHead>Internet?</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground py-8">Carregando...</TableCell></TableRow>
                ) : todayChecks.length === 0 ? (
                  <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground py-8">Nenhuma tela ativa cadastrada.</TableCell></TableRow>
                ) : (
                  todayChecks.map((t: any) => (
                    <TableRow key={t.telaId}>
                      <TableCell className="font-medium text-sm">{t.telaNome || `Tela #${t.telaId}`}</TableCell>
                      <TableCell className="text-xs text-muted-foreground">{t.restaurantName || "—"}</TableCell>
                      <TableCell>{t.checkId ? (t.isOnline ? <CheckCircle2 className="w-4 h-4 text-emerald-400" /> : <XCircle className="w-4 h-4 text-red-400" />) : <HelpCircle className="w-4 h-4 text-muted-foreground/40" />}</TableCell>
                      <TableCell>{t.checkId ? (t.internetOk ? <CheckCircle2 className="w-4 h-4 text-emerald-400" /> : <XCircle className="w-4 h-4 text-red-400" />) : <HelpCircle className="w-4 h-4 text-muted-foreground/40" />}</TableCell>
                      <TableCell>
                        {!t.checkId ? (
                          <Badge variant="outline" className="text-muted-foreground">Não verificada</Badge>
                        ) : t.isOnline && t.internetOk ? (
                          <Badge variant="outline" className="text-emerald-400 border-emerald-500/30">OK</Badge>
                        ) : t.resolvedAt ? (
                          <Badge variant="outline" className="text-emerald-400 border-emerald-500/30">Resolvido</Badge>
                        ) : (
                          <Badge variant="outline" className="text-red-400 border-red-500/30">Problema</Badge>
                        )}
                      </TableCell>
                      <TableCell>
                        <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={() => openCheckDialog(t)}>
                          {t.checkId ? "Atualizar" : "Verificar"}
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </TabsContent>

        <TabsContent value="material" className="space-y-3">
          <div className="flex justify-end">
            <Button size="sm" onClick={() => setMaterialOpen(true)}>Registrar material recebido</Button>
          </div>
          <div className="rounded-lg border border-border/30 overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Campanha</TableHead>
                  <TableHead>Restaurante</TableHead>
                  <TableHead>Material?</TableHead>
                  <TableHead>Recebido em</TableHead>
                  <TableHead>Relatoria</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {materialList.length === 0 ? (
                  <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground py-8">Nenhum material registrado ainda.</TableCell></TableRow>
                ) : (
                  materialList.map((m: any) => (
                    <TableRow key={m.id}>
                      <TableCell className="text-sm">
                        {m.campaignName || "—"}
                        <div className="text-[10px] text-muted-foreground">status campanha: {m.campaignStatus || "—"}</div>
                      </TableCell>
                      <TableCell className="text-xs">{m.restaurantName || "—"}</TableCell>
                      <TableCell>
                        {m.materialReceived ? <Badge variant="outline" className="text-emerald-400 border-emerald-500/30">Sim</Badge> : <Badge variant="outline" className="text-amber-400 border-amber-500/30">Não</Badge>}
                      </TableCell>
                      <TableCell className="text-xs">{m.materialReceivedAt || "—"}</TableCell>
                      <TableCell className="text-xs capitalize">{m.reportingFrequency || "—"}</TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </TabsContent>
      </Tabs>

      <Dialog open={!!checkDialog} onOpenChange={(o) => !o && setCheckDialog(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle>Verificar {checkDialog?.telaNome}</DialogTitle></DialogHeader>
          <div className="grid gap-3 py-2">
            <div className="flex items-center gap-4">
              <label className="flex items-center gap-2 text-sm">
                <Checkbox checked={checkForm.isOnline} onCheckedChange={(v) => setCheckForm({ ...checkForm, isOnline: !!v })} />
                Tela ligada
              </label>
              <label className="flex items-center gap-2 text-sm">
                <Checkbox checked={checkForm.internetOk} onCheckedChange={(v) => setCheckForm({ ...checkForm, internetOk: !!v })} />
                Internet OK
              </label>
            </div>
            {(!checkForm.isOnline || !checkForm.internetOk) && (
              <>
                <div className="grid gap-2">
                  <Label>Problema encontrado</Label>
                  <Textarea value={checkForm.issue} onChange={(e) => setCheckForm({ ...checkForm, issue: e.target.value })} rows={2} />
                </div>
                <div className="grid gap-2">
                  <Label>Ação tomada</Label>
                  <Textarea value={checkForm.actionTaken} onChange={(e) => setCheckForm({ ...checkForm, actionTaken: e.target.value })} rows={2} />
                </div>
              </>
            )}
            <div className="grid gap-2">
              <Label>Verificado por</Label>
              <Input value={checkForm.performedBy} onChange={(e) => setCheckForm({ ...checkForm, performedBy: e.target.value })} placeholder="Gabriel" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCheckDialog(null)}>Cancelar</Button>
            <Button
              disabled={upsertCheck.isPending}
              onClick={() => {
                if (!checkDialog) return;
                upsertCheck.mutate({
                  telaId: checkDialog.telaId,
                  checkDate: today(),
                  isOnline: checkForm.isOnline,
                  internetOk: checkForm.internetOk,
                  issue: checkForm.issue.trim() || undefined,
                  actionTaken: checkForm.actionTaken.trim() || undefined,
                  performedBy: checkForm.performedBy.trim() || undefined,
                });
              }}
            >
              {upsertCheck.isPending ? "Salvando..." : "Salvar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={materialOpen} onOpenChange={setMaterialOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>Material recebido</DialogTitle></DialogHeader>
          <div className="grid gap-3 py-2">
            <div className="grid gap-2">
              <Label>Campanha *</Label>
              <Select value={materialForm.campaignId} onValueChange={(v) => setMaterialForm({ ...materialForm, campaignId: v })}>
                <SelectTrigger><SelectValue placeholder="Selecione..." /></SelectTrigger>
                <SelectContent>
                  {campaignsList.map((c: any) => <SelectItem key={c.id} value={String(c.id)}>{c.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-2">
              <Label>Restaurante *</Label>
              <Select value={materialForm.restaurantId} onValueChange={(v) => setMaterialForm({ ...materialForm, restaurantId: v })}>
                <SelectTrigger><SelectValue placeholder="Selecione..." /></SelectTrigger>
                <SelectContent>
                  {(restaurants as any[]).map((r: any) => <SelectItem key={r.id} value={String(r.id)}>{r.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <label className="flex items-center gap-2 text-sm">
              <Checkbox checked={materialForm.materialReceived} onCheckedChange={(v) => setMaterialForm({ ...materialForm, materialReceived: !!v })} />
              Material recebido
            </label>
            <div className="grid gap-2">
              <Label>Data</Label>
              <Input type="date" value={materialForm.materialReceivedAt} onChange={(e) => setMaterialForm({ ...materialForm, materialReceivedAt: e.target.value })} />
            </div>
            <div className="grid gap-2">
              <Label>Frequência de relatoria</Label>
              <Select value={materialForm.reportingFrequency || "none"} onValueChange={(v) => setMaterialForm({ ...materialForm, reportingFrequency: v === "none" ? "" : v })}>
                <SelectTrigger><SelectValue placeholder="—" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">—</SelectItem>
                  <SelectItem value="diaria">Diária</SelectItem>
                  <SelectItem value="semanal">Semanal</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setMaterialOpen(false)}>Cancelar</Button>
            <Button
              disabled={upsertMaterial.isPending}
              onClick={() => {
                if (!materialForm.campaignId || !materialForm.restaurantId) { toast.error("Selecione a campanha e o restaurante."); return; }
                upsertMaterial.mutate({
                  campaignId: Number(materialForm.campaignId),
                  restaurantId: Number(materialForm.restaurantId),
                  materialReceived: materialForm.materialReceived,
                  materialReceivedAt: materialForm.materialReceivedAt || undefined,
                  reportingFrequency: (materialForm.reportingFrequency || undefined) as any,
                });
              }}
            >
              {upsertMaterial.isPending ? "Salvando..." : "Salvar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </PageContainer>
  );
}
