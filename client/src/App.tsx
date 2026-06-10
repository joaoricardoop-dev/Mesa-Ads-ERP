import { useState, useEffect } from "react";
import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/NotFound";
import { Route, Switch, Redirect } from "wouter";
import ErrorBoundary from "./components/ErrorBoundary";
import { ThemeProvider } from "./contexts/ThemeContext";
import DashboardLayout from "./components/DashboardLayout";
import { ParceiroLayout } from "./components/ParceiroLayout";
import { ExternalShell } from "./components/ExternalShell";
import DevToolsPanel from "./components/DevToolsPanel";
import { useAuth } from "./hooks/use-auth";
import { SignIn, SignUp, useClerk } from "@clerk/clerk-react";
import { ShieldX } from "lucide-react";
import Dashboard from "./pages/Dashboard";
import Home from "./pages/Home";
import ActiveRestaurantsPage from "./pages/ActiveRestaurants";
import ActiveRestaurantForm from "./pages/ActiveRestaurantForm";
import ActiveRestaurantProfile from "./pages/ActiveRestaurantProfile";
import Clients from "./pages/Clients";
import ClientDetail from "./pages/ClientDetail";
import Campaigns from "./pages/Campaigns";
import CampaignDetail from "./pages/CampaignDetail";
import CampaignOverview from "./pages/CampaignOverview";
import QuotationPreview from "./pages/QuotationPreview";
import Economics from "./pages/Economics";
import Production from "./pages/Production";
import OperationsCalendar from "./pages/OperationsCalendar";
import Members from "./pages/Members";
import PlaceholderPage from "./pages/PlaceholderPage";
import Library from "./pages/Library";
import Quotations from "./pages/Quotations";
import QuotationDetail from "./pages/QuotationDetail";
import Leads from "./pages/Leads";
import Contacts from "./pages/Contacts";
import ServiceOrders from "./pages/ServiceOrders";
import BatchManagement from "./pages/BatchManagement";
import FinancialDashboard from "./pages/financial/FinancialDashboard";
import Invoicing from "./pages/financial/Invoicing";
import VipProvidersPage from "./pages/financial/VipProvidersPage";
import OperationalCosts from "./pages/financial/OperationalCosts";
import FinancialReport from "./pages/financial/FinancialReport";
import PartnerCommissionReport from "./pages/financial/PartnerCommissionReport";
import AccountsPayablePage from "./pages/financial/AccountsPayablePage";
import FinancialGlossary from "./pages/financial/FinancialGlossary";
import FinancialAuditLog from "./pages/financial/FinancialAuditLog";
import BankReconciliation from "./pages/financial/BankReconciliation";
import PriceTable from "./pages/PriceTable";
import AnunciantePortal from "./pages/AnunciantePortal";
import RestaurantePortal from "./pages/RestaurantePortal";
import RestaurantOnboarding from "./pages/RestaurantOnboarding";
import RestaurantInviteAccept from "./pages/RestaurantInviteAccept";
import Onboarding from "./pages/Onboarding";
import MontarCampanha from "./pages/MontarCampanha";
import { captureTrackingFromUrl } from "./lib/utmTracking";
import TermTemplates from "./pages/TermTemplates";
import IntegrationSettings from "./pages/IntegrationSettings";
import MediaKitSettings from "./pages/MediaKitSettings";
import QuotationSign from "./pages/QuotationSign";
import Products from "./pages/Products";
import SeasonalMultipliers from "./pages/SeasonalMultipliers";
import ConfigLists from "./pages/ConfigLists";
import Partners from "./pages/Partners";
import PartnerDetail from "./pages/PartnerDetail";
import RestaurantsMap from "./pages/RestaurantsMap";
import ParceiroPortal from "./pages/ParceiroPortal";
import ParceiroOnboarding from "./pages/ParceiroOnboarding";
import ParceiroTabelaPrecos from "./pages/ParceiroTabelaPrecos";
import ParceiroLeads from "./pages/ParceiroLeads";
import BudgetCreator from "./pages/BudgetCreator";
import ComercialDashboard from "./pages/ComercialDashboard";

function AnuncianteRouter() {
  return (
    <Switch>
      <Route path="/" component={AnunciantePortal} />
      <Route path="/portal" component={AnunciantePortal} />
      <Route component={AnunciantePortal} />
    </Switch>
  );
}

function RestauranteRouter() {
  return (
    <Switch>
      <Route path="/" component={RestaurantePortal} />
      <Route path="/portal" component={RestaurantePortal} />
      <Route component={RestaurantePortal} />
    </Switch>
  );
}

function ParceiroRouter() {
  return (
    <Switch>
      <Route path="/" component={ParceiroPortal} />
      <Route path="/portal" component={ParceiroPortal} />
      <Route path="/tabela-precos" component={ParceiroTabelaPrecos} />
      <Route path="/leads" component={ParceiroLeads} />
      <Route component={ParceiroPortal} />
    </Switch>
  );
}

function Router() {
  return (
    <Switch>
      <Route path="/" component={Dashboard} />
      <Route path="/portal" component={AnunciantePortal} />
      <Route path="/comercial/dashboard" component={ComercialDashboard} />
      <Route path="/comercial/simulador" component={Home} />
      <Route path="/comercial/tabela-precos" component={PriceTable} />
      <Route path="/comercial/orcamento" component={BudgetCreator} />
      <Route path="/comercial/cotacoes/:id" component={QuotationDetail} />
      <Route path="/comercial/cotacoes" component={Quotations} />
      <Route path="/comercial/leads" component={Leads} />
      <Route path="/comercial/contatos" component={Contacts} />
      <Route path="/comercial/parceiros/:id" component={PartnerDetail} />
      <Route path="/comercial/parceiros" component={Partners} />
      <Route path="/restaurantes/mapa" component={RestaurantsMap} />
      <Route path="/restaurantes/perfil/:id" component={ActiveRestaurantProfile} />
      <Route path="/restaurantes/novo" component={ActiveRestaurantForm} />
      <Route path="/restaurantes/:id" component={ActiveRestaurantForm} />
      <Route path="/restaurantes" component={ActiveRestaurantsPage} />
      <Route path="/clientes/:id" component={ClientDetail} />
      <Route path="/clientes" component={Clients} />
      <Route path="/cotacao/preview" component={QuotationPreview} />
      <Route path="/financeiro" component={FinancialDashboard} />
      <Route path="/financeiro/faturamento" component={Invoicing} />
      <Route path="/financeiro/contas-pagar" component={AccountsPayablePage} />
      <Route path="/financeiro/relatorios" component={FinancialReport} />
      <Route path="/financeiro/conciliacao" component={BankReconciliation} />
      <Route path="/financeiro/glossario" component={FinancialGlossary} />
      <Route path="/financeiro/comissao-parceiros" component={PartnerCommissionReport} />
      <Route path="/financeiro/auditoria" component={FinancialAuditLog} />
      <Route path="/configuracoes/provedores-sala-vip" component={VipProvidersPage} />
      {/* Redirects (rotas antigas → novas) */}
      <Route path="/financeiro/pagamentos">{() => <Redirect to="/financeiro/contas-pagar?tab=restaurant_commission" />}</Route>
      <Route path="/financeiro/custos">{() => <Redirect to="/financeiro/contas-pagar?tab=supplier_cost" />}</Route>
      <Route path="/financeiro/fornecedores">{() => <Redirect to="/producao?tab=suppliers" />}</Route>
      <Route path="/financeiro/provedores-vip">{() => <Redirect to="/configuracoes/provedores-sala-vip" />}</Route>
      <Route path="/campanhas/:id/batch/:phaseId" component={CampaignDetail} />
      {/* Rota antiga mantida como alias pra não quebrar links existentes */}
      <Route path="/campanhas/:id/fase/:phaseId" component={CampaignDetail} />
      <Route path="/campanhas/:id" component={CampaignOverview} />
      <Route path="/campanhas" component={Campaigns} />
      <Route path="/ordens-servico" component={ServiceOrders} />
      <Route path="/economics" component={Economics} />
      <Route path="/producao" component={Production} />
      <Route path="/operacoes/calendario" component={OperationsCalendar} />
      <Route path="/configuracoes/batches" component={BatchManagement} />
      <Route path="/configuracoes/termos" component={TermTemplates} />
      <Route path="/membros" component={Members} />
      <Route path="/configuracoes/usuarios" component={Members} />
      <Route path="/configuracoes/integracoes" component={IntegrationSettings} />
      <Route path="/configuracoes/media-kit" component={MediaKitSettings} />
      <Route path="/produtos" component={Products} />
      <Route path="/configuracoes/multiplicadores-sazonais" component={SeasonalMultipliers} />
      <Route path="/configuracoes/listas" component={ConfigLists} />
      <Route path="/biblioteca" component={Library} />
      <Route path="/404" component={NotFound} />
      <Route component={NotFound} />
    </Switch>
  );
}

const clerkAppearance = {
  variables: {
    fontFamily:
      '"DM Sans", "DM Sans Variable", ui-sans-serif, system-ui, sans-serif',
    colorPrimary: "#00e640",
    colorBackground: "#17171b",
    colorText: "#f5f5f3",
    colorTextSecondary: "#c2c2c6",
    colorInputBackground: "#0b0b0d",
    colorInputText: "#f5f5f3",
    colorDanger: "#ff2e8a",
    borderRadius: "0.75rem",
  },
  elements: {
    rootBox: "mx-auto",
    logoBox: "hidden",
    card: "bg-[#17171b] border border-white/15 shadow-2xl rounded-2xl",
    headerTitle:
      "text-[#f5f5f3] font-display tracking-tight text-2xl font-semibold",
    headerSubtitle: "text-[#c2c2c6] text-sm",
    formFieldLabel:
      "text-[#c2c2c6] label-mono text-[10px] tracking-[0.18em]",
    formFieldInput:
      "bg-[#0b0b0d] border-white/15 text-[#f5f5f3] placeholder:text-[#8a8a8f] rounded-lg focus:border-[#00e640]/70 focus:ring-1 focus:ring-[#00e640]/40",
    formButtonPrimary:
      "bg-[#00e640] hover:bg-[#00c238] text-[#040405] font-semibold tracking-tight rounded-lg shadow-[0_0_0_1px_rgba(0,230,64,0.4)] transition-all",
    footer: "hidden",
    footerAction: "hidden",
    footerActionLink: "hidden",
    socialButtonsIconButton: {
      backgroundColor: "#ffffff",
      borderColor: "rgba(0,0,0,0.1)",
      color: "#1a1a17",
      borderRadius: "0.5rem",
    },
    dividerLine: "bg-white/15",
    dividerText: "text-[#c2c2c6] label-mono text-[10px]",
    identityPreview: "bg-[#0b0b0d] border-white/15 rounded-lg",
    identityPreviewText: "text-[#f5f5f3]",
    identityPreviewEditButton: "text-[#00e640] hover:text-[#00c238]",
    formFieldInputShowPasswordButton: "text-[#c2c2c6] hover:text-[#f5f5f3]",
    otpCodeFieldInput:
      "bg-[#0b0b0d] border-white/15 text-[#f5f5f3] rounded-lg focus:border-[#00e640]/70",
  },
};

function DevLoginButton() {
  const { devLogin } = useAuth();
  const [loading, setLoading] = useState(false);
  const [showPicker, setShowPicker] = useState(false);
  const [users, setUsers] = useState<any[]>([]);

  const handleQuickLogin = async () => {
    setLoading(true);
    try {
      await devLogin();
    } catch {
      console.error("Dev login failed");
    } finally {
      setLoading(false);
    }
  };

  const handleShowPicker = async () => {
    setShowPicker(true);
    try {
      const res = await fetch("/api/dev-users", { credentials: "include" });
      const data = await res.json();
      setUsers(data);
    } catch {
      console.error("Failed to load dev users");
    }
  };

  const handlePickUser = async (userId: string) => {
    setLoading(true);
    try {
      await devLogin(userId);
    } catch {
      console.error("Dev login failed");
    } finally {
      setLoading(false);
      setShowPicker(false);
    }
  };

  const roleColors: Record<string, string> = {
    admin: "text-red-400",
    comercial: "text-blue-400",
    operacoes: "text-amber-400",
    financeiro: "text-emerald-400",
    anunciante: "text-purple-400",
    restaurante: "text-cyan-400",
  };

  return (
    <div className="fixed bottom-4 right-4 z-50 flex flex-col items-end gap-2">
      {showPicker && (
        <div className="bg-[hsl(0,0%,7%)] border border-[hsl(0,0%,18%)] rounded-lg shadow-2xl p-3 w-72 max-h-80 overflow-y-auto">
          <p className="text-[10px] uppercase tracking-wider text-[hsl(0,0%,40%)] font-semibold mb-2">Selecionar usuário</p>
          {users.length === 0 ? (
            <p className="text-xs text-[hsl(0,0%,40%)]">Carregando...</p>
          ) : (
            <div className="space-y-1">
              {users.map((u: any) => (
                <button
                  key={u.id}
                  onClick={() => handlePickUser(u.id)}
                  disabled={loading}
                  className="w-full text-left px-2.5 py-1.5 rounded-md hover:bg-[hsl(0,0%,14%)] transition-colors flex items-center gap-2 disabled:opacity-50"
                >
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-medium text-[hsl(0,0%,85%)] truncate">
                      {u.firstName} {u.lastName}
                    </p>
                    <p className="text-[10px] text-[hsl(0,0%,45%)] truncate">{u.email}</p>
                  </div>
                  <span className={`text-[10px] font-mono shrink-0 ${roleColors[u.role] || "text-[hsl(0,0%,50%)]"}`}>
                    {u.role}
                  </span>
                </button>
              ))}
            </div>
          )}
          <button
            onClick={() => setShowPicker(false)}
            className="mt-2 w-full text-[10px] text-[hsl(0,0%,40%)] hover:text-[hsl(0,0%,60%)] transition-colors"
          >
            Fechar
          </button>
        </div>
      )}
      <div className="flex gap-1.5">
        <button
          onClick={handleShowPicker}
          disabled={loading}
          className="px-3 py-2 bg-[hsl(0,0%,10%)] hover:bg-[hsl(0,0%,15%)] border border-[hsl(0,0%,20%)] text-[hsl(0,0%,60%)] rounded-lg text-xs font-medium transition-colors disabled:opacity-50"
        >
          Escolher
        </button>
        <button
          onClick={handleQuickLogin}
          disabled={loading}
          className="px-4 py-2 bg-amber-600 hover:bg-amber-500 text-black rounded-lg text-xs font-bold transition-colors disabled:opacity-50 shadow-lg"
        >
          {loading ? "Entrando..." : "Dev Login (Admin)"}
        </button>
      </div>
    </div>
  );
}

function ClerkLoginPage() {
  const [mode, setMode] = useState<"signin" | "signup">(() => {
    if (typeof window === "undefined") return "signin";
    const params = new URLSearchParams(window.location.search);
    return params.get("mode") === "signup" ? "signup" : "signin";
  });
  const redirectTo = (() => {
    if (typeof window === "undefined") return undefined;
    const r = new URLSearchParams(window.location.search).get("redirect");
    return r && r.startsWith("/") ? r : undefined;
  })();

  return (
    <div className="min-h-screen w-full flex items-center justify-center bg-[#040405] text-[#f5f5f3] relative overflow-hidden px-6 py-10">
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div
          className="absolute top-[20%] left-1/2 -translate-x-1/2 w-[720px] h-[720px] rounded-full opacity-[0.10] blur-[2px]"
          style={{ background: "radial-gradient(circle, #00e640 0%, transparent 65%)" }}
        />
        <div
          className="absolute bottom-[-200px] right-[-160px] w-[480px] h-[480px] rounded-full opacity-[0.08]"
          style={{ background: "radial-gradient(circle, #ff2e8a 0%, transparent 70%)" }}
        />
        <div
          className="absolute inset-0 opacity-[0.025] mix-blend-overlay"
          style={{
            backgroundImage:
              "url(\"data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='160' height='160'><filter id='n'><feTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='2' stitchTiles='stitch'/></filter><rect width='100%' height='100%' filter='url(%23n)' opacity='0.6'/></svg>\")",
          }}
        />
      </div>

      <div className="relative flex flex-col items-center w-full max-w-md">
        <img src="/logo-white.png" alt="mesa.ads" className="h-9 mb-8 opacity-95" />

        <div className="text-center mb-8 space-y-3">
          <p className="label-mono text-[10px] text-[#00e640]/90">
            Plataforma Mesa.ads
          </p>
          <h1 className="font-display text-4xl sm:text-5xl font-semibold leading-[0.95] tracking-[-0.03em] text-[#f5f5f3]">
            {mode === "signin" ? (
              <>
                Bem-vindo de{" "}
                <span className="font-serif-italic-accent text-[#00e640]">
                  volta
                </span>
              </>
            ) : (
              <>
                Crie sua{" "}
                <span className="font-serif-italic-accent text-[#00e640]">
                  conta
                </span>
              </>
            )}
          </h1>
          <p className="text-sm text-[#a6a6aa]">
            {mode === "signin"
              ? "Acesse sua área para gerenciar campanhas, parceiros e finanças."
              : "Comece a anunciar em bolachas pelo Brasil em minutos."}
          </p>
        </div>

        {mode === "signin" ? (
          <SignIn
            appearance={clerkAppearance}
            signUpUrl="#"
            forceRedirectUrl={redirectTo}
            fallbackRedirectUrl={redirectTo}
          />
        ) : (
          <SignUp
            appearance={clerkAppearance}
            signInUrl="#"
            forceRedirectUrl={redirectTo}
            fallbackRedirectUrl={redirectTo}
          />
        )}

        <button
          onClick={() => setMode(mode === "signin" ? "signup" : "signin")}
          className="mt-6 text-sm text-[#a6a6aa] hover:text-[#f5f5f3] transition-colors"
        >
          {mode === "signin" ? (
            <>Não tem uma conta? <span className="text-[#00e640] hover:underline cursor-pointer font-medium">Criar conta</span></>
          ) : (
            <>Já tem uma conta? <span className="text-[#00e640] hover:underline cursor-pointer font-medium">Entrar</span></>
          )}
        </button>

        <a
          href="/locais"
          className="mt-3 text-sm block text-[#a6a6aa] hover:text-[#f5f5f3] transition-colors text-center"
        >
          É um local parceiro? <span className="text-[#00e640] hover:underline cursor-pointer font-medium">Cadastre-se aqui</span>
        </a>

        <p className="text-center mt-8 label-mono text-[10px] text-[#a6a6aa]/60">
          mesa.ads · {new Date().getFullYear()} · Plataforma de gestão
        </p>
      </div>

      {import.meta.env.DEV && <DevLoginButton />}
    </div>
  );
}

export type Impersonation = {
  role: string;
  clientId?: number;
  restaurantId?: number;
  partnerId?: number;
  name: string;
} | null;

function AuthenticatedApp() {
  const { user, isLoading, isAuthenticated, isAuthError, isNotRegistered, logout, clerkUser } = useAuth();
  const [devRoleOverride, setDevRoleOverride] = useState<string | null>(null);
  const [devClientIdOverride, setDevClientIdOverride] = useState<number | null>(null);
  const [impersonation, setImpersonation] = useState<Impersonation>(null);

  useEffect(() => {
    (window as any).__DEV_OVERRIDE_CLIENT_ID__ = devRoleOverride === "anunciante" ? devClientIdOverride : null;
  }, [devClientIdOverride, devRoleOverride]);

  useEffect(() => {
    (window as any).__IMPERSONATION__ = impersonation;
  }, [impersonation]);

  useEffect(() => {
    const handler = (e: Event) => {
      const detail = (e as CustomEvent).detail;
      setImpersonation(detail);
    };
    window.addEventListener("impersonation-change", handler);
    return () => window.removeEventListener("impersonation-change", handler);
  }, []);

  if (isLoading) {
    return (
      <div className="h-screen flex items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
          <p className="text-sm text-muted-foreground">Carregando...</p>
        </div>
      </div>
    );
  }

  if (isNotRegistered) {
    return (
      <div className="h-screen w-full flex items-center justify-center" style={{ background: "hsl(0 0% 4%)" }}>
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <div
            className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] rounded-full opacity-[0.05]"
            style={{ background: "radial-gradient(circle, #ef4444 0%, transparent 70%)" }}
          />
        </div>
        <div className="relative flex flex-col items-center max-w-md px-6 text-center">
          <img src="/logo-white.png" alt="mesa.ads" className="h-10 mb-8" />
          <div className="bg-[#0a0a0c] border border-white/8 rounded-2xl p-8 shadow-2xl w-full">
            <div className="w-16 h-16 rounded-full bg-[#ff2e8a]/10 ring-1 ring-[#ff2e8a]/30 flex items-center justify-center mx-auto mb-5">
              <ShieldX className="w-8 h-8 text-[#ff2e8a]" />
            </div>
            <h2 className="font-display text-2xl tracking-tight text-[#f5f5f3] mb-2">
              Acesso <span className="font-serif-italic-accent text-[#ff2e8a]">não</span> autorizado
            </h2>
            <p className="text-sm text-[hsl(0,0%,50%)] mb-2 leading-relaxed">
              {clerkUser?.primaryEmailAddress?.emailAddress ? (
                <>Sua conta <span className="text-[hsl(0,0%,70%)] font-medium">{clerkUser.primaryEmailAddress.emailAddress}</span> não está cadastrada na plataforma mesa.ads.</>
              ) : (
                <>Sua conta não está cadastrada na plataforma mesa.ads.</>
              )}
            </p>
            <p className="text-sm text-[hsl(0,0%,50%)] mb-6 leading-relaxed">
              Entre em contato com o administrador do sistema para solicitar acesso.
            </p>
            <button
              onClick={() => logout()}
              className="w-full px-4 py-2.5 bg-[hsl(0,0%,14%)] hover:bg-[hsl(0,0%,18%)] text-[hsl(0,0%,70%)] rounded-lg text-sm font-medium transition-colors"
            >
              Sair e usar outra conta
            </button>
          </div>
          <p className="mt-6 text-[11px]" style={{ color: "hsl(0 0% 30%)" }}>
            mesa.ads &copy; {new Date().getFullYear()} &mdash; Plataforma de gestão
          </p>
        </div>
      </div>
    );
  }

  if (isAuthError) {
    return (
      <div className="h-screen flex items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-4 text-center max-w-md px-4">
          <p className="text-lg font-semibold text-foreground">Erro ao carregar perfil</p>
          <p className="text-sm text-muted-foreground">
            Não foi possível carregar seus dados. Tente sair e entrar novamente.
          </p>
          <button
            onClick={() => logout()}
            className="px-4 py-2 bg-primary text-primary-foreground rounded-md text-sm hover:bg-primary/90"
          >
            Sair e tentar novamente
          </button>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return <ClerkLoginPage />;
  }

  const INTERNAL_ROLES = ["admin", "comercial", "operacoes", "financeiro", "manager"];

  let effectiveUser = devRoleOverride && user
    ? { ...user, role: devRoleOverride, ...(devRoleOverride === "anunciante" && devClientIdOverride ? { clientId: devClientIdOverride } : {}) }
    : user;

  if (impersonation && user && INTERNAL_ROLES.includes(user.role || "")) {
    effectiveUser = {
      ...user,
      role: impersonation.role,
      ...(impersonation.clientId ? { clientId: impersonation.clientId } : {}),
      ...(impersonation.restaurantId ? { restaurantId: impersonation.restaurantId } : {}),
      ...(impersonation.partnerId ? { partnerId: impersonation.partnerId } : {}),
    };
  }

  const isImpersonating = impersonation !== null && user && INTERNAL_ROLES.includes(user.role || "");
  const isAnunciante = effectiveUser?.role === "anunciante";
  const isRestaurante = effectiveUser?.role === "restaurante";
  const isParceiro = effectiveUser?.role === "parceiro";
  const needsOnboarding = isAnunciante && effectiveUser?.onboardingComplete === false && !isImpersonating;
  const needsParceiroOnboarding = isParceiro && effectiveUser?.onboardingComplete === false && !isImpersonating;

  const devToolsPanel = (
    <DevToolsPanel
      currentRole={user?.role || ""}
      overrideRole={devRoleOverride}
      overrideClientId={devClientIdOverride}
      onSetOverride={setDevRoleOverride}
      onSetClientId={setDevClientIdOverride}
    />
  );

  if (needsOnboarding) {
    return (
      <>
        <Onboarding userName={effectiveUser?.firstName || null} />
        {devToolsPanel}
      </>
    );
  }

  if (needsParceiroOnboarding) {
    return (
      <>
        <ParceiroOnboarding
          userName={effectiveUser?.firstName || null}
          userLastName={effectiveUser?.lastName || null}
          userEmail={effectiveUser?.email || null}
          partnerName={null}
        />
        {devToolsPanel}
      </>
    );
  }

  if (isAnunciante) {
    return (
      <ExternalShell
        className="h-screen flex overflow-hidden min-h-0"
        innerClassName="flex flex-1 min-h-0 w-full"
      >
        <DashboardLayout user={effectiveUser} impersonation={impersonation} onExitImpersonation={() => setImpersonation(null)}>
          <AnuncianteRouter key={devClientIdOverride ?? "no-client"} />
        </DashboardLayout>
        {devToolsPanel}
      </ExternalShell>
    );
  }

  if (isRestaurante) {
    return (
      <div className="h-screen flex overflow-hidden min-h-0">
        <DashboardLayout user={effectiveUser} impersonation={impersonation} onExitImpersonation={() => setImpersonation(null)}>
          <RestauranteRouter />
        </DashboardLayout>
        {devToolsPanel}
      </div>
    );
  }

  if (isParceiro) {
    return (
      <ExternalShell
        className="h-screen flex overflow-hidden min-h-0"
        innerClassName="flex flex-1 min-h-0 w-full"
      >
        <ParceiroLayout
          user={effectiveUser}
          impersonation={impersonation}
          onExitImpersonation={() => setImpersonation(null)}
        >
          <ParceiroRouter />
        </ParceiroLayout>
        {devToolsPanel}
      </ExternalShell>
    );
  }

  return (
    <div className="h-screen flex overflow-hidden min-h-0">
      <DashboardLayout user={effectiveUser} impersonation={impersonation} onExitImpersonation={() => setImpersonation(null)} onImpersonate={setImpersonation}>
        <Router />
      </DashboardLayout>
      {devToolsPanel}
    </div>
  );
}

function PublicRestaurantOnboarding() {
  const { isAuthenticated, isLoading } = useAuth();

  if (isLoading) {
    return null;
  }

  if (isAuthenticated) {
    return <Redirect to="/" />;
  }

  return <RestaurantOnboarding />;
}

function App() {
  useEffect(() => {
    captureTrackingFromUrl();
  }, []);

  return (
    <ErrorBoundary>
      <ThemeProvider defaultTheme="light" switchable>
        <TooltipProvider>
          <Toaster />
          <Switch>
            <Route path="/locais/convite/:token" component={RestaurantInviteAccept} />
            <Route path="/locais" component={PublicRestaurantOnboarding} />
            <Route path="/parceiro/convite/:token">{(params) => <Redirect to={`/locais/convite/${params.token}`} />}</Route>
            <Route path="/parceiro">{() => <Redirect to={`/${window.location.search}`} />}</Route>
            <Route path="/montar-campanha">
              {() => (
                <ExternalShell>
                  <MontarCampanha />
                </ExternalShell>
              )}
            </Route>
            <Route path="/comercial/montar-campanha">
              {() => (
                <ExternalShell>
                  <MontarCampanha />
                </ExternalShell>
              )}
            </Route>
            <Route path="/cotacao/assinar/:token" component={QuotationSign} />
            <Route>{() => <AuthenticatedApp />}</Route>
          </Switch>
        </TooltipProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
}

export default App;
