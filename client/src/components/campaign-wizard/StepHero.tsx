import { useState } from "react";
import { Loader2, ArrowRight, Sparkles } from "lucide-react";
import { motion } from "framer-motion";
import { useLocation } from "wouter";
import { trpc, type RouterOutputs } from "@/lib/trpc";
import { useAuth } from "@/hooks/use-auth";
import { useWizardStore } from "./wizardStore";
import { CoasterStage } from "./mesa/CoasterStage";
import { MesaButton, MesaChip } from "./mesa/MesaUI";
import { MesaProgressRail } from "./mesa/MesaProgressRail";
import { cn } from "@/lib/utils";

type ProductRow = RouterOutputs["product"]["list"][number];

interface Props {
  role: "anunciante" | "parceiro" | "internal" | "guest";
  clientLabel: string | null;
  hasPartner: boolean;
}

export function StepHero({ role }: Props) {
  const [, setLocation] = useLocation();
  const { isAuthenticated } = useAuth();
  const productId = useWizardStore((s) => s.productId);
  const setProduct = useWizardStore((s) => s.setProduct);
  const next = useWizardStore((s) => s.next);

  const { data: privateProducts = [], isLoading: loadingPrivate } = trpc.product.list.useQuery(
    undefined,
    { enabled: isAuthenticated },
  );
  const { data: publicProducts = [], isLoading: loadingPublic } = trpc.product.listPublic.useQuery(
    undefined,
    { enabled: !isAuthenticated },
  );
  const productList = (isAuthenticated ? privateProducts : publicProducts) as ProductRow[];
  const isLoading = isAuthenticated ? loadingPrivate : loadingPublic;

  const visible = productList.filter((p) => {
    if (!p.isActive) return false;
    if (role === "anunciante") return p.visibleToAdvertisers;
    if (role === "parceiro") return p.visibleToPartners;
    if (role === "guest") return p.visibleToAdvertisers;
    return true;
  });

  const [hovered, setHovered] = useState<number | null>(null);
  const focusedId = hovered ?? productId;
  const focusedProduct = productList.find((p) => p.id === focusedId) ?? null;

  function handleAdvance() {
    if (!productId) return;
    if (!isAuthenticated) {
      try {
        localStorage.setItem("mesa-checkout-pending", "1");
      } catch {}
      setLocation("/?mode=signup&redirect=/montar-campanha%3Fstep%3Dvenues");
      return;
    }
    next();
  }

  return (
    <div className="relative min-h-screen text-chalk overflow-hidden lg:pl-[124px] pt-[64px] lg:pt-0">
      <MesaProgressRail />

      {/* 3D coaster scene */}
      <CoasterStage className="absolute inset-0 z-0 lg:left-[124px] top-[64px] lg:top-0 [touch-action:none]" />

      {/* Vignette overlay so text remains legible above the scene */}
      <div className="pointer-events-none absolute inset-0 z-[1] lg:left-[124px] top-[64px] lg:top-0 bg-[radial-gradient(ellipse_at_center,transparent_0%,rgba(4,4,5,0.55)_55%,rgba(4,4,5,0.92)_100%)]" />

      <div className="relative z-10 min-h-[calc(100vh-64px)] lg:min-h-screen flex flex-col">
        <header className="px-6 sm:px-10 pt-6 flex items-center justify-end">
          <div className="flex items-center gap-3">
            <MesaChip tone="neon" dot size="xs">ao vivo</MesaChip>
            {!isAuthenticated && (
              <button
                onClick={() => setLocation("/?mode=signin&redirect=/montar-campanha")}
                className="text-[12px] tracking-tight text-chalk-muted hover:text-chalk transition-colors"
              >
                Entrar
              </button>
            )}
          </div>
        </header>

        <main className="flex-1 grid place-items-center px-6 sm:px-10 py-10">
          <div className="max-w-5xl text-center">
            <motion.div
              initial={{ opacity: 0, y: 14 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
              className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-mesa-neon/10 border border-mesa-neon/30 text-mesa-neon mb-7 text-[11px] uppercase tracking-[0.22em] font-semibold"
            >
              <Sparkles className="w-3.5 h-3.5" />
              monte sua campanha em 60 segundos
            </motion.div>

            <motion.h1
              initial={{ opacity: 0, y: 18 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.7, delay: 0.05, ease: [0.22, 1, 0.36, 1] }}
              className="font-display font-semibold tracking-[-0.04em] leading-[0.95] text-chalk text-balance"
              style={{ fontSize: "var(--text-mega)" }}
            >
              tenta me <span className="text-mesa-neon">ignorar</span>.
            </motion.h1>

            <motion.p
              initial={{ opacity: 0, y: 14 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.7, delay: 0.18, ease: [0.22, 1, 0.36, 1] }}
              className="mt-7 max-w-[58ch] mx-auto text-base sm:text-lg leading-relaxed text-chalk-muted text-pretty"
            >
              Porta-copos que viram mídia. Sua marca na mesa, no momento certo,
              durante toda a refeição. Escolha o produto e siga — o checkout
              monta o restante com você.
            </motion.p>

            {/* Product selector pills */}
            <motion.div
              initial={{ opacity: 0, y: 14 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.7, delay: 0.32 }}
              className="mt-12"
            >
              {isLoading ? (
                <div className="inline-flex items-center gap-2 text-sm text-chalk-muted">
                  <Loader2 className="w-4 h-4 animate-spin" /> carregando produtos…
                </div>
              ) : visible.length === 0 ? (
                <div className="text-sm text-chalk-muted">
                  Nenhum produto disponível no momento.
                </div>
              ) : (
                <div className="flex flex-wrap items-center justify-center gap-3">
                  {visible.map((p, i) => {
                    const active = p.id === productId;
                    return (
                      <motion.button
                        key={p.id}
                        type="button"
                        onClick={() => setProduct(p.id)}
                        onMouseEnter={() => setHovered(p.id)}
                        onMouseLeave={() => setHovered(null)}
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.5, delay: 0.4 + i * 0.07 }}
                        whileHover={{ y: -2 }}
                        whileTap={{ scale: 0.97 }}
                        className={cn(
                          "group relative px-5 py-3 rounded-2xl text-left transition-all duration-300 ease-apple backdrop-blur-md",
                          active
                            ? "bg-mesa-neon text-ink-950 border border-mesa-neon shadow-neon-sm"
                            : "bg-ink-900/70 border border-hairline text-chalk hover:border-mesa-neon/50",
                        )}
                      >
                        <div
                          className={cn(
                            "text-[10px] uppercase tracking-[0.22em] font-semibold mb-0.5",
                            active ? "text-ink-950/70" : "text-chalk-dim",
                          )}
                        >
                          {p.tipo}
                        </div>
                        <div className="font-display font-semibold tracking-tight text-[15px]">
                          {p.name}
                        </div>
                      </motion.button>
                    );
                  })}
                </div>
              )}
            </motion.div>

            {/* Focused product description */}
            {focusedProduct?.description && (
              <motion.p
                key={focusedProduct.id}
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.4 }}
                className="mt-6 max-w-[58ch] mx-auto text-[13px] text-chalk-muted/80 leading-relaxed"
              >
                {focusedProduct.description}
              </motion.p>
            )}

            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.6, delay: 0.7 }}
              className="mt-10 flex flex-col items-center gap-3"
            >
              <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
                <MesaButton
                  variant="primary"
                  size="lg"
                  disabled={!productId}
                  onClick={handleAdvance}
                  iconRight={<ArrowRight className="w-5 h-5" />}
                >
                  {isAuthenticated ? "começar checkout" : "quero anunciar"}
                </MesaButton>
                {!isAuthenticated && (
                  <MesaButton
                    variant="ghost"
                    size="lg"
                    disabled={!productId}
                    onClick={() => {
                      if (!productId) return;
                      setLocation("/?mode=signin&redirect=/montar-campanha");
                    }}
                  >
                    já tenho conta
                  </MesaButton>
                )}
              </div>
              {!isAuthenticated && (
                <span className="text-[12px] text-chalk-dim">
                  sua escolha fica salva enquanto você {productId ? "entra ou cria a conta" : "escolhe um produto"}.
                </span>
              )}
            </motion.div>
          </div>
        </main>

        <footer className="px-6 sm:px-10 pb-6 text-center">
          <p className="text-[10px] tracking-[0.22em] uppercase text-chalk-dim/70">
            mesa.ads · manaus · am
          </p>
        </footer>
      </div>
    </div>
  );
}
