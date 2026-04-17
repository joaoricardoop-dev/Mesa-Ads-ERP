import { useRef, useState } from "react";
import { trpc } from "@/lib/trpc";
import { Brush, Upload, Loader2, Trash2, Sparkles, FileText } from "lucide-react";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { useWizardStore } from "./wizardStore";
import { WizardShell } from "./WizardShell";
import { OrderSummary } from "./OrderSummary";
import { useUpload } from "@/hooks/use-upload";
import { cn } from "@/lib/utils";
import type { ProductLite, PricingTier, DiscountTier } from "./pricing";

interface Props {
  clientLabel: string | null;
  hasPartner: boolean;
}

export function StepCreative({ clientLabel, hasPartner }: Props) {
  const productId = useWizardStore((s) => s.productId);
  const venueIds = useWizardStore((s) => s.venueIds);
  const creative = useWizardStore((s) => s.creative);
  const setCreativeChoice = useWizardStore((s) => s.setCreativeChoice);
  const setCreativeFile = useWizardStore((s) => s.setCreativeFile);
  const setBriefing = useWizardStore((s) => s.setBriefing);
  const next = useWizardStore((s) => s.next);
  const fileRef = useRef<HTMLInputElement>(null);

  const { data: product } = trpc.product.get.useQuery(
    { id: productId ?? 0 },
    { enabled: !!productId },
  );
  const { data: tiers = [] } = trpc.product.getTiers.useQuery(
    { productId: productId ?? 0 },
    { enabled: !!productId },
  );
  const { data: discountTiers = [] } = trpc.product.listDiscountTiers.useQuery(
    { productId: productId ?? 0 },
    { enabled: !!productId },
  );

  const { uploadFile, isUploading } = useUpload();
  const [uploadError, setUploadError] = useState<string | null>(null);

  const handleFile = async (file: File) => {
    setUploadError(null);
    const res = await uploadFile(file);
    if (res?.objectPath) {
      setCreativeFile(res.objectPath, file.name);
    } else if (res?.uploadURL) {
      setCreativeFile(res.uploadURL.split("?")[0], file.name);
    } else {
      setUploadError("Falha no upload. Tente novamente.");
    }
  };

  const valid =
    (creative.choice === "own" && creative.fileUrl) ||
    (creative.choice === "agency" && creative.briefing.trim().length >= 10);

  return (
    <WizardShell
      title="E a arte da campanha?"
      subtitle="Você pode enviar a arte pronta ou pedir para nossa equipe criar."
      onNext={next}
      nextDisabled={!valid}
      summary={
        <OrderSummary
          product={product as ProductLite | null}
          tiers={tiers as PricingTier[]}
          discountTiers={discountTiers as DiscountTier[]}
          hasPartner={hasPartner}
          venueCount={venueIds.length}
          clientLabel={clientLabel}
        />
      }
    >
      <div className="grid sm:grid-cols-2 gap-3 mb-6">
        <ChoiceCard
          active={creative.choice === "own"}
          icon={<Upload className="w-5 h-5" />}
          title="Tenho a arte pronta"
          desc="Envie um arquivo PDF, JPG ou PNG."
          onClick={() => setCreativeChoice("own")}
        />
        <ChoiceCard
          active={creative.choice === "agency"}
          icon={<Brush className="w-5 h-5" />}
          title="Quero que a agência crie"
          desc="Conte um pouco sobre a campanha."
          onClick={() => setCreativeChoice("agency")}
        />
      </div>

      {creative.choice === "own" && (
        <div className="rounded-xl border border-border/40 bg-card/40 p-5">
          {creative.fileUrl ? (
            <div className="flex items-center gap-3">
              <FileText className="w-5 h-5 text-primary shrink-0" />
              <div className="min-w-0 flex-1">
                <div className="font-medium text-sm truncate">{creative.fileName ?? "Arquivo"}</div>
                <div className="text-[11px] text-muted-foreground truncate">{creative.fileUrl}</div>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setCreativeFile(null, null)}
                className="gap-1.5 text-destructive hover:text-destructive"
              >
                <Trash2 className="w-3.5 h-3.5" /> Remover
              </Button>
            </div>
          ) : (
            <div className="flex flex-col items-center gap-3 py-6 text-center">
              <input
                ref={fileRef}
                type="file"
                hidden
                accept="image/*,application/pdf"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) handleFile(f);
                }}
              />
              <Sparkles className="w-6 h-6 text-primary" />
              <div className="text-sm font-medium">Selecione o arquivo da arte</div>
              <Button onClick={() => fileRef.current?.click()} disabled={isUploading} className="gap-2">
                {isUploading ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" /> Enviando...
                  </>
                ) : (
                  <>
                    <Upload className="w-4 h-4" /> Escolher arquivo
                  </>
                )}
              </Button>
              {uploadError && <div className="text-xs text-destructive">{uploadError}</div>}
            </div>
          )}
          <Textarea
            value={creative.briefing}
            onChange={(e) => setBriefing(e.target.value)}
            placeholder="Observações sobre a arte (opcional)..."
            className="mt-4"
            rows={3}
          />
        </div>
      )}

      {creative.choice === "agency" && (
        <div className="rounded-xl border border-border/40 bg-card/40 p-5">
          <label className="text-sm font-medium block mb-2">Conte sobre a campanha</label>
          <Textarea
            value={creative.briefing}
            onChange={(e) => setBriefing(e.target.value)}
            placeholder="Sobre a marca, objetivo, oferta, tom de voz, referências de cores, prazo..."
            rows={6}
          />
          <div className="mt-2 text-[11px] text-muted-foreground">
            Mínimo 10 caracteres. Quanto mais detalhes, melhor.
          </div>
        </div>
      )}
    </WizardShell>
  );
}

function ChoiceCard({
  active,
  icon,
  title,
  desc,
  onClick,
}: {
  active: boolean;
  icon: React.ReactNode;
  title: string;
  desc: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "text-left rounded-xl border p-5 transition-all",
        active ? "border-primary bg-primary/5" : "border-border/40 hover:border-border bg-card/40",
      )}
    >
      <div
        className={cn(
          "size-10 rounded-lg flex items-center justify-center mb-3",
          active ? "bg-primary/15 text-primary" : "bg-muted text-muted-foreground",
        )}
      >
        {icon}
      </div>
      <div className="font-semibold mb-1">{title}</div>
      <div className="text-sm text-muted-foreground">{desc}</div>
    </button>
  );
}
