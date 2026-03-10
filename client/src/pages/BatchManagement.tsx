import { useState } from "react";
import PageContainer from "@/components/PageContainer";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
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
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import {
  Calendar,
  ChevronLeft,
  ChevronRight,
  Edit2,
  RefreshCw,
  Layers,
  CheckCircle2,
  XCircle,
  Trophy,
  ShoppingBag,
  Music,
} from "lucide-react";

const EVENT_INDICATORS = [
  { pattern: "Black Friday", icon: ShoppingBag, color: "text-amber-400 bg-amber-500/15 border-amber-500/30", label: "Black Friday" },
  { pattern: "Copa do Mundo", icon: Trophy, color: "text-yellow-400 bg-yellow-500/15 border-yellow-500/30", label: "Copa do Mundo" },
  { pattern: "Festival de Parintins", icon: Music, color: "text-pink-400 bg-pink-500/15 border-pink-500/30", label: "Parintins" },
];

function getEventBadges(label: string) {
  return EVENT_INDICATORS.filter(e => label.includes(e.pattern));
}

export default function BatchManagement() {
  const currentYear = new Date().getFullYear();
  const [selectedYear, setSelectedYear] = useState(currentYear);
  const [editBatch, setEditBatch] = useState<{
    id: number;
    label: string;
    startDate: string;
    endDate: string;
    isActive: boolean;
  } | null>(null);

  const utils = trpc.useUtils();
  const { data: batches = [], isLoading } = trpc.batch.list.useQuery({ year: selectedYear });

  const updateMutation = trpc.batch.update.useMutation({
    onSuccess: () => {
      utils.batch.list.invalidate();
      setEditBatch(null);
      toast.success("Batch atualizado!");
    },
    onError: (err) => toast.error(`Erro: ${err.message}`),
  });

  const regenerateMutation = trpc.batch.regenerate.useMutation({
    onSuccess: () => {
      utils.batch.list.invalidate();
      toast.success("Batches regenerados com sucesso!");
    },
    onError: (err) => toast.error(`Erro: ${err.message}`),
  });

  const today = new Date().toISOString().split("T")[0];

  function getBatchStatus(batch: typeof batches[0]) {
    if (!batch.isActive) return "inativo";
    if (batch.endDate < today) return "encerrado";
    if (batch.startDate <= today && batch.endDate >= today) return "em_andamento";
    return "futuro";
  }

  const statusColors: Record<string, string> = {
    em_andamento: "bg-emerald-500/20 text-emerald-400 border-emerald-500/30",
    futuro: "bg-blue-500/20 text-blue-400 border-blue-500/30",
    encerrado: "bg-gray-500/20 text-gray-400 border-gray-500/30",
    inativo: "bg-red-500/20 text-red-400 border-red-500/30",
  };

  const statusLabels: Record<string, string> = {
    em_andamento: "Em andamento",
    futuro: "Futuro",
    encerrado: "Encerrado",
    inativo: "Inativo",
  };

  return (
    <PageContainer
      title="Batches de Veiculação"
      description="Períodos de 4 semanas para campanhas — 13 batches por ciclo (início em 15 de abril)"
      actions={
        <Button
          variant="outline"
          onClick={() => {
            if (confirm(`Regenerar todos os batches de ${selectedYear}? Batches com campanhas atribuídas não serão afetados.`)) {
              regenerateMutation.mutate({ year: selectedYear });
            }
          }}
          disabled={regenerateMutation.isPending}
        >
          <RefreshCw className={`w-4 h-4 mr-2 ${regenerateMutation.isPending ? "animate-spin" : ""}`} />
          Regenerar {selectedYear}
        </Button>
      }
    >
      <div className="flex items-center gap-4 mb-2">
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8"
          onClick={() => setSelectedYear(selectedYear - 1)}
        >
          <ChevronLeft className="w-4 h-4" />
        </Button>
        <div className="text-center">
          <span className="text-lg font-bold font-mono whitespace-nowrap">Ciclo {selectedYear}</span>
          <p className="text-[10px] text-muted-foreground">Abr {selectedYear} — Abr {selectedYear + 1}</p>
        </div>
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8"
          onClick={() => setSelectedYear(selectedYear + 1)}
        >
          <ChevronRight className="w-4 h-4" />
        </Button>
      </div>

      <div className="grid gap-3">
        {isLoading ? (
          <div className="p-8 text-center text-muted-foreground">Carregando batches...</div>
        ) : batches.length === 0 ? (
          <div className="p-8 text-center text-muted-foreground">
            Nenhum batch encontrado para {selectedYear}. Clique em "Regenerar" para criar.
          </div>
        ) : (
          batches.map((batch) => {
            const status = getBatchStatus(batch);
            const start = new Date(batch.startDate + "T12:00:00");
            const end = new Date(batch.endDate + "T12:00:00");
            const startStr = start.toLocaleDateString("pt-BR", { day: "2-digit", month: "short" });
            const endStr = end.toLocaleDateString("pt-BR", { day: "2-digit", month: "short", year: "numeric" });
            const events = getEventBadges(batch.label);

            return (
              <div
                key={batch.id}
                className={`bg-card border border-border/30 rounded-lg p-4 flex items-center gap-4 hover:bg-muted/20 transition-colors ${!batch.isActive ? "opacity-50" : ""}`}
              >
                <div className="flex items-center justify-center w-10 h-10 rounded-lg bg-primary/10 text-primary font-bold text-sm flex-shrink-0">
                  {batch.batchNumber}
                </div>

                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold truncate">{batch.label}</p>
                  <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                    <Calendar className="w-3 h-3 text-muted-foreground" />
                    <p className="text-xs text-muted-foreground">
                      {startStr} — {endStr}
                    </p>
                    <span className="text-xs text-muted-foreground/60">·</span>
                    <p className="text-xs text-muted-foreground">4 semanas</p>
                    {events.map((event) => {
                      const Icon = event.icon;
                      return (
                        <Badge key={event.pattern} variant="outline" className={`text-[10px] px-1.5 py-0 gap-1 ${event.color}`}>
                          <Icon className="w-3 h-3" />
                          {event.label}
                        </Badge>
                      );
                    })}
                  </div>
                </div>

                <Badge variant="outline" className={`text-[10px] ${statusColors[status]}`}>
                  {statusLabels[status]}
                </Badge>

                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 text-muted-foreground hover:text-primary"
                  title="Editar batch"
                  onClick={() =>
                    setEditBatch({
                      id: batch.id,
                      label: batch.label,
                      startDate: batch.startDate,
                      endDate: batch.endDate,
                      isActive: batch.isActive,
                    })
                  }
                >
                  <Edit2 className="w-4 h-4" />
                </Button>
              </div>
            );
          })
        )}
      </div>

      <Dialog open={!!editBatch} onOpenChange={(open) => !open && setEditBatch(null)}>
        <DialogContent className="bg-card border-border/30 max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Layers className="w-5 h-5 text-primary" />
              Editar Batch
            </DialogTitle>
            <DialogDescription>Ajuste o nome, datas ou status deste período.</DialogDescription>
          </DialogHeader>

          {editBatch && (
            <div className="grid gap-4 py-2">
              <div className="grid gap-2">
                <Label>Nome do Batch</Label>
                <Input
                  value={editBatch.label}
                  onChange={(e) => setEditBatch({ ...editBatch, label: e.target.value })}
                  className="bg-background border-border/30"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="grid gap-2">
                  <Label>Data Início</Label>
                  <Input
                    type="date"
                    value={editBatch.startDate}
                    onChange={(e) => setEditBatch({ ...editBatch, startDate: e.target.value })}
                    className="bg-background border-border/30"
                  />
                </div>
                <div className="grid gap-2">
                  <Label>Data Fim</Label>
                  <Input
                    type="date"
                    value={editBatch.endDate}
                    onChange={(e) => setEditBatch({ ...editBatch, endDate: e.target.value })}
                    className="bg-background border-border/30"
                  />
                </div>
              </div>
              <div className="flex items-center gap-3">
                <Label>Status</Label>
                <Button
                  variant="outline"
                  size="sm"
                  className={editBatch.isActive ? "text-emerald-400 border-emerald-500/30" : "text-red-400 border-red-500/30"}
                  onClick={() => setEditBatch({ ...editBatch, isActive: !editBatch.isActive })}
                >
                  {editBatch.isActive ? (
                    <span className="flex items-center gap-1"><CheckCircle2 className="w-3.5 h-3.5" /> Ativo</span>
                  ) : (
                    <span className="flex items-center gap-1"><XCircle className="w-3.5 h-3.5" /> Inativo</span>
                  )}
                </Button>
              </div>
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setEditBatch(null)}>Cancelar</Button>
            <Button
              onClick={() => {
                if (!editBatch) return;
                updateMutation.mutate({
                  id: editBatch.id,
                  label: editBatch.label,
                  startDate: editBatch.startDate,
                  endDate: editBatch.endDate,
                  isActive: editBatch.isActive,
                });
              }}
              disabled={updateMutation.isPending}
            >
              {updateMutation.isPending ? "Salvando..." : "Salvar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </PageContainer>
  );
}
