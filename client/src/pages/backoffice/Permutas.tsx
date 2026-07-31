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
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { toast } from "sonner";
import { Plus, Handshake, Receipt, Monitor } from "lucide-react";

function money(v: number) {
  return v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

export default function Permutas() {
  const utils = trpc.useUtils();
  const { data: permutasList = [], isLoading } = trpc.backoffice.permuta.list.useQuery();
  const { data: restaurants = [] } = trpc.activeRestaurant.list.useQuery();

  const EMPTY_FORM = { restaurantId: "", scope: "bar", telaId: "", description: "", totalValue: "", startDate: "", endDate: "", contractSigned: false, notes: "" };
  const [createOpen, setCreateOpen] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);
  // Telas do restaurante escolhido, para permuta por tela específica.
  const { data: telasList = [] } = trpc.tela.listByRestaurant.useQuery(
    { restaurantId: Number(form.restaurantId) },
    { enabled: form.scope === "tela" && !!form.restaurantId },
  );
  const createPermuta = trpc.backoffice.permuta.create.useMutation({
    onSuccess: () => {
      utils.backoffice.permuta.list.invalidate();
      setCreateOpen(false);
      setForm(EMPTY_FORM);
      toast.success("Permuta cadastrada!");
    },
    onError: (err) => toast.error(`Erro: ${err.message}`),
  });

  const [consumptionsFor, setConsumptionsFor] = useState<{ id: number; restaurantName: string; balance: number } | null>(null);
  const { data: consumptions = [] } = trpc.backoffice.permuta.listConsumptions.useQuery(
    { permutaId: consumptionsFor?.id ?? 0 },
    { enabled: !!consumptionsFor },
  );
  const [consumeForm, setConsumeForm] = useState({ consumptionDate: new Date().toISOString().slice(0, 10), description: "", amount: "" });
  const addConsumption = trpc.backoffice.permuta.addConsumption.useMutation({
    onSuccess: () => {
      utils.backoffice.permuta.listConsumptions.invalidate({ permutaId: consumptionsFor?.id });
      utils.backoffice.permuta.list.invalidate();
      setConsumeForm({ consumptionDate: new Date().toISOString().slice(0, 10), description: "", amount: "" });
      toast.success("Consumo lançado!");
    },
    onError: (err) => toast.error(`Erro: ${err.message}`),
  });

  return (
    <PageContainer
      title="Permutas"
      description="Acordos de troca com restaurantes parceiros e o saldo consumido."
      actions={<Button size="sm" onClick={() => setCreateOpen(true)}><Plus className="w-4 h-4 mr-1.5" />Nova permuta</Button>}
    >
      <div className="rounded-lg border border-border/30 overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Restaurante</TableHead>
              <TableHead>Tipo</TableHead>
              <TableHead>Acordo</TableHead>
              <TableHead className="text-right">Valor total</TableHead>
              <TableHead className="text-right">Consumido</TableHead>
              <TableHead className="text-right">Saldo</TableHead>
              <TableHead>Minuta</TableHead>
              <TableHead></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow><TableCell colSpan={8} className="text-center text-muted-foreground py-8">Carregando...</TableCell></TableRow>
            ) : permutasList.length === 0 ? (
              <TableRow><TableCell colSpan={8} className="text-center text-muted-foreground py-8">
                <Handshake className="w-6 h-6 mx-auto mb-2 opacity-40" /> Nenhuma permuta cadastrada ainda.
              </TableCell></TableRow>
            ) : (
              permutasList.map((p: any) => {
                const low = p.balance <= Number(p.totalValue) * 0.1;
                return (
                  <TableRow key={p.id}>
                    <TableCell className="font-medium text-sm">{p.restaurantName || "—"}</TableCell>
                    <TableCell>
                      {p.telaId ? (
                        <Badge variant="outline" className="text-sky-400 border-sky-500/30 inline-flex items-center gap-1">
                          <Monitor className="w-3 h-3" />{p.telaNome || `Tela #${p.telaId}`}
                        </Badge>
                      ) : (
                        <Badge variant="outline" className="text-muted-foreground">Bar</Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground max-w-xs truncate">{p.description}</TableCell>
                    <TableCell className="text-right font-mono text-xs">{money(Number(p.totalValue))}</TableCell>
                    <TableCell className="text-right font-mono text-xs">{money(Number(p.consumed))}</TableCell>
                    <TableCell className="text-right font-mono text-xs">
                      <span className={low ? "text-red-400 font-semibold" : ""}>{money(p.balance)}</span>
                    </TableCell>
                    <TableCell>
                      {p.contractSigned ? <Badge variant="outline" className="text-emerald-400 border-emerald-500/30">Assinada</Badge> : <Badge variant="outline" className="text-amber-400 border-amber-500/30">Pendente</Badge>}
                    </TableCell>
                    <TableCell>
                      <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={() => setConsumptionsFor({ id: p.id, restaurantName: p.restaurantName || "", balance: p.balance })}>
                        <Receipt className="w-3.5 h-3.5 mr-1" />Consumo
                      </Button>
                    </TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </div>

      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>Nova permuta</DialogTitle></DialogHeader>
          <div className="grid gap-3 py-2">
            <div className="grid gap-2">
              <Label>Restaurante *</Label>
              <Select value={form.restaurantId} onValueChange={(v) => setForm({ ...form, restaurantId: v, telaId: "" })}>
                <SelectTrigger><SelectValue placeholder="Selecione..." /></SelectTrigger>
                <SelectContent>
                  {(restaurants as any[]).map((r: any) => <SelectItem key={r.id} value={String(r.id)}>{r.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-2">
              <Label>Vinculada a *</Label>
              <Select value={form.scope} onValueChange={(v) => setForm({ ...form, scope: v, telaId: "" })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="bar">Bar / restaurante inteiro</SelectItem>
                  <SelectItem value="tela">Tela específica</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {form.scope === "tela" && (
              <div className="grid gap-2">
                <Label>Tela *</Label>
                <Select value={form.telaId} onValueChange={(v) => setForm({ ...form, telaId: v })}>
                  <SelectTrigger><SelectValue placeholder={form.restaurantId ? "Selecione a tela..." : "Escolha o restaurante primeiro"} /></SelectTrigger>
                  <SelectContent>
                    {(telasList as any[]).map((t: any) => <SelectItem key={t.id} value={String(t.id)}>{t.nome || `Tela #${t.id}`}</SelectItem>)}
                  </SelectContent>
                </Select>
                {form.restaurantId && (telasList as any[]).length === 0 && (
                  <p className="text-[10px] text-amber-400">Este restaurante não tem telas cadastradas.</p>
                )}
              </div>
            )}
            <div className="grid gap-2">
              <Label>O que foi acordado *</Label>
              <Textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} rows={2} placeholder="Ex: Consumo da equipe em chopp e porções" />
            </div>
            <div className="grid gap-2">
              <Label>Valor total *</Label>
              <Input type="number" step="0.01" min={0} value={form.totalValue} onChange={(e) => setForm({ ...form, totalValue: e.target.value })} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="grid gap-2">
                <Label>Início</Label>
                <Input type="date" value={form.startDate} onChange={(e) => setForm({ ...form, startDate: e.target.value })} />
              </div>
              <div className="grid gap-2">
                <Label>Fim</Label>
                <Input type="date" value={form.endDate} onChange={(e) => setForm({ ...form, endDate: e.target.value })} />
              </div>
            </div>
            <label className="flex items-center gap-2 text-sm">
              <Checkbox checked={form.contractSigned} onCheckedChange={(v) => setForm({ ...form, contractSigned: !!v })} />
              Minuta assinada
            </label>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateOpen(false)}>Cancelar</Button>
            <Button
              disabled={createPermuta.isPending}
              onClick={() => {
                if (!form.restaurantId || !form.description.trim() || !form.totalValue) { toast.error("Preencha restaurante, acordo e valor."); return; }
                if (form.scope === "tela" && !form.telaId) { toast.error("Selecione a tela da permuta."); return; }
                createPermuta.mutate({
                  restaurantId: Number(form.restaurantId),
                  telaId: form.scope === "tela" ? Number(form.telaId) : undefined,
                  description: form.description.trim(),
                  totalValue: form.totalValue,
                  startDate: form.startDate || undefined,
                  endDate: form.endDate || undefined,
                  contractSigned: form.contractSigned,
                  notes: form.notes.trim() || undefined,
                });
              }}
            >
              {createPermuta.isPending ? "Salvando..." : "Cadastrar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!consumptionsFor} onOpenChange={(o) => !o && setConsumptionsFor(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Consumo — {consumptionsFor?.restaurantName}</DialogTitle>
          </DialogHeader>
          <div className="max-h-52 overflow-y-auto rounded-lg border border-border/30">
            <Table>
              <TableHeader>
                <TableRow><TableHead>Data</TableHead><TableHead>Descrição</TableHead><TableHead className="text-right">Valor</TableHead></TableRow>
              </TableHeader>
              <TableBody>
                {consumptions.length === 0 ? (
                  <TableRow><TableCell colSpan={3} className="text-center text-muted-foreground text-xs py-4">Nenhum lançamento ainda.</TableCell></TableRow>
                ) : (
                  consumptions.map((c: any) => (
                    <TableRow key={c.id}>
                      <TableCell className="text-xs">{c.consumptionDate}</TableCell>
                      <TableCell className="text-xs">{c.description || "—"}</TableCell>
                      <TableCell className="text-right font-mono text-xs">{money(Number(c.amount))}</TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
          <div className="grid grid-cols-[1fr_2fr_1fr] gap-2 items-end pt-2">
            <div className="grid gap-1.5">
              <Label className="text-xs">Data</Label>
              <Input type="date" className="h-8" value={consumeForm.consumptionDate} onChange={(e) => setConsumeForm({ ...consumeForm, consumptionDate: e.target.value })} />
            </div>
            <div className="grid gap-1.5">
              <Label className="text-xs">Descrição</Label>
              <Input className="h-8" value={consumeForm.description} onChange={(e) => setConsumeForm({ ...consumeForm, description: e.target.value })} placeholder="Jantar da equipe" />
            </div>
            <div className="grid gap-1.5">
              <Label className="text-xs">Valor</Label>
              <Input type="number" step="0.01" className="h-8" value={consumeForm.amount} onChange={(e) => setConsumeForm({ ...consumeForm, amount: e.target.value })} />
            </div>
          </div>
          <DialogFooter>
            <Button
              size="sm"
              disabled={addConsumption.isPending}
              onClick={() => {
                if (!consumptionsFor || !consumeForm.amount) { toast.error("Informe o valor."); return; }
                addConsumption.mutate({
                  permutaId: consumptionsFor.id,
                  consumptionDate: consumeForm.consumptionDate,
                  description: consumeForm.description.trim() || undefined,
                  amount: consumeForm.amount,
                });
              }}
            >
              {addConsumption.isPending ? "Lançando..." : "Lançar consumo"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </PageContainer>
  );
}
