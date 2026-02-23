import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/NotFound";
import { Route, Switch } from "wouter";
import ErrorBoundary from "./components/ErrorBoundary";
import { ThemeProvider } from "./contexts/ThemeContext";
import AppNav from "./components/AppNav";
import { useAuth } from "./hooks/use-auth";
import Home from "./pages/Home";
import Prospecting from "./pages/Restaurants";
import ProspectForm from "./pages/ProspectForm";
import ActiveRestaurantsPage from "./pages/ActiveRestaurants";
import ActiveRestaurantForm from "./pages/ActiveRestaurantForm";
import ActiveRestaurantProfile from "./pages/ActiveRestaurantProfile";
import Clients from "./pages/Clients";
import Campaigns from "./pages/Campaigns";
import CampaignDetail from "./pages/CampaignDetail";
import Economics from "./pages/Economics";
import Production from "./pages/Production";
import LandingPage from "./pages/LandingPage";

function Router() {
  return (
    <Switch>
      <Route path={"/"} component={Home} />
      <Route path={"/prospeccao/novo"} component={ProspectForm} />
      <Route path={"/prospeccao/:id"} component={ProspectForm} />
      <Route path={"/prospeccao"} component={Prospecting} />
      <Route path={"/restaurantes/perfil/:id"} component={ActiveRestaurantProfile} />
      <Route path={"/restaurantes/novo"} component={ActiveRestaurantForm} />
      <Route path={"/restaurantes/:id"} component={ActiveRestaurantForm} />
      <Route path={"/restaurantes"} component={ActiveRestaurantsPage} />
      <Route path={"/clientes"} component={Clients} />
      <Route path={"/campanhas/:id"} component={CampaignDetail} />
      <Route path={"/campanhas"} component={Campaigns} />
      <Route path={"/economics"} component={Economics} />
      <Route path={"/producao"} component={Production} />
      <Route path={"/404"} component={NotFound} />
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
    <div className="h-screen flex flex-col overflow-hidden">
      <AppNav user={user} />
      <div className="flex-1 overflow-hidden">
        <Router />
      </div>
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
