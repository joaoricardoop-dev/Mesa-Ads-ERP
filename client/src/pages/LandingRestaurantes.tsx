import { motion, useInView } from "framer-motion";
import { useRef, useEffect, useState, type ReactNode } from "react";
import {
  ArrowRight, CheckCircle2, Star, Phone, Mail, Instagram,
  DollarSign, Shield, Clock, Utensils, Package, Users,
  TrendingUp, Heart, Sparkles, ChevronRight, Menu, X,
  ArrowUpRight, MapPin, Zap, BarChart3
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
    { label: "Anunciantes", href: "/anunciantes" },
    { label: "Como funciona", href: "#como-funciona" },
    { label: "Benefícios", href: "#beneficios" },
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
            href="https://wa.me/5592991741545?text=Olá! Sou dono de restaurante e gostaria de ser parceiro mesa.ads"
            target="_blank"
            rel="noopener noreferrer"
            className="hidden md:inline-flex lp-btn-primary px-5 py-2 rounded-lg text-sm font-semibold items-center gap-2"
          >
            Quero ser parceiro
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
            href="https://wa.me/5592991741545?text=Olá! Sou dono de restaurante e gostaria de ser parceiro mesa.ads"
            target="_blank"
            rel="noopener noreferrer"
            className="lp-btn-primary px-8 py-3 rounded-xl text-base font-semibold"
          >
            Quero ser parceiro
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
        <div className="absolute inset-0 bg-gradient-to-br from-[var(--lp-bg)] via-[var(--lp-bg)] to-emerald-950/30" />
        <div className="absolute top-20 right-0 w-[600px] h-[600px] rounded-full blur-[200px] opacity-[0.08] bg-[var(--lp-brand)]" />
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
            <Utensils className="w-3.5 h-3.5 text-[var(--lp-brand)]" />
            <span className="text-xs font-semibold text-[var(--lp-brand)] tracking-wide">
              PARA RESTAURANTES, CAFÉS E BARES
            </span>
          </motion.div>

          <motion.h1
            className="lp-heading text-[clamp(2.2rem,6vw,4.5rem)] leading-[0.95] tracking-[-0.03em] mb-6"
            initial={{ opacity: 0, y: 50 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.4 }}
          >
            Transforme suas mesas em{" "}
            <span className="lp-text-gradient">fonte de renda.</span>
          </motion.h1>

          <motion.p
            className="text-lg md:text-xl max-w-xl mb-10 leading-relaxed text-[var(--lp-muted)]"
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, delay: 0.6 }}
          >
            Receba porta-copos publicitários de alta qualidade gratuitamente e ganhe
            uma renda extra mensal. Sem custo, sem esforço, sem complicação.
          </motion.p>

          <motion.div
            className="flex flex-wrap gap-4"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, delay: 0.8 }}
          >
            <a
              href="https://wa.me/5592991741545?text=Olá! Sou dono de restaurante e gostaria de ser parceiro mesa.ads"
              target="_blank"
              rel="noopener noreferrer"
              className="lp-btn-primary px-8 py-3.5 rounded-xl font-bold text-base inline-flex items-center gap-2"
            >
              Quero ser parceiro
              <ArrowRight className="w-4 h-4" />
            </a>
            <a
              href="#como-funciona"
              className="lp-btn-outline px-8 py-3.5 rounded-xl font-semibold text-base inline-flex items-center gap-2"
            >
              Como funciona
              <ChevronRight className="w-4 h-4" />
            </a>
          </motion.div>

          {/* Quick benefits */}
          <motion.div
            className="mt-14 grid grid-cols-3 gap-6 max-w-lg"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.8, delay: 1.0 }}
          >
            {[
              { icon: DollarSign, text: "Renda extra" },
              { icon: Shield, text: "Zero custo" },
              { icon: Package, text: "Tudo incluso" },
            ].map((b) => (
              <div key={b.text} className="flex items-center gap-2">
                <b.icon className="w-4 h-4 text-[var(--lp-brand)]" />
                <span className="text-sm text-[var(--lp-fg)] font-medium">{b.text}</span>
              </div>
            ))}
          </motion.div>
        </div>
      </div>
    </section>
  );
}

/* ──────────────────── Benefits ──────────────────── */

function Benefits() {
  const benefits = [
    {
      icon: DollarSign,
      title: "Renda extra mensal",
      desc: "Receba um valor fixo por mês por cada mesa disponibilizada. Dinheiro entrando sem nenhum esforço adicional.",
    },
    {
      icon: Package,
      title: "Porta-copos premium gratuitos",
      desc: "Você recebe porta-copos de alta qualidade gratuitamente, elevando a apresentação do seu estabelecimento.",
    },
    {
      icon: Shield,
      title: "Zero investimento",
      desc: "Não precisa pagar nada. Nós produzimos, entregamos e repomos os porta-copos sem custo algum para você.",
    },
    {
      icon: Clock,
      title: "Reposição automática",
      desc: "A cada 4 semanas nossa equipe repõe os porta-copos, garantindo que suas mesas estejam sempre bem apresentadas.",
    },
    {
      icon: Heart,
      title: "Experiência do cliente",
      desc: "Porta-copos de qualidade valorizam o ambiente e mostram cuidado com os detalhes para seus clientes.",
    },
    {
      icon: Zap,
      title: "Sem burocracia",
      desc: "Contrato simples, adesão rápida e cancelamento a qualquer momento. Sem multas ou compromissos longos.",
    },
  ];

  return (
    <section id="beneficios" className="py-24 md:py-32 lp-section-alt">
      <div className="container mx-auto px-6 md:px-10">
        <Reveal>
          <div className="text-center mb-16">
            <p className="lp-label mb-3">Benefícios</p>
            <h2 className="lp-heading text-4xl md:text-5xl mb-4">
              Por que ser um <span className="lp-text-gradient">parceiro mesa.ads?</span>
            </h2>
            <p className="text-lg text-[var(--lp-muted)] max-w-xl mx-auto">
              Vantagens reais para o seu estabelecimento, sem nenhuma contrapartida.
            </p>
          </div>
        </Reveal>

        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6 max-w-5xl mx-auto">
          {benefits.map((b, i) => (
            <Reveal key={b.title} delay={i * 0.08}>
              <div className="lp-card p-7 h-full group">
                <div className="w-11 h-11 rounded-xl bg-[var(--lp-brand)]/10 flex items-center justify-center mb-5 group-hover:bg-[var(--lp-brand)]/20 transition-colors">
                  <b.icon className="w-5 h-5 text-[var(--lp-brand)]" />
                </div>
                <h3 className="lp-heading text-lg mb-2 text-[var(--lp-fg)]">{b.title}</h3>
                <p className="text-sm text-[var(--lp-muted)] leading-relaxed">{b.desc}</p>
              </div>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ──────────────────── How It Works ──────────────────── */

function HowItWorks() {
  const steps = [
    {
      num: "01",
      title: "Entre em contato",
      desc: "Fale conosco pelo WhatsApp ou e-mail. Vamos conhecer seu estabelecimento e explicar todos os detalhes.",
    },
    {
      num: "02",
      title: "Assinamos o contrato",
      desc: "Contrato simples e transparente. Sem taxas, sem letras miúdas. Cancelamento livre a qualquer momento.",
    },
    {
      num: "03",
      title: "Receba os porta-copos",
      desc: "Entregamos gratuitamente os porta-copos no seu estabelecimento, prontos para uso nas mesas.",
    },
    {
      num: "04",
      title: "Ganhe todo mês",
      desc: "Receba sua renda extra mensalmente enquanto seus clientes desfrutam de um toque premium nas mesas.",
    },
  ];

  return (
    <section id="como-funciona" className="py-24 md:py-32 relative overflow-hidden">
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] rounded-full blur-[150px] opacity-[0.04] bg-[var(--lp-brand)]" />

      <div className="container mx-auto px-6 md:px-10 relative">
        <Reveal>
          <div className="text-center mb-20">
            <p className="lp-label mb-3">Como funciona</p>
            <h2 className="lp-heading text-4xl md:text-5xl mb-4">
              Começar é <span className="lp-text-gradient">muito simples.</span>
            </h2>
          </div>
        </Reveal>

        <div className="max-w-3xl mx-auto">
          {steps.map((step, i) => (
            <Reveal key={step.num} delay={i * 0.1}>
              <div className="flex gap-6 mb-12 last:mb-0">
                {/* Timeline */}
                <div className="flex flex-col items-center">
                  <div className="w-12 h-12 rounded-full bg-[var(--lp-brand)]/15 border border-[var(--lp-brand)]/30 flex items-center justify-center flex-shrink-0">
                    <span className="text-sm font-bold text-[var(--lp-brand)]">{step.num}</span>
                  </div>
                  {i < steps.length - 1 && (
                    <div className="w-px h-full bg-[var(--lp-border)] mt-3" />
                  )}
                </div>

                {/* Content */}
                <div className="pb-8">
                  <h3 className="lp-heading text-xl mb-2 text-[var(--lp-fg)]">{step.title}</h3>
                  <p className="text-sm text-[var(--lp-muted)] leading-relaxed">{step.desc}</p>
                </div>
              </div>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ──────────────────── Stats ──────────────────── */

function Stats() {
  const stats = [
    { end: 50, suffix: "+", label: "Restaurantes parceiros" },
    { end: 4, suffix: " sem", label: "Ciclos de campanha" },
    { end: 0, suffix: " custo", prefix: "R$", label: "Para o restaurante" },
    { end: 100, suffix: "%", label: "Satisfação dos parceiros" },
  ];

  return (
    <section className="py-16 md:py-24">
      <div className="container mx-auto px-6 md:px-10">
        <div className="lp-card p-10 md:p-14">
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-8">
            {stats.map((s, i) => (
              <Reveal key={i} delay={i * 0.08}>
                <div className="text-center">
                  <p className="lp-heading text-3xl md:text-4xl lp-text-gradient mb-1">
                    <Counter end={s.end} suffix={s.suffix} prefix={s.prefix || ""} />
                  </p>
                  <p className="text-sm text-[var(--lp-muted)]">{s.label}</p>
                </div>
              </Reveal>
            ))}
          </div>
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
      q: "Preciso pagar alguma coisa?",
      a: "Não! O programa é 100% gratuito. Nós fornecemos os porta-copos e você recebe uma renda extra mensal.",
    },
    {
      q: "Como é feito o pagamento?",
      a: "O pagamento é mensal via PIX ou transferência bancária, sempre até o dia 10 de cada mês.",
    },
    {
      q: "Posso escolher as marcas que aparecem nos porta-copos?",
      a: "Garantimos que nenhum anunciante concorrente direto ao seu negócio será veiculado no seu estabelecimento.",
    },
    {
      q: "Qual a qualidade dos porta-copos?",
      a: "São impressos em papel reciclado 240g com laminação fosca, um material premium que valoriza o ambiente do seu estabelecimento.",
    },
    {
      q: "Posso cancelar a qualquer momento?",
      a: "Sim! Não há multa ou fidelidade mínima. Basta nos avisar e encerramos a parceria sem burocracia.",
    },
    {
      q: "Quantas mesas preciso disponibilizar?",
      a: "Trabalhamos com estabelecimentos a partir de 10 mesas. Quanto mais mesas, maior a sua renda mensal.",
    },
  ];

  return (
    <section className="py-24 md:py-32 lp-section-alt">
      <div className="container mx-auto px-6 md:px-10">
        <Reveal>
          <div className="text-center mb-16">
            <p className="lp-label mb-3">Dúvidas frequentes</p>
            <h2 className="lp-heading text-4xl md:text-5xl mb-4">
              Perguntas <span className="lp-text-gradient">respondidas.</span>
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
            <Utensils className="w-8 h-8 text-[var(--lp-brand)]" />
          </div>
          <h2 className="lp-heading text-4xl md:text-5xl mb-4">
            Comece a ganhar com suas mesas{" "}
            <span className="lp-text-gradient">hoje mesmo.</span>
          </h2>
          <p className="text-lg max-w-md mx-auto mb-10 text-[var(--lp-muted)]">
            Entre em contato e em poucos dias seu restaurante já estará faturando mais.
          </p>
        </Reveal>

        <Reveal delay={0.15}>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <a
              href="https://wa.me/5592991741545?text=Olá! Sou dono de restaurante e gostaria de ser parceiro mesa.ads"
              target="_blank"
              rel="noopener noreferrer"
              className="lp-btn-primary px-10 py-4 rounded-xl font-bold text-base inline-flex items-center gap-2"
            >
              <Phone className="w-4 h-4" />
              Falar pelo WhatsApp
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
              <Link href="/anunciantes" className="text-xs text-[var(--lp-muted)] hover:text-[var(--lp-fg)] transition-colors">Anunciantes</Link>
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

export default function LandingRestaurantes() {
  return (
    <main className="landing-page min-h-screen" style={{ scrollBehavior: "smooth" }}>
      <Navbar />
      <Hero />
      <Benefits />
      <Stats />
      <HowItWorks />
      <FAQ />
      <CTA />
      <Footer />
    </main>
  );
}
