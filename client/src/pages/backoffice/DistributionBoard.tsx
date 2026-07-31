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
  DialogDescription,
} from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { toast } from "sonner";
import { Plus, Truck, ClipboardCheck } from "lucide-react";

const MOVEMENT_LABELS: Record<string, string> = {
  entrega_inicial: "Entrega inicial",
  reposicao: "Reposição",
  retirada: "Retirada",
};

function mondayOf(d: Date): string {
  const day = d.getDay();
  const diff = (day === 0 ? -6 : 1) - day;
  const monday = new Date(d);
  monday.setDate(d.getDate() + diff);
  return monday.toISOString().slice(0, 10);
}

export default function DistributionBoard() {
  const utils = trpc.useUtils();
  const { data: restaurants = [] } = trpc.activeRestaurant.list.useQuery();
  const { data: campaignsData } = trpc.campaign.list.useQuery();
  const campaignsList = campaignsData?.items ?? [];

  // ── Movimentos ──
  const [moveOpen, setMoveOpen] = useState(false);
  const [moveForm, setMoveForm] = useState({ restaurantId: "", movementType: "entrega_inicial", quantity: "", movementDate: new Date().toISOString().slice(0, 10), performedBy: "", notes: "" });
  const { data: movements = [], isLoading: loadingMovements } = trpc.backoffice.distribution.list.useQuery({});
  const createMovement = trpc.backoffice.distribution.create.useMutation({
    onSuccess: () => {
      utils.backoffice.distribution.list.invalidate();
      setMoveOpen(false);
      setMoveForm({ restaurantId: "", movementType: "entrega_inicial", quantity: "", movementDate: new Date().toISOString().slice(0, 10), performedBy: "", notes: "" });
      toast.success("Movimento registrado!");
    },
    onError: (err) => toast.error(`Erro: ${err.message}`),
  });

  // ── Contagem semanal ──
  const [countOpen, setCountOpen] = useState(false);
  const [countForm, setCountForm] = useState({ restaurantId: "", weekOf: mondayOf(new Date()), countedQuantity: "", needsRestock: false, needsPickup: false, campaignId: "", notes: "" });
  const [onlyPending, setOnlyPending] = useState(true);
  const { data: counts = [], isLoading: loadingCounts } = trpc.backoffice.stockCount.list.useQuery({ onlyPending });
  const upsertCount = trpc.backoffice.stockCount.upsert.useMutation({
    onSuccess: () => {
      utils.backoffice.stockCount.list.invalidate();
      setCountOpen(false);
      toast.success("Contagem registrada!");
    },
    onError: (err) => toast.error(`Erro: ${err.message}`),
  });
  const resolveCount = trpc.backoffice.stockCount.resolve.useMutation({
    onSuccess: () => {
      utils.backoffice.stockCount.list.invalidate();
      toast.success("Marcado como resolvido!");
    },
    onError: (err) => toast.error(`Erro: ${err.message}`),
  });

  return (
    <PageContainer title="Distribuição de Bolachas" description="Entregas, reposições, retiradas e a contagem semanal por restaurante.">
      <Tabs defaultValue="movimentos">
        <TabsList>
          <TabsTrigger value="movimentos"><Truck className="w-3.5 h-3.5 mr-1.5" />Movimentos</TabsTrigger>
          <TabsTrigger value="contagem"><ClipboardCheck className="w-3.5 h-3.5 mr-1.5" />Contagem semanal</TabsTrigger>
        </TabsList>

        <TabsContent value="movimentos" className="space-y-3">
          <div className="flex justify-end">
            <Button size="sm" onClick={() => setMoveOpen(true)}><Plus className="w-4 h-4 mr-1.5" />Novo movimento</Button>
          </div>
          <div className="rounded-lg border border-border/30 overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Data</TableHead>
                  <TableHead>Restaurante</TableHead>
                  <TableHead>Tipo</TableHead>
                  <TableHead className="text-right">Qtd</TableHead>
                  <TableHead>Por</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loadingMovements ? (
                  <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground py-8">Carregando...</TableCell></TableRow>
                ) : movements.length === 0 ? (
                  <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground py-8">Nenhum movimento registrado ainda.</TableCell></TableRow>
                ) : (
                  movements.map((m: any) => (
                    <TableRow key={m.id}>
                      <TableCell className="text-xs">{m.movementDate}</TableCell>
                      <TableCell className="text-sm">{m.restaurantName || "—"}</TableCell>
                      <TableCell>
                        <Badge variant="outline" className={m.movementType === "retirada" ? "text-amber-400 border-amber-500/30" : "text-emerald-400 border-emerald-500/30"}>
                          {MOVEMENT_LABELS[m.movementType]}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right font-mono text-xs">{m.quantity}</TableCell>
                      <TableCell className="text-xs text-muted-foreground">{m.performedBy || "—"}</TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </TabsContent>

        <TabsContent value="contagem" className="space-y-3">
          <div className="flex justify-between items-center">
            <label className="flex items-center gap-2 text-xs text-muted-foreground">
              <Checkbox checked={onlyPending} onCheckedChange={(v) => setOnlyPending(!!v)} />
              Só pendentes (precisam de reposição/retirada)
            </label>
            <Button size="sm" onClick={() => setCountOpen(true)}><Plus className="w-4 h-4 mr-1.5" />Registrar contagem</Button>
          </div>
          <div className="rounded-lg border border-border/30 overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Semana</TableHead>
                  <TableHead>Restaurante</TableHead>
                  <TableHead>Campanha</TableHead>
                  <TableHead className="text-right">Contado</TableHead>
                  <TableHead>Ação necessária</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loadingCounts ? (
                  <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground py-8">Carregando...</TableCell></TableRow>
                ) : counts.length === 0 ? (
                  <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground py-8">Nenhuma contagem por aqui.</TableCell></TableRow>
                ) : (
                  counts.map((c: any) => (
                    <TableRow key={c.id}>
                      <TableCell className="text-xs">{c.weekOf}</TableCell>
                      <TableCell className="text-sm">{c.restaurantName || "—"}</TableCell>
                      <TableCell className="text-xs text-muted-foreground">{c.campaignName || "—"}</TableCell>
                      <TableCell className="text-right font-mono text-xs">{c.countedQuantity}</TableCell>
                      <TableCell className="text-xs">
                        {c.needsRestock && <Badge variant="outline" className="text-amber-400 border-amber-500/30 mr-1">Repor</Badge>}
                        {c.needsPickup && <Badge variant="outline" className="text-red-400 border-red-500/30">Retirar</Badge>}
                        {!c.needsRestock && !c.needsPickup && "—"}
                      </TableCell>
                      <TableCell>
                        {c.resolvedAt ? (
                          <Badge variant="outline" className="text-emerald-400 border-emerald-500/30">Resolvido</Badge>
                        ) : (c.needsRestock || c.needsPickup) ? (
                          <Button size="sm" variant="ghost" className="h-6 text-xs" onClick={() => resolveCount.mutate({ id: c.id })}>Marcar feito</Button>
                        ) : "—"}
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </TabsContent>
      </Tabs>

      <Dialog open={moveOpen} onOpenChange={setMoveOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>Novo movimento</DialogTitle></DialogHeader>
          <div className="grid gap-3 py-2">
            <div className="grid gap-2">
              <Label>Restaurante *</Label>
              <Select value={moveForm.restaurantId} onValueChange={(v) => setMoveForm({ ...moveForm, restaurantId: v })}>
                <SelectTrigger><SelectValue placeholder="Selecione..." /></SelectTrigger>
                <SelectContent>
                  {(restaurants as any[]).map((r: any) => <SelectItem key={r.id} value={String(r.id)}>{r.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-2">
              <Label>Tipo *</Label>
              <Select value={moveForm.movementType} onValueChange={(v) => setMoveForm({ ...moveForm, movementType: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {Object.entries(MOVEMENT_LABELS).map(([v, l]) => <SelectItem key={v} value={v}>{l}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-2">
              <Label>Quantidade *</Label>
              <Input type="number" min={1} value={moveForm.quantity} onChange={(e) => setMoveForm({ ...moveForm, quantity: e.target.value })} />
            </div>
            <div className="grid gap-2">
              <Label>Data *</Label>
              <Input type="date" value={moveForm.movementDate} onChange={(e) => setMoveForm({ ...moveForm, movementDate: e.target.value })} />
            </div>
            <div className="grid gap-2">
              <Label>Feito por</Label>
              <Input value={moveForm.performedBy} onChange={(e) => setMoveForm({ ...moveForm, performedBy: e.target.value })} placeholder="Gabriel" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setMoveOpen(false)}>Cancelar</Button>
            <Button
              disabled={createMovement.isPending}
              onClick={() => {
                if (!moveForm.restaurantId || !moveForm.quantity) { toast.error("Selecione o restaurante e a quantidade."); return; }
                createMovement.mutate({
                  restaurantId: Number(moveForm.restaurantId),
                  movementType: moveForm.movementType as any,
                  quantity: Number(moveForm.quantity),
                  movementDate: moveForm.movementDate,
                  performedBy: moveForm.performedBy.trim() || undefined,
                });
              }}
            >
              {createMovement.isPending ? "Salvando..." : "Registrar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={countOpen} onOpenChange={setCountOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>Registrar contagem semanal</DialogTitle></DialogHeader>
          <div className="grid gap-3 py-2">
            <div className="grid gap-2">
              <Label>Restaurante *</Label>
              <Select value={countForm.restaurantId} onValueChange={(v) => setCountForm({ ...countForm, restaurantId: v })}>
                <SelectTrigger><SelectValue placeholder="Selecione..." /></SelectTrigger>
                <SelectContent>
                  {(restaurants as any[]).map((r: any) => <SelectItem key={r.id} value={String(r.id)}>{r.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-2">
              <Label>Semana (segunda-feira) *</Label>
              <Input type="date" value={countForm.weekOf} onChange={(e) => setCountForm({ ...countForm, weekOf: e.target.value })} />
            </div>
            <div className="grid gap-2">
              <Label>Quantidade contada *</Label>
              <Input type="number" min={0} value={countForm.countedQuantity} onChange={(e) => setCountForm({ ...countForm, countedQuantity: e.target.value })} />
            </div>
            <div className="grid gap-2">
              <Label>Campanha (opcional)</Label>
              <Select value={countForm.campaignId || "none"} onValueChange={(v) => setCountForm({ ...countForm, campaignId: v === "none" ? "" : v })}>
                <SelectTrigger><SelectValue placeholder="Sem campanha vinculada" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Sem campanha vinculada</SelectItem>
                  {campaignsList.map((c: any) => <SelectItem key={c.id} value={String(c.id)}>{c.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-center gap-4">
              <label className="flex items-center gap-2 text-sm">
                <Checkbox checked={countForm.needsRestock} onCheckedChange={(v) => setCountForm({ ...countForm, needsRestock: !!v })} />
                Precisa repor
              </label>
              <label className="flex items-center gap-2 text-sm">
                <Checkbox checked={countForm.needsPickup} onCheckedChange={(v) => setCountForm({ ...countForm, needsPickup: !!v })} />
                Precisa retirar
              </label>
            </div>
            <div className="grid gap-2">
              <Label>Observações</Label>
              <Textarea value={countForm.notes} onChange={(e) => setCountForm({ ...countForm, notes: e.target.value })} rows={2} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCountOpen(false)}>Cancelar</Button>
            <Button
              disabled={upsertCount.isPending}
              onClick={() => {
                if (!countForm.restaurantId || countForm.countedQuantity === "") { toast.error("Selecione o restaurante e a quantidade contada."); return; }
                upsertCount.mutate({
                  restaurantId: Number(countForm.restaurantId),
                  weekOf: countForm.weekOf,
                  countedQuantity: Number(countForm.countedQuantity),
                  needsRestock: countForm.needsRestock,
                  needsPickup: countForm.needsPickup,
                  campaignId: countForm.campaignId ? Number(countForm.campaignId) : null,
                  notes: countForm.notes.trim() || undefined,
                });
              }}
            >
              {upsertCount.isPending ? "Salvando..." : "Salvar contagem"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </PageContainer>
  );
}
