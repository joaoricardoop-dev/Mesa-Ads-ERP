import { CheckCircle2, ArrowRight, ExternalLink } from "lucide-react";
import { motion } from "framer-motion";
import { useLocation } from "wouter";
import { useWizardStore } from "./wizardStore";
import { MesaButton, MesaAdsLogo } from "./mesa/MesaUI";

interface Props {
  role: "anunciante" | "parceiro" | "internal";
}

export function StepSuccess({ role }: Props) {
  const quotationNumber = useWizardStore((s) => s.quotationNumber);
  const quotationId = useWizardStore((s) => s.quotationId);
  const reset = useWizardStore((s) => s.reset);
  const [, setLocation] = useLocation();

  const portalPath = role === "anunciante" ? "/portal" : "/";
  const portalLabel = role === "internal" ? "voltar ao portal" : "ir para o portal";
  const quotationPath = quotationId ? `/comercial/cotacoes/${quotationId}` : "/comercial/cotacoes";

  return (
    <div className="relative min-h-screen flex flex-col text-chalk overflow-hidden">
      <header className="relative z-20 px-6 sm:px-10 pt-6 pb-4 flex items-center justify-between">
        <a href="/" className="inline-flex items-center gap-3">
          <MesaAdsLogo className="text-xl" />
          <span className="hidden sm:inline-flex items-center gap-1.5 text-[10px] uppercase tracking-[0.22em] text-chalk-dim border-l border-hairline pl-3">
            auto-checkout
          </span>
        </a>
      </header>

      <main className="flex-1 grid place-items-center px-6 py-12">
        <motion.div
          initial={{ opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.55, ease: [0.22, 1, 0.36, 1] }}
          className="max-w-xl w-full text-center"
        >
          <motion.div
            initial={{ scale: 0.6, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ duration: 0.5, delay: 0.1, ease: [0.22, 1, 0.36, 1] }}
            className="mx-auto size-16 rounded-full bg-mesa-neon/15 border border-mesa-neon/40 flex items-center justify-center mb-7 shadow-neon-sm"
          >
            <CheckCircle2 className="w-8 h-8 text-mesa-neon" />
          </motion.div>

          <h1
            className="font-display font-semibold tracking-[-0.04em] text-chalk text-balance leading-[1]"
            style={{ fontSize: "var(--text-title)" }}
          >
            cotação <span className="text-mesa-neon">enviada</span>.
          </h1>

          <p className="mt-5 text-[15px] text-chalk-muted leading-relaxed">
            Sua solicitação foi recebida e está como rascunho na fila do time comercial.
          </p>

          {quotationNumber && (
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full border border-mesa-neon/30 bg-mesa-neon/10 text-mesa-neon text-[12px] tabular-nums tracking-tight mt-5 mb-9">
              número: <span className="font-mono font-bold">{quotationNumber}</span>
            </div>
          )}

          <div className="rounded-2xl border border-hairline bg-ink-900/50 backdrop-blur-md p-5 text-left mb-7">
            <div className="text-[10px] uppercase tracking-[0.22em] text-chalk-dim mb-3">
              próximos passos
            </div>
            <ol className="text-[13px] text-chalk-muted space-y-2 list-decimal list-inside leading-relaxed">
              <li>O time comercial revisa os detalhes e faz ajustes se necessário.</li>
              <li>Você recebe a cotação final aprovada por e-mail.</li>
              <li>Após aceite, a campanha entra em produção.</li>
            </ol>
          </div>

          <div className="flex flex-col sm:flex-row gap-3 justify-center flex-wrap">
            <MesaButton
              variant="primary"
              size="md"
              onClick={() => setLocation(portalPath)}
              iconRight={<ArrowRight className="w-4 h-4" />}
              data-testid="button-go-portal"
            >
              {portalLabel}
            </MesaButton>
            {role === "internal" && (
              <MesaButton
                variant="ghost"
                size="md"
                onClick={() => setLocation(quotationPath)}
                iconRight={<ExternalLink className="w-4 h-4" />}
                data-testid="button-view-quotation"
              >
                ver cotação
              </MesaButton>
            )}
            <MesaButton variant="quiet" size="md" onClick={() => reset()}>
              criar outra
            </MesaButton>
          </div>
        </motion.div>
      </main>
    </div>
  );
}
