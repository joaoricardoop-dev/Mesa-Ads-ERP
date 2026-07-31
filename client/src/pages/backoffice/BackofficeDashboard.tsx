import { useLocation } from "wouter";
import PageContainer from "@/components/PageContainer";
import { trpc } from "@/lib/trpc";
import { Package, Truck, Monitor, Handshake, FileBarChart, ChevronRight } from "lucide-react";

function Kpi({ label, value, tone }: { label: string; value: number | string; tone?: "warn" | "bad" | "ok" }) {
  const color = tone === "bad" ? "text-red-400" : tone === "warn" ? "text-amber-400" : tone === "ok" ? "text-emerald-400" : "";
  return (
    <div className="rounded-xl border border-border/30 bg-card p-3">
      <p className="text-[10px] uppercase text-muted-foreground">{label}</p>
      <p className={`text-xl font-bold font-mono ${color}`}>{value}</p>
    </div>
  );
}

export default function BackofficeDashboard() {
  const [, navigate] = useLocation();

  const { data: orders = [] } = trpc.backoffice.production.list.useQuery(undefined);
  const { data: pendingCounts = [] } = trpc.backoffice.stockCount.list.useQuery({ onlyPending: true });
  const { data: todayChecks = [] } = trpc.backoffice.screenCheck.today.useQuery();
  const { data: permutasList = [] } = trpc.backoffice.permuta.list.useQuery();

  const openProduction = orders.filter((o: any) => o.status !== "recebida").length;
  const pendingRestock = pendingCounts.filter((c: any) => !c.resolvedAt).length;
  const screensUnchecked = todayChecks.filter((t: any) => !t.checkId).length;
  const screensWithIssue = todayChecks.filter((t: any) => t.checkId && (t.isOnline === false || t.internetOk === false) && !t.resolvedAt).length;
  const lowBalancePermutas = permutasList.filter((p: any) => p.balance <= Number(p.totalValue) * 0.1).length;

  const cards = [
    {
      title: "Produção de Bolachas",
      icon: Package,
      path: "/backoffice/producao",
      kpis: [{ label: "Em andamento", value: openProduction, tone: openProduction > 0 ? "warn" as const : "ok" as const }],
    },
    {
      title: "Distribuição",
      icon: Truck,
      path: "/backoffice/distribuicao",
      kpis: [{ label: "Contagens pendentes", value: pendingRestock, tone: pendingRestock > 0 ? "bad" as const : "ok" as const }],
    },
    {
      title: "Telas",
      icon: Monitor,
      path: "/backoffice/telas",
      kpis: [
        { label: "Sem verificar hoje", value: screensUnchecked, tone: screensUnchecked > 0 ? "warn" as const : "ok" as const },
        { label: "Com problema", value: screensWithIssue, tone: screensWithIssue > 0 ? "bad" as const : "ok" as const },
      ],
    },
    {
      title: "Permutas",
      icon: Handshake,
      path: "/backoffice/permutas",
      kpis: [{ label: "Saldo baixo", value: lowBalancePermutas, tone: lowBalancePermutas > 0 ? "bad" as const : "ok" as const }],
    },
    {
      title: "Relatórios",
      icon: FileBarChart,
      path: "/backoffice/relatorios",
      kpis: [],
    },
  ];

  return (
    <PageContainer title="Backoffice" description="Rotina operacional de bolachas, telas e permutas.">
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {cards.map((c) => (
          <button
            key={c.path}
            onClick={() => navigate(c.path)}
            className="text-left rounded-xl border border-border/30 bg-card p-4 hover:border-primary/40 hover:bg-card/80 transition-colors group"
          >
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <c.icon className="w-4 h-4 text-primary" />
                <h3 className="text-sm font-semibold">{c.title}</h3>
              </div>
              <ChevronRight className="w-4 h-4 text-muted-foreground group-hover:translate-x-0.5 transition-transform" />
            </div>
            {c.kpis.length > 0 ? (
              <div className="grid grid-cols-2 gap-2">
                {c.kpis.map((k) => <Kpi key={k.label} {...k} />)}
              </div>
            ) : (
              <p className="text-xs text-muted-foreground">Ver log de relatoria enviada</p>
            )}
          </button>
        ))}
      </div>
    </PageContainer>
  );
}
