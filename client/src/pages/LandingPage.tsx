import { Button } from "@/components/ui/button";
import { Megaphone, BarChart3, Store, Shield, ArrowRight } from "lucide-react";

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-background flex flex-col">
      <header className="border-b border-border/30 bg-card/80 backdrop-blur-md">
        <div className="flex items-center justify-between px-6 h-14 max-w-7xl mx-auto w-full">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-primary/20 flex items-center justify-center">
              <Megaphone className="w-3.5 h-3.5 text-primary" />
            </div>
            <div>
              <h1 className="text-sm font-bold tracking-tight">Mesa Ads</h1>
              <p className="text-[10px] text-muted-foreground">Plataforma de Gestão</p>
            </div>
          </div>
          <Button asChild className="gap-2">
            <a href="/api/login">
              Entrar com Google
              <ArrowRight className="w-4 h-4" />
            </a>
          </Button>
        </div>
      </header>

      <main className="flex-1 flex items-center justify-center px-6">
        <div className="max-w-4xl w-full text-center space-y-12 py-20">
          <div className="space-y-4">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary/10 border border-primary/20 text-primary text-xs font-medium">
              <Megaphone className="w-3.5 h-3.5" />
              Plataforma de mídia offline
            </div>
            <h2 className="text-4xl md:text-5xl font-bold tracking-tight leading-tight">
              Gestão completa de<br />
              <span className="text-primary">campanhas em bolachas de chopp</span>
            </h2>
            <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
              Simule cenários financeiros, gerencie restaurantes parceiros,
              controle cotações e acompanhe a rentabilidade de cada campanha em tempo real.
            </p>
          </div>

          <div className="flex justify-center">
            <Button asChild size="lg" className="gap-2 text-base px-8 h-12">
              <a href="/api/login">
                Entrar com Google
                <ArrowRight className="w-5 h-5" />
              </a>
            </Button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 pt-8">
            <div className="bg-card border border-border/30 rounded-xl p-6 text-left space-y-3">
              <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                <BarChart3 className="w-5 h-5 text-primary" />
              </div>
              <h3 className="font-semibold">Simulador Financeiro</h3>
              <p className="text-sm text-muted-foreground">
                Precificação com grossup, análise de margem e cenários comparativos para maximizar a rentabilidade.
              </p>
            </div>
            <div className="bg-card border border-border/30 rounded-xl p-6 text-left space-y-3">
              <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                <Store className="w-5 h-5 text-primary" />
              </div>
              <h3 className="font-semibold">Gestão de Restaurantes</h3>
              <p className="text-sm text-muted-foreground">
                Pipeline de prospecção, perfis completos, galeria de fotos e controle de distribuição.
              </p>
            </div>
            <div className="bg-card border border-border/30 rounded-xl p-6 text-left space-y-3">
              <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                <Shield className="w-5 h-5 text-primary" />
              </div>
              <h3 className="font-semibold">Controle de Campanhas</h3>
              <p className="text-sm text-muted-foreground">
                Fluxo de cotação → aprovação → ativação com histórico completo e auditoria.
              </p>
            </div>
          </div>
        </div>
      </main>

      <footer className="border-t border-border/30 px-6 py-4">
        <p className="text-center text-xs text-muted-foreground">
          Mesa Ads © {new Date().getFullYear()} · Todos os direitos reservados
        </p>
      </footer>
    </div>
  );
}
