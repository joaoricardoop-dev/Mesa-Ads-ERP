import { useState, useEffect } from "react";
import { useParams } from "wouter";
import { generateQuotationSignPdf } from "@/lib/generate-quotation-pdf";
import { Loader2, CheckCircle2, AlertCircle, FileDown } from "lucide-react";

interface QuotationData {
  quotation: any;
  serviceOrder: any;
  restaurants: any[];
  batches: any[];
}

interface SignResult {
  signedAt: string;
  signatureHash: string;
}

const formatCpf = (value: string) => {
  const digits = value.replace(/\D/g, "").slice(0, 11);
  if (digits.length <= 3) return digits;
  if (digits.length <= 6) return `${digits.slice(0, 3)}.${digits.slice(3)}`;
  if (digits.length <= 9) return `${digits.slice(0, 3)}.${digits.slice(3, 6)}.${digits.slice(6)}`;
  return `${digits.slice(0, 3)}.${digits.slice(3, 6)}.${digits.slice(6, 9)}-${digits.slice(9)}`;
};

const formatCurrency = (value: number) =>
  `R$ ${value.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

const formatDate = (d: string) => {
  try {
    return new Date(d).toLocaleDateString("pt-BR");
  } catch {
    return d;
  }
};

export default function QuotationSign() {
  const { token } = useParams<{ token: string }>();
  const [data, setData] = useState<QuotationData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [alreadySigned, setAlreadySigned] = useState(false);
  const [signerName, setSignerName] = useState("");
  const [signerCpf, setSignerCpf] = useState("");
  const [accepted, setAccepted] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [signResult, setSignResult] = useState<SignResult | null>(null);

  useEffect(() => {
    if (!token) return;
    fetch(`/api/public-signing/quotation/${token}`)
      .then(async (res) => {
        if (res.status === 404) {
          setError("Link inválido ou expirado.");
          return;
        }
        const json = await res.json();
        if (!res.ok) {
          if (json.alreadySigned) {
            setAlreadySigned(true);
          } else {
            setError(json.error || "Erro ao carregar dados.");
          }
          return;
        }
        setData(json);
      })
      .catch(() => setError("Erro de conexão. Tente novamente."))
      .finally(() => setLoading(false));
  }, [token]);

  const downloadPdf = (result?: SignResult) => {
    if (!data) return;
    const r = result || signResult;
    if (!r) return;
    const q = data.quotation;
    const so = data.serviceOrder;
    generateQuotationSignPdf({
      orderNumber: so?.orderNumber || so?.id?.toString() || "-",
      quotationNumber: q?.quotationNumber || q?.id?.toString() || "-",
      quotationName: q?.name || q?.quotationName || "-",
      description: q?.description || undefined,
      totalValue: q?.totalValue || q?.value || 0,
      coasterVolume: q?.coasterVolume || q?.volume || 0,
      periodStart: so?.periodStart || q?.periodStart || "",
      periodEnd: so?.periodEnd || q?.periodEnd || "",
      restaurants: (data.restaurants || []).map((r: any) => r.name || r.restaurantName || "-"),
      signerName,
      signerCpf,
      signedAt: r.signedAt,
      signatureHash: r.signatureHash,
    });
  };

  const handleSubmit = async () => {
    setSubmitError(null);
    const cpfClean = signerCpf.replace(/\D/g, "");
    if (!signerName.trim()) {
      setSubmitError("Informe seu nome completo.");
      return;
    }
    if (cpfClean.length !== 11) {
      setSubmitError("CPF inválido.");
      return;
    }
    if (!accepted) {
      setSubmitError("Você deve aceitar os termos para continuar.");
      return;
    }
    setSubmitting(true);
    try {
      const res = await fetch(`/api/public-signing/quotation/${token}/sign`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ signerName: signerName.trim(), signerCpf: cpfClean }),
      });
      const json = await res.json();
      if (!res.ok) {
        setSubmitError(json.error || "Erro ao assinar.");
        return;
      }
      const result: SignResult = {
        signedAt: json.signedAt || new Date().toISOString(),
        signatureHash: json.signatureHash || "",
      };
      setSignResult(result);
      setTimeout(() => downloadPdf(result), 500);
    } catch {
      setSubmitError("Erro de conexão. Tente novamente.");
    } finally {
      setSubmitting(false);
    }
  };

  const inputClass =
    "w-full mt-1 px-3 py-2 bg-[hsl(0,0%,11%)] border border-[hsl(0,0%,18%)] text-white rounded-lg text-sm placeholder:text-[hsl(0,0%,35%)] focus:outline-none focus:ring-2 focus:ring-[#27d803]/40 focus:border-[#27d803]/60";

  if (loading) {
    return (
      <div className="min-h-screen w-full flex items-center justify-center" style={{ background: "hsl(0 0% 4%)" }}>
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="w-8 h-8 text-[#27d803] animate-spin" />
          <p className="text-sm text-[hsl(0,0%,50%)]">Carregando...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen w-full flex items-center justify-center" style={{ background: "hsl(0 0% 4%)" }}>
        <div className="relative w-full max-w-md px-6 text-center">
          <img src="/logo-white.png" alt="mesa.ads" className="h-8 mx-auto mb-8" />
          <div className="bg-[hsl(0,0%,7%)] border border-[hsl(0,0%,14%)] rounded-xl p-8">
            <div className="w-16 h-16 rounded-full bg-red-500/10 flex items-center justify-center mx-auto mb-5">
              <AlertCircle className="w-8 h-8 text-red-400" />
            </div>
            <h2 className="text-xl font-bold text-white mb-2">Erro</h2>
            <p className="text-sm text-[hsl(0,0%,50%)] leading-relaxed">{error}</p>
          </div>
          <p className="mt-6 text-[11px]" style={{ color: "hsl(0 0% 30%)" }}>
            mesa.ads &copy; {new Date().getFullYear()}
          </p>
        </div>
      </div>
    );
  }

  if (alreadySigned) {
    return (
      <div className="min-h-screen w-full flex items-center justify-center" style={{ background: "hsl(0 0% 4%)" }}>
        <div className="relative w-full max-w-md px-6 text-center">
          <img src="/logo-white.png" alt="mesa.ads" className="h-8 mx-auto mb-8" />
          <div className="bg-[hsl(0,0%,7%)] border border-[hsl(0,0%,14%)] rounded-xl p-8">
            <div className="w-16 h-16 rounded-full bg-[#27d803]/10 flex items-center justify-center mx-auto mb-5">
              <CheckCircle2 className="w-8 h-8 text-[#27d803]" />
            </div>
            <h2 className="text-xl font-bold text-white mb-2">Já assinada</h2>
            <p className="text-sm text-[hsl(0,0%,50%)] leading-relaxed">
              Esta cotação já foi assinada anteriormente.
            </p>
          </div>
          <p className="mt-6 text-[11px]" style={{ color: "hsl(0 0% 30%)" }}>
            mesa.ads &copy; {new Date().getFullYear()}
          </p>
        </div>
      </div>
    );
  }

  if (signResult) {
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
            <h2 className="text-xl font-bold text-white mb-2">Assinatura realizada!</h2>
            <p className="text-sm text-[hsl(0,0%,50%)] mb-6 leading-relaxed">
              A Ordem de Serviço foi assinada com sucesso. O PDF foi baixado automaticamente.
            </p>
            <button
              onClick={() => downloadPdf()}
              className="inline-flex items-center justify-center gap-2 w-full h-10 bg-[#27d803] hover:bg-[#22c003] text-black font-semibold rounded-lg text-sm transition-colors"
            >
              <FileDown className="w-4 h-4" />
              Baixar PDF novamente
            </button>
          </div>
          <p className="mt-6 text-[11px]" style={{ color: "hsl(0 0% 30%)" }}>
            mesa.ads &copy; {new Date().getFullYear()}
          </p>
        </div>
      </div>
    );
  }

  if (!data) return null;

  const q = data.quotation;
  const so = data.serviceOrder;

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
          <h1 className="text-2xl font-bold text-white mb-1">Ordem de Serviço</h1>
          <p className="text-sm text-[hsl(0,0%,50%)]">
            Revise os dados e assine digitalmente
          </p>
        </div>

        <div className="bg-[hsl(0,0%,7%)] border border-[hsl(0,0%,14%)] rounded-xl p-6 space-y-6">
          <div>
            <h3 className="text-xs font-semibold text-[#27d803] uppercase tracking-wider mb-3">Dados da Cotação</h3>
            <div className="space-y-2 text-sm">
              {so && (
                <div className="flex justify-between">
                  <span className="text-[hsl(0,0%,50%)]">OS Nº</span>
                  <span className="text-white font-medium">#{so.orderNumber || so.id}</span>
                </div>
              )}
              <div className="flex justify-between">
                <span className="text-[hsl(0,0%,50%)]">Cotação</span>
                <span className="text-white font-medium">#{q?.quotationNumber || q?.id}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-[hsl(0,0%,50%)]">Nome</span>
                <span className="text-white font-medium">{q?.name || q?.quotationName || "-"}</span>
              </div>
              {q?.description && (
                <div className="flex justify-between">
                  <span className="text-[hsl(0,0%,50%)]">Descrição</span>
                  <span className="text-white font-medium text-right max-w-[60%]">{q.description}</span>
                </div>
              )}
              <div className="flex justify-between">
                <span className="text-[hsl(0,0%,50%)]">Volume</span>
                <span className="text-white font-medium">
                  {(q?.coasterVolume || q?.volume || 0).toLocaleString("pt-BR")} bolachas
                </span>
              </div>
            </div>
          </div>

          <div className="border-t border-[hsl(0,0%,14%)]" />

          <div>
            <h3 className="text-xs font-semibold text-[#27d803] uppercase tracking-wider mb-3">Financeiro</h3>
            <div className="flex justify-between text-sm">
              <span className="text-[hsl(0,0%,50%)]">Valor Total</span>
              <span className="text-white font-bold text-lg">
                {formatCurrency(q?.totalValue || q?.value || 0)}
              </span>
            </div>
          </div>

          <div className="border-t border-[hsl(0,0%,14%)]" />

          {(so?.periodStart || q?.periodStart) && (
            <>
              <div>
                <h3 className="text-xs font-semibold text-[#27d803] uppercase tracking-wider mb-3">Período</h3>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-[hsl(0,0%,50%)]">Início</span>
                    <span className="text-white font-medium">{formatDate(so?.periodStart || q?.periodStart)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-[hsl(0,0%,50%)]">Fim</span>
                    <span className="text-white font-medium">{formatDate(so?.periodEnd || q?.periodEnd)}</span>
                  </div>
                </div>
              </div>
              <div className="border-t border-[hsl(0,0%,14%)]" />
            </>
          )}

          {data.restaurants && data.restaurants.length > 0 && (
            <>
              <div>
                <h3 className="text-xs font-semibold text-[#27d803] uppercase tracking-wider mb-3">
                  Locais ({data.restaurants.length})
                </h3>
                <div className="space-y-1.5">
                  {data.restaurants.map((r: any, i: number) => (
                    <div key={i} className="flex items-center gap-2 text-sm">
                      <div className="w-1.5 h-1.5 rounded-full bg-[#27d803]" />
                      <span className="text-white">{r.name || r.restaurantName || "-"}</span>
                    </div>
                  ))}
                </div>
              </div>
              <div className="border-t border-[hsl(0,0%,14%)]" />
            </>
          )}

          <div>
            <h3 className="text-xs font-semibold text-[#27d803] uppercase tracking-wider mb-4">Assinatura Digital</h3>
            <div className="space-y-4">
              <div>
                <label className="text-xs text-[hsl(0,0%,55%)] font-medium">Nome Completo *</label>
                <input
                  type="text"
                  value={signerName}
                  onChange={(e) => setSignerName(e.target.value)}
                  placeholder="Seu nome completo"
                  className={inputClass}
                />
              </div>
              <div>
                <label className="text-xs text-[hsl(0,0%,55%)] font-medium">CPF *</label>
                <input
                  type="text"
                  value={signerCpf}
                  onChange={(e) => setSignerCpf(formatCpf(e.target.value))}
                  placeholder="000.000.000-00"
                  className={inputClass}
                  inputMode="numeric"
                />
              </div>
              <label className="flex items-start gap-3 cursor-pointer group">
                <div
                  className={`mt-0.5 w-5 h-5 rounded border-2 flex items-center justify-center flex-shrink-0 transition-colors ${
                    accepted
                      ? "bg-[#27d803] border-[#27d803]"
                      : "border-[hsl(0,0%,30%)] group-hover:border-[hsl(0,0%,45%)]"
                  }`}
                  onClick={() => setAccepted(!accepted)}
                >
                  {accepted && (
                    <svg className="w-3 h-3 text-black" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                    </svg>
                  )}
                </div>
                <span className="text-xs text-[hsl(0,0%,55%)] leading-relaxed" onClick={() => setAccepted(!accepted)}>
                  Li e aceito os termos desta Ordem de Serviço
                </span>
              </label>

              {submitError && (
                <div className="flex items-center gap-2 p-3 bg-red-500/10 border border-red-500/20 rounded-lg">
                  <AlertCircle className="w-4 h-4 text-red-400 flex-shrink-0" />
                  <p className="text-xs text-red-400">{submitError}</p>
                </div>
              )}

              <button
                onClick={handleSubmit}
                disabled={submitting}
                className="w-full h-11 bg-[#27d803] hover:bg-[#22c003] disabled:opacity-50 disabled:cursor-not-allowed text-black font-semibold rounded-lg text-sm transition-colors flex items-center justify-center gap-2"
              >
                {submitting ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Assinando...
                  </>
                ) : (
                  "Assinar Ordem de Serviço"
                )}
              </button>
            </div>
          </div>
        </div>

        <p className="text-center mt-6 text-[11px]" style={{ color: "hsl(0 0% 30%)" }}>
          mesa.ads &copy; {new Date().getFullYear()} &mdash; Plataforma de gestão
        </p>
      </div>
    </div>
  );
}
