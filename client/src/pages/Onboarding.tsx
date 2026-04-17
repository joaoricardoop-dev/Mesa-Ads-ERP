import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { getTracking, clearTracking } from "@/lib/utmTracking";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { Building2, MapPin, Phone, ChevronRight, ChevronLeft, Check, Loader2 } from "lucide-react";

const SEGMENTS = [
  "Alimentação",
  "Bebidas",
  "Tecnologia",
  "Saúde",
  "Educação",
  "Entretenimento",
  "Serviços",
  "Varejo",
  "Automotivo",
  "Imobiliário",
  "Outros",
];

const STATES = [
  "AC","AL","AP","AM","BA","CE","DF","ES","GO","MA","MT","MS","MG",
  "PA","PB","PR","PE","PI","RJ","RN","RS","RO","RR","SC","SP","SE","TO",
];

interface OnboardingProps {
  userName: string | null;
}

export default function Onboarding({ userName }: OnboardingProps) {
  const [step, setStep] = useState(0);
  const queryClient = useQueryClient();
  const [form, setForm] = useState({
    name: "",
    company: "",
    razaoSocial: "",
    cnpj: "",
    address: "",
    addressNumber: "",
    neighborhood: "",
    city: "",
    state: "",
    cep: "",
    contactPhone: "",
    contactEmail: "",
    instagram: "",
    segment: "",
  });

  const completeMutation = trpc.portal.completeOnboarding.useMutation({
    onSuccess: () => {
      toast.success("Cadastro concluído! Bem-vindo ao mesa.ads");
      clearTracking();
      queryClient.invalidateQueries({ queryKey: ["/api/auth/user"] });
    },
    onError: (err) => {
      toast.error(err.message || "Erro ao finalizar cadastro");
    },
  });

  const update = (field: string, value: string) => setForm((f) => ({ ...f, [field]: value }));

  const canAdvance = () => {
    if (step === 0) return form.name.trim().length > 0;
    return true;
  };

  const handleFinish = () => {
    if (!form.name.trim()) {
      toast.error("Nome da empresa é obrigatório");
      return;
    }
    const data: any = {};
    for (const [k, v] of Object.entries(form)) {
      if (v.trim()) data[k] = v.trim();
    }
    const tracking = getTracking();
    if (tracking) {
      const t: any = {};
      for (const [k, v] of Object.entries(tracking)) {
        if (k === "capturedAt") continue;
        if (typeof v === "string" && v.trim()) t[k] = v;
      }
      if (Object.keys(t).length > 0) data.tracking = t;
    }
    completeMutation.mutate(data);
  };

  const steps = [
    { icon: Building2, title: "Dados da Empresa", subtitle: "Informações de identificação" },
    { icon: MapPin, title: "Endereço", subtitle: "Localização do seu negócio" },
    { icon: Phone, title: "Contato", subtitle: "Como podemos falar com você" },
  ];

  return (
    <div className="min-h-screen w-full flex items-center justify-center" style={{ background: "hsl(0 0% 4%)" }}>
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div
          className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] rounded-full opacity-[0.03]"
          style={{ background: "radial-gradient(circle, #27d803 0%, transparent 70%)" }}
        />
      </div>

      <div className="relative w-full max-w-lg px-6 py-12">
        <div className="text-center mb-8">
          <img src="/logo-white.png" alt="mesa.ads" className="h-8 mx-auto mb-6" />
          <h1 className="text-2xl font-bold text-white mb-1">
            {userName ? `Olá, ${userName}!` : "Bem-vindo!"}
          </h1>
          <p className="text-sm text-[hsl(0,0%,50%)]">
            Complete seu cadastro para acessar o portal do anunciante
          </p>
        </div>

        <div className="flex items-center justify-center gap-2 mb-8">
          {steps.map((s, i) => (
            <div key={i} className="flex items-center gap-2">
              <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold transition-colors ${
                i < step ? "bg-[#27d803] text-black" :
                i === step ? "bg-[#27d803]/20 text-[#27d803] ring-2 ring-[#27d803]/50" :
                "bg-[hsl(0,0%,11%)] text-[hsl(0,0%,40%)]"
              }`}>
                {i < step ? <Check className="w-4 h-4" /> : i + 1}
              </div>
              {i < steps.length - 1 && (
                <div className={`w-12 h-0.5 ${i < step ? "bg-[#27d803]" : "bg-[hsl(0,0%,14%)]"}`} />
              )}
            </div>
          ))}
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
                <Label className="text-xs text-[hsl(0,0%,55%)]">Nome / Marca *</Label>
                <Input value={form.name} onChange={(e) => update("name", e.target.value)} placeholder="Ex: Burger King" className="mt-1 bg-[hsl(0,0%,11%)] border-[hsl(0,0%,18%)] text-white" />
              </div>
              <div>
                <Label className="text-xs text-[hsl(0,0%,55%)]">Nome Fantasia</Label>
                <Input value={form.company} onChange={(e) => update("company", e.target.value)} placeholder="Nome fantasia da empresa" className="mt-1 bg-[hsl(0,0%,11%)] border-[hsl(0,0%,18%)] text-white" />
              </div>
              <div>
                <Label className="text-xs text-[hsl(0,0%,55%)]">Razão Social</Label>
                <Input value={form.razaoSocial} onChange={(e) => update("razaoSocial", e.target.value)} placeholder="Razão social completa" className="mt-1 bg-[hsl(0,0%,11%)] border-[hsl(0,0%,18%)] text-white" />
              </div>
              <div>
                <Label className="text-xs text-[hsl(0,0%,55%)]">CNPJ</Label>
                <Input value={form.cnpj} onChange={(e) => update("cnpj", e.target.value)} placeholder="00.000.000/0000-00" className="mt-1 bg-[hsl(0,0%,11%)] border-[hsl(0,0%,18%)] text-white" />
              </div>
            </div>
          )}

          {step === 1 && (
            <div className="space-y-4">
              <div className="grid grid-cols-3 gap-3">
                <div className="col-span-2">
                  <Label className="text-xs text-[hsl(0,0%,55%)]">Logradouro</Label>
                  <Input value={form.address} onChange={(e) => update("address", e.target.value)} placeholder="Rua, Av..." className="mt-1 bg-[hsl(0,0%,11%)] border-[hsl(0,0%,18%)] text-white" />
                </div>
                <div>
                  <Label className="text-xs text-[hsl(0,0%,55%)]">N°</Label>
                  <Input value={form.addressNumber} onChange={(e) => update("addressNumber", e.target.value)} placeholder="123" className="mt-1 bg-[hsl(0,0%,11%)] border-[hsl(0,0%,18%)] text-white" />
                </div>
              </div>
              <div>
                <Label className="text-xs text-[hsl(0,0%,55%)]">Bairro</Label>
                <Input value={form.neighborhood} onChange={(e) => update("neighborhood", e.target.value)} placeholder="Bairro" className="mt-1 bg-[hsl(0,0%,11%)] border-[hsl(0,0%,18%)] text-white" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label className="text-xs text-[hsl(0,0%,55%)]">Cidade</Label>
                  <Input value={form.city} onChange={(e) => update("city", e.target.value)} placeholder="Cidade" className="mt-1 bg-[hsl(0,0%,11%)] border-[hsl(0,0%,18%)] text-white" />
                </div>
                <div>
                  <Label className="text-xs text-[hsl(0,0%,55%)]">UF</Label>
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
                <Label className="text-xs text-[hsl(0,0%,55%)]">CEP</Label>
                <Input value={form.cep} onChange={(e) => update("cep", e.target.value)} placeholder="00000-000" className="mt-1 bg-[hsl(0,0%,11%)] border-[hsl(0,0%,18%)] text-white" />
              </div>
            </div>
          )}

          {step === 2 && (
            <div className="space-y-4">
              <div>
                <Label className="text-xs text-[hsl(0,0%,55%)]">Telefone</Label>
                <Input value={form.contactPhone} onChange={(e) => update("contactPhone", e.target.value)} placeholder="(11) 99999-9999" className="mt-1 bg-[hsl(0,0%,11%)] border-[hsl(0,0%,18%)] text-white" />
              </div>
              <div>
                <Label className="text-xs text-[hsl(0,0%,55%)]">E-mail de contato</Label>
                <Input value={form.contactEmail} onChange={(e) => update("contactEmail", e.target.value)} placeholder="contato@empresa.com" className="mt-1 bg-[hsl(0,0%,11%)] border-[hsl(0,0%,18%)] text-white" />
              </div>
              <div>
                <Label className="text-xs text-[hsl(0,0%,55%)]">Instagram</Label>
                <Input value={form.instagram} onChange={(e) => update("instagram", e.target.value)} placeholder="@empresa" className="mt-1 bg-[hsl(0,0%,11%)] border-[hsl(0,0%,18%)] text-white" />
              </div>
              <div>
                <Label className="text-xs text-[hsl(0,0%,55%)]">Segmento</Label>
                <Select value={form.segment} onValueChange={(v) => update("segment", v)}>
                  <SelectTrigger className="mt-1 bg-[hsl(0,0%,11%)] border-[hsl(0,0%,18%)] text-white">
                    <SelectValue placeholder="Selecione o segmento" />
                  </SelectTrigger>
                  <SelectContent>
                    {SEGMENTS.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>
          )}

          <div className="flex items-center justify-between mt-6 pt-4 border-t border-[hsl(0,0%,14%)]">
            {step > 0 ? (
              <Button variant="ghost" size="sm" onClick={() => setStep(step - 1)} className="text-[hsl(0,0%,55%)] hover:text-white">
                <ChevronLeft className="w-4 h-4 mr-1" />
                Voltar
              </Button>
            ) : <div />}

            {step < 2 ? (
              <Button
                size="sm"
                onClick={() => setStep(step + 1)}
                disabled={!canAdvance()}
                className="bg-[#27d803] hover:bg-[#22c003] text-black font-medium"
              >
                Próximo
                <ChevronRight className="w-4 h-4 ml-1" />
              </Button>
            ) : (
              <Button
                size="sm"
                onClick={handleFinish}
                disabled={completeMutation.isPending || !form.name.trim()}
                className="bg-[#27d803] hover:bg-[#22c003] text-black font-medium"
              >
                {completeMutation.isPending ? (
                  <><Loader2 className="w-4 h-4 mr-1 animate-spin" /> Salvando...</>
                ) : (
                  <><Check className="w-4 h-4 mr-1" /> Concluir Cadastro</>
                )}
              </Button>
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
