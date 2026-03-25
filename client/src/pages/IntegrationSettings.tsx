import { useState, useEffect } from "react";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { AlertTriangle, CheckCircle2, ExternalLink, Info, Link2, Loader2, LogOut, RefreshCw, Settings2, Truck, Zap } from "lucide-react";
import { useLocation } from "wouter";

export default function IntegrationSettings() {
  const [, navigate] = useLocation();
  const utils = trpc.useUtils();

  const { data: meStatus, isLoading: meLoading, refetch: refetchMe } = trpc.melhorEnvio.getStatus.useQuery();
  const { data: meAuthData, refetch: refetchAuthUrl } = trpc.melhorEnvio.getAuthUrl.useQuery(undefined, {
    enabled: false,
    retry: false,
  });

  const disconnectMutation = trpc.melhorEnvio.disconnect.useMutation({
    onSuccess: () => {
      toast.success("Melhor Envio desconectado.");
      refetchMe();
    },
    onError: (err) => toast.error(err.message),
  });

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const connected = params.get("me_connected");
    const error = params.get("me_error");
    if (connected === "1") {
      toast.success("Melhor Envio conectado com sucesso!");
      refetchMe();
      navigate("/configuracoes/integracoes", { replace: true });
    }
    if (error) {
      toast.error(`Erro ao conectar Melhor Envio: ${decodeURIComponent(error)}`);
      navigate("/configuracoes/integracoes", { replace: true });
    }
  }, []);

  async function handleConnect() {
    try {
      const result = await refetchAuthUrl();
      if (result.data?.url) {
        window.location.href = result.data.url;
      }
    } catch (err: any) {
      toast.error(err.message || "Erro ao gerar URL de autorização.");
    }
  }

  return (
    <div className="max-w-3xl mx-auto px-4 py-8 space-y-8">
      <div>
        <h1 className="text-xl font-bold flex items-center gap-2">
          <Zap className="w-5 h-5 text-primary" />
          Integrações
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          Conecte o Mesa ADS a serviços externos de logística e frete.
        </p>
      </div>

      <div className="bg-card border border-border/40 rounded-xl p-6 space-y-5">
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-green-500/10 border border-green-500/20 flex items-center justify-center shrink-0">
              <Truck className="w-5 h-5 text-green-400" />
            </div>
            <div>
              <p className="text-sm font-semibold">Melhor Envio</p>
              <p className="text-xs text-muted-foreground">
                Cotação de fretes e rastreamento de encomendas via API oficial.
              </p>
            </div>
          </div>
          {meLoading ? (
            <Loader2 className="w-4 h-4 animate-spin text-muted-foreground mt-1 shrink-0" />
          ) : (
            <div className="shrink-0">
              {meStatus?.connected ? (
                <Badge className="bg-green-500/10 text-green-400 border border-green-500/20 gap-1">
                  <CheckCircle2 className="w-3 h-3" /> Conectado
                </Badge>
              ) : (
                <Badge variant="outline" className="text-muted-foreground gap-1">
                  <AlertTriangle className="w-3 h-3" /> Desconectado
                </Badge>
              )}
            </div>
          )}
        </div>

        {!meStatus?.configured && !meLoading && (
          <div className="rounded-lg bg-amber-500/5 border border-amber-500/20 p-4 space-y-2">
            <p className="text-xs font-semibold text-amber-400 flex items-center gap-1">
              <Info className="w-3.5 h-3.5" /> Configuração necessária
            </p>
            <p className="text-xs text-muted-foreground">
              Para conectar o Melhor Envio, defina as variáveis de ambiente abaixo e reinicie a aplicação:
            </p>
            <div className="font-mono text-xs bg-background/60 rounded p-3 space-y-1 border border-border/30">
              <p className="text-emerald-400">MELHOR_ENVIO_CLIENT_ID=<span className="text-muted-foreground">{"<seu client_id>"}</span></p>
              <p className="text-emerald-400">MELHOR_ENVIO_CLIENT_SECRET=<span className="text-muted-foreground">{"<seu client_secret>"}</span></p>
              <p className="text-emerald-400">MELHOR_ENVIO_SANDBOX=<span className="text-muted-foreground">true</span> <span className="text-muted-foreground"># ou false para produção</span></p>
              <p className="text-emerald-400">MELHOR_ENVIO_APP_NAME=<span className="text-muted-foreground">{"Mesa ADS (seu@email.com)"}</span></p>
            </div>
            <p className="text-xs text-muted-foreground">
              Crie seu aplicativo em:{" "}
              <a
                href={meStatus?.sandbox
                  ? "https://sandbox.melhorenvio.com.br/gerenciar/aplicativos"
                  : "https://melhorenvio.com.br/gerenciar/aplicativos"}
                target="_blank"
                rel="noreferrer"
                className="text-primary underline inline-flex items-center gap-0.5"
              >
                {meStatus?.sandbox ? "Sandbox" : "Painel Melhor Envio"}
                <ExternalLink className="w-3 h-3" />
              </a>{" "}
              e use a URL de callback abaixo ao cadastrar o aplicativo.
            </p>
          </div>
        )}

        {meStatus?.configured && (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3 text-xs">
              <div>
                <p className="text-muted-foreground mb-0.5">Ambiente</p>
                <p className="font-medium">{meStatus.sandbox ? "Sandbox (testes)" : "Produção"}</p>
              </div>
              {meStatus.connected && meStatus.expiresAt && (
                <div>
                  <p className="text-muted-foreground mb-0.5">Token expira em</p>
                  <p className="font-medium">{new Date(meStatus.expiresAt).toLocaleDateString("pt-BR")}</p>
                </div>
              )}
              {meStatus.connected && meStatus.scopes && (
                <div className="col-span-2">
                  <p className="text-muted-foreground mb-0.5">Permissões</p>
                  <div className="flex flex-wrap gap-1">
                    {meStatus.scopes.split(" ").map((s) => (
                      <Badge key={s} variant="outline" className="text-[10px] font-mono">{s}</Badge>
                    ))}
                  </div>
                </div>
              )}
            </div>

            <CallbackUrlBox />

            <div className="flex gap-2 pt-1">
              {meStatus.connected ? (
                <>
                  <Button size="sm" variant="outline" className="gap-1.5 text-xs" onClick={handleConnect}>
                    <RefreshCw className="w-3.5 h-3.5" /> Reconectar
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="gap-1.5 text-xs text-red-400 hover:text-red-300"
                    disabled={disconnectMutation.isPending}
                    onClick={() => disconnectMutation.mutate()}
                  >
                    <LogOut className="w-3.5 h-3.5" /> Desconectar
                  </Button>
                </>
              ) : (
                <Button size="sm" className="gap-1.5 text-xs bg-green-600 hover:bg-green-700" onClick={handleConnect}>
                  <Link2 className="w-3.5 h-3.5" /> Conectar via OAuth
                </Button>
              )}
            </div>
          </div>
        )}
      </div>

      <div className="rounded-xl border border-border/40 bg-card p-6 space-y-3 opacity-50 cursor-not-allowed">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-yellow-500/10 border border-yellow-500/20 flex items-center justify-center shrink-0">
            <Truck className="w-5 h-5 text-yellow-400" />
          </div>
          <div>
            <p className="text-sm font-semibold">Correios (em breve)</p>
            <p className="text-xs text-muted-foreground">Rastreamento via API dos Correios.</p>
          </div>
        </div>
        <Badge variant="outline" className="text-muted-foreground text-xs">Em desenvolvimento</Badge>
      </div>
    </div>
  );
}

function CallbackUrlBox() {
  const [copied, setCopied] = useState(false);
  const { data } = trpc.melhorEnvio.getAuthUrl.useQuery(undefined, { enabled: false, retry: false });

  function getCallbackUrl() {
    const domain = window.location.origin;
    return `${domain}/api/melhor-envio/callback`;
  }

  function copy() {
    navigator.clipboard.writeText(getCallbackUrl()).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }

  return (
    <div className="rounded-lg bg-background/60 border border-border/30 p-3 space-y-1">
      <p className="text-[10px] text-muted-foreground uppercase tracking-wider font-semibold">URL de Callback (registrar no Melhor Envio)</p>
      <div className="flex items-center gap-2">
        <code className="text-xs text-primary flex-1 break-all">{getCallbackUrl()}</code>
        <button
          onClick={copy}
          className="text-[10px] text-muted-foreground hover:text-foreground underline shrink-0"
        >
          {copied ? "Copiado!" : "Copiar"}
        </button>
      </div>
    </div>
  );
}
