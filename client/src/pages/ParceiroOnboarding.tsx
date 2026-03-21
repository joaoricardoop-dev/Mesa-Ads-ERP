import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Handshake, Check, Loader2, User, Phone, Mail } from "lucide-react";

interface ParceiroOnboardingProps {
  userName: string | null;
  userEmail: string | null;
  userLastName: string | null;
  partnerName: string | null;
}

export default function ParceiroOnboarding({ userName, userEmail, userLastName, partnerName }: ParceiroOnboardingProps) {
  const queryClient = useQueryClient();
  const [form, setForm] = useState({
    firstName: userName || "",
    lastName: userLastName || "",
    contactEmail: userEmail || "",
    contactPhone: "",
  });

  const completeMutation = trpc.parceiroPortal.completeOnboarding.useMutation({
    onSuccess: () => {
      toast.success("Bem-vindo ao Portal do Parceiro!");
      queryClient.invalidateQueries({ queryKey: ["/api/auth/user"] });
    },
    onError: (err) => {
      toast.error(err.message || "Erro ao finalizar acesso");
    },
  });

  function handleSubmit() {
    const contactName = [form.firstName.trim(), form.lastName.trim()].filter(Boolean).join(" ");
    completeMutation.mutate({
      contactName: contactName || undefined,
      contactPhone: form.contactPhone.trim() || undefined,
      contactEmail: form.contactEmail.trim() || undefined,
    });
  }

  return (
    <div className="min-h-screen w-full flex items-center justify-center" style={{ background: "hsl(0 0% 4%)" }}>
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div
          className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] rounded-full opacity-[0.03]"
          style={{ background: "radial-gradient(circle, #27d803 0%, transparent 70%)" }}
        />
      </div>

      <div className="relative w-full max-w-md px-6 py-10">
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
          <p className="text-sm leading-relaxed" style={{ color: "hsl(0 0% 50%)" }}>
            Você foi convidado para o Portal do Parceiro da mesa.ads.
            {partnerName && (
              <> Confirme seus dados de contato para ativar seu acesso como <strong className="text-white">{partnerName}</strong>.</>
            )}
          </p>
        </div>

        <div className="bg-[hsl(0,0%,7%)] border border-[hsl(0,0%,14%)] rounded-xl p-6 space-y-4 mb-6">
          <h2 className="text-sm font-semibold text-white mb-2">Confirme seus dados de contato</h2>

          <div className="grid grid-cols-2 gap-3">
            <div className="grid gap-1.5">
              <Label className="text-xs text-[hsl(0,0%,60%)]">Nome</Label>
              <div className="relative">
                <User className="absolute left-2.5 top-2.5 w-3.5 h-3.5 text-[hsl(0,0%,40%)]" />
                <Input
                  value={form.firstName}
                  onChange={(e) => setForm({ ...form, firstName: e.target.value })}
                  placeholder="Nome"
                  className="pl-8 h-9 text-sm bg-[hsl(0,0%,10%)] border-[hsl(0,0%,18%)] text-white placeholder:text-[hsl(0,0%,35%)]"
                />
              </div>
            </div>
            <div className="grid gap-1.5">
              <Label className="text-xs text-[hsl(0,0%,60%)]">Sobrenome</Label>
              <Input
                value={form.lastName}
                onChange={(e) => setForm({ ...form, lastName: e.target.value })}
                placeholder="Sobrenome"
                className="h-9 text-sm bg-[hsl(0,0%,10%)] border-[hsl(0,0%,18%)] text-white placeholder:text-[hsl(0,0%,35%)]"
              />
            </div>
          </div>

          <div className="grid gap-1.5">
            <Label className="text-xs text-[hsl(0,0%,60%)]">E-mail</Label>
            <div className="relative">
              <Mail className="absolute left-2.5 top-2.5 w-3.5 h-3.5 text-[hsl(0,0%,40%)]" />
              <Input
                type="email"
                value={form.contactEmail}
                onChange={(e) => setForm({ ...form, contactEmail: e.target.value })}
                placeholder="seu@email.com"
                className="pl-8 h-9 text-sm bg-[hsl(0,0%,10%)] border-[hsl(0,0%,18%)] text-white placeholder:text-[hsl(0,0%,35%)]"
              />
            </div>
          </div>

          <div className="grid gap-1.5">
            <Label className="text-xs text-[hsl(0,0%,60%)]">WhatsApp / Telefone</Label>
            <div className="relative">
              <Phone className="absolute left-2.5 top-2.5 w-3.5 h-3.5 text-[hsl(0,0%,40%)]" />
              <Input
                value={form.contactPhone}
                onChange={(e) => setForm({ ...form, contactPhone: e.target.value })}
                placeholder="(11) 99999-9999"
                className="pl-8 h-9 text-sm bg-[hsl(0,0%,10%)] border-[hsl(0,0%,18%)] text-white placeholder:text-[hsl(0,0%,35%)]"
              />
            </div>
          </div>
        </div>

        <Button
          className="w-full bg-[#27d803] hover:bg-[#22c003] text-black font-semibold h-11"
          onClick={handleSubmit}
          disabled={completeMutation.isPending}
        >
          {completeMutation.isPending ? (
            <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Ativando acesso...</>
          ) : (
            <><Check className="w-4 h-4 mr-2" /> Confirmar e Acessar Portal</>
          )}
        </Button>

        <p className="text-center mt-6 text-[11px]" style={{ color: "hsl(0 0% 30%)" }}>
          mesa.ads &copy; {new Date().getFullYear()} &mdash; Plataforma de gestão
        </p>
      </div>
    </div>
  );
}
