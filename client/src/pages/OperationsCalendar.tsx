import { useMemo, useState } from "react";
import PageContainer from "@/components/PageContainer";
import OccupancyCalendar, { OccupancyPhase } from "@/components/OccupancyCalendar";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { trpc } from "@/lib/trpc";
import { Filter, Building2, Package, Store, Globe } from "lucide-react";

type ViewMode = "global" | "client" | "product" | "location";

const VIEW_LABELS: Record<ViewMode, string> = {
  global: "Global",
  client: "Anunciante",
  product: "Produto",
  location: "Local",
};
const VIEW_ICONS: Record<ViewMode, React.ComponentType<{ className?: string }>> = {
  global: Globe,
  client: Building2,
  product: Package,
  location: Store,
};

function defaultRange(): { from: string; to: string } {
  const today = new Date();
  const from = new Date(today.getFullYear(), today.getMonth() - 1, 1);
  const to = new Date(today.getFullYear(), today.getMonth() + 5, 0);
  return {
    from: from.toISOString().split("T")[0],
    to: to.toISOString().split("T")[0],
  };
}

export default function OperationsCalendar() {
  const [view, setView] = useState<ViewMode>("global");
  const initial = useMemo(defaultRange, []);
  const [from, setFrom] = useState(initial.from);
  const [to, setTo] = useState(initial.to);
  const [clientId, setClientId] = useState<string>("");
  const [productId, setProductId] = useState<string>("");
  const [restaurantId, setRestaurantId] = useState<string>("");
  const [phaseStatus, setPhaseStatus] = useState<string>("");

  const { data: clientsData } = trpc.advertiser.list.useQuery();
  const clientsList = clientsData?.items ?? [];
  const { data: productsList = [] } = trpc.product.list.useQuery();
  const { data: restaurantsList = [] } = trpc.activeRestaurant.list.useQuery();

  // Resolve filters depending on the active view.
  const effectiveClientId = view === "client" ? (clientId ? Number(clientId) : undefined) : undefined;
  const effectiveProductId = view === "product" ? (productId ? Number(productId) : undefined) : undefined;
  const useLocationEndpoint = view === "location" && restaurantId;

  const globalQuery = trpc.ops.globalCalendar.useQuery(
    {
      from,
      to,
      clientId: effectiveClientId,
      productId: effectiveProductId,
      phaseStatus: phaseStatus ? (phaseStatus as any) : undefined,
    },
    { enabled: !useLocationEndpoint },
  );
  const locationQuery = trpc.ops.locationCalendar.useQuery(
    {
      restaurantId: restaurantId ? Number(restaurantId) : 0,
      from,
      to,
    },
    { enabled: !!useLocationEndpoint },
  );

  const isLoading = useLocationEndpoint ? locationQuery.isLoading : globalQuery.isLoading;
  const phases = (useLocationEndpoint ? locationQuery.data : globalQuery.data) as OccupancyPhase[] | undefined;

  const groupBy =
    view === "client" ? "campaign" :
    view === "product" ? "product" :
    view === "location" ? "campaign" :
    "campaign";

  const counts = useMemo(() => {
    const all = phases ?? [];
    return {
      total: all.length,
      ativa: all.filter((p) => p.phaseStatus === "ativa").length,
      planejada: all.filter((p) => p.phaseStatus === "planejada").length,
      concluida: all.filter((p) => p.phaseStatus === "concluida").length,
      cancelada: all.filter((p) => p.phaseStatus === "cancelada").length,
    };
  }, [phases]);

  return (
    <PageContainer
      title="Calendário Operacional"
      description="Gantt global da ocupação para a equipe Ops gerenciar marketplace, locais, anunciantes e produtos."
    >
      <div className="space-y-4">
        {/* Seletor de visão */}
        <div className="flex flex-wrap gap-2">
          {(Object.keys(VIEW_LABELS) as ViewMode[]).map((v) => {
            const Icon = VIEW_ICONS[v];
            const active = view === v;
            return (
              <Button
                key={v}
                variant={active ? "default" : "outline"}
                size="sm"
                onClick={() => setView(v)}
                className="gap-1.5 text-xs"
              >
                <Icon className="w-3.5 h-3.5" />
                {VIEW_LABELS[v]}
              </Button>
            );
          })}
        </div>

        {/* Filtros */}
        <div className="rounded-xl border border-border/40 bg-card p-3 grid grid-cols-2 lg:grid-cols-6 gap-3">
          <div>
            <Label className="text-[10px] uppercase text-muted-foreground">De</Label>
            <Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className="h-8 text-xs" />
          </div>
          <div>
            <Label className="text-[10px] uppercase text-muted-foreground">Até</Label>
            <Input type="date" value={to} onChange={(e) => setTo(e.target.value)} className="h-8 text-xs" />
          </div>
          <div>
            <Label className="text-[10px] uppercase text-muted-foreground">Status fase</Label>
            <Select value={phaseStatus || "all"} onValueChange={(v) => setPhaseStatus(v === "all" ? "" : v)}>
              <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos</SelectItem>
                <SelectItem value="planejada">Planejada</SelectItem>
                <SelectItem value="ativa">Ativa</SelectItem>
                <SelectItem value="concluida">Concluída</SelectItem>
                <SelectItem value="cancelada">Cancelada</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {view === "client" && (
            <div className="col-span-2 lg:col-span-3">
              <Label className="text-[10px] uppercase text-muted-foreground">Anunciante</Label>
              <Select value={clientId || "none"} onValueChange={(v) => setClientId(v === "none" ? "" : v)}>
                <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="Selecione um anunciante" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Todos</SelectItem>
                  {clientsList.map((c: any) => (
                    <SelectItem key={c.id} value={String(c.id)}>{c.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
          {view === "product" && (
            <div className="col-span-2 lg:col-span-3">
              <Label className="text-[10px] uppercase text-muted-foreground">Produto</Label>
              <Select value={productId || "none"} onValueChange={(v) => setProductId(v === "none" ? "" : v)}>
                <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="Selecione um produto" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Todos</SelectItem>
                  {productsList.map((p: any) => (
                    <SelectItem key={p.id} value={String(p.id)}>
                      {p.name}{p.tipo ? ` (${p.tipo})` : ""}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
          {view === "location" && (
            <div className="col-span-2 lg:col-span-3">
              <Label className="text-[10px] uppercase text-muted-foreground">Local</Label>
              <Select value={restaurantId || "none"} onValueChange={(v) => setRestaurantId(v === "none" ? "" : v)}>
                <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="Selecione um local" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">— selecione —</SelectItem>
                  {restaurantsList.map((r: any) => (
                    <SelectItem key={r.id} value={String(r.id)}>{r.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
        </div>

        {/* KPIs rápidos */}
        <div className="grid grid-cols-2 lg:grid-cols-5 gap-2">
          <Kpi label="Fases" value={counts.total} />
          <Kpi label="Ativas" value={counts.ativa} color="text-emerald-400" />
          <Kpi label="Planejadas" value={counts.planejada} color="text-zinc-300" />
          <Kpi label="Concluídas" value={counts.concluida} color="text-blue-400" />
          <Kpi label="Canceladas" value={counts.cancelada} color="text-red-400" />
        </div>

        {/* Estado especial: visão Local sem seleção */}
        {view === "location" && !restaurantId ? (
          <div className="rounded-xl border border-border/40 bg-card p-12 text-center text-sm text-muted-foreground">
            <Filter className="w-5 h-5 mx-auto mb-2 opacity-60" />
            Selecione um local para ver a ocupação.
          </div>
        ) : (
          <OccupancyCalendar
            phases={phases ?? []}
            groupBy={groupBy}
            isLoading={isLoading}
            rangeStart={from}
            rangeEnd={to}
          />
        )}
      </div>
    </PageContainer>
  );
}

function Kpi({ label, value, color }: { label: string; value: number; color?: string }) {
  return (
    <div className="rounded-xl border border-border/30 bg-card p-3">
      <p className="text-[10px] uppercase text-muted-foreground">{label}</p>
      <p className={`text-lg font-bold font-mono ${color ?? ""}`}>{value}</p>
    </div>
  );
}
