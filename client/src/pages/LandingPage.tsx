import { motion, useInView, AnimatePresence, useScroll, useTransform } from "framer-motion";
import { useRef, useEffect, useState, type ReactNode } from "react";
import {
  Eye, EyeOff, Target, BarChart3, DollarSign, Zap, MapPin, RotateCw,
  ArrowRight, Mail, Lock, X, Menu, ChevronRight, Users, Building2,
  TrendingUp, CheckCircle2, Star, ArrowUpRight, Phone, Instagram,
  Utensils, Megaphone, Shield, Clock, Layers, Sparkles
} from "lucide-react";
import { toast } from "sonner";
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
      if (start >= end) {
        setCount(end);
        clearInterval(timer);
      } else {
        setCount(Math.floor(start));
      }
    }, 16);
    return () => clearInterval(timer);
  }, [isInView, end]);

  return (
    <span ref={ref} className="tabular-nums">
      {prefix}{count.toLocaleString("pt-BR")}{suffix}
    </span>
  );
}

/* ──────────────────── Email Login Modal ──────────────────── */

function EmailLoginModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const response = await fetch("/api/auth/email-login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ email, password }),
      });
      const body = await response.json();
      if (!response.ok) {
        setError(body.message || "Erro ao fazer login");
        return;
      }
      toast.success("Login realizado!");
      window.location.reload();
    } catch (err: any) {
      setError(err.message || "Erro ao fazer login");
    } finally {
      setLoading(false);
    }
  };

  if (!open) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-50 bg-black/70 backdrop-blur-md flex items-center justify-center p-4"
        onClick={onClose}
      >
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95 }}
          transition={{ duration: 0.3 }}
          className="w-full max-w-sm rounded-2xl p-8 relative lp-card-elevated"
          onClick={(e) => e.stopPropagation()}
        >
          <button onClick={onClose} className="absolute top-4 right-4 text-[var(--lp-muted)] hover:text-[var(--lp-fg)] transition-colors">
            <X className="w-5 h-5" />
          </button>

          <div className="mb-6">
            <img src="/logo-white.png" alt="mesa.ads" className="h-7" />
          </div>

          <h3 className="text-lg font-bold mb-1 text-[var(--lp-fg)]">Entrar com e-mail</h3>
          <p className="text-xs mb-6 text-[var(--lp-muted)]">Acesse a plataforma com suas credenciais</p>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="text-xs font-semibold block mb-1.5 text-[var(--lp-muted)]">E-mail</label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--lp-muted)]" />
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full h-10 pl-10 pr-3 rounded-lg text-sm lp-input focus:outline-none focus:ring-2 focus:ring-[var(--lp-brand)]"
                  placeholder="seu@email.com"
                  autoFocus
                />
              </div>
            </div>
            <div>
              <label className="text-xs font-semibold block mb-1.5 text-[var(--lp-muted)]">Senha</label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--lp-muted)]" />
                <input
                  type={showPw ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full h-10 pl-10 pr-10 rounded-lg text-sm lp-input focus:outline-none focus:ring-2 focus:ring-[var(--lp-brand)]"
                  placeholder="Sua senha"
                />
                <button type="button" onClick={() => setShowPw(!showPw)} className="absolute right-3 top-1/2 -translate-y-1/2 text-[var(--lp-muted)]">
                  {showPw ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            {error && <p className="text-xs text-red-400">{error}</p>}

            <button
              type="submit"
              disabled={loading || !email || !password}
              className="w-full h-10 lp-btn-primary rounded-lg text-sm font-semibold disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? "Entrando..." : "Entrar"}
            </button>
          </form>

          <div className="flex items-center gap-3 my-5">
            <div className="flex-1 h-px bg-[var(--lp-border)]" />
            <span className="text-[10px] uppercase tracking-widest text-[var(--lp-muted)]">ou</span>
            <div className="flex-1 h-px bg-[var(--lp-border)]" />
          </div>

          <a
            href="/api/login"
            className="w-full h-10 flex items-center justify-center gap-2 rounded-lg text-sm font-medium transition-colors border border-[var(--lp-border)] text-[var(--lp-muted)] hover:text-[var(--lp-fg)] hover:border-[var(--lp-muted)]"
          >
            Entrar com Google / GitHub / Apple
          </a>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}

/* ──────────────────── Navigation ──────────────────── */

function Navbar({ onLogin }: { onLogin: () => void }) {
  const [scrolled, setScrolled] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => {
    const handler = () => setScrolled(window.scrollY > 40);
    window.addEventListener("scroll", handler, { passive: true });
    return () => window.removeEventListener("scroll", handler);
  }, []);

  const navLinks = [
    { label: "Restaurantes", href: "/restaurantes" },
    { label: "Anunciantes", href: "/anunciantes" },
    { label: "Como funciona", href: "#como-funciona" },
    { label: "Contato", href: "#contato" },
  ];

  return (
    <>
      <motion.nav
        className={`fixed top-0 left-0 right-0 z-50 transition-all duration-500 ${
          scrolled ? "lp-nav-scrolled" : ""
        }`}
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
                <Link
                  key={link.label}
                  href={link.href}
                  className="text-sm font-medium text-[var(--lp-muted)] hover:text-[var(--lp-fg)] transition-colors"
                >
                  {link.label}
                </Link>
              ) : (
                <a
                  key={link.label}
                  href={link.href}
                  className="text-sm font-medium text-[var(--lp-muted)] hover:text-[var(--lp-fg)] transition-colors"
                >
                  {link.label}
                </a>
              )
            )}
          </div>

          <div className="hidden md:flex items-center gap-3">
            <button
              onClick={onLogin}
              className="text-sm font-medium text-[var(--lp-muted)] hover:text-[var(--lp-fg)] transition-colors"
            >
              Entrar
            </button>
            <a
              href="https://wa.me/5592991741545?text=Olá! Gostaria de saber mais sobre a mesa.ads"
              target="_blank"
              rel="noopener noreferrer"
              className="lp-btn-primary px-5 py-2 rounded-lg text-sm font-semibold inline-flex items-center gap-2"
            >
              Falar conosco
              <ArrowRight className="w-3.5 h-3.5" />
            </a>
          </div>

          <button
            onClick={() => setMobileOpen(!mobileOpen)}
            className="md:hidden relative z-10 text-[var(--lp-fg)]"
          >
            <Menu className="w-6 h-6" />
          </button>
        </div>
      </motion.nav>

      {/* Mobile menu */}
      <AnimatePresence>
        {mobileOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-40 bg-[var(--lp-bg)]/98 backdrop-blur-xl md:hidden"
          >
            <div className="flex flex-col items-center justify-center h-full gap-8">
              {navLinks.map((link, i) => (
                <motion.div
                  key={link.label}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.08 }}
                >
                  {link.href.startsWith("/") ? (
                    <Link
                      href={link.href}
                      onClick={() => setMobileOpen(false)}
                      className="text-2xl font-bold text-[var(--lp-fg)]"
                    >
                      {link.label}
                    </Link>
                  ) : (
                    <a
                      href={link.href}
                      onClick={() => setMobileOpen(false)}
                      className="text-2xl font-bold text-[var(--lp-fg)]"
                    >
                      {link.label}
                    </a>
                  )}
                </motion.div>
              ))}
              <motion.button
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.4 }}
                onClick={() => { setMobileOpen(false); onLogin(); }}
                className="lp-btn-primary px-8 py-3 rounded-xl text-base font-semibold"
              >
                Entrar na plataforma
              </motion.button>
            </div>
            <button
              onClick={() => setMobileOpen(false)}
              className="absolute top-5 right-6 text-[var(--lp-fg)]"
            >
              <X className="w-6 h-6" />
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}

/* ──────────────────── Hero ──────────────────── */

function Hero({ onLogin }: { onLogin: () => void }) {
  const ref = useRef(null);
  const { scrollYProgress } = useScroll({ target: ref, offset: ["start start", "end start"] });
  const bgY = useTransform(scrollYProgress, [0, 1], ["0%", "25%"]);
  const opacity = useTransform(scrollYProgress, [0, 0.8], [1, 0]);

  return (
    <section ref={ref} className="relative min-h-screen flex items-center overflow-hidden">
      {/* Parallax background */}
      <motion.div className="absolute inset-0" style={{ y: bgY }}>
        <img src="/images/hero-bar.jpg" alt="" className="w-full h-full object-cover scale-110" />
        <div className="lp-hero-overlay absolute inset-0" />
      </motion.div>

      {/* Decorative grid */}
      <div className="absolute inset-0 lp-grid-pattern opacity-[0.03]" />

      <motion.div style={{ opacity }} className="relative z-10 container mx-auto px-6 md:px-10 pt-24 pb-20">
        <div className="max-w-4xl">
          {/* Badge */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.3 }}
            className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full border border-[var(--lp-brand)]/30 bg-[var(--lp-brand)]/10 mb-8"
          >
            <Sparkles className="w-3.5 h-3.5 text-[var(--lp-brand)]" />
            <span className="text-xs font-semibold text-[var(--lp-brand)] tracking-wide">
              A MAIOR REDE DE MÍDIA DE MESA DO BRASIL
            </span>
          </motion.div>

          <motion.h1
            className="lp-heading text-[clamp(2.5rem,7vw,5.5rem)] leading-[0.95] tracking-[-0.03em] mb-6"
            initial={{ opacity: 0, y: 50 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.4, ease: [0.25, 0.1, 0.25, 1] }}
          >
            Sua marca na mesa
            <br />
            <span className="lp-text-gradient">do consumidor.</span>
          </motion.h1>

          <motion.p
            className="text-lg md:text-xl max-w-xl mb-10 leading-relaxed text-[var(--lp-muted)]"
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, delay: 0.6 }}
          >
            Porta-copos publicitários em restaurantes, cafés e bares.
            Mídia física com alta atenção, alcance hiperlocal e impacto real
            na lembrança de marca.
          </motion.p>

          <motion.div
            className="flex flex-wrap gap-4"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, delay: 0.8 }}
          >
            <a
              href="https://wa.me/5592991741545?text=Olá! Gostaria de saber mais sobre a mesa.ads"
              target="_blank"
              rel="noopener noreferrer"
              className="lp-btn-primary px-8 py-3.5 rounded-xl font-bold text-base inline-flex items-center gap-2"
            >
              Quero anunciar
              <ArrowRight className="w-4 h-4" />
            </a>
            <button
              onClick={onLogin}
              className="lp-btn-outline px-8 py-3.5 rounded-xl font-semibold text-base inline-flex items-center gap-2"
            >
              Entrar na plataforma
              <ArrowUpRight className="w-4 h-4" />
            </button>
          </motion.div>

          {/* Social proof */}
          <motion.div
            className="mt-16 flex flex-wrap items-center gap-8"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.8, delay: 1.1 }}
          >
            <div className="flex items-center gap-3">
              <div className="flex -space-x-2">
                {[1, 2, 3, 4].map((i) => (
                  <div
                    key={i}
                    className="w-8 h-8 rounded-full border-2 border-[var(--lp-bg)] bg-[var(--lp-secondary)] flex items-center justify-center"
                  >
                    <Users className="w-3.5 h-3.5 text-[var(--lp-muted)]" />
                  </div>
                ))}
              </div>
              <div>
                <p className="text-sm font-semibold text-[var(--lp-fg)]">50+ restaurantes</p>
                <p className="text-xs text-[var(--lp-muted)]">parceiros ativos</p>
              </div>
            </div>
            <div className="h-8 w-px bg-[var(--lp-border)] hidden sm:block" />
            <div className="flex items-center gap-2">
              {[1, 2, 3, 4, 5].map((i) => (
                <Star key={i} className="w-4 h-4 fill-[var(--lp-brand)] text-[var(--lp-brand)]" />
              ))}
              <span className="text-sm text-[var(--lp-muted)] ml-1">Aprovação dos parceiros</span>
            </div>
          </motion.div>
        </div>
      </motion.div>

      {/* Bottom gradient */}
      <div className="absolute bottom-0 left-0 right-0 h-32 bg-gradient-to-t from-[var(--lp-bg)] to-transparent" />
    </section>
  );
}

/* ──────────────────── Audiences (For whom) ──────────────────── */

function Audiences() {
  const audiences = [
    {
      icon: Utensils,
      label: "Restaurantes",
      title: "Ganhe uma renda extra sem esforço",
      desc: "Disponibilize suas mesas para porta-copos publicitários e receba por isso. Zero investimento, zero trabalho operacional.",
      href: "/restaurantes",
      color: "from-emerald-500/20 to-emerald-500/5",
      features: ["Renda passiva mensal", "Zero custo operacional", "Porta-copos de alta qualidade"],
    },
    {
      icon: Megaphone,
      label: "Anunciantes",
      title: "Impacte seu público onde ele está",
      desc: "Coloque sua marca na mesa do consumidor com mídia tangível, segmentada por bairro e tipo de estabelecimento.",
      href: "/anunciantes",
      color: "from-blue-500/20 to-blue-500/5",
      features: ["Segmentação hiperlocal", "Alta lembrança de marca", "Relatórios de performance"],
    },
  ];

  return (
    <section className="py-24 md:py-32 relative">
      <div className="container mx-auto px-6 md:px-10">
        <Reveal>
          <div className="text-center mb-16">
            <p className="lp-label mb-3">Para quem</p>
            <h2 className="lp-heading text-4xl md:text-5xl mb-4">
              Dois lados, um <span className="lp-text-gradient">ecossistema.</span>
            </h2>
            <p className="text-lg text-[var(--lp-muted)] max-w-xl mx-auto">
              Conectamos restaurantes que querem faturar mais com marcas que buscam presença real.
            </p>
          </div>
        </Reveal>

        <div className="grid md:grid-cols-2 gap-6">
          {audiences.map((a, i) => (
            <Reveal key={a.label} delay={i * 0.15}>
              <Link href={a.href}>
                <div className="lp-card group h-full p-8 md:p-10 relative overflow-hidden cursor-pointer">
                  {/* Background glow */}
                  <div className={`absolute top-0 right-0 w-64 h-64 rounded-full bg-gradient-to-br ${a.color} blur-3xl opacity-0 group-hover:opacity-100 transition-opacity duration-700`} />

                  <div className="relative">
                    <div className="w-12 h-12 rounded-xl bg-[var(--lp-brand)]/10 flex items-center justify-center mb-6 group-hover:bg-[var(--lp-brand)]/20 transition-colors">
                      <a.icon className="w-6 h-6 text-[var(--lp-brand)]" />
                    </div>

                    <p className="text-xs font-semibold text-[var(--lp-brand)] tracking-widest uppercase mb-2">{a.label}</p>
                    <h3 className="lp-heading text-2xl md:text-3xl mb-3">{a.title}</h3>
                    <p className="text-[var(--lp-muted)] leading-relaxed mb-8">{a.desc}</p>

                    <ul className="space-y-3 mb-8">
                      {a.features.map((f) => (
                        <li key={f} className="flex items-center gap-3 text-sm text-[var(--lp-fg)]">
                          <CheckCircle2 className="w-4 h-4 text-[var(--lp-brand)] flex-shrink-0" />
                          {f}
                        </li>
                      ))}
                    </ul>

                    <div className="inline-flex items-center gap-2 text-sm font-semibold text-[var(--lp-brand)] group-hover:gap-3 transition-all">
                      Saiba mais
                      <ArrowRight className="w-4 h-4" />
                    </div>
                  </div>
                </div>
              </Link>
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
      icon: MapPin,
      title: "Selecionamos restaurantes estratégicos",
      desc: "Mapeamos e recrutamos estabelecimentos com alto fluxo nos bairros mais relevantes para cada campanha.",
    },
    {
      num: "02",
      icon: Layers,
      title: "Produzimos os porta-copos",
      desc: "Design profissional, impressão em alta qualidade com laminação fosca em papelão reciclado premium.",
    },
    {
      num: "03",
      icon: RotateCw,
      title: "Distribuição e rotação",
      desc: "Entregamos e repomos os porta-copos a cada 4 semanas, garantindo presença contínua e material sempre novo.",
    },
    {
      num: "04",
      icon: BarChart3,
      title: "Relatórios de campanha",
      desc: "Acompanhe alcance estimado, locais ativos, fotos de veiculação e indicadores de performance.",
    },
  ];

  return (
    <section id="como-funciona" className="py-24 md:py-32 relative overflow-hidden">
      {/* Background accent */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] rounded-full blur-[180px] opacity-[0.04] bg-[var(--lp-brand)]" />

      <div className="container mx-auto px-6 md:px-10 relative">
        <Reveal>
          <div className="text-center mb-20">
            <p className="lp-label mb-3">Como funciona</p>
            <h2 className="lp-heading text-4xl md:text-5xl mb-4">
              Simples, eficiente e <span className="lp-text-gradient">escalável.</span>
            </h2>
            <p className="text-lg text-[var(--lp-muted)] max-w-xl mx-auto">
              Do planejamento à veiculação em poucos dias. Nós cuidamos de toda a operação.
            </p>
          </div>
        </Reveal>

        <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
          {steps.map((step, i) => (
            <Reveal key={step.num} delay={i * 0.1}>
              <div className="lp-card p-8 h-full relative group">
                {/* Top accent line */}
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

/* ──────────────────── Problem / Solution ──────────────────── */

function ProblemSolution() {
  const problems = [
    { icon: Eye, text: "Consumidores ignoram anúncios digitais em menos de 2 segundos" },
    { icon: Target, text: "Mídia OOH tradicional é cara e pouco segmentada" },
    { icon: DollarSign, text: "Difícil mensurar impacto de campanhas offline" },
  ];

  const solutions = [
    { icon: Clock, text: "Exposição média de 45 minutos por sessão no restaurante" },
    { icon: MapPin, text: "Segmentação por bairro, perfil e tipo de estabelecimento" },
    { icon: BarChart3, text: "Dashboard com métricas reais de alcance e distribuição" },
  ];

  return (
    <section className="py-24 md:py-32 lp-section-alt">
      <div className="container mx-auto px-6 md:px-10">
        <Reveal>
          <div className="text-center mb-16">
            <p className="lp-label mb-3">Por que mesa.ads</p>
            <h2 className="lp-heading text-4xl md:text-5xl mb-4">
              O digital satura.{" "}
              <span className="lp-text-gradient">A mesa conecta.</span>
            </h2>
          </div>
        </Reveal>

        <div className="grid md:grid-cols-2 gap-8 max-w-4xl mx-auto">
          {/* Problems */}
          <Reveal>
            <div className="lp-card p-8 border-red-500/20">
              <h3 className="text-sm font-semibold text-red-400 uppercase tracking-widest mb-6">O problema</h3>
              <ul className="space-y-5">
                {problems.map((p, i) => (
                  <li key={i} className="flex items-start gap-4">
                    <div className="w-9 h-9 rounded-lg bg-red-500/10 flex items-center justify-center flex-shrink-0 mt-0.5">
                      <p.icon className="w-4.5 h-4.5 text-red-400" />
                    </div>
                    <p className="text-sm text-[var(--lp-muted)] leading-relaxed pt-1.5">{p.text}</p>
                  </li>
                ))}
              </ul>
            </div>
          </Reveal>

          {/* Solutions */}
          <Reveal delay={0.15}>
            <div className="lp-card p-8 border-[var(--lp-brand)]/20">
              <h3 className="text-sm font-semibold text-[var(--lp-brand)] uppercase tracking-widest mb-6">A solução mesa.ads</h3>
              <ul className="space-y-5">
                {solutions.map((s, i) => (
                  <li key={i} className="flex items-start gap-4">
                    <div className="w-9 h-9 rounded-lg bg-[var(--lp-brand)]/10 flex items-center justify-center flex-shrink-0 mt-0.5">
                      <s.icon className="w-4.5 h-4.5 text-[var(--lp-brand)]" />
                    </div>
                    <p className="text-sm text-[var(--lp-muted)] leading-relaxed pt-1.5">{s.text}</p>
                  </li>
                ))}
              </ul>
            </div>
          </Reveal>
        </div>
      </div>
    </section>
  );
}

/* ──────────────────── Stats ──────────────────── */

function Stats() {
  const stats = [
    { end: 50, suffix: "+", prefix: "", label: "Restaurantes parceiros" },
    { end: 300, suffix: "k+", prefix: "", label: "Impressões mensais estimadas" },
    { end: 45, suffix: " min", prefix: "", label: "Tempo médio de exposição" },
    { end: 10887, suffix: "", prefix: "", label: "Estabelecimentos em Manaus" },
  ];

  return (
    <section className="py-20 md:py-28">
      <div className="container mx-auto px-6 md:px-10">
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-6">
          {stats.map((s, i) => (
            <Reveal key={i} delay={i * 0.08}>
              <div className="text-center py-6">
                <p className="lp-heading text-4xl md:text-5xl lp-text-gradient mb-2">
                  <Counter end={s.end} suffix={s.suffix} prefix={s.prefix} />
                </p>
                <p className="text-sm text-[var(--lp-muted)]">{s.label}</p>
              </div>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ──────────────────── Coaster Showcase ──────────────────── */

function CoasterShowcase() {
  return (
    <section className="py-24 md:py-32 overflow-hidden">
      <div className="container mx-auto px-6 md:px-10">
        <div className="flex flex-col lg:flex-row items-center gap-16 lg:gap-24">
          {/* Image */}
          <Reveal className="lg:w-1/2">
            <div className="relative">
              <motion.div
                className="relative w-[280px] h-[280px] md:w-[380px] md:h-[380px] mx-auto"
                animate={{ rotate: [0, 2, -2, 0] }}
                transition={{ duration: 8, repeat: Infinity, ease: "easeInOut" }}
              >
                <img
                  src="/images/coaster-blank.jpg"
                  alt="Porta-copos Mesa Ads"
                  className="w-full h-full object-cover rounded-full"
                />
                <div className="absolute inset-0 flex items-center justify-center">
                  <span
                    className="lp-heading text-xl md:text-2xl text-center leading-tight px-12 text-black/70"
                  >
                    SUA MARCA
                    <br />
                    AQUI
                  </span>
                </div>
              </motion.div>
              <div className="absolute inset-0 -z-10 rounded-full blur-[80px] scale-125 bg-[var(--lp-brand)]/10" />
            </div>
          </Reveal>

          {/* Content */}
          <Reveal delay={0.2} className="lg:w-1/2">
            <p className="lp-label mb-3">O produto</p>
            <h2 className="lp-heading text-3xl md:text-4xl mb-6">
              Porta-copos premium com a{" "}
              <span className="lp-text-gradient">identidade da sua marca.</span>
            </h2>
            <p className="text-[var(--lp-muted)] leading-relaxed mb-8">
              Impressos em papel reciclado 240g com laminação fosca, cada porta-copos
              carrega o design da sua campanha e é distribuído em mesas de restaurantes,
              cafés e bares cuidadosamente selecionados.
            </p>

            <div className="grid grid-cols-2 gap-4">
              {[
                { label: "8,5 x 8,5 cm", desc: "Formato ideal" },
                { label: "240g reciclado", desc: "Material premium" },
                { label: "Laminação fosca", desc: "Acabamento profissional" },
                { label: "4x0 cores", desc: "Full color" },
              ].map((spec) => (
                <div key={spec.label} className="lp-card p-4">
                  <p className="text-sm font-bold text-[var(--lp-fg)]">{spec.label}</p>
                  <p className="text-xs text-[var(--lp-muted)]">{spec.desc}</p>
                </div>
              ))}
            </div>
          </Reveal>
        </div>
      </div>
    </section>
  );
}

/* ──────────────────── Testimonials ──────────────────── */

function Testimonials() {
  const testimonials = [
    {
      name: "Carlos Mendes",
      role: "Dono de restaurante",
      text: "Começamos como parceiros e hoje os porta-copos são parte da experiência do nosso restaurante. Os clientes adoram e nós ganhamos uma renda extra sem nenhum esforço.",
    },
    {
      name: "Ana Paula Silva",
      role: "Gerente de Marketing",
      text: "A segmentação por bairro nos permitiu focar exatamente onde nosso público-alvo frequenta. Os resultados em lembrança de marca foram surpreendentes.",
    },
    {
      name: "Roberto Farias",
      role: "Empresário local",
      text: "O custo-benefício é imbatível. Com o investimento de um outdoor por uma semana, consigo um mês inteiro de presença em dezenas de restaurantes.",
    },
  ];

  return (
    <section className="py-24 md:py-32 lp-section-alt">
      <div className="container mx-auto px-6 md:px-10">
        <Reveal>
          <div className="text-center mb-16">
            <p className="lp-label mb-3">Depoimentos</p>
            <h2 className="lp-heading text-4xl md:text-5xl mb-4">
              Quem já está na <span className="lp-text-gradient">mesa.</span>
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

/* ──────────────────── CTA ──────────────────── */

function CTA() {
  return (
    <section id="contato" className="py-24 md:py-32 relative overflow-hidden">
      <div className="absolute inset-0 lp-cta-gradient" />

      <div className="container mx-auto px-6 md:px-10 relative text-center">
        <Reveal>
          <h2 className="lp-heading text-4xl md:text-5xl lg:text-6xl mb-6">
            Coloque sua marca
            <br />
            <span className="lp-text-gradient">na mesa certa.</span>
          </h2>
          <p className="text-lg max-w-md mx-auto mb-10 text-[var(--lp-muted)] leading-relaxed">
            Fale com a gente e descubra como a mesa.ads transforma a presença da sua marca.
          </p>
        </Reveal>

        <Reveal delay={0.15}>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <a
              href="https://wa.me/5592991741545?text=Olá! Gostaria de saber mais sobre a mesa.ads"
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
              Enviar e-mail
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
        <div className="grid md:grid-cols-4 gap-10 mb-12">
          <div className="md:col-span-2">
            <img src="/logo-white.png" alt="mesa.ads" className="h-7 mb-4" />
            <p className="text-sm text-[var(--lp-muted)] max-w-sm leading-relaxed">
              A maior rede de mídia de mesa do Brasil. Conectamos marcas ao momento social
              com porta-copos publicitários em restaurantes, cafés e bares.
            </p>
          </div>

          <div>
            <h4 className="text-sm font-semibold text-[var(--lp-fg)] mb-4">Navegação</h4>
            <ul className="space-y-2.5">
              <li><Link href="/restaurantes" className="text-sm text-[var(--lp-muted)] hover:text-[var(--lp-fg)] transition-colors">Restaurantes</Link></li>
              <li><Link href="/anunciantes" className="text-sm text-[var(--lp-muted)] hover:text-[var(--lp-fg)] transition-colors">Anunciantes</Link></li>
              <li><a href="#como-funciona" className="text-sm text-[var(--lp-muted)] hover:text-[var(--lp-fg)] transition-colors">Como funciona</a></li>
              <li><a href="#contato" className="text-sm text-[var(--lp-muted)] hover:text-[var(--lp-fg)] transition-colors">Contato</a></li>
            </ul>
          </div>

          <div>
            <h4 className="text-sm font-semibold text-[var(--lp-fg)] mb-4">Contato</h4>
            <ul className="space-y-2.5">
              <li>
                <a href="mailto:contato@mesaads.com.br" className="text-sm text-[var(--lp-muted)] hover:text-[var(--lp-fg)] transition-colors">
                  contato@mesaads.com.br
                </a>
              </li>
              <li>
                <a href="https://wa.me/5592991741545" target="_blank" rel="noopener noreferrer" className="text-sm text-[var(--lp-muted)] hover:text-[var(--lp-fg)] transition-colors">
                  (92) 99174-1545
                </a>
              </li>
              <li>
                <a href="https://instagram.com/mesa.ads" target="_blank" rel="noopener noreferrer" className="text-sm text-[var(--lp-muted)] hover:text-[var(--lp-fg)] transition-colors inline-flex items-center gap-1.5">
                  <Instagram className="w-3.5 h-3.5" />
                  @mesa.ads
                </a>
              </li>
            </ul>
          </div>
        </div>

        <div className="pt-8 border-t border-[var(--lp-border)] flex flex-col md:flex-row justify-between items-center gap-4">
          <p className="text-xs text-[var(--lp-muted)]">
            &copy; {new Date().getFullYear()} mesa.ads — Todos os direitos reservados.
          </p>
          <p className="text-xs text-[var(--lp-muted)]">
            Manaus, AM — Brasil
          </p>
        </div>
      </div>
    </footer>
  );
}

/* ──────────────────── Main Export ──────────────────── */

export default function LandingPage() {
  const [loginOpen, setLoginOpen] = useState(false);

  return (
    <main className="landing-page min-h-screen" style={{ scrollBehavior: "smooth" }}>
      <Navbar onLogin={() => setLoginOpen(true)} />
      <Hero onLogin={() => setLoginOpen(true)} />
      <Audiences />
      <Stats />
      <HowItWorks />
      <ProblemSolution />
      <CoasterShowcase />
      <Testimonials />
      <CTA />
      <Footer />
      <EmailLoginModal open={loginOpen} onClose={() => setLoginOpen(false)} />
    </main>
  );
}
