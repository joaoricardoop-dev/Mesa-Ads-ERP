import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/NotFound";
import { Route, Switch } from "wouter";
import ErrorBoundary from "./components/ErrorBoundary";
import { ThemeProvider } from "./contexts/ThemeContext";
import AppNav from "./components/AppNav";
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

function App() {
  return (
    <ErrorBoundary>
      <ThemeProvider defaultTheme="dark" switchable>
        <TooltipProvider>
          <Toaster />
          <div className="h-screen flex flex-col overflow-hidden">
            <AppNav />
            <div className="flex-1 overflow-hidden">
              <Router />
            </div>
          </div>
        </TooltipProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
}

export default App;
