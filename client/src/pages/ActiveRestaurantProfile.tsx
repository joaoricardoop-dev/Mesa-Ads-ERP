import { useState, useMemo, useRef } from "react";
import { useRoute, useLocation } from "wouter";
import DOMPurify from "dompurify";

import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import { formatCurrency } from "@/lib/format";
import { calcularRating, temCamposRatingCompletos } from "@shared/rating";
import { calcTelaImpressions, TELAS_INSERCOES } from "@/hooks/useBudgetCalculator";
import {
  LOCATION_RATING_LABELS,
  VENUE_TYPE_LABELS,
  DIGITAL_PRESENCE_LABELS,
  PRIMARY_DRINK_LABELS,
  RATING_DIMENSION_LABELS,
} from "@shared/rating-config";
import RestaurantAvatar from "@/components/RestaurantAvatar";
import AvatarCropDialog from "@/components/AvatarCropDialog";
import {
  ArrowLeft,
  Pencil,
  MapPin,
  Phone,
  Instagram,
  Mail,
  Globe,
  Users,
  BarChart3,
  Megaphone,
  DollarSign,
  Camera,
  Clock,
  Building2,
  ExternalLink,
  CreditCard,
  Calendar,
  Package,
  Eye,
  TrendingUp,
  Banknote,
  Target,
  ShieldCheck,
  Plus,
  Trash2,
  Link2,
  Unlink,
  CheckCircle,
  CheckCircle2,
  Copy,
  AlertTriangle,
  MessageCircle,
  Store,
  Hash,
  FileText,
  Armchair,
  UtensilsCrossed,
  Star,
  Wine,
  Send,
  Upload,
  Image,
  Loader2,
} from "lucide-react";

const STATUS_LABELS: Record<string, string> = {
  draft: "Rascunho", quotation: "Cotação", active: "Ativa",
  paused: "Pausada", completed: "Concluída", archived: "Arquivada",
};

const STATUS_COLORS: Record<string, string> = {
  draft: "bg-muted text-muted-foreground",
  quotation: "bg-orange-500/20 text-orange-400 border-orange-500/30",
  active: "bg-emerald-500/20 text-emerald-400 border-emerald-500/30",
  paused: "bg-yellow-500/20 text-yellow-400 border-yellow-500/30",
  completed: "bg-blue-500/20 text-blue-400 border-blue-500/30",
  archived: "bg-gray-500/20 text-gray-400 border-gray-500/30",
};

const PAYMENT_STATUS_LABELS: Record<string, string> = {
  pending: "Pendente", paid: "Pago", overdue: "Atrasado", cancelled: "Cancelado",
};

const PAYMENT_STATUS_COLORS: Record<string, string> = {
  pending: "bg-yellow-500/20 text-yellow-400 border-yellow-500/30",
  paid: "bg-emerald-500/20 text-emerald-400 border-emerald-500/30",
  overdue: "bg-red-500/20 text-red-400 border-red-500/30",
  cancelled: "bg-gray-500/20 text-gray-400 border-gray-500/30",
};

const SOCIAL_CLASS_LABELS: Record<string, string> = {
  AA: "Classe AA", A: "Classe A", B: "Classe B", C: "Classe C", D: "Classe D", E: "Classe E",
  misto_ab: "Misto (A/B)", misto_bc: "Misto (B/C)", nao_sei: "Não sei",
};

function parseSocialClass(value: string): string[] {
  if (!value) return [];
  try { const parsed = JSON.parse(value); if (Array.isArray(parsed)) return parsed; } catch {}
  return [value];
}

function formatSocialClass(value: string): string {
  const classes = parseSocialClass(value);
  if (classes.length === 0) return "—";
  return classes.map(c => SOCIAL_CLASS_LABELS[c] || c).join(", ");
}

const CONTACT_TYPE_LABELS: Record<string, string> = {
  proprietario: "Proprietário", gerente: "Gerente", marketing: "Marketing", outro: "Outro",
};

function calcRestaurantRevenue(c: any) {
  const coasters = c.coastersCount || c.coastersPerRestaurant || 500;
  const unitCost = Number(c.batchCost) / c.batchSize;
  const productionCost = coasters * unitCost;
  const sellerRate = Number(c.sellerCommission) / 100;
  const taxRate = Number(c.taxRate) / 100;
  const restCommFixed = c.commissionType === "fixed" ? Number(c.fixedCommission) * coasters : 0;
  const custoPD = productionCost + restCommFixed;
  const restVarRate = c.commissionType === "variable" ? Number(c.restaurantCommission) / 100 : 0;
  const totalVarRate = sellerRate + taxRate + restVarRate;
  const denom = 1 - totalVarRate;
  const custoBruto = denom > 0 ? custoPD / denom : custoPD;
  let sellingPrice: number;
  if (c.pricingType === "fixed") {
    sellingPrice = custoBruto + Number(c.fixedPrice);
  } else {
    sellingPrice = custoBruto * (1 + Number(c.markupPercent) / 100);
  }
  const restComm = c.commissionType === "fixed"
    ? Number(c.fixedCommission) * coasters
    : sellingPrice * (Number(c.restaurantCommission) / 100);
  const spotSecondsFromUsage: 15 | 30 = (c.usagePerDay || 0) === TELAS_INSERCOES[15] ? 15 : 30;
  const impressions = c.productTipo === "telas"
    ? calcTelaImpressions(spotSecondsFromUsage, c.restaurantMonthlyCustomers ?? 0, c.daysPerMonth || 26)
    : coasters * (c.usagePerDay || 3) * (c.daysPerMonth || 26);
  return { sellingPrice, restComm, impressions, productionCost };
}

export default function ActiveRestaurantProfile() {
  const [, navigate] = useLocation();
  const [match, params] = useRoute("/restaurantes/perfil/:id");
  const restaurantId = match ? parseInt(params!.id) : 0;

  const [isPaymentDialogOpen, setIsPaymentDialogOpen] = useState(false);
  const [isPhotoDialogOpen, setIsPhotoDialogOpen] = useState(false);
  const [isBranchDialogOpen, setIsBranchDialogOpen] = useState(false);
  const [isTermDialogOpen, setIsTermDialogOpen] = useState(false);
  const [editingTermId, setEditingTermId] = useState<number | null>(null);
  const [paymentForm, setPaymentForm] = useState({ campaignId: "", amount: "", referenceMonth: "", paymentDate: "", status: "pending", notes: "" });
  const [photoForm, setPhotoForm] = useState({ url: "", caption: "", photoType: "veiculacao" });
  const [termForm, setTermForm] = useState({ conditions: "", remunerationRule: "", allowedCategories: "", blockedCategories: "", restaurantObligations: "", mesaObligations: "", validFrom: "", validUntil: "" });
  const [selectedBranch, setSelectedBranch] = useState("");
  const [editingCommission, setEditingCommission] = useState(false);
  const [commissionValue, setCommissionValue] = useState("");
  const [isLinkUserDialogOpen, setIsLinkUserDialogOpen] = useState(false);
  const [selectedUserId, setSelectedUserId] = useState("");
  const [contactDialogOpen, setContactDialogOpen] = useState(false);
  const [editingContactId, setEditingContactId] = useState<number | null>(null);
  const [contactForm, setContactForm] = useState({ name: "", email: "", phone: "", notes: "", isPrimary: false });

  const utils = trpc.useUtils();
  const { data: restaurant, isLoading } = trpc.activeRestaurant.get.useQuery({ id: restaurantId }, { enabled: restaurantId > 0 });
  const { data: campaignsData = [] } = trpc.activeRestaurant.getCampaigns.useQuery({ restaurantId }, { enabled: restaurantId > 0 });
  const { data: photos = [] } = trpc.activeRestaurant.getPhotos.useQuery({ restaurantId }, { enabled: restaurantId > 0 });
  const { data: payments = [] } = trpc.activeRestaurant.getPayments.useQuery({ restaurantId }, { enabled: restaurantId > 0 });
  const { data: allRestaurants = [] } = trpc.activeRestaurant.list.useQuery();
  const { data: terms = [] } = trpc.term.list.useQuery({ restaurantId }, { enabled: restaurantId > 0 });
  const { data: termAcceptances = [] } = trpc.term.listAcceptances.useQuery({ restaurantId }, { enabled: restaurantId > 0 });
  const { data: linkedUsers = [] } = trpc.activeRestaurant.getLinkedUsers.useQuery({ restaurantId }, { enabled: restaurantId > 0 });
  const { data: availableUsers = [] } = trpc.activeRestaurant.listAvailableUsers.useQuery(undefined, { enabled: isLinkUserDialogOpen });
  const { data: contactsList = [] } = trpc.contact.list.useQuery({ restaurantId }, { enabled: restaurantId > 0 });

  const createContactMutation = trpc.contact.create.useMutation({
    onSuccess: () => { toast.success("Contato criado!"); utils.contact.list.invalidate({ restaurantId }); setContactDialogOpen(false); },
    onError: (e: any) => toast.error(e.message),
  });
  const updateContactMutation = trpc.contact.update.useMutation({
    onSuccess: () => { toast.success("Contato atualizado!"); utils.contact.list.invalidate({ restaurantId }); setContactDialogOpen(false); setEditingContactId(null); },
    onError: (e: any) => toast.error(e.message),
  });
  const deleteContactMutation = trpc.contact.delete.useMutation({
    onSuccess: () => { toast.success("Contato removido!"); utils.contact.list.invalidate({ restaurantId }); },
    onError: (e: any) => toast.error(e.message),
  });

  const branches = useMemo(() =>
    allRestaurants.filter(r => r.parentRestaurantId === restaurantId),
    [allRestaurants, restaurantId]
  );

  const parentRestaurant = useMemo(() =>
    restaurant?.parentRestaurantId ? allRestaurants.find(r => r.id === restaurant.parentRestaurantId) : null,
    [restaurant, allRestaurants]
  );

  const availableForBranch = useMemo(() =>
    allRestaurants.filter(r => r.id !== restaurantId && !r.parentRestaurantId && !branches.find(b => b.id === r.id)),
    [allRestaurants, restaurantId, branches]
  );

  const updateCommissionMutation = trpc.activeRestaurant.update.useMutation({
    onSuccess: () => {
      utils.activeRestaurant.get.invalidate({ id: restaurantId });
      utils.activeRestaurant.list.invalidate();
      setEditingCommission(false);
      toast.success("Comissão atualizada!");
    },
    onError: (err) => toast.error(err.message),
  });

  const addPaymentMutation = trpc.activeRestaurant.addPayment.useMutation({
    onSuccess: () => { utils.activeRestaurant.getPayments.invalidate(); setIsPaymentDialogOpen(false); toast.success("Pagamento registrado!"); },
    onError: (err) => toast.error(err.message),
  });

  const deletePaymentMutation = trpc.activeRestaurant.deletePayment.useMutation({
    onSuccess: () => { utils.activeRestaurant.getPayments.invalidate(); toast.success("Pagamento removido!"); },
  });

  const updatePaymentMutation = trpc.activeRestaurant.updatePayment.useMutation({
    onSuccess: () => { utils.activeRestaurant.getPayments.invalidate(); toast.success("Pagamento atualizado!"); },
  });

  const addPhotoMutation = trpc.activeRestaurant.addPhoto.useMutation({
    onSuccess: () => { utils.activeRestaurant.getPhotos.invalidate(); setIsPhotoDialogOpen(false); toast.success("Foto adicionada!"); },
    onError: (err) => toast.error(err.message),
  });

  const deletePhotoMutation = trpc.activeRestaurant.deletePhoto.useMutation({
    onSuccess: () => { utils.activeRestaurant.getPhotos.invalidate(); toast.success("Foto removida!"); },
  });

  const linkBranchMutation = trpc.activeRestaurant.linkBranch.useMutation({
    onSuccess: () => { utils.activeRestaurant.list.invalidate(); setIsBranchDialogOpen(false); toast.success("Filial vinculada!"); },
  });

  const unlinkBranchMutation = trpc.activeRestaurant.unlinkBranch.useMutation({
    onSuccess: () => { utils.activeRestaurant.list.invalidate(); toast.success("Filial desvinculada!"); },
  });

  const createTermMutation = trpc.term.create.useMutation({
    onSuccess: () => { utils.term.list.invalidate(); setIsTermDialogOpen(false); toast.success("Termo criado!"); },
    onError: (err) => toast.error(err.message),
  });

  const updateTermMutation = trpc.term.update.useMutation({
    onSuccess: () => { utils.term.list.invalidate(); setIsTermDialogOpen(false); setEditingTermId(null); toast.success("Termo atualizado!"); },
    onError: (err) => toast.error(err.message),
  });

  const deleteTermMutation = trpc.term.delete.useMutation({
    onSuccess: () => { utils.term.list.invalidate(); toast.success("Termo removido!"); },
  });

  const updateTermStatusMutation = trpc.term.updateStatus.useMutation({
    onSuccess: () => { utils.term.list.invalidate(); toast.success("Status atualizado!"); },
  });

  const linkUserMutation = trpc.activeRestaurant.linkUser.useMutation({
    onSuccess: () => { utils.activeRestaurant.getLinkedUsers.invalidate(); utils.members.listRestaurantUsers.invalidate(); setIsLinkUserDialogOpen(false); setSelectedUserId(""); toast.success("Conta vinculada ao restaurante!"); },
    onError: (err) => toast.error(err.message),
  });
  const unlinkUserMutation = trpc.activeRestaurant.unlinkUser.useMutation({
    onSuccess: () => { utils.activeRestaurant.getLinkedUsers.invalidate(); utils.members.listRestaurantUsers.invalidate(); toast.success("Conta desvinculada!"); },
    onError: (err) => toast.error(err.message),
  });

  const [isAddMultiAccessOpen, setIsAddMultiAccessOpen] = useState(false);
  const [multiAccessUserId, setMultiAccessUserId] = useState("");
  const { data: restaurantMultiUsers = [] } = trpc.members.listRestaurantUsers.useQuery({ restaurantId }, { enabled: restaurantId > 0 });
  const { data: allRestaurantUsers = [] } = trpc.members.listAllRestauranteUsers.useQuery(undefined, { enabled: isAddMultiAccessOpen });

  const linkMultiAccessMutation = trpc.members.linkRestaurant.useMutation({
    onSuccess: () => { utils.members.listRestaurantUsers.invalidate(); setIsAddMultiAccessOpen(false); setMultiAccessUserId(""); toast.success("Acesso adicional vinculado!"); },
    onError: (err) => toast.error(err.message),
  });
  const unlinkMultiAccessMutation = trpc.members.unlinkRestaurant.useMutation({
    onSuccess: () => { utils.members.listRestaurantUsers.invalidate(); toast.success("Acesso adicional removido!"); },
    onError: (err) => toast.error(err.message),
  });

  const [isInviteDialogOpen, setIsInviteDialogOpen] = useState(false);
  const [inviteEmail, setInviteEmail] = useState("");
  const [generatedInviteUrl, setGeneratedInviteUrl] = useState("");

  const generateAccountInviteMutation = trpc.activeRestaurant.generateAccountInvite.useMutation({
    onSuccess: (data) => {
      utils.term.list.invalidate();
      const inviteUrl = `${window.location.origin}/parceiro/convite/${data.inviteToken}`;
      setGeneratedInviteUrl(inviteUrl);
    },
    onError: (err) => toast.error(err.message),
  });

  const stats = useMemo(() => {
    let totalRevenue = 0;
    let totalCommission = 0;
    let totalImpressions = 0;
    let activeCampaigns = 0;
    let completedCampaigns = 0;

    for (const c of campaignsData) {
      if (!c.campaignName) continue;
      const r = calcRestaurantRevenue(c);
      const months = c.contractDuration || 1;
      totalRevenue += r.sellingPrice * months;
      totalCommission += r.restComm * months;
      totalImpressions += r.impressions * months;
      if (c.status === "active") activeCampaigns++;
      if (c.status === "completed") completedCampaigns++;
    }

    const totalPaid = payments.filter(p => p.status === "paid").reduce((s, p) => s + Number(p.amount), 0);
    const totalPending = payments.filter(p => p.status === "pending").reduce((s, p) => s + Number(p.amount), 0);

    return { totalRevenue, totalCommission, totalImpressions, activeCampaigns, completedCampaigns, totalPaid, totalPending, totalCampaigns: campaignsData.length };
  }, [campaignsData, payments]);

  if (isLoading) {
    return (
      <div className="h-full flex flex-col overflow-hidden">
        <div className="flex-1 flex items-center justify-center text-muted-foreground">Carregando...</div>
      </div>
    );
  }

  if (!restaurant) {
    return (
      <div className="h-full flex flex-col overflow-hidden">
        <div className="flex-1 flex flex-col items-center justify-center gap-4">
          <p className="text-muted-foreground">Local não encontrado</p>
          <Button variant="outline" onClick={() => navigate("/restaurantes")}>Voltar</Button>
        </div>
      </div>
    );
  }

  const busyDays = restaurant.busyDays ? (() => { try { return JSON.parse(restaurant.busyDays); } catch { return []; } })() : [];
  const excludedCategories = restaurant.excludedCategories ? (() => { try { return JSON.parse(restaurant.excludedCategories); } catch { return []; } })() : [];

  return (
    <div className="h-full flex flex-col overflow-hidden">
      <div className="flex-1 overflow-y-auto">
        <div className="border-b border-border/20 bg-card/30 px-4 lg:px-6 py-4">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0" onClick={() => navigate("/restaurantes")}>
                <ArrowLeft className="w-4 h-4" />
              </Button>
              <RestaurantAvatar name={restaurant.name} logoUrl={restaurant.logoUrl} size="md" />
              <div>
                <div className="flex items-center gap-2">
                  <h1 className="text-lg font-bold tracking-tight">{restaurant.name}</h1>
                  <Badge variant="outline" className={restaurant.status === "active" ? "bg-emerald-500/20 text-emerald-400 border-emerald-500/30" : "bg-muted text-muted-foreground"}>
                    {restaurant.status === "active" ? "Ativo" : "Inativo"}
                  </Badge>
                </div>
                <p className="text-xs text-muted-foreground mt-0.5 flex items-center gap-2">
                  <MapPin className="w-3 h-3" /> {restaurant.neighborhood} · ID #{restaurant.id}
                  {parentRestaurant && (
                    <span className="flex items-center gap-1 text-primary cursor-pointer" onClick={() => navigate(`/restaurantes/perfil/${parentRestaurant.id}`)}>
                      <Link2 className="w-3 h-3" /> Filial de {parentRestaurant.name}
                    </span>
                  )}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              <Button size="sm" variant="outline" className="gap-1.5 text-xs h-8" onClick={() => navigate(`/restaurantes/${restaurant.id}`)}>
                <Pencil className="w-3.5 h-3.5" /> Editar
              </Button>
              {restaurant.instagram && (
                <Button size="sm" variant="outline" className="gap-1.5 text-xs h-8" onClick={() => window.open(`https://instagram.com/${restaurant.instagram!.replace("@", "")}`, "_blank")}>
                  <Instagram className="w-3.5 h-3.5" /> Instagram
                </Button>
              )}
              {restaurant.googleMapsLink && (
                <Button size="sm" variant="outline" className="gap-1.5 text-xs h-8" onClick={() => window.open(restaurant.googleMapsLink!, "_blank")}>
                  <Globe className="w-3.5 h-3.5" /> Mapa
                </Button>
              )}
            </div>
          </div>
        </div>

        <div className="p-4 lg:p-6 space-y-5">
          <Tabs defaultValue="painel" className="space-y-4">
            <div className="overflow-x-auto -mx-1 px-1 scrollbar-hide">
              <TabsList className="bg-card border border-border/30 inline-flex w-auto min-w-full sm:w-auto">
                <TabsTrigger value="painel" className="gap-1.5 text-xs"><BarChart3 className="w-3.5 h-3.5" /> Painel</TabsTrigger>
                <TabsTrigger value="info" className="gap-1.5 text-xs"><Building2 className="w-3.5 h-3.5" /> Informações</TabsTrigger>
                <TabsTrigger value="campanhas" className="gap-1.5 text-xs"><Megaphone className="w-3.5 h-3.5" /> Campanhas</TabsTrigger>
                <TabsTrigger value="financeiro" className="gap-1.5 text-xs"><DollarSign className="w-3.5 h-3.5" /> Financeiro</TabsTrigger>
                <TabsTrigger value="fotos" className="gap-1.5 text-xs"><Camera className="w-3.5 h-3.5" /> Fotos</TabsTrigger>
                <TabsTrigger value="filiais" className="gap-1.5 text-xs"><Link2 className="w-3.5 h-3.5" /> Filiais</TabsTrigger>
                <TabsTrigger value="termos" className="gap-1.5 text-xs"><FileText className="w-3.5 h-3.5" /> Termos</TabsTrigger>
                <TabsTrigger value="contatos" className="gap-1.5 text-xs"><Phone className="w-3.5 h-3.5" /> Contatos</TabsTrigger>
                <TabsTrigger value="contas" className="gap-1.5 text-xs"><Users className="w-3.5 h-3.5" /> Contas</TabsTrigger>
              </TabsList>
            </div>

            {/* ─── PAINEL ─── */}
            <TabsContent value="painel" className="space-y-4">
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                <KPICard label="Faturamento Gerado" value={formatCurrency(stats.totalRevenue)} icon={<Banknote className="w-5 h-5" />} />
                <KPICard label="Comissão Total" value={formatCurrency(stats.totalCommission)} icon={<DollarSign className="w-5 h-5" />} accent />
                <KPICard label="Impressões Geradas" value={stats.totalImpressions.toLocaleString("pt-BR")} icon={<Eye className="w-5 h-5" />} />
                <KPICard label="Total Campanhas" value={String(stats.totalCampaigns)} icon={<Megaphone className="w-5 h-5" />} />
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                <Card title="Operação">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    <MiniStat label="Mesas" value={String(restaurant.tableCount)} />
                    <MiniStat label="Assentos" value={String(restaurant.seatCount)} />
                    <MiniStat label="Clientes/Mês" value={restaurant.monthlyCustomers.toLocaleString("pt-BR")} />
                    {restaurant.monthlyDrinksSold && <MiniStat label="Bebidas/Mês" value={restaurant.monthlyDrinksSold.toLocaleString("pt-BR")} />}
                    <MiniStat label="Classe" value={formatSocialClass(restaurant.socialClass)} />
                  </div>
                  {busyDays.length > 0 && (
                    <div className="pt-2">
                      <p className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1">Dias Movimentados</p>
                      <div className="flex gap-1">
                        {busyDays.map((d: string) => (
                          <Badge key={d} variant="outline" className="text-[10px]">{d}</Badge>
                        ))}
                      </div>
                    </div>
                  )}
                  {restaurant.busyHours && (() => {
                    let hours: string[] = [];
                    try { const parsed = JSON.parse(restaurant.busyHours); if (Array.isArray(parsed)) hours = parsed; } catch { hours = [restaurant.busyHours]; }
                    return hours.length > 0 ? (
                      <div>
                        <p className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1">Horários Pico</p>
                        <div className="flex flex-wrap gap-1">
                          {hours.map((h: string) => (
                            <Badge key={h} variant="outline" className="text-[10px]">{h}</Badge>
                          ))}
                        </div>
                      </div>
                    ) : null;
                  })()}
                </Card>

                <Card title="Financeiro">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    <MiniStat label="Comissão Paga" value={formatCurrency(stats.totalPaid)} accent />
                    <MiniStat label="Pendente" value={formatCurrency(stats.totalPending)} warn={stats.totalPending > 0} />
                    <MiniStat label="Cap. Coasters" value={restaurant.monthlyDrinksSold ? Math.round(restaurant.monthlyDrinksSold * 0.6).toLocaleString("pt-BR") : "—"} />
                    <div className="p-2 bg-background/50 rounded-md">
                      <p className="text-[10px] text-muted-foreground mb-1">Comissão Padrão</p>
                      {editingCommission ? (
                        <div className="flex items-center gap-1.5">
                          <Input
                            type="number"
                            step="0.01"
                            min="0"
                            max="100"
                            value={commissionValue}
                            onChange={(e) => setCommissionValue(e.target.value)}
                            className="h-7 w-20 text-xs bg-background border-border/30"
                            autoFocus
                            onKeyDown={(e) => {
                              if (e.key === "Enter") {
                                updateCommissionMutation.mutate({ id: restaurantId, commissionPercent: commissionValue });
                              }
                              if (e.key === "Escape") setEditingCommission(false);
                            }}
                          />
                          <span className="text-xs text-muted-foreground">%</span>
                          <Button
                            size="sm"
                            className="h-6 text-[10px] px-2"
                            onClick={() => updateCommissionMutation.mutate({ id: restaurantId, commissionPercent: commissionValue })}
                            disabled={updateCommissionMutation.isPending}
                          >
                            Salvar
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-6 text-[10px] px-2"
                            onClick={() => setEditingCommission(false)}
                          >
                            Cancelar
                          </Button>
                        </div>
                      ) : (
                        <button
                          className="text-sm font-semibold font-mono text-primary hover:underline cursor-pointer"
                          onClick={() => {
                            setCommissionValue(String(restaurant.commissionPercent || "20.00"));
                            setEditingCommission(true);
                          }}
                          title="Clique para editar"
                        >
                          {restaurant.commissionPercent}%
                        </button>
                      )}
                    </div>
                  </div>
                  {restaurant.pixKey && <MiniStat label="Chave Pix" value={restaurant.pixKey} />}
                </Card>

                <Card title="Contato">
                  <div className="space-y-2">
                    <MiniStat label="Responsável" value={`${restaurant.contactName} (${CONTACT_TYPE_LABELS[restaurant.contactType] || restaurant.contactType})`} />
                    <MiniStat label="Cargo" value={restaurant.contactRole} />
                    <MiniStat label="WhatsApp" value={restaurant.whatsapp} />
                    {restaurant.email && <MiniStat label="Email" value={restaurant.email} />}
                    {restaurant.financialEmail && <MiniStat label="Email Financeiro" value={restaurant.financialEmail} />}
                    {restaurant.instagram && <MiniStat label="Instagram" value={restaurant.instagram} />}
                  </div>
                </Card>
              </div>

              {(() => {
                const hasRating = restaurant.ratingScore != null;
                if (!hasRating) {
                  return (
                    <Card title="Classificação" icon={<Star className="w-4 h-4" />}>
                      <div className="text-center py-4">
                        <AlertTriangle className="w-8 h-8 mx-auto mb-2 text-yellow-500 opacity-50" />
                        <p className="text-sm text-muted-foreground">Classificação pendente — edite o local e preencha o perfil publicitário</p>
                      </div>
                    </Card>
                  );
                }
                const ratingData = calcularRating(restaurant);
                return (
                  <Card title="Rating Interno" icon={<Star className="w-4 h-4" />}>
                    <div className="space-y-4">
                      <div className="flex items-center justify-between">
                        <div className="text-2xl font-bold font-mono">{ratingData.score.toFixed(2)}</div>
                        <div className="text-right">
                          <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Multiplicador</p>
                          <p className="text-lg font-bold font-mono">{ratingData.multiplicador.toFixed(2)}x</p>
                        </div>
                      </div>
                      <div className="w-full h-2 bg-muted rounded-full overflow-hidden">
                        <div className="h-full rounded-full transition-all bg-primary" style={{ width: `${(ratingData.score / 5) * 100}%` }} />
                      </div>
                      <div className="space-y-2">
                        {Object.entries(ratingData.detalhamento).map(([key, detail]) => (
                          <div key={key} className="flex items-center gap-2">
                            <span className="text-[10px] uppercase tracking-wider text-muted-foreground w-20 shrink-0">{RATING_DIMENSION_LABELS[key] || key}</span>
                            <div className="flex-1 h-1.5 bg-muted rounded-full overflow-hidden">
                              <div className="h-full rounded-full bg-primary" style={{ width: `${(detail.pontos / 5) * 100}%` }} />
                            </div>
                            <span className="text-xs font-mono w-6 text-right">{detail.pontos}</span>
                          </div>
                        ))}
                      </div>
                      {restaurant.ratingUpdatedAt && (
                        <p className="text-[10px] text-muted-foreground text-right">
                          Atualizado em {new Date(restaurant.ratingUpdatedAt).toLocaleDateString("pt-BR")} às {new Date(restaurant.ratingUpdatedAt).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}
                        </p>
                      )}
                    </div>
                  </Card>
                );
              })()}

              {campaignsData.length > 0 && (
                <Card title="Campanhas Recentes">
                  <div className="space-y-2">
                    {campaignsData.slice(0, 3).map((c) => {
                      const rev = calcRestaurantRevenue(c);
                      return (
                        <div key={c.campaignId} className="flex items-center justify-between p-2 bg-background/50 rounded-lg border border-border/20 cursor-pointer hover:bg-background/80" onClick={() => navigate(`/campanhas/${c.campaignId}`)}>
                          <div>
                            <p className="text-sm font-medium">{c.campaignName}</p>
                            <p className="text-[10px] text-muted-foreground">{c.clientName}</p>
                          </div>
                          <div className="flex items-center gap-3">
                            {(c as any).isBonificada && (
                              <Badge className="bg-amber-500/10 text-amber-500 border-amber-500/30 text-[10px]">Bonificada</Badge>
                            )}
                            <span className="text-xs font-mono text-primary">{formatCurrency(rev.restComm)}/mês</span>
                            <Badge variant="outline" className={STATUS_COLORS[c.status || ""] || ""}>{STATUS_LABELS[c.status || ""] || c.status}</Badge>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </Card>
              )}
            </TabsContent>

            {/* ─── INFORMAÇÕES ─── */}
            <TabsContent value="info" className="space-y-4">
              <LogoSection restaurant={restaurant} onUpdated={() => utils.activeRestaurant.get.invalidate({ id: restaurant.id })} />
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                <Card title="Local & Endereço" icon={<MapPin className="w-4 h-4" />}>
                  <div className="space-y-2">
                    <InfoRow label="Nome" value={restaurant.name} />
                    <InfoRow label="Endereço" value={restaurant.address} />
                    <InfoRow label="Bairro" value={restaurant.neighborhood} />
                    {restaurant.city && <InfoRow label="Cidade" value={`${restaurant.city}${restaurant.state ? ` - ${restaurant.state}` : ""}`} />}
                    {restaurant.cep && <InfoRow label="CEP" value={restaurant.cep} />}
                    {restaurant.cnpj && <InfoRow label="CNPJ" value={restaurant.cnpj} mono />}
                    {restaurant.razaoSocial && <InfoRow label="Razão Social" value={restaurant.razaoSocial} />}
                    {restaurant.googleMapsLink && (
                      <div>
                        <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Google Maps</p>
                        <a href={restaurant.googleMapsLink} target="_blank" rel="noopener noreferrer" className="text-xs text-primary flex items-center gap-1 mt-0.5">
                          Abrir no Maps <ExternalLink className="w-3 h-3" />
                        </a>
                      </div>
                    )}
                  </div>
                </Card>

                <Card title="Contato" icon={<Phone className="w-4 h-4" />}>
                  <div className="space-y-2">
                    <InfoRow label="Tipo" value={CONTACT_TYPE_LABELS[restaurant.contactType] || restaurant.contactType} />
                    <InfoRow label="Nome" value={restaurant.contactName} />
                    <InfoRow label="Cargo" value={restaurant.contactRole} />
                    <InfoRow label="WhatsApp" value={restaurant.whatsapp} />
                    <InfoRow label="Email" value={restaurant.email || undefined} />
                    <InfoRow label="Email Financeiro" value={restaurant.financialEmail || undefined} />
                    <InfoRow label="Instagram" value={restaurant.instagram || undefined} />
                  </div>
                </Card>

                {(restaurant.porte || restaurant.naturezaJuridica || restaurant.atividadePrincipal || restaurant.capitalSocial) && (
                  <Card title="Dados Empresariais" icon={<Building2 className="w-4 h-4" />}>
                    <div className="space-y-2">
                      <InfoRow label="Porte" value={restaurant.porte || undefined} />
                      <InfoRow label="Natureza Jurídica" value={restaurant.naturezaJuridica || undefined} />
                      <InfoRow label="Capital Social" value={restaurant.capitalSocial ? `R$ ${Number(restaurant.capitalSocial).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}` : undefined} />
                      <InfoRow label="Data de Abertura" value={restaurant.dataAbertura || undefined} />
                      <InfoRow label="Situação Cadastral" value={restaurant.situacaoCadastral || undefined} />
                      <InfoRow label="CNAE Principal" value={restaurant.atividadePrincipal || undefined} />
                      {restaurant.atividadesSecundarias && (() => {
                        try {
                          const ativs = JSON.parse(restaurant.atividadesSecundarias);
                          if (Array.isArray(ativs) && ativs.length > 0) {
                            return (
                              <div>
                                <p className="text-[10px] uppercase tracking-wider text-muted-foreground">CNAEs Secundários</p>
                                <div className="mt-1 space-y-1">
                                  {ativs.map((a: any, i: number) => (
                                    <p key={i} className="text-xs text-muted-foreground">{a.id} - {a.descricao}</p>
                                  ))}
                                </div>
                              </div>
                            );
                          }
                        } catch { }
                        return null;
                      })()}
                    </div>
                  </Card>
                )}

                {restaurant.socios && (() => {
                  try {
                    const sociosList = JSON.parse(restaurant.socios);
                    if (Array.isArray(sociosList) && sociosList.length > 0) {
                      return (
                        <Card title={`Quadro Societário (${sociosList.length})`} icon={<Users className="w-4 h-4" />}>
                          <div className="space-y-2">
                            {sociosList.map((s: any, i: number) => (
                              <div key={i} className="p-2 bg-background/50 rounded-lg border border-border/20">
                                <p className="text-sm font-medium">{s.nome}</p>
                                <p className="text-xs text-muted-foreground mt-0.5">{s.qualificacao}</p>
                                {s.dataEntrada && <p className="text-[10px] text-muted-foreground">Entrada: {s.dataEntrada}</p>}
                                {s.faixaEtaria && <p className="text-[10px] text-muted-foreground">Faixa etária: {s.faixaEtaria}</p>}
                              </div>
                            ))}
                          </div>
                        </Card>
                      );
                    }
                  } catch { }
                  return null;
                })()}

                <Card title="Operação" icon={<BarChart3 className="w-4 h-4" />}>
                  <div className="space-y-2">
                    <InfoRow label="Classe Social" value={formatSocialClass(restaurant.socialClass)} />
                    <InfoRow label="Mesas" value={String(restaurant.tableCount)} />
                    <InfoRow label="Assentos" value={String(restaurant.seatCount)} />
                    <InfoRow label="Clientes/Mês" value={restaurant.monthlyCustomers.toLocaleString("pt-BR")} />
                    <InfoRow label="Bebidas Vendidas/Mês" value={restaurant.monthlyDrinksSold ? restaurant.monthlyDrinksSold.toLocaleString("pt-BR") : undefined} />
                    <InfoRow label="Dias Movimentados" value={busyDays.join(", ") || undefined} />
                    <InfoRow label="Horário Pico" value={(() => {
                      if (!restaurant.busyHours) return undefined;
                      try { const parsed = JSON.parse(restaurant.busyHours); if (Array.isArray(parsed)) return parsed.join(", "); } catch {}
                      return restaurant.busyHours;
                    })()} />
                    <InfoRow label="Autoriza Fotos" value={restaurant.photoAuthorization === "sim" ? "Sim" : "Não"} />
                  </div>
                </Card>

                <Card title="Rating Interno" icon={<Wine className="w-4 h-4" />}>
                  <div className="space-y-2">
                    <InfoRow label="Ticket Médio" value={restaurant.ticketMedio ? `R$ ${Number(restaurant.ticketMedio).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}` : undefined} />
                    <InfoRow label="Localização" value={restaurant.locationRating ? LOCATION_RATING_LABELS[restaurant.locationRating] || String(restaurant.locationRating) : undefined} />
                    <InfoRow label="Tipo de Estabelecimento" value={restaurant.venueType ? VENUE_TYPE_LABELS[restaurant.venueType] || String(restaurant.venueType) : undefined} />
                    <InfoRow label="Presença Digital" value={restaurant.digitalPresence ? DIGITAL_PRESENCE_LABELS[restaurant.digitalPresence] || String(restaurant.digitalPresence) : undefined} />
                    <InfoRow label="Bebida Predominante" value={restaurant.primaryDrink ? PRIMARY_DRINK_LABELS[restaurant.primaryDrink] || restaurant.primaryDrink : undefined} />
                  </div>
                </Card>

                <Card title="Restrições" icon={<ShieldCheck className="w-4 h-4" />}>
                  {excludedCategories.length > 0 ? (
                    <div className="space-y-1">
                      {excludedCategories.map((cat: string, i: number) => (
                        <div key={i} className="flex items-center gap-2 text-xs py-1 border-b border-border/10 last:border-0">
                          <AlertTriangle className="w-3 h-3 text-yellow-500 shrink-0" />
                          <span className="text-muted-foreground">{cat}</span>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-xs text-muted-foreground">Nenhuma restrição cadastrada</p>
                  )}
                  {restaurant.excludedOther && (
                    <div className="mt-2 pt-2 border-t border-border/20">
                      <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Outras Restrições</p>
                      <p className="text-xs mt-0.5">{restaurant.excludedOther}</p>
                    </div>
                  )}
                </Card>
              </div>

              {restaurant.notes && (
                <Card title="Observações" icon={<FileText className="w-4 h-4" />}>
                  <p className="text-sm text-muted-foreground whitespace-pre-wrap">{restaurant.notes}</p>
                </Card>
              )}

              <Card title="Dados do Sistema">
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-2">
                  <InfoRow label="ID" value={`#${restaurant.id}`} mono />
                  <InfoRow label="Cap. Coasters" value={restaurant.monthlyDrinksSold ? Math.round(restaurant.monthlyDrinksSold * 0.6).toLocaleString("pt-BR") : "—"} />
                  <InfoRow label="Comissão" value={`${restaurant.commissionPercent}%`} />
                  <InfoRow label="Chave Pix" value={restaurant.pixKey || "—"} />
                  <InfoRow label="Cadastrado em" value={new Date(restaurant.createdAt).toLocaleDateString("pt-BR")} />
                  <InfoRow label="Atualizado em" value={new Date(restaurant.updatedAt).toLocaleDateString("pt-BR")} />
                </div>
              </Card>
            </TabsContent>

            {/* ─── CAMPANHAS ─── */}
            <TabsContent value="campanhas" className="space-y-4">
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                <KPICard label="Total Campanhas" value={String(stats.totalCampaigns)} icon={<Megaphone className="w-4 h-4" />} />
                <KPICard label="Ativas Agora" value={String(stats.activeCampaigns)} icon={<Target className="w-4 h-4" />} accent />
                <KPICard label="Concluídas" value={String(stats.completedCampaigns)} icon={<CheckCircle2 className="w-4 h-4" />} />
                <KPICard label="Impressões Totais" value={stats.totalImpressions.toLocaleString("pt-BR")} icon={<Eye className="w-4 h-4" />} />
              </div>

              {campaignsData.length === 0 ? (
                <div className="bg-card border border-border/30 rounded-lg p-8 text-center text-muted-foreground text-sm">
                  Este restaurante ainda não participou de nenhuma campanha.
                </div>
              ) : (
                <div className="space-y-3">
                  {campaignsData.map((c) => {
                    const rev = calcRestaurantRevenue(c);
                    const months = c.contractDuration || 1;
                    return (
                      <div key={c.campaignId} className="bg-card border border-border/30 rounded-lg p-4 cursor-pointer hover:bg-card/80 transition-colors" onClick={() => navigate(`/campanhas/${c.campaignId}`)}>
                        <div className="flex items-center justify-between gap-4">
                          <div className="min-w-0">
                            <div className="flex items-center gap-2">
                              <h3 className="font-semibold text-sm truncate">{c.campaignName}</h3>
                              {(c as any).isBonificada && (
                                <Badge className="bg-amber-500/10 text-amber-500 border-amber-500/30">Bonificada</Badge>
                              )}
                              <Badge variant="outline" className={STATUS_COLORS[c.status || ""] || ""}>{STATUS_LABELS[c.status || ""] || c.status}</Badge>
                            </div>
                            <p className="text-xs text-muted-foreground mt-0.5">
                              {c.clientName} · {c.startDate ? new Date(c.startDate).toLocaleDateString("pt-BR") : ""} → {c.endDate ? new Date(c.endDate).toLocaleDateString("pt-BR") : ""}
                            </p>
                          </div>
                          <div className="hidden md:flex items-center gap-6 text-sm shrink-0">
                            <div className="text-right">
                              <p className="text-[10px] text-muted-foreground">Comissão/Mês</p>
                              <p className="font-mono font-semibold text-primary">{formatCurrency(rev.restComm)}</p>
                            </div>
                            <div className="text-right">
                              <p className="text-[10px] text-muted-foreground">Comissão Total</p>
                              <p className="font-mono font-semibold text-emerald-400">{formatCurrency(rev.restComm * months)}</p>
                            </div>
                            <div className="text-right">
                              <p className="text-[10px] text-muted-foreground">Coasters</p>
                              <p className="font-mono">{c.coastersCount?.toLocaleString("pt-BR")}</p>
                            </div>
                            <div className="text-right">
                              <p className="text-[10px] text-muted-foreground">Impressões/Mês</p>
                              <p className="font-mono">{rev.impressions.toLocaleString("pt-BR")}</p>
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </TabsContent>

            {/* ─── FINANCEIRO ─── */}
            <TabsContent value="financeiro" className="space-y-4">
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                <KPICard label="Comissão Acumulada" value={formatCurrency(stats.totalCommission)} icon={<TrendingUp className="w-4 h-4" />} />
                <KPICard label="Total Pago" value={formatCurrency(stats.totalPaid)} icon={<CheckCircle2 className="w-4 h-4" />} accent />
                <KPICard label="Pendente" value={formatCurrency(stats.totalPending)} icon={<Clock className="w-4 h-4" />} warn={stats.totalPending > 0} />
                <KPICard label="Faturamento Gerado" value={formatCurrency(stats.totalRevenue)} icon={<Banknote className="w-4 h-4" />} />
              </div>

              <div className="flex items-center justify-between">
                <h3 className="text-sm font-semibold">Histórico de Pagamentos</h3>
                <Button size="sm" className="gap-1.5 text-xs h-8" onClick={() => {
                  setPaymentForm({ campaignId: "", amount: "", referenceMonth: new Date().toISOString().slice(0, 7), paymentDate: "", status: "pending", notes: "" });
                  setIsPaymentDialogOpen(true);
                }}>
                  <Plus className="w-3.5 h-3.5" /> Novo Pagamento
                </Button>
              </div>

              {payments.length === 0 ? (
                <div className="bg-card border border-border/30 rounded-lg p-8 text-center text-muted-foreground text-sm">
                  Nenhum pagamento registrado.
                </div>
              ) : (
                <div className="bg-card border border-border/30 rounded-lg overflow-x-auto">
                  <table className="w-full text-sm min-w-[600px]">
                    <thead>
                      <tr className="border-b border-border/20">
                        <th className="text-left p-3 text-xs text-muted-foreground font-medium">Mês Ref.</th>
                        <th className="text-left p-3 text-xs text-muted-foreground font-medium">Campanha</th>
                        <th className="text-right p-3 text-xs text-muted-foreground font-medium">Valor</th>
                        <th className="text-center p-3 text-xs text-muted-foreground font-medium">Status</th>
                        <th className="text-left p-3 text-xs text-muted-foreground font-medium">Data Pgto.</th>
                        <th className="text-right p-3 text-xs text-muted-foreground font-medium">Ações</th>
                      </tr>
                    </thead>
                    <tbody>
                      {payments.map((p) => (
                        <tr key={p.id} className="border-b border-border/10 last:border-0">
                          <td className="p-3 font-mono text-xs">{p.referenceMonth}</td>
                          <td className="p-3 text-xs">{p.campaignName || "—"}</td>
                          <td className="p-3 text-right font-mono font-semibold">{formatCurrency(Number(p.amount))}</td>
                          <td className="p-3 text-center">
                            <Badge variant="outline" className={`text-[10px] cursor-pointer ${PAYMENT_STATUS_COLORS[p.status] || ""}`}
                              onClick={() => {
                                const next = p.status === "pending" ? "paid" : p.status === "paid" ? "pending" : p.status;
                                updatePaymentMutation.mutate({ id: p.id, status: next, paymentDate: next === "paid" ? new Date().toISOString().split("T")[0] : undefined });
                              }}>
                              {PAYMENT_STATUS_LABELS[p.status] || p.status}
                            </Badge>
                          </td>
                          <td className="p-3 text-xs">{p.paymentDate ? new Date(p.paymentDate).toLocaleDateString("pt-BR") : "—"}</td>
                          <td className="p-3 text-right">
                            <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => deletePaymentMutation.mutate({ id: p.id })}>
                              <Trash2 className="w-3 h-3" />
                            </Button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </TabsContent>

            {/* ─── FOTOS ─── */}
            <TabsContent value="fotos" className="space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-semibold">Fotos de Veiculação & Estabelecimento</h3>
                <Button size="sm" className="gap-1.5 text-xs h-8" onClick={() => {
                  setPhotoForm({ url: "", caption: "", photoType: "veiculacao" });
                  setIsPhotoDialogOpen(true);
                }}>
                  <Plus className="w-3.5 h-3.5" /> Adicionar Foto
                </Button>
              </div>

              {photos.length === 0 ? (
                <div className="bg-card border border-border/30 rounded-lg p-12 text-center text-muted-foreground">
                  <Camera className="w-10 h-10 mx-auto mb-3 opacity-30" />
                  <p className="text-sm">Nenhuma foto cadastrada</p>
                  <p className="text-xs mt-1">Adicione fotos de veiculação para mostrar ao seu cliente</p>
                </div>
              ) : (
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
                  {photos.map((photo) => (
                    <div key={photo.id} className="bg-card border border-border/30 rounded-lg overflow-hidden group relative">
                      <div className="aspect-[4/3] bg-muted flex items-center justify-center">
                        <img src={photo.url} alt={photo.caption || ""} className="w-full h-full object-cover" onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }} />
                      </div>
                      <div className="p-2">
                        <p className="text-xs truncate">{photo.caption || "Sem legenda"}</p>
                        <div className="flex items-center justify-between mt-1">
                          <Badge variant="outline" className="text-[9px]">{photo.photoType}</Badge>
                          <Button variant="ghost" size="icon" className="h-6 w-6 text-destructive opacity-0 group-hover:opacity-100 transition-opacity" onClick={() => deletePhotoMutation.mutate({ id: photo.id })}>
                            <Trash2 className="w-3 h-3" />
                          </Button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </TabsContent>

            {/* ─── TERMOS ─── */}
            <TabsContent value="termos" className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-semibold">Termos para Local</h3>
                  <p className="text-xs text-muted-foreground mt-0.5">Contratos e termos de parceria</p>
                </div>
                <Button size="sm" className="gap-1.5 text-xs h-8" onClick={() => {
                  setEditingTermId(null);
                  setTermForm({ conditions: "", remunerationRule: "", allowedCategories: "", blockedCategories: "", restaurantObligations: "", mesaObligations: "", validFrom: "", validUntil: "" });
                  setIsTermDialogOpen(true);
                }}>
                  <Plus className="w-3.5 h-3.5" /> Novo Termo
                </Button>
              </div>

              {terms.length === 0 ? (
                <div className="bg-card border border-border/30 rounded-lg p-8 text-center text-muted-foreground text-sm">
                  <FileText className="w-10 h-10 mx-auto mb-3 opacity-30" />
                  <p>Nenhum termo cadastrado</p>
                  <p className="text-xs mt-1">Crie termos de parceria para este restaurante</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {terms.map((term) => (
                    <div key={term.id} className="bg-card border border-border/30 rounded-lg p-4">
                      <div className="flex items-center justify-between gap-4 mb-3">
                        <div className="min-w-0">
                          <div className="flex items-center gap-2">
                            <h4 className="text-sm font-semibold font-mono">{term.termNumber}</h4>
                            <Badge variant="outline" className={
                              term.status === "vigente" ? "bg-emerald-500/20 text-emerald-400 border-emerald-500/30" :
                              term.status === "assinado" ? "bg-blue-500/20 text-blue-400 border-blue-500/30" :
                              term.status === "enviado" ? "bg-orange-500/20 text-orange-400 border-orange-500/30" :
                              term.status === "encerrado" ? "bg-gray-500/20 text-gray-400 border-gray-500/30" :
                              "bg-muted text-muted-foreground"
                            }>
                              {term.status === "rascunho" ? "Rascunho" : term.status === "enviado" ? "Enviado" : term.status === "assinado" ? "Assinado" : term.status === "vigente" ? "Vigente" : "Encerrado"}
                            </Badge>
                          </div>
                          <p className="text-xs text-muted-foreground mt-0.5">
                            {term.validFrom && term.validUntil ? `${new Date(term.validFrom).toLocaleDateString("pt-BR")} → ${new Date(term.validUntil).toLocaleDateString("pt-BR")}` : term.validFrom ? `A partir de ${new Date(term.validFrom).toLocaleDateString("pt-BR")}` : "Sem período definido"}
                          </p>
                        </div>
                        <div className="flex items-center gap-1 shrink-0">
                          <Select value={term.status} onValueChange={(v) => updateTermStatusMutation.mutate({ id: term.id, status: v as any })}>
                            <SelectTrigger className="h-7 text-[10px] w-[110px] bg-background border-border/30">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="rascunho">Rascunho</SelectItem>
                              <SelectItem value="enviado">Enviado</SelectItem>
                              <SelectItem value="assinado">Assinado</SelectItem>
                              <SelectItem value="vigente">Vigente</SelectItem>
                              <SelectItem value="encerrado">Encerrado</SelectItem>
                            </SelectContent>
                          </Select>
                          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => {
                            setEditingTermId(term.id);
                            setTermForm({
                              conditions: term.conditions || "",
                              remunerationRule: term.remunerationRule || "",
                              allowedCategories: term.allowedCategories || "",
                              blockedCategories: term.blockedCategories || "",
                              restaurantObligations: term.restaurantObligations || "",
                              mesaObligations: term.mesaObligations || "",
                              validFrom: term.validFrom || "",
                              validUntil: term.validUntil || "",
                            });
                            setIsTermDialogOpen(true);
                          }}>
                            <Pencil className="w-3 h-3" />
                          </Button>
                          <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => deleteTermMutation.mutate({ id: term.id })}>
                            <Trash2 className="w-3 h-3" />
                          </Button>
                        </div>
                      </div>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
                        {term.conditions && (
                          <div>
                            <p className="text-[10px] uppercase tracking-wider text-muted-foreground mb-0.5">Condições</p>
                            <p className="text-muted-foreground whitespace-pre-wrap">{term.conditions}</p>
                          </div>
                        )}
                        {term.remunerationRule && (
                          <div>
                            <p className="text-[10px] uppercase tracking-wider text-muted-foreground mb-0.5">Remuneração</p>
                            <p className="text-muted-foreground whitespace-pre-wrap">{term.remunerationRule}</p>
                          </div>
                        )}
                        {term.allowedCategories && (
                          <div>
                            <p className="text-[10px] uppercase tracking-wider text-muted-foreground mb-0.5">Categorias Permitidas</p>
                            <p className="text-muted-foreground">{term.allowedCategories}</p>
                          </div>
                        )}
                        {term.blockedCategories && (
                          <div>
                            <p className="text-[10px] uppercase tracking-wider text-muted-foreground mb-0.5">Categorias Bloqueadas</p>
                            <p className="text-muted-foreground">{term.blockedCategories}</p>
                          </div>
                        )}
                        {term.restaurantObligations && (
                          <div>
                            <p className="text-[10px] uppercase tracking-wider text-muted-foreground mb-0.5">Obrigações do Local</p>
                            <p className="text-muted-foreground whitespace-pre-wrap">{term.restaurantObligations}</p>
                          </div>
                        )}
                        {term.mesaObligations && (
                          <div>
                            <p className="text-[10px] uppercase tracking-wider text-muted-foreground mb-0.5">Obrigações da Mesa Ads</p>
                            <p className="text-muted-foreground whitespace-pre-wrap">{term.mesaObligations}</p>
                          </div>
                        )}
                      </div>
                      <div className="flex items-center justify-between mt-3 pt-3 border-t border-border/20">
                        <p className="text-[10px] text-muted-foreground">
                          Criado em {new Date(term.createdAt).toLocaleDateString("pt-BR")}
                        </p>
                        <div className="flex items-center gap-2">
                          {(term.status === "assinado" || term.status === "vigente") && (
                            <Badge variant="outline" className="bg-emerald-500/20 text-emerald-400 border-emerald-500/30 gap-1 text-[10px]">
                              <CheckCircle2 className="w-3 h-3" /> Assinado
                            </Badge>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {termAcceptances.length > 0 && (
                <div className="mt-6">
                  <div className="mb-3">
                    <h3 className="text-sm font-semibold">Termos Aceitos</h3>
                    <p className="text-xs text-muted-foreground mt-0.5">Registros de aceitação de termos pelo parceiro</p>
                  </div>
                  <div className="space-y-2">
                    {termAcceptances.map((acc: any) => (
                      <details key={acc.id} className="bg-card border border-border/30 rounded-lg group">
                        <summary className="p-4 cursor-pointer list-none flex items-center justify-between">
                          <div className="flex items-center gap-3 min-w-0">
                            <CheckCircle className="w-4 h-4 text-emerald-400 shrink-0" />
                            <div className="min-w-0">
                              <p className="text-sm font-medium truncate">{acc.acceptedByName || "—"}</p>
                              <p className="text-xs text-muted-foreground">{acc.acceptedByEmail || "—"}</p>
                            </div>
                          </div>
                          <div className="flex items-center gap-2 shrink-0">
                            <Badge variant="outline" className="bg-emerald-500/20 text-emerald-400 border-emerald-500/30 text-[10px]">Aceito</Badge>
                            <span className="text-[10px] text-muted-foreground">
                              {new Date(acc.acceptedAt).toLocaleDateString("pt-BR")} {new Date(acc.acceptedAt).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}
                            </span>
                          </div>
                        </summary>
                        <div className="px-4 pb-4 border-t border-border/20 pt-3">
                          <div className="grid grid-cols-2 gap-3 text-xs mb-3">
                            <div>
                              <p className="text-[10px] uppercase tracking-wider text-muted-foreground mb-0.5">CPF</p>
                              <p>{acc.acceptedByCpf ? `***.***.${acc.acceptedByCpf.substring(6, 9)}-${acc.acceptedByCpf.substring(9)}` : "—"}</p>
                            </div>
                            <div>
                              <p className="text-[10px] uppercase tracking-wider text-muted-foreground mb-0.5">IP</p>
                              <p className="font-mono">{acc.ipAddress || "—"}</p>
                            </div>
                          </div>
                          {acc.termContent && (
                            <details className="mt-2">
                              <summary className="text-xs text-primary cursor-pointer hover:underline">Ver conteúdo do termo</summary>
                              <div className="mt-2 p-3 bg-background rounded border border-border/20 text-xs max-h-60 overflow-y-auto prose prose-invert prose-xs" dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(acc.termContent) }} />
                            </details>
                          )}
                        </div>
                      </details>
                    ))}
                  </div>
                </div>
              )}
            </TabsContent>

            {/* ─── CONTATOS ─── */}
            <TabsContent value="contatos" className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-semibold">Contatos</h3>
                  <p className="text-xs text-muted-foreground mt-0.5">Pessoas de contato deste restaurante</p>
                </div>
                <Button size="sm" className="gap-1.5 text-xs h-8" onClick={() => {
                  setEditingContactId(null);
                  setContactForm({ name: "", email: "", phone: "", notes: "", isPrimary: false });
                  setContactDialogOpen(true);
                }}>
                  <Plus className="w-3.5 h-3.5" /> Novo Contato
                </Button>
              </div>
              {contactsList.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground text-sm">Nenhum contato cadastrado</div>
              ) : (
                <div className="space-y-2">
                  {contactsList.map((contact: any) => (
                    <div key={contact.id} className="flex items-center justify-between p-3 bg-card border border-border/30 rounded-lg">
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="w-8 h-8 rounded-full bg-orange-500/10 flex items-center justify-center text-xs font-bold text-orange-500 flex-shrink-0">
                          {contact.name[0]?.toUpperCase() || "?"}
                        </div>
                        <div className="min-w-0">
                          <div className="flex items-center gap-1.5">
                            <span className="text-sm font-medium">{contact.name}</span>
                            {contact.isPrimary && <Star className="w-3 h-3 text-amber-500" />}
                          </div>
                          <div className="flex items-center gap-3 mt-0.5">
                            {contact.email && <span className="text-xs text-muted-foreground flex items-center gap-1"><Mail className="w-3 h-3" /> {contact.email}</span>}
                            {contact.phone && <span className="text-xs text-muted-foreground flex items-center gap-1"><Phone className="w-3 h-3" /> {contact.phone}</span>}
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-1 flex-shrink-0">
                        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => {
                          setEditingContactId(contact.id);
                          setContactForm({
                            name: contact.name,
                            email: contact.email || "",
                            phone: contact.phone || "",
                            notes: contact.notes || "",
                            isPrimary: contact.isPrimary,
                          });
                          setContactDialogOpen(true);
                        }}>
                          <Pencil className="w-3.5 h-3.5" />
                        </Button>
                        <Button variant="ghost" size="icon" className="h-7 w-7 text-red-400 hover:text-red-300"
                          onClick={() => deleteContactMutation.mutate({ id: contact.id })}>
                          <Trash2 className="w-3.5 h-3.5" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </TabsContent>

            {/* ─── FILIAIS ─── */}
            <TabsContent value="filiais" className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-semibold">Rede & Filiais</h3>
                  <p className="text-xs text-muted-foreground mt-0.5">Vincule outros restaurantes como filiais desta unidade</p>
                </div>
                <Button size="sm" className="gap-1.5 text-xs h-8" onClick={() => { setSelectedBranch(""); setIsBranchDialogOpen(true); }}>
                  <Plus className="w-3.5 h-3.5" /> Vincular Filial
                </Button>
              </div>

              {parentRestaurant && (
                <div className="bg-primary/5 border border-primary/20 rounded-lg p-4">
                  <p className="text-xs text-muted-foreground mb-1">Este restaurante é filial de:</p>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 cursor-pointer" onClick={() => navigate(`/restaurantes/perfil/${parentRestaurant.id}`)}>
                      <Store className="w-4 h-4 text-primary" />
                      <span className="text-sm font-semibold">{parentRestaurant.name}</span>
                      <span className="text-xs text-muted-foreground">{parentRestaurant.neighborhood}</span>
                    </div>
                    <Button size="sm" variant="outline" className="gap-1.5 text-xs h-7" onClick={() => unlinkBranchMutation.mutate({ branchId: restaurant.id })}>
                      <Unlink className="w-3 h-3" /> Desvincular
                    </Button>
                  </div>
                </div>
              )}

              {branches.length === 0 && !parentRestaurant ? (
                <div className="bg-card border border-border/30 rounded-lg p-8 text-center text-muted-foreground text-sm">
                  Nenhuma filial vinculada.
                </div>
              ) : (
                <div className="space-y-2">
                  {branches.map((b) => (
                    <div key={b.id} className="bg-card border border-border/30 rounded-lg p-3 flex items-center justify-between">
                      <div className="flex items-center gap-3 cursor-pointer" onClick={() => navigate(`/restaurantes/perfil/${b.id}`)}>
                        <div className="w-8 h-8 rounded-lg bg-primary/20 flex items-center justify-center">
                          <Store className="w-4 h-4 text-primary" />
                        </div>
                        <div>
                          <p className="text-sm font-medium">{b.name}</p>
                          <p className="text-xs text-muted-foreground">{b.neighborhood} · {b.tableCount} mesas · {b.monthlyCustomers.toLocaleString("pt-BR")} clientes/mês</p>
                        </div>
                      </div>
                      <Button size="sm" variant="ghost" className="gap-1.5 text-xs h-7 text-destructive" onClick={() => unlinkBranchMutation.mutate({ branchId: b.id })}>
                        <Unlink className="w-3 h-3" /> Desvincular
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </TabsContent>

            {/* ─── CONTAS ASSOCIADAS ─── */}
            <TabsContent value="contas" className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-semibold">Contas Associadas</h3>
                  <p className="text-xs text-muted-foreground mt-0.5">Usuários com acesso ao portal deste restaurante</p>
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    className="gap-1.5 text-xs h-8 border-amber-500/30 text-amber-400 hover:bg-amber-500/10"
                    onClick={() => {
                      const imp = {
                        role: "restaurante" as const,
                        restaurantId,
                        name: restaurant?.name || `Restaurante #${restaurantId}`,
                      };
                      (window as any).__IMPERSONATION__ = imp;
                      window.dispatchEvent(new CustomEvent("impersonation-change", { detail: imp }));
                    }}
                  >
                    <Eye className="w-3.5 h-3.5" /> Entrar como Local
                  </Button>
                  <Button size="sm" variant="outline" className="gap-1.5 text-xs h-8" onClick={() => { setInviteEmail(""); setIsInviteDialogOpen(true); }}>
                    <Send className="w-3.5 h-3.5" /> Convidar Novo Usuário
                  </Button>
                  <Button size="sm" className="gap-1.5 text-xs h-8" onClick={() => { setSelectedUserId(""); setIsLinkUserDialogOpen(true); }}>
                    <Plus className="w-3.5 h-3.5" /> Vincular Conta
                  </Button>
                </div>
              </div>

              {linkedUsers.length === 0 ? (
                <div className="bg-card border border-border/30 rounded-lg p-8 text-center text-muted-foreground text-sm">
                  <Users className="w-8 h-8 mx-auto mb-2 opacity-40" />
                  <p>Nenhuma conta associada a este restaurante</p>
                  <p className="text-xs mt-1">Vincule uma conta existente ou convide um novo usuário</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {linkedUsers.map((u: any) => (
                    <div key={u.id} className="bg-card border border-border/30 rounded-lg p-4 flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-full bg-primary/20 flex items-center justify-center text-sm font-semibold text-primary">
                          {(u.firstName?.[0] || u.email?.[0] || "?").toUpperCase()}
                        </div>
                        <div>
                          <p className="text-sm font-medium">
                            {u.firstName || ""} {u.lastName || ""}
                            {!u.firstName && !u.lastName && <span className="text-muted-foreground italic">Sem nome</span>}
                          </p>
                          <p className="text-xs text-muted-foreground">{u.email || "—"}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge variant="outline" className={u.isActive ? "bg-emerald-500/20 text-emerald-400 border-emerald-500/30 text-[10px]" : "bg-red-500/20 text-red-400 border-red-500/30 text-[10px]"}>
                          {u.isActive ? "Ativo" : "Inativo"}
                        </Badge>
                        {u.lastLoginAt && (
                          <span className="text-[10px] text-muted-foreground">
                            Último acesso: {new Date(u.lastLoginAt).toLocaleDateString("pt-BR")}
                          </span>
                        )}
                        <Button
                          size="sm"
                          variant="ghost"
                          className="gap-1.5 text-xs h-7 text-destructive"
                          disabled={unlinkUserMutation.isPending}
                          onClick={() => unlinkUserMutation.mutate({ userId: u.id, restaurantId })}
                        >
                          <Unlink className="w-3 h-3" /> Desvincular
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              <div className="pt-4 border-t border-border/20">
                <div className="flex items-center justify-between mb-3">
                  <div>
                    <h3 className="text-sm font-semibold">Acesso Adicional (Multi-Local)</h3>
                    <p className="text-xs text-muted-foreground mt-0.5">Usuários de outros restaurantes com acesso adicional a este estabelecimento</p>
                  </div>
                  <Button size="sm" variant="outline" className="gap-1.5 text-xs h-8" onClick={() => { setMultiAccessUserId(""); setIsAddMultiAccessOpen(true); }}>
                    <Plus className="w-3.5 h-3.5" /> Adicionar Acesso
                  </Button>
                </div>
                {restaurantMultiUsers.length === 0 ? (
                  <div className="bg-muted/30 rounded-lg p-4 text-center text-muted-foreground text-xs">
                    <p>Nenhum acesso adicional vinculado via rede</p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {restaurantMultiUsers.map((u: any) => (
                      <div key={u.id} className="bg-muted/20 border border-border/20 rounded-lg p-3 flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-full bg-teal-500/20 flex items-center justify-center text-xs font-semibold text-teal-400">
                            {(u.userFirstName?.[0] || u.userEmail?.[0] || "?").toUpperCase()}
                          </div>
                          <div>
                            <p className="text-sm font-medium">
                              {u.userFirstName || ""} {u.userLastName || ""}
                              {!u.userFirstName && !u.userLastName && <span className="text-muted-foreground italic">Sem nome</span>}
                            </p>
                            <p className="text-xs text-muted-foreground">{u.userEmail || "—"}</p>
                          </div>
                        </div>
                        <Button
                          size="sm"
                          variant="ghost"
                          className="gap-1.5 text-xs h-7 text-destructive"
                          disabled={unlinkMultiAccessMutation.isPending}
                          onClick={() => unlinkMultiAccessMutation.mutate({ userId: u.userId, restaurantId })}
                        >
                          <Unlink className="w-3 h-3" /> Remover
                        </Button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </TabsContent>
          </Tabs>
        </div>
      </div>

      {/* Multi-Access Link Dialog */}
      <Dialog open={isAddMultiAccessOpen} onOpenChange={setIsAddMultiAccessOpen}>
        <DialogContent className="sm:max-w-md bg-card border-border/30">
          <DialogHeader>
            <DialogTitle className="text-base">Adicionar Acesso de Rede</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <p className="text-xs text-muted-foreground">Selecione um usuário já existente no sistema para dar acesso adicional a este restaurante (sem alterar o restaurante primário do usuário).</p>
            <div>
              <Label className="text-xs mb-1.5 block">Selecionar Usuário</Label>
              <Select value={multiAccessUserId} onValueChange={setMultiAccessUserId}>
                <SelectTrigger className="h-9 text-xs bg-background border-border/30">
                  <SelectValue placeholder="Selecione um usuário..." />
                </SelectTrigger>
                <SelectContent>
                  {allRestaurantUsers
                    .filter((u: any) => !restaurantMultiUsers.some((mu: any) => mu.userId === u.id))
                    .map((u: any) => (
                      <SelectItem key={u.id} value={u.id} className="text-xs">
                        {u.email} {u.firstName ? `(${u.firstName} ${u.lastName || ""})`.trim() : ""}
                      </SelectItem>
                    ))}
                  {allRestaurantUsers.filter((u: any) => !restaurantMultiUsers.some((mu: any) => mu.userId === u.id)).length === 0 && (
                    <div className="px-2 py-3 text-xs text-muted-foreground text-center">Nenhum usuário disponível</div>
                  )}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" size="sm" className="text-xs" onClick={() => setIsAddMultiAccessOpen(false)}>Cancelar</Button>
            <Button
              size="sm"
              className="text-xs gap-1.5"
              disabled={!multiAccessUserId || linkMultiAccessMutation.isPending}
              onClick={() => linkMultiAccessMutation.mutate({ userId: multiAccessUserId, restaurantId })}
            >
              {linkMultiAccessMutation.isPending ? "Vinculando..." : "Vincular Acesso"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Link User Dialog */}
      <Dialog open={isLinkUserDialogOpen} onOpenChange={setIsLinkUserDialogOpen}>
        <DialogContent className="sm:max-w-md bg-card border-border/30">
          <DialogHeader>
            <DialogTitle className="text-base">Vincular Conta ao Local</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <div>
              <Label className="text-xs mb-1.5 block">Selecionar Usuário</Label>
              <Select value={selectedUserId} onValueChange={setSelectedUserId}>
                <SelectTrigger className="h-9 text-xs bg-background border-border/30">
                  <SelectValue placeholder="Selecione um usuário..." />
                </SelectTrigger>
                <SelectContent>
                  {availableUsers
                    .filter((u: any) => !linkedUsers.some((lu: any) => lu.id === u.id))
                    .map((u: any) => (
                      <SelectItem key={u.id} value={u.id} className="text-xs">
                        {u.email} {u.firstName ? `(${u.firstName} ${u.lastName || ""})`.trim() : ""}
                      </SelectItem>
                    ))}
                  {availableUsers.filter((u: any) => !linkedUsers.some((lu: any) => lu.id === u.id)).length === 0 && (
                    <div className="px-2 py-3 text-xs text-muted-foreground text-center">Nenhum usuário disponível</div>
                  )}
                </SelectContent>
              </Select>
              <p className="text-[10px] text-muted-foreground mt-1.5">O usuário será automaticamente atualizado para o papel "restaurante"</p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" size="sm" className="text-xs" onClick={() => setIsLinkUserDialogOpen(false)}>Cancelar</Button>
            <Button
              size="sm"
              className="text-xs gap-1.5"
              disabled={!selectedUserId || linkUserMutation.isPending}
              onClick={() => linkUserMutation.mutate({ userId: selectedUserId, restaurantId })}
            >
              {linkUserMutation.isPending ? "Vinculando..." : "Vincular"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Account Invite Dialog */}
      <Dialog open={isInviteDialogOpen} onOpenChange={(open) => { setIsInviteDialogOpen(open); if (!open) { setGeneratedInviteUrl(""); setInviteEmail(""); } }}>
        <DialogContent className="sm:max-w-md bg-card border-border/30">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2"><Send className="w-5 h-5 text-primary" /> Convidar Novo Usuário</DialogTitle>
          </DialogHeader>
          {!generatedInviteUrl ? (
            <>
              <div className="space-y-3 py-2">
                <div>
                  <Label className="text-xs mb-1.5 block">Email do convidado</Label>
                  <Input
                    type="email"
                    value={inviteEmail}
                    onChange={(e) => setInviteEmail(e.target.value)}
                    placeholder="email@exemplo.com"
                    className="bg-background border-border/30 h-9 text-sm"
                  />
                  <p className="text-[10px] text-muted-foreground mt-1.5">Um link de convite será gerado para você enviar ao parceiro</p>
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" size="sm" className="text-xs" onClick={() => setIsInviteDialogOpen(false)}>Cancelar</Button>
                <Button
                  size="sm"
                  className="text-xs gap-1.5"
                  disabled={!inviteEmail || generateAccountInviteMutation.isPending}
                  onClick={() => generateAccountInviteMutation.mutate({ restaurantId, email: inviteEmail })}
                >
                  {generateAccountInviteMutation.isPending ? "Gerando..." : "Gerar Convite"}
                </Button>
              </DialogFooter>
            </>
          ) : (
            <>
              <div className="space-y-4 py-2">
                <div className="flex items-center gap-2 text-emerald-400">
                  <CheckCircle className="w-5 h-5" />
                  <span className="text-sm font-medium">Convite gerado com sucesso!</span>
                </div>
                <div>
                  <Label className="text-xs mb-1.5 block">Link de convite</Label>
                  <div className="flex gap-2">
                    <Input
                      readOnly
                      value={generatedInviteUrl}
                      className="bg-background border-border/30 h-9 text-xs font-mono select-all"
                      onFocus={(e) => e.target.select()}
                    />
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-9 px-3 shrink-0 text-xs gap-1.5"
                      onClick={() => {
                        navigator.clipboard.writeText(generatedInviteUrl).then(() => {
                          toast.success("Link copiado!");
                        }).catch(() => {
                          toast.error("Não foi possível copiar. Selecione e copie manualmente.");
                        });
                      }}
                    >
                      <Copy className="w-3.5 h-3.5" /> Copiar
                    </Button>
                  </div>
                  <p className="text-[10px] text-muted-foreground mt-1.5">Envie este link para o parceiro criar a conta</p>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  className="w-full text-xs gap-1.5 border-emerald-500/30 text-emerald-400 hover:bg-emerald-500/10"
                  onClick={() => {
                    const msg = encodeURIComponent(`Olá! Você foi convidado para o portal Mesa Ads. Acesse o link para criar sua conta:\n\n${generatedInviteUrl}`);
                    window.open(`https://wa.me/?text=${msg}`, "_blank");
                  }}
                >
                  <ExternalLink className="w-3.5 h-3.5" /> Enviar por WhatsApp
                </Button>
              </div>
              <DialogFooter>
                <Button size="sm" className="text-xs" onClick={() => { setIsInviteDialogOpen(false); setGeneratedInviteUrl(""); setInviteEmail(""); }}>Fechar</Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* Payment Dialog */}
      <Dialog open={isPaymentDialogOpen} onOpenChange={setIsPaymentDialogOpen}>
        <DialogContent className="sm:max-w-md bg-card border-border/30">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2"><CreditCard className="w-5 h-5 text-primary" /> Novo Pagamento</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs">Mês Referência *</Label>
                <Input type="month" value={paymentForm.referenceMonth} onChange={(e) => setPaymentForm(p => ({ ...p, referenceMonth: e.target.value }))} className="bg-background border-border/30 h-9 text-sm" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Valor (R$) *</Label>
                <Input type="number" step="0.01" value={paymentForm.amount} onChange={(e) => setPaymentForm(p => ({ ...p, amount: e.target.value }))} className="bg-background border-border/30 h-9 text-sm" />
              </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs">Campanha</Label>
                <Select value={paymentForm.campaignId} onValueChange={(v) => setPaymentForm(p => ({ ...p, campaignId: v }))}>
                  <SelectTrigger className="bg-background border-border/30 h-9 text-sm"><SelectValue placeholder="Selecione" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Nenhuma</SelectItem>
                    {campaignsData.map((c) => (
                      <SelectItem key={c.campaignId} value={String(c.campaignId)}>{c.campaignName}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Status</Label>
                <Select value={paymentForm.status} onValueChange={(v) => setPaymentForm(p => ({ ...p, status: v }))}>
                  <SelectTrigger className="bg-background border-border/30 h-9 text-sm"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="pending">Pendente</SelectItem>
                    <SelectItem value="paid">Pago</SelectItem>
                    <SelectItem value="overdue">Atrasado</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Data do Pagamento</Label>
              <Input type="date" value={paymentForm.paymentDate} onChange={(e) => setPaymentForm(p => ({ ...p, paymentDate: e.target.value }))} className="bg-background border-border/30 h-9 text-sm" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Observações</Label>
              <Input value={paymentForm.notes} onChange={(e) => setPaymentForm(p => ({ ...p, notes: e.target.value }))} className="bg-background border-border/30 h-9 text-sm" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsPaymentDialogOpen(false)}>Cancelar</Button>
            <Button disabled={!paymentForm.amount || !paymentForm.referenceMonth} onClick={() => {
              addPaymentMutation.mutate({
                restaurantId,
                campaignId: paymentForm.campaignId && paymentForm.campaignId !== "none" ? parseInt(paymentForm.campaignId) : undefined,
                amount: paymentForm.amount,
                referenceMonth: paymentForm.referenceMonth,
                paymentDate: paymentForm.paymentDate || undefined,
                status: paymentForm.status,
                pixKey: restaurant.pixKey || undefined,
                notes: paymentForm.notes || undefined,
              });
            }}>Registrar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Photo Dialog */}
      <Dialog open={isPhotoDialogOpen} onOpenChange={setIsPhotoDialogOpen}>
        <DialogContent className="sm:max-w-md bg-card border-border/30">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2"><Camera className="w-5 h-5 text-primary" /> Adicionar Foto</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label className="text-xs">URL da Imagem *</Label>
              <Input value={photoForm.url} onChange={(e) => setPhotoForm(p => ({ ...p, url: e.target.value }))} placeholder="https://..." className="bg-background border-border/30 h-9 text-sm" />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs">Legenda</Label>
                <Input value={photoForm.caption} onChange={(e) => setPhotoForm(p => ({ ...p, caption: e.target.value }))} className="bg-background border-border/30 h-9 text-sm" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Tipo</Label>
                <Select value={photoForm.photoType} onValueChange={(v) => setPhotoForm(p => ({ ...p, photoType: v }))}>
                  <SelectTrigger className="bg-background border-border/30 h-9 text-sm"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="veiculacao">Veiculação</SelectItem>
                    <SelectItem value="fachada">Fachada</SelectItem>
                    <SelectItem value="interior">Interior</SelectItem>
                    <SelectItem value="cardapio">Cardápio</SelectItem>
                    <SelectItem value="outro">Outro</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            {photoForm.url && (
              <div className="rounded-lg border border-border/30 overflow-hidden">
                <img src={photoForm.url} alt="Preview" className="w-full max-h-48 object-cover" onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }} />
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsPhotoDialogOpen(false)}>Cancelar</Button>
            <Button disabled={!photoForm.url} onClick={() => {
              addPhotoMutation.mutate({
                restaurantId,
                url: photoForm.url,
                caption: photoForm.caption || undefined,
                photoType: photoForm.photoType,
              });
            }}>Adicionar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Branch Link Dialog */}
      <Dialog open={isBranchDialogOpen} onOpenChange={setIsBranchDialogOpen}>
        <DialogContent className="sm:max-w-md bg-card border-border/30">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2"><Link2 className="w-5 h-5 text-primary" /> Vincular Filial</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label className="text-xs">Selecione o restaurante para vincular como filial</Label>
              <Select value={selectedBranch} onValueChange={setSelectedBranch}>
                <SelectTrigger className="bg-background border-border/30 h-9 text-sm"><SelectValue placeholder="Selecione um restaurante" /></SelectTrigger>
                <SelectContent>
                  {availableForBranch.map((r) => (
                    <SelectItem key={r.id} value={String(r.id)}>{r.name} ({r.neighborhood})</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsBranchDialogOpen(false)}>Cancelar</Button>
            <Button disabled={!selectedBranch} onClick={() => {
              linkBranchMutation.mutate({ parentId: restaurantId, branchId: parseInt(selectedBranch) });
            }}>Vincular</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Term Dialog */}
      <Dialog open={isTermDialogOpen} onOpenChange={(open) => { setIsTermDialogOpen(open); if (!open) setEditingTermId(null); }}>
        <DialogContent className="sm:max-w-lg bg-card border-border/30 max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2"><FileText className="w-5 h-5 text-primary" /> {editingTermId ? "Editar Termo" : "Novo Termo"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs">Válido De</Label>
                <Input type="date" value={termForm.validFrom} onChange={(e) => setTermForm(p => ({ ...p, validFrom: e.target.value }))} className="bg-background border-border/30 h-9 text-sm" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Válido Até</Label>
                <Input type="date" value={termForm.validUntil} onChange={(e) => setTermForm(p => ({ ...p, validUntil: e.target.value }))} className="bg-background border-border/30 h-9 text-sm" />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Condições Gerais</Label>
              <textarea value={termForm.conditions} onChange={(e) => setTermForm(p => ({ ...p, conditions: e.target.value }))} rows={3} className="w-full rounded-md border border-border/30 bg-background px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Regra de Remuneração</Label>
              <textarea value={termForm.remunerationRule} onChange={(e) => setTermForm(p => ({ ...p, remunerationRule: e.target.value }))} rows={2} className="w-full rounded-md border border-border/30 bg-background px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2" />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs">Categorias Permitidas</Label>
                <Input value={termForm.allowedCategories} onChange={(e) => setTermForm(p => ({ ...p, allowedCategories: e.target.value }))} className="bg-background border-border/30 h-9 text-sm" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Categorias Bloqueadas</Label>
                <Input value={termForm.blockedCategories} onChange={(e) => setTermForm(p => ({ ...p, blockedCategories: e.target.value }))} className="bg-background border-border/30 h-9 text-sm" />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Obrigações do Local</Label>
              <textarea value={termForm.restaurantObligations} onChange={(e) => setTermForm(p => ({ ...p, restaurantObligations: e.target.value }))} rows={2} className="w-full rounded-md border border-border/30 bg-background px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Obrigações da Mesa Ads</Label>
              <textarea value={termForm.mesaObligations} onChange={(e) => setTermForm(p => ({ ...p, mesaObligations: e.target.value }))} rows={2} className="w-full rounded-md border border-border/30 bg-background px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setIsTermDialogOpen(false); setEditingTermId(null); }}>Cancelar</Button>
            <Button onClick={() => {
              const data = {
                conditions: termForm.conditions || undefined,
                remunerationRule: termForm.remunerationRule || undefined,
                allowedCategories: termForm.allowedCategories || undefined,
                blockedCategories: termForm.blockedCategories || undefined,
                restaurantObligations: termForm.restaurantObligations || undefined,
                mesaObligations: termForm.mesaObligations || undefined,
                validFrom: termForm.validFrom || undefined,
                validUntil: termForm.validUntil || undefined,
              };
              if (editingTermId) {
                updateTermMutation.mutate({ id: editingTermId, ...data });
              } else {
                createTermMutation.mutate({ restaurantId, ...data });
              }
            }}>{editingTermId ? "Salvar" : "Criar Termo"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Contact Dialog */}
      <Dialog open={contactDialogOpen} onOpenChange={(v) => { setContactDialogOpen(v); if (!v) setEditingContactId(null); }}>
        <DialogContent className="sm:max-w-md bg-card border-border/30">
          <DialogHeader>
            <DialogTitle className="text-base">{editingContactId ? "Editar Contato" : "Novo Contato"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <div>
              <Label className="text-xs mb-1.5 block">Nome *</Label>
              <Input value={contactForm.name} onChange={(e) => setContactForm({ ...contactForm, name: e.target.value })} className="bg-background border-border/30" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs mb-1.5 block">E-mail</Label>
                <Input value={contactForm.email} onChange={(e) => setContactForm({ ...contactForm, email: e.target.value })} className="bg-background border-border/30" />
              </div>
              <div>
                <Label className="text-xs mb-1.5 block">Telefone</Label>
                <Input value={contactForm.phone} onChange={(e) => setContactForm({ ...contactForm, phone: e.target.value })} className="bg-background border-border/30" />
              </div>
            </div>
            <div>
              <Label className="text-xs mb-1.5 block">Notas</Label>
              <Input value={contactForm.notes} onChange={(e) => setContactForm({ ...contactForm, notes: e.target.value })} className="bg-background border-border/30" />
            </div>
            <label className="flex items-center gap-2 text-xs cursor-pointer">
              <input type="checkbox" checked={contactForm.isPrimary} onChange={(e) => setContactForm({ ...contactForm, isPrimary: e.target.checked })} className="rounded" />
              Contato principal
            </label>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setContactDialogOpen(false); setEditingContactId(null); }}>Cancelar</Button>
            <Button onClick={() => {
              if (!contactForm.name.trim()) { toast.error("Nome é obrigatório"); return; }
              if (editingContactId) {
                updateContactMutation.mutate({ id: editingContactId, ...contactForm });
              } else {
                createContactMutation.mutate({ restaurantId, ...contactForm });
              }
            }}>{editingContactId ? "Salvar" : "Criar"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function KPICard({ label, value, icon, accent, warn }: { label: string; value: string; icon: React.ReactNode; accent?: boolean; warn?: boolean }) {
  return (
    <div className={`bg-card border rounded-lg p-4 ${warn ? "border-yellow-500/30" : accent ? "border-emerald-500/30" : "border-border/30"}`}>
      <div className="flex items-center justify-between mb-2">
        <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium">{label}</p>
        <div className={`${accent ? "text-emerald-400" : warn ? "text-yellow-400" : "text-muted-foreground"}`}>{icon}</div>
      </div>
      <p className={`text-xl font-bold font-mono ${accent ? "text-emerald-400" : warn ? "text-yellow-400" : ""}`}>{value}</p>
    </div>
  );
}

function LogoSection({ restaurant, onUpdated }: { restaurant: any; onUpdated: () => void }) {
  const [uploading, setUploading] = useState(false);
  const [rawImageSrc, setRawImageSrc] = useState<string | null>(null);
  const [cropOpen, setCropOpen] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileSelect = (file: File) => {
    if (file.type !== "image/png" && file.type !== "image/jpeg") {
      toast.error("Apenas arquivos PNG ou JPG são aceitos.");
      return;
    }
    if (file.size > 2 * 1024 * 1024) {
      toast.error("O arquivo deve ter no máximo 2MB.");
      return;
    }
    setRawImageSrc(URL.createObjectURL(file));
    setCropOpen(true);
  };

  const handleCropConfirm = async (croppedFile: File) => {
    setCropOpen(false);
    if (rawImageSrc) URL.revokeObjectURL(rawImageSrc);
    setRawImageSrc(null);
    setUploading(true);
    try {
      const formData = new FormData();
      formData.append("logo", croppedFile);
      formData.append("restaurantId", String(restaurant.id));
      const res = await fetch("/api/restaurant-logo/upload", {
        method: "POST",
        body: formData,
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error || "Erro ao fazer upload.");
        return;
      }
      toast.success("Foto de perfil atualizada!");
      onUpdated();
    } catch {
      toast.error("Erro ao fazer upload da foto de perfil.");
    } finally {
      setUploading(false);
    }
  };

  const handleCropCancel = () => {
    setCropOpen(false);
    if (rawImageSrc) URL.revokeObjectURL(rawImageSrc);
    setRawImageSrc(null);
  };

  return (
    <div className="bg-card border border-border/30 rounded-lg p-4">
      <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5 mb-3">
        <Image className="w-4 h-4" /> Foto de Perfil
      </h3>
      <div className="flex items-center gap-4">
        {restaurant.logoUrl ? (
          <>
            <img
              src={restaurant.logoUrl}
              alt={`Foto de perfil de ${restaurant.name}`}
              className="w-20 h-20 object-cover rounded-full border border-border/30 bg-background"
            />
            <div className="flex flex-col gap-2">
              <Button
                size="sm"
                variant="outline"
                className="text-xs gap-1.5"
                disabled={uploading}
                onClick={() => fileInputRef.current?.click()}
              >
                {uploading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Upload className="w-3.5 h-3.5" />}
                {uploading ? "Enviando..." : "Alterar"}
              </Button>
            </div>
          </>
        ) : (
          <label className={`flex items-center justify-center gap-2 px-6 py-4 rounded-lg border border-dashed border-border/40 bg-background cursor-pointer hover:border-border/60 transition-colors w-full ${uploading ? "opacity-50 pointer-events-none" : ""}`}>
            {uploading ? <Loader2 className="w-4 h-4 text-muted-foreground animate-spin" /> : <Upload className="w-4 h-4 text-muted-foreground" />}
            <span className="text-xs text-muted-foreground">
              {uploading ? "Enviando..." : "Clique para enviar a foto de perfil (PNG ou JPG, máx. 2MB)"}
            </span>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/png,image/jpeg"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) handleFileSelect(f);
                e.target.value = "";
              }}
            />
          </label>
        )}
        {restaurant.logoUrl && (
          <input
            ref={fileInputRef}
            type="file"
            accept="image/png,image/jpeg"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) handleFileSelect(f);
              e.target.value = "";
            }}
          />
        )}
      </div>
      {rawImageSrc && (
        <AvatarCropDialog
          open={cropOpen}
          imageSrc={rawImageSrc}
          onConfirm={handleCropConfirm}
          onCancel={handleCropCancel}
        />
      )}
    </div>
  );
}

function Card({ title, icon, children }: { title: string; icon?: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="bg-card border border-border/30 rounded-lg p-4 space-y-3">
      <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
        {icon} {title}
      </h3>
      {children}
    </div>
  );
}

function MiniStat({ label, value, accent, warn }: { label: string; value: string; accent?: boolean; warn?: boolean }) {
  return (
    <div>
      <p className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</p>
      <p className={`text-xs font-medium mt-0.5 ${accent ? "text-emerald-400" : warn ? "text-yellow-400" : ""}`}>{value}</p>
    </div>
  );
}

function InfoRow({ label, value, mono }: { label: string; value?: string; mono?: boolean }) {
  if (!value) return null;
  return (
    <div>
      <p className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</p>
      <p className={`text-xs mt-0.5 ${mono ? "font-mono" : ""}`}>{value}</p>
    </div>
  );
}
