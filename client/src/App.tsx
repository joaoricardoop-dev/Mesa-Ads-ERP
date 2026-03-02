import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/NotFound";
import { Route, Switch } from "wouter";
import ErrorBoundary from "./components/ErrorBoundary";
import { ThemeProvider } from "./contexts/ThemeContext";
import DashboardLayout from "./components/DashboardLayout";
import { useAuth } from "./hooks/use-auth";
import Dashboard from "./pages/Dashboard";
import Home from "./pages/Home";
import Prospecting from "./pages/Restaurants";
import ProspectForm from "./pages/ProspectForm";
import ActiveRestaurantsPage from "./pages/ActiveRestaurants";
import ActiveRestaurantForm from "./pages/ActiveRestaurantForm";
import ActiveRestaurantProfile from "./pages/ActiveRestaurantProfile";
import Clients from "./pages/Clients";
import Campaigns from "./pages/Campaigns";
import CampaignDetail from "./pages/CampaignDetail";
import QuotationPreview from "./pages/QuotationPreview";
import Economics from "./pages/Economics";
import Production from "./pages/Production";
import Members from "./pages/Members";
// import LandingPage from "./pages/LandingPage";
import LoginPage from "./pages/LoginPage";
import PlaceholderPage from "./pages/PlaceholderPage";
import Library from "./pages/Library";
import Quotations from "./pages/Quotations";
import QuotationDetail from "./pages/QuotationDetail";
import Leads from "./pages/Leads";
import ServiceOrders from "./pages/ServiceOrders";
import BatchManagement from "./pages/BatchManagement";
import DevRoleSwitcher from "./components/DevRoleSwitcher";
import ForcePasswordChange from "./components/ForcePasswordChange";
import FinancialDashboard from "./pages/financial/FinancialDashboard";
import Invoicing from "./pages/financial/Invoicing";
import RestaurantPaymentsPage from "./pages/financial/RestaurantPaymentsPage";
import OperationalCosts from "./pages/financial/OperationalCosts";
import FinancialReport from "./pages/financial/FinancialReport";
import AnunciantePortal from "./pages/AnunciantePortal";

function AnuncianteRouter() {
  return (
    <Switch>
      <Route path="/" component={AnunciantePortal} />
      <Route path="/portal" component={AnunciantePortal} />
      <Route component={AnunciantePortal} />
    </Switch>
  );
}

function Router() {
  return (
    <Switch>
      <Route path="/" component={Dashboard} />
      <Route path="/portal" component={AnunciantePortal} />
      <Route path="/comercial/simulador" component={Home} />
      <Route path="/comercial/cotacoes/:id" component={QuotationDetail} />
      <Route path="/comercial/cotacoes" component={Quotations} />
      <Route path="/comercial/leads" component={Leads} />
      <Route path="/prospeccao/novo" component={ProspectForm} />
      <Route path="/prospeccao/:id" component={ProspectForm} />
      <Route path="/prospeccao" component={Prospecting} />
      <Route path="/restaurantes/perfil/:id" component={ActiveRestaurantProfile} />
      <Route path="/restaurantes/novo" component={ActiveRestaurantForm} />
      <Route path="/restaurantes/:id" component={ActiveRestaurantForm} />
      <Route path="/restaurantes" component={ActiveRestaurantsPage} />
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
      <Route path="/membros" component={Members} />
      <Route path="/configuracoes/usuarios" component={Members} />
      <Route path="/biblioteca" component={Library} />
      <Route path="/404" component={NotFound} />
      <Route component={NotFound} />
    </Switch>
  );
}

function AuthenticatedApp() {
  const { user, isLoading, isAuthenticated } = useAuth();

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

  if (!isAuthenticated) {
    return <LoginPage />;
  }

  const isAnunciante = user?.role === "anunciante";

  if (isAnunciante) {
    return (
      <div className="h-screen flex overflow-hidden">
        <DashboardLayout user={user}>
          <AnuncianteRouter />
        </DashboardLayout>
        <ForcePasswordChange />
      </div>
    );
  }

  return (
    <div className="h-screen flex overflow-hidden">
      <DashboardLayout user={user}>
        <Router />
      </DashboardLayout>
      <DevRoleSwitcher currentRole={user?.role || undefined} />
      <ForcePasswordChange />
    </div>
  );
}

function App() {
  return (
    <ErrorBoundary>
      <ThemeProvider defaultTheme="dark" switchable>
        <TooltipProvider>
          <Toaster />
          <AuthenticatedApp />
        </TooltipProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
}

export default App;
