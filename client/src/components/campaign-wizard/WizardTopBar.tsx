import { useState, useMemo, useEffect } from "react";
import { Home } from "lucide-react";
import { useLocation } from "wouter";
import { useAuth } from "@/hooks/use-auth";
import { useWizardStore, STEP_LABELS, type WizardStep } from "./wizardStore";
import { useMediaShopStore } from "@/components/media-shop/mediaShopStore";
import { MesaChip } from "./mesa/MesaUI";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { cn } from "@/lib/utils";

interface Props {
  /** Override the current step shown in the breadcrumb (used by hero/success/picker
   * which may render outside of the regular wizard flow). */
  forceStep?: WizardStep | "picker";
  /** Extra classes for the wrapper. */
  className?: string;
}

function dashboardHrefFor(path: string, isAuthenticated: boolean): {
  href: string;
  label: string;
} {
  if (path.startsWith("/comercial/")) {
    return { href: "/", label: "Dashboard" };
  }
  if (path.startsWith("/montar-campanha")) {
    return { href: isAuthenticated ? "/portal" : "/", label: "Dashboard" };
  }
  return { href: "/", label: "Dashboard" };
}

export function WizardTopBar({ forceStep, className }: Props) {
  const storeStep = useWizardStore((s) => s.step);
  const goTo = useWizardStore((s) => s.goTo);
  const selected = useMediaShopStore((s) => s.selected);
  const quantityItems = useMediaShopStore((s) => s.quantityItems);
  const [location, setLocation] = useLocation();
  const { isAuthenticated } = useAuth();
  const [confirmOpen, setConfirmOpen] = useState(false);

  const effectiveStep = forceStep ?? storeStep;
  const stepLabel =
    effectiveStep === "picker"
      ? "Escolher cliente"
      : STEP_LABELS[effectiveStep as WizardStep] ?? "";

  const dashboard = useMemo(
    () => dashboardHrefFor(location, isAuthenticated),
    [location, isAuthenticated],
  );

  const isFinalized = effectiveStep === "success";
  const hasProgress =
    !isFinalized && (selected.length > 0 || quantityItems.length > 0);

  useEffect(() => {
    if (!hasProgress) return;
    const handler = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = "";
    };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [hasProgress]);

  const goToDashboard = () => {
    setConfirmOpen(false);
    setLocation(dashboard.href);
  };

  const handleDashboardClick = (e?: React.MouseEvent) => {
    e?.preventDefault();
    if (hasProgress) {
      setConfirmOpen(true);
    } else {
      goToDashboard();
    }
  };

  const handleWizardHomeClick = (e: React.MouseEvent) => {
    e.preventDefault();
    if (effectiveStep === "hero" || effectiveStep === "picker") return;
    goTo("hero");
  };

  const isHero = effectiveStep === "hero" || effectiveStep === "picker";

  return (
    <>
      <div
        className={cn(
          "flex flex-wrap items-center gap-x-3 gap-y-2 justify-between",
          className,
        )}
        data-testid="wizard-topbar"
      >
        <Breadcrumb className="min-w-0">
          <BreadcrumbList className="text-chalk-muted text-[11px] sm:text-[12px] tracking-tight gap-1.5 sm:gap-2 flex-nowrap">
            <BreadcrumbItem>
              <BreadcrumbLink
                asChild
                className="hover:text-chalk text-chalk-muted"
              >
                <button
                  type="button"
                  onClick={handleDashboardClick}
                  className="inline-flex items-center gap-1"
                  data-testid="breadcrumb-dashboard"
                >
                  <Home className="w-3.5 h-3.5 shrink-0" />
                  <span className="hidden sm:inline">{dashboard.label}</span>
                </button>
              </BreadcrumbLink>
            </BreadcrumbItem>
            <BreadcrumbSeparator className="text-chalk-dim" />
            <BreadcrumbItem className="min-w-0">
              {isHero ? (
                <BreadcrumbPage className="text-chalk truncate">
                  Montar campanha
                </BreadcrumbPage>
              ) : (
                <BreadcrumbLink
                  asChild
                  className="hover:text-chalk text-chalk-muted"
                >
                  <button
                    type="button"
                    onClick={handleWizardHomeClick}
                    className="truncate"
                    data-testid="breadcrumb-wizard"
                  >
                    Montar campanha
                  </button>
                </BreadcrumbLink>
              )}
            </BreadcrumbItem>
            {!isHero && stepLabel && (
              <>
                <BreadcrumbSeparator className="text-chalk-dim" />
                <BreadcrumbItem className="min-w-0">
                  <BreadcrumbPage
                    className="text-chalk truncate"
                    data-testid="breadcrumb-step"
                  >
                    {stepLabel}
                  </BreadcrumbPage>
                </BreadcrumbItem>
              </>
            )}
          </BreadcrumbList>
        </Breadcrumb>

        <div className="flex items-center gap-2">
          <MesaChip tone="amber" size="xs" data-testid="badge-beta">
            <span className="font-semibold uppercase tracking-[0.16em]">beta</span>
            <span className="hidden sm:inline">testing</span>
          </MesaChip>
          <button
            type="button"
            onClick={handleDashboardClick}
            className="inline-flex items-center gap-1.5 text-[11px] tracking-tight text-chalk-muted hover:text-chalk transition-colors px-2 sm:px-2.5 py-1 rounded-full border border-hairline hover:border-hairline-bold"
            data-testid="button-back-to-dashboard"
            aria-label="Voltar ao dashboard"
          >
            <Home className="w-3 h-3" />
            <span className="hidden sm:inline">voltar ao dashboard</span>
            <span className="sm:hidden">dashboard</span>
          </button>
        </div>
      </div>

      <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Sair do checkout?</AlertDialogTitle>
            <AlertDialogDescription>
              Você tem itens no carrinho que ainda não foram enviados. Se sair agora,
              o progresso atual pode ser perdido.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel data-testid="button-confirm-stay">
              Continuar montando
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={goToDashboard}
              data-testid="button-confirm-leave"
            >
              Sair mesmo assim
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
