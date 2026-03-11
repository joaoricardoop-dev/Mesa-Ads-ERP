import { useState, useEffect } from "react";
import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/NotFound";
import { Route, Switch } from "wouter";
import ErrorBoundary from "./components/ErrorBoundary";
import { ThemeProvider } from "./contexts/ThemeContext";
import DashboardLayout from "./components/DashboardLayout";
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
import QuotationPreview from "./pages/QuotationPreview";
import Economics from "./pages/Economics";
import Production from "./pages/Production";
import Members from "./pages/Members";
import PlaceholderPage from "./pages/PlaceholderPage";
import Library from "./pages/Library";
import Quotations from "./pages/Quotations";
import QuotationDetail from "./pages/QuotationDetail";
import Leads from "./pages/Leads";
import ServiceOrders from "./pages/ServiceOrders";
import BatchManagement from "./pages/BatchManagement";
import FinancialDashboard from "./pages/financial/FinancialDashboard";
import Invoicing from "./pages/financial/Invoicing";
import RestaurantPaymentsPage from "./pages/financial/RestaurantPaymentsPage";
import OperationalCosts from "./pages/financial/OperationalCosts";
import FinancialReport from "./pages/financial/FinancialReport";
import PriceTable from "./pages/PriceTable";
import AnunciantePortal from "./pages/AnunciantePortal";
import RestaurantePortal from "./pages/RestaurantePortal";
import RestaurantOnboarding from "./pages/RestaurantOnboarding";
import RestaurantInviteAccept from "./pages/RestaurantInviteAccept";
import Onboarding from "./pages/Onboarding";
import TermTemplates from "./pages/TermTemplates";
import QuotationSign from "./pages/QuotationSign";

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

function Router() {
  return (
    <Switch>
      <Route path="/" component={Dashboard} />
      <Route path="/portal" component={AnunciantePortal} />
      <Route path="/comercial/simulador" component={Home} />
      <Route path="/comercial/tabela-precos" component={PriceTable} />
      <Route path="/comercial/cotacoes/:id" component={QuotationDetail} />
      <Route path="/comercial/cotacoes" component={Quotations} />
      <Route path="/comercial/leads" component={Leads} />
      <Route path="/restaurantes/perfil/:id" component={ActiveRestaurantProfile} />
      <Route path="/restaurantes/novo" component={ActiveRestaurantForm} />
      <Route path="/restaurantes/:id" component={ActiveRestaurantForm} />
      <Route path="/restaurantes" component={ActiveRestaurantsPage} />
      <Route path="/clientes/:id" component={ClientDetail} />
      <Route path="/clientes" component={Clients} />
      <Route path="/cotacao/preview" component={QuotationPreview} />
      <Route path="/financeiro" component={FinancialDashboard} />
      <Route path="/financeiro/faturamento" component={Invoicing} />
      <Route path="/financeiro/pagamentos" component={RestaurantPaymentsPage} />
      <Route path="/financeiro/custos" component={OperationalCosts} />
      <Route path="/financeiro/relatorios" component={FinancialReport} />
      <Route path="/campanhas/:id" component={CampaignDetail} />
      <Route path="/campanhas" component={Campaigns} />
      <Route path="/ordens-servico" component={ServiceOrders} />
      <Route path="/economics" component={Economics} />
      <Route path="/producao" component={Production} />
      <Route path="/configuracoes/batches" component={BatchManagement} />
      <Route path="/configuracoes/termos" component={TermTemplates} />
      <Route path="/membros" component={Members} />
      <Route path="/configuracoes/usuarios" component={Members} />
      <Route path="/biblioteca" component={Library} />
      <Route path="/404" component={NotFound} />
      <Route component={NotFound} />
    </Switch>
  );
}

const clerkAppearance = {
  elements: {
    rootBox: "mx-auto",
    card: "bg-[hsl(0,0%,7%)] border border-[hsl(0,0%,14%)] shadow-2xl",
    headerTitle: "text-[hsl(0,0%,95%)]",
    headerSubtitle: "text-[hsl(0,0%,50%)]",
    formFieldLabel: "text-[hsl(0,0%,50%)]",
    formFieldInput: "bg-[hsl(0,0%,11%)] border-[hsl(0,0%,18%)] text-[hsl(0,0%,95%)]",
    formButtonPrimary: "bg-[#27d803] hover:bg-[#22c003] text-black",
    footer: "hidden",
    footerAction: "hidden",
    footerActionLink: "hidden",
    socialButtonsBlockButton: "border-[hsl(0,0%,18%)] text-[hsl(0,0%,70%)]",
    dividerLine: "bg-[hsl(0,0%,14%)]",
    dividerText: "text-[hsl(0,0%,40%)]",
    identityPreview: "bg-[hsl(0,0%,11%)]",
    identityPreviewText: "text-[hsl(0,0%,95%)]",
    identityPreviewEditButton: "text-[#27d803]",
  },
};

function ClerkLoginPage() {
  const [mode, setMode] = useState<"signin" | "signup">("signin");

  return (
    <div className="h-screen w-full flex items-center justify-center" style={{ background: "hsl(0 0% 4%)" }}>
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div
          className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] rounded-full opacity-[0.07]"
          style={{ background: "radial-gradient(circle, #27d803 0%, transparent 70%)" }}
        />
      </div>
      <div className="relative flex flex-col items-center">
        <img src="/logo-white.png" alt="mesa.ads" className="h-10 mb-8" />
        {mode === "signin" ? (
          <SignIn appearance={clerkAppearance} signUpUrl="#" />
        ) : (
          <SignUp appearance={clerkAppearance} signInUrl="#" />
        )}
        <button
          onClick={() => setMode(mode === "signin" ? "signup" : "signin")}
          className="mt-4 text-sm"
          style={{ color: "hsl(0 0% 50%)" }}
        >
          {mode === "signin" ? (
            <>Não tem uma conta? <span className="text-[#27d803] hover:underline cursor-pointer">Criar conta</span></>
          ) : (
            <>Já tem uma conta? <span className="text-[#27d803] hover:underline cursor-pointer">Entrar</span></>
          )}
        </button>
        <a
          href="/parceiro"
          className="mt-4 text-sm block"
          style={{ color: "hsl(0 0% 50%)" }}
        >
          É um restaurante parceiro? <span className="text-[#27d803] hover:underline cursor-pointer">Cadastre-se aqui</span>
        </a>
        <p className="text-center mt-4 text-[11px]" style={{ color: "hsl(0 0% 30%)" }}>
          mesa.ads &copy; {new Date().getFullYear()} &mdash; Plataforma de gestão
        </p>
      </div>
    </div>
  );
}

export type Impersonation = {
  role: string;
  clientId?: number;
  restaurantId?: number;
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
          <div className="bg-[hsl(0,0%,7%)] border border-[hsl(0,0%,14%)] rounded-2xl p-8 shadow-2xl w-full">
            <div className="w-16 h-16 rounded-full bg-red-500/10 flex items-center justify-center mx-auto mb-5">
              <ShieldX className="w-8 h-8 text-red-400" />
            </div>
            <h2 className="text-xl font-bold text-[hsl(0,0%,95%)] mb-2">
              Acesso não autorizado
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
    };
  }

  const isImpersonating = impersonation !== null && user && INTERNAL_ROLES.includes(user.role || "");
  const isAnunciante = effectiveUser?.role === "anunciante";
  const isRestaurante = effectiveUser?.role === "restaurante";
  const needsOnboarding = isAnunciante && effectiveUser?.onboardingComplete === false && !isImpersonating;

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

  if (isAnunciante) {
    return (
      <div className="h-screen flex overflow-hidden">
        <DashboardLayout user={effectiveUser} impersonation={impersonation} onExitImpersonation={() => setImpersonation(null)}>
          <AnuncianteRouter />
        </DashboardLayout>
        {devToolsPanel}
      </div>
    );
  }

  if (isRestaurante) {
    return (
      <div className="h-screen flex overflow-hidden">
        <DashboardLayout user={effectiveUser} impersonation={impersonation} onExitImpersonation={() => setImpersonation(null)}>
          <RestauranteRouter />
        </DashboardLayout>
        {devToolsPanel}
      </div>
    );
  }

  return (
    <div className="h-screen flex overflow-hidden">
      <DashboardLayout user={effectiveUser} impersonation={impersonation} onExitImpersonation={() => setImpersonation(null)} onImpersonate={setImpersonation}>
        <Router />
      </DashboardLayout>
      {devToolsPanel}
    </div>
  );
}

function App() {
  return (
    <ErrorBoundary>
      <ThemeProvider defaultTheme="dark" switchable>
        <TooltipProvider>
          <Toaster />
          <Switch>
            <Route path="/parceiro/convite/:token" component={RestaurantInviteAccept} />
            <Route path="/parceiro" component={RestaurantOnboarding} />
            <Route path="/cotacao/assinar/:token" component={QuotationSign} />
            <Route>{() => <AuthenticatedApp />}</Route>
          </Switch>
        </TooltipProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
}

export default App;
