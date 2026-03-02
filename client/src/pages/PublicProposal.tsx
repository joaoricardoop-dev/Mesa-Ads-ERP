import { useState, useRef, useEffect } from "react";
import { trpc } from "@/lib/trpc";
import { useParams } from "wouter";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import {
  Building2,
  FileText,
  MapPin,
  Package,
  Calendar,
  DollarSign,
  CheckCircle2,
  AlertTriangle,
  Eraser,
  Send,
  UtensilsCrossed,
  Clock,
  Pen,
} from "lucide-react";

function formatCurrency(value: string | number | null | undefined): string {
  if (!value) return "R$ 0,00";
  const num = typeof value === "string" ? parseFloat(value) : value;
  return num.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function formatDate(dateStr: string | null | undefined): string {
  if (!dateStr) return "—";
  const d = new Date(dateStr);
  return d.toLocaleDateString("pt-BR");
}

function SignatureCanvas({
  onSignatureChange,
  disabled,
}: {
  onSignatureChange: (data: string | null) => void;
  disabled?: boolean;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [hasContent, setHasContent] = useState(false);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const rect = canvas.getBoundingClientRect();
    canvas.width = rect.width * 2;
    canvas.height = rect.height * 2;
    ctx.scale(2, 2);
    ctx.strokeStyle = "#27d803";
    ctx.lineWidth = 2.5;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
  }, []);

  function getPos(e: React.MouseEvent | React.TouchEvent) {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    const rect = canvas.getBoundingClientRect();
    if ("touches" in e) {
      return {
        x: e.touches[0].clientX - rect.left,
        y: e.touches[0].clientY - rect.top,
      };
    }
    return { x: e.clientX - rect.left, y: e.clientY - rect.top };
  }

  function startDrawing(e: React.MouseEvent | React.TouchEvent) {
    if (disabled) return;
    e.preventDefault();
    const ctx = canvasRef.current?.getContext("2d");
    if (!ctx) return;
    const pos = getPos(e);
    ctx.beginPath();
    ctx.moveTo(pos.x, pos.y);
    setIsDrawing(true);
  }

  function draw(e: React.MouseEvent | React.TouchEvent) {
    if (!isDrawing || disabled) return;
    e.preventDefault();
    const ctx = canvasRef.current?.getContext("2d");
    if (!ctx) return;
    const pos = getPos(e);
    ctx.lineTo(pos.x, pos.y);
    ctx.stroke();
    setHasContent(true);
  }

  function stopDrawing() {
    if (!isDrawing) return;
    setIsDrawing(false);
    if (hasContent && canvasRef.current) {
      onSignatureChange(canvasRef.current.toDataURL("image/png"));
    }
  }

  function clear() {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    setHasContent(false);
    onSignatureChange(null);
  }

  return (
    <div className="space-y-2">
      <div className="relative border-2 border-dashed border-[hsl(0,0%,20%)] rounded-lg overflow-hidden bg-[hsl(0,0%,5%)]">
        <canvas
          ref={canvasRef}
          className="w-full cursor-crosshair touch-none"
          style={{ height: 160 }}
          onMouseDown={startDrawing}
          onMouseMove={draw}
          onMouseUp={stopDrawing}
          onMouseLeave={stopDrawing}
          onTouchStart={startDrawing}
          onTouchMove={draw}
          onTouchEnd={stopDrawing}
        />
        {!hasContent && !disabled && (
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <p className="text-[hsl(0,0%,25%)] text-sm flex items-center gap-2">
              <Pen className="w-4 h-4" />
              Desenhe sua assinatura aqui
            </p>
          </div>
        )}
      </div>
      {!disabled && (
        <Button
          variant="ghost"
          size="sm"
          className="text-xs text-[hsl(0,0%,50%)] hover:text-white"
          onClick={clear}
          disabled={!hasContent}
        >
          <Eraser className="w-3.5 h-3.5 mr-1" />
          Limpar
        </Button>
      )}
    </div>
  );
}

function InfoCard({ icon: Icon, label, value, className }: { icon: any; label: string; value: string | React.ReactNode; className?: string }) {
  return (
    <div className={`bg-[hsl(0,0%,7%)] border border-[hsl(0,0%,14%)] rounded-lg p-4 ${className || ""}`}>
      <div className="flex items-center gap-2 mb-1.5">
        <Icon className="w-3.5 h-3.5 text-[hsl(0,0%,40%)]" />
        <p className="text-[11px] text-[hsl(0,0%,40%)] uppercase tracking-wider font-medium">{label}</p>
      </div>
      <div className="text-sm font-medium text-[hsl(0,0%,90%)]">{value}</div>
    </div>
  );
}

export default function PublicProposal() {
  const params = useParams<{ token: string }>();
  const token = params.token || "";

  const { data: proposal, isLoading, isError } = trpc.quotation.getPublicProposal.useQuery(
    { token },
    { enabled: !!token, retry: false }
  );

  const [signerName, setSignerName] = useState("");
  const [signatureData, setSignatureData] = useState<string | null>(null);

  const signMutation = trpc.quotation.signProposal.useMutation({
    onSuccess: () => {
      toast.success("Proposta aprovada com sucesso!");
      window.location.reload();
    },
    onError: (err) => toast.error(err.message),
  });

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: "hsl(0 0% 4%)" }}>
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-2 border-[#27d803] border-t-transparent rounded-full animate-spin" />
          <p className="text-sm text-[hsl(0,0%,50%)]">Carregando proposta...</p>
        </div>
      </div>
    );
  }

  if (isError || !proposal) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: "hsl(0 0% 4%)" }}>
        <div className="text-center max-w-md px-6">
          <img src="/logo-white.png" alt="mesa.ads" className="h-8 mx-auto mb-6" />
          <AlertTriangle className="w-12 h-12 text-amber-400 mx-auto mb-4" />
          <h2 className="text-lg font-bold text-[hsl(0,0%,90%)] mb-2">Proposta não encontrada</h2>
          <p className="text-sm text-[hsl(0,0%,50%)]">
            O link pode estar incorreto ou a proposta não está mais disponível.
          </p>
        </div>
      </div>
    );
  }

  const isSigned = !!proposal.signedAt;
  const isExpiredOrLost = proposal.status === "perdida" || proposal.status === "expirada";
  const isValidUntilPassed = proposal.validUntil && new Date(proposal.validUntil) < new Date();
  const canSign = !isSigned && !isExpiredOrLost && !isValidUntilPassed;

  const statusMap: Record<string, { label: string; color: string }> = {
    rascunho: { label: "Rascunho", color: "bg-gray-500/20 text-gray-400 border-gray-500/30" },
    enviada: { label: "Enviada", color: "bg-blue-500/20 text-blue-400 border-blue-500/30" },
    ativa: { label: "Aprovada", color: "bg-green-500/20 text-green-400 border-green-500/30" },
    os_gerada: { label: "OS Gerada", color: "bg-cyan-500/20 text-cyan-400 border-cyan-500/30" },
    win: { label: "Convertida", color: "bg-emerald-500/20 text-emerald-400 border-emerald-500/30" },
    perdida: { label: "Perdida", color: "bg-red-500/20 text-red-400 border-red-500/30" },
    expirada: { label: "Expirada", color: "bg-amber-500/20 text-amber-400 border-amber-500/30" },
  };
  const statusInfo = statusMap[proposal.status] || statusMap.enviada;

  const campaignTypes: Record<string, string> = {
    padrao: "Padrão",
    exclusiva: "Exclusiva",
    compartilhada: "Compartilhada",
  };

  return (
    <div className="min-h-screen" style={{ background: "hsl(0 0% 4%)" }}>
      <div className="max-w-3xl mx-auto px-4 py-8 sm:px-6 sm:py-12">
        <div className="flex items-center justify-between mb-8">
          <img src="/logo-white.png" alt="mesa.ads" className="h-8" />
          <Badge variant="outline" className={`text-xs ${statusInfo.color}`}>
            {statusInfo.label}
          </Badge>
        </div>

        <div className="bg-[hsl(0,0%,7%)] border border-[hsl(0,0%,14%)] rounded-2xl p-6 sm:p-8 mb-6">
          <div className="flex items-start justify-between mb-1">
            <div>
              <p className="text-[11px] text-[hsl(0,0%,40%)] uppercase tracking-wider mb-1">Proposta Comercial</p>
              <h1 className="text-xl sm:text-2xl font-bold text-[hsl(0,0%,95%)]">
                {proposal.quotationNumber}
              </h1>
            </div>
          </div>
          {proposal.quotationName && (
            <p className="text-sm text-[hsl(0,0%,50%)] mt-2">{proposal.quotationName}</p>
          )}
          <p className="text-[11px] text-[hsl(0,0%,30%)] mt-3">
            Emitida em {formatDate(proposal.createdAt)}
            {proposal.validUntil && ` · Válida até ${formatDate(proposal.validUntil)}`}
          </p>
        </div>

        {proposal.client && (
          <div className="bg-[hsl(0,0%,7%)] border border-[hsl(0,0%,14%)] rounded-2xl p-6 sm:p-8 mb-6">
            <h2 className="text-sm font-semibold text-[hsl(0,0%,90%)] flex items-center gap-2 mb-4">
              <Building2 className="w-4 h-4 text-[#27d803]" />
              Dados do Anunciante
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <InfoCard icon={Building2} label="Empresa" value={proposal.client.company || proposal.client.name} />
              {proposal.client.cnpj && (
                <InfoCard icon={FileText} label="CNPJ" value={proposal.client.cnpj} />
              )}
              {proposal.client.contactEmail && (
                <InfoCard icon={FileText} label="E-mail" value={proposal.client.contactEmail} />
              )}
              {proposal.client.contactPhone && (
                <InfoCard icon={FileText} label="Telefone" value={proposal.client.contactPhone} />
              )}
            </div>
          </div>
        )}

        <div className="bg-[hsl(0,0%,7%)] border border-[hsl(0,0%,14%)] rounded-2xl p-6 sm:p-8 mb-6">
          <h2 className="text-sm font-semibold text-[hsl(0,0%,90%)] flex items-center gap-2 mb-4">
            <Package className="w-4 h-4 text-[#27d803]" />
            Detalhes da Proposta
          </h2>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            <InfoCard icon={Package} label="Volume Total" value={`${(proposal.coasterVolume || 0).toLocaleString("pt-BR")} bolachas`} />
            <InfoCard icon={FileText} label="Tipo" value={campaignTypes[proposal.campaignType || "padrao"] || proposal.campaignType || "Padrão"} />
            <InfoCard icon={Calendar} label="Ciclos" value={`${proposal.cycles || 1} ciclo${(proposal.cycles || 1) > 1 ? "s" : ""}`} />
            <InfoCard icon={DollarSign} label="Preço Unitário" value={formatCurrency(proposal.unitPrice)} />
            <InfoCard icon={DollarSign} label="Valor Total" value={
              <span className="text-[#27d803] font-bold text-base">{formatCurrency(proposal.totalValue)}</span>
            } />
            <InfoCard icon={Package} label="Produção" value={proposal.includesProduction ? "Inclusa" : "Não inclusa"} />
            {proposal.validUntil && (
              <InfoCard icon={Clock} label="Validade" value={formatDate(proposal.validUntil)} className={isValidUntilPassed ? "border-amber-500/30" : ""} />
            )}
          </div>
        </div>

        {proposal.restaurants.length > 0 && (
          <div className="bg-[hsl(0,0%,7%)] border border-[hsl(0,0%,14%)] rounded-2xl p-6 sm:p-8 mb-6">
            <h2 className="text-sm font-semibold text-[hsl(0,0%,90%)] flex items-center gap-2 mb-4">
              <UtensilsCrossed className="w-4 h-4 text-[#27d803]" />
              Restaurantes Parceiros
              <Badge variant="secondary" className="text-[10px] ml-1">{proposal.restaurants.length}</Badge>
            </h2>
            <div className="border border-[hsl(0,0%,14%)] rounded-lg overflow-hidden">
              <div className="grid grid-cols-[1fr_100px_80px] gap-3 px-4 py-2.5 bg-[hsl(0,0%,5%)] border-b border-[hsl(0,0%,14%)]">
                <p className="text-[10px] text-[hsl(0,0%,40%)] uppercase tracking-wider font-semibold">Restaurante</p>
                <p className="text-[10px] text-[hsl(0,0%,40%)] uppercase tracking-wider font-semibold text-right">Bolachas</p>
                <p className="text-[10px] text-[hsl(0,0%,40%)] uppercase tracking-wider font-semibold text-right">Comissão</p>
              </div>
              {proposal.restaurants.map((r, i) => (
                <div key={r.id || i} className="grid grid-cols-[1fr_100px_80px] gap-3 px-4 py-3 border-b border-[hsl(0,0%,10%)] last:border-0">
                  <div>
                    <p className="text-sm text-[hsl(0,0%,90%)]">{r.name}</p>
                    {(r.neighborhood || r.city) && (
                      <p className="text-[11px] text-[hsl(0,0%,40%)] flex items-center gap-1 mt-0.5">
                        <MapPin className="w-3 h-3" />
                        {[r.neighborhood, r.city].filter(Boolean).join(", ")}
                      </p>
                    )}
                  </div>
                  <p className="text-sm text-[hsl(0,0%,70%)] text-right font-mono">
                    {(r.coasterQuantity || 0).toLocaleString("pt-BR")}
                  </p>
                  <p className="text-sm text-[hsl(0,0%,70%)] text-right font-mono">
                    {r.commissionPercent || "20"}%
                  </p>
                </div>
              ))}
            </div>
          </div>
        )}

        {proposal.notes && (
          <div className="bg-[hsl(0,0%,7%)] border border-[hsl(0,0%,14%)] rounded-2xl p-6 sm:p-8 mb-6">
            <h2 className="text-sm font-semibold text-[hsl(0,0%,90%)] flex items-center gap-2 mb-3">
              <FileText className="w-4 h-4 text-[#27d803]" />
              Observações
            </h2>
            <p className="text-sm text-[hsl(0,0%,60%)] whitespace-pre-wrap leading-relaxed">{proposal.notes}</p>
          </div>
        )}

        <div className="bg-[hsl(0,0%,7%)] border border-[hsl(0,0%,14%)] rounded-2xl p-6 sm:p-8 mb-6">
          {isSigned ? (
            <div>
              <div className="flex items-center gap-3 mb-5">
                <div className="w-10 h-10 rounded-full bg-green-500/10 flex items-center justify-center">
                  <CheckCircle2 className="w-5 h-5 text-green-400" />
                </div>
                <div>
                  <h2 className="text-sm font-semibold text-green-400">Proposta Aprovada</h2>
                  <p className="text-[11px] text-[hsl(0,0%,50%)]">
                    Assinada por <span className="text-[hsl(0,0%,70%)] font-medium">{proposal.signedBy}</span> em {formatDate(proposal.signedAt)}
                  </p>
                </div>
              </div>
              {proposal.signatureData && (
                <div className="border border-[hsl(0,0%,14%)] rounded-lg p-4 bg-[hsl(0,0%,5%)]">
                  <p className="text-[10px] text-[hsl(0,0%,30%)] uppercase tracking-wider mb-2">Assinatura</p>
                  <img src={proposal.signatureData} alt="Assinatura" className="max-h-24 mx-auto" />
                </div>
              )}
            </div>
          ) : isExpiredOrLost || isValidUntilPassed ? (
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-amber-500/10 flex items-center justify-center">
                <AlertTriangle className="w-5 h-5 text-amber-400" />
              </div>
              <div>
                <h2 className="text-sm font-semibold text-amber-400">Proposta indisponível</h2>
                <p className="text-[11px] text-[hsl(0,0%,50%)]">
                  {isValidUntilPassed
                    ? "O prazo de validade desta proposta expirou."
                    : "Esta proposta não está mais disponível para aprovação."}
                </p>
              </div>
            </div>
          ) : (
            <div>
              <h2 className="text-sm font-semibold text-[hsl(0,0%,90%)] flex items-center gap-2 mb-5">
                <Pen className="w-4 h-4 text-[#27d803]" />
                Aprovação e Assinatura
              </h2>
              <div className="space-y-4">
                <div>
                  <label className="text-xs text-[hsl(0,0%,50%)] block mb-1.5">Nome completo do responsável *</label>
                  <Input
                    value={signerName}
                    onChange={(e) => setSignerName(e.target.value)}
                    placeholder="Digite seu nome completo"
                    className="bg-[hsl(0,0%,5%)] border-[hsl(0,0%,18%)] text-[hsl(0,0%,90%)] placeholder:text-[hsl(0,0%,25%)]"
                  />
                </div>
                <div>
                  <label className="text-xs text-[hsl(0,0%,50%)] block mb-1.5">Assinatura *</label>
                  <SignatureCanvas onSignatureChange={setSignatureData} />
                </div>
                <Button
                  className="w-full bg-[#27d803] hover:bg-[#22c003] text-black font-semibold py-5"
                  onClick={() => {
                    if (!signerName.trim()) {
                      toast.error("Informe seu nome completo.");
                      return;
                    }
                    if (!signatureData) {
                      toast.error("Desenhe sua assinatura.");
                      return;
                    }
                    signMutation.mutate({
                      token,
                      signedBy: signerName.trim(),
                      signatureData,
                    });
                  }}
                  disabled={signMutation.isPending}
                >
                  <Send className="w-4 h-4 mr-2" />
                  {signMutation.isPending ? "Enviando..." : "Aprovar Proposta"}
                </Button>
                <p className="text-[10px] text-[hsl(0,0%,30%)] text-center">
                  Ao aprovar, você concorda com os termos descritos nesta proposta comercial.
                </p>
              </div>
            </div>
          )}
        </div>

        <p className="text-center text-[11px] text-[hsl(0,0%,25%)] mt-8">
          mesa.ads &copy; {new Date().getFullYear()} &mdash; Plataforma de gestão
        </p>
      </div>
    </div>
  );
}
