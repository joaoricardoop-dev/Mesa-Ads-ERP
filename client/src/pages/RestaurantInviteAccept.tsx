import { useState, useEffect } from "react";
import { useParams } from "wouter";
import { toast } from "sonner";
import DOMPurify from "dompurify";
import {
  Eye,
  EyeOff,
  Loader2,
  CheckCircle2,
  AlertTriangle,
  Building2,
  MapPin,
  FileText,
  User,
  Mail,
  Lock,
  CreditCard,
  ArrowRight,
} from "lucide-react";

interface RestaurantData {
  id: number;
  name: string;
  address: string;
  neighborhood: string;
  city: string;
  state: string;
  cnpj: string;
  commissionPercent: string;
}

interface TermData {
  id: number;
  termNumber: string;
  validFrom: string | null;
  validUntil: string | null;
}

interface InviteData {
  restaurant: RestaurantData;
  term: TermData;
  termContent: string;
}

type PageState = "loading" | "form" | "success" | "error";

export default function RestaurantInviteAccept() {
  const params = useParams<{ token: string }>();
  const token = params.token || "";

  const [pageState, setPageState] = useState<PageState>("loading");
  const [errorMessage, setErrorMessage] = useState("");
  const [inviteData, setInviteData] = useState<InviteData | null>(null);

  const [acceptedByName, setAcceptedByName] = useState("");
  const [acceptedByCpf, setAcceptedByCpf] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [termsAccepted, setTermsAccepted] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!token) {
      setErrorMessage("Token de convite não fornecido.");
      setPageState("error");
      return;
    }

    fetch(`/api/restaurant-onboarding/invite/${token}`)
      .then(async (res) => {
        const data = await res.json();
        if (!res.ok) {
          setErrorMessage(data.error || "Convite inválido.");
          setPageState("error");
          return;
        }
        setInviteData(data);
        setPageState("form");
      })
      .catch(() => {
        setErrorMessage("Erro ao carregar convite. Tente novamente.");
        setPageState("error");
      });
  }, [token]);

  function formatCpf(value: string) {
    const digits = value.replace(/\D/g, "").slice(0, 11);
    if (digits.length <= 3) return digits;
    if (digits.length <= 6) return `${digits.slice(0, 3)}.${digits.slice(3)}`;
    if (digits.length <= 9) return `${digits.slice(0, 3)}.${digits.slice(3, 6)}.${digits.slice(6)}`;
    return `${digits.slice(0, 3)}.${digits.slice(3, 6)}.${digits.slice(6, 9)}-${digits.slice(9)}`;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    if (!termsAccepted) {
      toast.error("Você precisa aceitar os termos de parceria.");
      return;
    }

    const cpfDigits = acceptedByCpf.replace(/\D/g, "");
    if (cpfDigits.length < 11) {
      toast.error("CPF inválido. Informe os 11 dígitos.");
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch("/api/restaurant-onboarding/accept-invite", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          token,
          acceptedByName,
          acceptedByCpf: cpfDigits,
          email,
          password,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error || "Erro ao processar cadastro.");
        return;
      }

      setPageState("success");
    } catch {
      toast.error("Erro de conexão. Tente novamente.");
    } finally {
      setSubmitting(false);
    }
  }

  if (pageState === "loading") {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: "hsl(0 0% 4%)" }}>
        <div className="flex flex-col items-center gap-4">
          <img src="/logo-white.png" alt="mesa.ads" className="h-8 mb-2" />
          <Loader2 className="w-8 h-8 animate-spin" style={{ color: "#27d803" }} />
          <p className="text-sm" style={{ color: "hsl(0 0% 50%)" }}>Carregando convite...</p>
        </div>
      </div>
    );
  }

  if (pageState === "error") {
    return (
      <div className="min-h-screen flex items-center justify-center p-6" style={{ background: "hsl(0 0% 4%)" }}>
        <div className="max-w-md w-full text-center">
          <img src="/logo-white.png" alt="mesa.ads" className="h-8 mx-auto mb-8" />
          <div
            className="rounded-2xl p-8"
            style={{ background: "hsl(0 0% 7%)", border: "1px solid hsl(0 0% 14%)" }}
          >
            <div className="w-16 h-16 rounded-full bg-amber-500/10 flex items-center justify-center mx-auto mb-5">
              <AlertTriangle className="w-8 h-8 text-amber-400" />
            </div>
            <h2 className="text-xl font-bold mb-2" style={{ color: "hsl(0 0% 95%)" }}>
              Convite indisponível
            </h2>
            <p className="text-sm leading-relaxed mb-6" style={{ color: "hsl(0 0% 50%)" }}>
              {errorMessage}
            </p>
            <a
              href="/"
              className="inline-block px-6 py-2.5 rounded-lg text-sm font-medium transition-colors"
              style={{ background: "hsl(0 0% 14%)", color: "hsl(0 0% 70%)" }}
            >
              Ir para página inicial
            </a>
          </div>
        </div>
      </div>
    );
  }

  if (pageState === "success") {
    return (
      <div className="min-h-screen flex items-center justify-center p-6" style={{ background: "hsl(0 0% 4%)" }}>
        <div className="max-w-md w-full text-center">
          <img src="/logo-white.png" alt="mesa.ads" className="h-8 mx-auto mb-8" />
          <div
            className="rounded-2xl p-8"
            style={{ background: "hsl(0 0% 7%)", border: "1px solid hsl(0 0% 14%)" }}
          >
            <div className="w-16 h-16 rounded-full bg-green-500/10 flex items-center justify-center mx-auto mb-5">
              <CheckCircle2 className="w-8 h-8 text-green-400" />
            </div>
            <h2 className="text-xl font-bold mb-2" style={{ color: "hsl(0 0% 95%)" }}>
              Conta criada com sucesso!
            </h2>
            <p className="text-sm leading-relaxed mb-6" style={{ color: "hsl(0 0% 50%)" }}>
              Seus termos de parceria foram aceitos e sua conta foi criada. Agora você pode acessar a plataforma mesa.ads.
            </p>
            <a
              href="/"
              className="inline-flex items-center justify-center gap-2 w-full py-3 rounded-xl font-semibold text-sm text-black transition-opacity hover:opacity-90"
              style={{ background: "#27d803" }}
            >
              Entrar na plataforma
              <ArrowRight className="w-4 h-4" />
            </a>
          </div>
          <p className="mt-6 text-[11px]" style={{ color: "hsl(0 0% 30%)" }}>
            mesa.ads &copy; {new Date().getFullYear()} &mdash; Plataforma de gestão
          </p>
        </div>
      </div>
    );
  }

  const restaurant = inviteData!.restaurant;
  const term = inviteData!.term;
  const termContent = inviteData!.termContent;

  return (
    <div className="min-h-screen" style={{ background: "hsl(0 0% 4%)" }}>
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div
          className="absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-[400px] rounded-full opacity-[0.05]"
          style={{ background: "radial-gradient(ellipse, #27d803 0%, transparent 70%)" }}
        />
      </div>

      <div className="relative max-w-2xl mx-auto px-6 py-12">
        <div className="text-center mb-10">
          <img src="/logo-white.png" alt="mesa.ads" className="h-8 mx-auto mb-6" />
          <h1 className="text-2xl md:text-3xl font-bold mb-2" style={{ color: "hsl(0 0% 95%)" }}>
            Convite de Parceria
          </h1>
          <p className="text-sm" style={{ color: "hsl(0 0% 50%)" }}>
            Revise os dados e aceite os termos para criar sua conta
          </p>
        </div>

        <div
          className="rounded-2xl p-6 md:p-8 mb-6"
          style={{ background: "hsl(0 0% 7%)", border: "1px solid hsl(0 0% 14%)" }}
        >
          <div className="flex items-center gap-3 mb-6">
            <div className="w-10 h-10 rounded-lg flex items-center justify-center" style={{ background: "hsl(0 0% 11%)" }}>
              <Building2 className="w-5 h-5" style={{ color: "#27d803" }} />
            </div>
            <div>
              <h2 className="font-semibold" style={{ color: "hsl(0 0% 95%)" }}>Dados do Estabelecimento</h2>
              <p className="text-xs" style={{ color: "hsl(0 0% 50%)" }}>Informações do seu restaurante</p>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <InfoField label="Nome" value={restaurant.name} />
            <InfoField label="CNPJ" value={restaurant.cnpj || "—"} />
            <InfoField label="Endereço" value={restaurant.address || "—"} icon={<MapPin className="w-3.5 h-3.5" />} />
            <InfoField label="Bairro" value={restaurant.neighborhood || "—"} />
            <InfoField label="Cidade" value={restaurant.city || "—"} />
            <InfoField label="Estado" value={restaurant.state || "—"} />
            <InfoField label="Comissão" value={`${restaurant.commissionPercent || "20"}%`} />
            <InfoField label="Termo Nº" value={term.termNumber} />
          </div>
        </div>

        <div
          className="rounded-2xl p-6 md:p-8 mb-6"
          style={{ background: "hsl(0 0% 7%)", border: "1px solid hsl(0 0% 14%)" }}
        >
          <div className="flex items-center gap-3 mb-6">
            <div className="w-10 h-10 rounded-lg flex items-center justify-center" style={{ background: "hsl(0 0% 11%)" }}>
              <FileText className="w-5 h-5" style={{ color: "#27d803" }} />
            </div>
            <div>
              <h2 className="font-semibold" style={{ color: "hsl(0 0% 95%)" }}>Termos de Parceria</h2>
              <p className="text-xs" style={{ color: "hsl(0 0% 50%)" }}>Leia atentamente antes de aceitar</p>
            </div>
          </div>

          <div
            className="rounded-lg p-5 max-h-80 overflow-y-auto text-sm leading-relaxed prose prose-sm prose-invert max-w-none [&_h1]:text-sm [&_h1]:font-bold [&_h1]:mb-1 [&_h2]:text-xs [&_h2]:font-bold [&_h2]:mb-1 [&_h3]:text-xs [&_h3]:font-semibold [&_p]:mb-1 [&_ul]:list-disc [&_ul]:pl-4 [&_ul]:mb-1 [&_ol]:list-decimal [&_ol]:pl-4 [&_ol]:mb-1 [&_li]:mb-0.5"
            style={{
              background: "hsl(0 0% 4%)",
              border: "1px solid hsl(0 0% 11%)",
              color: "hsl(0 0% 70%)",
            }}
            dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(termContent) }}
          />

          <label className="flex items-start gap-3 mt-5 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={termsAccepted}
              onChange={(e) => setTermsAccepted(e.target.checked)}
              className="mt-0.5 w-4 h-4 rounded accent-[#27d803]"
            />
            <span className="text-sm" style={{ color: "hsl(0 0% 70%)" }}>
              Li e aceito os <span className="font-semibold" style={{ color: "#27d803" }}>Termos de Parceria</span> acima
            </span>
          </label>
        </div>

        <form onSubmit={handleSubmit}>
          <div
            className="rounded-2xl p-6 md:p-8 mb-6"
            style={{ background: "hsl(0 0% 7%)", border: "1px solid hsl(0 0% 14%)" }}
          >
            <div className="flex items-center gap-3 mb-6">
              <div className="w-10 h-10 rounded-lg flex items-center justify-center" style={{ background: "hsl(0 0% 11%)" }}>
                <User className="w-5 h-5" style={{ color: "#27d803" }} />
              </div>
              <div>
                <h2 className="font-semibold" style={{ color: "hsl(0 0% 95%)" }}>Dados do Responsável</h2>
                <p className="text-xs" style={{ color: "hsl(0 0% 50%)" }}>Informações para validade jurídica do aceite</p>
              </div>
            </div>

            <div className="space-y-4">
              <FormField
                label="Nome completo do responsável"
                icon={<User className="w-4 h-4" />}
                required
              >
                <input
                  type="text"
                  value={acceptedByName}
                  onChange={(e) => setAcceptedByName(e.target.value)}
                  placeholder="Nome completo"
                  required
                  className="w-full h-10 pl-10 pr-3 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#27d803]"
                  style={{ background: "hsl(0 0% 11%)", border: "1px solid hsl(0 0% 18%)", color: "hsl(0 0% 95%)" }}
                />
              </FormField>

              <FormField
                label="CPF do responsável"
                icon={<CreditCard className="w-4 h-4" />}
                required
              >
                <input
                  type="text"
                  value={acceptedByCpf}
                  onChange={(e) => setAcceptedByCpf(formatCpf(e.target.value))}
                  placeholder="000.000.000-00"
                  required
                  className="w-full h-10 pl-10 pr-3 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#27d803]"
                  style={{ background: "hsl(0 0% 11%)", border: "1px solid hsl(0 0% 18%)", color: "hsl(0 0% 95%)" }}
                />
              </FormField>

              <FormField
                label="E-mail"
                icon={<Mail className="w-4 h-4" />}
                required
              >
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="seu@email.com"
                  required
                  className="w-full h-10 pl-10 pr-3 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#27d803]"
                  style={{ background: "hsl(0 0% 11%)", border: "1px solid hsl(0 0% 18%)", color: "hsl(0 0% 95%)" }}
                />
              </FormField>

              <FormField
                label="Senha"
                icon={<Lock className="w-4 h-4" />}
                required
              >
                <div className="relative">
                  <input
                    type={showPassword ? "text" : "password"}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Mínimo 6 caracteres"
                    required
                    minLength={6}
                    className="w-full h-10 pl-10 pr-10 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#27d803]"
                    style={{ background: "hsl(0 0% 11%)", border: "1px solid hsl(0 0% 18%)", color: "hsl(0 0% 95%)" }}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2"
                    style={{ color: "hsl(0 0% 40%)" }}
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </FormField>
            </div>
          </div>

          <button
            type="submit"
            disabled={submitting || !termsAccepted || !acceptedByName || !acceptedByCpf || !email || !password}
            className="w-full py-3.5 rounded-xl font-bold text-sm text-black transition-opacity hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            style={{ background: "#27d803" }}
          >
            {submitting ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Processando...
              </>
            ) : (
              <>
                Aceitar termos e criar conta
                <ArrowRight className="w-4 h-4" />
              </>
            )}
          </button>
        </form>

        <p className="text-center mt-8 text-[11px]" style={{ color: "hsl(0 0% 30%)" }}>
          mesa.ads &copy; {new Date().getFullYear()} &mdash; Plataforma de gestão
        </p>
      </div>
    </div>
  );
}

function InfoField({ label, value, icon }: { label: string; value: string; icon?: React.ReactNode }) {
  return (
    <div>
      <p className="text-[11px] font-medium mb-1" style={{ color: "hsl(0 0% 40%)" }}>{label}</p>
      <p className="text-sm flex items-center gap-1.5" style={{ color: "hsl(0 0% 80%)" }}>
        {icon}
        {value}
      </p>
    </div>
  );
}

function FormField({
  label,
  icon,
  required,
  children,
}: {
  label: string;
  icon: React.ReactNode;
  required?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label className="text-xs font-semibold block mb-1.5" style={{ color: "hsl(0 0% 50%)" }}>
        {label} {required && <span style={{ color: "#27d803" }}>*</span>}
      </label>
      <div className="relative">
        <div className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: "hsl(0 0% 40%)" }}>
          {icon}
        </div>
        {children}
      </div>
    </div>
  );
}
