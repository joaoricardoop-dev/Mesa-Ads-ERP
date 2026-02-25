import { useState, Fragment } from "react";
import { useLocation } from "wouter";

import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import {
  LOCATION_RATING_LABELS,
  VENUE_TYPE_LABELS,
  DIGITAL_PRESENCE_LABELS,
  PRIMARY_DRINK_LABELS,
} from "@shared/rating-config";
import {
  Plus,
  Pencil,
  Trash2,
  Store,
  MapPin,
  Search,
  Instagram,
  MessageCircle,
  ChevronDown,
  ChevronUp,
  ArrowUpDown,
  Building2,
  Phone,
  ArrowRightCircle,
  UtensilsCrossed,
} from "lucide-react";

interface RestaurantForm {
  name: string;
  razaoSocial: string;
  cnpj: string;
  address: string;
  addressNumber: string;
  neighborhood: string;
  city: string;
  state: string;
  cep: string;
  contactName: string;
  contactPhone: string;
  whatsapp: string;
  instagram: string;
  coastersAllocated: number;
  commissionPercent: string;
  status: "active" | "inactive";
}

const emptyForm: RestaurantForm = {
  name: "",
  razaoSocial: "",
  cnpj: "",
  address: "",
  addressNumber: "",
  neighborhood: "",
  city: "",
  state: "",
  cep: "",
  contactName: "",
  contactPhone: "",
  whatsapp: "",
  instagram: "",
  coastersAllocated: 500,
  commissionPercent: "10.00",
  status: "active",
};

interface ConvertForm {
  name: string;
  address: string;
  neighborhood: string;
  googleMapsLink: string;
  instagram: string;
  contactType: string;
  contactName: string;
  contactRole: string;
  whatsapp: string;
  email: string;
  financialEmail: string;
  socialClass: string[];
  tableCount: number;
  seatCount: number;
  monthlyCustomers: number;
  monthlyDrinksSold: number;
  busyDays: string[];
  busyHours: string[];
  excludedCategories: string[];
  excludedOther: string;
  photoAuthorization: string;
  pixKey: string;
  notes: string;
  ticketMedio: number;
  locationRating: number;
  venueType: number;
  digitalPresence: number;
  primaryDrink: string;
}

const emptyConvertForm: ConvertForm = {
  name: "",
  address: "",
  neighborhood: "",
  googleMapsLink: "",
  instagram: "",
  contactType: "gerente",
  contactName: "",
  contactRole: "",
  whatsapp: "",
  email: "",
  financialEmail: "",
  socialClass: [],
  tableCount: 0,
  seatCount: 0,
  monthlyCustomers: 0,
  monthlyDrinksSold: 0,
  busyDays: [],
  busyHours: [],
  excludedCategories: [],
  excludedOther: "",
  photoAuthorization: "sim",
  pixKey: "",
  notes: "",
  ticketMedio: 0,
  locationRating: 0,
  venueType: 0,
  digitalPresence: 0,
  primaryDrink: "",
};

const BUSY_DAYS_OPTIONS = ["Seg", "Ter", "Qua", "Qui", "Sex", "Sáb", "Dom"];
const BUSY_HOURS_OPTIONS = ["06h–09h", "09h–12h", "12h–15h", "15h–18h", "18h–21h", "21h–00h", "00h–03h", "03h–06h"];

const EXCLUDED_CATEGORIES = [
  "Concorrentes diretos",
  "Bebidas alcoólicas",
  "Bebidas não alcoólicas",
  "Alimentação (marcas de comida, snacks, etc.)",
  "Cafeterias e docerias",
  "Sorveterias / açaí / sobremesas",
  "Apps de delivery e marketplaces",
  "Supermercados / atacarejos",
  "Varejo em geral",
  "Moda (roupas, calçados, acessórios)",
  "Beleza e cuidados pessoais",
  "Salão / barbearia / estética",
  "Óticas",
  "Joias / relógios / acessórios premium",
  "Produtos e serviços pet",
  "Academias e estúdios",
  "Saúde (clínicas, odontologia, etc.)",
  "Planos e seguros",
  "Bancos e fintechs",
  "Pagamentos (maquininha, carteiras digitais)",
  "Cripto/investimentos de alto risco",
  "Empréstimos agressivos",
  "Contabilidade e serviços B2B",
  "Telefonia / internet",
  "Eletrônicos e acessórios",
  "Softwares e ferramentas (SaaS, ERP)",
  "Transporte e mobilidade",
  "Automotivo",
  "Turismo e viagens",
  "Eventos e entretenimento",
  "Cultura e lazer",
  "Educação",
  "Casa e construção",
  "Imobiliário",
  "Serviços residenciais",
  "Logística e serviços locais",
  "Energia e utilidades",
  "Sustentabilidade",
  "Tecnologia/serviços profissionais",
  "Saúde e bem-estar lifestyle",
  "Esportes e hobbies",
  "Gastronomia e experiências",
  "Gaming/bets/Apostas",
  "Política",
  "Religião",
  "Conteúdo adulto/sexual",
];

type SortKey = "name" | "neighborhood" | "whatsapp" | "status";
type SortDir = "asc" | "desc";

export default function Restaurants() {
  const [, navigate] = useLocation();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [form, setForm] = useState<RestaurantForm>(emptyForm);
  const [deleteId, setDeleteId] = useState<number | null>(null);
  const [search, setSearch] = useState("");
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const [sortKey, setSortKey] = useState<SortKey>("name");
  const [sortDir, setSortDir] = useState<SortDir>("asc");
  const [isConvertOpen, setIsConvertOpen] = useState(false);
  const [convertingProspectId, setConvertingProspectId] = useState<number | null>(null);
  const [convertForm, setConvertForm] = useState<ConvertForm>(emptyConvertForm);

  const utils = trpc.useUtils();
  const { data: restaurants = [], isLoading } = trpc.restaurant.list.useQuery();

  const createMutation = trpc.restaurant.create.useMutation({
    onSuccess: () => {
      utils.restaurant.list.invalidate();
      setIsDialogOpen(false);
      setForm(emptyForm);
      toast.success("Restaurante cadastrado com sucesso!");
    },
    onError: (err) => toast.error(`Erro: ${err.message}`),
  });

  const updateMutation = trpc.restaurant.update.useMutation({
    onSuccess: () => {
      utils.restaurant.list.invalidate();
      setIsDialogOpen(false);
      setEditingId(null);
      setForm(emptyForm);
      toast.success("Restaurante atualizado!");
    },
    onError: (err) => toast.error(`Erro: ${err.message}`),
  });

  const deleteMutation = trpc.restaurant.delete.useMutation({
    onSuccess: () => {
      utils.restaurant.list.invalidate();
      setDeleteId(null);
      toast.success("Restaurante removido!");
    },
    onError: (err) => toast.error(`Erro: ${err.message}`),
  });

  const createActiveMutation = trpc.activeRestaurant.create.useMutation({
    onSuccess: () => {
      utils.activeRestaurant.list.invalidate();
      if (convertingProspectId) {
        updateMutation.mutate({ id: convertingProspectId, status: "inactive" });
      }
      setIsConvertOpen(false);
      setConvertingProspectId(null);
      toast.success("Restaurante convertido para ativo com sucesso!");
    },
    onError: (err: any) => toast.error(`Erro na conversão: ${err.message}`),
  });

  const handleSubmit = () => {
    if (!form.name.trim()) {
      toast.error("Nome é obrigatório");
      return;
    }
    if (editingId) {
      updateMutation.mutate({ id: editingId, ...form });
    } else {
      createMutation.mutate(form);
    }
  };

  const handleEdit = (r: (typeof restaurants)[0]) => {
    setEditingId(r.id);
    setForm({
      name: r.name,
      razaoSocial: r.razaoSocial || "",
      cnpj: r.cnpj || "",
      address: r.address || "",
      addressNumber: r.addressNumber || "",
      neighborhood: r.neighborhood || "",
      city: r.city || "",
      state: r.state || "",
      cep: r.cep || "",
      contactName: r.contactName || "",
      contactPhone: r.contactPhone || "",
      whatsapp: r.whatsapp || "",
      instagram: r.instagram || "",
      coastersAllocated: r.coastersAllocated,
      commissionPercent: String(r.commissionPercent),
      status: r.status,
    });
    setIsDialogOpen(true);
  };

  const handleNew = () => {
    setEditingId(null);
    setForm(emptyForm);
    setIsDialogOpen(true);
  };

  const handleConvert = (r: (typeof restaurants)[0]) => {
    setConvertingProspectId(r.id);
    const fullAddress = [r.address, r.addressNumber].filter(Boolean).join(", ");
    setConvertForm({
      ...emptyConvertForm,
      name: r.name,
      address: fullAddress,
      neighborhood: r.neighborhood || "",
      instagram: r.instagram || "",
      contactName: r.contactName || "",
      contactRole: "",
      whatsapp: r.whatsapp || "",
      email: "",
      financialEmail: "",
    });
    setIsConvertOpen(true);
  };

  const handleSubmitConvert = () => {
    if (!convertForm.name || !convertForm.address || !convertForm.neighborhood || !convertForm.contactName || !convertForm.contactRole || !convertForm.whatsapp) {
      toast.error("Preencha todos os campos obrigatórios");
      return;
    }
    if (!convertForm.monthlyDrinksSold || !convertForm.tableCount || !convertForm.ticketMedio || !convertForm.locationRating || !convertForm.venueType || !convertForm.digitalPresence) {
      toast.error("Preencha todos os campos de rating (Bebidas/mês, Mesas, Ticket Médio, Localização, Tipo, Presença Digital)");
      return;
    }
    createActiveMutation.mutate({
      name: convertForm.name,
      address: convertForm.address,
      neighborhood: convertForm.neighborhood,
      googleMapsLink: convertForm.googleMapsLink || undefined,
      instagram: convertForm.instagram || undefined,
      contactType: convertForm.contactType as any,
      contactName: convertForm.contactName,
      contactRole: convertForm.contactRole,
      whatsapp: convertForm.whatsapp,
      email: convertForm.email || undefined,
      financialEmail: convertForm.financialEmail || undefined,
      socialClass: JSON.stringify(convertForm.socialClass),
      tableCount: convertForm.tableCount,
      seatCount: convertForm.seatCount,
      monthlyCustomers: convertForm.monthlyCustomers,
      monthlyDrinksSold: convertForm.monthlyDrinksSold,
      busyDays: JSON.stringify(convertForm.busyDays),
      busyHours: JSON.stringify(convertForm.busyHours),
      excludedCategories: JSON.stringify(convertForm.excludedCategories),
      excludedOther: convertForm.excludedOther || undefined,
      photoAuthorization: convertForm.photoAuthorization,
      pixKey: convertForm.pixKey || undefined,
      notes: convertForm.notes || undefined,
      ticketMedio: String(convertForm.ticketMedio),
      locationRating: convertForm.locationRating,
      venueType: convertForm.venueType,
      digitalPresence: convertForm.digitalPresence,
      primaryDrink: convertForm.primaryDrink || undefined,
    });
  };

  const toggleBusyDay = (day: string) => {
    setConvertForm(prev => ({
      ...prev,
      busyDays: prev.busyDays.includes(day) ? prev.busyDays.filter(d => d !== day) : [...prev.busyDays, day],
    }));
  };

  const toggleBusyHour = (slot: string) => {
    setConvertForm(prev => ({
      ...prev,
      busyHours: prev.busyHours.includes(slot) ? prev.busyHours.filter(s => s !== slot) : [...prev.busyHours, slot],
    }));
  };

  const toggleCategory = (cat: string) => {
    setConvertForm(prev => ({
      ...prev,
      excludedCategories: prev.excludedCategories.includes(cat) ? prev.excludedCategories.filter(c => c !== cat) : [...prev.excludedCategories, cat],
    }));
  };

  const handleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortDir(sortDir === "asc" ? "desc" : "asc");
    } else {
      setSortKey(key);
      setSortDir("asc");
    }
  };

  const filtered = restaurants.filter(
    (r) =>
      r.name.toLowerCase().includes(search.toLowerCase()) ||
      (r.neighborhood || "").toLowerCase().includes(search.toLowerCase()) ||
      (r.city || "").toLowerCase().includes(search.toLowerCase())
  );

  const sorted = [...filtered].sort((a, b) => {
    const dir = sortDir === "asc" ? 1 : -1;
    switch (sortKey) {
      case "name":
        return a.name.localeCompare(b.name) * dir;
      case "neighborhood":
        return (a.neighborhood || "").localeCompare(b.neighborhood || "") * dir;
      case "whatsapp":
        return (a.whatsapp || "").localeCompare(b.whatsapp || "") * dir;
      case "status":
        return a.status.localeCompare(b.status) * dir;
      default:
        return 0;
    }
  });

  const activeCount = restaurants.filter((r) => r.status === "active").length;

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
    <div className="h-full flex flex-col overflow-hidden">
      <div className="flex-1 overflow-y-auto p-4 lg:p-6 space-y-6">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold tracking-tight flex items-center gap-2">
            <Store className="w-5 h-5 text-primary" />
            Prospecção de Restaurantes
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Leads e prospecção de novos restaurantes parceiros
          </p>
        </div>
        <Button onClick={() => navigate("/prospeccao/novo")} className="gap-2">
          <Plus className="w-4 h-4" />
          Novo Restaurante
        </Button>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="bg-card border border-border/30 rounded-lg p-4">
          <p className="text-xs text-muted-foreground">Total</p>
          <p className="text-2xl font-bold font-mono">{restaurants.length}</p>
        </div>
        <div className="bg-card border border-border/30 rounded-lg p-4">
          <p className="text-xs text-muted-foreground">Ativos</p>
          <p className="text-2xl font-bold font-mono text-primary">
            {activeCount}
          </p>
        </div>
      </div>

      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input
          placeholder="Buscar restaurante..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-9 bg-card border-border/30"
        />
      </div>

      <div className="bg-card border border-border/30 rounded-lg overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow className="border-border/30 hover:bg-transparent">
              <SortHeader label="RESTAURANTE" col="name" />
              <SortHeader label="LOCALIZAÇÃO" col="neighborhood" className="hidden md:table-cell" />
              <SortHeader label="WHATSAPP" col="whatsapp" className="hidden lg:table-cell" />
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
                    ? "Nenhum restaurante encontrado"
                    : "Nenhum restaurante cadastrado. Clique em \"Novo Restaurante\" para começar."}
                </TableCell>
              </TableRow>
            ) : (
              sorted.map((r) => (
                <Fragment key={r.id}>
                  <TableRow
                    className="border-border/20 hover:bg-card/80 cursor-pointer"
                    onClick={() => setExpandedId(expandedId === r.id ? null : r.id)}
                  >
                    <TableCell className="font-medium">
                      <div className="flex items-center gap-2">
                        <ChevronDown className={`w-4 h-4 text-muted-foreground transition-transform ${expandedId === r.id ? "rotate-180" : ""}`} />
                        {r.name}
                      </div>
                    </TableCell>
                    <TableCell className="hidden md:table-cell text-muted-foreground text-sm">
                      <div className="flex items-center gap-1">
                        <MapPin className="w-3 h-3" />
                        {r.neighborhood || r.city || "—"}
                      </div>
                    </TableCell>
                    <TableCell className="hidden lg:table-cell text-muted-foreground text-sm">
                      <div className="flex items-center gap-1">
                        <MessageCircle className="w-3 h-3 text-green-500" />
                        {r.whatsapp || "—"}
                      </div>
                    </TableCell>
                    <TableCell className="text-center">
                      <Badge
                        variant={r.status === "active" ? "default" : "secondary"}
                        className={
                          r.status === "active"
                            ? "bg-primary/20 text-primary border-primary/30"
                            : "bg-muted text-muted-foreground"
                        }
                      >
                        {r.status === "active" ? "Ativo" : "Inativo"}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-1" onClick={(e) => e.stopPropagation()}>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-emerald-400 hover:text-emerald-300"
                          title="Converter para Ativo"
                          onClick={() => handleConvert(r)}
                        >
                          <ArrowRightCircle className="w-3.5 h-3.5" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8"
                          onClick={() => navigate(`/prospeccao/${r.id}`)}
                        >
                          <Pencil className="w-3.5 h-3.5" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-destructive hover:text-destructive"
                          onClick={() => setDeleteId(r.id)}
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                  {expandedId === r.id && (
                    <TableRow className="border-border/10 bg-background/50 hover:bg-background/50">
                      <TableCell colSpan={5} className="p-0">
                        <div className="px-6 py-4 grid grid-cols-1 md:grid-cols-3 gap-6 text-sm">
                          <div className="space-y-3">
                            <p className="text-[10px] uppercase tracking-widest text-primary font-semibold">Identificação</p>
                            <div className="space-y-1.5">
                              <div className="flex items-center gap-2">
                                <Building2 className="w-3.5 h-3.5 text-muted-foreground" />
                                <span className="text-muted-foreground">Razão Social:</span>
                                <span>{r.razaoSocial || "—"}</span>
                              </div>
                              <div className="flex items-center gap-2">
                                <Building2 className="w-3.5 h-3.5 text-muted-foreground" />
                                <span className="text-muted-foreground">CNPJ:</span>
                                <span>{r.cnpj || "—"}</span>
                              </div>
                            </div>
                          </div>

                          <div className="space-y-3">
                            <p className="text-[10px] uppercase tracking-widest text-primary font-semibold">Endereço</p>
                            <div className="space-y-1.5">
                              <div className="flex items-center gap-2">
                                <MapPin className="w-3.5 h-3.5 text-muted-foreground" />
                                <span>
                                  {[r.address, r.addressNumber].filter(Boolean).join(", ") || "—"}
                                </span>
                              </div>
                              <div className="flex items-center gap-2">
                                <MapPin className="w-3.5 h-3.5 text-muted-foreground invisible" />
                                <span>
                                  {[r.neighborhood, r.city, r.state].filter(Boolean).join(" — ") || "—"}
                                </span>
                              </div>
                              {r.cep && (
                                <div className="flex items-center gap-2">
                                  <MapPin className="w-3.5 h-3.5 text-muted-foreground invisible" />
                                  <span className="text-muted-foreground">CEP:</span>
                                  <span>{r.cep}</span>
                                </div>
                              )}
                            </div>
                          </div>

                          <div className="space-y-3">
                            <p className="text-[10px] uppercase tracking-widest text-primary font-semibold">Contato</p>
                            <div className="space-y-1.5">
                              {r.contactName && (
                                <div className="flex items-center gap-2">
                                  <Phone className="w-3.5 h-3.5 text-muted-foreground" />
                                  <span>{r.contactName}</span>
                                  {r.contactPhone && <span className="text-muted-foreground">({r.contactPhone})</span>}
                                </div>
                              )}
                              <div className="flex items-center gap-2">
                                <MessageCircle className="w-3.5 h-3.5 text-green-500" />
                                <span>{r.whatsapp || "—"}</span>
                              </div>
                              {r.instagram && (
                                <div className="flex items-center gap-2">
                                  <Instagram className="w-3.5 h-3.5 text-pink-500" />
                                  <span>{r.instagram}</span>
                                </div>
                              )}
                            </div>
                          </div>
                        </div>

                        <div className="px-6 pb-4">
                          <Button size="sm" className="gap-2 bg-emerald-600 hover:bg-emerald-700 text-xs" onClick={() => handleConvert(r)}>
                            <ArrowRightCircle className="w-3.5 h-3.5" />
                            Converter para Restaurante Ativo
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

      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="sm:max-w-2xl bg-card border-border/30 max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {editingId ? "Editar Restaurante" : "Novo Restaurante"}
            </DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <p className="text-[10px] uppercase tracking-widest text-primary font-semibold">Identificação</p>
            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label>Nome Fantasia *</Label>
                <Input
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  placeholder="Nome do restaurante"
                  className="bg-background border-border/30"
                />
              </div>
              <div className="grid gap-2">
                <Label>Razão Social</Label>
                <Input
                  value={form.razaoSocial}
                  onChange={(e) => setForm({ ...form, razaoSocial: e.target.value })}
                  placeholder="Razão social"
                  className="bg-background border-border/30"
                />
              </div>
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
                  onChange={(e) =>
                    setForm({ ...form, neighborhood: e.target.value })
                  }
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
            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label>Contato</Label>
                <Input
                  value={form.contactName}
                  onChange={(e) =>
                    setForm({ ...form, contactName: e.target.value })
                  }
                  placeholder="Nome do contato"
                  className="bg-background border-border/30"
                />
              </div>
              <div className="grid gap-2">
                <Label>Telefone</Label>
                <Input
                  value={form.contactPhone}
                  onChange={(e) =>
                    setForm({ ...form, contactPhone: e.target.value })
                  }
                  placeholder="(92) 3333-3333"
                  className="bg-background border-border/30"
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label className="flex items-center gap-1.5">
                  <MessageCircle className="w-3.5 h-3.5 text-green-500" />
                  WhatsApp
                </Label>
                <Input
                  value={form.whatsapp}
                  onChange={(e) => setForm({ ...form, whatsapp: e.target.value })}
                  placeholder="(92) 99999-9999"
                  className="bg-background border-border/30"
                />
              </div>
              <div className="grid gap-2">
                <Label className="flex items-center gap-1.5">
                  <Instagram className="w-3.5 h-3.5 text-pink-500" />
                  Instagram
                </Label>
                <Input
                  value={form.instagram}
                  onChange={(e) =>
                    setForm({ ...form, instagram: e.target.value })
                  }
                  placeholder="@usuario"
                  className="bg-background border-border/30"
                />
              </div>
            </div>

            <p className="text-[10px] uppercase tracking-widest text-primary font-semibold mt-2">Comercial</p>
            <div className="grid grid-cols-1 gap-4">
              <div className="grid gap-2">
                <Label>Comissão do Restaurante (%)</Label>
                <Input
                  type="number"
                  value={form.commissionPercent}
                  onChange={(e) => setForm({ ...form, commissionPercent: e.target.value })}
                  min={8}
                  max={15}
                  step={0.5}
                  placeholder="10.00"
                  className="bg-background border-border/30 font-mono"
                />
                <p className="text-[10px] text-muted-foreground">Faixa: 8% a 15%</p>
              </div>
            </div>

            <p className="text-[10px] uppercase tracking-widest text-primary font-semibold mt-2">Status</p>
            <div className="grid grid-cols-1 gap-4">
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

      <Dialog open={isConvertOpen} onOpenChange={setIsConvertOpen}>
        <DialogContent className="sm:max-w-3xl bg-card border-border/30 max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <ArrowRightCircle className="w-5 h-5 text-emerald-400" />
              Converter para Restaurante Ativo
            </DialogTitle>
          </DialogHeader>

          <p className="text-xs text-muted-foreground">
            Preencha os dados adicionais para ativar este restaurante como parceiro Mesa Ads.
          </p>

          <Tabs defaultValue="local" className="space-y-4">
            <TabsList className="grid grid-cols-5 w-full">
              <TabsTrigger value="local" className="text-xs">Local</TabsTrigger>
              <TabsTrigger value="contato" className="text-xs">Contato</TabsTrigger>
              <TabsTrigger value="operacao" className="text-xs">Operação</TabsTrigger>
              <TabsTrigger value="restricoes" className="text-xs">Restrições</TabsTrigger>
              <TabsTrigger value="financeiro" className="text-xs">Financeiro</TabsTrigger>
            </TabsList>

            <TabsContent value="local" className="space-y-4">
              <div className="space-y-2">
                <Label className="text-xs">Nome do Estabelecimento *</Label>
                <Input value={convertForm.name} onChange={(e) => setConvertForm(p => ({ ...p, name: e.target.value }))} className="bg-background border-border/30" />
              </div>
              <div className="space-y-2">
                <Label className="text-xs">Endereço Completo *</Label>
                <Input value={convertForm.address} onChange={(e) => setConvertForm(p => ({ ...p, address: e.target.value }))} className="bg-background border-border/30" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label className="text-xs">Bairro/Zona *</Label>
                  <Input value={convertForm.neighborhood} onChange={(e) => setConvertForm(p => ({ ...p, neighborhood: e.target.value }))} className="bg-background border-border/30" />
                </div>
                <div className="space-y-2">
                  <Label className="text-xs">Instagram</Label>
                  <Input value={convertForm.instagram} onChange={(e) => setConvertForm(p => ({ ...p, instagram: e.target.value }))} placeholder="@usuario" className="bg-background border-border/30" />
                </div>
              </div>
              <div className="space-y-2">
                <Label className="text-xs">Link do Google Maps</Label>
                <Input value={convertForm.googleMapsLink} onChange={(e) => setConvertForm(p => ({ ...p, googleMapsLink: e.target.value }))} placeholder="https://maps.google.com/..." className="bg-background border-border/30" />
              </div>
            </TabsContent>

            <TabsContent value="contato" className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label className="text-xs">Nome do Responsável *</Label>
                  <Input value={convertForm.contactName} onChange={(e) => setConvertForm(p => ({ ...p, contactName: e.target.value }))} className="bg-background border-border/30" />
                </div>
                <div className="space-y-2">
                  <Label className="text-xs">Cargo *</Label>
                  <Input value={convertForm.contactRole} onChange={(e) => setConvertForm(p => ({ ...p, contactRole: e.target.value }))} className="bg-background border-border/30" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label className="text-xs">Tipo de Contato</Label>
                  <Select value={convertForm.contactType} onValueChange={(v) => setConvertForm(p => ({ ...p, contactType: v }))}>
                    <SelectTrigger className="bg-background border-border/30"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="proprietario">Proprietário</SelectItem>
                      <SelectItem value="gerente">Gerente</SelectItem>
                      <SelectItem value="marketing">Marketing</SelectItem>
                      <SelectItem value="outro">Outro</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label className="text-xs">WhatsApp *</Label>
                  <Input value={convertForm.whatsapp} onChange={(e) => setConvertForm(p => ({ ...p, whatsapp: e.target.value }))} className="bg-background border-border/30" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label className="text-xs">Email</Label>
                  <Input type="email" value={convertForm.email} onChange={(e) => setConvertForm(p => ({ ...p, email: e.target.value }))} className="bg-background border-border/30" />
                </div>
                <div className="space-y-2">
                  <Label className="text-xs">Email Financeiro</Label>
                  <Input type="email" value={convertForm.financialEmail} onChange={(e) => setConvertForm(p => ({ ...p, financialEmail: e.target.value }))} className="bg-background border-border/30" />
                </div>
              </div>
            </TabsContent>

            <TabsContent value="operacao" className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label className="text-xs">Classe Social Predominante *</Label>
                  <div className="flex flex-wrap gap-2">
                    {["AA", "A", "B", "C", "D", "E"].map((cls) => (
                      <Button
                        key={cls}
                        type="button"
                        size="sm"
                        variant={convertForm.socialClass.includes(cls) ? "default" : "outline"}
                        className="text-xs h-7 px-3"
                        onClick={() => setConvertForm(p => ({
                          ...p,
                          socialClass: p.socialClass.includes(cls)
                            ? p.socialClass.filter(c => c !== cls)
                            : [...p.socialClass, cls],
                        }))}
                      >
                        Classe {cls}
                      </Button>
                    ))}
                  </div>
                </div>
              </div>
              <div className="grid grid-cols-3 gap-3">
                <div className="space-y-2">
                  <Label className="text-xs">Quantidade de Mesas *</Label>
                  <Input type="number" value={convertForm.tableCount} onChange={(e) => setConvertForm(p => ({ ...p, tableCount: parseInt(e.target.value) || 0 }))} className="bg-background border-border/30" />
                </div>
                <div className="space-y-2">
                  <Label className="text-xs">Quantidade de Assentos *</Label>
                  <Input type="number" value={convertForm.seatCount} onChange={(e) => setConvertForm(p => ({ ...p, seatCount: parseInt(e.target.value) || 0 }))} className="bg-background border-border/30" />
                </div>
                <div className="space-y-2">
                  <Label className="text-xs">Clientes por Mês *</Label>
                  <Input type="number" value={convertForm.monthlyCustomers} onChange={(e) => setConvertForm(p => ({ ...p, monthlyCustomers: parseInt(e.target.value) || 0 }))} className="bg-background border-border/30" />
                </div>
              </div>
              <div className="space-y-2">
                <Label className="text-xs">Dias de Maior Movimento</Label>
                <div className="flex flex-wrap gap-2">
                  {BUSY_DAYS_OPTIONS.map((day) => (
                    <Button key={day} type="button" size="sm" variant={convertForm.busyDays.includes(day) ? "default" : "outline"} className="text-xs h-7 px-3" onClick={() => toggleBusyDay(day)}>
                      {day}
                    </Button>
                  ))}
                </div>
              </div>
              <div className="space-y-2">
                <Label className="text-xs">Horários de Maior Movimento</Label>
                <div className="flex flex-wrap gap-2">
                  {BUSY_HOURS_OPTIONS.map((slot) => (
                    <Button key={slot} type="button" size="sm" variant={convertForm.busyHours.includes(slot) ? "default" : "outline"} className="text-xs h-7 px-3" onClick={() => toggleBusyHour(slot)}>
                      {slot}
                    </Button>
                  ))}
                </div>
              </div>

              <div className="border-t border-border/20 pt-3 space-y-3">
                <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">Rating Interno *</p>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-2">
                    <Label className="text-xs">Bebidas Vendidas/Mês *</Label>
                    <Input type="number" value={convertForm.monthlyDrinksSold || ""} onChange={(e) => setConvertForm(p => ({ ...p, monthlyDrinksSold: parseInt(e.target.value) || 0 }))} placeholder="Ex: 5000" className="bg-background border-border/30" />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-xs">Ticket Médio (R$) *</Label>
                    <Input type="number" min={5} step={0.01} value={convertForm.ticketMedio || ""} onChange={(e) => setConvertForm(p => ({ ...p, ticketMedio: parseFloat(e.target.value) || 0 }))} placeholder="0,00" className="bg-background border-border/30" />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label className="text-xs">Localização *</Label>
                  <Select value={convertForm.locationRating ? String(convertForm.locationRating) : ""} onValueChange={(v) => setConvertForm(p => ({ ...p, locationRating: parseInt(v) }))}>
                    <SelectTrigger className="bg-background border-border/30"><SelectValue placeholder="Selecione..." /></SelectTrigger>
                    <SelectContent>
                      {Object.entries(LOCATION_RATING_LABELS).map(([val, label]) => (
                        <SelectItem key={val} value={val}>{val} — {label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label className="text-xs">Tipo de Estabelecimento *</Label>
                  <Select value={convertForm.venueType ? String(convertForm.venueType) : ""} onValueChange={(v) => setConvertForm(p => ({ ...p, venueType: parseInt(v) }))}>
                    <SelectTrigger className="bg-background border-border/30"><SelectValue placeholder="Selecione..." /></SelectTrigger>
                    <SelectContent>
                      {Object.entries(VENUE_TYPE_LABELS).map(([val, label]) => (
                        <SelectItem key={val} value={val}>{val} — {label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label className="text-xs">Presença Digital *</Label>
                  <Select value={convertForm.digitalPresence ? String(convertForm.digitalPresence) : ""} onValueChange={(v) => setConvertForm(p => ({ ...p, digitalPresence: parseInt(v) }))}>
                    <SelectTrigger className="bg-background border-border/30"><SelectValue placeholder="Selecione..." /></SelectTrigger>
                    <SelectContent>
                      {Object.entries(DIGITAL_PRESENCE_LABELS).map(([val, label]) => (
                        <SelectItem key={val} value={val}>{val} — {label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label className="text-xs">Bebida Predominante</Label>
                  <Select value={convertForm.primaryDrink} onValueChange={(v) => setConvertForm(p => ({ ...p, primaryDrink: v }))}>
                    <SelectTrigger className="bg-background border-border/30"><SelectValue placeholder="Selecione..." /></SelectTrigger>
                    <SelectContent>
                      {Object.entries(PRIMARY_DRINK_LABELS).map(([val, label]) => (
                        <SelectItem key={val} value={val}>{label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </TabsContent>

            <TabsContent value="restricoes" className="space-y-4">
              <div className="space-y-2">
                <Label className="text-xs">Categorias que NÃO deseja anunciar *</Label>
                <p className="text-[10px] text-muted-foreground">Selecione todas as categorias que o restaurante não aceita</p>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-1 max-h-64 overflow-y-auto border border-border/20 rounded-lg p-3">
                  {EXCLUDED_CATEGORIES.map((cat) => (
                    <label key={cat} className="flex items-center gap-2 py-1 cursor-pointer hover:bg-muted/5 px-1 rounded text-xs">
                      <Checkbox checked={convertForm.excludedCategories.includes(cat)} onCheckedChange={() => toggleCategory(cat)} />
                      <span className="text-xs">{cat}</span>
                    </label>
                  ))}
                </div>
              </div>
              <div className="space-y-2">
                <Label className="text-xs">Outros (descreva)</Label>
                <Textarea value={convertForm.excludedOther} onChange={(e) => setConvertForm(p => ({ ...p, excludedOther: e.target.value }))} placeholder="Categorias adicionais..." className="bg-background border-border/30 min-h-[60px]" />
              </div>
              <div className="space-y-2">
                <Label className="text-xs">Autoriza uso de fotos de veiculação? *</Label>
                <Select value={convertForm.photoAuthorization} onValueChange={(v) => setConvertForm(p => ({ ...p, photoAuthorization: v }))}>
                  <SelectTrigger className="bg-background border-border/30"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="sim">Sim</SelectItem>
                    <SelectItem value="nao">Não</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </TabsContent>

            <TabsContent value="financeiro" className="space-y-4">
              <div className="space-y-2">
                <Label className="text-xs">Chave Pix</Label>
                <Input value={convertForm.pixKey} onChange={(e) => setConvertForm(p => ({ ...p, pixKey: e.target.value }))} placeholder="CPF, CNPJ, email ou telefone" className="bg-background border-border/30" />
              </div>
              <div className="space-y-2">
                <Label className="text-xs">Observações</Label>
                <Textarea value={convertForm.notes} onChange={(e) => setConvertForm(p => ({ ...p, notes: e.target.value }))} placeholder="Anotações internas..." className="bg-background border-border/30 min-h-[60px]" />
              </div>
            </TabsContent>
          </Tabs>

          <DialogFooter className="mt-4">
            <Button variant="outline" onClick={() => setIsConvertOpen(false)}>Cancelar</Button>
            <Button
              onClick={handleSubmitConvert}
              disabled={createActiveMutation.isPending || !convertForm.name || !convertForm.address || !convertForm.neighborhood || !convertForm.contactName || !convertForm.contactRole || !convertForm.whatsapp || !convertForm.monthlyDrinksSold || !convertForm.tableCount || !convertForm.ticketMedio || !convertForm.locationRating || !convertForm.venueType || !convertForm.digitalPresence}
              className="gap-2 bg-emerald-600 hover:bg-emerald-700"
            >
              <UtensilsCrossed className="w-4 h-4" />
              Converter para Ativo
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={deleteId !== null} onOpenChange={() => setDeleteId(null)}>
        <AlertDialogContent className="bg-card border-border/30">
          <AlertDialogHeader>
            <AlertDialogTitle>Remover restaurante?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta ação não pode ser desfeita. O restaurante será removido de
              todas as campanhas associadas.
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
      </div>
    </div>
  );
}
