import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Bell, BellRing, Check, CheckCheck, FileText, GitBranch, Handshake, Megaphone, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { useLocation } from "wouter";
import type { inferRouterOutputs } from "@trpc/server";
import type { AppRouter } from "../../../server/routers";

type RouterOutput = inferRouterOutputs<AppRouter>;
type NotificationItem = RouterOutput["notification"]["list"][number];
type AnuncianteNotificationItem = RouterOutput["notification"]["listForAnunciante"][number];

const EVENT_META: Record<string, { label: string; icon: React.ElementType; color: string }> = {
  lead_created: { label: "Novo Lead", icon: Handshake, color: "text-green-500" },
  stage_changed: { label: "Mudança de Estágio", icon: GitBranch, color: "text-blue-500" },
  quotation_created: { label: "Cotação Gerada", icon: FileText, color: "text-purple-500" },
  campaign_status: { label: "Status da Campanha", icon: Megaphone, color: "text-orange-500" },
};

const FILTER_OPTIONS = [
  { value: undefined as string | undefined, label: "Todos" },
  { value: "lead_created" as const, label: "Novos leads" },
  { value: "stage_changed" as const, label: "Estágios" },
  { value: "quotation_created" as const, label: "Cotações" },
] as const;

function timeAgo(date: Date | string): string {
  const d = typeof date === "string" ? new Date(date) : date;
  const diff = Math.floor((Date.now() - d.getTime()) / 1000);
  if (diff < 60) return "agora mesmo";
  if (diff < 3600) return `há ${Math.floor(diff / 60)} min`;
  if (diff < 86400) return `há ${Math.floor(diff / 3600)}h`;
  if (diff < 604800) return `há ${Math.floor(diff / 86400)}d`;
  return d.toLocaleDateString("pt-BR");
}

function getNavigationPath(n: NotificationItem): string | null {
  if (n.eventType === "quotation_created" && !n.leadId) {
    return null;
  }
  if (n.leadId) {
    return `/comercial/leads`;
  }
  return null;
}

interface NotificationPanelProps {
  open: boolean;
  onClose: () => void;
  filterType: "lead_created" | "stage_changed" | "quotation_created" | undefined;
  onFilterTypeChange: (type: "lead_created" | "stage_changed" | "quotation_created" | undefined) => void;
}

export function NotificationPanel({ open, onClose, filterType, onFilterTypeChange }: NotificationPanelProps) {
  const queryClient = useQueryClient();
  const [, setLocation] = useLocation();

  const { data: notifications = [], refetch } = trpc.notification.list.useQuery(
    { limit: 50, offset: 0, eventType: filterType, unreadOnly: false },
    { enabled: open, refetchInterval: open ? 30000 : false }
  );

  const markReadMutation = trpc.notification.markRead.useMutation({
    onSuccess: () => {
      refetch();
      queryClient.invalidateQueries({ queryKey: [["notification", "unreadCount"]] });
    },
  });

  const markAllReadMutation = trpc.notification.markAllRead.useMutation({
    onSuccess: () => {
      refetch();
      queryClient.invalidateQueries({ queryKey: [["notification", "unreadCount"]] });
      toast.success("Todas as notificações foram marcadas como lidas.");
    },
  });

  const handleMarkRead = (id: number) => markReadMutation.mutate({ id });

  const handleNavigate = (n: NotificationItem) => {
    const path = getNavigationPath(n);
    if (path) {
      setLocation(path);
      onClose();
    }
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50" onClick={onClose}>
      <div
        className="absolute right-2 top-14 w-[380px] max-h-[calc(100vh-80px)] bg-card border border-border/30 rounded-xl shadow-2xl flex flex-col overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-4 py-3 border-b border-border/20 shrink-0">
          <div className="flex items-center gap-2">
            <BellRing className="w-4 h-4 text-primary" />
            <span className="font-semibold text-sm">Notificações</span>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="sm"
              className="text-xs h-7 px-2"
              onClick={() => markAllReadMutation.mutate()}
              disabled={markAllReadMutation.isPending}
            >
              <CheckCheck className="w-3.5 h-3.5 mr-1" />
              Marcar todas
            </Button>
            <button
              onClick={onClose}
              className="h-7 w-7 flex items-center justify-center rounded-lg hover:bg-accent transition-colors"
            >
              <X className="w-4 h-4 text-muted-foreground" />
            </button>
          </div>
        </div>

        <div className="flex gap-1 px-3 py-2 border-b border-border/20 shrink-0 flex-wrap">
          {FILTER_OPTIONS.map((opt) => (
            <FilterChip
              key={opt.label}
              label={opt.label}
              active={filterType === opt.value}
              onClick={() => onFilterTypeChange(opt.value)}
            />
          ))}
        </div>

        <div className="overflow-y-auto flex-1">
          {notifications.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
              <Bell className="w-8 h-8 mb-2 opacity-30" />
              <p className="text-sm">Nenhuma notificação</p>
            </div>
          ) : (
            <ul>
              {notifications.map((n) => {
                const meta = EVENT_META[n.eventType] ?? (n.eventType.startsWith("campaign_status") ? EVENT_META["campaign_status"] : null) ?? { label: n.eventType, icon: Bell, color: "text-muted-foreground" };
                const Icon = meta.icon;
                const isUnread = !n.readAt;
                const isPartner = !!n.partnerId;
                const navPath = getNavigationPath(n);

                return (
                  <li
                    key={n.id}
                    className={cn(
                      "flex items-start gap-3 px-4 py-3 border-b border-border/10 transition-colors",
                      isUnread && "bg-primary/5",
                      isPartner && isUnread && "border-l-2 border-l-primary",
                      navPath && "cursor-pointer hover:bg-accent/40"
                    )}
                    onClick={navPath ? () => handleNavigate(n) : undefined}
                  >
                    <div className={cn("mt-0.5 shrink-0", meta.color)}>
                      <Icon className="w-4 h-4" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5 mb-0.5">
                        <span className="text-[10px] font-medium text-muted-foreground uppercase tracking-wide">{meta.label}</span>
                        {isPartner && (
                          <Badge variant="outline" className="text-[9px] px-1 py-0 h-4 border-primary/40 text-primary">
                            Parceiro
                          </Badge>
                        )}
                      </div>
                      <p className="text-xs text-foreground leading-snug">{n.message}</p>
                      <span className="text-[10px] text-muted-foreground mt-0.5 block">{timeAgo(n.createdAt)}</span>
                    </div>
                    {isUnread && (
                      <button
                        className="shrink-0 mt-1 h-6 w-6 flex items-center justify-center rounded-md hover:bg-accent transition-colors"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleMarkRead(n.id);
                        }}
                        title="Marcar como lida"
                      >
                        <Check className="w-3.5 h-3.5 text-muted-foreground" />
                      </button>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}

interface AnunciantePanelProps {
  open: boolean;
  onClose: () => void;
}

export function AnuncianteNotificationPanel({ open, onClose }: AnunciantePanelProps) {
  const queryClient = useQueryClient();
  const [, setLocation] = useLocation();

  const { data: notifications = [], refetch } = trpc.notification.listForAnunciante.useQuery(
    { limit: 50, offset: 0, unreadOnly: false },
    { enabled: open, refetchInterval: open ? 30000 : false }
  );

  const markReadMutation = trpc.notification.markReadForAnunciante.useMutation({
    onSuccess: () => {
      refetch();
      queryClient.invalidateQueries({ queryKey: [["notification", "unreadCountForAnunciante"]] });
    },
  });

  const markAllReadMutation = trpc.notification.markAllReadForAnunciante.useMutation({
    onSuccess: () => {
      refetch();
      queryClient.invalidateQueries({ queryKey: [["notification", "unreadCountForAnunciante"]] });
      toast.success("Todas as notificações foram marcadas como lidas.");
    },
  });

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50" onClick={onClose}>
      <div
        className="absolute right-2 top-14 w-[380px] max-h-[calc(100vh-80px)] bg-card border border-border/30 rounded-xl shadow-2xl flex flex-col overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-4 py-3 border-b border-border/20 shrink-0">
          <div className="flex items-center gap-2">
            <BellRing className="w-4 h-4 text-primary" />
            <span className="font-semibold text-sm">Notificações</span>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="sm"
              className="text-xs h-7 px-2"
              onClick={() => markAllReadMutation.mutate()}
              disabled={markAllReadMutation.isPending}
            >
              <CheckCheck className="w-3.5 h-3.5 mr-1" />
              Marcar todas
            </Button>
            <button
              onClick={onClose}
              className="h-7 w-7 flex items-center justify-center rounded-lg hover:bg-accent transition-colors"
            >
              <X className="w-4 h-4 text-muted-foreground" />
            </button>
          </div>
        </div>

        <div className="overflow-y-auto flex-1">
          {notifications.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
              <Bell className="w-8 h-8 mb-2 opacity-30" />
              <p className="text-sm">Nenhuma notificação</p>
            </div>
          ) : (
            <ul>
              {notifications.map((n) => {
                const isUnread = !n.readAt;
                return (
                  <li
                    key={n.id}
                    className={cn(
                      "flex items-start gap-3 px-4 py-3 border-b border-border/10 transition-colors",
                      isUnread && "bg-primary/5",
                      n.campaignId && "cursor-pointer hover:bg-accent/40"
                    )}
                    onClick={n.campaignId ? () => { setLocation("/portal"); onClose(); } : undefined}
                  >
                    <div className="mt-0.5 shrink-0 text-orange-500">
                      <Megaphone className="w-4 h-4" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5 mb-0.5">
                        <span className="text-[10px] font-medium text-muted-foreground uppercase tracking-wide">Status da Campanha</span>
                      </div>
                      <p className="text-xs text-foreground leading-snug">{n.message}</p>
                      <span className="text-[10px] text-muted-foreground mt-0.5 block">{timeAgo(n.createdAt)}</span>
                    </div>
                    {isUnread && (
                      <button
                        className="shrink-0 mt-1 h-6 w-6 flex items-center justify-center rounded-md hover:bg-accent transition-colors"
                        onClick={(e) => {
                          e.stopPropagation();
                          markReadMutation.mutate({ id: n.id });
                        }}
                        title="Marcar como lida"
                      >
                        <Check className="w-3.5 h-3.5 text-muted-foreground" />
                      </button>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}

function FilterChip({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "text-[10px] px-2 py-1 rounded-full font-medium transition-colors",
        active
          ? "bg-primary text-primary-foreground"
          : "bg-accent/50 text-muted-foreground hover:bg-accent"
      )}
    >
      {label}
    </button>
  );
}

interface NotificationBellProps {
  isAdmin: boolean;
  isAnunciante?: boolean;
}

export function NotificationBell({ isAdmin, isAnunciante }: NotificationBellProps) {
  const [open, setOpen] = useState(false);
  const [filterType, setFilterType] = useState<"lead_created" | "stage_changed" | "quotation_created" | undefined>(undefined);

  const { data: adminCountData } = trpc.notification.unreadCount.useQuery(undefined, {
    enabled: isAdmin,
    refetchInterval: 30000,
  });

  const { data: anuncianteCountData } = trpc.notification.unreadCountForAnunciante.useQuery(undefined, {
    enabled: !!isAnunciante && !isAdmin,
    refetchInterval: 30000,
  });

  const count = isAdmin ? (adminCountData?.count ?? 0) : (anuncianteCountData?.count ?? 0);

  if (!isAdmin && !isAnunciante) return null;

  return (
    <>
      <button
        onClick={() => setOpen((v) => !v)}
        className="relative h-8 w-8 flex items-center justify-center rounded-lg hover:bg-accent transition-colors"
        aria-label="Notificações"
      >
        {count > 0 ? <BellRing className="w-4 h-4 text-primary" /> : <Bell className="w-4 h-4" />}
        {count > 0 && (
          <span className="absolute -top-0.5 -right-0.5 min-w-[16px] h-4 flex items-center justify-center rounded-full bg-primary text-[9px] font-bold text-primary-foreground px-0.5 leading-none">
            {count > 99 ? "99+" : count}
          </span>
        )}
      </button>
      {isAdmin ? (
        <NotificationPanel
          open={open}
          onClose={() => setOpen(false)}
          filterType={filterType}
          onFilterTypeChange={setFilterType}
        />
      ) : (
        <AnuncianteNotificationPanel
          open={open}
          onClose={() => setOpen(false)}
        />
      )}
    </>
  );
}
