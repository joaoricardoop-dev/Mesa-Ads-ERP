import { useEffect, useMemo } from "react";
import { motion } from "framer-motion";
import { ArrowRight, Sparkles, Monitor, Printer, Megaphone, MapPin } from "lucide-react";
import { trpc } from "@/lib/trpc";

// Catálogo da vitrine pública (/vitrine). Mostra o portfólio comercial
// agrupado por linha (Mídia Digital / Impressa / Live Marketing). É a
// "ponte" entre a LandingPage institucional e o wizard /montar-campanha.
// Tudo vem do backend (product.publicCatalog) — zero hardcode de produto
// no front. Caso o catálogo esteja vazio (DB ainda não seedado), mostra
// um estado pedagógico ao invés de uma tela em branco.

const LINE_META: Record<
  string,
  { label: string; subtitle: string; icon: typeof Monitor; accent: string }
> = {
  midia_digital: {
    label: "Mídia Digital",
    subtitle: "Telas, painéis e janelas em alta circulação",
    icon: Monitor,
    accent: "from-emerald-500/30 to-cyan-500/10",
  },
  midia_impressa: {
    label: "Mídia Impressa",
    subtitle: "Bolachas, adesivos e materiais físicos com alcance massivo",
    icon: Printer,
    accent: "from-amber-500/30 to-rose-500/10",
  },
  live_marketing: {
    label: "Live Marketing",
    subtitle: "Ativações, sampling e ações presenciais com promotores",
    icon: Megaphone,
    accent: "from-fuchsia-500/30 to-violet-500/10",
  },
};

const LINE_ORDER = ["midia_digital", "midia_impressa", "live_marketing"];

function formatBRL(value: number | null): string {
  if (value == null) return "Sob consulta";
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value);
}

export default function Vitrine() {
  useEffect(() => {
    document.title = "Vitrine de mídias · mesa.ads";
  }, []);

  const { data, isLoading, isError } = trpc.product.publicCatalog.useQuery();

  const groupedLines = useMemo(() => {
    if (!data?.lines) return [];
    // Ordenar pelas chaves canônicas; linhas desconhecidas vão para o fim.
    const known = LINE_ORDER
      .map((key) => data.lines.find((l) => l.line === key))
      .filter((l): l is NonNullable<typeof l> => Boolean(l));
    const unknown = data.lines.filter((l) => !LINE_ORDER.includes(l.line));
    return [...known, ...unknown];
  }, [data]);

  return (
    <div className="min-h-screen bg-ink-950 text-chalk-50">
      {/* Header simples — espelha o nav da landing */}
      <nav className="sticky top-0 z-30 backdrop-blur bg-ink-950/70 border-b border-ink-800">
        <div className="container mx-auto px-6 py-4 flex items-center justify-between">
          <a href="/" className="flex items-center gap-2" aria-label="Voltar para mesa.ads">
            <img src="/logo-white.png" alt="mesa.ads" className="h-7" />
          </a>
          <div className="flex items-center gap-4 text-sm">
            <a
              href="/"
              className="text-chalk-400 hover:text-chalk-50 transition-colors"
            >
              Início
            </a>
            <a
              href="/montar-campanha"
              data-testid="vitrine-nav-cta"
              className="px-4 py-2 rounded-md bg-mesa-neon text-ink-950 font-semibold hover:bg-mesa-neon/90 transition-colors"
            >
              Montar campanha
            </a>
          </div>
        </div>
      </nav>

      {/* Hero da vitrine */}
      <section className="relative overflow-hidden border-b border-ink-800">
        <div
          className="absolute inset-0 opacity-30 pointer-events-none"
          style={{
            background:
              "radial-gradient(ellipse 80% 50% at 50% 0%, hsl(var(--mesa-neon-hsl, 96 96% 43%) / 0.15), transparent 70%)",
          }}
        />
        <div className="container mx-auto px-6 py-20 md:py-28 relative">
          <motion.div
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7 }}
            className="max-w-3xl"
          >
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-ink-800/60 border border-ink-700 text-xs text-chalk-300 mb-6">
              <Sparkles className="w-3.5 h-3.5 text-mesa-neon" />
              Catálogo de mídias mesa.ads
            </div>
            <h1
              className="font-display text-5xl md:text-6xl lg:text-7xl font-black tracking-tight leading-[0.95] mb-6"
              data-testid="vitrine-hero-title"
            >
              Toda a mídia que sua marca precisa,{" "}
              <span className="text-mesa-neon">em um só lugar.</span>
            </h1>
            <p className="text-lg md:text-xl text-chalk-300 max-w-2xl mb-8">
              Telas, bolachas, ativações e mais — distribuído na rede mesa.ads
              e em parceiros premium como o Manauara Shopping. Escolha onde,
              quando e como impactar seu público.
            </p>
            <div className="flex flex-wrap gap-3">
              <a
                href="/montar-campanha"
                data-testid="vitrine-hero-cta"
                className="inline-flex items-center gap-2 px-6 py-3 rounded-md bg-mesa-neon text-ink-950 font-semibold hover:bg-mesa-neon/90 transition-colors"
              >
                Montar minha campanha
                <ArrowRight className="w-4 h-4" />
              </a>
              <a
                href="#contato"
                className="inline-flex items-center gap-2 px-6 py-3 rounded-md bg-ink-800/80 border border-ink-700 text-chalk-100 hover:bg-ink-700 transition-colors"
              >
                Falar com consultor
              </a>
            </div>
          </motion.div>
        </div>
      </section>

      {/* Estados: loading / erro / vazio / dados */}
      <section className="container mx-auto px-6 py-16 md:py-24">
        {isLoading && (
          <div
            className="text-center text-chalk-400 py-20"
            data-testid="vitrine-loading"
          >
            Carregando catálogo de mídias…
          </div>
        )}

        {isError && (
          <div
            className="max-w-xl mx-auto text-center py-20"
            data-testid="vitrine-error"
          >
            <p className="text-chalk-300 mb-4">
              Não foi possível carregar o catálogo agora.
            </p>
            <p className="text-sm text-chalk-500">
              Tente novamente em instantes ou fale com nosso time.
            </p>
          </div>
        )}

        {!isLoading && !isError && data && data.totalProducts === 0 && (
          <div
            className="max-w-xl mx-auto text-center py-20"
            data-testid="vitrine-empty"
          >
            <p className="text-chalk-300 mb-3">
              O catálogo público ainda está sendo preparado.
            </p>
            <p className="text-sm text-chalk-500">
              Em breve listamos aqui todas as mídias disponíveis. Enquanto
              isso, você já pode montar uma campanha personalizada.
            </p>
            <a
              href="/montar-campanha"
              className="inline-flex items-center gap-2 mt-6 px-5 py-2.5 rounded-md bg-mesa-neon text-ink-950 font-semibold"
            >
              Montar campanha
              <ArrowRight className="w-4 h-4" />
            </a>
          </div>
        )}

        {!isLoading && !isError && groupedLines.length > 0 && (
          <div
            className="space-y-20"
            data-testid="vitrine-catalog"
            data-total={data?.totalProducts ?? 0}
          >
            {groupedLines.map((group) => {
              const meta =
                LINE_META[group.line] ?? {
                  label: group.line,
                  subtitle: "",
                  icon: Sparkles,
                  accent: "from-ink-700 to-ink-800",
                };
              const Icon = meta.icon;
              return (
                <div
                  key={group.line}
                  data-testid={`vitrine-line-${group.line}`}
                  data-line={group.line}
                >
                  <div className="flex items-end justify-between gap-4 mb-8 flex-wrap">
                    <div>
                      <div className="flex items-center gap-3 mb-2">
                        <span
                          className={`inline-flex items-center justify-center w-10 h-10 rounded-md bg-gradient-to-br ${meta.accent} border border-ink-700`}
                        >
                          <Icon className="w-5 h-5 text-mesa-neon" />
                        </span>
                        <h2 className="font-display text-3xl md:text-4xl font-black tracking-tight">
                          {meta.label}
                        </h2>
                      </div>
                      {meta.subtitle && (
                        <p className="text-chalk-400 max-w-2xl">{meta.subtitle}</p>
                      )}
                    </div>
                    <div className="text-xs text-chalk-500 uppercase tracking-wider">
                      {group.products.length}{" "}
                      {group.products.length === 1 ? "mídia" : "mídias"}
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                    {group.products.map((p) => (
                      <article
                        key={p.id}
                        data-testid={`vitrine-product-${p.id}`}
                        className="group relative rounded-xl bg-ink-900/60 border border-ink-800 hover:border-mesa-neon/40 transition-all overflow-hidden flex flex-col"
                      >
                        <div className="aspect-[16/10] relative overflow-hidden bg-ink-800 border-b border-ink-800">
                          {p.imagemUrl ? (
                            <img
                              src={p.imagemUrl}
                              alt=""
                              className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                            />
                          ) : (
                            <div
                              className={`w-full h-full bg-gradient-to-br ${meta.accent} flex items-center justify-center`}
                            >
                              <Icon className="w-12 h-12 text-mesa-neon/60" />
                            </div>
                          )}
                          <div className="absolute top-3 left-3 inline-flex items-center gap-1.5 px-2 py-1 rounded-md bg-ink-950/70 backdrop-blur text-[10px] uppercase tracking-wider text-chalk-300 border border-ink-800">
                            <MapPin className="w-3 h-3 text-mesa-neon" />
                            Manauara Shopping
                          </div>
                        </div>

                        <div className="p-5 flex flex-col flex-1">
                          <h3 className="font-display text-xl font-bold leading-tight mb-2 text-chalk-50">
                            {p.name}
                          </h3>
                          {p.description && (
                            <p className="text-sm text-chalk-400 mb-4 line-clamp-3 flex-1">
                              {p.description}
                            </p>
                          )}

                          <div className="flex items-end justify-between gap-3 mt-auto pt-3 border-t border-ink-800">
                            <div>
                              <div className="text-[10px] uppercase tracking-wider text-chalk-500">
                                A partir de
                              </div>
                              <div
                                className="font-display text-2xl font-black text-mesa-neon"
                                data-testid={`vitrine-price-${p.id}`}
                              >
                                {formatBRL(p.monthlyPriceNumber)}
                                {p.monthlyPriceNumber != null && (
                                  <span className="text-xs text-chalk-500 font-normal">
                                    {" "}/ mês
                                  </span>
                                )}
                              </div>
                            </div>
                            <a
                              href={`/montar-campanha?productId=${p.id}`}
                              data-testid={`vitrine-cta-${p.id}`}
                              className="inline-flex items-center gap-1 px-3 py-2 rounded-md bg-mesa-neon/10 hover:bg-mesa-neon hover:text-ink-950 text-mesa-neon text-sm font-semibold border border-mesa-neon/30 transition-colors"
                            >
                              Quero esta
                              <ArrowRight className="w-3.5 h-3.5" />
                            </a>
                          </div>
                        </div>
                      </article>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>

      {/* CTA final + contato */}
      <section
        id="contato"
        className="border-t border-ink-800 bg-ink-900/40"
      >
        <div className="container mx-auto px-6 py-16 md:py-24 text-center max-w-3xl">
          <h2 className="font-display text-3xl md:text-4xl font-black tracking-tight mb-4">
            Pronto para reservar suas mídias?
          </h2>
          <p className="text-chalk-300 mb-8">
            Monte uma campanha em poucos cliques ou fale com nosso time
            comercial para uma proposta personalizada.
          </p>
          <div className="flex flex-wrap justify-center gap-3">
            <a
              href="/montar-campanha"
              data-testid="vitrine-footer-cta"
              className="inline-flex items-center gap-2 px-6 py-3 rounded-md bg-mesa-neon text-ink-950 font-semibold hover:bg-mesa-neon/90 transition-colors"
            >
              Montar campanha agora
              <ArrowRight className="w-4 h-4" />
            </a>
            <a
              href="mailto:comercial@mesa.ads"
              className="inline-flex items-center gap-2 px-6 py-3 rounded-md bg-ink-800 border border-ink-700 text-chalk-100 hover:bg-ink-700 transition-colors"
            >
              comercial@mesa.ads
            </a>
          </div>
        </div>
      </section>

      <footer className="border-t border-ink-800 py-8 text-center text-xs text-chalk-500">
        mesa.ads © {new Date().getFullYear()} — Plataforma de mídia para
        anunciantes e shoppings parceiros.
      </footer>
    </div>
  );
}
