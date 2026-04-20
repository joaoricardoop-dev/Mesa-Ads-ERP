import { useEffect, useMemo, useState } from "react";
import { Loader2, Building2, Search, UserX } from "lucide-react";
import { trpc, type RouterOutputs } from "@/lib/trpc";
import { Input } from "@/components/ui/input";
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
import { MesaButton, MesaAdsLogo } from "./mesa/MesaUI";
import { cn } from "@/lib/utils";

type Source = "self_service_anunciante" | "self_service_parceiro" | "internal";
type ResolvedRole = "anunciante" | "parceiro" | "internal";

function resolveRoleAndSource(role: string | null | undefined): {
  role: ResolvedRole;
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
  const { user, isLoading, isAuthenticated } = useAuth();
  const step = useWizardStore((s) => s.step);

  const resolved = resolveRoleAndSource(user?.role);

  // While auth is resolving, don't flash the hero/picker — show a quiet loader.
  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center text-sm text-chalk-muted">
        <Loader2 className="w-4 h-4 animate-spin mr-2" /> carregando…
      </div>
    );
  }

  // Logged-out visitors: show hero immediately as a "guest". Any other step
  // attempts a redirect to Clerk (preserving their selection in localStorage).
  if (!isAuthenticated) {
    if (step === "hero") {
      return <StepHero role="guest" clientLabel={null} hasPartner={false} />;
    }
    return <RequireAuthGate />;
  }

  // Logged in but role isn't allowed in the checkout: send them home with a
  // clear pointer to the right portal.
  if (!resolved) {
    const roleKey = (user?.role ?? "").toLowerCase();
    const portal =
      roleKey === "restaurante" || roleKey === "restaurant"
        ? { href: "/parceiro", label: "ir para o portal do restaurante" }
        : roleKey === "anunciante"
        ? { href: "/portal", label: "ir para o portal do anunciante" }
        : { href: "/", label: "voltar para o início" };
    return (
      <Centered
        title="Seu perfil não tem acesso ao checkout."
        icon={<UserX className="w-5 h-5 text-mesa-amber" />}
      >
        <p className="text-sm text-chalk-muted max-w-md mx-auto mb-5">
          Esta conta não está habilitada para montar campanhas. Use o portal correspondente
          ao seu perfil ou fale com o time mesa.ads.
        </p>
        <div className="flex items-center justify-center gap-3">
          <a
            href={portal.href}
            className="inline-flex items-center gap-2 h-11 px-6 rounded-full bg-mesa-neon text-ink-950 font-semibold text-sm shadow-neon-sm hover:brightness-110 transition"
          >
            {portal.label}
          </a>
          <a
            href="/"
            className="text-xs text-chalk-muted hover:text-chalk underline-offset-2 hover:underline"
          >
            voltar para a home
          </a>
        </div>
      </Centered>
    );
  }

  return (
    <ResolvedFlow
      role={resolved.role}
      source={resolved.source}
      autoClientId={resolved.role === "anunciante" ? user?.clientId ?? null : null}
      onboardingComplete={user?.onboardingComplete !== false}
    />
  );
}

function ResolvedFlow({
  role,
  source,
  autoClientId,
  onboardingComplete,
}: {
  role: ResolvedRole;
  source: Source;
  autoClientId: number | null;
  onboardingComplete: boolean;
}) {
  type ClientChoice = { kind: "client"; id: number } | { kind: "none" };
  const [choice, setChoice] = useState<ClientChoice | null>(null);

  const effectiveChoice: ClientChoice | null =
    autoClientId != null ? { kind: "client", id: autoClientId } : choice;

  const step = useWizardStore((s) => s.step);
  const goTo = useWizardStore((s) => s.goTo);

  if (role === "anunciante" && !autoClientId) {
    return (
      <Centered
        title="Sua conta ainda não tem um cliente vinculado."
        icon={<Building2 className="w-5 h-5 text-mesa-amber" />}
      >
        <p className="text-sm text-chalk-muted max-w-md">
          {onboardingComplete
            ? "Fale com o time mesa.ads para vincular seu cadastro de anunciante."
            : "Complete o cadastro do anunciante antes de montar uma campanha."}
        </p>
      </Centered>
    );
  }

  // Partner & internal users must pick a client BEFORE seeing the hero/wizard.
  if (effectiveChoice == null && role !== "anunciante") {
    return (
      <ClientPicker
        role={role}
        onPicked={(id) => setChoice({ kind: "client", id })}
        onSkip={role === "internal" ? () => setChoice({ kind: "none" }) : undefined}
        onBack={() => goTo("hero")}
      />
    );
  }

  if (effectiveChoice == null) return null;

  const clientId = effectiveChoice.kind === "client" ? effectiveChoice.id : null;

  if (step === "success") {
    return <StepSuccess role={role} />;
  }

  return (
    <ResolvedWizard clientId={clientId} role={role} source={source} />
  );
}

type AdvertiserGet = RouterOutputs["advertiser"]["get"];

function ResolvedWizard({
  clientId,
  role,
  source,
}: {
  clientId: number | null;
  role: ResolvedRole;
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

function RequireAuthGate() {
  const goTo = useWizardStore((s) => s.goTo);
  useEffect(() => {
    // Send the visitor to signup, telling Clerk to bring them back here.
    window.location.href = "/?mode=signup&redirect=/montar-campanha";
  }, []);
  return (
    <Centered title="redirecionando para o cadastro…">
      <button
        onClick={() => goTo("hero")}
        className="text-xs text-chalk-muted underline-offset-2 hover:underline"
      >
        voltar para o início
      </button>
    </Centered>
  );
}

function Centered({
  title,
  icon,
  children,
}: {
  title: string;
  icon?: React.ReactNode;
  children?: React.ReactNode;
}) {
  return (
    <div className="min-h-screen flex items-center justify-center px-6 text-center text-chalk">
      <div>
        {icon && (
          <div className="mx-auto size-12 rounded-full bg-mesa-amber/15 flex items-center justify-center mb-4">
            {icon}
          </div>
        )}
        <div className="font-semibold mb-1">{title}</div>
        {children}
      </div>
    </div>
  );
}

type PartnerClient = RouterOutputs["advertiser"]["listByPartner"][number];

function ClientPicker({
  role,
  onPicked,
  onSkip,
  onBack,
}: {
  role: "parceiro" | "internal";
  onPicked: (id: number) => void;
  onSkip?: () => void;
  onBack: () => void;
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
    <div className="min-h-screen text-chalk">
      <header className="px-6 sm:px-10 pt-6 pb-4 flex items-center justify-between">
        <a href="/" className="inline-flex items-center gap-3">
          <MesaAdsLogo className="text-xl" />
          <span className="hidden sm:inline-flex items-center gap-1.5 text-[10px] uppercase tracking-[0.22em] text-chalk-dim border-l border-hairline pl-3">
            auto-checkout
          </span>
        </a>
        <button
          onClick={onBack}
          className="text-[12px] text-chalk-muted hover:text-chalk transition-colors"
        >
          ← voltar para o início
        </button>
      </header>
      <div className="max-w-3xl mx-auto px-6 sm:px-10 py-10">
        <div className="text-[10px] uppercase tracking-[0.22em] text-mesa-neon mb-3">
          escolha o cliente
        </div>
        <h1
          className="font-display font-semibold tracking-[-0.03em] text-chalk text-balance mb-3"
          style={{ fontSize: "var(--text-title)" }}
        >
          {role === "parceiro" ? "Para qual cliente?" : "Selecione o cliente"}
        </h1>
        <p className="text-sm text-chalk-muted mb-8 max-w-xl">
          {role === "parceiro"
            ? "Escolha um dos seus clientes para montar a campanha."
            : "Escolha o cliente para o qual a cotação será criada."}
        </p>

        <div className="relative max-w-md mb-5">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-chalk-dim" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Buscar cliente..."
            className="pl-9 bg-ink-900/70 border-hairline text-chalk placeholder:text-chalk-dim"
          />
        </div>

        {onSkip && (
          <button
            type="button"
            onClick={onSkip}
            className="mb-4 w-full flex items-center justify-between gap-4 px-4 py-3 rounded-xl border border-dashed border-hairline-bold bg-ink-900/40 hover:border-mesa-neon/50 hover:bg-mesa-neon/5 transition-colors text-left"
            data-testid="button-skip-client"
          >
            <div className="flex items-center gap-3 min-w-0">
              <div className="size-9 rounded-lg bg-ink-800 flex items-center justify-center shrink-0">
                <UserX className="w-4 h-4 text-chalk-muted" />
              </div>
              <div className="min-w-0">
                <div className="font-medium text-chalk">Sem cliente específico</div>
                <div className="text-xs text-chalk-muted">
                  Criar cotação interna sem vincular a um cliente.
                </div>
              </div>
            </div>
            <MesaButton variant="ghost" size="sm" tabIndex={-1}>Selecionar</MesaButton>
          </button>
        )}

        {isLoading ? (
          <div className="flex items-center gap-2 text-sm text-chalk-muted">
            <Loader2 className="w-4 h-4 animate-spin" /> Carregando clientes...
          </div>
        ) : filtered.length === 0 ? (
          <div className="rounded-xl border border-dashed border-hairline p-8 text-center">
            <p className="text-sm text-chalk-muted mb-3">
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
                  "w-full flex items-center justify-between gap-4 px-4 py-3 rounded-xl border border-hairline bg-ink-900/40 hover:border-mesa-neon/40 hover:bg-mesa-neon/5 transition-colors text-left",
                )}
              >
                <div className="min-w-0">
                  <div className="font-medium text-chalk truncate">{c.company || c.name}</div>
                  {c.company && c.name && (
                    <div className="text-xs text-chalk-muted truncate">{c.name}</div>
                  )}
                </div>
                <MesaButton variant="ghost" size="sm" tabIndex={-1}>
                  Selecionar
                </MesaButton>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
