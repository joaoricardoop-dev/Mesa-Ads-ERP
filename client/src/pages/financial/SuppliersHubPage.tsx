import { useLocation } from "wouter";
import PageContainer from "@/components/PageContainer";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { VipProvidersBody } from "./VipProvidersPage";
import SuppliersTab from "./fornecedores/SuppliersTab";
import PartnersTab from "./fornecedores/PartnersTab";

const TABS = ["fornecedores", "vip", "parceiros"] as const;
type TabKey = (typeof TABS)[number];

export default function SuppliersHubPage() {
  const [location, navigate] = useLocation();
  const params = new URLSearchParams(location.split("?")[1] || "");
  const activeRaw = params.get("tab") as TabKey | null;
  const active: TabKey = TABS.includes(activeRaw as TabKey) ? (activeRaw as TabKey) : "fornecedores";

  function setTab(value: string) {
    const next = new URLSearchParams(params);
    next.set("tab", value);
    navigate(`/financeiro/fornecedores?${next.toString()}`);
  }

  return (
    <PageContainer
      title="Fornecedores & Parceiros"
      description="Gerencie fornecedores de produção, provedores de Sala VIP e parceiros comerciais em um único lugar."
    >
      <Tabs value={active} onValueChange={setTab} className="space-y-4">
        <TabsList>
          <TabsTrigger value="fornecedores">Fornecedores</TabsTrigger>
          <TabsTrigger value="vip">Provedores Sala VIP</TabsTrigger>
          <TabsTrigger value="parceiros">Parceiros</TabsTrigger>
        </TabsList>
        <TabsContent value="fornecedores" className="mt-0">
          <SuppliersTab />
        </TabsContent>
        <TabsContent value="vip" className="mt-0">
          <VipProvidersBody embedded />
        </TabsContent>
        <TabsContent value="parceiros" className="mt-0">
          <PartnersTab />
        </TabsContent>
      </Tabs>
    </PageContainer>
  );
}
