import PageContainer from "@/components/PageContainer";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/hooks/use-auth";
import {
  ChevronDown,
  ChevronRight,
  ShieldX,
  History,
  RefreshCw,
} from "lucide-react";
import { useMemo, useState } from "react";

const ENTITY_LABELS: Record<string, string> = {
  invoice: "Fatura",
  accounts_payable: "Conta a Pagar",
  operational_cost: "Custo Operacional",
  vip_provider: "Provedor Sala VIP",
  partner: "Parceiro",
  restaurant_payment: "Pagamento Restaurante",
};

const ACTION_LABELS: Record<string, { label: string; color: string }> = {
  create: { label: "Criou", color: "bg-emerald-500/10 text-emerald-400 border-emerald-500/30" },
  update: { label: "Editou", color: "bg-blue-500/10 text-blue-400 border-blue-500/30" },
  delete: { label: "Excluiu", color: "bg-red-500/10 text-red-400 border-red-500/30" },
  mark_paid: { label: "Marcou Pago", color: "bg-emerald-500/10 text-emerald-400 border-emerald-500/30" },
  revert_payment: { label: "Reverteu Pagamento", color: "bg-amber-500/10 text-amber-400 border-amber-500/30" },
  cancel: { label: "Cancelou", color: "bg-red-500/10 text-red-400 border-red-500/30" },
  generate: { label: "Gerou", color: "bg-purple-500/10 text-purple-400 border-purple-500/30" },
};

function formatDateTime(d: Date | string | null): string {
  if (!d) return "—";
  const dt = typeof d === "string" ? new Date(d) : d;
  return dt.toLocaleString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
}

type AnyObj = Record<string, unknown> | null | undefined;

function diffKeys(before: AnyObj, after: AnyObj): string[] {
  const keys = new Set<string>();
  if (before && typeof before === "object") for (const k of Object.keys(before)) keys.add(k);
  if (after && typeof after === "object") for (const k of Object.keys(after)) keys.add(k);
  const result: string[] = [];
  Array.from(keys).forEach((k) => {
    if (k === "updatedAt" || k === "createdAt") return;
    const a = (before as any)?.[k];
    const b = (after as any)?.[k];
    if (JSON.stringify(a) !== JSON.stringify(b)) result.push(k);
  });
  return result.sort();
}

function fmtVal(v: unknown): string {
  if (v == null) return "—";
  if (typeof v === "object") return JSON.stringify(v);
  return String(v);
}

function DiffRow({ k, before, after }: { k: string; before: AnyObj; after: AnyObj }) {
  const a = (before as any)?.[k];
  const b = (after as any)?.[k];
  return (
    <tr className="border-t border-[hsl(0,0%,14%)]">
      <td className="py-1.5 px-2 text-xs font-mono text-zinc-400">{k}</td>
      <td className="py-1.5 px-2 text-xs font-mono text-red-300/80 break-all max-w-[280px]">{fmtVal(a)}</td>
      <td className="py-1.5 px-2 text-xs font-mono text-emerald-300/80 break-all max-w-[280px]">{fmtVal(b)}</td>
    </tr>
  );
}

function AuditRow({ row }: { row: any }) {
  const [open, setOpen] = useState(false);
  const action = ACTION_LABELS[row.action] || { label: row.action, color: "bg-zinc-500/10 text-zinc-400 border-zinc-500/30" };
  const entity = ENTITY_LABELS[row.entityType] || row.entityType;
  const changedKeys = useMemo(() => diffKeys(row.before, row.after), [row.before, row.after]);
  const hasDetails = row.before || row.after || row.metadata;

  return (
    <>
      <tr
        className="border-t border-[hsl(0,0%,14%)] hover:bg-[hsl(0,0%,9%)] cursor-pointer"
        onClick={() => hasDetails && setOpen((v) => !v)}
      >
        <td className="py-2 px-3 text-xs text-zinc-500">
          {hasDetails ? (open ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />) : null}
        </td>
        <td className="py-2 px-3 text-xs text-zinc-300 whitespace-nowrap">{formatDateTime(row.createdAt)}</td>
        <td className="py-2 px-3">
          <Badge variant="outline" className={action.color + " text-[10px] uppercase tracking-wide"}>
            {action.label}
          </Badge>
        </td>
        <td className="py-2 px-3 text-xs text-zinc-300">{entity}</td>
        <td className="py-2 px-3 text-xs text-zinc-300 font-mono">{row.entityId ?? "—"}</td>
        <td className="py-2 px-3 text-xs text-zinc-400">
          {row.actorRole ? <span className="text-[10px] uppercase mr-1">{row.actorRole}</span> : null}
          <span className="font-mono text-[11px]">{row.actorUserId || "—"}</span>
        </td>
        <td className="py-2 px-3 text-xs text-zinc-400">
          {changedKeys.length > 0 ? `${changedKeys.length} campo(s)` : "—"}
        </td>
      </tr>
      {open && hasDetails && (
        <tr className="bg-[hsl(0,0%,5%)]">
          <td colSpan={7} className="px-6 py-4">
            {changedKeys.length > 0 && (
              <div className="mb-3">
                <div className="text-[11px] uppercase text-zinc-500 mb-1.5">Mudanças</div>
                <table className="w-full text-left">
                  <thead>
                    <tr className="text-[10px] uppercase text-zinc-500">
                      <th className="py-1 px-2">Campo</th>
                      <th className="py-1 px-2">Antes</th>
                      <th className="py-1 px-2">Depois</th>
                    </tr>
                  </thead>
                  <tbody>
                    {changedKeys.map((k) => (
                      <DiffRow key={k} k={k} before={row.before} after={row.after} />
                    ))}
                  </tbody>
                </table>
              </div>
            )}
            {row.metadata && (
              <div className="mt-3">
                <div className="text-[11px] uppercase text-zinc-500 mb-1.5">Metadados</div>
                <pre className="text-[11px] font-mono text-zinc-300 bg-[hsl(0,0%,3%)] p-2 rounded overflow-auto max-h-64">
                  {JSON.stringify(row.metadata, null, 2)}
                </pre>
              </div>
            )}
            {!changedKeys.length && (row.before || row.after) && (
              <div className="mt-2 grid grid-cols-2 gap-3">
                <div>
                  <div className="text-[11px] uppercase text-zinc-500 mb-1.5">Antes</div>
                  <pre className="text-[11px] font-mono text-zinc-300 bg-[hsl(0,0%,3%)] p-2 rounded overflow-auto max-h-64">
                    {row.before ? JSON.stringify(row.before, null, 2) : "—"}
                  </pre>
                </div>
                <div>
                  <div className="text-[11px] uppercase text-zinc-500 mb-1.5">Depois</div>
                  <pre className="text-[11px] font-mono text-zinc-300 bg-[hsl(0,0%,3%)] p-2 rounded overflow-auto max-h-64">
                    {row.after ? JSON.stringify(row.after, null, 2) : "—"}
                  </pre>
                </div>
              </div>
            )}
          </td>
        </tr>
      )}
    </>
  );
}

export default function FinancialAuditLog() {
  const { user } = useAuth();
  const [entityType, setEntityType] = useState<string>("");
  const [action, setAction] = useState<string>("");
  const [actorUserId, setActorUserId] = useState<string>("");
  const [entityId, setEntityId] = useState<string>("");
  const [startDate, setStartDate] = useState<string>("");
  const [endDate, setEndDate] = useState<string>("");
  const [page, setPage] = useState(0);
  const limit = 100;

  const isAdmin = user?.role === "admin";

  const queryInput = isAdmin
    ? {
        entityType: entityType || undefined,
        action: action || undefined,
        actorUserId: actorUserId || undefined,
        entityId: entityId ? parseInt(entityId) : undefined,
        startDate: startDate || undefined,
        endDate: endDate || undefined,
        limit,
        offset: page * limit,
      }
    : undefined;

  const { data, isLoading, refetch, isFetching } = trpc.financial.auditLog.useQuery(
    queryInput,
    { enabled: isAdmin }
  );

  const { data: actors } = trpc.financial.auditLogActors.useQuery(undefined, {
    enabled: isAdmin,
  });

  if (!isAdmin) {
    return (
      <PageContainer title="Auditoria Financeira">
        <div className="flex flex-col items-center justify-center py-20 text-zinc-400">
          <ShieldX className="w-12 h-12 mb-3 text-red-400/60" />
          <h2 className="text-lg font-medium text-zinc-200">Acesso restrito</h2>
          <p className="text-sm mt-1">A trilha de auditoria financeira é exclusiva para administradores.</p>
        </div>
      </PageContainer>
    );
  }

  const total = data?.total ?? 0;
  const rows = data?.rows ?? [];
  const totalPages = Math.max(1, Math.ceil(total / limit));

  return (
    <PageContainer
      title="Auditoria Financeira"
      description="Registro completo de alterações em faturas, contas a pagar, custos, parceiros e provedores VIP."
      actions={
        <Button variant="outline" size="sm" onClick={() => refetch()} disabled={isFetching}>
          <RefreshCw className={`w-3.5 h-3.5 mr-1.5 ${isFetching ? "animate-spin" : ""}`} />
          Atualizar
        </Button>
      }
    >

      <div className="grid grid-cols-1 md:grid-cols-6 gap-3 mb-4 p-3 bg-[hsl(0,0%,7%)] border border-[hsl(0,0%,14%)] rounded-lg">
        <div>
          <Label className="text-[10px] uppercase text-zinc-500 tracking-wide">Entidade</Label>
          <Select value={entityType || "all"} onValueChange={(v) => { setEntityType(v === "all" ? "" : v); setPage(0); }}>
            <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas</SelectItem>
              {Object.entries(ENTITY_LABELS).map(([k, v]) => (
                <SelectItem key={k} value={k}>{v}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label className="text-[10px] uppercase text-zinc-500 tracking-wide">Ação</Label>
          <Select value={action || "all"} onValueChange={(v) => { setAction(v === "all" ? "" : v); setPage(0); }}>
            <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas</SelectItem>
              {Object.entries(ACTION_LABELS).map(([k, v]) => (
                <SelectItem key={k} value={k}>{v.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label className="text-[10px] uppercase text-zinc-500 tracking-wide">Usuário</Label>
          <Select value={actorUserId || "all"} onValueChange={(v) => { setActorUserId(v === "all" ? "" : v); setPage(0); }}>
            <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="Todos" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos</SelectItem>
              {(actors ?? []).map((a: any) => (
                <SelectItem key={a.actorUserId} value={a.actorUserId}>
                  {a.actorRole ? `[${a.actorRole}] ` : ""}{a.actorUserId}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label className="text-[10px] uppercase text-zinc-500 tracking-wide">ID Entidade</Label>
          <Input value={entityId} onChange={(e) => { setEntityId(e.target.value.replace(/\D/g, "")); setPage(0); }} className="h-8 text-xs" />
        </div>
        <div>
          <Label className="text-[10px] uppercase text-zinc-500 tracking-wide">De</Label>
          <Input type="date" value={startDate} onChange={(e) => { setStartDate(e.target.value); setPage(0); }} className="h-8 text-xs" />
        </div>
        <div>
          <Label className="text-[10px] uppercase text-zinc-500 tracking-wide">Até</Label>
          <Input type="date" value={endDate} onChange={(e) => { setEndDate(e.target.value); setPage(0); }} className="h-8 text-xs" />
        </div>
      </div>

      <div className="bg-[hsl(0,0%,7%)] border border-[hsl(0,0%,14%)] rounded-lg overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead className="bg-[hsl(0,0%,9%)]">
              <tr className="text-[10px] uppercase text-zinc-500 tracking-wide">
                <th className="py-2 px-3 w-8"></th>
                <th className="py-2 px-3">Quando</th>
                <th className="py-2 px-3">Ação</th>
                <th className="py-2 px-3">Entidade</th>
                <th className="py-2 px-3">ID</th>
                <th className="py-2 px-3">Usuário</th>
                <th className="py-2 px-3">Mudanças</th>
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                <tr><td colSpan={7} className="py-12 text-center text-zinc-500 text-sm">Carregando…</td></tr>
              ) : rows.length === 0 ? (
                <tr><td colSpan={7} className="py-12 text-center text-zinc-500 text-sm">Nenhuma entrada encontrada.</td></tr>
              ) : rows.map((r: any) => <AuditRow key={r.id} row={r} />)}
            </tbody>
          </table>
        </div>
        <div className="flex items-center justify-between border-t border-[hsl(0,0%,14%)] px-3 py-2 text-xs text-zinc-500">
          <div>{total} registros</div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" disabled={page === 0} onClick={() => setPage((p) => Math.max(0, p - 1))}>
              Anterior
            </Button>
            <span>Página {page + 1} de {totalPages}</span>
            <Button variant="outline" size="sm" disabled={page + 1 >= totalPages} onClick={() => setPage((p) => p + 1)}>
              Próxima
            </Button>
          </div>
        </div>
      </div>
    </PageContainer>
  );
}
