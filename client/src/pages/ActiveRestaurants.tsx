import { useState, Fragment } from "react";
import { useLocation } from "wouter";
import AppNav from "@/components/AppNav";
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
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import {
  UtensilsCrossed,
  Plus,
  Search,
  Pencil,
  Trash2,
  MapPin,
  Phone,
  Instagram,
  ChevronDown,
  ChevronUp,
  Users,
  BarChart3,
  ShieldAlert,
  CreditCard,
  Mail,
  ExternalLink,
} from "lucide-react";

const CONTACT_TYPE_LABELS: Record<string, string> = {
  proprietario: "Proprietário",
  gerente: "Gerente",
  marketing: "Marketing",
  outro: "Outro",
};

const SOCIAL_CLASS_LABELS: Record<string, string> = {
  A: "Classe A",
  B: "Classe B",
  C: "Classe C",
  misto_ab: "Misto (A/B)",
  misto_bc: "Misto (B/C)",
  nao_sei: "Não sei",
};

const BUSY_DAYS_OPTIONS = ["Seg", "Ter", "Qua", "Qui", "Sex", "Sáb", "Dom"];

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

interface FormData {
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
  socialClass: string;
  tableCount: number;
  seatCount: number;
  monthlyCustomers: number;
  busyDays: string[];
  busyHours: string;
  excludedCategories: string[];
  excludedOther: string;
  photoAuthorization: string;
  pixKey: string;
  notes: string;
  status: string;
}

const emptyForm: FormData = {
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
  socialClass: "misto_ab",
  tableCount: 0,
  seatCount: 0,
  monthlyCustomers: 0,
  busyDays: [],
  busyHours: "",
  excludedCategories: [],
  excludedOther: "",
  photoAuthorization: "sim",
  pixKey: "",
  notes: "",
  status: "active",
};

export default function ActiveRestaurantsPage() {
  const [, navigate] = useLocation();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [deleteId, setDeleteId] = useState<number | null>(null);
  const [form, setForm] = useState<FormData>(emptyForm);
  const [search, setSearch] = useState("");
  const [expandedId, setExpandedId] = useState<number | null>(null);

  const utils = trpc.useUtils();
  const { data: restaurants = [] } = trpc.activeRestaurant.list.useQuery();

  const createMutation = trpc.activeRestaurant.create.useMutation({
    onSuccess: () => {
      utils.activeRestaurant.list.invalidate();
      setIsDialogOpen(false);
      toast.success("Restaurante cadastrado!");
    },
    onError: (err: any) => toast.error(err.message),
  });

  const updateMutation = trpc.activeRestaurant.update.useMutation({
    onSuccess: () => {
      utils.activeRestaurant.list.invalidate();
      setIsDialogOpen(false);
      toast.success("Restaurante atualizado!");
    },
    onError: (err: any) => toast.error(err.message),
  });

  const deleteMutation = trpc.activeRestaurant.delete.useMutation({
    onSuccess: () => {
      utils.activeRestaurant.list.invalidate();
      setDeleteId(null);
      toast.success("Restaurante removido!");
    },
    onError: (err: any) => toast.error(err.message),
  });

  const handleNew = () => {
    setEditingId(null);
    setForm(emptyForm);
    setIsDialogOpen(true);
  };

  const handleEdit = (r: any) => {
    setEditingId(r.id);
    setForm({
      name: r.name,
      address: r.address,
      neighborhood: r.neighborhood,
      googleMapsLink: r.googleMapsLink || "",
      instagram: r.instagram || "",
      contactType: r.contactType || "gerente",
      contactName: r.contactName,
      contactRole: r.contactRole,
      whatsapp: r.whatsapp,
      email: r.email || "",
      financialEmail: r.financialEmail || "",
      socialClass: r.socialClass || "misto_ab",
      tableCount: r.tableCount,
      seatCount: r.seatCount,
      monthlyCustomers: r.monthlyCustomers,
      busyDays: r.busyDays ? r.busyDays.split(",") : [],
      busyHours: r.busyHours || "",
      excludedCategories: r.excludedCategories ? r.excludedCategories.split("||") : [],
      excludedOther: r.excludedOther || "",
      photoAuthorization: r.photoAuthorization || "sim",
      pixKey: r.pixKey || "",
      notes: r.notes || "",
      status: r.status,
    });
    setIsDialogOpen(true);
  };

  const handleSubmit = () => {
    const payload = {
      name: form.name,
      address: form.address,
      neighborhood: form.neighborhood,
      googleMapsLink: form.googleMapsLink || undefined,
      instagram: form.instagram || undefined,
      contactType: form.contactType as any,
      contactName: form.contactName,
      contactRole: form.contactRole,
      whatsapp: form.whatsapp,
      email: form.email || undefined,
      financialEmail: form.financialEmail || undefined,
      socialClass: form.socialClass as any,
      tableCount: form.tableCount,
      seatCount: form.seatCount,
      monthlyCustomers: form.monthlyCustomers,
      busyDays: form.busyDays.length > 0 ? form.busyDays.join(",") : undefined,
      busyHours: form.busyHours || undefined,
      excludedCategories: form.excludedCategories.length > 0 ? form.excludedCategories.join("||") : undefined,
      excludedOther: form.excludedOther || undefined,
      photoAuthorization: form.photoAuthorization,
      pixKey: form.pixKey || undefined,
      notes: form.notes || undefined,
    };

    if (editingId) {
      updateMutation.mutate({ id: editingId, ...payload, status: form.status as any });
    } else {
      createMutation.mutate(payload);
    }
  };

  const filtered = restaurants.filter((r) => {
    if (!search) return true;
    const s = search.toLowerCase();
    return r.name.toLowerCase().includes(s) || r.neighborhood.toLowerCase().includes(s) || (r.whatsapp && r.whatsapp.includes(s));
  });

  const activeCount = restaurants.filter((r) => r.status === "active").length;
  const totalTables = restaurants.reduce((s, r) => s + (r.tableCount || 0), 0);
  const totalSeats = restaurants.reduce((s, r) => s + (r.seatCount || 0), 0);

  const toggleBusyDay = (day: string) => {
    setForm(prev => ({
      ...prev,
      busyDays: prev.busyDays.includes(day) ? prev.busyDays.filter(d => d !== day) : [...prev.busyDays, day],
    }));
  };

  const toggleCategory = (cat: string) => {
    setForm(prev => ({
      ...prev,
      excludedCategories: prev.excludedCategories.includes(cat) ? prev.excludedCategories.filter(c => c !== cat) : [...prev.excludedCategories, cat],
    }));
  };

  return (
    <div className="h-screen flex flex-col overflow-hidden">
      <AppNav />
      <div className="flex-1 overflow-y-auto p-4 lg:p-6 space-y-4">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-xl font-bold tracking-tight flex items-center gap-2">
              <UtensilsCrossed className="w-5 h-5 text-primary" />
              Restaurantes Ativos
            </h1>
            <p className="text-sm text-muted-foreground mt-1">
              Restaurantes parceiros ativos da Mesa Ads
            </p>
          </div>
          <Button onClick={() => navigate("/restaurantes/novo")} className="gap-2">
            <Plus className="w-4 h-4" /> Novo Restaurante
          </Button>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <StatCard label="Total" value={restaurants.length} />
          <StatCard label="Ativos" value={activeCount} accent />
          <StatCard label="Total Mesas" value={totalTables} />
          <StatCard label="Total Assentos" value={totalSeats} />
        </div>

        <div className="relative max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input placeholder="Buscar restaurante..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-10 bg-card border-border/30" />
        </div>

        <div className="space-y-2">
          {filtered.length === 0 ? (
            <div className="bg-card border border-border/30 rounded-lg p-8 text-center text-muted-foreground">
              Nenhum restaurante encontrado
            </div>
          ) : (
            filtered.map((r) => {
              const isExpanded = expandedId === r.id;
              return (
                <div key={r.id} className="bg-card border border-border/30 rounded-lg overflow-hidden">
                  <div className="flex items-center gap-3 p-3 cursor-pointer hover:bg-muted/5" onClick={() => setExpandedId(isExpanded ? null : r.id)}>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="font-medium text-sm truncate">{r.name}</p>
                        <Badge variant="outline" className={r.status === "active" ? "bg-emerald-500/20 text-emerald-400 border-emerald-500/30 text-[10px]" : "bg-gray-500/20 text-gray-400 border-gray-500/30 text-[10px]"}>
                          {r.status === "active" ? "Ativo" : "Inativo"}
                        </Badge>
                      </div>
                      <p className="text-xs text-muted-foreground mt-0.5">{r.neighborhood} · {SOCIAL_CLASS_LABELS[r.socialClass] || r.socialClass}</p>
                    </div>
                    <div className="hidden md:flex items-center gap-4 text-xs text-muted-foreground">
                      <span>{r.tableCount} mesas</span>
                      <span>{r.seatCount} assentos</span>
                      <span>{r.monthlyCustomers?.toLocaleString("pt-BR")} clientes/mês</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <Button variant="ghost" size="icon" className="h-7 w-7" onClick={(e) => { e.stopPropagation(); navigate(`/restaurantes/${r.id}`); }}>
                        <Pencil className="w-3.5 h-3.5" />
                      </Button>
                      <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={(e) => { e.stopPropagation(); setDeleteId(r.id); }}>
                        <Trash2 className="w-3.5 h-3.5" />
                      </Button>
                      {isExpanded ? <ChevronUp className="w-4 h-4 text-muted-foreground" /> : <ChevronDown className="w-4 h-4 text-muted-foreground" />}
                    </div>
                  </div>

                  {isExpanded && (
                    <div className="border-t border-border/20 p-4 space-y-4 bg-muted/5">
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <div className="space-y-2">
                          <h4 className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold flex items-center gap-1"><MapPin className="w-3 h-3" /> Local</h4>
                          <DetailRow label="Endereço" value={r.address} />
                          <DetailRow label="Bairro" value={r.neighborhood} />
                          {r.googleMapsLink && (
                            <a href={r.googleMapsLink} target="_blank" rel="noopener noreferrer" className="text-xs text-primary flex items-center gap-1 hover:underline">
                              <ExternalLink className="w-3 h-3" /> Google Maps
                            </a>
                          )}
                          {r.instagram && <DetailRow label="Instagram" value={r.instagram} />}
                        </div>
                        <div className="space-y-2">
                          <h4 className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold flex items-center gap-1"><Phone className="w-3 h-3" /> Contato</h4>
                          <DetailRow label="Responsável" value={`${r.contactName} (${CONTACT_TYPE_LABELS[r.contactType] || r.contactType})`} />
                          <DetailRow label="Cargo" value={r.contactRole} />
                          <DetailRow label="WhatsApp" value={r.whatsapp} />
                          {r.email && <DetailRow label="Email" value={r.email} />}
                          {r.financialEmail && <DetailRow label="Email Financeiro" value={r.financialEmail} />}
                        </div>
                        <div className="space-y-2">
                          <h4 className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold flex items-center gap-1"><BarChart3 className="w-3 h-3" /> Operação</h4>
                          <DetailRow label="Classe Social" value={SOCIAL_CLASS_LABELS[r.socialClass] || r.socialClass} />
                          <DetailRow label="Mesas / Assentos" value={`${r.tableCount} / ${r.seatCount}`} />
                          <DetailRow label="Clientes/Mês" value={r.monthlyCustomers?.toLocaleString("pt-BR")} />
                          <DetailRow label="Dias de Pico" value={r.busyDays?.replace(/,/g, ", ")} />
                          <DetailRow label="Horários de Pico" value={r.busyHours} />
                        </div>
                      </div>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <h4 className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold flex items-center gap-1"><CreditCard className="w-3 h-3" /> Financeiro</h4>
                          <DetailRow label="Chave Pix" value={r.pixKey} />
                          <DetailRow label="Fotos autorizadas" value={r.photoAuthorization === "sim" ? "Sim" : "Não"} />
                        </div>
                        {r.excludedCategories && (
                          <div className="space-y-2">
                            <h4 className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold flex items-center gap-1"><ShieldAlert className="w-3 h-3" /> Categorias Excluídas</h4>
                            <div className="flex flex-wrap gap-1">
                              {r.excludedCategories.split("||").map((cat, i) => (
                                <Badge key={i} variant="outline" className="text-[10px] bg-red-500/10 text-red-400 border-red-500/20">{cat}</Badge>
                              ))}
                            </div>
                            {r.excludedOther && <p className="text-xs text-muted-foreground mt-1">Outros: {r.excludedOther}</p>}
                          </div>
                        )}
                      </div>
                      {r.notes && (
                        <div className="space-y-1">
                          <h4 className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">Observações</h4>
                          <p className="text-xs text-muted-foreground">{r.notes}</p>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>

        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogContent className="sm:max-w-3xl bg-card border-border/30 max-h-[85vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <UtensilsCrossed className="w-5 h-5 text-primary" />
                {editingId ? "Editar Restaurante" : "Novo Restaurante Ativo"}
              </DialogTitle>
            </DialogHeader>

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
                  <Input value={form.name} onChange={(e) => setForm(p => ({ ...p, name: e.target.value }))} placeholder="Nome do restaurante" className="bg-background border-border/30" />
                </div>
                <div className="space-y-2">
                  <Label className="text-xs">Endereço Completo *</Label>
                  <Input value={form.address} onChange={(e) => setForm(p => ({ ...p, address: e.target.value }))} placeholder="Rua, número, complemento" className="bg-background border-border/30" />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-2">
                    <Label className="text-xs">Bairro/Zona *</Label>
                    <Input value={form.neighborhood} onChange={(e) => setForm(p => ({ ...p, neighborhood: e.target.value }))} className="bg-background border-border/30" />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-xs">Instagram</Label>
                    <Input value={form.instagram} onChange={(e) => setForm(p => ({ ...p, instagram: e.target.value }))} placeholder="@usuario" className="bg-background border-border/30" />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label className="text-xs">Link do Google Maps</Label>
                  <Input value={form.googleMapsLink} onChange={(e) => setForm(p => ({ ...p, googleMapsLink: e.target.value }))} placeholder="https://maps.google.com/..." className="bg-background border-border/30" />
                </div>
              </TabsContent>

              <TabsContent value="contato" className="space-y-4">
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-2">
                    <Label className="text-xs">Nome do Responsável *</Label>
                    <Input value={form.contactName} onChange={(e) => setForm(p => ({ ...p, contactName: e.target.value }))} className="bg-background border-border/30" />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-xs">Cargo *</Label>
                    <Input value={form.contactRole} onChange={(e) => setForm(p => ({ ...p, contactRole: e.target.value }))} className="bg-background border-border/30" />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-2">
                    <Label className="text-xs">Tipo de Contato</Label>
                    <Select value={form.contactType} onValueChange={(v) => setForm(p => ({ ...p, contactType: v }))}>
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
                    <Input value={form.whatsapp} onChange={(e) => setForm(p => ({ ...p, whatsapp: e.target.value }))} placeholder="(11) 99999-9999" className="bg-background border-border/30" />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-2">
                    <Label className="text-xs">Email</Label>
                    <Input type="email" value={form.email} onChange={(e) => setForm(p => ({ ...p, email: e.target.value }))} className="bg-background border-border/30" />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-xs">Email Financeiro</Label>
                    <Input type="email" value={form.financialEmail} onChange={(e) => setForm(p => ({ ...p, financialEmail: e.target.value }))} className="bg-background border-border/30" />
                  </div>
                </div>
              </TabsContent>

              <TabsContent value="operacao" className="space-y-4">
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-2">
                    <Label className="text-xs">Classe Social Predominante *</Label>
                    <Select value={form.socialClass} onValueChange={(v) => setForm(p => ({ ...p, socialClass: v }))}>
                      <SelectTrigger className="bg-background border-border/30"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="A">Classe A</SelectItem>
                        <SelectItem value="B">Classe B</SelectItem>
                        <SelectItem value="C">Classe C</SelectItem>
                        <SelectItem value="misto_ab">Misto (A/B)</SelectItem>
                        <SelectItem value="misto_bc">Misto (B/C)</SelectItem>
                        <SelectItem value="nao_sei">Não sei</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="grid grid-cols-3 gap-3">
                  <div className="space-y-2">
                    <Label className="text-xs">Quantidade de Mesas *</Label>
                    <Input type="number" value={form.tableCount} onChange={(e) => setForm(p => ({ ...p, tableCount: parseInt(e.target.value) || 0 }))} className="bg-background border-border/30" />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-xs">Quantidade de Assentos *</Label>
                    <Input type="number" value={form.seatCount} onChange={(e) => setForm(p => ({ ...p, seatCount: parseInt(e.target.value) || 0 }))} className="bg-background border-border/30" />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-xs">Clientes por Mês *</Label>
                    <Input type="number" value={form.monthlyCustomers} onChange={(e) => setForm(p => ({ ...p, monthlyCustomers: parseInt(e.target.value) || 0 }))} className="bg-background border-border/30" />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label className="text-xs">Dias de Maior Movimento</Label>
                  <div className="flex flex-wrap gap-2">
                    {BUSY_DAYS_OPTIONS.map((day) => (
                      <Button key={day} type="button" size="sm" variant={form.busyDays.includes(day) ? "default" : "outline"} className="text-xs h-7 px-3" onClick={() => toggleBusyDay(day)}>
                        {day}
                      </Button>
                    ))}
                  </div>
                </div>
                <div className="space-y-2">
                  <Label className="text-xs">Horários de Maior Movimento</Label>
                  <Input value={form.busyHours} onChange={(e) => setForm(p => ({ ...p, busyHours: e.target.value }))} placeholder="Ex: 18h–22h" className="bg-background border-border/30" />
                </div>
              </TabsContent>

              <TabsContent value="restricoes" className="space-y-4">
                <div className="space-y-2">
                  <Label className="text-xs">Categorias que NÃO deseja anunciar *</Label>
                  <p className="text-[10px] text-muted-foreground">Selecione todas as categorias que o restaurante não aceita</p>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-1 max-h-64 overflow-y-auto border border-border/20 rounded-lg p-3">
                    {EXCLUDED_CATEGORIES.map((cat) => (
                      <label key={cat} className="flex items-center gap-2 py-1 cursor-pointer hover:bg-muted/5 px-1 rounded text-xs">
                        <Checkbox checked={form.excludedCategories.includes(cat)} onCheckedChange={() => toggleCategory(cat)} />
                        <span className="text-xs">{cat}</span>
                      </label>
                    ))}
                  </div>
                </div>
                <div className="space-y-2">
                  <Label className="text-xs">Outros (descreva)</Label>
                  <Textarea value={form.excludedOther} onChange={(e) => setForm(p => ({ ...p, excludedOther: e.target.value }))} placeholder="Categorias adicionais que não deseja anunciar..." className="bg-background border-border/30 min-h-[60px]" />
                </div>
                <div className="space-y-2">
                  <Label className="text-xs">Autoriza uso de fotos de veiculação? *</Label>
                  <Select value={form.photoAuthorization} onValueChange={(v) => setForm(p => ({ ...p, photoAuthorization: v }))}>
                    <SelectTrigger className="bg-background border-border/30"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="sim">Sim</SelectItem>
                      <SelectItem value="nao">Não</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </TabsContent>

              <TabsContent value="financeiro" className="space-y-4">
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-2">
                    <Label className="text-xs">Chave Pix</Label>
                    <Input value={form.pixKey} onChange={(e) => setForm(p => ({ ...p, pixKey: e.target.value }))} placeholder="CPF, CNPJ, email ou telefone" className="bg-background border-border/30" />
                  </div>
                  {editingId && (
                    <div className="space-y-2">
                      <Label className="text-xs">Status</Label>
                      <Select value={form.status} onValueChange={(v) => setForm(p => ({ ...p, status: v }))}>
                        <SelectTrigger className="bg-background border-border/30"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="active">Ativo</SelectItem>
                          <SelectItem value="inactive">Inativo</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  )}
                </div>
                <div className="space-y-2">
                  <Label className="text-xs">Observações</Label>
                  <Textarea value={form.notes} onChange={(e) => setForm(p => ({ ...p, notes: e.target.value }))} placeholder="Anotações internas..." className="bg-background border-border/30 min-h-[60px]" />
                </div>
              </TabsContent>
            </Tabs>

            <DialogFooter className="mt-4">
              <Button variant="outline" onClick={() => setIsDialogOpen(false)}>Cancelar</Button>
              <Button onClick={handleSubmit} disabled={createMutation.isPending || updateMutation.isPending || !form.name || !form.address || !form.neighborhood || !form.contactName || !form.contactRole || !form.whatsapp}>
                {editingId ? "Salvar" : "Cadastrar"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        <AlertDialog open={deleteId !== null} onOpenChange={() => setDeleteId(null)}>
          <AlertDialogContent className="bg-card border-border/30">
            <AlertDialogHeader>
              <AlertDialogTitle>Remover restaurante?</AlertDialogTitle>
              <AlertDialogDescription>Esta ação não pode ser desfeita.</AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancelar</AlertDialogCancel>
              <AlertDialogAction className="bg-destructive text-destructive-foreground hover:bg-destructive/90" onClick={() => deleteId && deleteMutation.mutate({ id: deleteId })}>Remover</AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </div>
  );
}

function StatCard({ label, value, accent }: { label: string; value: number; accent?: boolean }) {
  return (
    <div className="bg-card border border-border/30 rounded-lg p-3">
      <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium">{label}</p>
      <p className={`text-lg font-bold font-mono mt-1 ${accent ? "text-emerald-400" : ""}`}>{value}</p>
    </div>
  );
}

function DetailRow({ label, value }: { label: string; value?: string | number | null }) {
  if (!value) return null;
  return (
    <div>
      <p className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</p>
      <p className="text-xs mt-0.5">{value}</p>
    </div>
  );
}
