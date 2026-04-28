import { motion, useInView, AnimatePresence } from "framer-motion";
import { useRef, useEffect, useState, type ReactNode } from "react";
import { Eye, EyeOff, Target, BarChart3, DollarSign, Zap, MapPin, RotateCw, ArrowRight, Mail, Lock, X } from "lucide-react";
import { toast } from "sonner";

function Reveal({ children, className = "", delay = 0 }: { children: ReactNode; className?: string; delay?: number }) {
  const ref = useRef(null);
  const isInView = useInView(ref, { once: true, margin: "-80px" });
  return (
    <motion.div
      ref={ref}
      initial={{ opacity: 0, y: 40 }}
      animate={isInView ? { opacity: 1, y: 0 } : {}}
      transition={{ duration: 0.8, delay, ease: [0.25, 0.1, 0.25, 1] }}
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
    const duration = 1500;
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
        className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4"
        onClick={onClose}
      >
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95 }}
          transition={{ duration: 0.3 }}
          className="w-full max-w-sm rounded-2xl p-8 relative"
          style={{ background: "hsl(0 0% 7%)", border: "1px solid hsl(0 0% 14%)" }}
          onClick={(e) => e.stopPropagation()}
        >
          <button onClick={onClose} className="absolute top-4 right-4 text-gray-500 hover:text-white transition-colors">
            <X className="w-5 h-5" />
          </button>

          <div className="mb-6">
            <img src="/logo-white.png" alt="mesa.ads" className="h-7" />
          </div>

          <h3 className="text-lg font-bold mb-1" style={{ color: "hsl(0 0% 95%)" }}>Entrar com e-mail</h3>
          <p className="text-xs mb-6" style={{ color: "hsl(0 0% 50%)" }}>Acesse a plataforma com suas credenciais</p>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="text-xs font-semibold block mb-1.5" style={{ color: "hsl(0 0% 50%)" }}>E-mail</label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4" style={{ color: "hsl(0 0% 40%)" }} />
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full h-10 pl-10 pr-3 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#27d803]"
                  style={{ background: "hsl(0 0% 11%)", border: "1px solid hsl(0 0% 18%)", color: "hsl(0 0% 95%)" }}
                  placeholder="seu@email.com"
                  autoFocus
                />
              </div>
            </div>
            <div>
              <label className="text-xs font-semibold block mb-1.5" style={{ color: "hsl(0 0% 50%)" }}>Senha</label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4" style={{ color: "hsl(0 0% 40%)" }} />
                <input
                  type={showPw ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full h-10 pl-10 pr-10 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#27d803]"
                  style={{ background: "hsl(0 0% 11%)", border: "1px solid hsl(0 0% 18%)", color: "hsl(0 0% 95%)" }}
                  placeholder="Sua senha"
                />
                <button type="button" onClick={() => setShowPw(!showPw)} className="absolute right-3 top-1/2 -translate-y-1/2" style={{ color: "hsl(0 0% 40%)" }}>
                  {showPw ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            {error && <p className="text-xs text-red-400">{error}</p>}

            <button
              type="submit"
              disabled={loading || !email || !password}
              className="w-full h-10 bg-brand text-black font-semibold rounded-lg text-sm hover:opacity-90 transition-opacity disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? "Entrando..." : "Entrar"}
            </button>
          </form>

          <div className="flex items-center gap-3 my-5">
            <div className="flex-1 h-px" style={{ background: "hsl(0 0% 14%)" }} />
            <span className="text-[10px] uppercase tracking-widest" style={{ color: "hsl(0 0% 40%)" }}>ou</span>
            <div className="flex-1 h-px" style={{ background: "hsl(0 0% 14%)" }} />
          </div>

          <a
            href="/api/login"
            className="w-full h-10 flex items-center justify-center gap-2 rounded-lg text-sm font-medium transition-colors hover:opacity-80"
            style={{ border: "1px solid hsl(0 0% 18%)", color: "hsl(0 0% 70%)" }}
          >
            Entrar com Google / GitHub / Apple
          </a>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}

function Hero() {
  const [loginOpen, setLoginOpen] = useState(false);

  return (
    <section className="relative min-h-screen flex flex-col justify-end pb-24 overflow-hidden">
      <motion.div
        className="absolute inset-0"
        initial={{ scale: 1.08 }}
        animate={{ scale: 1 }}
        transition={{ duration: 1.8, ease: [0.25, 0.1, 0.25, 1] }}
      >
        <img src="/images/hero-bar.jpg" alt="" className="w-full h-full object-cover" />
        <div className="hero-overlay absolute inset-0" />
      </motion.div>

      <motion.nav
        className="absolute top-0 left-0 right-0 z-20 flex items-center justify-between px-8 md:px-16 py-6"
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.8, delay: 0.3 }}
      >
        <div>
          <img src="/logo-white.png" alt="mesa.ads" className="h-8" />
        </div>
        <div className="flex items-center gap-6">
          <a
            href="/montar-campanha"
            className="text-sm font-medium transition-colors"
            style={{ color: "hsl(0 0% 50%)" }}
            onMouseEnter={(e) => (e.currentTarget.style.color = "hsl(0 0% 95%)")}
            onMouseLeave={(e) => (e.currentTarget.style.color = "hsl(0 0% 50%)")}
          >
            Montar campanha
          </a>
          <a
            href="#contato"
            className="hidden md:block text-sm font-medium transition-colors"
            style={{ color: "hsl(0 0% 50%)" }}
            onMouseEnter={(e) => (e.currentTarget.style.color = "hsl(0 0% 95%)")}
            onMouseLeave={(e) => (e.currentTarget.style.color = "hsl(0 0% 50%)")}
          >
            Contato
          </a>
        </div>
      </motion.nav>

      <div className="relative z-10 container mx-auto px-6">
        <motion.h1
          className="font-display-landing text-5xl sm:text-6xl md:text-7xl lg:text-8xl font-black leading-[0.95] tracking-tight mb-6"
          style={{ color: "hsl(0 0% 95%)" }}
          initial={{ opacity: 0, y: 60 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 1, delay: 0.2, ease: [0.25, 0.1, 0.25, 1] }}
        >
          Sua marca na mesa
          <br />
          <span className="text-gradient-brand">do consumidor.</span>
        </motion.h1>

        <motion.p
          className="text-lg md:text-xl max-w-lg mb-10 leading-relaxed"
          style={{ color: "hsl(0 0% 50%)" }}
          initial={{ opacity: 0, y: 40 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 0.5 }}
        >
          A maior rede de mídia de mesa do país — porta-copos publicitários em
          restaurantes, cafés e estabelecimentos com alta atenção e alcance hiperlocal.
        </motion.p>

        <motion.div
          className="flex flex-wrap gap-4"
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 0.7 }}
        >
          <motion.a
            href="#ideia"
            whileHover={{ scale: 1.03 }}
            whileTap={{ scale: 0.97 }}
            className="bg-brand px-8 py-3.5 rounded-xl font-display-landing font-bold text-black glow transition-all"
          >
            Saiba mais
          </motion.a>
          <motion.button
            onClick={() => setLoginOpen(true)}
            whileHover={{ scale: 1.03 }}
            whileTap={{ scale: 0.97 }}
            className="backdrop-blur-sm px-8 py-3.5 rounded-xl font-display-landing font-semibold transition-all flex items-center gap-2"
            style={{
              border: "1px solid hsl(0 0% 14%)",
              background: "hsl(0 0% 11% / 0.5)",
              color: "hsl(0 0% 95%)",
            }}
          >
            Entrar na plataforma
            <ArrowRight className="w-4 h-4" />
          </motion.button>
        </motion.div>
      </div>

      <div className="absolute bottom-0 left-0 right-0 h-px" style={{ background: "hsl(0 0% 14%)" }} />
      <EmailLoginModal open={loginOpen} onClose={() => setLoginOpen(false)} />
    </section>
  );
}

function Idea() {
  return (
    <section id="ideia" className="py-28 md:py-36 relative overflow-hidden" style={{ borderBottom: "1px solid hsl(0 0% 14%)" }}>
      <div className="container mx-auto px-6">
        <Reveal>
          <p className="section-label mb-4">A ideia</p>
          <h2 className="section-title text-4xl md:text-5xl lg:text-6xl max-w-3xl mb-6" style={{ color: "hsl(0 0% 95%)" }}>
            Mídia física de alta atenção,{" "}
            <span className="text-gradient-brand">onde as pessoas se conectam.</span>
          </h2>
          <p className="text-lg max-w-xl mb-20 leading-relaxed" style={{ color: "hsl(0 0% 50%)" }}>
            Enquanto o digital disputa frações de segundo, nós capturamos a atenção no
            momento social — com mídia contextual, tangível e recorrente.
          </p>
        </Reveal>

        <Reveal>
          <div className="flex flex-col md:flex-row items-center gap-12 md:gap-20 mb-20">
            <div className="relative w-[280px] h-[280px] md:w-[360px] md:h-[360px] flex-shrink-0">
              <motion.div
                className="w-full h-full relative"
                animate={{ rotate: [0, 2, -2, 0] }}
                transition={{ duration: 6, repeat: Infinity, ease: "easeInOut" }}
              >
                <img
                  src="/images/coaster-blank.jpg"
                  alt="Porta-copos Mesa Ads"
                  className="w-full h-full object-cover rounded-full"
                />
                <div className="absolute inset-0 flex items-center justify-center">
                  <span className="font-display-landing font-extrabold text-xl md:text-2xl text-center leading-tight px-12"
                    style={{ color: "hsl(0 0% 4% / 0.8)" }}
                  >
                    SUA MARCA<br />AQUI
                  </span>
                </div>
              </motion.div>
              <div className="absolute inset-0 -z-10 rounded-full blur-3xl scale-110" style={{ background: "rgba(39, 216, 3, 0.1)" }} />
            </div>

            <div className="text-center md:text-left max-w-md">
              <h3 className="font-display-landing font-extrabold text-3xl md:text-4xl mb-4 leading-tight" style={{ color: "hsl(0 0% 95%)" }}>
                Sua marca na mesa do consumidor.
              </h3>
              <p className="text-lg leading-relaxed" style={{ color: "hsl(0 0% 50%)" }}>
                Porta-copos personalizados com a identidade visual da sua marca, presentes
                em restaurantes, cafés e estabelecimentos da sua região.
              </p>
            </div>
          </div>
        </Reveal>

        <div className="grid md:grid-cols-3 gap-5">
          {[
            { label: "Tangível", desc: "O consumidor toca, segura e interage diretamente com a sua marca durante toda a experiência." },
            { label: "Contextual", desc: "Publicidade entregue no momento certo, no lugar certo — onde o consumidor está relaxado e atento." },
            { label: "Recorrente", desc: "Campanhas rotativas a cada 4 semanas com presença contínua em múltiplos estabelecimentos." },
          ].map((item, i) => (
            <Reveal key={item.label} delay={0.1 + i * 0.1}>
              <div className="card-glass p-8 h-full transition-colors duration-300" style={{ cursor: "default" }}>
                <span className="font-display-landing font-extrabold text-sm tracking-wider" style={{ color: "#27d803" }}>
                  {String(i + 1).padStart(2, "0")}
                </span>
                <h3 className="font-display-landing font-bold text-xl mt-3 mb-2" style={{ color: "hsl(0 0% 95%)" }}>{item.label}</h3>
                <p className="text-sm leading-relaxed" style={{ color: "hsl(0 0% 50%)" }}>{item.desc}</p>
              </div>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}

function Problem() {
  const items = [
    { icon: Eye, title: "Atenção fragmentada", text: "O consumidor é bombardeado por anúncios digitais e ignora a maioria em menos de 2 segundos." },
    { icon: Target, title: "Sem lembrança real", text: "Gerar impacto duradouro e lembrança de marca no offline é cada vez mais difícil." },
    { icon: BarChart3, title: "Zero mensuração", text: "Campanhas offline tradicionais não oferecem dados confiáveis de performance." },
    { icon: DollarSign, title: "OOH caro e genérico", text: "Outdoors e painéis são inacessíveis para marcas locais e pouco segmentados." },
  ];

  return (
    <section className="py-28 md:py-36" style={{ borderBottom: "1px solid hsl(0 0% 14%)" }}>
      <div className="container mx-auto px-6">
        <Reveal>
          <p className="section-label mb-4">O problema</p>
          <h2 className="section-title text-4xl md:text-5xl lg:text-6xl max-w-3xl mb-16" style={{ color: "hsl(0 0% 95%)" }}>
            A publicidade local está{" "}
            <span className="text-gradient-brand">presa no passado.</span>
          </h2>
        </Reveal>

        <div className="grid sm:grid-cols-2 gap-5">
          {items.map((item, i) => (
            <Reveal key={i} delay={i * 0.08}>
              <div className="card-glass p-8 h-full group transition-colors duration-300">
                <item.icon className="w-8 h-8 mb-5 opacity-80 group-hover:opacity-100 transition-opacity" style={{ color: "#27d803" }} />
                <h3 className="font-display-landing font-bold text-xl mb-2" style={{ color: "hsl(0 0% 95%)" }}>{item.title}</h3>
                <p className="text-sm leading-relaxed" style={{ color: "hsl(0 0% 50%)" }}>{item.text}</p>
              </div>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}

function Solution() {
  const features = [
    { icon: Zap, title: "Alta frequência", desc: "Exposição contínua durante toda a experiência — cada interação é uma impressão de marca." },
    { icon: MapPin, title: "Distribuição controlada", desc: "Escolha bairros, perfis e estabelecimentos. Publicidade granular como nunca antes." },
    { icon: RotateCw, title: "Campanhas rotativas", desc: "Batches ativam múltiplos estabelecimentos por 4 semanas, criando presença contínua e escalável." },
  ];

  return (
    <section className="py-28 md:py-36 relative overflow-hidden" style={{ borderBottom: "1px solid hsl(0 0% 14%)" }}>
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] rounded-full blur-[100px] pointer-events-none" style={{ background: "rgba(39, 216, 3, 0.04)" }} />

      <div className="container mx-auto px-6 relative">
        <Reveal>
          <p className="section-label mb-4">A solução</p>
          <h2 className="section-title text-4xl md:text-5xl lg:text-6xl max-w-4xl mb-6" style={{ color: "hsl(0 0% 95%)" }}>
            Porta-copos que se tornam{" "}
            <span className="text-gradient-brand">mídia de impacto.</span>
          </h2>
          <p className="text-lg max-w-xl mb-16 leading-relaxed" style={{ color: "hsl(0 0% 50%)" }}>
            Uma rede escalável que conecta marcas locais ao momento social, com
            alcance e recorrência que o digital não consegue replicar.
          </p>
        </Reveal>

        <div className="grid md:grid-cols-3 gap-5">
          {features.map((f, i) => (
            <Reveal key={i} delay={i * 0.12}>
              <div className="card-glass p-8 h-full relative group overflow-hidden transition-colors duration-300">
                <div className="absolute top-0 left-0 w-0 h-0.5 bg-brand group-hover:w-full transition-all duration-500" />
                <span className="block font-display-landing text-6xl font-black select-none" style={{ color: "hsl(0 0% 95% / 0.04)" }}>
                  0{i + 1}
                </span>
                <f.icon className="w-7 h-7 mb-4 opacity-80" style={{ color: "#27d803" }} />
                <h3 className="font-display-landing font-bold text-xl mb-3" style={{ color: "hsl(0 0% 95%)" }}>{f.title}</h3>
                <p className="text-sm leading-relaxed" style={{ color: "hsl(0 0% 50%)" }}>{f.desc}</p>
              </div>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}

function Market() {
  const stats = [
    { end: 5, suffix: ",5 bi", prefix: "R$", label: "Mercado OOH Brasil 2024" },
    { end: 89, suffix: "%", prefix: "", label: "Da população atingida por OOH" },
    { end: 11, suffix: "%", prefix: "", label: "Do bolo publicitário total" },
    { end: 10887, suffix: "", prefix: "", label: "Locais e estabelecimentos em Manaus" },
  ];

  return (
    <section className="py-28 md:py-36" style={{ borderBottom: "1px solid hsl(0 0% 14%)" }}>
      <div className="container mx-auto px-6">
        <Reveal>
          <p className="section-label mb-4">O mercado</p>
          <h2 className="section-title text-4xl md:text-5xl lg:text-6xl max-w-3xl mb-20" style={{ color: "hsl(0 0% 95%)" }}>
            Um mercado de{" "}
            <span className="text-gradient-brand">bilhões</span> em crescimento.
          </h2>
        </Reveal>

        <div className="grid grid-cols-2 lg:grid-cols-4 gap-5 mb-16">
          {stats.map((s, i) => (
            <Reveal key={i} delay={i * 0.08}>
              <div className="card-glass p-7 text-center">
                <p className="stat-value text-gradient-brand text-5xl md:text-6xl mb-2">
                  <Counter end={s.end} suffix={s.suffix} prefix={s.prefix} />
                </p>
                <p className="text-xs md:text-sm" style={{ color: "hsl(0 0% 50%)" }}>{s.label}</p>
              </div>
            </Reveal>
          ))}
        </div>

        <Reveal delay={0.3}>
          <div className="max-w-2xl mx-auto text-center">
            <p className="leading-relaxed" style={{ color: "hsl(0 0% 50%)" }}>
              A mídia OOH atinge <span className="font-semibold" style={{ color: "hsl(0 0% 95%)" }}>89% da população brasileira</span>,
              e o segmento cresceu para representar mais que o dobro do valor de uma década atrás.
              O meio físico segue forte — sobretudo em campanhas com foco em{" "}
              <span className="font-semibold" style={{ color: "#27d803" }}>presença local</span>.
            </p>
          </div>
        </Reveal>
      </div>
    </section>
  );
}

function CTA() {
  return (
    <section id="contato" className="py-28 md:py-36 relative overflow-hidden">
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] rounded-full blur-[120px] pointer-events-none" style={{ background: "rgba(39, 216, 3, 0.06)" }} />

      <div className="container mx-auto px-6 relative text-center">
        <Reveal>
          <h2 className="font-display-landing text-4xl md:text-5xl lg:text-7xl font-black leading-[1] tracking-tight mb-6" style={{ color: "hsl(0 0% 95%)" }}>
            Coloque sua marca
            <br />
            <span className="text-gradient-brand">na mesa certa.</span>
          </h2>
          <p className="text-lg max-w-md mx-auto mb-12 leading-relaxed" style={{ color: "hsl(0 0% 50%)" }}>
            Fale com a gente e descubra como a mesa.ads transforma a presença da sua marca.
          </p>
        </Reveal>

        <Reveal delay={0.2}>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <motion.a
              href="mailto:contato@mesaads.com.br"
              whileHover={{ scale: 1.04 }}
              whileTap={{ scale: 0.97 }}
              className="inline-block bg-brand px-12 py-4 rounded-xl font-display-landing font-bold text-lg text-black glow transition-all"
            >
              Entre em contato
            </motion.a>
            <motion.a
              href="/api/login"
              whileHover={{ scale: 1.04 }}
              whileTap={{ scale: 0.97 }}
              className="inline-flex items-center gap-2 px-12 py-4 rounded-xl font-display-landing font-semibold text-lg transition-all"
              style={{
                border: "1px solid hsl(0 0% 14%)",
                background: "hsl(0 0% 11% / 0.5)",
                color: "hsl(0 0% 95%)",
              }}
            >
              Acessar plataforma
              <ArrowRight className="w-5 h-5" />
            </motion.a>
          </div>
        </Reveal>
      </div>

      <div className="container mx-auto px-6 mt-28">
        <div className="pt-8 flex flex-col md:flex-row justify-between items-center gap-4" style={{ borderTop: "1px solid hsl(0 0% 14%)" }}>
          <div>
            <img src="/logo-white.png" alt="mesa.ads" className="h-6" />
          </div>
          <p className="text-xs" style={{ color: "hsl(0 0% 50%)" }}>
            © {new Date().getFullYear()} mesa.ads — Todos os direitos reservados.
          </p>
        </div>
      </div>
    </section>
  );
}

export default function LandingPage() {
  return (
    <main className="landing-page min-h-screen" style={{ scrollBehavior: "smooth" }}>
      <Hero />
      <Idea />
      <Problem />
      <Solution />
      <Market />
      <CTA />
    </main>
  );
}
