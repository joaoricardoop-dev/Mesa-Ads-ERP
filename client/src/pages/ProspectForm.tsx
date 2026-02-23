import { useState, useEffect } from "react";
import { useRoute, useLocation } from "wouter";

import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
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
  MessageCircle,
  CheckCircle2,
  AlertTriangle,
  Users,
  Briefcase,
  Calendar,
  DollarSign,
  FileText,
  Globe,
  Hash,
  Mail,
} from "lucide-react";

interface FormData {
  name: string;
  razaoSocial: string;
  cnpj: string;
  address: string;
  addressNumber: string;
  complemento: string;
  neighborhood: string;
  city: string;
  state: string;
  cep: string;
  email: string;
  contactName: string;
  contactPhone: string;
  whatsapp: string;
  instagram: string;
  porte: string;
  naturezaJuridica: string;
  atividadePrincipal: string;
  atividadesSecundarias: string;
  capitalSocial: string;
  dataAbertura: string;
  situacaoCadastral: string;
  tipoEstabelecimento: string;
  socios: string;
  status: "active" | "inactive";
}

const emptyForm: FormData = {
  name: "",
  razaoSocial: "",
  cnpj: "",
  address: "",
  addressNumber: "",
  complemento: "",
  neighborhood: "",
  city: "",
  state: "",
  cep: "",
  email: "",
  contactName: "",
  contactPhone: "",
  whatsapp: "",
  instagram: "",
  porte: "",
  naturezaJuridica: "",
  atividadePrincipal: "",
  atividadesSecundarias: "",
  capitalSocial: "",
  dataAbertura: "",
  situacaoCadastral: "",
  tipoEstabelecimento: "",
  socios: "",
  status: "active",
};

interface Socio {
  nome: string;
  qualificacao: string;
  dataEntrada: string;
  faixaEtaria: string;
}

interface AtividadeSecundaria {
  id: string;
  descricao: string;
}

export default function ProspectForm() {
  const [, navigate] = useLocation();
  const [matchNew] = useRoute("/prospeccao/novo");
  const [matchEdit, params] = useRoute("/prospeccao/:id");
  const editId = matchEdit && params?.id !== "novo" ? parseInt(params!.id) : null;
  const isEditing = editId !== null;

  const [form, setForm] = useState<FormData>(emptyForm);
  const [cnpjInput, setCnpjInput] = useState("");
  const [cnpjFetched, setCnpjFetched] = useState(false);
  const [sociosList, setSociosList] = useState<Socio[]>([]);
  const [atividadesSecList, setAtividadesSecList] = useState<AtividadeSecundaria[]>([]);
  const [step, setStep] = useState<"cnpj" | "form">(isEditing ? "form" : "cnpj");

  const utils = trpc.useUtils();

  const { data: existingRestaurant } = trpc.restaurant.get.useQuery(
    { id: editId! },
    { enabled: isEditing }
  );

  useEffect(() => {
    if (existingRestaurant) {
      setForm({
        name: existingRestaurant.name,
        razaoSocial: existingRestaurant.razaoSocial || "",
        cnpj: existingRestaurant.cnpj || "",
        address: existingRestaurant.address || "",
        addressNumber: existingRestaurant.addressNumber || "",
        complemento: existingRestaurant.complemento || "",
        neighborhood: existingRestaurant.neighborhood || "",
        city: existingRestaurant.city || "",
        state: existingRestaurant.state || "",
        cep: existingRestaurant.cep || "",
        email: existingRestaurant.email || "",
        contactName: existingRestaurant.contactName || "",
        contactPhone: existingRestaurant.contactPhone || "",
        whatsapp: existingRestaurant.whatsapp || "",
        instagram: existingRestaurant.instagram || "",
        porte: existingRestaurant.porte || "",
        naturezaJuridica: existingRestaurant.naturezaJuridica || "",
        atividadePrincipal: existingRestaurant.atividadePrincipal || "",
        atividadesSecundarias: existingRestaurant.atividadesSecundarias || "",
        capitalSocial: existingRestaurant.capitalSocial || "",
        dataAbertura: existingRestaurant.dataAbertura || "",
        situacaoCadastral: existingRestaurant.situacaoCadastral || "",
        tipoEstabelecimento: existingRestaurant.tipoEstabelecimento || "",
        socios: existingRestaurant.socios || "",
        status: existingRestaurant.status,
      });
      setCnpjInput(existingRestaurant.cnpj || "");
      if (existingRestaurant.socios) {
        try { setSociosList(JSON.parse(existingRestaurant.socios)); } catch {}
      }
      if (existingRestaurant.atividadesSecundarias) {
        try { setAtividadesSecList(JSON.parse(existingRestaurant.atividadesSecundarias)); } catch {}
      }
      setStep("form");
    }
  }, [existingRestaurant]);

  const cnpjClean = cnpjInput.replace(/\D/g, "");
  const { data: cnpjData, isFetching: isCnpjLoading, error: cnpjError, refetch: fetchCnpj } = trpc.cnpj.lookup.useQuery(
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
      const sociosData = d.socios || [];
      const ativSecData = d.atividadesSecundarias || [];
      setSociosList(sociosData);
      setAtividadesSecList(ativSecData);

      setForm({
        ...form,
        cnpj: formatCnpj(d.cnpj),
        name: d.nomeFantasia || d.razaoSocial || "",
        razaoSocial: d.razaoSocial,
        address: d.logradouro,
        addressNumber: d.numero,
        complemento: d.complemento,
        neighborhood: d.bairro,
        city: d.cidade,
        state: d.uf,
        cep: d.cep,
        email: d.email,
        contactPhone: d.telefone1,
        porte: d.porte,
        naturezaJuridica: d.naturezaJuridica,
        atividadePrincipal: d.atividadePrincipal,
        atividadesSecundarias: JSON.stringify(ativSecData),
        capitalSocial: d.capitalSocial,
        dataAbertura: d.dataAbertura,
        situacaoCadastral: d.situacaoCadastral,
        tipoEstabelecimento: d.tipoEstabelecimento,
        socios: JSON.stringify(sociosData),
      });
      setCnpjFetched(true);
      setStep("form");
      toast.success("Dados do CNPJ carregados!");
    } else if (result.error) {
      toast.error(result.error.message);
    }
  };

  const handleSkipCnpj = () => {
    setStep("form");
  };

  const createMutation = trpc.restaurant.create.useMutation({
    onSuccess: () => {
      utils.restaurant.list.invalidate();
      toast.success("Restaurante cadastrado!");
      navigate("/prospeccao");
    },
    onError: (err) => toast.error(`Erro: ${err.message}`),
  });

  const updateMutation = trpc.restaurant.update.useMutation({
    onSuccess: () => {
      utils.restaurant.list.invalidate();
      toast.success("Restaurante atualizado!");
      navigate("/prospeccao");
    },
    onError: (err) => toast.error(`Erro: ${err.message}`),
  });

  const handleSave = () => {
    if (!form.name.trim()) {
      toast.error("Nome é obrigatório");
      return;
    }

    const payload = {
      name: form.name,
      razaoSocial: form.razaoSocial || undefined,
      cnpj: form.cnpj || undefined,
      address: form.address || undefined,
      addressNumber: form.addressNumber || undefined,
      complemento: form.complemento || undefined,
      neighborhood: form.neighborhood || undefined,
      city: form.city || undefined,
      state: form.state || undefined,
      cep: form.cep || undefined,
      email: form.email || undefined,
      contactName: form.contactName || undefined,
      contactPhone: form.contactPhone || undefined,
      whatsapp: form.whatsapp || undefined,
      instagram: form.instagram || undefined,
      porte: form.porte || undefined,
      naturezaJuridica: form.naturezaJuridica || undefined,
      atividadePrincipal: form.atividadePrincipal || undefined,
      atividadesSecundarias: form.atividadesSecundarias || undefined,
      capitalSocial: form.capitalSocial || undefined,
      dataAbertura: form.dataAbertura || undefined,
      situacaoCadastral: form.situacaoCadastral || undefined,
      tipoEstabelecimento: form.tipoEstabelecimento || undefined,
      socios: form.socios || undefined,
      status: form.status,
    };

    if (isEditing) {
      updateMutation.mutate({ id: editId!, ...payload });
    } else {
      createMutation.mutate(payload);
    }
  };

  return (
    <div className="h-full flex flex-col overflow-hidden">
      <div className="flex-1 overflow-y-auto">
        <div className="border-b border-border/20 bg-card/30 px-4 lg:px-6 py-4">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0" onClick={() => navigate("/prospeccao")}>
              <ArrowLeft className="w-4 h-4" />
            </Button>
            <div>
              <h1 className="text-lg font-bold tracking-tight">
                {isEditing ? "Editar Restaurante" : "Novo Restaurante"}
              </h1>
              <p className="text-xs text-muted-foreground mt-0.5">
                {step === "cnpj" ? "Comece informando o CNPJ para buscar dados automaticamente" : "Preencha ou corrija os dados do restaurante"}
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
                      Informe o CNPJ para preencher automaticamente os dados da Receita Federal
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
                  <Section icon={<Building2 className="w-4 h-4" />} title="Identificação">
                    <div className="grid grid-cols-2 gap-3">
                      <Field label="Nome Fantasia *" value={form.name} onChange={(v) => setForm(p => ({ ...p, name: v }))} />
                      <Field label="CNPJ" value={form.cnpj} onChange={(v) => setForm(p => ({ ...p, cnpj: v }))} placeholder="00.000.000/0000-00" mono />
                    </div>
                    <Field label="Razão Social" value={form.razaoSocial} onChange={(v) => setForm(p => ({ ...p, razaoSocial: v }))} />
                    <div className="grid grid-cols-3 gap-3">
                      <Field label="Tipo" value={form.tipoEstabelecimento} onChange={(v) => setForm(p => ({ ...p, tipoEstabelecimento: v }))} disabled />
                      <Field label="Situação Cadastral" value={form.situacaoCadastral} onChange={(v) => setForm(p => ({ ...p, situacaoCadastral: v }))} disabled />
                      <Field label="Data Abertura" value={form.dataAbertura} onChange={(v) => setForm(p => ({ ...p, dataAbertura: v }))} disabled />
                    </div>
                  </Section>

                  <Section icon={<MapPin className="w-4 h-4" />} title="Endereço">
                    <div className="grid grid-cols-[1fr_100px] gap-3">
                      <Field label="Logradouro" value={form.address} onChange={(v) => setForm(p => ({ ...p, address: v }))} />
                      <Field label="N°" value={form.addressNumber} onChange={(v) => setForm(p => ({ ...p, addressNumber: v }))} />
                    </div>
                    <Field label="Complemento" value={form.complemento} onChange={(v) => setForm(p => ({ ...p, complemento: v }))} />
                    <div className="grid grid-cols-3 gap-3">
                      <Field label="Bairro" value={form.neighborhood} onChange={(v) => setForm(p => ({ ...p, neighborhood: v }))} />
                      <Field label="Cidade" value={form.city} onChange={(v) => setForm(p => ({ ...p, city: v }))} />
                      <div className="grid grid-cols-[1fr_60px] gap-2">
                        <Field label="CEP" value={form.cep} onChange={(v) => setForm(p => ({ ...p, cep: v }))} />
                        <Field label="UF" value={form.state} onChange={(v) => setForm(p => ({ ...p, state: v.toUpperCase().slice(0, 2) }))} maxLength={2} />
                      </div>
                    </div>
                  </Section>

                  <Section icon={<Phone className="w-4 h-4" />} title="Contato">
                    <div className="grid grid-cols-2 gap-3">
                      <Field label="Nome do Contato" value={form.contactName} onChange={(v) => setForm(p => ({ ...p, contactName: v }))} />
                      <Field label="Telefone" value={form.contactPhone} onChange={(v) => setForm(p => ({ ...p, contactPhone: v }))} />
                    </div>
                    <div className="grid grid-cols-3 gap-3">
                      <Field label="WhatsApp" value={form.whatsapp} onChange={(v) => setForm(p => ({ ...p, whatsapp: v }))} placeholder="(00) 00000-0000" icon={<MessageCircle className="w-3 h-3 text-green-500" />} />
                      <Field label="Email" value={form.email} onChange={(v) => setForm(p => ({ ...p, email: v }))} icon={<Mail className="w-3 h-3" />} />
                      <Field label="Instagram" value={form.instagram} onChange={(v) => setForm(p => ({ ...p, instagram: v }))} placeholder="@usuario" icon={<Instagram className="w-3 h-3 text-pink-500" />} />
                    </div>
                  </Section>

                  <Section icon={<Briefcase className="w-4 h-4" />} title="Dados Empresariais">
                    <div className="grid grid-cols-2 gap-3">
                      <Field label="Porte" value={form.porte} onChange={(v) => setForm(p => ({ ...p, porte: v }))} disabled />
                      <Field label="Capital Social" value={form.capitalSocial} onChange={(v) => setForm(p => ({ ...p, capitalSocial: v }))} disabled mono />
                    </div>
                    <Field label="Natureza Jurídica" value={form.naturezaJuridica} onChange={(v) => setForm(p => ({ ...p, naturezaJuridica: v }))} disabled />
                    <Field label="Atividade Principal (CNAE)" value={form.atividadePrincipal} onChange={(v) => setForm(p => ({ ...p, atividadePrincipal: v }))} disabled />
                  </Section>

                  {atividadesSecList.length > 0 && (
                    <Section icon={<FileText className="w-4 h-4" />} title="Atividades Secundárias">
                      <div className="space-y-1">
                        {atividadesSecList.map((a, i) => (
                          <div key={i} className="flex items-start gap-2 text-xs py-1.5 border-b border-border/10 last:border-0">
                            <Badge variant="outline" className="text-[10px] shrink-0 font-mono">{a.id}</Badge>
                            <span className="text-muted-foreground">{a.descricao}</span>
                          </div>
                        ))}
                      </div>
                    </Section>
                  )}

                  <div className="flex items-center gap-3 pt-2">
                    <div className="w-48">
                      <Label className="text-xs text-muted-foreground mb-1.5 block">Status</Label>
                      <Select value={form.status} onValueChange={(v) => setForm(p => ({ ...p, status: v as "active" | "inactive" }))}>
                        <SelectTrigger className="bg-card border-border/30"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="active">Ativo</SelectItem>
                          <SelectItem value="inactive">Inativo</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
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
                            {s.faixaEtaria && (
                              <p className="text-[10px] text-muted-foreground">{s.faixaEtaria}</p>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {form.cnpj && (
                    <div className="bg-card border border-border/30 rounded-xl p-4 space-y-3">
                      <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                        <Globe className="w-3.5 h-3.5" /> Resumo CNPJ
                      </h3>
                      <div className="space-y-2">
                        <InfoRow label="CNPJ" value={form.cnpj} />
                        <InfoRow label="Tipo" value={form.tipoEstabelecimento} />
                        <InfoRow label="Situação" value={form.situacaoCadastral} />
                        <InfoRow label="Porte" value={form.porte} />
                        <InfoRow label="Abertura" value={form.dataAbertura} />
                        <InfoRow label="Capital" value={form.capitalSocial ? `R$ ${Number(form.capitalSocial).toLocaleString("pt-BR")}` : ""} />
                      </div>
                    </div>
                  )}
                </div>
              </div>

              <div className="flex items-center justify-between pt-4 border-t border-border/20">
                <Button variant="outline" onClick={() => navigate("/prospeccao")}>Cancelar</Button>
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

function Field({ label, value, onChange, placeholder, mono, disabled, maxLength, icon }: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  mono?: boolean;
  disabled?: boolean;
  maxLength?: number;
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
        className={`bg-background border-border/30 h-9 text-sm ${mono ? "font-mono" : ""} ${disabled ? "opacity-60" : ""}`}
        disabled={disabled}
        maxLength={maxLength}
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

function formatCnpj(cnpj: string): string {
  const c = cnpj.replace(/\D/g, "");
  if (c.length !== 14) return cnpj;
  return `${c.slice(0,2)}.${c.slice(2,5)}.${c.slice(5,8)}/${c.slice(8,12)}-${c.slice(12)}`;
}
