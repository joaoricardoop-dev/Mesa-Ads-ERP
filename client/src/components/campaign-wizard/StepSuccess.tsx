import { CheckCircle2, ArrowRight, ExternalLink } from "lucide-react";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { useWizardStore } from "./wizardStore";

interface Props {
  role: "anunciante" | "parceiro" | "internal";
}

export function StepSuccess({ role }: Props) {
  const quotationNumber = useWizardStore((s) => s.quotationNumber);
  const quotationId = useWizardStore((s) => s.quotationId);
  const reset = useWizardStore((s) => s.reset);
  const [, setLocation] = useLocation();

  // Nota: "/parceiro" público é o onboarding de restaurantes; o portal real do
  // parceiro está em "/" (ou "/portal") quando autenticado pelo ParceiroRouter.
  const portalPath = role === "anunciante" ? "/portal" : "/";
  const portalLabel = role === "internal" ? "Voltar ao Portal" : "Ir para o portal";
  const quotationPath = quotationId ? `/comercial/cotacoes/${quotationId}` : "/comercial/cotacoes";

  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center px-6 py-12">
      <div className="max-w-xl w-full text-center">
        <div className="mx-auto size-16 rounded-full bg-primary/15 flex items-center justify-center mb-6">
          <CheckCircle2 className="w-8 h-8 text-primary" />
        </div>
        <h1 className="text-3xl sm:text-4xl font-bold tracking-tight mb-3">Cotação enviada!</h1>
        <p className="text-muted-foreground mb-2">
          Sua solicitação foi recebida e está como rascunho na fila do time comercial.
        </p>
        {quotationNumber && (
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-primary/10 text-primary text-sm font-medium mt-2 mb-8">
            Número da cotação: <span className="font-bold">{quotationNumber}</span>
          </div>
        )}

        <div className="rounded-xl border border-border/40 bg-card/40 p-5 text-left mb-6">
          <div className="text-xs uppercase tracking-widest text-muted-foreground mb-2">
            Próximos passos
          </div>
          <ol className="text-sm space-y-2 list-decimal list-inside text-muted-foreground">
            <li>O time comercial revisa os detalhes e faz ajustes se necessário.</li>
            <li>Você recebe a cotação final aprovada por e-mail.</li>
            <li>Após aceite, a campanha entra em produção.</li>
          </ol>
        </div>

        <div className="flex flex-col sm:flex-row gap-3 justify-center flex-wrap">
          <Button onClick={() => setLocation(portalPath)} className="gap-2" data-testid="button-go-portal">
            {portalLabel}
            <ArrowRight className="w-4 h-4" />
          </Button>
          {role === "internal" && (
            <Button
              variant="outline"
              onClick={() => setLocation(quotationPath)}
              className="gap-2"
              data-testid="button-view-quotation"
            >
              Ver Cotação
              <ExternalLink className="w-4 h-4" />
            </Button>
          )}
          <Button
            variant="ghost"
            onClick={() => {
              reset();
            }}
          >
            Criar outra campanha
          </Button>
        </div>
      </div>
    </div>
  );
}
