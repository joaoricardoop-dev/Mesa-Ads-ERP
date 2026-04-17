import { useEffect, useMemo, useState } from "react";
import { Loader2, Building2, Search, UserX } from "lucide-react";
import { trpc, type RouterOutputs } from "@/lib/trpc";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/use-auth";
import { useWizardStore } from "./wizardStore";
import { StepHero } from "./StepHero";
import { StepVenues } from "./StepVenues";
import { StepVolume } from "./StepVolume";
import { StepDuration } from "./StepDuration";
import { StepUpsell } from "./StepUpsell";
import { StepCreative } from "./StepCreative";
import { StepConfirm } from "./StepConfirm";
import { StepSuccess } from "./StepSuccess";
import { cn } from "@/lib/utils";

type Source = "self_service_anunciante" | "self_service_parceiro" | "internal";

function resolveRoleAndSource(role: string | null | undefined): {
  role: "anunciante" | "parceiro" | "internal";
  source: Source;
} | null {
  if (!role) return null;
  if (role === "anunciante") return { role: "anunciante", source: "self_service_anunciante" };
  if (role === "parceiro") return { role: "parceiro", source: "self_service_parceiro" };
  if (["admin", "comercial", "manager", "operacoes", "financeiro"].includes(role)) {
    return { role: "internal", source: "internal" };
  }
  return null;
}

export default function CampaignWizard() {
  const { user } = useAuth();
  const step = useWizardStore((s) => s.step);
  const reset = useWizardStore((s) => s.reset);

  const resolved = resolveRoleAndSource(user?.role);

  // Reset wizard whenever the page mounts fresh.
  useEffect(() => {
    reset();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  type ClientChoice = { kind: "client"; id: number } | { kind: "none" };
  const [choice, setChoice] = useState<ClientChoice | null>(null);

  // Anunciante: clientId comes from user.clientId.
  const autoClientId = resolved?.role === "anunciante" ? user?.clientId ?? null : null;
  const effectiveChoice: ClientChoice | null =
    autoClientId != null ? { kind: "client", id: autoClientId } : choice;

  if (!resolved) {
    return (
      <div className="min-h-screen flex items-center justify-center text-sm text-muted-foreground">
        Seu perfil não tem acesso ao wizard.
      </div>
    );
  }

  if (resolved.role === "anunciante" && !autoClientId) {
    return (
      <div className="min-h-screen flex items-center justify-center px-6 text-center">
        <div>
          <div className="mx-auto size-12 rounded-full bg-amber-500/15 flex items-center justify-center mb-4">
            <Building2 className="w-5 h-5 text-amber-400" />
          </div>
          <div className="font-semibold mb-1">Sua conta ainda não tem um cliente vinculado.</div>
          <p className="text-sm text-muted-foreground max-w-md">
            Complete o cadastro do anunciante antes de montar uma campanha.
          </p>
        </div>
      </div>
    );
  }

  if (effectiveChoice == null && resolved.role !== "anunciante") {
    return (
      <ClientPicker
        role={resolved.role}
        onPicked={(id) => setChoice({ kind: "client", id })}
        onSkip={resolved.role === "internal" ? () => setChoice({ kind: "none" }) : undefined}
      />
    );
  }

  if (effectiveChoice == null) {
    return null;
  }

  if (step === "success") {
    return <StepSuccess role={resolved.role} />;
  }

  return (
    <ResolvedWizard
      clientId={effectiveChoice.kind === "client" ? effectiveChoice.id : null}
      role={resolved.role}
      source={resolved.source}
    />
  );
}

type AdvertiserGet = RouterOutputs["advertiser"]["get"];

function ResolvedWizard({
  clientId,
  role,
  source,
}: {
  clientId: number | null;
  role: "anunciante" | "parceiro" | "internal";
  source: Source;
}) {
  const step = useWizardStore((s) => s.step);

  const { data: client } = trpc.advertiser.get.useQuery(
    { id: clientId ?? 0 },
    { enabled: clientId != null },
  );
  const c = client as AdvertiserGet | undefined;
  const clientLabel = clientId == null ? "Sem cliente específico" : c?.company || c?.name || null;
  const hasPartner = !!c?.partnerId || role === "parceiro";

  switch (step) {
    case "hero":
      return <StepHero role={role} clientLabel={clientLabel} hasPartner={hasPartner} />;
    case "venues":
      return <StepVenues clientLabel={clientLabel} hasPartner={hasPartner} />;
    case "volume":
      return <StepVolume clientLabel={clientLabel} hasPartner={hasPartner} />;
    case "duration":
      return <StepDuration clientLabel={clientLabel} hasPartner={hasPartner} />;
    case "upsell":
      return <StepUpsell clientLabel={clientLabel} hasPartner={hasPartner} />;
    case "creative":
      return <StepCreative clientLabel={clientLabel} hasPartner={hasPartner} />;
    case "confirm":
      return (
        <StepConfirm
          clientId={clientId}
          clientLabel={clientLabel}
          hasPartner={hasPartner}
          source={source}
        />
      );
    default:
      return null;
  }
}

type PartnerClient = RouterOutputs["advertiser"]["listByPartner"][number];

function ClientPicker({
  role,
  onPicked,
  onSkip,
}: {
  role: "parceiro" | "internal";
  onPicked: (id: number) => void;
  onSkip?: () => void;
}) {
  const [query, setQuery] = useState("");
  const { data: clients = [], isLoading } = trpc.advertiser.listByPartner.useQuery({});

  const filtered = useMemo<PartnerClient[]>(() => {
    const q = query.trim().toLowerCase();
    if (!q) return clients;
    return clients.filter(
      (c) =>
        (c.name ?? "").toLowerCase().includes(q) ||
        (c.company ?? "").toLowerCase().includes(q),
    );
  }, [clients, query]);

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border/40 bg-card/40 backdrop-blur-sm">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 py-3 flex items-center gap-3">
          <img src="/logo-white.png" alt="mesa.ads" className="h-5 hidden sm:block" />
          <span className="text-xs text-muted-foreground border-l border-border/30 pl-3 hidden sm:block">
            Montar campanha
          </span>
        </div>
      </header>
      <div className="max-w-3xl mx-auto px-4 sm:px-6 py-10">
        <h1 className="text-2xl sm:text-3xl font-bold mb-1.5">
          {role === "parceiro" ? "Para qual cliente?" : "Selecione o cliente"}
        </h1>
        <p className="text-sm text-muted-foreground mb-6">
          {role === "parceiro"
            ? "Escolha um dos seus clientes para montar a campanha."
            : "Escolha o cliente para o qual a cotação será criada."}
        </p>

        <div className="relative max-w-md mb-5">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Buscar cliente..."
            className="pl-9"
          />
        </div>

        {onSkip && (
          <button
            type="button"
            onClick={onSkip}
            className="mb-4 w-full flex items-center justify-between gap-4 px-4 py-3 rounded-lg border border-dashed border-border/60 bg-card/30 hover:border-primary hover:bg-primary/5 transition-colors text-left"
            data-testid="button-skip-client"
          >
            <div className="flex items-center gap-3 min-w-0">
              <div className="size-8 rounded-md bg-muted flex items-center justify-center shrink-0">
                <UserX className="w-4 h-4 text-muted-foreground" />
              </div>
              <div className="min-w-0">
                <div className="font-medium">Sem cliente específico</div>
                <div className="text-xs text-muted-foreground">
                  Criar cotação interna sem vincular a um cliente.
                </div>
              </div>
            </div>
            <Button size="sm" variant="ghost" tabIndex={-1}>Selecionar</Button>
          </button>
        )}

        {isLoading ? (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="w-4 h-4 animate-spin" /> Carregando clientes...
          </div>
        ) : filtered.length === 0 ? (
          <div className="rounded-lg border border-dashed border-border/40 p-8 text-center">
            <p className="text-sm text-muted-foreground mb-3">
              {role === "parceiro"
                ? "Você ainda não tem clientes cadastrados."
                : "Nenhum cliente encontrado."}
            </p>
          </div>
        ) : (
          <div className="grid gap-2 max-h-[60vh] overflow-y-auto pr-1">
            {filtered.map((c) => (
              <button
                key={c.id}
                type="button"
                onClick={() => onPicked(c.id)}
                className={cn(
                  "w-full flex items-center justify-between gap-4 px-4 py-3 rounded-lg border border-border/40 bg-card/40 hover:border-primary hover:bg-primary/5 transition-colors text-left",
                )}
              >
                <div className="min-w-0">
                  <div className="font-medium truncate">{c.company || c.name}</div>
                  {c.company && c.name && (
                    <div className="text-xs text-muted-foreground truncate">{c.name}</div>
                  )}
                </div>
                <Button size="sm" variant="ghost" tabIndex={-1}>
                  Selecionar
                </Button>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
