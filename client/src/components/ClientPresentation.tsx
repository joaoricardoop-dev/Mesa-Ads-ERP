import { useState, useEffect, useCallback } from "react";
import { X, ChevronLeft, ChevronRight } from "lucide-react";
import { formatCurrency } from "@/lib/format";

import imgCoverCoaster from "@assets/Trailer_KpNOR6CH_1773789838816.png";
import imgPinkCoasters from "@assets/ChatGPT_Image_11_de_mar._de_2026,_17_49_06_1773789838815.png";
import imgBeerTable from "@assets/Trailer_HITYrhQ7_1773789838815.png";
import imgHandGlass from "@assets/Trailer_NP7Tu7wL_1773789838816.png";
import imgRoundTable from "@assets/WhatsApp_Image_2026-03-10_at_11.40.27_1773789838816.jpeg";
import imgBrandSlide from "@assets/WhatsApp_Image_2026-03-10_at_14.41.19_1773789838817.jpeg";

interface QuotationItem {
  id: number;
  productName?: string | null;
  quantity?: number | null;
  unitPrice?: string | null;
  totalValue?: string | null;
  semanas?: number | null;
}

interface Quotation {
  quotationNumber?: string;
  clientName?: string | null;
  leadName?: string | null;
  clientCompany?: string | null;
  leadCompany?: string | null;
  totalValue?: string | null;
  isBonificada?: boolean;
  hasPartnerDiscount?: boolean;
  coasterVolume?: number | null;
  cycles?: number | null;
}

interface Props {
  isOpen: boolean;
  onClose: () => void;
  quotation: Quotation;
  quotationItems: QuotationItem[];
}

const BRAND_PINK = "#E91E8C";
const BRAND_GREEN = "#B9FF4B";

function Stat({ value, label, source }: { value: string; label: string; source?: string }) {
  return (
    <div className="flex flex-col">
      <span className="text-5xl md:text-6xl font-black leading-none" style={{ color: BRAND_GREEN }}>{value}</span>
      <span className="text-base md:text-lg text-white/80 mt-2 leading-snug max-w-[200px]">{label}</span>
      {source && <span className="text-xs text-white/40 mt-1">Fonte: {source}</span>}
    </div>
  );
}

function StatPink({ value, label, source }: { value: string; label: string; source?: string }) {
  return (
    <div className="flex flex-col">
      <span className="text-5xl md:text-6xl font-black leading-none" style={{ color: BRAND_PINK }}>{value}</span>
      <span className="text-base md:text-lg text-white/80 mt-2 leading-snug max-w-[200px]">{label}</span>
      {source && <span className="text-xs text-white/40 mt-1">Fonte: {source}</span>}
    </div>
  );
}

function Step({ num, title, desc }: { num: string; title: string; desc: string }) {
  return (
    <div className="flex gap-4 items-start">
      <span className="text-4xl font-black shrink-0 leading-none" style={{ color: BRAND_PINK }}>{num}</span>
      <div>
        <p className="text-lg font-bold text-white">{title}</p>
        <p className="text-sm text-white/60 mt-1 leading-relaxed">{desc}</p>
      </div>
    </div>
  );
}

export default function ClientPresentation({ isOpen, onClose, quotation, quotationItems }: Props) {
  const [slide, setSlide] = useState(0);

  const clientName = quotation.clientName || quotation.leadName || "Cliente";
  const company = quotation.clientCompany || quotation.leadCompany || "";
  const totalValue = Number(quotation.totalValue || 0);
  const isBonificada = quotation.isBonificada;

  const slides = [
    "cover",
    "problema",
    "oportunidade",
    "como-funciona",
    "rede",
    "proposta",
    "condicoes",
  ];

  const prev = useCallback(() => setSlide((s) => Math.max(0, s - 1)), []);
  const next = useCallback(() => setSlide((s) => Math.min(slides.length - 1, s + 1)), [slides.length]);

  useEffect(() => {
    if (!isOpen) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "ArrowRight" || e.key === "ArrowDown" || e.key === " ") next();
      if (e.key === "ArrowLeft" || e.key === "ArrowUp") prev();
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [isOpen, next, prev, onClose]);

  useEffect(() => {
    if (isOpen) setSlide(0);
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[100] bg-black flex flex-col select-none">

      {/* Nav bar */}
      <div className="absolute top-0 left-0 right-0 z-20 flex items-center justify-between px-6 py-4">
        <div className="flex gap-1.5">
          {slides.map((_, i) => (
            <button
              key={i}
              onClick={() => setSlide(i)}
              className="h-1 rounded-full transition-all duration-300"
              style={{
                width: i === slide ? 28 : 8,
                background: i === slide ? BRAND_PINK : "rgba(255,255,255,0.3)",
              }}
            />
          ))}
        </div>
        <button
          onClick={onClose}
          className="text-white/50 hover:text-white transition-colors p-1 rounded-lg hover:bg-white/10"
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      {/* Slides */}
      <div className="flex-1 relative overflow-hidden">

        {/* ── 1. COVER ── */}
        {slide === 0 && (
          <div className="absolute inset-0 flex">
            <div
              className="absolute inset-0 bg-cover bg-center"
              style={{ backgroundImage: `url(${imgCoverCoaster})` }}
            />
            <div className="absolute inset-0 bg-gradient-to-r from-black via-black/80 to-black/30" />
            <div className="relative z-10 flex flex-col justify-center px-12 md:px-24 max-w-3xl">
              <p className="text-sm font-bold tracking-[0.2em] uppercase mb-6" style={{ color: BRAND_PINK }}>
                mesa.ads
              </p>
              <h1 className="text-5xl md:text-7xl font-black text-white leading-tight">
                A sua marca<br />
                <span style={{ color: BRAND_PINK }}>na mesa</span><br />
                do seu cliente.
              </h1>
              {(clientName !== "Cliente" || company) && (
                <div className="mt-10 border-l-2 pl-4" style={{ borderColor: BRAND_GREEN }}>
                  <p className="text-white/50 text-sm uppercase tracking-widest">Proposta para</p>
                  <p className="text-white text-xl font-bold mt-1">{company || clientName}</p>
                  {company && <p className="text-white/60 text-sm">{clientName}</p>}
                </div>
              )}
            </div>
          </div>
        )}

        {/* ── 2. PROBLEMA ── */}
        {slide === 1 && (
          <div className="absolute inset-0 bg-black flex flex-col justify-center px-10 md:px-20">
            <p className="text-xs font-bold tracking-[0.2em] uppercase mb-4 text-white/40">O problema</p>
            <h2 className="text-4xl md:text-6xl font-black text-white leading-tight mb-16">
              A atenção está curta.<br />
              <span className="text-white/50">E cada vez mais cara.</span>
            </h2>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-8 md:gap-12">
              <StatPink value="9h13" label="tempo médio do brasileiro online por dia" source="Data Rare Portal" />
              <StatPink value="R$37,9bi" label="gastos em mídia digital no Brasil" source="Kantar Ibope" />
              <StatPink value="78%" label="das pessoas pulam anúncios online" source="CNDL" />
              <StatPink value="21%" label="acham anúncios digitais relevantes" source="Serasa Experian" />
            </div>
            <p className="mt-16 text-lg text-white/60 font-medium max-w-2xl">
              Não falta mídia. Falta atenção de verdade <span className="text-white">no momento certo.</span>
            </p>
          </div>
        )}

        {/* ── 3. OPORTUNIDADE ── */}
        {slide === 2 && (
          <div className="absolute inset-0 flex">
            <div
              className="hidden md:block absolute right-0 top-0 bottom-0 w-2/5 bg-cover bg-center"
              style={{ backgroundImage: `url(${imgBeerTable})` }}
            />
            <div className="absolute right-0 top-0 bottom-0 w-2/5 bg-gradient-to-r from-black to-transparent hidden md:block" />
            <div className="relative z-10 flex flex-col justify-center px-10 md:px-20 max-w-3xl">
              <p className="text-xs font-bold tracking-[0.2em] uppercase mb-4 text-white/40">A oportunidade</p>
              <h2 className="text-4xl md:text-5xl font-black text-white leading-tight mb-12">
                A mesa tem <span style={{ color: BRAND_GREEN }}>tempo</span>,<br />
                <span style={{ color: BRAND_GREEN }}>conversa</span> e contexto.
              </h2>
              <div className="grid grid-cols-2 gap-8">
                <Stat value="74,4min" label="por dia que as pessoas passam comendo e bebendo" source="NRA" />
                <Stat value="55min" label="janela real de uma refeição típica do brasileiro" source="Wharton" />
                <Stat value="2h20" label="tempo médio em happy hours e bares" source="Saturday Night" />
                <Stat value="1,9seg" label="tempo médio de atenção em anúncios digitais" source="Lumen Research" />
              </div>
              <div className="mt-10 inline-block">
                <p className="text-sm text-white/60">Coaster = <span className="text-white font-semibold">repetição natural.</span></p>
                <p className="text-sm text-white/40 mt-1">A marca é vista várias vezes durante o consumo — não 1x só.</p>
              </div>
            </div>
          </div>
        )}

        {/* ── 4. COMO FUNCIONA ── */}
        {slide === 3 && (
          <div className="absolute inset-0 flex">
            <div
              className="hidden md:block absolute right-0 top-0 bottom-0 w-2/5 bg-cover bg-center"
              style={{ backgroundImage: `url(${imgHandGlass})` }}
            />
            <div className="absolute right-0 top-0 bottom-0 w-2/5 bg-gradient-to-r from-black to-transparent hidden md:block" />
            <div className="relative z-10 flex flex-col justify-center px-10 md:px-20 max-w-2xl">
              <p className="text-xs font-bold tracking-[0.2em] uppercase mb-4 text-white/40">Como funciona</p>
              <h2 className="text-4xl md:text-5xl font-black text-white leading-tight mb-12">
                Simples, rápido<br />e <span style={{ color: BRAND_PINK }}>sem complicação.</span>
              </h2>
              <div className="flex flex-col gap-10">
                <Step
                  num="01"
                  title="Você escolhe onde anunciar"
                  desc="Defina o plano e escolha os bares e restaurantes que mais combinam com o seu público."
                />
                <Step
                  num="02"
                  title="A Mesa.ads produz a campanha"
                  desc="Nossa equipe cria a arte do seu coaster. Depois ele é impresso e preparado para entrega."
                />
                <Step
                  num="03"
                  title="A campanha vai para as mesas"
                  desc="Os coasters são distribuídos nos locais escolhidos. A Mesa Ads acompanha e envia fotos semanais como prova."
                />
              </div>
              <p className="mt-10 text-sm text-white/40">Cada ciclo de campanha fica ativo por <span className="text-white/70">4 semanas.</span></p>
            </div>
          </div>
        )}

        {/* ── 5. REDE ── */}
        {slide === 4 && (
          <div className="absolute inset-0 flex">
            <div
              className="absolute inset-0 bg-cover bg-center"
              style={{ backgroundImage: `url(${imgRoundTable})` }}
            />
            <div className="absolute inset-0 bg-black/75" />
            <div className="relative z-10 flex flex-col justify-center px-10 md:px-20">
              <p className="text-xs font-bold tracking-[0.2em] uppercase mb-4 text-white/40">Nossa rede</p>
              <h2 className="text-4xl md:text-5xl font-black text-white leading-tight mb-4">
                Rede <span style={{ color: BRAND_PINK }}>Mesa Ads</span>
              </h2>
              <p className="text-white/50 mb-16 text-lg">Manaus — AM</p>
              <div className="grid grid-cols-3 gap-12">
                <div>
                  <span className="text-7xl font-black" style={{ color: BRAND_GREEN }}>20</span>
                  <p className="text-white/70 mt-2 text-base">casas parceiras</p>
                </div>
                <div>
                  <span className="text-7xl font-black" style={{ color: BRAND_GREEN }}>30k</span>
                  <p className="text-white/70 mt-2 text-base">clientes/mês alcançados</p>
                </div>
                <div>
                  <span className="text-7xl font-black" style={{ color: BRAND_GREEN }}>20%</span>
                  <p className="text-white/70 mt-2 text-base">crescimento por semana</p>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ── 6. PROPOSTA COMERCIAL ── */}
        {slide === 5 && (
          <div className="absolute inset-0 bg-black flex flex-col justify-center px-8 md:px-16 overflow-auto py-16">
            <p className="text-xs font-bold tracking-[0.2em] uppercase mb-2 text-white/40">Proposta Comercial</p>
            <div className="flex items-baseline gap-4 mb-8">
              <h2 className="text-3xl md:text-4xl font-black text-white">
                {company || clientName}
              </h2>
              <span className="text-sm text-white/30">{quotation.quotationNumber}</span>
            </div>

            {quotationItems.length > 0 ? (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-white/10">
                      <th className="text-left text-white/40 font-medium pb-3 pr-6">Produto</th>
                      <th className="text-right text-white/40 font-medium pb-3 px-4">Volume</th>
                      <th className="text-right text-white/40 font-medium pb-3 px-4">Semanas</th>
                      <th className="text-right text-white/40 font-medium pb-3 pl-4">Total</th>
                    </tr>
                  </thead>
                  <tbody>
                    {quotationItems.map((item) => (
                      <tr key={item.id} className="border-b border-white/5">
                        <td className="py-4 pr-6 text-white font-semibold text-base">{item.productName || "—"}</td>
                        <td className="py-4 px-4 text-right text-white/70">
                          {item.quantity?.toLocaleString("pt-BR") || "—"}
                        </td>
                        <td className="py-4 px-4 text-right text-white/70">{item.semanas || "—"}sem</td>
                        <td className="py-4 pl-4 text-right font-bold text-white text-base">
                          {item.totalValue ? formatCurrency(Number(item.totalValue)) : "—"}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <p className="text-white/30 text-sm">Sem itens detalhados — ver proposta PDF.</p>
            )}

            <div className="mt-8 pt-6 border-t border-white/10 flex justify-between items-end">
              <div className="space-y-1">
                {quotation.hasPartnerDiscount && (
                  <p className="text-xs text-white/40">✓ Desconto de parceiro aplicado</p>
                )}
                <p className="text-xs text-white/30">Pix à vista: −5% · Boleto parcelado · Cartão em até 3×</p>
              </div>
              <div className="text-right">
                <p className="text-sm text-white/40 mb-1">Investimento total</p>
                {isBonificada ? (
                  <p className="text-3xl font-black" style={{ color: BRAND_GREEN }}>Bonificada</p>
                ) : (
                  <p className="text-4xl font-black text-white">
                    {totalValue > 0 ? formatCurrency(totalValue) : "—"}
                  </p>
                )}
              </div>
            </div>
          </div>
        )}

        {/* ── 7. CONDIÇÕES ── */}
        {slide === 6 && (
          <div className="absolute inset-0 flex">
            <div
              className="absolute inset-0 bg-cover bg-center"
              style={{ backgroundImage: `url(${imgBrandSlide})` }}
            />
            <div className="absolute inset-0 bg-black/80" />
            <div className="relative z-10 flex flex-col justify-center px-10 md:px-20 max-w-3xl">
              <p className="text-xs font-bold tracking-[0.2em] uppercase mb-4 text-white/40">Condições comerciais</p>
              <h2 className="text-4xl md:text-5xl font-black text-white leading-tight mb-10">
                Transparência<br />em cada detalhe.
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-x-12 gap-y-5">
                {[
                  { label: "Veiculação", val: "Batches de 4 semanas padronizados" },
                  { label: "Pagamento", val: "100% antes da veiculação" },
                  { label: "Design", val: "5 dias após o faturamento" },
                  { label: "Produção", val: "20 dias após conclusão do design" },
                  { label: "Prova", val: "Fotos semanais de verificação" },
                  { label: "Cancelamento", val: "Não é possível após início da produção" },
                  { label: "Reposição", val: "Mediante aprovação (cobrado)" },
                  { label: "Pix à vista", val: "−5% em períodos acima de 4 semanas" },
                ].map(({ label, val }) => (
                  <div key={label} className="flex flex-col">
                    <span className="text-xs text-white/40 uppercase tracking-wider">{label}</span>
                    <span className="text-sm text-white mt-0.5">{val}</span>
                  </div>
                ))}
              </div>
              <div className="mt-14">
                <p className="text-2xl font-black text-white">
                  Pronto para estar<br />
                  <span style={{ color: BRAND_PINK }}>na mesa do seu cliente?</span>
                </p>
                <p className="text-white/40 mt-2 text-sm">mesa.ads · Manaus, AM</p>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Prev / Next arrows */}
      <button
        onClick={prev}
        disabled={slide === 0}
        className="absolute left-3 top-1/2 -translate-y-1/2 z-20 p-2 rounded-full transition-all"
        style={{ background: slide === 0 ? "transparent" : "rgba(255,255,255,0.08)" }}
      >
        <ChevronLeft className="w-6 h-6 text-white/50" />
      </button>
      <button
        onClick={next}
        disabled={slide === slides.length - 1}
        className="absolute right-3 top-1/2 -translate-y-1/2 z-20 p-2 rounded-full transition-all"
        style={{ background: slide === slides.length - 1 ? "transparent" : "rgba(255,255,255,0.08)" }}
      >
        <ChevronRight className="w-6 h-6 text-white/50" />
      </button>

      {/* Slide counter */}
      <div className="absolute bottom-5 left-1/2 -translate-x-1/2 text-white/20 text-xs z-20">
        {slide + 1} / {slides.length}
      </div>
    </div>
  );
}
