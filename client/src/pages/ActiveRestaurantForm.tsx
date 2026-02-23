import { useState, useEffect } from "react";
import { useRoute, useLocation } from "wouter";
import AppNav from "@/components/AppNav";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import {
  ArrowLeft,
  Search,
  Loader2,
  Building2,
  MapPin,
  Phone,
  Instagram,
  CheckCircle2,
  AlertTriangle,
  Users,
  Hash,
  Mail,
  UtensilsCrossed,
  ShieldAlert,
  CreditCard,
  BarChart3,
  Globe,
  Calendar,
  MessageCircle,
} from "lucide-react";

const BUSY_DAYS_OPTIONS = ["Seg", "Ter", "Qua", "Qui", "Sex", "Sáb", "Dom"];

const EXCLUDED_CATEGORIES = [
  "Concorrentes diretos",
  "Bebidas alcoólicas",
  "Bebidas não alcoólicas",
  "Alimentação (marcas de comida, snacks, etc.)",
  "Cafeterias e docerias",
  "Sorveterias / açaí / sobremesas",
  "Apps de delivery e marketplaces",
  "Farmácia e saúde",
  "Beleza e cosméticos",
  "Moda e acessórios",
  "Fitness e academia",
  "Pet (ração, veterinária, petshop)",
  "Seguros e planos de saúde",
  "Bancos e cartões",
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

interface Socio {
  nome: string;
  qualificacao: string;
  dataEntrada: string;
  faixaEtaria: string;
}

export default function ActiveRestaurantForm() {
  const [, navigate] = useLocation();
  const [matchEdit, params] = useRoute("/restaurantes/:id");
  const editId = matchEdit && params?.id !== "novo" ? parseInt(params!.id) : null;
  const isEditing = editId !== null;

  const [form, setForm] = useState<FormData>(emptyForm);
  const [cnpjInput, setCnpjInput] = useState("");
  const [cnpjFetched, setCnpjFetched] = useState(false);
  const [sociosList, setSociosList] = useState<Socio[]>([]);
  const [step, setStep] = useState<"cnpj" | "form">(isEditing ? "form" : "cnpj");

  const utils = trpc.useUtils();

  const { data: existingRestaurant } = trpc.activeRestaurant.get.useQuery(
    { id: editId! },
    { enabled: isEditing }
  );

  useEffect(() => {
    if (existingRestaurant) {
      setForm({
        name: existingRestaurant.name,
        address: existingRestaurant.address || "",
        neighborhood: existingRestaurant.neighborhood || "",
        googleMapsLink: existingRestaurant.googleMapsLink || "",
        instagram: existingRestaurant.instagram || "",
        contactType: existingRestaurant.contactType || "gerente",
        contactName: existingRestaurant.contactName || "",
        contactRole: existingRestaurant.contactRole || "",
        whatsapp: existingRestaurant.whatsapp || "",
        email: existingRestaurant.email || "",
        financialEmail: existingRestaurant.financialEmail || "",
        socialClass: existingRestaurant.socialClass || "misto_ab",
        tableCount: existingRestaurant.tableCount || 0,
        seatCount: existingRestaurant.seatCount || 0,
        monthlyCustomers: existingRestaurant.monthlyCustomers || 0,
        busyDays: existingRestaurant.busyDays ? JSON.parse(existingRestaurant.busyDays) : [],
        busyHours: existingRestaurant.busyHours || "",
        excludedCategories: existingRestaurant.excludedCategories ? JSON.parse(existingRestaurant.excludedCategories) : [],
        excludedOther: existingRestaurant.excludedOther || "",
        photoAuthorization: existingRestaurant.photoAuthorization || "sim",
        pixKey: existingRestaurant.pixKey || "",
        notes: existingRestaurant.notes || "",
        status: existingRestaurant.status,
      });
      setStep("form");
    }
  }, [existingRestaurant]);

  const cnpjClean = cnpjInput.replace(/\D/g, "");
  const { isFetching: isCnpjLoading, error: cnpjError, refetch: fetchCnpj } = trpc.cnpj.lookup.useQuery(
    { cnpj: cnpjClean },
    { enabled: false, retry: false }
  );

  const handleCnpjSearch = async () => {
    if (cnpjClean.length !== 14) {
      toast.error("CNPJ deve ter 14 dígitos");
      return;
    }
    const result = await fetchCnpj();
    if (result.data) {
      const d = result.data;
      setSociosList(d.socios || []);

      const fullAddress = [d.logradouro, d.numero, d.complemento].filter(Boolean).join(", ");

      setForm(prev => ({
        ...prev,
        name: d.nomeFantasia || d.razaoSocial || "",
        address: fullAddress,
        neighborhood: d.bairro,
        email: d.email,
        whatsapp: d.telefone1,
      }));
      setCnpjFetched(true);
      setStep("form");
      toast.success("Dados do CNPJ carregados!");
    } else if (result.error) {
      toast.error(result.error.message);
    }
  };

  const handleSkipCnpj = () => setStep("form");

  const toggleBusyDay = (day: string) => {
    setForm(prev => ({
      ...prev,
      busyDays: prev.busyDays.includes(day)
        ? prev.busyDays.filter(d => d !== day)
        : [...prev.busyDays, day],
    }));
  };

  const toggleCategory = (cat: string) => {
    setForm(prev => ({
      ...prev,
      excludedCategories: prev.excludedCategories.includes(cat)
        ? prev.excludedCategories.filter(c => c !== cat)
        : [...prev.excludedCategories, cat],
    }));
  };

  const createMutation = trpc.activeRestaurant.create.useMutation({
    onSuccess: () => {
      utils.activeRestaurant.list.invalidate();
      toast.success("Restaurante cadastrado!");
      navigate("/restaurantes");
    },
    onError: (err) => toast.error(`Erro: ${err.message}`),
  });

  const updateMutation = trpc.activeRestaurant.update.useMutation({
    onSuccess: () => {
      utils.activeRestaurant.list.invalidate();
      toast.success("Restaurante atualizado!");
      navigate("/restaurantes");
    },
    onError: (err) => toast.error(`Erro: ${err.message}`),
  });

  const handleSave = () => {
    if (!form.name.trim()) { toast.error("Nome é obrigatório"); return; }
    if (!form.address.trim()) { toast.error("Endereço é obrigatório"); return; }
    if (!form.neighborhood.trim()) { toast.error("Bairro é obrigatório"); return; }
    if (!form.contactName.trim()) { toast.error("Nome do contato é obrigatório"); return; }
    if (!form.contactRole.trim()) { toast.error("Cargo é obrigatório"); return; }
    if (!form.whatsapp.trim()) { toast.error("WhatsApp é obrigatório"); return; }

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
      busyDays: JSON.stringify(form.busyDays),
      busyHours: form.busyHours || undefined,
      excludedCategories: JSON.stringify(form.excludedCategories),
      excludedOther: form.excludedOther || undefined,
      photoAuthorization: form.photoAuthorization,
      pixKey: form.pixKey || undefined,
      notes: form.notes || undefined,
      status: form.status as "active" | "inactive",
    };

    if (isEditing) {
      updateMutation.mutate({ id: editId!, ...payload });
    } else {
      createMutation.mutate(payload);
    }
  };

  return (
    <div className="h-screen flex flex-col overflow-hidden">
      <AppNav />
      <div className="flex-1 overflow-y-auto">
        <div className="border-b border-border/20 bg-card/30 px-4 lg:px-6 py-4">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0" onClick={() => navigate("/restaurantes")}>
              <ArrowLeft className="w-4 h-4" />
            </Button>
            <div>
              <h1 className="text-lg font-bold tracking-tight">
                {isEditing ? "Editar Restaurante" : "Novo Restaurante Ativo"}
              </h1>
              <p className="text-xs text-muted-foreground mt-0.5">
                {step === "cnpj" ? "Comece informando o CNPJ para buscar dados automaticamente" : "Preencha os dados do restaurante parceiro"}
              </p>
            </div>
          </div>
        </div>

        <div className="p-4 lg:p-6 max-w-5xl mx-auto space-y-6">
          {step === "cnpj" && (
            <div className="space-y-6">
              <div className="bg-card border border-border/30 rounded-xl p-6 space-y-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-primary/20 flex items-center justify-center">
                    <Hash className="w-5 h-5 text-primary" />
                  </div>
                  <div>
                    <h2 className="text-sm font-semibold">Buscar por CNPJ</h2>
                    <p className="text-xs text-muted-foreground">
                      Informe o CNPJ para preencher nome, endereço e contato automaticamente
                    </p>
                  </div>
                </div>

                <div className="flex gap-3">
                  <div className="flex-1">
                    <Input
                      value={cnpjInput}
                      onChange={(e) => setCnpjInput(e.target.value)}
                      placeholder="00.000.000/0000-00"
                      className="bg-background border-border/30 h-11 text-base font-mono"
                      onKeyDown={(e) => e.key === "Enter" && handleCnpjSearch()}
                    />
                  </div>
                  <Button onClick={handleCnpjSearch} disabled={isCnpjLoading || cnpjClean.length !== 14} className="gap-2 h-11 px-6">
                    {isCnpjLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
                    Buscar
                  </Button>
                </div>

                {cnpjError && (
                  <div className="flex items-center gap-2 p-3 rounded-lg bg-red-500/10 border border-red-500/30 text-red-400 text-xs">
                    <AlertTriangle className="w-4 h-4 shrink-0" />
                    <span>{cnpjError.message}</span>
                  </div>
                )}
              </div>

              <div className="text-center">
                <Button variant="ghost" className="text-xs text-muted-foreground" onClick={handleSkipCnpj}>
                  Pular e cadastrar manualmente →
                </Button>
              </div>
            </div>
          )}

          {step === "form" && (
            <div className="space-y-6">
              {cnpjFetched && (
                <div className="flex items-center gap-2 p-3 rounded-lg bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-xs">
                  <CheckCircle2 className="w-4 h-4 shrink-0" />
                  <span>Dados preenchidos automaticamente via CNPJ. Revise e complete as informações.</span>
                </div>
              )}

              {!isEditing && (
                <div className="flex items-center gap-2">
                  <Button variant="ghost" size="sm" className="text-xs" onClick={() => { setStep("cnpj"); setCnpjFetched(false); }}>
                    ← Voltar para busca CNPJ
                  </Button>
                </div>
              )}

              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <div className="lg:col-span-2 space-y-6">
                  <Section icon={<MapPin className="w-4 h-4" />} title="Local">
                    <Field label="Nome do Estabelecimento *" value={form.name} onChange={(v) => setForm(p => ({ ...p, name: v }))} />
                    <Field label="Endereço Completo *" value={form.address} onChange={(v) => setForm(p => ({ ...p, address: v }))} placeholder="Rua, número, complemento" />
                    <div className="grid grid-cols-2 gap-3">
                      <Field label="Bairro/Zona *" value={form.neighborhood} onChange={(v) => setForm(p => ({ ...p, neighborhood: v }))} />
                      <Field label="Instagram" value={form.instagram} onChange={(v) => setForm(p => ({ ...p, instagram: v }))} placeholder="@usuario" icon={<Instagram className="w-3 h-3 text-pink-500" />} />
                    </div>
                    <Field label="Link do Google Maps" value={form.googleMapsLink} onChange={(v) => setForm(p => ({ ...p, googleMapsLink: v }))} placeholder="https://maps.google.com/..." icon={<Globe className="w-3 h-3" />} />
                  </Section>

                  <Section icon={<Phone className="w-4 h-4" />} title="Contato">
                    <div className="grid grid-cols-2 gap-3">
                      <Field label="Nome do Responsável *" value={form.contactName} onChange={(v) => setForm(p => ({ ...p, contactName: v }))} />
                      <Field label="Cargo *" value={form.contactRole} onChange={(v) => setForm(p => ({ ...p, contactRole: v }))} />
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-1.5">
                        <Label className="text-xs text-muted-foreground">Tipo de Contato</Label>
                        <Select value={form.contactType} onValueChange={(v) => setForm(p => ({ ...p, contactType: v }))}>
                          <SelectTrigger className="bg-background border-border/30 h-9 text-sm"><SelectValue /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="proprietario">Proprietário</SelectItem>
                            <SelectItem value="gerente">Gerente</SelectItem>
                            <SelectItem value="marketing">Marketing</SelectItem>
                            <SelectItem value="outro">Outro</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <Field label="WhatsApp *" value={form.whatsapp} onChange={(v) => setForm(p => ({ ...p, whatsapp: v }))} placeholder="(00) 00000-0000" icon={<MessageCircle className="w-3 h-3 text-green-500" />} />
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <Field label="Email" value={form.email} onChange={(v) => setForm(p => ({ ...p, email: v }))} icon={<Mail className="w-3 h-3" />} />
                      <Field label="Email Financeiro" value={form.financialEmail} onChange={(v) => setForm(p => ({ ...p, financialEmail: v }))} icon={<Mail className="w-3 h-3" />} />
                    </div>
                  </Section>

                  <Section icon={<BarChart3 className="w-4 h-4" />} title="Operação">
                    <div className="space-y-1.5">
                      <Label className="text-xs text-muted-foreground">Classe Social Predominante *</Label>
                      <Select value={form.socialClass} onValueChange={(v) => setForm(p => ({ ...p, socialClass: v }))}>
                        <SelectTrigger className="bg-background border-border/30 h-9 text-sm w-48"><SelectValue /></SelectTrigger>
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
                    <div className="grid grid-cols-3 gap-3">
                      <NumberField label="Quantidade de Mesas *" value={form.tableCount} onChange={(v) => setForm(p => ({ ...p, tableCount: v }))} />
                      <NumberField label="Quantidade de Assentos *" value={form.seatCount} onChange={(v) => setForm(p => ({ ...p, seatCount: v }))} />
                      <NumberField label="Clientes por Mês *" value={form.monthlyCustomers} onChange={(v) => setForm(p => ({ ...p, monthlyCustomers: v }))} />
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-xs text-muted-foreground">Dias de Maior Movimento</Label>
                      <div className="flex flex-wrap gap-2">
                        {BUSY_DAYS_OPTIONS.map((day) => (
                          <Button key={day} type="button" size="sm" variant={form.busyDays.includes(day) ? "default" : "outline"} className="text-xs h-7 px-3" onClick={() => toggleBusyDay(day)}>
                            {day}
                          </Button>
                        ))}
                      </div>
                    </div>
                    <Field label="Horários de Maior Movimento" value={form.busyHours} onChange={(v) => setForm(p => ({ ...p, busyHours: v }))} placeholder="Ex: 18h–22h" />
                  </Section>

                  <Section icon={<ShieldAlert className="w-4 h-4" />} title="Restrições">
                    <div className="space-y-1.5">
                      <Label className="text-xs text-muted-foreground">Categorias que NÃO deseja anunciar *</Label>
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
                    <div className="space-y-1.5">
                      <Label className="text-xs text-muted-foreground">Outros (descreva)</Label>
                      <Textarea value={form.excludedOther} onChange={(e) => setForm(p => ({ ...p, excludedOther: e.target.value }))} placeholder="Categorias adicionais..." className="bg-background border-border/30 min-h-[60px] text-sm" />
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-xs text-muted-foreground">Autoriza uso de fotos de veiculação? *</Label>
                      <Select value={form.photoAuthorization} onValueChange={(v) => setForm(p => ({ ...p, photoAuthorization: v }))}>
                        <SelectTrigger className="bg-background border-border/30 h-9 text-sm w-32"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="sim">Sim</SelectItem>
                          <SelectItem value="nao">Não</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </Section>

                  <Section icon={<CreditCard className="w-4 h-4" />} title="Financeiro">
                    <div className="grid grid-cols-2 gap-3">
                      <Field label="Chave Pix" value={form.pixKey} onChange={(v) => setForm(p => ({ ...p, pixKey: v }))} placeholder="CPF, CNPJ, email ou telefone" />
                      {isEditing && (
                        <div className="space-y-1.5">
                          <Label className="text-xs text-muted-foreground">Status</Label>
                          <Select value={form.status} onValueChange={(v) => setForm(p => ({ ...p, status: v }))}>
                            <SelectTrigger className="bg-background border-border/30 h-9 text-sm"><SelectValue /></SelectTrigger>
                            <SelectContent>
                              <SelectItem value="active">Ativo</SelectItem>
                              <SelectItem value="inactive">Inativo</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                      )}
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-xs text-muted-foreground">Observações</Label>
                      <Textarea value={form.notes} onChange={(e) => setForm(p => ({ ...p, notes: e.target.value }))} placeholder="Anotações internas..." className="bg-background border-border/30 min-h-[60px] text-sm" />
                    </div>
                  </Section>
                </div>

                <div className="space-y-6">
                  {sociosList.length > 0 && (
                    <div className="bg-card border border-border/30 rounded-xl p-4 space-y-3 sticky top-4">
                      <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                        <Users className="w-3.5 h-3.5" /> Quadro Societário
                      </h3>
                      <div className="space-y-3">
                        {sociosList.map((s, i) => (
                          <div key={i} className="p-3 bg-background/50 rounded-lg border border-border/20 space-y-1">
                            <p className="text-sm font-medium">{s.nome}</p>
                            <p className="text-[10px] text-muted-foreground">{s.qualificacao}</p>
                            {s.dataEntrada && (
                              <p className="text-[10px] text-muted-foreground flex items-center gap-1">
                                <Calendar className="w-3 h-3" /> Entrada: {s.dataEntrada}
                              </p>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  <div className="bg-card border border-border/30 rounded-xl p-4 space-y-3">
                    <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                      <UtensilsCrossed className="w-3.5 h-3.5" /> Resumo
                    </h3>
                    <div className="space-y-2">
                      <InfoRow label="Estabelecimento" value={form.name} />
                      <InfoRow label="Bairro" value={form.neighborhood} />
                      <InfoRow label="Contato" value={form.contactName} />
                      <InfoRow label="WhatsApp" value={form.whatsapp} />
                      <InfoRow label="Mesas" value={form.tableCount > 0 ? String(form.tableCount) : undefined} />
                      <InfoRow label="Assentos" value={form.seatCount > 0 ? String(form.seatCount) : undefined} />
                      <InfoRow label="Clientes/Mês" value={form.monthlyCustomers > 0 ? form.monthlyCustomers.toLocaleString("pt-BR") : undefined} />
                    </div>
                  </div>
                </div>
              </div>

              <div className="flex items-center justify-between pt-4 border-t border-border/20">
                <Button variant="outline" onClick={() => navigate("/restaurantes")}>Cancelar</Button>
                <Button onClick={handleSave} disabled={createMutation.isPending || updateMutation.isPending || !form.name.trim()} className="gap-2 px-6">
                  <CheckCircle2 className="w-4 h-4" />
                  {isEditing ? "Salvar Alterações" : "Cadastrar Restaurante"}
                </Button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function Section({ icon, title, children }: { icon: React.ReactNode; title: string; children: React.ReactNode }) {
  return (
    <div className="bg-card border border-border/30 rounded-xl p-4 space-y-3">
      <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
        {icon} {title}
      </h3>
      {children}
    </div>
  );
}

function Field({ label, value, onChange, placeholder, icon }: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  icon?: React.ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <Label className="text-xs text-muted-foreground flex items-center gap-1">
        {icon}
        {label}
      </Label>
      <Input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="bg-background border-border/30 h-9 text-sm"
      />
    </div>
  );
}

function NumberField({ label, value, onChange }: {
  label: string;
  value: number;
  onChange: (v: number) => void;
}) {
  return (
    <div className="space-y-1.5">
      <Label className="text-xs text-muted-foreground">{label}</Label>
      <Input
        type="number"
        value={value}
        onChange={(e) => onChange(parseInt(e.target.value) || 0)}
        className="bg-background border-border/30 h-9 text-sm"
      />
    </div>
  );
}

function InfoRow({ label, value }: { label: string; value?: string }) {
  if (!value) return null;
  return (
    <div>
      <p className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</p>
      <p className="text-xs mt-0.5">{value}</p>
    </div>
  );
}
