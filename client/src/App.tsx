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
import LandingPage from "./pages/LandingPage";
import PlaceholderPage from "./pages/PlaceholderPage";

function Router() {
  return (
    <Switch>
      <Route path="/" component={Dashboard} />
      <Route path="/comercial/simulador" component={Home} />
      <Route path="/comercial/cotacoes">
        <PlaceholderPage title="Cotações" description="Gestão de cotações comerciais" />
      </Route>
      <Route path="/comercial/leads">
        <PlaceholderPage title="Leads" description="CRM e pipeline de vendas" />
      </Route>
      <Route path="/comercial/os">
        <PlaceholderPage title="OS para Anunciantes" description="Ordens de serviço para anunciantes" />
      </Route>
      <Route path="/comercial/termos">
        <PlaceholderPage title="Termos para Restaurantes" description="Termos de parceria e adesão" />
      </Route>
      <Route path="/prospeccao/novo" component={ProspectForm} />
      <Route path="/prospeccao/:id" component={ProspectForm} />
      <Route path="/prospeccao" component={Prospecting} />
      <Route path="/restaurantes/perfil/:id" component={ActiveRestaurantProfile} />
      <Route path="/restaurantes/novo" component={ActiveRestaurantForm} />
      <Route path="/restaurantes/:id" component={ActiveRestaurantForm} />
      <Route path="/restaurantes" component={ActiveRestaurantsPage} />
      <Route path="/clientes" component={Clients} />
      <Route path="/cotacao/preview" component={QuotationPreview} />
      <Route path="/campanhas/:id" component={CampaignDetail} />
      <Route path="/campanhas" component={Campaigns} />
      <Route path="/economics" component={Economics} />
      <Route path="/producao" component={Production} />
      <Route path="/membros" component={Members} />
      <Route path="/biblioteca">
        <PlaceholderPage title="Biblioteca" description="Repositório de artes e coasters" />
      </Route>
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
    return <LandingPage />;
  }

  return (
    <div className="h-screen flex overflow-hidden">
      <DashboardLayout user={user}>
        <Router />
      </DashboardLayout>
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
