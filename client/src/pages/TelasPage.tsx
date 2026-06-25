import { useMemo, useState } from "react";
import { trpc, type RouterOutputs } from "@/lib/trpc";
import { useConfigOptions } from "@/lib/configOptions";
import PageContainer from "@/components/PageContainer";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { TelaDialog } from "@/components/TelasManager";
import { toast } from "sonner";
import { Plus, Pencil, Trash2, Monitor, MapPin, Search } from "lucide-react";

type TelaRow = RouterOutputs["tela"]["listAll"][number];

const LAYOUT_LABELS: Record<string, string> = {
  landscape: "Landscape",
  portrait: "Portrait",
  square: "Square",
};

export default function TelasPage() {
  const utils = trpc.useUtils();
  const listQ = trpc.tela.listAll.useQuery();
  const restaurantsQ = trpc.activeRestaurant.list.useQuery();
  const { labelOf } = useConfigOptions("screen_category");

  const [search, setSearch] = useState("");
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<TelaRow | null>(null);

  const restaurantOptions = useMemo(
    () => (restaurantsQ.data ?? []).map((r) => ({ id: r.id, name: r.name })),
    [restaurantsQ.data],
  );

  const deleteMut = trpc.tela.delete.useMutation({
    onSuccess: () => {
      toast.success("Tela removida.");
      utils.tela.listAll.invalidate();
    },
    onError: (e) => toast.error(e.message),
  });

  const telas = listQ.data ?? [];
  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return telas;
    return telas.filter((t) => {
      const hay = [t.nome, t.restaurantName, t.cmsScreenId, labelOf(t.categoria)]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      return hay.includes(q);
    });
  }, [telas, search, labelOf]);

  function openCreate() {
    setEditing(null);
    setOpen(true);
  }
  function openEdit(t: TelaRow) {
    setEditing(t);
    setOpen(true);
  }
  function handleDelete(t: TelaRow) {
    if (!confirm(`Remover a tela "${t.nome || t.cmsScreenId || `#${t.id}`}"?`)) return;
    deleteMut.mutate({ id: t.id });
  }

  return (
    <PageContainer
      title="Telas"
      description="Cadastro centralizado de todas as telas (pontos de mídia) dos locais."
      actions={
        <Button onClick={openCreate} size="sm" className="gap-1.5" data-testid="button-add-tela-page">
          <Plus className="w-3.5 h-3.5" /> Adicionar tela
        </Button>
      }
    >
      <div className="flex items-center gap-2 max-w-sm">
        <div className="relative flex-1">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar por tela, local, CMS..."
            className="pl-8"
            data-testid="input-search-telas"
          />
        </div>
      </div>

      {listQ.isLoading ? (
        <p className="text-sm text-muted-foreground py-10 text-center">Carregando...</p>
      ) : filtered.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border/40 bg-muted/10 py-14 text-center">
          <Monitor className="w-7 h-7 mx-auto text-muted-foreground/60" />
          <p className="text-sm text-muted-foreground mt-2">
            {telas.length === 0 ? "Nenhuma tela cadastrada ainda." : "Nenhuma tela encontrada para a busca."}
          </p>
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((t) => {
            const photos = Array.isArray(t.photoUrls) ? t.photoUrls : [];
            return (
              <div
                key={t.id}
                className="bg-card border border-border/30 rounded-xl overflow-hidden flex flex-col"
                data-testid={`card-tela-page-${t.id}`}
              >
                {photos.length > 0 ? (
                  <div className="aspect-video bg-muted/20 overflow-hidden">
                    <img src={photos[0]} alt={t.nome || "Tela"} className="w-full h-full object-cover" />
                  </div>
                ) : (
                  <div className="aspect-video bg-muted/10 flex items-center justify-center">
                    <Monitor className="w-6 h-6 text-muted-foreground/40" />
                  </div>
                )}
                <div className="p-4 space-y-2 flex-1 flex flex-col">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="text-sm font-medium truncate">{t.nome || "Tela"}</p>
                      <p className="text-[11px] text-muted-foreground truncate flex items-center gap-1">
                        <MapPin className="w-3 h-3 shrink-0" />
                        {t.restaurantName ?? `Local #${t.restaurantId}`}
                      </p>
                    </div>
                    <Badge variant={t.status === "active" ? "secondary" : "outline"} className="text-[10px] shrink-0">
                      {t.status === "active" ? "Ativa" : "Inativa"}
                    </Badge>
                  </div>
                  <div className="flex flex-wrap gap-1.5 text-[10px] text-muted-foreground">
                    <span className="px-1.5 py-0.5 rounded bg-muted/40">{labelOf(t.categoria)}</span>
                    {t.cmsScreenId && <span className="px-1.5 py-0.5 rounded bg-muted/40">CMS {t.cmsScreenId}</span>}
                    {t.layout && <span className="px-1.5 py-0.5 rounded bg-muted/40">{LAYOUT_LABELS[t.layout] ?? t.layout}</span>}
                    {photos.length > 0 && <span className="px-1.5 py-0.5 rounded bg-muted/40">{photos.length} foto(s)</span>}
                  </div>
                  <div className="flex items-center justify-end gap-1 mt-auto pt-1">
                    <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => openEdit(t)} data-testid={`button-edit-tela-page-${t.id}`}>
                      <Pencil className="w-3.5 h-3.5" />
                    </Button>
                    <Button size="icon" variant="ghost" className="h-7 w-7 text-red-400" onClick={() => handleDelete(t)} data-testid={`button-delete-tela-page-${t.id}`}>
                      <Trash2 className="w-3.5 h-3.5" />
                    </Button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {open && (
        <TelaDialog
          open={open}
          onOpenChange={setOpen}
          restaurantOptions={restaurantOptions}
          editing={editing}
          onSaved={() => {
            utils.tela.listAll.invalidate();
            setOpen(false);
          }}
        />
      )}
    </PageContainer>
  );
}
