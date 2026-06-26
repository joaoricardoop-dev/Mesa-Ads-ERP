/// <reference types="@types/google.maps" />

import { useCallback, useEffect, useRef, useState } from "react";
import { trpc, type RouterOutputs } from "@/lib/trpc";
import { useConfigOptions } from "@/lib/configOptions";
import { MapView } from "@/components/Map";
import { AddressAutocomplete } from "@/components/AddressAutocomplete";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
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
import { toast } from "sonner";
import { Plus, Pencil, Trash2, Monitor, MapPin, Loader2, ImagePlus, X } from "lucide-react";

type Tela = RouterOutputs["tela"]["listByRestaurant"][number];

const LAYOUT_LABELS: Record<string, string> = {
  landscape: "Landscape (horizontal)",
  portrait: "Portrait (vertical)",
  square: "Square (quadrado)",
};

interface TelasManagerProps {
  restaurantId: number;
  defaultAddress?: string | null;
  defaultLat?: string | number | null;
  defaultLng?: string | number | null;
}

export default function TelasManager({ restaurantId, defaultAddress, defaultLat, defaultLng }: TelasManagerProps) {
  const utils = trpc.useUtils();
  const listQ = trpc.tela.listByRestaurant.useQuery({ restaurantId });
  const telas = listQ.data ?? [];
  const { labelOf } = useConfigOptions("screen_category");

  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Tela | null>(null);

  const deleteMut = trpc.tela.delete.useMutation({
    onSuccess: () => {
      toast.success("Tela removida.");
      utils.tela.listByRestaurant.invalidate({ restaurantId });
    },
    onError: (e) => toast.error(e.message),
  });

  function openCreate() {
    setEditing(null);
    setOpen(true);
  }
  function openEdit(t: Tela) {
    setEditing(t);
    setOpen(true);
  }
  function handleDelete(t: Tela) {
    if (!confirm(`Remover a tela "${t.nome || t.cmsScreenId || `#${t.id}`}"?`)) return;
    deleteMut.mutate({ id: t.id });
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h3 className="text-sm font-semibold flex items-center gap-2">
            <Monitor className="w-4 h-4 text-primary" /> Telas do local
          </h3>
          <p className="text-xs text-muted-foreground">
            Cada local pode ter várias telas (pontos de mídia). Gerencie aqui o inventário.
          </p>
        </div>
        <Button onClick={openCreate} size="sm" className="gap-1.5" data-testid="button-add-tela">
          <Plus className="w-3.5 h-3.5" /> Adicionar tela
        </Button>
      </div>

      {listQ.isLoading ? (
        <p className="text-xs text-muted-foreground py-8 text-center">Carregando...</p>
      ) : telas.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border/40 bg-muted/10 py-10 text-center">
          <Monitor className="w-6 h-6 mx-auto text-muted-foreground/60" />
          <p className="text-xs text-muted-foreground mt-2">Nenhuma tela cadastrada para este local.</p>
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          {telas.map((t) => (
            <div
              key={t.id}
              className="bg-card border border-border/30 rounded-xl p-4 space-y-2"
              data-testid={`card-tela-${t.id}`}
            >
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="text-sm font-medium truncate">{t.nome || "Tela"}</p>
                  <p className="text-[11px] text-muted-foreground">{labelOf(t.categoria)}</p>
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  <Badge variant={t.status === "active" ? "secondary" : "outline"} className="text-[10px]">
                    {t.status === "active" ? "Ativa" : "Inativa"}
                  </Badge>
                  <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => openEdit(t)} data-testid={`button-edit-tela-${t.id}`}>
                    <Pencil className="w-3.5 h-3.5" />
                  </Button>
                  <Button size="icon" variant="ghost" className="h-7 w-7 text-red-400" onClick={() => handleDelete(t)} data-testid={`button-delete-tela-${t.id}`}>
                    <Trash2 className="w-3.5 h-3.5" />
                  </Button>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-[11px] text-muted-foreground">
                {t.cmsScreenId && <InfoLine label="CMS" value={t.cmsScreenId} />}
                {(t.width || t.height) && <InfoLine label="Dimensões" value={`${t.width ?? "?"}×${t.height ?? "?"} cm`} />}
                {t.layout && <InfoLine label="Layout" value={LAYOUT_LABELS[t.layout] ?? t.layout} />}
                {t.horarioFuncionamento && <InfoLine label="Horário" value={t.horarioFuncionamento} />}
                {(t.lat && t.lng) && <InfoLine label="Coordenadas" value={`${Number(t.lat).toFixed(5)}, ${Number(t.lng).toFixed(5)}`} />}
              </div>
              {t.address && <p className="text-[11px] text-muted-foreground flex items-start gap-1"><MapPin className="w-3 h-3 mt-0.5 shrink-0" />{t.address}</p>}
            </div>
          ))}
        </div>
      )}

      {open && (
        <TelaDialog
          open={open}
          onOpenChange={setOpen}
          restaurantId={restaurantId}
          editing={editing}
          defaultAddress={defaultAddress}
          defaultLat={defaultLat}
          defaultLng={defaultLng}
          onSaved={() => {
            utils.tela.listByRestaurant.invalidate({ restaurantId });
            setOpen(false);
          }}
        />
      )}
    </div>
  );
}

function InfoLine({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <span className="uppercase tracking-wider text-[9px] text-muted-foreground/70">{label}</span>
      <p className="text-foreground/90">{value}</p>
    </div>
  );
}

interface TelaFormState {
  restaurantId: number | null;
  nome: string;
  categoria: string;
  horarioFuncionamento: string;
  descricao: string;
  address: string;
  lat: number | null;
  lng: number | null;
  width: string;
  height: string;
  layout: string;
  cmsScreenId: string;
  spotDuration: string;
  loopDuration: string;
  dailyLoops: string;
  photoUrls: string[];
  status: string;
}

function num(v: string | number | null | undefined): number | null {
  if (v == null || v === "") return null;
  const n = typeof v === "number" ? v : parseFloat(v);
  return Number.isFinite(n) ? n : null;
}

function buildInitial(
  editing: Tela | null,
  defaults: { restaurantId?: number | null; address?: string | null; lat?: string | number | null; lng?: string | number | null },
): TelaFormState {
  if (editing) {
    return {
      restaurantId: editing.restaurantId,
      nome: editing.nome ?? "",
      categoria: editing.categoria ?? "restaurante",
      horarioFuncionamento: editing.horarioFuncionamento ?? "",
      descricao: editing.descricao ?? "",
      address: editing.address ?? "",
      lat: num(editing.lat),
      lng: num(editing.lng),
      width: editing.width != null ? String(editing.width) : "",
      height: editing.height != null ? String(editing.height) : "",
      layout: editing.layout ?? "_none",
      cmsScreenId: editing.cmsScreenId ?? "",
      spotDuration: editing.spotDuration != null ? String(editing.spotDuration) : "",
      loopDuration: editing.loopDuration != null ? String(editing.loopDuration) : "",
      dailyLoops: editing.dailyLoops != null ? String(editing.dailyLoops) : "",
      photoUrls: Array.isArray(editing.photoUrls) ? editing.photoUrls : [],
      status: editing.status ?? "active",
    };
  }
  return {
    restaurantId: defaults.restaurantId ?? null,
    nome: "",
    categoria: "restaurante",
    horarioFuncionamento: "",
    descricao: "",
    address: defaults.address ?? "",
    lat: num(defaults.lat),
    lng: num(defaults.lng),
    width: "",
    height: "",
    layout: "_none",
    cmsScreenId: "",
    spotDuration: "",
    loopDuration: "",
    dailyLoops: "",
    photoUrls: [],
    status: "active",
  };
}

interface TelaDialogProps {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  restaurantId?: number | null;
  // Quando fornecido (página dedicada "Telas"), exibe um seletor de local na
  // criação. Quando ausente (aba dentro do perfil do local), o local é fixo.
  restaurantOptions?: { id: number; name: string | null }[];
  editing: Tela | null;
  defaultAddress?: string | null;
  defaultLat?: string | number | null;
  defaultLng?: string | number | null;
  onSaved: () => void;
}

export function TelaDialog({ open, onOpenChange, restaurantId, restaurantOptions, editing, defaultAddress, defaultLat, defaultLng, onSaved }: TelaDialogProps) {
  const [form, setForm] = useState<TelaFormState>(() =>
    buildInitial(editing, { restaurantId, address: defaultAddress, lat: defaultLat, lng: defaultLng }),
  );
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const { options: categoryOptions } = useConfigOptions("screen_category");

  const mapRef = useRef<google.maps.Map | null>(null);
  const markerRef = useRef<google.maps.marker.AdvancedMarkerElement | null>(null);

  const createMut = trpc.tela.create.useMutation({
    onSuccess: () => { toast.success("Tela criada."); onSaved(); },
    onError: (e) => toast.error(e.message),
  });
  const updateMut = trpc.tela.update.useMutation({
    onSuccess: () => { toast.success("Tela atualizada."); onSaved(); },
    onError: (e) => toast.error(e.message),
  });

  // Cria/atualiza o marcador arrastável na posição informada e centraliza o mapa.
  const placeMarker = useCallback((lat: number, lng: number) => {
    const map = mapRef.current;
    if (!map || !window.google) return;
    const pos = { lat, lng };
    if (!markerRef.current) {
      markerRef.current = new window.google.maps.marker.AdvancedMarkerElement({
        map,
        position: pos,
        gmpDraggable: true,
      });
      markerRef.current.addListener("dragend", () => {
        const p = markerRef.current!.position as google.maps.LatLngLiteral | null;
        if (p) setForm((f) => ({ ...f, lat: p.lat, lng: p.lng }));
      });
    } else {
      markerRef.current.position = pos;
    }
    map.panTo(pos);
  }, []);

  const handleMapReady = useCallback((map: google.maps.Map) => {
    mapRef.current = map;
    if (form.lat != null && form.lng != null) {
      placeMarker(form.lat, form.lng);
      map.setZoom(16);
    }
    // Clique no mapa também fixa o pin manualmente.
    map.addListener("click", (e: google.maps.MapMouseEvent) => {
      if (!e.latLng) return;
      const lat = e.latLng.lat();
      const lng = e.latLng.lng();
      setForm((f) => ({ ...f, lat, lng }));
      placeMarker(lat, lng);
    });
  }, [form.lat, form.lng, placeMarker]);

  // Seleção de uma sugestão do autocomplete do Google: preenche o endereço e
  // posiciona o pino nas coordenadas retornadas. O ajuste fino segue por
  // clique/arraste do pino no mapa.
  function handleAddressSelect(lat: number | null, lng: number | null, address: string) {
    setForm((f) => ({ ...f, address: address || f.address, lat, lng }));
    if (lat != null && lng != null) {
      placeMarker(lat, lng);
      mapRef.current?.setZoom(16);
    }
  }

  async function handlePhotoUpload(files: FileList | null) {
    if (!files || files.length === 0) return;
    setUploading(true);
    try {
      const uploaded: string[] = [];
      for (const file of Array.from(files)) {
        const fd = new FormData();
        fd.append("photo", file);
        const res = await fetch("/api/tela-photo/upload", { method: "POST", body: fd });
        const data = await res.json().catch(() => ({}));
        if (!res.ok || !data?.url) {
          throw new Error(data?.error || "Falha no upload da foto.");
        }
        uploaded.push(data.url as string);
      }
      setForm((f) => ({ ...f, photoUrls: [...f.photoUrls, ...uploaded] }));
      toast.success(uploaded.length > 1 ? "Fotos enviadas." : "Foto enviada.");
    } catch (err: any) {
      toast.error(err?.message ?? "Erro ao enviar foto.");
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }

  function removePhoto(url: string) {
    setForm((f) => ({ ...f, photoUrls: f.photoUrls.filter((u) => u !== url) }));
  }

  function handleSubmit() {
    if (!form.categoria) {
      toast.error("Selecione a categoria.");
      return;
    }
    const targetRestaurantId = editing ? editing.restaurantId : form.restaurantId;
    if (!targetRestaurantId) {
      toast.error("Selecione o local desta tela.");
      return;
    }
    const payload = {
      nome: form.nome.trim() || null,
      categoria: form.categoria,
      horarioFuncionamento: form.horarioFuncionamento.trim() || null,
      descricao: form.descricao.trim() || null,
      address: form.address.trim() || null,
      lat: form.lat,
      lng: form.lng,
      width: form.width ? parseInt(form.width) : null,
      height: form.height ? parseInt(form.height) : null,
      layout: (form.layout === "_none" ? null : form.layout) as "landscape" | "portrait" | "square" | null,
      cmsScreenId: form.cmsScreenId.trim() || null,
      spotDuration: form.spotDuration ? parseInt(form.spotDuration) : null,
      loopDuration: form.loopDuration ? parseInt(form.loopDuration) : null,
      dailyLoops: form.dailyLoops ? parseInt(form.dailyLoops) : null,
      photoUrls: form.photoUrls,
      status: form.status as "active" | "inactive",
    };
    if (editing) {
      updateMut.mutate({ id: editing.id, ...payload });
    } else {
      createMut.mutate({ restaurantId: targetRestaurantId, ...payload });
    }
  }

  const saving = createMut.isPending || updateMut.isPending;
  const showRestaurantPicker = !editing && Array.isArray(restaurantOptions) && restaurantOptions.length > 0;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{editing ? "Editar tela" : "Nova tela"}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-1">
          {showRestaurantPicker && (
            <FieldWrap label="Local *">
              <Select
                value={form.restaurantId != null ? String(form.restaurantId) : ""}
                onValueChange={(v) => setForm((f) => ({ ...f, restaurantId: parseInt(v) }))}
              >
                <SelectTrigger data-testid="select-tela-restaurant"><SelectValue placeholder="Selecione o local" /></SelectTrigger>
                <SelectContent>
                  {restaurantOptions!.map((r) => (
                    <SelectItem key={r.id} value={String(r.id)}>{r.name ?? `Local #${r.id}`}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </FieldWrap>
          )}
          <div className="grid grid-cols-2 gap-3">
            <FieldWrap label="Nome / identificação">
              <Input value={form.nome} onChange={(e) => setForm((f) => ({ ...f, nome: e.target.value }))} placeholder="Ex.: Tela do balcão" data-testid="input-tela-nome" />
            </FieldWrap>
            <FieldWrap label="Categoria *">
              <Select value={form.categoria} onValueChange={(v) => setForm((f) => ({ ...f, categoria: v }))}>
                <SelectTrigger data-testid="select-tela-categoria"><SelectValue placeholder="Selecione" /></SelectTrigger>
                <SelectContent>
                  {categoryOptions.map((o) => (
                    <SelectItem key={o.code} value={o.code}>{o.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </FieldWrap>
            <FieldWrap label="Nº da Tela no CMS">
              <Input value={form.cmsScreenId} onChange={(e) => setForm((f) => ({ ...f, cmsScreenId: e.target.value }))} placeholder="SCR-042" data-testid="input-tela-cms" />
            </FieldWrap>
            <FieldWrap label="Horário de Funcionamento">
              <Input value={form.horarioFuncionamento} onChange={(e) => setForm((f) => ({ ...f, horarioFuncionamento: e.target.value }))} placeholder="Seg-Sex 08h-22h" />
            </FieldWrap>
            <FieldWrap label="Largura (cm)">
              <Input type="number" value={form.width} onChange={(e) => setForm((f) => ({ ...f, width: e.target.value }))} placeholder="192" data-testid="input-tela-width" />
            </FieldWrap>
            <FieldWrap label="Altura (cm)">
              <Input type="number" value={form.height} onChange={(e) => setForm((f) => ({ ...f, height: e.target.value }))} placeholder="108" data-testid="input-tela-height" />
            </FieldWrap>
            <FieldWrap label="Layout / orientação">
              <Select value={form.layout} onValueChange={(v) => setForm((f) => ({ ...f, layout: v }))}>
                <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="_none">Não informado</SelectItem>
                  <SelectItem value="landscape">Landscape (horizontal)</SelectItem>
                  <SelectItem value="portrait">Portrait (vertical)</SelectItem>
                  <SelectItem value="square">Square (quadrado)</SelectItem>
                </SelectContent>
              </Select>
            </FieldWrap>
            {editing && (
              <FieldWrap label="Status">
                <Select value={form.status} onValueChange={(v) => setForm((f) => ({ ...f, status: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="active">Ativa</SelectItem>
                    <SelectItem value="inactive">Inativa</SelectItem>
                  </SelectContent>
                </Select>
              </FieldWrap>
            )}
            <FieldWrap label="Duração do Spot (s)">
              <Input type="number" value={form.spotDuration} onChange={(e) => setForm((f) => ({ ...f, spotDuration: e.target.value }))} />
            </FieldWrap>
            <FieldWrap label="Duração do Loop (s)">
              <Input type="number" value={form.loopDuration} onChange={(e) => setForm((f) => ({ ...f, loopDuration: e.target.value }))} />
            </FieldWrap>
            <FieldWrap label="Loops por Dia">
              <Input type="number" value={form.dailyLoops} onChange={(e) => setForm((f) => ({ ...f, dailyLoops: e.target.value }))} />
            </FieldWrap>
          </div>

          <FieldWrap label="Descrição do ponto">
            <Textarea value={form.descricao} onChange={(e) => setForm((f) => ({ ...f, descricao: e.target.value }))} placeholder="Descrição do ponto de mídia..." className="min-h-[60px]" />
          </FieldWrap>

          <div className="space-y-2">
            <Label className="text-xs text-muted-foreground">Fotos da tela</Label>
            <p className="text-[10px] text-muted-foreground">
              As fotos aparecem no ecommerce (montar campanha) junto do local. PNG ou JPG, até 5MB cada.
            </p>
            <div className="flex flex-wrap gap-2">
              {form.photoUrls.map((url) => (
                <div key={url} className="relative w-24 h-24 rounded-lg overflow-hidden border border-border/40 group">
                  <img src={url} alt="Foto da tela" className="w-full h-full object-cover" />
                  <button
                    type="button"
                    onClick={() => removePhoto(url)}
                    className="absolute top-1 right-1 bg-background/80 hover:bg-background rounded-full p-0.5 text-red-500"
                    data-testid="button-remove-tela-photo"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))}
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                disabled={uploading}
                className="w-24 h-24 rounded-lg border border-dashed border-border/50 flex flex-col items-center justify-center gap-1 text-muted-foreground hover:bg-muted/20 disabled:opacity-50"
                data-testid="button-add-tela-photo"
              >
                {uploading ? <Loader2 className="w-5 h-5 animate-spin" /> : <ImagePlus className="w-5 h-5" />}
                <span className="text-[10px]">{uploading ? "Enviando..." : "Adicionar"}</span>
              </button>
            </div>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/png,image/jpeg"
              multiple
              className="hidden"
              onChange={(e) => handlePhotoUpload(e.target.files)}
            />
          </div>

          <div className="space-y-2">
            <Label className="text-xs text-muted-foreground">Localização</Label>
            <AddressAutocomplete
              placeholder="Buscar endereço (rua, número, bairro, cidade)"
              data-testid="input-tela-address-search"
              onSelect={(a) =>
                handleAddressSelect(a.lat, a.lng, a.formattedAddress)
              }
            />
            <Input
              value={form.address}
              onChange={(e) => setForm((f) => ({ ...f, address: e.target.value }))}
              placeholder="Endereço completo (editável)"
              data-testid="input-tela-address"
            />
            <p className="text-[10px] text-muted-foreground">
              Busque o endereço acima para posicionar o pino automaticamente. Você pode editar o texto do endereço e arrastar o pin / clicar no mapa para ajustar a posição manualmente.
            </p>
            <div className="rounded-lg overflow-hidden border border-border/30">
              <MapView
                className="h-[260px]"
                initialCenter={form.lat != null && form.lng != null ? { lat: form.lat, lng: form.lng } : undefined}
                initialZoom={form.lat != null && form.lng != null ? 16 : 12}
                onMapReady={handleMapReady}
              />
            </div>
            {form.lat != null && form.lng != null && (
              <p className="text-[10px] text-muted-foreground font-mono">
                Coordenadas: {form.lat.toFixed(6)}, {form.lng.toFixed(6)}
              </p>
            )}
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button onClick={handleSubmit} disabled={saving} data-testid="button-save-tela">
            {editing ? "Salvar" : "Criar tela"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function FieldWrap({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <Label className="text-xs text-muted-foreground">{label}</Label>
      {children}
    </div>
  );
}
