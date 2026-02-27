import { useState } from "react";
import PageContainer from "@/components/PageContainer";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  LayoutGrid,
  List,
  Search,
  Plus,
  Image as ImageIcon,
  FileText,
  Eye,
  Trash2,
  X,
  Tag,
} from "lucide-react";
import { toast } from "sonner";

type ViewMode = "grid" | "list";

export default function Library() {
  const [viewMode, setViewMode] = useState<ViewMode>("grid");
  const [search, setSearch] = useState("");
  const [createOpen, setCreateOpen] = useState(false);
  const [detailItem, setDetailItem] = useState<any>(null);

  const [newTitle, setNewTitle] = useState("");
  const [newThumbnailUrl, setNewThumbnailUrl] = useState("");
  const [newArtPdfUrl, setNewArtPdfUrl] = useState("");
  const [newArtImageUrls, setNewArtImageUrls] = useState("");
  const [newTags, setNewTags] = useState("");
  const [newStatus, setNewStatus] = useState("arquivado");

  const utils = trpc.useUtils();
  const { data: items = [], isLoading } = trpc.library.list.useQuery(
    search ? { search } : undefined
  );

  const createMutation = trpc.library.create.useMutation({
    onSuccess: () => {
      toast.success("Item adicionado à biblioteca");
      utils.library.list.invalidate();
      resetForm();
      setCreateOpen(false);
    },
    onError: (err) => toast.error(err.message),
  });

  const deleteMutation = trpc.library.delete.useMutation({
    onSuccess: () => {
      toast.success("Item removido");
      utils.library.list.invalidate();
      setDetailItem(null);
    },
    onError: (err) => toast.error(err.message),
  });

  function resetForm() {
    setNewTitle("");
    setNewThumbnailUrl("");
    setNewArtPdfUrl("");
    setNewArtImageUrls("");
    setNewTags("");
    setNewStatus("arquivado");
  }

  function handleCreate() {
    createMutation.mutate({
      title: newTitle || undefined,
      thumbnailUrl: newThumbnailUrl || undefined,
      artPdfUrl: newArtPdfUrl || undefined,
      artImageUrls: newArtImageUrls || undefined,
      tags: newTags || undefined,
      status: newStatus || undefined,
    });
  }

  function parseTags(tagsStr: string | null | undefined): string[] {
    if (!tagsStr) return [];
    try {
      const parsed = JSON.parse(tagsStr);
      if (Array.isArray(parsed)) return parsed;
    } catch {}
    return tagsStr
      .split(",")
      .map((t) => t.trim())
      .filter(Boolean);
  }

  function parseImageUrls(urlsStr: string | null | undefined): string[] {
    if (!urlsStr) return [];
    try {
      const parsed = JSON.parse(urlsStr);
      if (Array.isArray(parsed)) return parsed;
    } catch {}
    return urlsStr
      .split(",")
      .map((u) => u.trim())
      .filter(Boolean);
  }

  const statusLabel: Record<string, string> = {
    arquivado: "Arquivado",
    ativo: "Ativo",
    rascunho: "Rascunho",
  };

  const statusColor: Record<string, string> = {
    arquivado: "secondary",
    ativo: "default",
    rascunho: "outline",
  };

  return (
    <PageContainer
      title="Biblioteca"
      description="Repositório de artes e coasters"
      actions={
        <Button size="sm" onClick={() => setCreateOpen(true)}>
          <Plus className="w-4 h-4 mr-1" />
          Novo Item
        </Button>
      }
    >
      <div className="flex items-center gap-3 mb-4">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Buscar por título ou tags..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
          {search && (
            <button
              onClick={() => setSearch("")}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
        <div className="flex border rounded-md overflow-hidden">
          <button
            onClick={() => setViewMode("grid")}
            className={`p-2 ${viewMode === "grid" ? "bg-primary text-primary-foreground" : "bg-card hover:bg-muted"}`}
          >
            <LayoutGrid className="w-4 h-4" />
          </button>
          <button
            onClick={() => setViewMode("list")}
            className={`p-2 ${viewMode === "list" ? "bg-primary text-primary-foreground" : "bg-card hover:bg-muted"}`}
          >
            <List className="w-4 h-4" />
          </button>
        </div>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-20">
          <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
        </div>
      ) : items.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 gap-3 text-muted-foreground">
          <ImageIcon className="w-10 h-10" />
          <p className="text-sm">Nenhum item na biblioteca</p>
          <Button variant="outline" size="sm" onClick={() => setCreateOpen(true)}>
            <Plus className="w-4 h-4 mr-1" />
            Adicionar primeiro item
          </Button>
        </div>
      ) : viewMode === "grid" ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          {items.map((item) => (
            <div
              key={item.id}
              onClick={() => setDetailItem(item)}
              className="border rounded-lg overflow-hidden bg-card cursor-pointer hover:ring-2 hover:ring-primary/30 transition-all"
            >
              <div className="aspect-[4/3] bg-muted flex items-center justify-center overflow-hidden">
                {item.thumbnailUrl ? (
                  <img
                    src={item.thumbnailUrl}
                    alt={item.title || ""}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <ImageIcon className="w-8 h-8 text-muted-foreground/40" />
                )}
              </div>
              <div className="p-3 space-y-2">
                <div className="flex items-start justify-between gap-2">
                  <p className="text-sm font-medium truncate">
                    {item.title || `Item #${item.id}`}
                  </p>
                  <Badge variant={statusColor[item.status] as any || "secondary"} className="text-[10px] flex-shrink-0">
                    {statusLabel[item.status] || item.status}
                  </Badge>
                </div>
                {item.clientName !== "—" && (
                  <p className="text-xs text-muted-foreground truncate">
                    {item.clientName}
                  </p>
                )}
                {item.campaignName !== "—" && (
                  <p className="text-xs text-muted-foreground truncate">
                    {item.campaignName}
                  </p>
                )}
                {item.tags && (
                  <div className="flex flex-wrap gap-1">
                    {parseTags(item.tags)
                      .slice(0, 3)
                      .map((tag, i) => (
                        <span
                          key={i}
                          className="text-[10px] px-1.5 py-0.5 rounded bg-muted text-muted-foreground"
                        >
                          {tag}
                        </span>
                      ))}
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="border rounded-lg overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-muted/30">
                <th className="text-left p-3 font-medium">Título</th>
                <th className="text-left p-3 font-medium hidden md:table-cell">Cliente</th>
                <th className="text-left p-3 font-medium hidden md:table-cell">Campanha</th>
                <th className="text-left p-3 font-medium hidden sm:table-cell">Tags</th>
                <th className="text-left p-3 font-medium">Status</th>
                <th className="text-right p-3 font-medium">Ações</th>
              </tr>
            </thead>
            <tbody>
              {items.map((item) => (
                <tr
                  key={item.id}
                  className="border-b last:border-0 hover:bg-muted/20 cursor-pointer"
                  onClick={() => setDetailItem(item)}
                >
                  <td className="p-3">
                    <div className="flex items-center gap-2">
                      <div className="w-8 h-8 rounded bg-muted flex items-center justify-center flex-shrink-0 overflow-hidden">
                        {item.thumbnailUrl ? (
                          <img
                            src={item.thumbnailUrl}
                            alt=""
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          <ImageIcon className="w-4 h-4 text-muted-foreground/40" />
                        )}
                      </div>
                      <span className="truncate">{item.title || `Item #${item.id}`}</span>
                    </div>
                  </td>
                  <td className="p-3 hidden md:table-cell text-muted-foreground">
                    {item.clientName}
                  </td>
                  <td className="p-3 hidden md:table-cell text-muted-foreground">
                    {item.campaignName}
                  </td>
                  <td className="p-3 hidden sm:table-cell">
                    <div className="flex flex-wrap gap-1">
                      {parseTags(item.tags)
                        .slice(0, 2)
                        .map((tag, i) => (
                          <span
                            key={i}
                            className="text-[10px] px-1.5 py-0.5 rounded bg-muted text-muted-foreground"
                          >
                            {tag}
                          </span>
                        ))}
                    </div>
                  </td>
                  <td className="p-3">
                    <Badge variant={statusColor[item.status] as any || "secondary"} className="text-[10px]">
                      {statusLabel[item.status] || item.status}
                    </Badge>
                  </td>
                  <td className="p-3 text-right">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={(e) => {
                        e.stopPropagation();
                        setDetailItem(item);
                      }}
                    >
                      <Eye className="w-4 h-4" />
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Novo Item na Biblioteca</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>Título</Label>
              <Input
                value={newTitle}
                onChange={(e) => setNewTitle(e.target.value)}
                placeholder="Nome do item"
              />
            </div>
            <div>
              <Label>URL da Thumbnail</Label>
              <Input
                value={newThumbnailUrl}
                onChange={(e) => setNewThumbnailUrl(e.target.value)}
                placeholder="https://..."
              />
            </div>
            <div>
              <Label>URL do PDF da Arte</Label>
              <Input
                value={newArtPdfUrl}
                onChange={(e) => setNewArtPdfUrl(e.target.value)}
                placeholder="https://..."
              />
            </div>
            <div>
              <Label>URLs das Imagens (separadas por vírgula)</Label>
              <Input
                value={newArtImageUrls}
                onChange={(e) => setNewArtImageUrls(e.target.value)}
                placeholder="https://img1.jpg, https://img2.jpg"
              />
            </div>
            <div>
              <Label>Tags (separadas por vírgula)</Label>
              <Input
                value={newTags}
                onChange={(e) => setNewTags(e.target.value)}
                placeholder="cerveja, bar, coaster"
              />
            </div>
            <div>
              <Label>Status</Label>
              <select
                value={newStatus}
                onChange={(e) => setNewStatus(e.target.value)}
                className="w-full h-9 rounded-md border border-input bg-background px-3 text-sm"
              >
                <option value="arquivado">Arquivado</option>
                <option value="ativo">Ativo</option>
                <option value="rascunho">Rascunho</option>
              </select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={handleCreate} disabled={createMutation.isPending}>
              {createMutation.isPending ? "Salvando..." : "Salvar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!detailItem} onOpenChange={(open) => !open && setDetailItem(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{detailItem?.title || `Item #${detailItem?.id}`}</DialogTitle>
          </DialogHeader>
          {detailItem && (
            <div className="space-y-4">
              {detailItem.thumbnailUrl && (
                <div className="rounded-lg overflow-hidden bg-muted">
                  <img
                    src={detailItem.thumbnailUrl}
                    alt={detailItem.title || ""}
                    className="w-full max-h-64 object-contain"
                  />
                </div>
              )}

              <div className="grid grid-cols-2 gap-3 text-sm">
                <div>
                  <p className="text-muted-foreground text-xs">Status</p>
                  <Badge variant={statusColor[detailItem.status] as any || "secondary"}>
                    {statusLabel[detailItem.status] || detailItem.status}
                  </Badge>
                </div>
                <div>
                  <p className="text-muted-foreground text-xs">Cliente</p>
                  <p>{detailItem.clientName || "—"}</p>
                </div>
                <div>
                  <p className="text-muted-foreground text-xs">Campanha</p>
                  <p>{detailItem.campaignName || "—"}</p>
                </div>
                <div>
                  <p className="text-muted-foreground text-xs">Criado em</p>
                  <p>
                    {detailItem.createdAt
                      ? new Date(detailItem.createdAt).toLocaleDateString("pt-BR")
                      : "—"}
                  </p>
                </div>
              </div>

              {detailItem.tags && (
                <div>
                  <p className="text-muted-foreground text-xs mb-1">Tags</p>
                  <div className="flex flex-wrap gap-1">
                    {parseTags(detailItem.tags).map((tag: string, i: number) => (
                      <Badge key={i} variant="outline" className="text-xs">
                        <Tag className="w-3 h-3 mr-1" />
                        {tag}
                      </Badge>
                    ))}
                  </div>
                </div>
              )}

              {detailItem.artPdfUrl && (
                <div>
                  <p className="text-muted-foreground text-xs mb-1">PDF da Arte</p>
                  <a
                    href={detailItem.artPdfUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 text-sm text-primary hover:underline"
                  >
                    <FileText className="w-4 h-4" />
                    Abrir PDF
                  </a>
                </div>
              )}

              {detailItem.artImageUrls && parseImageUrls(detailItem.artImageUrls).length > 0 && (
                <div>
                  <p className="text-muted-foreground text-xs mb-1">Imagens da Arte</p>
                  <div className="grid grid-cols-3 gap-2">
                    {parseImageUrls(detailItem.artImageUrls).map((url: string, i: number) => (
                      <a
                        key={i}
                        href={url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="rounded overflow-hidden bg-muted aspect-square"
                      >
                        <img
                          src={url}
                          alt=""
                          className="w-full h-full object-cover hover:opacity-80 transition-opacity"
                        />
                      </a>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
          <DialogFooter>
            <Button
              variant="destructive"
              size="sm"
              onClick={() => {
                if (detailItem && confirm("Remover este item da biblioteca?")) {
                  deleteMutation.mutate({ id: detailItem.id });
                }
              }}
            >
              <Trash2 className="w-4 h-4 mr-1" />
              Excluir
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </PageContainer>
  );
}
