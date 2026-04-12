import { useState, useEffect, Fragment } from "react";
import { useLocation } from "wouter";
import { z } from "zod";
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
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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
import PageContainer from "@/components/PageContainer";
import { toast } from "sonner";
import {
  Plus,
  Pencil,
  Trash2,
  Building2,
  Phone,
  Search,
  Tag,
  MapPin,
  Network,
  Instagram,
  ChevronDown,
  ArrowUpDown,
  ChevronUp,
  Mail,
  Eye,
} from "lucide-react";

interface ClientForm {
  name: string;
  company: string;
  razaoSocial: string;
  cnpj: string;
  instagram: string;
  contactEmail: string;
  contactPhone: string;
  address: string;
  addressNumber: string;
  neighborhood: string;
  city: string;
  state: string;
  cep: string;
  segment: string;
  status: "active" | "inactive";
}

const emptyForm: ClientForm = {
  name: "",
  company: "",
  razaoSocial: "",
  cnpj: "",
  instagram: "",
  contactEmail: "",
  contactPhone: "",
  address: "",
  addressNumber: "",
  neighborhood: "",
  city: "",
  state: "",
  cep: "",
  segment: "",
  status: "active",
};

const clientSchema = z.object({
  name: z.string().min(2, "Nome deve ter pelo menos 2 caracteres"),
  contactEmail: z.string().email("E-mail inválido").or(z.literal("")).optional(),
});

type ClientErrors = Partial<Record<keyof z.infer<typeof clientSchema>, string>>;

const SEGMENTS = [
  "Alimentação",
  "Bebidas",
  "Tecnologia",
  "Saúde",
  "Beleza",
  "Moda",
  "Entretenimento",
  "Finanças",
  "Educação",
  "Varejo",
  "Automotivo",
  "Turismo",
  "Construção",
  "Imobiliário",
  "Serviços",
  "Academia",
  "Outro",
];

type SortKey = "name" | "neighborhood" | "contactPhone" | "status";
type SortDir = "asc" | "desc";

export default function Clients() {
  const [, navigate] = useLocation();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [form, setForm] = useState<ClientForm>(emptyForm);
  const [formErrors, setFormErrors] = useState<ClientErrors>({});
  const [deleteId, setDeleteId] = useState<number | null>(null);
  const [search, setSearch] = useState("");
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const [sortKey, setSortKey] = useState<SortKey>("name");
  const [sortDir, setSortDir] = useState<SortDir>("asc");
  const [page, setPage] = useState(1);
  const PAGE_SIZE = 25;

  const utils = trpc.useUtils();
  const { data: clientStats } = trpc.advertiser.stats.useQuery();
  const { data: pagedResult, isLoading } = trpc.advertiser.list.useQuery({
    page,
    pageSize: PAGE_SIZE,
    search: search.trim() || undefined,
  });

  useEffect(() => {
    setPage(1);
  }, [search]);

  const createMutation = trpc.advertiser.create.useMutation({
    onSuccess: () => {
      utils.advertiser.list.invalidate();
      utils.advertiser.stats.invalidate();
      setIsDialogOpen(false);
      setForm(emptyForm);
      toast.success("Cliente cadastrado com sucesso!");
    },
    onError: (err) => toast.error(`Erro: ${err.message}`),
  });

  const updateMutation = trpc.advertiser.update.useMutation({
    onSuccess: () => {
      utils.advertiser.list.invalidate();
      utils.advertiser.stats.invalidate();
      setIsDialogOpen(false);
      setEditingId(null);
      setForm(emptyForm);
      toast.success("Cliente atualizado!");
    },
    onError: (err) => toast.error(`Erro: ${err.message}`),
  });

  const deleteMutation = trpc.advertiser.delete.useMutation({
    onSuccess: () => {
      utils.advertiser.list.invalidate();
      utils.advertiser.stats.invalidate();
      setDeleteId(null);
      toast.success("Cliente removido!");
    },
    onError: (err) => toast.error(`Erro: ${err.message}`),
  });

  const handleSubmit = () => {
    const result = clientSchema.safeParse({ name: form.name, contactEmail: form.contactEmail || "" });
    if (!result.success) {
      const errors: ClientErrors = {};
      result.error.errors.forEach((e) => {
        const field = e.path[0] as keyof ClientErrors;
        if (!errors[field]) errors[field] = e.message;
      });
      setFormErrors(errors);
      return;
    }
    setFormErrors({});
    if (editingId) {
      updateMutation.mutate({ id: editingId, ...form });
    } else {
      createMutation.mutate(form);
    }
  };

  const handleEdit = (c: (typeof pagedItems)[0]) => {
    setEditingId(c.id);
    setFormErrors({});
    setForm({
      name: c.name,
      company: c.company || "",
      razaoSocial: c.razaoSocial || "",
      cnpj: c.cnpj || "",
      instagram: c.instagram || "",
      contactEmail: c.contactEmail || "",
      contactPhone: c.contactPhone || "",
      address: c.address || "",
      addressNumber: c.addressNumber || "",
      neighborhood: c.neighborhood || "",
      city: c.city || "",
      state: c.state || "",
      cep: c.cep || "",
      segment: c.segment || "",
      status: c.status,
    });
    setIsDialogOpen(true);
  };

  const handleNew = () => {
    setEditingId(null);
    setForm(emptyForm);
    setFormErrors({});
    setIsDialogOpen(true);
  };

  const handleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortDir(sortDir === "asc" ? "desc" : "asc");
    } else {
      setSortKey(key);
      setSortDir("asc");
    }
  };

  const pagedItems = pagedResult?.items ?? [];
  const pagedTotal = pagedResult?.total ?? 0;
  const pagedTotalPages = pagedResult?.totalPages ?? 0;

  const parentIdsSet = new Set(clientStats?.matrizIds ?? []);

  const sorted = [...pagedItems].sort((a, b) => {
    const dir = sortDir === "asc" ? 1 : -1;
    switch (sortKey) {
      case "name":
        return a.name.localeCompare(b.name) * dir;
      case "neighborhood":
        return (a.neighborhood || "").localeCompare(b.neighborhood || "") * dir;
      case "contactPhone":
        return (a.contactPhone || "").localeCompare(b.contactPhone || "") * dir;
      case "status":
        return a.status.localeCompare(b.status) * dir;
      default:
        return 0;
    }
  });

  const activeCount = clientStats?.active ?? 0;

  const SortHeader = ({ label, col, className = "" }: { label: string; col: SortKey; className?: string }) => (
    <TableHead
      className={`text-xs text-muted-foreground font-medium cursor-pointer select-none hover:text-foreground transition-colors ${className}`}
      onClick={() => handleSort(col)}
    >
      <div className="flex items-center gap-1">
        {label}
        {sortKey === col ? (
          sortDir === "asc" ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />
        ) : (
          <ArrowUpDown className="w-3 h-3 opacity-40" />
        )}
      </div>
    </TableHead>
  );

  return (
    <PageContainer
      title="Anunciantes"
      description="Base de dados dos anunciantes da Mesa Ads"
      actions={
        <Button onClick={handleNew} className="gap-2">
          <Plus className="w-4 h-4" />
          Novo Cliente
        </Button>
      }
    >

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="bg-card border border-border/30 rounded-lg p-4">
          <p className="text-xs text-muted-foreground">Total Clientes</p>
          <p className="text-2xl font-bold font-mono">{clientStats?.total ?? 0}</p>
        </div>
        <div className="bg-card border border-border/30 rounded-lg p-4">
          <p className="text-xs text-muted-foreground">Ativos</p>
          <p className="text-2xl font-bold font-mono text-primary">
            {activeCount}
          </p>
        </div>
      </div>

      {/* Search */}
      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input
          placeholder="Buscar cliente..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-9 bg-card border-border/30"
        />
      </div>

      {/* Table */}
      <div className="bg-card border border-border/30 rounded-lg overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow className="border-border/30 hover:bg-transparent">
              <SortHeader label="CLIENTE" col="name" />
              <SortHeader label="LOCALIZAÇÃO" col="neighborhood" className="hidden md:table-cell" />
              <SortHeader label="CONTATO" col="contactPhone" className="hidden lg:table-cell" />
              <SortHeader label="STATUS" col="status" className="text-center" />
              <TableHead className="text-xs text-muted-foreground font-medium text-right">
                AÇÕES
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow>
                <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">
                  Carregando...
                </TableCell>
              </TableRow>
            ) : sorted.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">
                  {search
                    ? "Nenhum cliente encontrado"
                    : "Nenhum cliente cadastrado. Clique em \"Novo Cliente\" para começar."}
                </TableCell>
              </TableRow>
            ) : (
              sorted.map((c) => (
                <Fragment key={c.id}>
                  <TableRow
                    className="border-border/20 hover:bg-card/80 cursor-pointer"
                    onClick={() => setExpandedId(expandedId === c.id ? null : c.id)}
                  >
                    <TableCell className="font-medium">
                      <div className="flex items-center gap-2">
                        <ChevronDown className={`w-4 h-4 text-muted-foreground transition-transform ${expandedId === c.id ? "rotate-180" : ""}`} />
                        {c.name}
                        {parentIdsSet.has(c.id) && (
                          <Badge variant="outline" className="bg-blue-500/10 text-blue-400 border-blue-500/30 text-[10px] px-1.5 py-0">
                            <Network className="w-3 h-3 mr-0.5" /> Matriz
                          </Badge>
                        )}
                        {(c as any).parentId && (
                          <Badge variant="outline" className="bg-violet-500/10 text-violet-400 border-violet-500/30 text-[10px] px-1.5 py-0">
                            <Building2 className="w-3 h-3 mr-0.5" /> Filial
                          </Badge>
                        )}
                        {(c as any).selfRegistered && (
                          <Badge variant="outline" className="bg-amber-500/10 text-amber-500 border-amber-500/30 text-[10px] px-1.5 py-0">
                            Self-registered
                          </Badge>
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="hidden md:table-cell text-muted-foreground text-sm">
                      <div className="flex items-center gap-1">
                        <MapPin className="w-3 h-3" />
                        {c.neighborhood || c.city || "—"}
                      </div>
                    </TableCell>
                    <TableCell className="hidden lg:table-cell text-muted-foreground text-sm">
                      <div className="flex items-center gap-1">
                        <Phone className="w-3 h-3" />
                        {c.contactPhone || "—"}
                      </div>
                    </TableCell>
                    <TableCell className="text-center">
                      <Badge
                        variant={c.status === "active" ? "default" : "secondary"}
                        className={
                          c.status === "active"
                            ? "bg-primary/20 text-primary border-primary/30"
                            : "bg-muted text-muted-foreground"
                        }
                      >
                        {c.status === "active" ? "Ativo" : "Inativo"}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-1" onClick={(e) => e.stopPropagation()}>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8"
                          onClick={() => navigate(`/clientes/${c.id}`)}
                          title="Ver Perfil"
                        >
                          <Eye className="w-3.5 h-3.5" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8"
                          onClick={() => handleEdit(c)}
                        >
                          <Pencil className="w-3.5 h-3.5" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-destructive hover:text-destructive"
                          onClick={() => setDeleteId(c.id)}
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                  {expandedId === c.id && (
                    <TableRow className="border-border/10 bg-background/50 hover:bg-background/50">
                      <TableCell colSpan={5} className="p-0">
                        <div className="px-6 py-4 grid grid-cols-1 md:grid-cols-3 gap-6 text-sm">
                          <div className="space-y-3">
                            <p className="text-[10px] uppercase tracking-widest text-primary font-semibold">Identificação</p>
                            <div className="space-y-1.5">
                              <div className="flex items-center gap-2">
                                <Building2 className="w-3.5 h-3.5 text-muted-foreground" />
                                <span className="text-muted-foreground">Razão Social:</span>
                                <span className="truncate">{c.razaoSocial || "—"}</span>
                              </div>
                              <div className="flex items-center gap-2">
                                <Building2 className="w-3.5 h-3.5 text-muted-foreground" />
                                <span className="text-muted-foreground">CNPJ:</span>
                                <span>{c.cnpj || "—"}</span>
                              </div>
                              {c.company && (
                                <div className="flex items-center gap-2">
                                  <Tag className="w-3.5 h-3.5 text-muted-foreground" />
                                  <span className="text-muted-foreground">Nome Fantasia:</span>
                                  <span>{c.company}</span>
                                </div>
                              )}
                            </div>
                          </div>

                          <div className="space-y-3">
                            <p className="text-[10px] uppercase tracking-widest text-primary font-semibold">Endereço</p>
                            <div className="space-y-1.5">
                              <div className="flex items-center gap-2">
                                <MapPin className="w-3.5 h-3.5 text-muted-foreground" />
                                <span>
                                  {[c.address, c.addressNumber].filter(Boolean).join(", ") || "—"}
                                </span>
                              </div>
                              <div className="flex items-center gap-2">
                                <MapPin className="w-3.5 h-3.5 text-muted-foreground invisible" />
                                <span>
                                  {[c.neighborhood, c.city, c.state].filter(Boolean).join(" — ") || "—"}
                                </span>
                              </div>
                              {c.cep && (
                                <div className="flex items-center gap-2">
                                  <MapPin className="w-3.5 h-3.5 text-muted-foreground invisible" />
                                  <span className="text-muted-foreground">CEP:</span>
                                  <span>{c.cep}</span>
                                </div>
                              )}
                            </div>
                          </div>

                          <div className="space-y-3">
                            <p className="text-[10px] uppercase tracking-widest text-primary font-semibold">Contato</p>
                            <div className="space-y-1.5">
                              {c.contactPhone && (
                                <div className="flex items-center gap-2">
                                  <Phone className="w-3.5 h-3.5 text-muted-foreground" />
                                  <span>{c.contactPhone}</span>
                                </div>
                              )}
                              {c.contactEmail && (
                                <div className="flex items-center gap-2">
                                  <Mail className="w-3.5 h-3.5 text-muted-foreground" />
                                  <span>{c.contactEmail}</span>
                                </div>
                              )}
                              {c.instagram && (
                                <div className="flex items-center gap-2">
                                  <Instagram className="w-3.5 h-3.5 text-pink-500" />
                                  <span>{c.instagram}</span>
                                </div>
                              )}
                              {c.segment && (
                                <div className="flex items-center gap-2">
                                  <Tag className="w-3.5 h-3.5 text-muted-foreground" />
                                  <span className="text-muted-foreground">Segmento:</span>
                                  <span>{c.segment}</span>
                                </div>
                              )}
                            </div>
                          </div>
                        </div>
                        <div className="px-6 pb-4">
                          <Button variant="outline" size="sm" className="gap-2" onClick={() => navigate(`/clientes/${c.id}`)}>
                            <Eye className="w-3.5 h-3.5" /> Ver Perfil Completo
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  )}
                </Fragment>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {pagedTotalPages > 1 && (
        <div className="flex items-center justify-between">
          <span className="text-xs text-muted-foreground">
            Mostrando {((page - 1) * PAGE_SIZE) + 1}–{Math.min(page * PAGE_SIZE, pagedTotal)} de {pagedTotal}
          </span>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page <= 1}
              className="h-7 px-3 rounded-md text-xs border border-border/30 bg-card text-muted-foreground hover:text-foreground hover:bg-muted transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
            >
              Anterior
            </button>
            <span className="text-xs text-muted-foreground">{page} / {pagedTotalPages}</span>
            <button
              onClick={() => setPage((p) => Math.min(pagedTotalPages, p + 1))}
              disabled={page >= pagedTotalPages}
              className="h-7 px-3 rounded-md text-xs border border-border/30 bg-card text-muted-foreground hover:text-foreground hover:bg-muted transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
            >
              Próxima
            </button>
          </div>
        </div>
      )}

      {/* Create/Edit Dialog */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="sm:max-w-2xl bg-card border-border/30 max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {editingId ? "Editar Cliente" : "Novo Cliente"}
            </DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <p className="text-[10px] uppercase tracking-widest text-primary font-semibold">Identificação</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label>Nome / Marca *</Label>
                <Input
                  value={form.name}
                  onChange={(e) => { setForm({ ...form, name: e.target.value }); if (formErrors.name) setFormErrors({ ...formErrors, name: undefined }); }}
                  placeholder="Nome do cliente"
                  className={`bg-background border-border/30 ${formErrors.name ? "border-destructive" : ""}`}
                />
                {formErrors.name && <p className="text-xs text-destructive">{formErrors.name}</p>}
              </div>
              <div className="grid gap-2">
                <Label>Nome Fantasia</Label>
                <Input
                  value={form.company}
                  onChange={(e) => setForm({ ...form, company: e.target.value })}
                  placeholder="Nome fantasia"
                  className="bg-background border-border/30"
                />
              </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label>Razão Social</Label>
                <Input
                  value={form.razaoSocial}
                  onChange={(e) => setForm({ ...form, razaoSocial: e.target.value })}
                  placeholder="Razão social"
                  className="bg-background border-border/30"
                />
              </div>
              <div className="grid gap-2">
                <Label>CNPJ</Label>
                <Input
                  value={form.cnpj}
                  onChange={(e) => setForm({ ...form, cnpj: e.target.value })}
                  placeholder="00.000.000/0000-00"
                  className="bg-background border-border/30"
                />
              </div>
            </div>

            <p className="text-[10px] uppercase tracking-widest text-primary font-semibold mt-2">Endereço</p>
            <div className="grid grid-cols-[1fr_100px] gap-4">
              <div className="grid gap-2">
                <Label>Logradouro</Label>
                <Input
                  value={form.address}
                  onChange={(e) => setForm({ ...form, address: e.target.value })}
                  placeholder="Rua, Av, etc."
                  className="bg-background border-border/30"
                />
              </div>
              <div className="grid gap-2">
                <Label>N°</Label>
                <Input
                  value={form.addressNumber}
                  onChange={(e) => setForm({ ...form, addressNumber: e.target.value })}
                  placeholder="123"
                  className="bg-background border-border/30"
                />
              </div>
            </div>
            <div className="grid grid-cols-3 gap-4">
              <div className="grid gap-2">
                <Label>Bairro</Label>
                <Input
                  value={form.neighborhood}
                  onChange={(e) => setForm({ ...form, neighborhood: e.target.value })}
                  placeholder="Bairro"
                  className="bg-background border-border/30"
                />
              </div>
              <div className="grid gap-2">
                <Label>Cidade</Label>
                <Input
                  value={form.city}
                  onChange={(e) => setForm({ ...form, city: e.target.value })}
                  placeholder="Cidade"
                  className="bg-background border-border/30"
                />
              </div>
              <div className="grid grid-cols-[1fr_80px] gap-2">
                <div className="grid gap-2">
                  <Label>CEP</Label>
                  <Input
                    value={form.cep}
                    onChange={(e) => setForm({ ...form, cep: e.target.value })}
                    placeholder="00000-000"
                    className="bg-background border-border/30"
                  />
                </div>
                <div className="grid gap-2">
                  <Label>UF</Label>
                  <Input
                    value={form.state}
                    onChange={(e) => setForm({ ...form, state: e.target.value.toUpperCase().slice(0, 2) })}
                    placeholder="AM"
                    maxLength={2}
                    className="bg-background border-border/30"
                  />
                </div>
              </div>
            </div>

            <p className="text-[10px] uppercase tracking-widest text-primary font-semibold mt-2">Contato</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label>Telefone</Label>
                <Input
                  value={form.contactPhone}
                  onChange={(e) => setForm({ ...form, contactPhone: e.target.value })}
                  placeholder="(92) 3333-3333"
                  className="bg-background border-border/30"
                />
              </div>
              <div className="grid gap-2">
                <Label>E-mail</Label>
                <Input
                  type="email"
                  value={form.contactEmail}
                  onChange={(e) => { setForm({ ...form, contactEmail: e.target.value }); if (formErrors.contactEmail) setFormErrors({ ...formErrors, contactEmail: undefined }); }}
                  placeholder="email@empresa.com"
                  className={`bg-background border-border/30 ${formErrors.contactEmail ? "border-destructive" : ""}`}
                />
                {formErrors.contactEmail && <p className="text-xs text-destructive">{formErrors.contactEmail}</p>}
              </div>
            </div>
            <div className="grid gap-2">
              <Label className="flex items-center gap-1.5">
                <Instagram className="w-3.5 h-3.5 text-pink-500" />
                Instagram
              </Label>
              <Input
                value={form.instagram}
                onChange={(e) => setForm({ ...form, instagram: e.target.value })}
                placeholder="@cliente"
                className="bg-background border-border/30"
              />
            </div>

            <p className="text-[10px] uppercase tracking-widest text-primary font-semibold mt-2">Classificação</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label>Segmento</Label>
                <Select
                  value={form.segment || "none"}
                  onValueChange={(v) =>
                    setForm({ ...form, segment: v === "none" ? "" : v })
                  }
                >
                  <SelectTrigger className="bg-background border-border/30">
                    <SelectValue placeholder="Selecione" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Nenhum</SelectItem>
                    {SEGMENTS.map((s) => (
                      <SelectItem key={s} value={s}>
                        {s}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid gap-2">
                <Label>Status</Label>
                <Select
                  value={form.status}
                  onValueChange={(v) =>
                    setForm({ ...form, status: v as "active" | "inactive" })
                  }
                >
                  <SelectTrigger className="bg-background border-border/30">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="active">Ativo</SelectItem>
                    <SelectItem value="inactive">Inativo</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsDialogOpen(false)}>
              Cancelar
            </Button>
            <Button
              onClick={handleSubmit}
              disabled={createMutation.isPending || updateMutation.isPending}
            >
              {editingId ? "Salvar" : "Cadastrar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <AlertDialog open={deleteId !== null} onOpenChange={() => setDeleteId(null)}>
        <AlertDialogContent className="bg-card border-border/30">
          <AlertDialogHeader>
            <AlertDialogTitle>Remover cliente?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta ação não pode ser desfeita. O cliente será removido
              permanentemente.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => deleteId && deleteMutation.mutate({ id: deleteId })}
            >
              Remover
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </PageContainer>
  );
}
