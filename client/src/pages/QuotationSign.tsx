import { useState, useEffect } from "react";
import { useParams } from "wouter";
import { generateQuotationSignPdf } from "@/lib/generate-quotation-pdf";
import { Loader2, CheckCircle2, AlertCircle, FileDown } from "lucide-react";
import { formatIsoDateBR } from "@shared/billingSchedule";

interface QuotationItem {
  productName: string | null;
  quantity: number;
  unitPrice: string | null;
  totalPrice: string | null;
  unitLabelPlural: string | null;
}

interface QuotationData {
  quotation: any;
  serviceOrder: any;
  restaurants: any[];
  batches: any[];
  items: QuotationItem[];
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

const formatDate = (d: string) => formatIsoDateBR(d);

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
      billingSchedule: (data as any).billingSchedule || undefined,
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
    "w-full mt-1 px-3 py-2 bg-[hsl(0,0%,11%)] border border-[hsl(0,0%,18%)] text-white rounded-lg text-sm placeholder:text-[hsl(0,0%,35%)] focus:outline-none focus:ring-2 focus:ring-[#00e640]/40 focus:border-[#00e640]/60";

  if (loading) {
    return (
      <div className="min-h-screen w-full flex items-center justify-center" style={{ background: "hsl(0 0% 4%)" }}>
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="w-8 h-8 text-[#00e640] animate-spin" />
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
            <div className="w-16 h-16 rounded-full bg-[#00e640]/10 flex items-center justify-center mx-auto mb-5">
              <CheckCircle2 className="w-8 h-8 text-[#00e640]" />
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
            style={{ background: "radial-gradient(circle, #00e640 0%, transparent 70%)" }}
          />
        </div>
        <div className="relative w-full max-w-md px-6 text-center">
          <img src="/logo-white.png" alt="mesa.ads" className="h-8 mx-auto mb-8" />
          <div className="bg-[hsl(0,0%,7%)] border border-[hsl(0,0%,14%)] rounded-xl p-8">
            <div className="w-16 h-16 rounded-full bg-[#00e640]/10 flex items-center justify-center mx-auto mb-5">
              <CheckCircle2 className="w-8 h-8 text-[#00e640]" />
            </div>
            <h2 className="text-xl font-bold text-white mb-2">Assinatura realizada!</h2>
            <p className="text-sm text-[hsl(0,0%,50%)] mb-6 leading-relaxed">
              A Ordem de Serviço foi assinada com sucesso. O PDF foi baixado automaticamente.
            </p>
            <button
              onClick={() => downloadPdf()}
              className="inline-flex items-center justify-center gap-2 w-full h-10 bg-[#00e640] hover:bg-[#00c238] text-black font-semibold rounded-lg text-sm transition-colors"
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

  // Task #218 — o total geral (q.totalValue) já vem com BV/comissão de agência
  // embutido, mas os preços/un e totais por linha em quotation_items são
  // brutos. Derivamos um fator de escala (total final ÷ soma dos brutos) e o
  // aplicamos a cada item para que: preço/un × qtd = total da linha, e a soma
  // das linhas feche exatamente com o total geral exibido no rodapé.
  const grandTotal = parseFloat(q?.totalValue || q?.value || "0");
  const scaledItems = (() => {
    const items = data.items || [];
    const qtys = items.map((it) => it.quantity || 0);
    const rawTotals = items.map((it) => (it.totalPrice ? parseFloat(it.totalPrice) : 0));
    const rawUnits = items.map((it) => (it.unitPrice ? parseFloat(it.unitPrice) : 0));
    const grandCents = Math.round(grandTotal * 100);

    // Pesos para distribuir o total geral entre as linhas, em ordem de
    // preferência: totalPrice bruto → unitPrice×qtd → distribuição uniforme.
    // Garante que Σ(linhas) === total geral mesmo em dados legados onde os
    // totais por item estejam zerados/ausentes (evita a tela pública mostrar
    // soma das linhas diferente do total exibido no rodapé).
    let weights = rawTotals;
    let weightSum = weights.reduce((s, v) => s + v, 0);
    if (!(weightSum > 0)) {
      weights = items.map((_, i) => rawUnits[i] * qtys[i]);
      weightSum = weights.reduce((s, v) => s + v, 0);
    }
    if (!(weightSum > 0) && items.length > 0) {
      weights = items.map(() => 1);
      weightSum = items.length;
    }

    const distribute = grandTotal > 0 && weightSum > 0;
    const cents = distribute
      ? weights.map((w) => Math.round((w / weightSum) * grandCents))
      : rawTotals.map((r) => Math.round(r * 100));
    if (distribute) {
      // Joga a sobra/falta de arredondamento na última linha com peso > 0.
      const diff = grandCents - cents.reduce((s, v) => s + v, 0);
      if (diff !== 0) {
        for (let i = cents.length - 1; i >= 0; i--) {
          if (weights[i] > 0) {
            cents[i] += diff;
            break;
          }
        }
      }
    }

    return items.map((it, i) => {
      const lineTotal = cents[i] / 100;
      const qty = it.quantity || 0;
      const rawUnit = it.unitPrice ? parseFloat(it.unitPrice) : null;
      // Deriva o preço/un do total final da linha para garantir consistência
      // (un × qtd = total). Mantém o bruto se não houver quantidade.
      const unit = qty > 0 ? lineTotal / qty : rawUnit;
      return { ...it, scaledUnit: unit, scaledTotal: lineTotal };
    });
  })();

  return (
    <div className="min-h-screen w-full flex items-center justify-center py-12" style={{ background: "hsl(0 0% 4%)" }}>
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div
          className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] rounded-full opacity-[0.03]"
          style={{ background: "radial-gradient(circle, #00e640 0%, transparent 70%)" }}
        />
      </div>

      <div className="relative w-full max-w-lg px-6">
        <div className="text-center mb-8">
          <img src="/logo-white.png" alt="mesa.ads" className="h-8 mx-auto mb-6" />
          <p className="label-mono text-[10px] text-[#00e640]/90 mb-3">
            Assinatura digital
          </p>
          <h1 className="font-display text-3xl sm:text-4xl tracking-[-0.03em] leading-[1.02] text-white mb-2">
            Ordem de <span className="font-serif-italic-accent text-[#00e640]">Serviço</span>
          </h1>
          <p className="text-sm text-[hsl(0,0%,55%)] max-w-sm mx-auto">
            Revise os dados e assine digitalmente.
          </p>
        </div>

        <div className="bg-[hsl(0,0%,7%)] border border-[hsl(0,0%,14%)] rounded-xl p-6 space-y-6">
          <div>
            <h3 className="text-xs font-semibold text-[#00e640] uppercase tracking-wider mb-3">Dados da Cotação</h3>
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
            </div>
          </div>

          <div className="border-t border-[hsl(0,0%,14%)]" />

          {data.items && data.items.length > 0 ? (
            <>
              <div>
                <h3 className="text-xs font-semibold text-[#00e640] uppercase tracking-wider mb-3">Produtos do Orçamento</h3>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="text-[hsl(0,0%,40%)] text-xs border-b border-[hsl(0,0%,14%)]">
                        <th className="text-left pb-2 font-medium">Produto</th>
                        <th className="text-right pb-2 font-medium">Volume</th>
                        <th className="text-right pb-2 font-medium">Preço/un.</th>
                        <th className="text-right pb-2 font-medium">Total</th>
                      </tr>
                    </thead>
                    <tbody>
                      {scaledItems.map((item, i) => (
                        <tr key={i} className="border-b border-[hsl(0,0%,10%)]" data-testid={`linha-item-${i}`}>
                          <td className="py-2 text-white font-medium pr-3">{item.productName || "-"}</td>
                          <td className="py-2 text-white text-right whitespace-nowrap" data-testid={`item-qtd-${i}`}>
                            {item.quantity.toLocaleString("pt-BR")} {item.unitLabelPlural || "unidades"}
                          </td>
                          <td className="py-2 text-[hsl(0,0%,60%)] text-right whitespace-nowrap" data-testid={`item-unitario-${i}`}>
                            {item.scaledUnit != null
                              ? `R$ ${item.scaledUnit.toLocaleString("pt-BR", { minimumFractionDigits: 4, maximumFractionDigits: 4 })}`
                              : "-"}
                          </td>
                          <td className="py-2 text-white text-right whitespace-nowrap" data-testid={`item-total-${i}`}>
                            {item.scaledTotal != null ? formatCurrency(item.scaledTotal) : "-"}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot>
                      <tr className="text-xs text-[hsl(0,0%,45%)]">
                        <td className="pt-2" colSpan={1}>
                          {data.items.length} {data.items.length === 1 ? "produto" : "produtos"}
                        </td>
                        <td className="pt-2 text-right">
                          {data.items.reduce((s, it) => s + it.quantity, 0).toLocaleString("pt-BR")} quantidade total
                        </td>
                        <td />
                        <td className="pt-2 text-right text-white font-bold text-base" data-testid="grand-total">
                          {formatCurrency(parseFloat(q?.totalValue || q?.value || "0"))}
                        </td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              </div>
            </>
          ) : (
            <div>
              <h3 className="text-xs font-semibold text-[#00e640] uppercase tracking-wider mb-3">Financeiro</h3>
              <div className="flex justify-between text-sm">
                <span className="text-[hsl(0,0%,50%)]">Valor Total</span>
                <span className="text-white font-bold text-lg">
                  {formatCurrency(parseFloat(q?.totalValue || q?.value || "0"))}
                </span>
              </div>
            </div>
          )}

          <div className="border-t border-[hsl(0,0%,14%)]" />

          {(so?.periodStart || q?.periodStart) && (
            <>
              <div>
                <h3 className="text-xs font-semibold text-[#00e640] uppercase tracking-wider mb-3">Período</h3>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-[hsl(0,0%,50%)]">Início</span>
                    <span className="text-white font-medium" data-testid="periodo-inicio">{formatDate(so?.periodStart || q?.periodStart)}</span>
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
                <h3 className="text-xs font-semibold text-[#00e640] uppercase tracking-wider mb-3">
                  Locais ({data.restaurants.length})
                </h3>
                <div className="space-y-1.5">
                  {data.restaurants.map((r: any, i: number) => (
                    <div key={i} className="flex items-center gap-2 text-sm">
                      <div className="w-1.5 h-1.5 rounded-full bg-[#00e640]" />
                      <span className="text-white">{r.name || r.restaurantName || "-"}</span>
                    </div>
                  ))}
                </div>
              </div>
              <div className="border-t border-[hsl(0,0%,14%)]" />
            </>
          )}

          {(data as any).billingSchedule && (data as any).billingSchedule.length > 0 && (
            <>
              <div>
                <h3 className="text-xs font-semibold text-[#00e640] uppercase tracking-wider mb-3">Condições de pagamento</h3>
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-[hsl(0,0%,50%)] text-xs border-b border-[hsl(0,0%,14%)]">
                      <th className="text-left py-1.5">#</th>
                      <th className="text-left py-1.5">Vencimento</th>
                      <th className="text-right py-1.5">Valor</th>
                    </tr>
                  </thead>
                  <tbody>
                    {((data as any).billingSchedule as Array<{ sequence: number; amount: string; dueDate: string }>).map((it) => (
                      <tr key={it.sequence} className="border-b border-[hsl(0,0%,10%)]" data-testid={`parcela-${it.sequence}`}>
                        <td className="py-1.5 text-white font-mono">{it.sequence}</td>
                        <td className="py-1.5 text-white" data-testid={`parcela-venc-${it.sequence}`}>{formatDate(it.dueDate)}</td>
                        <td className="py-1.5 text-white text-right font-mono" data-testid={`parcela-valor-${it.sequence}`}>{formatCurrency(parseFloat(it.amount))}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="border-t border-[hsl(0,0%,14%)]" />
            </>
          )}

          <div>
            <h3 className="text-xs font-semibold text-[#00e640] uppercase tracking-wider mb-4">Assinatura Digital</h3>
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
                      ? "bg-[#00e640] border-[#00e640]"
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
                className="w-full h-11 bg-[#00e640] hover:bg-[#00c238] disabled:opacity-50 disabled:cursor-not-allowed text-black font-semibold rounded-lg text-sm transition-colors flex items-center justify-center gap-2"
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
