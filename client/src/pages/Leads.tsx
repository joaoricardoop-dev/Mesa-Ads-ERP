import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import PageContainer from "@/components/PageContainer";
import Confetti from "@/components/Confetti";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  LOCATION_RATING_LABELS,
  VENUE_TYPE_LABELS,
  DIGITAL_PRESENCE_LABELS,
  PRIMARY_DRINK_LABELS,
} from "@shared/rating-config";
import {
  Plus,
  Phone,
  Mail,
  MessageCircle,
  MapPin,
  StickyNote,
  ChevronRight,
  ChevronLeft,
  Building2,
  UtensilsCrossed,
  User,
  Calendar,
  Tag,
  Clock,
  Trash2,
  Pencil,
  Check,
  X,
  Search,
  Loader2,
  Hash,
  ArrowRightCircle,
  AlertTriangle,
  Instagram,
  FileText,
  ChevronsLeftRight,
  Sparkles,
  Zap,
  RotateCcw,
  TrendingUp,
  Calculator,
} from "lucide-react";
import { toast } from "sonner";

const STAGES = [
  { key: "novo", label: "Novo", color: "bg-blue-500/10 text-blue-500 border-blue-500/20" },
  { key: "contato", label: "Contato", color: "bg-yellow-500/10 text-yellow-500 border-yellow-500/20" },
  { key: "qualificado", label: "Qualificado", color: "bg-purple-500/10 text-purple-500 border-purple-500/20" },
  { key: "proposta", label: "Proposta", color: "bg-orange-500/10 text-orange-500 border-orange-500/20" },
  { key: "negociacao", label: "Negociação", color: "bg-cyan-500/10 text-cyan-500 border-cyan-500/20" },
  { key: "ganho", label: "Ganho", color: "bg-green-500/10 text-green-500 border-green-500/20" },
  { key: "perdido", label: "Perdido", color: "bg-red-500/10 text-red-500 border-red-500/20" },
] as const;

const INTERACTION_TYPES = [
  { key: "call", label: "Ligação", icon: Phone },
  { key: "email", label: "E-mail", icon: Mail },
  { key: "whatsapp", label: "WhatsApp", icon: MessageCircle },
  { key: "visit", label: "Visita", icon: MapPin },
  { key: "note", label: "Nota", icon: StickyNote },
];

const ORIGINS = [
  "Indicação",
  "Site",
  "Instagram",
  "LinkedIn",
  "Telefone",
  "Evento",
  "Prospecção Ativa",
  "Outro",
];

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

type LeadType = "anunciante" | "restaurante";

interface LeadFormData {
  type: LeadType;
  name: string;
  company: string;
  cnpj: string;
  razaoSocial: string;
  address: string;
  addressNumber: string;
  neighborhood: string;
  city: string;
  state: string;
  cep: string;
  contactName: string;
  contactPhone: string;
  contactEmail: string;
  contactWhatsApp: string;
  instagram: string;
  origin: string;
  tags: string;
  notes: string;
}

const emptyForm: LeadFormData = {
  type: "anunciante",
  name: "",
  company: "",
  cnpj: "",
  razaoSocial: "",
  address: "",
  addressNumber: "",
  neighborhood: "",
  city: "",
  state: "",
  cep: "",
  contactName: "",
  contactPhone: "",
  contactEmail: "",
  contactWhatsApp: "",
  instagram: "",
  origin: "",
  tags: "",
  notes: "",
};

interface ConvertRestaurantForm {
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

const emptyConvertRestaurantForm: ConvertRestaurantForm = {
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

function formatCnpj(cnpj: string): string {
  const c = cnpj.replace(/\D/g, "");
  if (c.length !== 14) return cnpj;
  return `${c.slice(0,2)}.${c.slice(2,5)}.${c.slice(5,8)}/${c.slice(8,12)}-${c.slice(12)}`;
}

export default function Leads() {
  const [, navigate] = useLocation();
  const [activeTab, setActiveTab] = useState<LeadType>("anunciante");
  const [createOpen, setCreateOpen] = useState(false);
  const [createStep, setCreateStep] = useState<"cnpj" | "form">("form");
  const [cnpjInput, setCnpjInput] = useState("");
  const [cnpjFetched, setCnpjFetched] = useState(false);
  const [formData, setFormData] = useState<LeadFormData>(emptyForm);
  const [selectedLeadId, setSelectedLeadId] = useState<number | null>(null);
  const [interactionType, setInteractionType] = useState("note");
  const [interactionContent, setInteractionContent] = useState("");
  const [isEditing, setIsEditing] = useState(false);
  const [editData, setEditData] = useState<LeadFormData>(emptyForm);

  const [draggedLeadId, setDraggedLeadId] = useState<number | null>(null);
  const [dragOverStage, setDragOverStage] = useState<string | null>(null);

  const [convertOpen, setConvertOpen] = useState(false);
  const [convertForm, setConvertForm] = useState<ConvertRestaurantForm>(emptyConvertRestaurantForm);
  const [convertAnuncianteOpen, setConvertAnuncianteOpen] = useState(false);

  const [quotationOpen, setQuotationOpen] = useState(false);
  const [quotationVolume, setQuotationVolume] = useState("");
  const [quotationNotes, setQuotationNotes] = useState("");
  const [showConfetti, setShowConfetti] = useState(false);
  const [collapsedStages, setCollapsedStages] = useState<string[]>(["ganho", "perdido"]);
  const [simNumRestaurants, setSimNumRestaurants] = useState("10");
  const [simCoastersPerRest, setSimCoastersPerRest] = useState("500");
  const [simUnitCost, setSimUnitCost] = useState("0.12");
  const [simMarkup, setSimMarkup] = useState("80");

  const utils = trpc.useUtils();

  const leadsQuery = trpc.lead.list.useQuery({ type: activeTab });
  const leads = leadsQuery.data ?? [];

  const selectedLead = trpc.lead.get.useQuery(
    { id: selectedLeadId! },
    { enabled: !!selectedLeadId }
  );

  const interactions = trpc.lead.listInteractions.useQuery(
    { leadId: selectedLeadId! },
    { enabled: !!selectedLeadId }
  );

  const leadQuotations = trpc.quotation.list.useQuery(
    { leadId: selectedLeadId! },
    { enabled: !!selectedLeadId }
  );

  const internalUsers = trpc.lead.listUsers.useQuery();

  const cnpjClean = cnpjInput.replace(/\D/g, "");
  const { isFetching: isCnpjLoading, error: cnpjError, refetch: fetchCnpj } = trpc.cnpj.lookup.useQuery(
    { cnpj: cnpjClean },
    { enabled: false, retry: false }
  );

  const createMutation = trpc.lead.create.useMutation({
    onSuccess: () => {
      toast.success("Lead criado com sucesso");
      setCreateOpen(false);
      setFormData(emptyForm);
      setCnpjInput("");
      setCnpjFetched(false);
      setCreateStep("form");
      utils.lead.list.invalidate();
    },
    onError: (err) => toast.error(err.message),
  });

  const changeStageMutation = trpc.lead.changeStage.useMutation({
    onSuccess: () => {
      utils.lead.list.invalidate();
      utils.lead.get.invalidate();
      utils.lead.listInteractions.invalidate();
    },
    onError: (err) => toast.error(err.message),
  });

  const addInteractionMutation = trpc.lead.addInteraction.useMutation({
    onSuccess: () => {
      setInteractionContent("");
      utils.lead.listInteractions.invalidate();
      toast.success("Interação registrada");
    },
    onError: (err) => toast.error(err.message),
  });

  const deleteMutation = trpc.lead.delete.useMutation({
    onSuccess: () => {
      toast.success("Lead removido");
      setSelectedLeadId(null);
      utils.lead.list.invalidate();
    },
    onError: (err) => toast.error(err.message),
  });

  const updateMutation = trpc.lead.update.useMutation({
    onSuccess: () => {
      toast.success("Lead atualizado");
      setIsEditing(false);
      utils.lead.list.invalidate();
      utils.lead.get.invalidate();
    },
    onError: (err) => toast.error(err.message),
  });

  const markLeadConverted = trpc.lead.update.useMutation({
    onSuccess: () => {
      utils.lead.list.invalidate();
      utils.lead.get.invalidate();
    },
  });

  const createActiveMutation = trpc.activeRestaurant.create.useMutation({
    onSuccess: (data) => {
      if (selectedLeadId) {
        markLeadConverted.mutate({
          id: selectedLeadId,
          stage: "ganho",
          convertedToId: data.id,
          convertedToType: "restaurante",
        });
      }
      setConvertOpen(false);
      toast.success("Restaurante convertido para ativo!");
      utils.activeRestaurant.list.invalidate();
    },
    onError: (err: any) => toast.error(`Erro na conversão: ${err.message}`),
  });

  const createClientMutation = trpc.advertiser.create.useMutation({
    onSuccess: (data) => {
      if (selectedLeadId) {
        markLeadConverted.mutate({
          id: selectedLeadId,
          stage: "ganho",
          convertedToId: data.id,
          convertedToType: "anunciante",
        });
      }
      setConvertAnuncianteOpen(false);
      setShowConfetti(true);
      setTimeout(() => setShowConfetti(false), 3000);
      toast.success("Anunciante cadastrado!");
      utils.advertiser.list.invalidate();
    },
    onError: (err: any) => toast.error(`Erro: ${err.message}`),
  });

  const createQuotationMutation = trpc.quotation.create.useMutation({
    onSuccess: (data) => {
      setQuotationOpen(false);
      setQuotationVolume("");
      setQuotationNotes("");
      toast.success(`Cotação ${data.quotationNumber} criada!`, {
        action: {
          label: "Ver cotação",
          onClick: () => navigate(`/comercial/cotacoes/${data.id}`),
        },
      });
      utils.quotation.list.invalidate();
      utils.lead.get.invalidate();
    },
    onError: (err: any) => toast.error(`Erro ao criar cotação: ${err.message}`),
  });

  useEffect(() => {
    if (selectedLead.data && isEditing) {
      setEditData({
        type: selectedLead.data.type as LeadType,
        name: selectedLead.data.name ?? "",
        company: selectedLead.data.company ?? "",
        cnpj: selectedLead.data.cnpj ?? "",
        razaoSocial: selectedLead.data.razaoSocial ?? "",
        address: selectedLead.data.address ?? "",
        addressNumber: selectedLead.data.addressNumber ?? "",
        neighborhood: selectedLead.data.neighborhood ?? "",
        city: selectedLead.data.city ?? "",
        state: selectedLead.data.state ?? "",
        cep: selectedLead.data.cep ?? "",
        contactName: selectedLead.data.contactName ?? "",
        contactPhone: selectedLead.data.contactPhone ?? "",
        contactEmail: selectedLead.data.contactEmail ?? "",
        contactWhatsApp: selectedLead.data.contactWhatsApp ?? "",
        instagram: selectedLead.data.instagram ?? "",
        origin: selectedLead.data.origin ?? "",
        tags: selectedLead.data.tags ?? "",
        notes: selectedLead.data.notes ?? "",
      });
    }
  }, [isEditing, selectedLead.data]);

  async function handleCnpjSearch() {
    if (cnpjClean.length !== 14) {
      toast.error("CNPJ deve ter 14 dígitos");
      return;
    }
    const result = await fetchCnpj();
    if (result.data) {
      const d = result.data;
      setFormData((prev) => ({
        ...prev,
        cnpj: formatCnpj(d.cnpj),
        name: d.nomeFantasia || d.razaoSocial || prev.name,
        company: d.nomeFantasia || prev.company,
        razaoSocial: d.razaoSocial,
        address: d.logradouro,
        addressNumber: d.numero,
        neighborhood: d.bairro,
        city: d.cidade,
        state: d.uf,
        cep: d.cep,
        contactPhone: d.telefone1 || prev.contactPhone,
        contactEmail: d.email || prev.contactEmail,
      }));
      setCnpjFetched(true);
      setCreateStep("form");
      toast.success("Dados do CNPJ carregados!");
    } else if (result.error) {
      toast.error(result.error.message);
    }
  }

  function handleCreate() {
    if (!formData.name.trim()) {
      toast.error("Nome é obrigatório");
      return;
    }
    createMutation.mutate({ ...formData, type: activeTab });
  }

  function handleUpdate() {
    if (!selectedLeadId) return;
    if (!editData.name.trim()) {
      toast.error("Nome é obrigatório");
      return;
    }
    updateMutation.mutate({ id: selectedLeadId, ...editData });
  }

  function startEditing() {
    if (!selectedLead.data) return;
    setIsEditing(true);
  }

  function cancelEditing() {
    setIsEditing(false);
  }

  function moveStage(leadId: number, currentStage: string, direction: "next" | "prev") {
    const idx = STAGES.findIndex((s) => s.key === currentStage);
    if (idx === -1) return;
    const newIdx = direction === "next" ? idx + 1 : idx - 1;
    if (newIdx < 0 || newIdx >= STAGES.length) return;
    changeStageMutation.mutate({ id: leadId, stage: STAGES[newIdx].key });
  }

  function moveToStage(leadId: number, stage: string) {
    changeStageMutation.mutate({ id: leadId, stage });
  }

  function handleDragStart(e: React.DragEvent, leadId: number) {
    setDraggedLeadId(leadId);
    e.dataTransfer.effectAllowed = "move";
    e.dataTransfer.setData("text/plain", String(leadId));
    if (e.currentTarget instanceof HTMLElement) {
      e.currentTarget.style.opacity = "0.5";
    }
  }

  function handleDragEnd(e: React.DragEvent) {
    setDraggedLeadId(null);
    setDragOverStage(null);
    if (e.currentTarget instanceof HTMLElement) {
      e.currentTarget.style.opacity = "1";
    }
  }

  function handleDragOver(e: React.DragEvent, stageKey: string) {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
    if (dragOverStage !== stageKey) {
      setDragOverStage(stageKey);
    }
  }

  function handleDragLeave(e: React.DragEvent, stageKey: string) {
    const relatedTarget = e.relatedTarget as HTMLElement | null;
    const currentTarget = e.currentTarget as HTMLElement;
    if (!relatedTarget || !currentTarget.contains(relatedTarget)) {
      if (dragOverStage === stageKey) {
        setDragOverStage(null);
      }
    }
  }

  function handleDrop(e: React.DragEvent, stageKey: string) {
    e.preventDefault();
    setDragOverStage(null);
    const leadId = parseInt(e.dataTransfer.getData("text/plain"), 10);
    if (!isNaN(leadId)) {
      const lead = leads.find((l) => l.id === leadId);
      if (lead && lead.stage !== stageKey) {
        changeStageMutation.mutate({ id: leadId, stage: stageKey });
      }
    }
    setDraggedLeadId(null);
  }

  function handleAddInteraction() {
    if (!selectedLeadId || !interactionContent.trim()) return;
    addInteractionMutation.mutate({
      leadId: selectedLeadId,
      type: interactionType,
      content: interactionContent,
    });
  }

  function getStageConfig(stage: string) {
    return STAGES.find((s) => s.key === stage) ?? STAGES[0];
  }

  function formatDate(d: string | Date | null | undefined) {
    if (!d) return "—";
    return new Date(d).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "2-digit" });
  }

  function formatDateTime(d: string | Date | null | undefined) {
    if (!d) return "—";
    return new Date(d).toLocaleDateString("pt-BR", {
      day: "2-digit",
      month: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    });
  }

  function openCreateDialog() {
    const newForm = { ...emptyForm, type: activeTab };
    setFormData(newForm);
    setCnpjInput("");
    setCnpjFetched(false);
    setCreateStep("cnpj");
    setCreateOpen(true);
  }

  function handleConvertRestaurant() {
    if (!selectedLead.data) return;
    const lead = selectedLead.data;
    const fullAddress = [lead.address, lead.addressNumber].filter(Boolean).join(", ");
    setConvertForm({
      ...emptyConvertRestaurantForm,
      name: lead.name,
      address: fullAddress,
      neighborhood: lead.neighborhood || "",
      instagram: lead.instagram || "",
      contactName: lead.contactName || "",
      whatsapp: lead.contactWhatsApp || "",
      email: lead.contactEmail || "",
    });
    setConvertOpen(true);
  }

  function handleConvertAnunciante() {
    if (!selectedLead.data) return;
    setConvertAnuncianteOpen(true);
  }

  function handleSubmitConvertRestaurant() {
    if (!convertForm.name || !convertForm.address || !convertForm.neighborhood || !convertForm.contactName || !convertForm.contactRole || !convertForm.whatsapp) {
      toast.error("Preencha todos os campos obrigatórios");
      return;
    }
    if (!convertForm.monthlyDrinksSold || !convertForm.tableCount || !convertForm.ticketMedio || !convertForm.locationRating || !convertForm.venueType || !convertForm.digitalPresence) {
      toast.error("Preencha todos os campos de rating");
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
  }

  function handleSubmitConvertAnunciante() {
    if (!selectedLead.data) return;
    const lead = selectedLead.data;
    createClientMutation.mutate({
      name: lead.name,
      company: lead.company || undefined,
      razaoSocial: lead.razaoSocial || undefined,
      cnpj: lead.cnpj || undefined,
      contactEmail: lead.contactEmail || undefined,
      contactPhone: lead.contactPhone || lead.contactWhatsApp || undefined,
      instagram: lead.instagram || undefined,
      address: lead.address || undefined,
      addressNumber: lead.addressNumber || undefined,
      neighborhood: lead.neighborhood || undefined,
      city: lead.city || undefined,
      state: lead.state || undefined,
      cep: lead.cep || undefined,
    });
  }

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

  const leadsByStage = STAGES.map((stage) => ({
    ...stage,
    leads: leads.filter((l) => l.stage === stage.key),
  }));

  function renderLeadForm(data: LeadFormData, setData: (d: LeadFormData) => void) {
    return (
      <div className="grid gap-3">
        <div className="grid gap-1.5">
          <Label className="text-xs">Nome *</Label>
          <Input
            value={data.name}
            onChange={(e) => setData({ ...data, name: e.target.value })}
            placeholder="Nome do lead"
            className="h-8 text-sm"
          />
        </div>

        <div className="grid grid-cols-2 gap-2">
          <div className="grid gap-1.5">
            <Label className="text-xs">Empresa</Label>
            <Input
              value={data.company}
              onChange={(e) => setData({ ...data, company: e.target.value })}
              placeholder="Nome da empresa"
              className="h-8 text-sm"
            />
          </div>
          <div className="grid gap-1.5">
            <Label className="text-xs">CNPJ</Label>
            <Input
              value={data.cnpj}
              onChange={(e) => setData({ ...data, cnpj: e.target.value })}
              placeholder="00.000.000/0000-00"
              className="h-8 text-sm font-mono"
            />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-2">
          <div className="grid gap-1.5">
            <Label className="text-xs">Contato</Label>
            <Input
              value={data.contactName}
              onChange={(e) => setData({ ...data, contactName: e.target.value })}
              placeholder="Nome do contato"
              className="h-8 text-sm"
            />
          </div>
          <div className="grid gap-1.5">
            <Label className="text-xs">Telefone</Label>
            <Input
              value={data.contactPhone}
              onChange={(e) => setData({ ...data, contactPhone: e.target.value })}
              placeholder="(00) 00000-0000"
              className="h-8 text-sm"
            />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-2">
          <div className="grid gap-1.5">
            <Label className="text-xs">E-mail</Label>
            <Input
              value={data.contactEmail}
              onChange={(e) => setData({ ...data, contactEmail: e.target.value })}
              placeholder="email@exemplo.com"
              className="h-8 text-sm"
            />
          </div>
          <div className="grid gap-1.5">
            <Label className="text-xs">WhatsApp</Label>
            <Input
              value={data.contactWhatsApp}
              onChange={(e) => setData({ ...data, contactWhatsApp: e.target.value })}
              placeholder="(00) 00000-0000"
              className="h-8 text-sm"
            />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-2">
          <div className="grid gap-1.5">
            <Label className="text-xs flex items-center gap-1">
              <Instagram className="w-3 h-3 text-pink-500" />
              Instagram
            </Label>
            <Input
              value={data.instagram}
              onChange={(e) => setData({ ...data, instagram: e.target.value })}
              placeholder="@usuario"
              className="h-8 text-sm"
            />
          </div>
          <div className="grid gap-1.5">
            <Label className="text-xs">Origem</Label>
            <Select
              value={data.origin}
              onValueChange={(v) => setData({ ...data, origin: v })}
            >
              <SelectTrigger className="h-8 text-sm">
                <SelectValue placeholder="Selecione" />
              </SelectTrigger>
              <SelectContent>
                {ORIGINS.map((o) => (
                  <SelectItem key={o} value={o}>{o}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        {data.type === "restaurante" && (
          <>
            <Separator className="my-1" />
            <div className="grid grid-cols-[1fr_80px] gap-2">
              <div className="grid gap-1.5">
                <Label className="text-xs">Endereço</Label>
                <Input
                  value={data.address}
                  onChange={(e) => setData({ ...data, address: e.target.value })}
                  placeholder="Logradouro"
                  className="h-8 text-sm"
                />
              </div>
              <div className="grid gap-1.5">
                <Label className="text-xs">N°</Label>
                <Input
                  value={data.addressNumber}
                  onChange={(e) => setData({ ...data, addressNumber: e.target.value })}
                  placeholder="123"
                  className="h-8 text-sm"
                />
              </div>
            </div>
            <div className="grid grid-cols-3 gap-2">
              <div className="grid gap-1.5">
                <Label className="text-xs">Bairro</Label>
                <Input
                  value={data.neighborhood}
                  onChange={(e) => setData({ ...data, neighborhood: e.target.value })}
                  placeholder="Bairro"
                  className="h-8 text-sm"
                />
              </div>
              <div className="grid gap-1.5">
                <Label className="text-xs">Cidade</Label>
                <Input
                  value={data.city}
                  onChange={(e) => setData({ ...data, city: e.target.value })}
                  placeholder="Cidade"
                  className="h-8 text-sm"
                />
              </div>
              <div className="grid grid-cols-[1fr_50px] gap-1">
                <div className="grid gap-1.5">
                  <Label className="text-xs">CEP</Label>
                  <Input
                    value={data.cep}
                    onChange={(e) => setData({ ...data, cep: e.target.value })}
                    placeholder="00000-000"
                    className="h-8 text-sm"
                  />
                </div>
                <div className="grid gap-1.5">
                  <Label className="text-xs">UF</Label>
                  <Input
                    value={data.state}
                    onChange={(e) => setData({ ...data, state: e.target.value.toUpperCase().slice(0, 2) })}
                    placeholder="UF"
                    className="h-8 text-sm"
                    maxLength={2}
                  />
                </div>
              </div>
            </div>
          </>
        )}

        <div className="grid grid-cols-2 gap-2">
          <div className="grid gap-1.5">
            <Label className="text-xs">Tags</Label>
            <Input
              value={data.tags}
              onChange={(e) => setData({ ...data, tags: e.target.value })}
              placeholder="tag1, tag2"
              className="h-8 text-sm"
            />
          </div>
        </div>

        <div className="grid gap-1.5">
          <Label className="text-xs">Observações</Label>
          <Textarea
            value={data.notes}
            onChange={(e) => setData({ ...data, notes: e.target.value })}
            placeholder="Observações..."
            rows={2}
            className="text-sm"
          />
        </div>
      </div>
    );
  }

  const isConverted = selectedLead.data?.convertedToId != null;

  return (
    <PageContainer
      title="Leads"
      description="CRM e pipeline de vendas"
      actions={
        <Button size="sm" onClick={openCreateDialog}>
          <Plus className="w-4 h-4 mr-1" />
          Novo Lead
        </Button>
      }
    >
      <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as LeadType)}>
        <TabsList>
          <TabsTrigger value="anunciante" className="gap-1.5">
            <Building2 className="w-3.5 h-3.5" />
            Anunciantes
          </TabsTrigger>
          <TabsTrigger value="restaurante" className="gap-1.5">
            <UtensilsCrossed className="w-3.5 h-3.5" />
            Restaurantes
          </TabsTrigger>
        </TabsList>

        <TabsContent value={activeTab} className="mt-4">
          <div className="overflow-x-auto pb-4 -mx-2 px-2">
            <div className="inline-flex gap-3">
              {leadsByStage.map((column) => {
                const isCollapsed = collapsedStages.includes(column.key);
                const toggleCollapse = () => setCollapsedStages((prev) =>
                  prev.includes(column.key) ? prev.filter((s) => s !== column.key) : [...prev, column.key]
                );

                if (isCollapsed) {
                  return (
                    <div
                      key={column.key}
                      className={`w-[44px] shrink-0 rounded-lg cursor-pointer transition-colors hover:bg-muted/50 ${dragOverStage === column.key ? "bg-primary/5 ring-2 ring-primary/30" : "bg-muted/20"}`}
                      onClick={toggleCollapse}
                      onDragOver={(e) => handleDragOver(e, column.key)}
                      onDragLeave={(e) => handleDragLeave(e, column.key)}
                      onDrop={(e) => handleDrop(e, column.key)}
                    >
                      <div className="flex flex-col items-center py-3 gap-2">
                        <Badge variant="outline" className={`text-[9px] px-1 py-0 ${column.color}`}>
                          {column.leads.length}
                        </Badge>
                        <span
                          className="text-[10px] font-medium text-muted-foreground"
                          style={{ writingMode: "vertical-rl", textOrientation: "mixed" }}
                        >
                          {column.label}
                        </span>
                        <ChevronsLeftRight className="w-3 h-3 text-muted-foreground mt-1" />
                      </div>
                    </div>
                  );
                }

                return (
                <div
                  key={column.key}
                  className={`w-[240px] shrink-0 rounded-lg transition-colors ${dragOverStage === column.key ? "bg-primary/5 ring-2 ring-primary/30" : ""}`}
                  onDragOver={(e) => handleDragOver(e, column.key)}
                  onDragLeave={(e) => handleDragLeave(e, column.key)}
                  onDrop={(e) => handleDrop(e, column.key)}
                >
                  <div className="flex items-center gap-2 mb-3 px-1">
                    <Badge variant="outline" className={`text-[10px] px-1.5 py-0 ${column.color}`}>
                      {column.label}
                    </Badge>
                    <span className="text-[10px] text-muted-foreground font-medium">
                      {column.leads.length}
                    </span>
                    {(column.key === "ganho" || column.key === "perdido") && (
                      <button onClick={toggleCollapse} className="ml-auto text-muted-foreground hover:text-foreground transition-colors" title="Minimizar">
                        <ChevronsLeftRight className="w-3 h-3" />
                      </button>
                    )}
                  </div>

                  <div className="space-y-2 min-h-[120px]">
                    {column.leads.map((lead) => (
                      <Card
                        key={lead.id}
                        className={`p-2.5 cursor-grab hover:border-primary/40 transition-all group ${draggedLeadId === lead.id ? "opacity-50 scale-95" : ""}`}
                        draggable
                        onDragStart={(e) => handleDragStart(e, lead.id)}
                        onDragEnd={handleDragEnd}
                        onClick={() => { setSelectedLeadId(lead.id); setIsEditing(false); }}
                      >
                        <div className="min-w-0">
                          <p className="text-xs font-medium truncate leading-tight">{lead.name}</p>
                          {lead.company && (
                            <p className="text-[10px] text-muted-foreground truncate mt-0.5">{lead.company}</p>
                          )}
                        </div>

                        {lead.contactPhone && (
                          <div className="flex items-center gap-1 mt-1.5">
                            <Phone className="w-2.5 h-2.5 text-muted-foreground shrink-0" />
                            <span className="text-[10px] text-muted-foreground truncate">{lead.contactPhone}</span>
                          </div>
                        )}

                        {lead.origin && (
                          <div className="mt-1.5">
                            <Badge variant="secondary" className="text-[9px] h-3.5 px-1">
                              {lead.origin}
                            </Badge>
                          </div>
                        )}

                        {lead.convertedToId && (
                          <div className="mt-1.5">
                            <Badge className="text-[9px] h-3.5 px-1 bg-emerald-500/20 text-emerald-500 border-emerald-500/30">
                              Convertido
                            </Badge>
                          </div>
                        )}

                        {activeTab === "anunciante" && (lead.opportunityType || lead.revenueType) && (
                          <div className="flex flex-wrap gap-1 mt-1.5">
                            {lead.opportunityType === "new" && (
                              <Badge className="text-[9px] h-3.5 px-1 bg-green-500/15 text-green-500 border-green-500/30">New</Badge>
                            )}
                            {lead.opportunityType === "upsell" && (
                              <Badge className="text-[9px] h-3.5 px-1 bg-blue-500/15 text-blue-500 border-blue-500/30">Upsell</Badge>
                            )}
                            {lead.revenueType === "mrr" && (
                              <Badge className="text-[9px] h-3.5 px-1 bg-purple-500/15 text-purple-500 border-purple-500/30">MRR</Badge>
                            )}
                            {lead.revenueType === "oneshot" && (
                              <Badge className="text-[9px] h-3.5 px-1 bg-amber-500/15 text-amber-500 border-amber-500/30">One Shot</Badge>
                            )}
                          </div>
                        )}

                        <div className="flex items-center gap-1.5 mt-1.5 flex-wrap">
                          {(lead.assignedToFirstName || lead.createdByFirstName) && (
                            <div className="flex items-center gap-1" title={`Responsável: ${lead.assignedToFirstName || lead.createdByFirstName} ${lead.assignedToLastName || lead.createdByLastName || ""}`}>
                              <div className="w-4 h-4 rounded-full bg-primary/20 flex items-center justify-center">
                                <span className="text-[8px] font-bold text-primary">
                                  {(lead.assignedToFirstName || lead.createdByFirstName || "?")[0]}
                                </span>
                              </div>
                              <span className="text-[9px] text-muted-foreground truncate max-w-[60px]">
                                {lead.assignedToFirstName || lead.createdByFirstName}
                              </span>
                            </div>
                          )}
                        </div>

                        <div className="flex items-center justify-between mt-1.5 opacity-0 group-hover:opacity-100 transition-opacity">
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-5 w-5"
                            onClick={(e) => { e.stopPropagation(); moveStage(lead.id, lead.stage, "prev"); }}
                            disabled={column.key === "novo"}
                          >
                            <ChevronLeft className="w-3 h-3" />
                          </Button>
                          <span className="text-[9px] text-muted-foreground">
                            {formatDate(lead.updatedAt)}
                          </span>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-5 w-5"
                            onClick={(e) => { e.stopPropagation(); moveStage(lead.id, lead.stage, "next"); }}
                            disabled={column.key === "perdido"}
                          >
                            <ChevronRight className="w-3 h-3" />
                          </Button>
                        </div>
                      </Card>
                    ))}

                    {column.leads.length === 0 && (
                      <div className={`flex items-center justify-center h-[80px] rounded-lg border border-dashed transition-colors ${dragOverStage === column.key ? "border-primary/60 bg-primary/5" : "border-border/40"}`}>
                        <p className="text-[10px] text-muted-foreground">
                          {draggedLeadId ? "Soltar aqui" : "Nenhum lead"}
                        </p>
                      </div>
                    )}
                  </div>
                </div>
                );
              })}
            </div>
          </div>
        </TabsContent>
      </Tabs>

      {/* Create Lead Dialog */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Novo Lead — {activeTab === "anunciante" ? "Anunciante" : "Restaurante"}</DialogTitle>
          </DialogHeader>

          {createStep === "cnpj" && (
            <div className="space-y-4">
              <div className="bg-muted/30 border border-border/30 rounded-lg p-4 space-y-3">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-lg bg-primary/20 flex items-center justify-center">
                    <Hash className="w-4 h-4 text-primary" />
                  </div>
                  <div>
                    <p className="text-sm font-medium">Buscar por CNPJ</p>
                    <p className="text-[10px] text-muted-foreground">Preenche automaticamente com dados da Receita Federal</p>
                  </div>
                </div>

                <div className="flex gap-2">
                  <Input
                    value={cnpjInput}
                    onChange={(e) => setCnpjInput(e.target.value)}
                    placeholder="00.000.000/0000-00"
                    className="font-mono h-9"
                    onKeyDown={(e) => e.key === "Enter" && handleCnpjSearch()}
                  />
                  <Button onClick={handleCnpjSearch} disabled={isCnpjLoading || cnpjClean.length !== 14} className="gap-1 h-9 px-4">
                    {isCnpjLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
                    Buscar
                  </Button>
                </div>

                {cnpjError && (
                  <div className="flex items-center gap-2 p-2 rounded bg-red-500/10 border border-red-500/30 text-red-400 text-xs">
                    <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                    <span>{cnpjError.message}</span>
                  </div>
                )}
              </div>

              <div className="text-center">
                <Button variant="ghost" className="text-xs text-muted-foreground" onClick={() => setCreateStep("form")}>
                  Pular e cadastrar manualmente →
                </Button>
              </div>
            </div>
          )}

          {createStep === "form" && (
            <>
              {cnpjFetched && (
                <div className="flex items-center gap-2 p-2 rounded bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-xs">
                  <Check className="w-3.5 h-3.5 shrink-0" />
                  <span>Dados preenchidos via CNPJ. Revise e complete.</span>
                </div>
              )}
              {!cnpjFetched && (
                <Button variant="ghost" size="sm" className="text-xs w-fit" onClick={() => { setCreateStep("cnpj"); setCnpjFetched(false); }}>
                  ← Voltar para busca CNPJ
                </Button>
              )}
              {renderLeadForm(formData, setFormData)}
              <DialogFooter>
                <Button variant="outline" onClick={() => setCreateOpen(false)}>Cancelar</Button>
                <Button onClick={handleCreate} disabled={createMutation.isPending}>
                  {createMutation.isPending ? "Criando..." : "Criar Lead"}
                </Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* Lead Detail Sheet */}
      <Sheet open={!!selectedLeadId} onOpenChange={(open) => { if (!open) { setSelectedLeadId(null); setIsEditing(false); } }}>
        <SheetContent className="w-full sm:max-w-md overflow-y-auto px-5 pt-6">
          {selectedLead.data && (
            <>
              <SheetHeader className="pb-2">
                <div className="flex items-center justify-between">
                  <SheetTitle className="flex items-center gap-2 text-base">
                    {selectedLead.data.type === "anunciante" ? (
                      <Building2 className="w-4 h-4 shrink-0" />
                    ) : (
                      <UtensilsCrossed className="w-4 h-4 shrink-0" />
                    )}
                    <span className="truncate">{selectedLead.data.name}</span>
                  </SheetTitle>
                  <div className="flex items-center gap-1.5 shrink-0 ml-2">
                    {!isEditing && selectedLead.data.type === "anunciante" && (
                      <Button
                        variant="outline"
                        size="sm"
                        className="gap-1 text-primary border-primary/30 hover:bg-primary/10"
                        onClick={() => {
                          setQuotationVolume("");
                          setQuotationNotes("");
                          setQuotationOpen(true);
                        }}
                      >
                        <FileText className="w-3 h-3" />
                        Cotação
                      </Button>
                    )}
                    {!isEditing && !isConverted && (
                      <Button
                        variant="outline"
                        size="sm"
                        className="gap-1 text-emerald-500 border-emerald-500/30 hover:bg-emerald-500/10"
                        onClick={() => {
                          if (selectedLead.data!.type === "restaurante") handleConvertRestaurant();
                          else handleConvertAnunciante();
                        }}
                      >
                        <ArrowRightCircle className="w-3 h-3" />
                        Converter
                      </Button>
                    )}
                    {isConverted && (
                      <Badge className="bg-emerald-500/20 text-emerald-500 border-emerald-500/30 text-[10px]">
                        Convertido
                      </Badge>
                    )}
                    {!isEditing && (
                      <Button variant="outline" size="sm" className="gap-1" onClick={startEditing}>
                        <Pencil className="w-3 h-3" />
                        Editar
                      </Button>
                    )}
                  </div>
                </div>
              </SheetHeader>

              <div className="mt-8 space-y-8">
                <div className="space-y-3">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Estágio</span>
                    <Badge variant="outline" className={`text-[10px] ${getStageConfig(selectedLead.data.stage).color}`}>
                      {getStageConfig(selectedLead.data.stage).label}
                    </Badge>
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {STAGES.map((stage) => (
                      <Button
                        key={stage.key}
                        variant={selectedLead.data!.stage === stage.key ? "default" : "outline"}
                        size="sm"
                        className="text-[10px] h-6 px-2"
                        onClick={() => moveToStage(selectedLead.data!.id, stage.key)}
                        disabled={selectedLead.data!.stage === stage.key}
                      >
                        {stage.label}
                      </Button>
                    ))}
                  </div>
                </div>

                <Separator />

                <div className="space-y-3">
                  <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Responsável</span>
                  <Select
                    value={selectedLead.data.assignedTo || "none"}
                    onValueChange={(v) => {
                      const val = v === "none" ? null : v;
                      updateMutation.mutate({ id: selectedLead.data!.id, assignedTo: val });
                    }}
                  >
                    <SelectTrigger className="h-8 text-xs">
                      <SelectValue placeholder="Selecionar responsável" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">— Sem responsável</SelectItem>
                      {(internalUsers.data ?? []).map((u) => (
                        <SelectItem key={u.id} value={u.id}>
                          {u.firstName} {u.lastName || ""} {u.role ? `(${u.role})` : ""}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {selectedLead.data.createdByFirstName && (
                    <p className="text-[10px] text-muted-foreground">
                      Criado por: {selectedLead.data.createdByFirstName} {selectedLead.data.createdByLastName || ""}
                    </p>
                  )}
                </div>

                {leadQuotations.data && leadQuotations.data.length > 0 && (
                  <>
                    <Separator />
                    <div className="space-y-3">
                      <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                        Cotações ({leadQuotations.data.length})
                      </span>
                      <div className="space-y-2">
                        {leadQuotations.data.map((q: any) => (
                          <div
                            key={q.id}
                            className="flex items-center justify-between p-2 rounded-lg bg-muted/30 border border-border/30 cursor-pointer hover:bg-muted/50 transition-colors"
                            onClick={() => { setSelectedLeadId(null); navigate(`/comercial/cotacoes/${q.id}`); }}
                          >
                            <div className="min-w-0">
                              <p className="text-xs font-medium">{q.quotationNumber}</p>
                              <p className="text-[10px] text-muted-foreground truncate">{q.quotationName}</p>
                            </div>
                            <div className="flex items-center gap-2 shrink-0">
                              {q.totalValue && (
                                <span className="text-[10px] font-mono text-muted-foreground">
                                  R$ {parseFloat(q.totalValue).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                                </span>
                              )}
                              <Badge variant="outline" className={`text-[9px] px-1 ${
                                q.status === "win" ? "bg-emerald-500/10 text-emerald-500 border-emerald-500/30" :
                                q.status === "perdida" ? "bg-red-500/10 text-red-500 border-red-500/30" :
                                "bg-muted text-muted-foreground"
                              }`}>
                                {q.status}
                              </Badge>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </>
                )}

                {selectedLead.data.type === "anunciante" && (
                  <>
                    <Separator />
                    <div className="space-y-3">
                      <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Classificação</span>
                      <div className="grid grid-cols-2 gap-3">
                        <div className="space-y-1.5">
                          <Label className="text-[10px] text-muted-foreground">Tipo</Label>
                          <Select
                            value={selectedLead.data.opportunityType || "none"}
                            onValueChange={(v) => {
                              const val = v === "none" ? null : v;
                              updateMutation.mutate({ id: selectedLead.data!.id, opportunityType: val as any });
                            }}
                          >
                            <SelectTrigger className="h-8 text-xs">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="none">—</SelectItem>
                              <SelectItem value="new">
                                <span className="flex items-center gap-1.5"><Sparkles className="w-3 h-3 text-green-500" /> New</span>
                              </SelectItem>
                              <SelectItem value="upsell">
                                <span className="flex items-center gap-1.5"><TrendingUp className="w-3 h-3 text-blue-500" /> Upsell</span>
                              </SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="space-y-1.5">
                          <Label className="text-[10px] text-muted-foreground">Receita</Label>
                          <Select
                            value={selectedLead.data.revenueType || "none"}
                            onValueChange={(v) => {
                              const val = v === "none" ? null : v;
                              updateMutation.mutate({ id: selectedLead.data!.id, revenueType: val as any });
                            }}
                          >
                            <SelectTrigger className="h-8 text-xs">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="none">—</SelectItem>
                              <SelectItem value="mrr">
                                <span className="flex items-center gap-1.5"><RotateCcw className="w-3 h-3 text-purple-500" /> MRR</span>
                              </SelectItem>
                              <SelectItem value="oneshot">
                                <span className="flex items-center gap-1.5"><Zap className="w-3 h-3 text-amber-500" /> One Shot</span>
                              </SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                      </div>
                    </div>
                  </>
                )}

                <Separator />

                {isEditing ? (
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Editar Informações</span>
                    </div>
                    {renderLeadForm(editData, setEditData)}
                    <div className="flex items-center gap-2 pt-2">
                      <Button size="sm" className="gap-1 flex-1" onClick={handleUpdate} disabled={updateMutation.isPending}>
                        <Check className="w-3 h-3" />
                        {updateMutation.isPending ? "Salvando..." : "Salvar"}
                      </Button>
                      <Button variant="outline" size="sm" className="gap-1" onClick={cancelEditing}>
                        <X className="w-3 h-3" />
                        Cancelar
                      </Button>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-3">
                    <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Informações</span>
                    <div className="grid gap-1.5 text-sm">
                      {selectedLead.data.company && (
                        <div className="flex items-center gap-2">
                          <Building2 className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                          <span className="truncate">{selectedLead.data.company}</span>
                        </div>
                      )}
                      {selectedLead.data.cnpj && (
                        <div className="flex items-center gap-2">
                          <Hash className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                          <span className="truncate font-mono text-xs">{selectedLead.data.cnpj}</span>
                        </div>
                      )}
                      {selectedLead.data.contactName && (
                        <div className="flex items-center gap-2">
                          <User className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                          <span className="truncate">{selectedLead.data.contactName}</span>
                        </div>
                      )}
                      {selectedLead.data.contactPhone && (
                        <div className="flex items-center gap-2">
                          <Phone className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                          <span className="truncate">{selectedLead.data.contactPhone}</span>
                        </div>
                      )}
                      {selectedLead.data.contactEmail && (
                        <div className="flex items-center gap-2">
                          <Mail className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                          <span className="truncate">{selectedLead.data.contactEmail}</span>
                        </div>
                      )}
                      {selectedLead.data.contactWhatsApp && (
                        <div className="flex items-center gap-2">
                          <MessageCircle className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                          <span className="truncate">{selectedLead.data.contactWhatsApp}</span>
                        </div>
                      )}
                      {selectedLead.data.instagram && (
                        <div className="flex items-center gap-2">
                          <Instagram className="w-3.5 h-3.5 text-pink-500 shrink-0" />
                          <span className="truncate">{selectedLead.data.instagram}</span>
                        </div>
                      )}
                      {(selectedLead.data.address || selectedLead.data.neighborhood) && (
                        <div className="flex items-center gap-2">
                          <MapPin className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                          <span className="truncate text-xs">
                            {[selectedLead.data.address, selectedLead.data.addressNumber].filter(Boolean).join(", ")}
                            {selectedLead.data.neighborhood ? ` — ${selectedLead.data.neighborhood}` : ""}
                            {selectedLead.data.city ? `, ${selectedLead.data.city}` : ""}
                            {selectedLead.data.state ? `/${selectedLead.data.state}` : ""}
                          </span>
                        </div>
                      )}
                      {selectedLead.data.origin && (
                        <div className="flex items-center gap-2">
                          <Tag className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                          <span className="truncate">{selectedLead.data.origin}</span>
                        </div>
                      )}
                      {selectedLead.data.tags && (
                        <div className="flex items-center gap-2">
                          <Tag className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                          <div className="flex flex-wrap gap-1">
                            {selectedLead.data.tags.split(",").map((t, i) => (
                              <Badge key={i} variant="secondary" className="text-[10px] h-4">{t.trim()}</Badge>
                            ))}
                          </div>
                        </div>
                      )}
                      {selectedLead.data.nextFollowUp && (
                        <div className="flex items-center gap-2">
                          <Calendar className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                          <span>Follow-up: {formatDate(selectedLead.data.nextFollowUp)}</span>
                        </div>
                      )}
                    </div>

                    {selectedLead.data.notes && (
                      <div className="mt-2 p-2 rounded bg-muted/30 text-xs text-muted-foreground whitespace-pre-wrap">
                        {selectedLead.data.notes}
                      </div>
                    )}

                    {!selectedLead.data.company && !selectedLead.data.contactName && !selectedLead.data.contactPhone && !selectedLead.data.contactEmail && (
                      <p className="text-xs text-muted-foreground italic">Nenhuma informação adicional. Clique em Editar para completar.</p>
                    )}
                  </div>
                )}

                <Separator />

                <div className="space-y-3">
                  <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Nova Interação</span>
                  <div className="flex gap-2">
                    <Select value={interactionType} onValueChange={setInteractionType}>
                      <SelectTrigger className="w-[130px] h-8 text-xs">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {INTERACTION_TYPES.map((t) => (
                          <SelectItem key={t.key} value={t.key}>
                            <span className="flex items-center gap-1.5">
                              <t.icon className="w-3 h-3" />
                              {t.label}
                            </span>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="flex gap-2 items-end">
                    <Textarea
                      value={interactionContent}
                      onChange={(e) => setInteractionContent(e.target.value)}
                      placeholder="Descreva a interação..."
                      rows={2}
                      className="flex-1 text-sm"
                    />
                    <Button
                      size="sm"
                      className="h-8"
                      onClick={handleAddInteraction}
                      disabled={!interactionContent.trim() || addInteractionMutation.isPending}
                    >
                      Salvar
                    </Button>
                  </div>
                </div>

                <Separator />

                <div className="space-y-3">
                  <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Histórico</span>
                  <ScrollArea className="max-h-[250px]">
                    <div className="space-y-2.5">
                      {interactions.data?.map((interaction) => {
                        const typeConfig = INTERACTION_TYPES.find((t) => t.key === interaction.type);
                        const Icon = typeConfig?.icon ?? StickyNote;
                        return (
                          <div key={interaction.id} className="flex gap-2.5 text-sm">
                            <div className="shrink-0 w-6 h-6 rounded-full bg-muted flex items-center justify-center mt-0.5">
                              <Icon className="w-3 h-3 text-muted-foreground" />
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-1.5">
                                <span className="font-medium text-[10px]">{typeConfig?.label ?? interaction.type}</span>
                                <span className="text-[9px] text-muted-foreground flex items-center gap-0.5">
                                  <Clock className="w-2.5 h-2.5" />
                                  {formatDateTime(interaction.createdAt)}
                                </span>
                              </div>
                              {interaction.content && (
                                <p className="text-[11px] text-muted-foreground mt-0.5 whitespace-pre-wrap break-words">
                                  {interaction.content}
                                </p>
                              )}
                            </div>
                          </div>
                        );
                      })}

                      {(!interactions.data || interactions.data.length === 0) && (
                        <p className="text-xs text-muted-foreground text-center py-4">
                          Nenhuma interação registrada
                        </p>
                      )}
                    </div>
                  </ScrollArea>
                </div>

                <Separator />

                <div className="flex justify-end pb-6">
                  <Button
                    variant="destructive"
                    size="sm"
                    className="text-xs h-7"
                    onClick={() => {
                      if (confirm("Tem certeza que deseja remover este lead?")) {
                        deleteMutation.mutate({ id: selectedLead.data!.id });
                      }
                    }}
                  >
                    <Trash2 className="w-3 h-3 mr-1" />
                    Remover Lead
                  </Button>
                </div>
              </div>
            </>
          )}

          {selectedLead.isLoading && (
            <div className="flex items-center justify-center py-20">
              <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
            </div>
          )}
        </SheetContent>
      </Sheet>

      {/* Convert to Active Restaurant Dialog */}
      <Dialog open={convertOpen} onOpenChange={setConvertOpen}>
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
            <Button variant="outline" onClick={() => setConvertOpen(false)}>Cancelar</Button>
            <Button
              onClick={handleSubmitConvertRestaurant}
              disabled={createActiveMutation.isPending || !convertForm.name || !convertForm.address || !convertForm.neighborhood || !convertForm.contactName || !convertForm.contactRole || !convertForm.whatsapp || !convertForm.monthlyDrinksSold || !convertForm.tableCount || !convertForm.ticketMedio || !convertForm.locationRating || !convertForm.venueType || !convertForm.digitalPresence}
              className="gap-2 bg-emerald-600 hover:bg-emerald-700"
            >
              <UtensilsCrossed className="w-4 h-4" />
              Converter para Ativo
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Convert to Anunciante Dialog */}
      <Dialog open={convertAnuncianteOpen} onOpenChange={setConvertAnuncianteOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <ArrowRightCircle className="w-5 h-5 text-emerald-400" />
              Converter para Anunciante
            </DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            Cadastrar <strong>{selectedLead.data?.name}</strong> como anunciante no sistema com os dados do lead.
          </p>
          {selectedLead.data && (
            <div className="space-y-2 text-sm bg-muted/30 rounded-lg p-3">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Nome:</span>
                <span className="font-medium">{selectedLead.data.name}</span>
              </div>
              {selectedLead.data.company && (
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Empresa:</span>
                  <span>{selectedLead.data.company}</span>
                </div>
              )}
              {selectedLead.data.cnpj && (
                <div className="flex justify-between">
                  <span className="text-muted-foreground">CNPJ:</span>
                  <span className="font-mono text-xs">{selectedLead.data.cnpj}</span>
                </div>
              )}
              {selectedLead.data.contactEmail && (
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Email:</span>
                  <span>{selectedLead.data.contactEmail}</span>
                </div>
              )}
              {selectedLead.data.contactPhone && (
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Telefone:</span>
                  <span>{selectedLead.data.contactPhone}</span>
                </div>
              )}
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setConvertAnuncianteOpen(false)}>Cancelar</Button>
            <Button
              onClick={handleSubmitConvertAnunciante}
              disabled={createClientMutation.isPending}
              className="gap-2 bg-emerald-600 hover:bg-emerald-700"
            >
              <Building2 className="w-4 h-4" />
              {createClientMutation.isPending ? "Cadastrando..." : "Cadastrar Anunciante"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      {/* Create Quotation from Lead Dialog — Mini-Simulator */}
      <Dialog open={quotationOpen} onOpenChange={setQuotationOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Calculator className="w-5 h-5 text-primary" />
              Nova Cotação
            </DialogTitle>
          </DialogHeader>

          {selectedLead.data && (
            <div className="space-y-1 text-sm bg-muted/30 rounded-lg p-3">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Lead:</span>
                <span className="font-medium">{selectedLead.data.name}</span>
              </div>
              {selectedLead.data.company && (
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Empresa:</span>
                  <span>{selectedLead.data.company}</span>
                </div>
              )}
              {isConverted && (
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Vínculo:</span>
                  <Badge className="bg-emerald-500/20 text-emerald-500 border-emerald-500/30 text-[10px]">Anunciante cadastrado</Badge>
                </div>
              )}
            </div>
          )}

          {(() => {
            const nRest = parseInt(simNumRestaurants) || 0;
            const cPerR = parseInt(simCoastersPerRest) || 0;
            const totalVol = nRest * cPerR;
            const unitCost = parseFloat(simUnitCost) || 0;
            const markup = parseFloat(simMarkup) || 0;
            const unitPrice = unitCost * (1 + markup / 100);
            const totalValue = totalVol * unitPrice;
            const grossMargin = unitPrice > 0 ? ((unitPrice - unitCost) / unitPrice) * 100 : 0;

            return (
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label className="text-[10px] text-muted-foreground">Nº Restaurantes</Label>
                    <Input type="number" min={1} value={simNumRestaurants} onChange={(e) => setSimNumRestaurants(e.target.value)} className="h-8 text-sm" />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-[10px] text-muted-foreground">Bolachas/Restaurante</Label>
                    <Input type="number" min={1} value={simCoastersPerRest} onChange={(e) => setSimCoastersPerRest(e.target.value)} className="h-8 text-sm" />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label className="text-[10px] text-muted-foreground">Custo Unitário (R$)</Label>
                    <Input type="number" step="0.01" min={0} value={simUnitCost} onChange={(e) => setSimUnitCost(e.target.value)} className="h-8 text-sm font-mono" />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-[10px] text-muted-foreground">Markup (%)</Label>
                    <Input type="number" min={0} value={simMarkup} onChange={(e) => setSimMarkup(e.target.value)} className="h-8 text-sm font-mono" />
                  </div>
                </div>

                <div className="bg-muted/40 border border-border/30 rounded-lg p-3 grid grid-cols-2 gap-y-2 gap-x-4">
                  <div>
                    <p className="text-[10px] text-muted-foreground">Volume Total</p>
                    <p className="text-sm font-semibold font-mono">{totalVol.toLocaleString("pt-BR")}</p>
                  </div>
                  <div>
                    <p className="text-[10px] text-muted-foreground">Preço Unitário</p>
                    <p className="text-sm font-semibold font-mono text-primary">R$ {unitPrice.toFixed(2)}</p>
                  </div>
                  <div>
                    <p className="text-[10px] text-muted-foreground">Valor Total</p>
                    <p className="text-sm font-semibold font-mono">R$ {totalValue.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</p>
                  </div>
                  <div>
                    <p className="text-[10px] text-muted-foreground">Margem Bruta</p>
                    <p className={`text-sm font-semibold font-mono ${grossMargin >= 30 ? "text-emerald-500" : grossMargin >= 15 ? "text-amber-500" : "text-red-500"}`}>{grossMargin.toFixed(1)}%</p>
                  </div>
                </div>

                <div className="space-y-1.5">
                  <Label className="text-[10px] text-muted-foreground">Observações</Label>
                  <Textarea
                    value={quotationNotes}
                    onChange={(e) => setQuotationNotes(e.target.value)}
                    placeholder="Detalhes adicionais..."
                    rows={2}
                    className="text-sm"
                  />
                </div>

                <DialogFooter className="flex-col gap-2 sm:flex-row">
                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-xs text-muted-foreground"
                    onClick={() => {
                      setQuotationOpen(false);
                      const clientId = selectedLead.data?.convertedToId;
                      navigate(clientId ? `/comercial/simulador?clientId=${clientId}` : "/comercial/simulador");
                    }}
                  >
                    Simulador completo →
                  </Button>
                  <div className="flex gap-2">
                    <Button variant="outline" onClick={() => setQuotationOpen(false)}>Cancelar</Button>
                    <Button
                      onClick={() => {
                        if (totalVol < 1) { toast.error("Volume deve ser maior que zero"); return; }
                        const lead = selectedLead.data!;
                        createQuotationMutation.mutate({
                          ...(isConverted && lead.convertedToId ? { clientId: lead.convertedToId } : {}),
                          leadId: lead.id,
                          coasterVolume: totalVol,
                          unitPrice: unitPrice.toFixed(2),
                          totalValue: totalValue.toFixed(2),
                          notes: quotationNotes
                            ? `${nRest} restaurantes, ${cPerR} bol/rest, custo R$${unitCost.toFixed(2)}, markup ${markup}% | ${quotationNotes}`
                            : `${nRest} restaurantes, ${cPerR} bol/rest, custo R$${unitCost.toFixed(2)}, markup ${markup}%`,
                        });
                      }}
                      disabled={createQuotationMutation.isPending}
                    >
                      {createQuotationMutation.isPending ? "Criando..." : "Criar Cotação"}
                    </Button>
                  </div>
                </DialogFooter>
              </div>
            );
          })()}
        </DialogContent>
      </Dialog>
      <Confetti active={showConfetti} />
    </PageContainer>
  );
}
