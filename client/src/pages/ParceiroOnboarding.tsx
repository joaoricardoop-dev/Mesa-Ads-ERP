import { useQueryClient } from "@tanstack/react-query";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { Handshake, Check, Loader2 } from "lucide-react";

interface ParceiroOnboardingProps {
  userName: string | null;
  partnerName: string | null;
}

export default function ParceiroOnboarding({ userName, partnerName }: ParceiroOnboardingProps) {
  const queryClient = useQueryClient();

  const completeMutation = trpc.parceiroPortal.completeOnboarding.useMutation({
    onSuccess: () => {
      toast.success("Bem-vindo ao Portal do Parceiro!");
      queryClient.invalidateQueries({ queryKey: ["/api/auth/user"] });
    },
    onError: (err) => {
      toast.error(err.message || "Erro ao finalizar acesso");
    },
  });

  return (
    <div className="min-h-screen w-full flex items-center justify-center" style={{ background: "hsl(0 0% 4%)" }}>
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div
          className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] rounded-full opacity-[0.03]"
          style={{ background: "radial-gradient(circle, #27d803 0%, transparent 70%)" }}
        />
      </div>

      <div className="relative w-full max-w-md px-6 py-12">
        <div className="text-center mb-8">
          <img src="/logo-white.png" alt="mesa.ads" className="h-8 mx-auto mb-6" />
          <div className="flex items-center justify-center mb-4">
            <div className="p-4 rounded-2xl bg-[#27d803]/10">
              <Handshake className="w-10 h-10 text-[#27d803]" />
            </div>
          </div>
          <h1 className="text-2xl font-bold text-white mb-2">
            {userName ? `Olá, ${userName}!` : "Bem-vindo!"}
          </h1>
          <p className="text-sm text-[hsl(0,0%,50%)] leading-relaxed">
            Você foi convidado para o portal de parceiros da mesa.ads.
            {partnerName && (
              <> Você está vinculado à agência <strong className="text-white">{partnerName}</strong>.</>
            )}
          </p>
        </div>

        <div className="bg-[hsl(0,0%,7%)] border border-[hsl(0,0%,14%)] rounded-xl p-6 space-y-4 mb-6">
          <h2 className="text-sm font-semibold text-white">O que você pode fazer no portal:</h2>
          <ul className="space-y-3">
            {[
              "Acompanhar leads e oportunidades indicados",
              "Visualizar cotações geradas para seus clientes",
              "Monitorar faturamento e comissão estimada",
              "Acompanhar campanhas ativas",
            ].map((item, i) => (
              <li key={i} className="flex items-start gap-3 text-sm text-[hsl(0,0%,65%)]">
                <div className="mt-0.5 w-4 h-4 rounded-full bg-[#27d803]/20 flex items-center justify-center flex-shrink-0">
                  <Check className="w-2.5 h-2.5 text-[#27d803]" />
                </div>
                {item}
              </li>
            ))}
          </ul>
        </div>

        <Button
          className="w-full bg-[#27d803] hover:bg-[#22c003] text-black font-semibold h-11"
          onClick={() => completeMutation.mutate({})}
          disabled={completeMutation.isPending}
        >
          {completeMutation.isPending ? (
            <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Acessando...</>
          ) : (
            <><Check className="w-4 h-4 mr-2" /> Acessar Portal do Parceiro</>
          )}
        </Button>

        <p className="text-center mt-6 text-[11px]" style={{ color: "hsl(0 0% 30%)" }}>
          mesa.ads &copy; {new Date().getFullYear()} &mdash; Plataforma de gestão
        </p>
      </div>
    </div>
  );
}
