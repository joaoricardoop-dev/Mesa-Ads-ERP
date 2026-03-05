import { motion, useInView } from "framer-motion";
import { useRef, useEffect, useState, type ReactNode } from "react";
import {
  ArrowRight, CheckCircle2, Star, Phone, Mail, Instagram,
  Target, BarChart3, MapPin, Eye, Megaphone, TrendingUp,
  ChevronRight, Menu, X, Sparkles, Users, Layers,
  Clock, DollarSign, Zap, ArrowUpRight, Shield
} from "lucide-react";
import { Link } from "wouter";

/* ──────────────────── Utilities ──────────────────── */

function Reveal({ children, className = "", delay = 0 }: { children: ReactNode; className?: string; delay?: number }) {
  const ref = useRef(null);
  const isInView = useInView(ref, { once: true, margin: "-60px" });
  return (
    <motion.div
      ref={ref}
      initial={{ opacity: 0, y: 32 }}
      animate={isInView ? { opacity: 1, y: 0 } : {}}
      transition={{ duration: 0.7, delay, ease: [0.25, 0.1, 0.25, 1] }}
      className={className}
    >
      {children}
    </motion.div>
  );
}

function Counter({ end, suffix = "", prefix = "" }: { end: number; suffix?: string; prefix?: string }) {
  const [count, setCount] = useState(0);
  const ref = useRef(null);
  const isInView = useInView(ref, { once: true });

  useEffect(() => {
    if (!isInView) return;
    let start = 0;
    const duration = 1800;
    const step = end / (duration / 16);
    const timer = setInterval(() => {
      start += step;
      if (start >= end) { setCount(end); clearInterval(timer); }
      else setCount(Math.floor(start));
    }, 16);
    return () => clearInterval(timer);
  }, [isInView, end]);

  return <span ref={ref} className="tabular-nums">{prefix}{count.toLocaleString("pt-BR")}{suffix}</span>;
}

/* ──────────────────── Navbar ──────────────────── */

function Navbar() {
  const [scrolled, setScrolled] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => {
    const handler = () => setScrolled(window.scrollY > 40);
    window.addEventListener("scroll", handler, { passive: true });
    return () => window.removeEventListener("scroll", handler);
  }, []);

  const navLinks = [
    { label: "Restaurantes", href: "/restaurantes" },
    { label: "Vantagens", href: "#vantagens" },
    { label: "Planos", href: "#planos" },
    { label: "Contato", href: "#contato" },
  ];

  return (
    <>
      <motion.nav
        className={`fixed top-0 left-0 right-0 z-50 transition-all duration-500 ${scrolled ? "lp-nav-scrolled" : ""}`}
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, delay: 0.2 }}
      >
        <div className="container mx-auto px-6 md:px-10 flex items-center justify-between h-16 md:h-20">
          <Link href="/landing" className="flex items-center gap-2 relative z-10">
            <img src="/logo-white.png" alt="mesa.ads" className="h-7 md:h-8" />
          </Link>

          <div className="hidden md:flex items-center gap-8">
            {navLinks.map((link) =>
              link.href.startsWith("/") ? (
                <Link key={link.label} href={link.href} className="text-sm font-medium text-[var(--lp-muted)] hover:text-[var(--lp-fg)] transition-colors">{link.label}</Link>
              ) : (
                <a key={link.label} href={link.href} className="text-sm font-medium text-[var(--lp-muted)] hover:text-[var(--lp-fg)] transition-colors">{link.label}</a>
              )
            )}
          </div>

          <a
            href="https://wa.me/5592991741545?text=Olá! Gostaria de anunciar com a mesa.ads"
            target="_blank"
            rel="noopener noreferrer"
            className="hidden md:inline-flex lp-btn-primary px-5 py-2 rounded-lg text-sm font-semibold items-center gap-2"
          >
            Quero anunciar
            <ArrowRight className="w-3.5 h-3.5" />
          </a>

          <button onClick={() => setMobileOpen(!mobileOpen)} className="md:hidden relative z-10 text-[var(--lp-fg)]">
            <Menu className="w-6 h-6" />
          </button>
        </div>
      </motion.nav>

      {mobileOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="fixed inset-0 z-40 bg-[var(--lp-bg)]/98 backdrop-blur-xl md:hidden flex flex-col items-center justify-center gap-8"
        >
          {navLinks.map((link) =>
            link.href.startsWith("/") ? (
              <Link key={link.label} href={link.href} onClick={() => setMobileOpen(false)} className="text-2xl font-bold text-[var(--lp-fg)]">{link.label}</Link>
            ) : (
              <a key={link.label} href={link.href} onClick={() => setMobileOpen(false)} className="text-2xl font-bold text-[var(--lp-fg)]">{link.label}</a>
            )
          )}
          <a
            href="https://wa.me/5592991741545?text=Olá! Gostaria de anunciar com a mesa.ads"
            target="_blank"
            rel="noopener noreferrer"
            className="lp-btn-primary px-8 py-3 rounded-xl text-base font-semibold"
          >
            Quero anunciar
          </a>
          <button onClick={() => setMobileOpen(false)} className="absolute top-5 right-6 text-[var(--lp-fg)]">
            <X className="w-6 h-6" />
          </button>
        </motion.div>
      )}
    </>
  );
}

/* ──────────────────── Hero ──────────────────── */

function Hero() {
  return (
    <section className="relative min-h-[90vh] flex items-center overflow-hidden">
      {/* Background */}
      <div className="absolute inset-0">
        <div className="absolute inset-0 bg-gradient-to-br from-[var(--lp-bg)] via-[var(--lp-bg)] to-blue-950/20" />
        <div className="absolute top-20 right-0 w-[600px] h-[600px] rounded-full blur-[200px] opacity-[0.06] bg-blue-500" />
        <div className="absolute bottom-0 left-0 w-[400px] h-[400px] rounded-full blur-[150px] opacity-[0.05] bg-[var(--lp-brand)]" />
      </div>

      <div className="absolute inset-0 lp-grid-pattern opacity-[0.03]" />

      <div className="relative z-10 container mx-auto px-6 md:px-10 pt-24 pb-20">
        <div className="max-w-3xl">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.3 }}
            className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full border border-[var(--lp-brand)]/30 bg-[var(--lp-brand)]/10 mb-8"
          >
            <Megaphone className="w-3.5 h-3.5 text-[var(--lp-brand)]" />
            <span className="text-xs font-semibold text-[var(--lp-brand)] tracking-wide">
              PARA MARCAS E ANUNCIANTES
            </span>
          </motion.div>

          <motion.h1
            className="lp-heading text-[clamp(2.2rem,6vw,4.5rem)] leading-[0.95] tracking-[-0.03em] mb-6"
            initial={{ opacity: 0, y: 50 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.4 }}
          >
            Sua marca onde o público{" "}
            <span className="lp-text-gradient">realmente presta atenção.</span>
          </motion.h1>

          <motion.p
            className="text-lg md:text-xl max-w-xl mb-10 leading-relaxed text-[var(--lp-muted)]"
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, delay: 0.6 }}
          >
            Porta-copos publicitários em restaurantes, cafés e bares de Manaus.
            Mídia tangível, segmentada por bairro e com exposição de até 45 minutos por sessão.
          </motion.p>

          <motion.div
            className="flex flex-wrap gap-4"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, delay: 0.8 }}
          >
            <a
              href="https://wa.me/5592991741545?text=Olá! Gostaria de anunciar com a mesa.ads"
              target="_blank"
              rel="noopener noreferrer"
              className="lp-btn-primary px-8 py-3.5 rounded-xl font-bold text-base inline-flex items-center gap-2"
            >
              Solicitar proposta
              <ArrowRight className="w-4 h-4" />
            </a>
            <a
              href="#vantagens"
              className="lp-btn-outline px-8 py-3.5 rounded-xl font-semibold text-base inline-flex items-center gap-2"
            >
              Ver vantagens
              <ChevronRight className="w-4 h-4" />
            </a>
          </motion.div>

          {/* Quick stats */}
          <motion.div
            className="mt-14 flex flex-wrap gap-8"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.8, delay: 1.0 }}
          >
            {[
              { value: "45min", label: "tempo de exposição" },
              { value: "50+", label: "restaurantes ativos" },
              { value: "300k+", label: "impressões/mês" },
            ].map((s) => (
              <div key={s.label}>
                <p className="text-xl font-bold lp-text-gradient">{s.value}</p>
                <p className="text-xs text-[var(--lp-muted)]">{s.label}</p>
              </div>
            ))}
          </motion.div>
        </div>
      </div>
    </section>
  );
}

/* ──────────────────── Why Mesa Ads ──────────────────── */

function WhyMesaAds() {
  const comparisons = [
    {
      traditional: { label: "Outdoor / Painel", time: "3-5 seg", cost: "Alto", targeting: "Genérico" },
      mesa: { label: "mesa.ads", time: "45 min", cost: "Acessível", targeting: "Por bairro" },
    },
  ];

  return (
    <section className="py-24 md:py-32 lp-section-alt">
      <div className="container mx-auto px-6 md:px-10">
        <Reveal>
          <div className="text-center mb-16">
            <p className="lp-label mb-3">Por que mesa.ads</p>
            <h2 className="lp-heading text-4xl md:text-5xl mb-4">
              Muito mais impacto,{" "}
              <span className="lp-text-gradient">muito menos custo.</span>
            </h2>
            <p className="text-lg text-[var(--lp-muted)] max-w-xl mx-auto">
              Compare a mesa.ads com mídias tradicionais e veja a diferença.
            </p>
          </div>
        </Reveal>

        {/* Comparison table */}
        <Reveal>
          <div className="max-w-3xl mx-auto">
            <div className="grid grid-cols-3 gap-4 mb-4">
              <div />
              <div className="text-center">
                <p className="text-xs font-semibold text-[var(--lp-muted)] uppercase tracking-wider">OOH Tradicional</p>
              </div>
              <div className="text-center">
                <p className="text-xs font-semibold text-[var(--lp-brand)] uppercase tracking-wider">mesa.ads</p>
              </div>
            </div>

            {[
              { metric: "Tempo de exposição", trad: "3-5 segundos", mesa: "~45 minutos" },
              { metric: "Segmentação", trad: "Por localização genérica", mesa: "Por bairro e perfil" },
              { metric: "Interação física", trad: "Nenhuma", mesa: "O cliente toca a marca" },
              { metric: "Custo mensal", trad: "R$ 3.000–15.000+", mesa: "A partir de R$ 990" },
              { metric: "Mensuração", trad: "Estimativas vagas", mesa: "Dashboard com dados reais" },
              { metric: "Concorrência visual", trad: "Dezenas de anúncios", mesa: "Exclusividade na mesa" },
            ].map((row, i) => (
              <Reveal key={row.metric} delay={i * 0.05}>
                <div className="grid grid-cols-3 gap-4 py-4 border-b border-[var(--lp-border)]">
                  <p className="text-sm font-medium text-[var(--lp-fg)]">{row.metric}</p>
                  <p className="text-sm text-[var(--lp-muted)] text-center">{row.trad}</p>
                  <p className="text-sm text-[var(--lp-brand)] text-center font-medium">{row.mesa}</p>
                </div>
              </Reveal>
            ))}
          </div>
        </Reveal>
      </div>
    </section>
  );
}

/* ──────────────────── Advantages ──────────────────── */

function Advantages() {
  const advantages = [
    {
      icon: Eye,
      title: "Alta atenção garantida",
      desc: "O consumidor está relaxado, sem pressa e sem tela. Seu anúncio ganha a atenção completa durante toda a refeição.",
    },
    {
      icon: MapPin,
      title: "Segmentação hiperlocal",
      desc: "Escolha bairros, tipos de estabelecimento e perfis de público. Publicidade granular como nunca antes.",
    },
    {
      icon: Target,
      title: "Lembrança de marca real",
      desc: "Mídia tangível gera impacto duradouro. O cliente toca, segura e interage diretamente com a sua marca.",
    },
    {
      icon: TrendingUp,
      title: "Campanhas rotativas",
      desc: "Batches de 4 semanas com distribuição em múltiplos estabelecimentos. Presença contínua e escalável.",
    },
    {
      icon: BarChart3,
      title: "Dashboard de performance",
      desc: "Acompanhe métricas de alcance, locais ativos, fotos de veiculação e indicadores da campanha em tempo real.",
    },
    {
      icon: DollarSign,
      title: "Custo-benefício imbatível",
      desc: "Pelo preço de um outdoor por uma semana, tenha presença contínua em dezenas de restaurantes por um mês inteiro.",
    },
  ];

  return (
    <section id="vantagens" className="py-24 md:py-32">
      <div className="container mx-auto px-6 md:px-10">
        <Reveal>
          <div className="text-center mb-16">
            <p className="lp-label mb-3">Vantagens</p>
            <h2 className="lp-heading text-4xl md:text-5xl mb-4">
              Tudo que sua campanha{" "}
              <span className="lp-text-gradient">precisa.</span>
            </h2>
          </div>
        </Reveal>

        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6 max-w-5xl mx-auto">
          {advantages.map((a, i) => (
            <Reveal key={a.title} delay={i * 0.08}>
              <div className="lp-card p-7 h-full group">
                <div className="w-11 h-11 rounded-xl bg-[var(--lp-brand)]/10 flex items-center justify-center mb-5 group-hover:bg-[var(--lp-brand)]/20 transition-colors">
                  <a.icon className="w-5 h-5 text-[var(--lp-brand)]" />
                </div>
                <h3 className="lp-heading text-lg mb-2 text-[var(--lp-fg)]">{a.title}</h3>
                <p className="text-sm text-[var(--lp-muted)] leading-relaxed">{a.desc}</p>
              </div>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ──────────────────── Plans ──────────────────── */

function Plans() {
  const plans = [
    {
      name: "Starter",
      desc: "Ideal para testar o formato",
      price: "990",
      period: "/mês",
      features: [
        "10 restaurantes",
        "1.000 porta-copos/mês",
        "1 arte inclusa",
        "Relatório mensal básico",
        "Suporte por WhatsApp",
      ],
      highlight: false,
    },
    {
      name: "Growth",
      desc: "Para marcas em crescimento",
      price: "2.490",
      period: "/mês",
      features: [
        "25 restaurantes",
        "3.000 porta-copos/mês",
        "2 artes inclusos",
        "Dashboard em tempo real",
        "Fotos de veiculação",
        "Relatório detalhado",
        "Segmentação por bairro",
      ],
      highlight: true,
    },
    {
      name: "Enterprise",
      desc: "Cobertura máxima na cidade",
      price: "Sob consulta",
      period: "",
      features: [
        "50+ restaurantes",
        "Volume personalizado",
        "Design dedicado",
        "Gestor de conta exclusivo",
        "Relatórios personalizados",
        "Métricas avançadas",
        "Prioridade na distribuição",
      ],
      highlight: false,
    },
  ];

  return (
    <section id="planos" className="py-24 md:py-32 lp-section-alt">
      <div className="container mx-auto px-6 md:px-10">
        <Reveal>
          <div className="text-center mb-16">
            <p className="lp-label mb-3">Planos</p>
            <h2 className="lp-heading text-4xl md:text-5xl mb-4">
              Um plano para cada{" "}
              <span className="lp-text-gradient">objetivo.</span>
            </h2>
            <p className="text-lg text-[var(--lp-muted)] max-w-xl mx-auto">
              Escolha o tamanho da sua presença. Todos incluem produção, entrega e reposição.
            </p>
          </div>
        </Reveal>

        <div className="grid md:grid-cols-3 gap-6 max-w-5xl mx-auto">
          {plans.map((plan, i) => (
            <Reveal key={plan.name} delay={i * 0.1}>
              <div className={`lp-card p-8 h-full flex flex-col relative overflow-hidden ${
                plan.highlight ? "border-[var(--lp-brand)]/40" : ""
              }`}>
                {plan.highlight && (
                  <div className="absolute top-0 left-0 right-0 h-0.5 bg-[var(--lp-brand)]" />
                )}

                {plan.highlight && (
                  <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[var(--lp-brand)]/15 text-[var(--lp-brand)] text-xs font-semibold w-fit mb-4">
                    <Sparkles className="w-3 h-3" />
                    Mais popular
                  </span>
                )}

                <h3 className="lp-heading text-xl text-[var(--lp-fg)]">{plan.name}</h3>
                <p className="text-sm text-[var(--lp-muted)] mb-6">{plan.desc}</p>

                <div className="mb-8">
                  {plan.price.includes("consulta") ? (
                    <p className="lp-heading text-2xl text-[var(--lp-fg)]">{plan.price}</p>
                  ) : (
                    <div className="flex items-baseline gap-1">
                      <span className="text-sm text-[var(--lp-muted)]">R$</span>
                      <span className="lp-heading text-4xl lp-text-gradient">{plan.price}</span>
                      <span className="text-sm text-[var(--lp-muted)]">{plan.period}</span>
                    </div>
                  )}
                </div>

                <ul className="space-y-3 flex-1 mb-8">
                  {plan.features.map((f) => (
                    <li key={f} className="flex items-center gap-3 text-sm text-[var(--lp-fg)]">
                      <CheckCircle2 className="w-4 h-4 text-[var(--lp-brand)] flex-shrink-0" />
                      {f}
                    </li>
                  ))}
                </ul>

                <a
                  href={`https://wa.me/5592991741545?text=Olá! Gostaria de saber mais sobre o plano ${plan.name} da mesa.ads`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className={`w-full py-3 rounded-lg font-semibold text-sm text-center inline-flex items-center justify-center gap-2 transition-all ${
                    plan.highlight
                      ? "lp-btn-primary"
                      : "lp-btn-outline"
                  }`}
                >
                  {plan.price.includes("consulta") ? "Falar com vendas" : "Começar agora"}
                  <ArrowRight className="w-4 h-4" />
                </a>
              </div>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ──────────────────── How Campaigns Work ──────────────────── */

function CampaignProcess() {
  const steps = [
    {
      num: "01",
      icon: Megaphone,
      title: "Briefing & Planejamento",
      desc: "Entendemos seus objetivos, público-alvo e região de atuação para montar a campanha ideal.",
    },
    {
      num: "02",
      icon: Layers,
      title: "Design & Produção",
      desc: "Nossa equipe cria a arte do porta-copos e produz em papel reciclado 240g com laminação fosca premium.",
    },
    {
      num: "03",
      icon: MapPin,
      title: "Distribuição Estratégica",
      desc: "Entregamos nos restaurantes selecionados com base na segmentação definida para sua campanha.",
    },
    {
      num: "04",
      icon: BarChart3,
      title: "Acompanhamento & Resultados",
      desc: "Acesse o dashboard para ver métricas de alcance, locais ativos e fotos da campanha rodando.",
    },
  ];

  return (
    <section className="py-24 md:py-32 relative overflow-hidden">
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] rounded-full blur-[150px] opacity-[0.04] bg-[var(--lp-brand)]" />

      <div className="container mx-auto px-6 md:px-10 relative">
        <Reveal>
          <div className="text-center mb-20">
            <p className="lp-label mb-3">Processo</p>
            <h2 className="lp-heading text-4xl md:text-5xl mb-4">
              Da ideia à mesa em{" "}
              <span className="lp-text-gradient">poucos dias.</span>
            </h2>
          </div>
        </Reveal>

        <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
          {steps.map((step, i) => (
            <Reveal key={step.num} delay={i * 0.1}>
              <div className="lp-card p-8 h-full relative group">
                <div className="absolute top-0 left-0 w-0 h-0.5 bg-[var(--lp-brand)] group-hover:w-full transition-all duration-700" />
                <span className="lp-heading text-5xl font-black text-[var(--lp-fg)]/[0.05] select-none block mb-4">
                  {step.num}
                </span>
                <step.icon className="w-7 h-7 text-[var(--lp-brand)] mb-4" />
                <h3 className="lp-heading text-lg mb-3 text-[var(--lp-fg)]">{step.title}</h3>
                <p className="text-sm text-[var(--lp-muted)] leading-relaxed">{step.desc}</p>
              </div>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ──────────────────── Testimonials ──────────────────── */

function Testimonials() {
  const testimonials = [
    {
      name: "Fernanda Costa",
      role: "Diretora de Marketing — Rede de Açaí",
      text: "A mesa.ads nos deu algo que o digital não consegue: presença física na hora da decisão. Vimos aumento real no reconhecimento de marca nos bairros onde veiculamos.",
    },
    {
      name: "Marcos Oliveira",
      role: "Franqueado — Fast Food",
      text: "O custo-benefício é absurdo. Pagamos menos que um outdoor e temos presença em 20 restaurantes ao mesmo tempo. A segmentação por bairro é perfeita.",
    },
    {
      name: "Juliana Santos",
      role: "Gerente Comercial — Imobiliária",
      text: "Nosso público de alto padrão frequenta restaurantes e cafés. Com a mesa.ads, conseguimos alcançá-los no momento certo, de forma elegante e memorável.",
    },
  ];

  return (
    <section className="py-24 md:py-32">
      <div className="container mx-auto px-6 md:px-10">
        <Reveal>
          <div className="text-center mb-16">
            <p className="lp-label mb-3">Depoimentos</p>
            <h2 className="lp-heading text-4xl md:text-5xl mb-4">
              Quem anuncia <span className="lp-text-gradient">recomenda.</span>
            </h2>
          </div>
        </Reveal>

        <div className="grid md:grid-cols-3 gap-6 max-w-5xl mx-auto">
          {testimonials.map((t, i) => (
            <Reveal key={i} delay={i * 0.1}>
              <div className="lp-card p-8 h-full flex flex-col">
                <div className="flex gap-1 mb-5">
                  {[1, 2, 3, 4, 5].map((s) => (
                    <Star key={s} className="w-4 h-4 fill-[var(--lp-brand)] text-[var(--lp-brand)]" />
                  ))}
                </div>
                <p className="text-sm text-[var(--lp-muted)] leading-relaxed flex-1 mb-6">"{t.text}"</p>
                <div>
                  <p className="text-sm font-semibold text-[var(--lp-fg)]">{t.name}</p>
                  <p className="text-xs text-[var(--lp-muted)]">{t.role}</p>
                </div>
              </div>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ──────────────────── FAQ ──────────────────── */

function FAQ() {
  const [openIndex, setOpenIndex] = useState<number | null>(null);

  const faqs = [
    {
      q: "Qual o formato do porta-copos?",
      a: "Quadrado de 8,5 x 8,5 cm, impresso em papel reciclado 240g com laminação fosca. Impressão 4 cores (CMYK) com design profissional.",
    },
    {
      q: "Posso escolher em quais restaurantes minha marca aparece?",
      a: "Sim! Você pode segmentar por bairro, tipo de estabelecimento e perfil de público. Montamos a distribuição ideal para seus objetivos.",
    },
    {
      q: "Como funciona a rotação de campanhas?",
      a: "Cada campanha roda por 4 semanas. Ao final, os porta-copos são renovados — você pode manter a mesma arte ou atualizar o design.",
    },
    {
      q: "Vocês criam a arte do porta-copos?",
      a: "Sim! Nosso time de design cria a arte sem custo adicional nos planos Growth e Enterprise. No Starter, oferecemos 1 arte inclusa.",
    },
    {
      q: "Como acompanho os resultados?",
      a: "Você recebe acesso ao nosso dashboard com métricas de alcance estimado, locais ativos, fotos de veiculação e indicadores da campanha.",
    },
    {
      q: "Qual a tiragem mínima?",
      a: "O plano Starter começa com 1.000 porta-copos/mês distribuídos em 10 restaurantes, ideal para testar o formato.",
    },
  ];

  return (
    <section className="py-24 md:py-32 lp-section-alt">
      <div className="container mx-auto px-6 md:px-10">
        <Reveal>
          <div className="text-center mb-16">
            <p className="lp-label mb-3">Dúvidas frequentes</p>
            <h2 className="lp-heading text-4xl md:text-5xl mb-4">
              Tudo que você precisa{" "}
              <span className="lp-text-gradient">saber.</span>
            </h2>
          </div>
        </Reveal>

        <div className="max-w-2xl mx-auto space-y-3">
          {faqs.map((faq, i) => (
            <Reveal key={i} delay={i * 0.05}>
              <div className="lp-card overflow-hidden">
                <button
                  onClick={() => setOpenIndex(openIndex === i ? null : i)}
                  className="w-full flex items-center justify-between p-5 text-left"
                >
                  <span className="text-sm font-semibold text-[var(--lp-fg)] pr-4">{faq.q}</span>
                  <ChevronRight
                    className={`w-4 h-4 text-[var(--lp-muted)] flex-shrink-0 transition-transform duration-300 ${
                      openIndex === i ? "rotate-90" : ""
                    }`}
                  />
                </button>
                <motion.div
                  initial={false}
                  animate={{ height: openIndex === i ? "auto" : 0, opacity: openIndex === i ? 1 : 0 }}
                  transition={{ duration: 0.3 }}
                  className="overflow-hidden"
                >
                  <p className="px-5 pb-5 text-sm text-[var(--lp-muted)] leading-relaxed">{faq.a}</p>
                </motion.div>
              </div>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ──────────────────── CTA ──────────────────── */

function CTA() {
  return (
    <section id="contato" className="py-24 md:py-32 relative overflow-hidden">
      <div className="absolute inset-0 lp-cta-gradient" />

      <div className="container mx-auto px-6 md:px-10 relative text-center">
        <Reveal>
          <div className="w-16 h-16 rounded-2xl bg-[var(--lp-brand)]/15 flex items-center justify-center mx-auto mb-8">
            <Megaphone className="w-8 h-8 text-[var(--lp-brand)]" />
          </div>
          <h2 className="lp-heading text-4xl md:text-5xl mb-4">
            Coloque sua marca na mesa{" "}
            <span className="lp-text-gradient">do consumidor.</span>
          </h2>
          <p className="text-lg max-w-md mx-auto mb-10 text-[var(--lp-muted)]">
            Solicite uma proposta personalizada e comece a impactar seu público onde ele realmente está.
          </p>
        </Reveal>

        <Reveal delay={0.15}>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <a
              href="https://wa.me/5592991741545?text=Olá! Gostaria de anunciar com a mesa.ads"
              target="_blank"
              rel="noopener noreferrer"
              className="lp-btn-primary px-10 py-4 rounded-xl font-bold text-base inline-flex items-center gap-2"
            >
              <Phone className="w-4 h-4" />
              Solicitar proposta
            </a>
            <a
              href="mailto:contato@mesaads.com.br"
              className="lp-btn-outline px-10 py-4 rounded-xl font-semibold text-base inline-flex items-center gap-2"
            >
              <Mail className="w-4 h-4" />
              contato@mesaads.com.br
            </a>
          </div>
        </Reveal>
      </div>
    </section>
  );
}

/* ──────────────────── Footer ──────────────────── */

function Footer() {
  return (
    <footer className="border-t border-[var(--lp-border)] py-12">
      <div className="container mx-auto px-6 md:px-10">
        <div className="flex flex-col md:flex-row justify-between items-center gap-6">
          <div className="flex items-center gap-6">
            <Link href="/landing">
              <img src="/logo-white.png" alt="mesa.ads" className="h-6" />
            </Link>
            <div className="h-4 w-px bg-[var(--lp-border)] hidden md:block" />
            <div className="hidden md:flex items-center gap-6">
              <Link href="/landing" className="text-xs text-[var(--lp-muted)] hover:text-[var(--lp-fg)] transition-colors">Home</Link>
              <Link href="/restaurantes" className="text-xs text-[var(--lp-muted)] hover:text-[var(--lp-fg)] transition-colors">Restaurantes</Link>
            </div>
          </div>
          <div className="flex items-center gap-4">
            <a href="https://instagram.com/mesa.ads" target="_blank" rel="noopener noreferrer" className="text-[var(--lp-muted)] hover:text-[var(--lp-fg)] transition-colors">
              <Instagram className="w-4 h-4" />
            </a>
            <p className="text-xs text-[var(--lp-muted)]">
              &copy; {new Date().getFullYear()} mesa.ads — Todos os direitos reservados.
            </p>
          </div>
        </div>
      </div>
    </footer>
  );
}

/* ──────────────────── Main Export ──────────────────── */

export default function LandingAnunciantes() {
  return (
    <main className="landing-page min-h-screen" style={{ scrollBehavior: "smooth" }}>
      <Navbar />
      <Hero />
      <WhyMesaAds />
      <Advantages />
      <CampaignProcess />
      <Plans />
      <Testimonials />
      <FAQ />
      <CTA />
      <Footer />
    </main>
  );
}
