import { useState, useEffect } from "react";
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
import { toast } from "sonner";
import DOMPurify from "dompurify";
import {
  Building2,
  MapPin,
  Users,
  FileText,
  UserPlus,
  ChevronRight,
  ChevronLeft,
  Check,
  Loader2,
  Search,
  Eye,
  EyeOff,
  Lock,
  Mail,
  CheckCircle2,
} from "lucide-react";

const STATES = [
  "AC","AL","AP","AM","BA","CE","DF","ES","GO","MA","MT","MS","MG",
  "PA","PB","PR","PE","PI","RJ","RN","RS","RO","RR","SC","SP","SE","TO",
];

const EXCLUDED_CATEGORIES = [
  "Bebidas Alcoólicas",
  "Tabaco",
  "Apostas / Jogos de Azar",
  "Política / Partidos",
  "Religião",
  "Armas",
  "Conteúdo Adulto",
  "Concorrentes Diretos",
];

const BUSY_DAYS_OPTIONS = [
  "Segunda", "Terça", "Quarta", "Quinta", "Sexta", "Sábado", "Domingo",
];

interface TermTemplateItem {
  id: number | null;
  title: string;
  content: string;
  version: number;
}

interface FormData {
  name: string;
  cnpj: string;
  razaoSocial: string;
  address: string;
  addressNumber: string;
  neighborhood: string;
  city: string;
  state: string;
  cep: string;
  googleMapsLink: string;
  instagram: string;
  contactType: string;
  contactName: string;
  contactRole: string;
  whatsapp: string;
  email: string;
  financialEmail: string;
  tableCount: string;
  seatCount: string;
  monthlyCustomers: string;
  monthlyDrinksSold: string;
  busyDays: string[];
  busyHours: string;
  ticketMedio: string;
  excludedCategories: string[];
  photoAuthorization: string;
  pixKey: string;
  notes: string;
  acceptTerms: boolean;
  acceptedByName: string;
  acceptedByCpf: string;
  accountEmail: string;
  accountPassword: string;
  accountPasswordConfirm: string;
}

export default function RestaurantOnboarding() {
  const [step, setStep] = useState(0);
  const [loading, setLoading] = useState(false);
  const [cnpjLoading, setCnpjLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [termTemplates, setTermTemplates] = useState<TermTemplateItem[]>([]);
  const [termsLoaded, setTermsLoaded] = useState(false);
  const [acceptedTemplateIds, setAcceptedTemplateIds] = useState<Set<number | null>>(new Set());
  const [form, setForm] = useState<FormData>({
    name: "",
    cnpj: "",
    razaoSocial: "",
    address: "",
    addressNumber: "",
    neighborhood: "",
    city: "",
    state: "",
    cep: "",
    googleMapsLink: "",
    instagram: "",
    contactType: "",
    contactName: "",
    contactRole: "",
    whatsapp: "",
    email: "",
    financialEmail: "",
    tableCount: "",
    seatCount: "",
    monthlyCustomers: "",
    monthlyDrinksSold: "",
    busyDays: [],
    busyHours: "",
    ticketMedio: "",
    excludedCategories: [],
    photoAuthorization: "sim",
    pixKey: "",
    notes: "",
    acceptTerms: false,
    acceptedByName: "",
    acceptedByCpf: "",
    accountEmail: "",
    accountPassword: "",
    accountPasswordConfirm: "",
  });

  const update = (field: keyof FormData, value: any) =>
    setForm((f) => ({ ...f, [field]: value }));

  const loadTerms = async () => {
    if (termsLoaded) return;
    try {
      const res = await fetch("/api/restaurant-onboarding/terms");
      const data = await res.json();
      if (data.templates && Array.isArray(data.templates)) {
        setTermTemplates(data.templates);
      }
      setTermsLoaded(true);
    } catch {
      toast.error("Erro ao carregar termos");
    }
  };

  const lookupCnpj = async () => {
    const cnpjClean = form.cnpj.replace(/\D/g, "");
    if (cnpjClean.length !== 14) {
      toast.error("CNPJ deve ter 14 dígitos");
      return;
    }
    setCnpjLoading(true);
    try {
      const res = await fetch(`/api/trpc/cnpj.lookup?input=${encodeURIComponent(JSON.stringify({ cnpj: cnpjClean }))}`);
      const data = await res.json();
      const result = data?.result?.data;
      if (result) {
        setForm((f) => ({
          ...f,
          razaoSocial: result.razaoSocial || f.razaoSocial,
          name: result.nomeFantasia || f.name,
          address: result.logradouro || f.address,
          addressNumber: result.numero || f.addressNumber,
          neighborhood: result.bairro || f.neighborhood,
          city: result.municipio || f.city,
          state: result.uf || f.state,
          cep: result.cep || f.cep,
          email: result.email || f.email,
        }));
        toast.success("Dados do CNPJ carregados!");
      }
    } catch {
      toast.error("Erro ao consultar CNPJ");
    } finally {
      setCnpjLoading(false);
    }
  };

  const formatCnpj = (value: string) => {
    const digits = value.replace(/\D/g, "").slice(0, 14);
    if (digits.length <= 2) return digits;
    if (digits.length <= 5) return `${digits.slice(0,2)}.${digits.slice(2)}`;
    if (digits.length <= 8) return `${digits.slice(0,2)}.${digits.slice(2,5)}.${digits.slice(5)}`;
    if (digits.length <= 12) return `${digits.slice(0,2)}.${digits.slice(2,5)}.${digits.slice(5,8)}/${digits.slice(8)}`;
    return `${digits.slice(0,2)}.${digits.slice(2,5)}.${digits.slice(5,8)}/${digits.slice(8,12)}-${digits.slice(12)}`;
  };

  const formatCpf = (value: string) => {
    const digits = value.replace(/\D/g, "").slice(0, 11);
    if (digits.length <= 3) return digits;
    if (digits.length <= 6) return `${digits.slice(0,3)}.${digits.slice(3)}`;
    if (digits.length <= 9) return `${digits.slice(0,3)}.${digits.slice(3,6)}.${digits.slice(6)}`;
    return `${digits.slice(0,3)}.${digits.slice(3,6)}.${digits.slice(6,9)}-${digits.slice(9)}`;
  };

  const formatPhone = (value: string) => {
    const digits = value.replace(/\D/g, "").slice(0, 11);
    if (digits.length <= 2) return digits;
    if (digits.length <= 7) return `(${digits.slice(0,2)}) ${digits.slice(2)}`;
    return `(${digits.slice(0,2)}) ${digits.slice(2,7)}-${digits.slice(7)}`;
  };

  const canAdvance = () => {
    if (step === 0) {
      return form.name.trim().length > 0 && form.address.trim().length > 0 && form.neighborhood.trim().length > 0;
    }
    if (step === 1) {
      return form.contactName.trim().length > 0 && form.contactRole.trim().length > 0 && form.whatsapp.trim().length > 0 && form.email.trim().length > 0 && parseInt(form.tableCount) > 0 && parseInt(form.seatCount) > 0 && parseInt(form.monthlyCustomers) > 0;
    }
    if (step === 2) return true;
    if (step === 3) {
      const allTemplatesAccepted = termTemplates.length > 0 && termTemplates.every((t) => acceptedTemplateIds.has(t.id));
      return allTemplatesAccepted && form.acceptedByName.trim().length > 0 && form.acceptedByCpf.replace(/\D/g, "").length >= 11;
    }
    if (step === 4) {
      return form.accountEmail.trim().length > 0 && form.accountPassword.length >= 6 && form.accountPassword === form.accountPasswordConfirm;
    }
    return true;
  };

  const handleSubmit = async () => {
    if (!canAdvance()) return;
    setLoading(true);
    try {
      const body = {
        name: form.name.trim(),
        cnpj: form.cnpj.replace(/\D/g, "") || undefined,
        razaoSocial: form.razaoSocial.trim() || undefined,
        address: form.address.trim(),
        neighborhood: form.neighborhood.trim(),
        city: form.city.trim() || undefined,
        state: form.state || undefined,
        cep: form.cep.replace(/\D/g, "") || undefined,
        googleMapsLink: form.googleMapsLink.trim() || undefined,
        instagram: form.instagram.trim() || undefined,
        contactType: form.contactType || undefined,
        contactName: form.contactName.trim(),
        contactRole: form.contactRole.trim(),
        whatsapp: form.whatsapp.replace(/\D/g, ""),
        email: form.email.trim(),
        financialEmail: form.financialEmail.trim() || undefined,
        tableCount: parseInt(form.tableCount) || 0,
        seatCount: parseInt(form.seatCount) || 0,
        monthlyCustomers: parseInt(form.monthlyCustomers) || 0,
        monthlyDrinksSold: parseInt(form.monthlyDrinksSold) || undefined,
        busyDays: form.busyDays.length > 0 ? form.busyDays.join(", ") : undefined,
        busyHours: form.busyHours.trim() || undefined,
        ticketMedio: parseFloat(form.ticketMedio) || undefined,
        excludedCategories: form.excludedCategories.length > 0 ? form.excludedCategories.join(", ") : undefined,
        photoAuthorization: form.photoAuthorization as "sim" | "nao",
        pixKey: form.pixKey.trim() || undefined,
        notes: form.notes.trim() || undefined,
        acceptedByName: form.acceptedByName.trim(),
        acceptedByCpf: form.acceptedByCpf.replace(/\D/g, ""),
        accountEmail: form.accountEmail.trim(),
        accountPassword: form.accountPassword,
        termTemplateIds: termTemplates.filter((t) => t.id !== null).map((t) => t.id),
      };

      const res = await fetch("/api/restaurant-onboarding/submit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error || "Erro ao processar cadastro");
        return;
      }

      setSuccess(true);
      toast.success("Cadastro realizado com sucesso!");
    } catch {
      toast.error("Erro ao processar cadastro. Tente novamente.");
    } finally {
      setLoading(false);
    }
  };

  const steps = [
    { icon: Building2, title: "Dados do Estabelecimento", subtitle: "Identificação e localização" },
    { icon: Users, title: "Dados Operacionais", subtitle: "Contato e operação" },
    { icon: MapPin, title: "Categorias e Preferências", subtitle: "Restrições e configurações" },
    { icon: FileText, title: "Termos de Parceria", subtitle: "Leitura e aceite dos termos" },
    { icon: UserPlus, title: "Criar Conta", subtitle: "Acesso à plataforma" },
  ];

  const inputClass = "mt-1 bg-[hsl(0,0%,11%)] border-[hsl(0,0%,18%)] text-white placeholder:text-[hsl(0,0%,35%)]";
  const labelClass = "text-xs text-[hsl(0,0%,55%)] font-medium";

  if (success) {
    return (
      <div className="min-h-screen w-full flex items-center justify-center" style={{ background: "hsl(0 0% 4%)" }}>
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <div
            className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] rounded-full opacity-[0.05]"
            style={{ background: "radial-gradient(circle, #27d803 0%, transparent 70%)" }}
          />
        </div>
        <div className="relative w-full max-w-md px-6 text-center">
          <img src="/logo-white.png" alt="mesa.ads" className="h-8 mx-auto mb-8" />
          <div className="bg-[hsl(0,0%,7%)] border border-[hsl(0,0%,14%)] rounded-xl p-8">
            <div className="w-16 h-16 rounded-full bg-[#27d803]/10 flex items-center justify-center mx-auto mb-5">
              <CheckCircle2 className="w-8 h-8 text-[#27d803]" />
            </div>
            <h2 className="text-xl font-bold text-white mb-2">Cadastro realizado!</h2>
            <p className="text-sm text-[hsl(0,0%,50%)] mb-6 leading-relaxed">
              Seu restaurante foi cadastrado com sucesso na rede mesa.ads. Agora você pode acessar a plataforma com o email e senha que criou.
            </p>
            <a
              href="/"
              className="inline-flex items-center justify-center w-full h-10 bg-[#27d803] hover:bg-[#22c003] text-black font-semibold rounded-lg text-sm transition-colors"
            >
              Entrar na plataforma
            </a>
          </div>
          <p className="mt-6 text-[11px]" style={{ color: "hsl(0 0% 30%)" }}>
            mesa.ads &copy; {new Date().getFullYear()} &mdash; Plataforma de gestão
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen w-full flex items-center justify-center py-12" style={{ background: "hsl(0 0% 4%)" }}>
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div
          className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] rounded-full opacity-[0.03]"
          style={{ background: "radial-gradient(circle, #27d803 0%, transparent 70%)" }}
        />
      </div>

      <div className="relative w-full max-w-lg px-6">
        <div className="text-center mb-8">
          <img src="/logo-white.png" alt="mesa.ads" className="h-8 mx-auto mb-6" />
          <h1 className="text-2xl font-bold text-white mb-1">Cadastro de Restaurante Parceiro</h1>
          <p className="text-sm text-[hsl(0,0%,50%)]">
            Preencha os dados abaixo para ingressar na rede mesa.ads
          </p>
        </div>

        <div className="flex items-center justify-center gap-1 mb-8 flex-wrap">
          {steps.map((s, i) => (
            <div key={i} className="flex items-center gap-1">
              <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold transition-colors ${
                i < step ? "bg-[#27d803] text-black" :
                i === step ? "bg-[#27d803]/20 text-[#27d803] ring-2 ring-[#27d803]/50" :
                "bg-[hsl(0,0%,11%)] text-[hsl(0,0%,40%)]"
              }`}>
                {i < step ? <Check className="w-4 h-4" /> : i + 1}
              </div>
              {i < steps.length - 1 && (
                <div className={`w-6 sm:w-10 h-0.5 ${i < step ? "bg-[#27d803]" : "bg-[hsl(0,0%,14%)]"}`} />
              )}
            </div>
          ))}
        </div>

        <div className="w-full h-1 rounded-full bg-[hsl(0,0%,11%)] mb-6">
          <div
            className="h-full rounded-full bg-[#27d803] transition-all duration-500"
            style={{ width: `${((step + 1) / steps.length) * 100}%` }}
          />
        </div>

        <div className="bg-[hsl(0,0%,7%)] border border-[hsl(0,0%,14%)] rounded-xl p-6">
          <div className="flex items-center gap-3 mb-5">
            {(() => { const Icon = steps[step].icon; return <Icon className="w-5 h-5 text-[#27d803]" />; })()}
            <div>
              <h2 className="text-sm font-semibold text-white">{steps[step].title}</h2>
              <p className="text-xs text-[hsl(0,0%,45%)]">{steps[step].subtitle}</p>
            </div>
          </div>

          {step === 0 && (
            <div className="space-y-4">
              <div>
                <Label className={labelClass}>Nome do Estabelecimento *</Label>
                <Input value={form.name} onChange={(e) => update("name", e.target.value)} placeholder="Ex: Bar do João" className={inputClass} />
              </div>
              <div>
                <Label className={labelClass}>CNPJ</Label>
                <div className="flex gap-2 mt-1">
                  <Input
                    value={form.cnpj}
                    onChange={(e) => update("cnpj", formatCnpj(e.target.value))}
                    placeholder="00.000.000/0000-00"
                    className="bg-[hsl(0,0%,11%)] border-[hsl(0,0%,18%)] text-white placeholder:text-[hsl(0,0%,35%)] flex-1"
                  />
                  <button
                    type="button"
                    onClick={lookupCnpj}
                    disabled={cnpjLoading}
                    className="px-3 h-9 bg-[hsl(0,0%,14%)] hover:bg-[hsl(0,0%,18%)] text-[hsl(0,0%,70%)] rounded-md text-xs font-medium transition-colors flex items-center gap-1.5 disabled:opacity-50"
                  >
                    {cnpjLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Search className="w-3.5 h-3.5" />}
                    Buscar
                  </button>
                </div>
              </div>
              <div>
                <Label className={labelClass}>Razão Social</Label>
                <Input value={form.razaoSocial} onChange={(e) => update("razaoSocial", e.target.value)} placeholder="Razão social completa" className={inputClass} />
              </div>
              <div className="grid grid-cols-3 gap-3">
                <div className="col-span-2">
                  <Label className={labelClass}>Logradouro *</Label>
                  <Input value={form.address} onChange={(e) => update("address", e.target.value)} placeholder="Rua, Av..." className={inputClass} />
                </div>
                <div>
                  <Label className={labelClass}>N°</Label>
                  <Input value={form.addressNumber} onChange={(e) => update("addressNumber", e.target.value)} placeholder="123" className={inputClass} />
                </div>
              </div>
              <div>
                <Label className={labelClass}>Bairro *</Label>
                <Input value={form.neighborhood} onChange={(e) => update("neighborhood", e.target.value)} placeholder="Bairro" className={inputClass} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label className={labelClass}>Cidade</Label>
                  <Input value={form.city} onChange={(e) => update("city", e.target.value)} placeholder="Cidade" className={inputClass} />
                </div>
                <div>
                  <Label className={labelClass}>UF</Label>
                  <Select value={form.state} onValueChange={(v) => update("state", v)}>
                    <SelectTrigger className="mt-1 bg-[hsl(0,0%,11%)] border-[hsl(0,0%,18%)] text-white">
                      <SelectValue placeholder="UF" />
                    </SelectTrigger>
                    <SelectContent>
                      {STATES.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div>
                <Label className={labelClass}>CEP</Label>
                <Input value={form.cep} onChange={(e) => update("cep", e.target.value)} placeholder="00000-000" className={inputClass} />
              </div>
              <div>
                <Label className={labelClass}>Link Google Maps</Label>
                <Input value={form.googleMapsLink} onChange={(e) => update("googleMapsLink", e.target.value)} placeholder="https://maps.google.com/..." className={inputClass} />
              </div>
              <div>
                <Label className={labelClass}>Instagram</Label>
                <Input value={form.instagram} onChange={(e) => update("instagram", e.target.value)} placeholder="@restaurante" className={inputClass} />
              </div>
            </div>
          )}

          {step === 1 && (
            <div className="space-y-4">
              <div>
                <Label className={labelClass}>Tipo de Contato</Label>
                <Select value={form.contactType} onValueChange={(v) => update("contactType", v)}>
                  <SelectTrigger className="mt-1 bg-[hsl(0,0%,11%)] border-[hsl(0,0%,18%)] text-white">
                    <SelectValue placeholder="Selecione..." />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="proprietario">Proprietário</SelectItem>
                    <SelectItem value="gerente">Gerente</SelectItem>
                    <SelectItem value="marketing">Marketing</SelectItem>
                    <SelectItem value="outro">Outro</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label className={labelClass}>Nome do Contato *</Label>
                  <Input value={form.contactName} onChange={(e) => update("contactName", e.target.value)} placeholder="Nome completo" className={inputClass} />
                </div>
                <div>
                  <Label className={labelClass}>Cargo *</Label>
                  <Input value={form.contactRole} onChange={(e) => update("contactRole", e.target.value)} placeholder="Ex: Gerente" className={inputClass} />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label className={labelClass}>WhatsApp *</Label>
                  <Input value={form.whatsapp} onChange={(e) => update("whatsapp", formatPhone(e.target.value))} placeholder="(00) 00000-0000" className={inputClass} />
                </div>
                <div>
                  <Label className={labelClass}>E-mail *</Label>
                  <Input value={form.email} onChange={(e) => update("email", e.target.value)} placeholder="contato@restaurante.com" className={inputClass} type="email" />
                </div>
              </div>
              <div>
                <Label className={labelClass}>E-mail Financeiro</Label>
                <Input value={form.financialEmail} onChange={(e) => update("financialEmail", e.target.value)} placeholder="financeiro@restaurante.com" className={inputClass} type="email" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label className={labelClass}>Número de Mesas *</Label>
                  <Input value={form.tableCount} onChange={(e) => update("tableCount", e.target.value.replace(/\D/g, ""))} placeholder="Ex: 30" className={inputClass} type="text" inputMode="numeric" />
                </div>
                <div>
                  <Label className={labelClass}>Número de Assentos *</Label>
                  <Input value={form.seatCount} onChange={(e) => update("seatCount", e.target.value.replace(/\D/g, ""))} placeholder="Ex: 120" className={inputClass} type="text" inputMode="numeric" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label className={labelClass}>Clientes/mês *</Label>
                  <Input value={form.monthlyCustomers} onChange={(e) => update("monthlyCustomers", e.target.value.replace(/\D/g, ""))} placeholder="Ex: 3000" className={inputClass} type="text" inputMode="numeric" />
                </div>
                <div>
                  <Label className={labelClass}>Bebidas vendidas/mês</Label>
                  <Input value={form.monthlyDrinksSold} onChange={(e) => update("monthlyDrinksSold", e.target.value.replace(/\D/g, ""))} placeholder="Ex: 5000" className={inputClass} type="text" inputMode="numeric" />
                </div>
              </div>
              <div>
                <Label className={labelClass}>Dias de Maior Movimento</Label>
                <div className="flex flex-wrap gap-2 mt-2">
                  {BUSY_DAYS_OPTIONS.map((day) => (
                    <label
                      key={day}
                      className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium cursor-pointer transition-colors ${
                        form.busyDays.includes(day)
                          ? "bg-[#27d803]/20 text-[#27d803] border border-[#27d803]/30"
                          : "bg-[hsl(0,0%,11%)] text-[hsl(0,0%,55%)] border border-[hsl(0,0%,18%)]"
                      }`}
                    >
                      <Checkbox
                        checked={form.busyDays.includes(day)}
                        onCheckedChange={(checked) => {
                          if (checked) {
                            update("busyDays", [...form.busyDays, day]);
                          } else {
                            update("busyDays", form.busyDays.filter((d) => d !== day));
                          }
                        }}
                        className="hidden"
                      />
                      {day.slice(0, 3)}
                    </label>
                  ))}
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label className={labelClass}>Horários de Pico</Label>
                  <Input value={form.busyHours} onChange={(e) => update("busyHours", e.target.value)} placeholder="Ex: 12h-14h, 19h-22h" className={inputClass} />
                </div>
                <div>
                  <Label className={labelClass}>Ticket Médio (R$)</Label>
                  <Input value={form.ticketMedio} onChange={(e) => update("ticketMedio", e.target.value.replace(/[^\d.,]/g, ""))} placeholder="Ex: 65" className={inputClass} type="text" inputMode="decimal" />
                </div>
              </div>
            </div>
          )}

          {step === 2 && (
            <div className="space-y-4">
              <div>
                <Label className={labelClass}>Categorias Excluídas de Anunciantes</Label>
                <p className="text-[11px] text-[hsl(0,0%,40%)] mb-2">Selecione categorias que você NÃO deseja receber como anunciantes</p>
                <div className="space-y-2">
                  {EXCLUDED_CATEGORIES.map((cat) => (
                    <label
                      key={cat}
                      className={`flex items-center gap-3 px-3 py-2.5 rounded-lg cursor-pointer transition-colors ${
                        form.excludedCategories.includes(cat)
                          ? "bg-red-500/10 border border-red-500/20"
                          : "bg-[hsl(0,0%,11%)] border border-[hsl(0,0%,18%)]"
                      }`}
                    >
                      <Checkbox
                        checked={form.excludedCategories.includes(cat)}
                        onCheckedChange={(checked) => {
                          if (checked) {
                            update("excludedCategories", [...form.excludedCategories, cat]);
                          } else {
                            update("excludedCategories", form.excludedCategories.filter((c) => c !== cat));
                          }
                        }}
                      />
                      <span className={`text-sm ${form.excludedCategories.includes(cat) ? "text-red-400" : "text-[hsl(0,0%,70%)]"}`}>{cat}</span>
                    </label>
                  ))}
                </div>
              </div>
              <div>
                <Label className={labelClass}>Autorização de Fotos</Label>
                <Select value={form.photoAuthorization} onValueChange={(v) => update("photoAuthorization", v)}>
                  <SelectTrigger className="mt-1 bg-[hsl(0,0%,11%)] border-[hsl(0,0%,18%)] text-white">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="sim">Sim, autorizo fotos no estabelecimento</SelectItem>
                    <SelectItem value="nao">Não autorizo fotos</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className={labelClass}>Chave PIX</Label>
                <Input value={form.pixKey} onChange={(e) => update("pixKey", e.target.value)} placeholder="CPF, CNPJ, e-mail, telefone ou chave aleatória" className={inputClass} />
              </div>
              <div>
                <Label className={labelClass}>Observações</Label>
                <Textarea
                  value={form.notes}
                  onChange={(e) => update("notes", e.target.value)}
                  placeholder="Informações adicionais sobre o estabelecimento..."
                  className="mt-1 bg-[hsl(0,0%,11%)] border-[hsl(0,0%,18%)] text-white placeholder:text-[hsl(0,0%,35%)] min-h-[80px]"
                />
              </div>
            </div>
          )}

          {step === 3 && (
            <div className="space-y-4">
              {termTemplates.length === 0 ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="w-5 h-5 animate-spin text-[hsl(0,0%,40%)]" />
                  <span className="ml-2 text-sm text-[hsl(0,0%,50%)]">Carregando termos...</span>
                </div>
              ) : (
                termTemplates.map((tmpl) => (
                  <div key={tmpl.id ?? "default"} className="space-y-2">
                    <div className="flex items-center justify-between">
                      <h3 className="text-sm font-semibold text-white">{tmpl.title}</h3>
                      <span className="text-[10px] text-[hsl(0,0%,40%)] bg-[hsl(0,0%,11%)] px-2 py-0.5 rounded">v{tmpl.version}</span>
                    </div>
                    <div className="bg-[hsl(0,0%,11%)] border border-[hsl(0,0%,18%)] rounded-lg p-4 max-h-[200px] overflow-y-auto">
                      <div
                        className="text-xs text-[hsl(0,0%,60%)] font-sans leading-relaxed prose prose-sm prose-invert max-w-none [&_h1]:text-sm [&_h1]:font-bold [&_h1]:mb-1 [&_h2]:text-xs [&_h2]:font-bold [&_h2]:mb-1 [&_h3]:text-xs [&_h3]:font-semibold [&_p]:mb-1 [&_ul]:list-disc [&_ul]:pl-4 [&_ul]:mb-1 [&_ol]:list-decimal [&_ol]:pl-4 [&_ol]:mb-1 [&_li]:mb-0.5"
                        dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(tmpl.content) }}
                      />
                    </div>
                    <label className="flex items-start gap-3 p-3 rounded-lg bg-[hsl(0,0%,11%)] border border-[hsl(0,0%,18%)] cursor-pointer">
                      <Checkbox
                        checked={acceptedTemplateIds.has(tmpl.id)}
                        onCheckedChange={(checked) => {
                          setAcceptedTemplateIds((prev) => {
                            const next = new Set(prev);
                            if (checked) {
                              next.add(tmpl.id);
                            } else {
                              next.delete(tmpl.id);
                            }
                            return next;
                          });
                        }}
                        className="mt-0.5"
                      />
                      <span className="text-sm text-[hsl(0,0%,70%)]">
                        Li e aceito <span className="text-[#27d803] font-medium">{tmpl.title}</span>
                      </span>
                    </label>
                  </div>
                ))
              )}
              <div>
                <Label className={labelClass}>Nome Completo do Responsável Legal *</Label>
                <Input value={form.acceptedByName} onChange={(e) => update("acceptedByName", e.target.value)} placeholder="Nome completo" className={inputClass} />
              </div>
              <div>
                <Label className={labelClass}>CPF do Responsável Legal *</Label>
                <Input value={form.acceptedByCpf} onChange={(e) => update("acceptedByCpf", formatCpf(e.target.value))} placeholder="000.000.000-00" className={inputClass} />
              </div>
            </div>
          )}

          {step === 4 && (
            <div className="space-y-4">
              <p className="text-sm text-[hsl(0,0%,50%)] mb-2">
                Crie suas credenciais para acessar o portal do restaurante na plataforma mesa.ads.
              </p>
              <div>
                <Label className={labelClass}>E-mail da Conta *</Label>
                <div className="relative mt-1">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[hsl(0,0%,40%)]" />
                  <Input
                    value={form.accountEmail}
                    onChange={(e) => update("accountEmail", e.target.value)}
                    placeholder="seu@email.com"
                    className="bg-[hsl(0,0%,11%)] border-[hsl(0,0%,18%)] text-white placeholder:text-[hsl(0,0%,35%)] pl-10"
                    type="email"
                  />
                </div>
              </div>
              <div>
                <Label className={labelClass}>Senha *</Label>
                <PasswordInput
                  value={form.accountPassword}
                  onChange={(v) => update("accountPassword", v)}
                  placeholder="Mínimo 6 caracteres"
                />
              </div>
              <div>
                <Label className={labelClass}>Confirmar Senha *</Label>
                <PasswordInput
                  value={form.accountPasswordConfirm}
                  onChange={(v) => update("accountPasswordConfirm", v)}
                  placeholder="Repita a senha"
                />
                {form.accountPasswordConfirm && form.accountPassword !== form.accountPasswordConfirm && (
                  <p className="text-xs text-red-400 mt-1">As senhas não coincidem</p>
                )}
              </div>
            </div>
          )}

          <div className="flex items-center justify-between mt-6 pt-4 border-t border-[hsl(0,0%,14%)]">
            {step > 0 ? (
              <button
                onClick={() => setStep(step - 1)}
                className="flex items-center gap-1 px-3 py-1.5 text-sm text-[hsl(0,0%,55%)] hover:text-white transition-colors rounded-md"
              >
                <ChevronLeft className="w-4 h-4" />
                Voltar
              </button>
            ) : (
              <a
                href="/"
                className="flex items-center gap-1 px-3 py-1.5 text-sm text-[hsl(0,0%,55%)] hover:text-white transition-colors rounded-md"
              >
                <ChevronLeft className="w-4 h-4" />
                Início
              </a>
            )}

            {step < 4 ? (
              <button
                onClick={() => {
                  if (step === 2) loadTerms();
                  setStep(step + 1);
                }}
                disabled={!canAdvance()}
                className="flex items-center gap-1 px-4 py-2 bg-[#27d803] hover:bg-[#22c003] text-black font-medium text-sm rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Próximo
                <ChevronRight className="w-4 h-4" />
              </button>
            ) : (
              <button
                onClick={handleSubmit}
                disabled={loading || !canAdvance()}
                className="flex items-center gap-1.5 px-4 py-2 bg-[#27d803] hover:bg-[#22c003] text-black font-medium text-sm rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loading ? (
                  <><Loader2 className="w-4 h-4 animate-spin" /> Processando...</>
                ) : (
                  <><Check className="w-4 h-4" /> Concluir Cadastro</>
                )}
              </button>
            )}
          </div>
        </div>

        <p className="text-center mt-6 text-[11px]" style={{ color: "hsl(0 0% 30%)" }}>
          mesa.ads &copy; {new Date().getFullYear()} &mdash; Plataforma de gestão
        </p>
      </div>
    </div>
  );
}

function PasswordInput({ value, onChange, placeholder }: { value: string; onChange: (v: string) => void; placeholder: string }) {
  const [show, setShow] = useState(false);
  return (
    <div className="relative mt-1">
      <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[hsl(0,0%,40%)]" />
      <Input
        type={show ? "text" : "password"}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="bg-[hsl(0,0%,11%)] border-[hsl(0,0%,18%)] text-white placeholder:text-[hsl(0,0%,35%)] pl-10 pr-10"
      />
      <button
        type="button"
        onClick={() => setShow(!show)}
        className="absolute right-3 top-1/2 -translate-y-1/2 text-[hsl(0,0%,40%)] hover:text-[hsl(0,0%,60%)] transition-colors"
      >
        {show ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
      </button>
    </div>
  );
}
