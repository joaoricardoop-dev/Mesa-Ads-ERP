import { useState, useMemo, Fragment } from "react";
import { useLocation } from "wouter";

import { trpc } from "@/lib/trpc";
import PageContainer from "@/components/PageContainer";
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
  ArrowUpDown,
} from "lucide-react";
import {
  LOCATION_RATING_LABELS,
  VENUE_TYPE_LABELS,
  DIGITAL_PRESENCE_LABELS,
  PRIMARY_DRINK_LABELS,
} from "@shared/rating-config";
import RestaurantAvatar from "@/components/RestaurantAvatar";

const CONTACT_TYPE_LABELS: Record<string, string> = {
  proprietario: "Proprietário",
  gerente: "Gerente",
  marketing: "Marketing",
  outro: "Outro",
};

const SOCIAL_CLASS_LABELS: Record<string, string> = {
  AA: "Classe AA", A: "Classe A", B: "Classe B", C: "Classe C", D: "Classe D", E: "Classe E",
  misto_ab: "Misto (A/B)", misto_bc: "Misto (B/C)", nao_sei: "Não sei",
};

function formatSocialClass(value: string): string {
  if (!value) return "—";
  try { const parsed = JSON.parse(value); if (Array.isArray(parsed)) return parsed.map((c: string) => SOCIAL_CLASS_LABELS[c] || c).join(", "); } catch {}
  return SOCIAL_CLASS_LABELS[value] || value;
}

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


type SortOption = "name" | "ratingScore";

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
  socialClass: string[];
  tableCount: number;
  seatCount: number;
  monthlyCustomers: number;
  busyDays: string[];
  busyHours: string[];
  excludedCategories: string[];
  excludedOther: string;
  photoAuthorization: string;
  pixKey: string;
  notes: string;
  status: string;
  ticketMedio: number;
  locationRating: number;
  venueType: number;
  digitalPresence: number;
  primaryDrink: string;
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
  socialClass: [],
  tableCount: 0,
  seatCount: 0,
  monthlyCustomers: 0,
  busyDays: [],
  busyHours: [],
  excludedCategories: [],
  excludedOther: "",
  photoAuthorization: "sim",
  pixKey: "",
  notes: "",
  status: "active",
  ticketMedio: 0,
  locationRating: 1,
  venueType: 1,
  digitalPresence: 1,
  primaryDrink: "",
};

export default function ActiveRestaurantsPage() {
  const [, navigate] = useLocation();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [deleteId, setDeleteId] = useState<number | null>(null);
  const [form, setForm] = useState<FormData>(emptyForm);
  const [search, setSearch] = useState("");
  const [sortBy, setSortBy] = useState<SortOption>("name");

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
      socialClass: (() => { const sc = r.socialClass; if (!sc) return []; try { const p = JSON.parse(sc); if (Array.isArray(p)) return p; } catch {} return [sc]; })(),
      tableCount: r.tableCount,
      seatCount: r.seatCount,
      monthlyCustomers: r.monthlyCustomers,
      busyDays: (() => { const bd = r.busyDays; if (!bd) return []; try { const p = JSON.parse(bd); if (Array.isArray(p)) return p; } catch {} return bd.split(",").map((s: string) => s.trim()).filter(Boolean); })(),
      busyHours: (() => { const bh = r.busyHours; if (!bh) return []; try { const p = JSON.parse(bh); if (Array.isArray(p)) return p; } catch {} return bh.split(",").map((s: string) => s.trim()).filter(Boolean); })(),
      excludedCategories: (() => { const ec = r.excludedCategories; if (!ec) return []; try { const p = JSON.parse(ec); if (Array.isArray(p)) return p; } catch {} if (ec.includes("||")) return ec.split("||").map((s: string) => s.trim()).filter(Boolean); return ec.split(",").map((s: string) => s.trim()).filter(Boolean); })(),
      excludedOther: r.excludedOther || "",
      photoAuthorization: r.photoAuthorization || "sim",
      pixKey: r.pixKey || "",
      notes: r.notes || "",
      status: r.status,
      ticketMedio: r.ticketMedio ? parseFloat(String(r.ticketMedio)) : 0,
      locationRating: r.locationRating || 1,
      venueType: r.venueType || 1,
      digitalPresence: r.digitalPresence || 1,
      primaryDrink: r.primaryDrink || "",
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
      socialClass: JSON.stringify(form.socialClass),
      tableCount: form.tableCount,
      seatCount: form.seatCount,
      monthlyCustomers: form.monthlyCustomers,
      busyDays: JSON.stringify(form.busyDays),
      busyHours: JSON.stringify(form.busyHours),
      excludedCategories: JSON.stringify(form.excludedCategories),
      excludedOther: form.excludedOther || undefined,
      photoAuthorization: form.photoAuthorization,
      pixKey: form.pixKey || undefined,
      notes: form.notes || undefined,
      ticketMedio: form.ticketMedio ? String(form.ticketMedio) : undefined,
      locationRating: form.locationRating,
      venueType: form.venueType,
      digitalPresence: form.digitalPresence,
      primaryDrink: form.primaryDrink || undefined,
    };

    if (editingId) {
      updateMutation.mutate({ id: editingId, ...payload, status: form.status as any });
    } else {
      createMutation.mutate(payload);
    }
  };

  const filtered = useMemo(() => {
    let list = restaurants.filter((r) => {
      if (search) {
        const s = search.toLowerCase();
        if (!r.name.toLowerCase().includes(s) && !r.neighborhood.toLowerCase().includes(s) && !(r.whatsapp && r.whatsapp.includes(s))) return false;
      }
      return true;
    });

    if (sortBy === "ratingScore") {
      list = [...list].sort((a, b) => {
        const sa = (a as any).ratingScore != null ? parseFloat(String((a as any).ratingScore)) : -1;
        const sb = (b as any).ratingScore != null ? parseFloat(String((b as any).ratingScore)) : -1;
        return sb - sa;
      });
    } else {
      list = [...list].sort((a, b) => a.name.localeCompare(b.name));
    }

    return list;
  }, [restaurants, search, sortBy]);

  const activeCount = restaurants.filter((r) => r.status === "active").length;
  const totalTables = restaurants.reduce((s, r) => s + (r.tableCount || 0), 0);
  const totalSeats = restaurants.reduce((s, r) => s + (r.seatCount || 0), 0);

  const toggleBusyDay = (day: string) => {
    setForm(prev => ({
      ...prev,
      busyDays: prev.busyDays.includes(day) ? prev.busyDays.filter(d => d !== day) : [...prev.busyDays, day],
    }));
  };

  const toggleBusyHour = (slot: string) => {
    setForm(prev => ({
      ...prev,
      busyHours: prev.busyHours.includes(slot) ? prev.busyHours.filter(s => s !== slot) : [...prev.busyHours, slot],
    }));
  };

  const toggleCategory = (cat: string) => {
    setForm(prev => ({
      ...prev,
      excludedCategories: prev.excludedCategories.includes(cat) ? prev.excludedCategories.filter(c => c !== cat) : [...prev.excludedCategories, cat],
    }));
  };

  return (
    <PageContainer
      title="Restaurantes Ativos"
      description="Rede de parceiros ativa da Mesa Ads"
      actions={
        <Button onClick={() => navigate("/restaurantes/novo")} className="gap-2">
          <Plus className="w-4 h-4" /> Novo Restaurante
        </Button>
      }
    >

        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <StatCard label="Total" value={restaurants.length} />
          <StatCard label="Ativos" value={activeCount} accent />
          <StatCard label="Total Mesas" value={totalTables} />
          <StatCard label="Total Assentos" value={totalSeats} />
        </div>

        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative max-w-md flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input placeholder="Buscar restaurante..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-10 bg-card border-border/30" />
          </div>
          <Button
            variant={sortBy === "ratingScore" ? "default" : "outline"}
            size="sm"
            className="gap-1.5 h-9"
            onClick={() => setSortBy(prev => prev === "name" ? "ratingScore" : "name")}
          >
            <ArrowUpDown className="w-3.5 h-3.5" />
            {sortBy === "ratingScore" ? "Rating" : "Nome"}
          </Button>
        </div>

        <div className="space-y-2">
          {filtered.length === 0 ? (
            <div className="bg-card border border-border/30 rounded-lg p-8 text-center text-muted-foreground">
              Nenhum restaurante encontrado
            </div>
          ) : (
            filtered.map((r) => {
              return (
                <div key={r.id} className="bg-card border border-border/30 rounded-lg overflow-hidden">
                  <div
                    className="p-4 cursor-pointer hover:bg-card/80 transition-colors"
                    onClick={() => navigate(`/restaurantes/perfil/${r.id}`)}
                  >
                    <div className="flex items-center justify-between gap-4">
                      <div className="flex items-center gap-3 min-w-0 flex-1">
                        <RestaurantAvatar name={r.name} logoUrl={(r as any).logoUrl} size="sm" />
                        <div className="min-w-0">
                          <div className="flex items-center gap-2">
                            <h3 className="font-semibold text-sm truncate">{r.name}</h3>
                            <Badge variant="outline" className={r.status === "active" ? "bg-emerald-500/20 text-emerald-400 border-emerald-500/30 text-[10px]" : "bg-gray-500/20 text-gray-400 border-gray-500/30 text-[10px]"}>
                              {r.status === "active" ? "Ativo" : "Inativo"}
                            </Badge>
                            {(r as any).ratingScore != null ? (
                              <Badge variant="outline" className="text-[10px] font-bold font-mono border-primary/30 bg-primary/10 text-primary">
                                {parseFloat(String((r as any).ratingScore)).toFixed(2)}
                              </Badge>
                            ) : (
                              <Badge variant="outline" className="text-[10px] text-muted-foreground border-border/30">
                                —
                              </Badge>
                            )}
                          </div>
                          <p className="text-xs text-muted-foreground mt-0.5 truncate">
                            {r.neighborhood} · {formatSocialClass(r.socialClass)}
                            {r.contactName ? ` · ${r.contactName}` : ""}
                          </p>
                        </div>
                      </div>

                      <div className="hidden md:flex items-center gap-6 text-sm">
                        <div className="text-right">
                          <p className="text-xs text-muted-foreground">Mesas</p>
                          <p className="font-mono font-semibold">{r.tableCount}</p>
                        </div>
                        <div className="text-right">
                          <p className="text-xs text-muted-foreground">Assentos</p>
                          <p className="font-mono font-semibold">{r.seatCount}</p>
                        </div>
                        <div className="text-right">
                          <p className="text-xs text-muted-foreground">Clientes/Mês</p>
                          <p className="font-mono font-semibold">{r.monthlyCustomers?.toLocaleString("pt-BR")}</p>
                        </div>
                        <div className="text-center">
                          <p className="text-xs text-muted-foreground">Cap. Coasters</p>
                          <p className="font-mono">{r.monthlyDrinksSold ? Math.round(r.monthlyDrinksSold * 0.6).toLocaleString("pt-BR") : "—"}</p>
                        </div>
                      </div>

                      <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
                        <Button variant="ghost" size="icon" className="h-8 w-8" title="Editar" onClick={() => navigate(`/restaurantes/${r.id}`)}>
                          <Pencil className="w-3.5 h-3.5" />
                        </Button>
                        <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:text-destructive" title="Excluir" onClick={() => setDeleteId(r.id)}>
                          <Trash2 className="w-3.5 h-3.5" />
                        </Button>
                      </div>
                    </div>
                  </div>
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
              <div className="overflow-x-auto -mx-1 px-1 scrollbar-hide">
                <TabsList className="inline-flex w-auto min-w-full sm:w-full">
                  <TabsTrigger value="local" className="text-xs">Local</TabsTrigger>
                  <TabsTrigger value="contato" className="text-xs">Contato</TabsTrigger>
                  <TabsTrigger value="operacao" className="text-xs">Operação</TabsTrigger>
                  <TabsTrigger value="restricoes" className="text-xs">Restrições</TabsTrigger>
                  <TabsTrigger value="financeiro" className="text-xs">Financeiro</TabsTrigger>
                </TabsList>
              </div>

              <TabsContent value="local" className="space-y-4">
                <div className="space-y-2">
                  <Label className="text-xs">Nome do Estabelecimento *</Label>
                  <Input value={form.name} onChange={(e) => setForm(p => ({ ...p, name: e.target.value }))} placeholder="Nome do restaurante" className="bg-background border-border/30" />
                </div>
                <div className="space-y-2">
                  <Label className="text-xs">Endereço Completo *</Label>
                  <Input value={form.address} onChange={(e) => setForm(p => ({ ...p, address: e.target.value }))} placeholder="Rua, número, complemento" className="bg-background border-border/30" />
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
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
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="space-y-2">
                    <Label className="text-xs">Nome do Responsável *</Label>
                    <Input value={form.contactName} onChange={(e) => setForm(p => ({ ...p, contactName: e.target.value }))} className="bg-background border-border/30" />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-xs">Cargo *</Label>
                    <Input value={form.contactRole} onChange={(e) => setForm(p => ({ ...p, contactRole: e.target.value }))} className="bg-background border-border/30" />
                  </div>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
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
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
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
                <div className="space-y-2">
                  <Label className="text-xs">Classe Social Predominante *</Label>
                  <div className="flex flex-wrap gap-2">
                    {["AA", "A", "B", "C", "D", "E"].map((cls) => (
                      <Button
                        key={cls}
                        type="button"
                        size="sm"
                        variant={form.socialClass.includes(cls) ? "default" : "outline"}
                        className="text-xs h-7 px-3"
                        onClick={() => setForm(p => ({
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
                  <div className="flex flex-wrap gap-2">
                    {BUSY_HOURS_OPTIONS.map((slot) => (
                      <Button key={slot} type="button" size="sm" variant={form.busyHours.includes(slot) ? "default" : "outline"} className="text-xs h-7 px-3" onClick={() => toggleBusyHour(slot)}>
                        {slot}
                      </Button>
                    ))}
                  </div>
                </div>
                <div className="border-t border-border/20 pt-3 space-y-3">
                  <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">Rating Interno</p>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div className="space-y-2">
                      <Label className="text-xs">Ticket Médio (R$)</Label>
                      <Input
                        type="number"
                        step="0.01"
                        min="5"
                        value={form.ticketMedio || ""}
                        onChange={(e) => setForm(p => ({ ...p, ticketMedio: parseFloat(e.target.value) || 0 }))}
                        placeholder="Ex: 45.00"
                        className="bg-background border-border/30"
                      />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label className="text-xs">Localização</Label>
                    <Select value={String(form.locationRating)} onValueChange={(v) => setForm(p => ({ ...p, locationRating: parseInt(v) }))}>
                      <SelectTrigger className="bg-background border-border/30"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {Object.entries(LOCATION_RATING_LABELS).map(([val, label]) => (
                          <SelectItem key={val} value={val}>{label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label className="text-xs">Tipo de Estabelecimento</Label>
                    <Select value={String(form.venueType)} onValueChange={(v) => setForm(p => ({ ...p, venueType: parseInt(v) }))}>
                      <SelectTrigger className="bg-background border-border/30"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {Object.entries(VENUE_TYPE_LABELS).map(([val, label]) => (
                          <SelectItem key={val} value={val}>{label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label className="text-xs">Presença Digital</Label>
                    <Select value={String(form.digitalPresence)} onValueChange={(v) => setForm(p => ({ ...p, digitalPresence: parseInt(v) }))}>
                      <SelectTrigger className="bg-background border-border/30"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {Object.entries(DIGITAL_PRESENCE_LABELS).map(([val, label]) => (
                          <SelectItem key={val} value={val}>{label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label className="text-xs">Bebida Predominante</Label>
                    <Select value={form.primaryDrink || "_none"} onValueChange={(v) => setForm(p => ({ ...p, primaryDrink: v === "_none" ? "" : v }))}>
                      <SelectTrigger className="bg-background border-border/30"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="_none">Nenhuma / Não informado</SelectItem>
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
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
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
    </PageContainer>
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

