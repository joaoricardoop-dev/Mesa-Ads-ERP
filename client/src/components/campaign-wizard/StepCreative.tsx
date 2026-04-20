import { useRef, useState } from "react";
import { motion } from "framer-motion";
import { trpc } from "@/lib/trpc";
import { Brush, Upload, Loader2, Trash2, Sparkles, FileText } from "lucide-react";
import { useWizardStore } from "./wizardStore";
import { WizardShell } from "./WizardShell";
import { OrderSummary } from "./OrderSummary";
import { MesaButton } from "./mesa/MesaUI";
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
      eyebrow="06 · arte"
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
          delay={0}
        />
        <ChoiceCard
          active={creative.choice === "agency"}
          icon={<Brush className="w-5 h-5" />}
          title="Quero que a agência crie"
          desc="Conte um pouco sobre a campanha."
          onClick={() => setCreativeChoice("agency")}
          delay={0.06}
        />
      </div>

      {creative.choice === "own" && (
        <div className="rounded-2xl border border-hairline bg-ink-900/50 backdrop-blur-md p-6">
          {creative.fileUrl ? (
            <div className="flex items-center gap-3">
              <div className="size-10 rounded-lg bg-mesa-neon/10 border border-mesa-neon/30 flex items-center justify-center shrink-0">
                <FileText className="w-4 h-4 text-mesa-neon" />
              </div>
              <div className="min-w-0 flex-1">
                <div className="font-medium text-[14px] text-chalk truncate">
                  {creative.fileName ?? "Arquivo"}
                </div>
                <div className="text-[11px] text-chalk-dim truncate">{creative.fileUrl}</div>
              </div>
              <MesaButton
                variant="quiet"
                size="sm"
                onClick={() => setCreativeFile(null, null)}
                iconLeft={<Trash2 className="w-3.5 h-3.5" />}
              >
                remover
              </MesaButton>
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
              <div className="size-12 rounded-full bg-mesa-neon/10 border border-mesa-neon/30 flex items-center justify-center">
                <Sparkles className="w-5 h-5 text-mesa-neon" />
              </div>
              <div className="text-[14px] text-chalk font-medium">
                Selecione o arquivo da arte
              </div>
              <MesaButton
                variant="primary"
                size="md"
                onClick={() => fileRef.current?.click()}
                disabled={isUploading}
                iconLeft={
                  isUploading ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Upload className="w-4 h-4" />
                  )
                }
              >
                {isUploading ? "enviando…" : "escolher arquivo"}
              </MesaButton>
              {uploadError && (
                <div className="text-[12px] text-rose-300">{uploadError}</div>
              )}
            </div>
          )}
          <textarea
            value={creative.briefing}
            onChange={(e) => setBriefing(e.target.value)}
            placeholder="Observações sobre a arte (opcional)…"
            rows={3}
            className="mt-5 w-full rounded-xl bg-ink-950/60 border border-hairline px-4 py-3 text-[13px] text-chalk placeholder:text-chalk-dim outline-none focus:border-mesa-neon/60 focus:ring-2 focus:ring-mesa-neon/20 transition resize-none"
          />
        </div>
      )}

      {creative.choice === "agency" && (
        <div className="rounded-2xl border border-hairline bg-ink-900/50 backdrop-blur-md p-6">
          <label className="block text-[10px] uppercase tracking-[0.22em] text-chalk-dim mb-2">
            briefing para a equipe
          </label>
          <textarea
            value={creative.briefing}
            onChange={(e) => setBriefing(e.target.value)}
            placeholder="Sobre a marca, objetivo, oferta, tom de voz, referências de cores, prazo…"
            rows={6}
            className="w-full rounded-xl bg-ink-950/60 border border-hairline px-4 py-3 text-[13px] text-chalk placeholder:text-chalk-dim outline-none focus:border-mesa-neon/60 focus:ring-2 focus:ring-mesa-neon/20 transition resize-none"
          />
          <div className="mt-2 text-[11px] text-chalk-dim">
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
  delay,
}: {
  active: boolean;
  icon: React.ReactNode;
  title: string;
  desc: string;
  onClick: () => void;
  delay: number;
}) {
  return (
    <motion.button
      type="button"
      onClick={onClick}
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay }}
      whileHover={{ y: -2 }}
      whileTap={{ scale: 0.985 }}
      className={cn(
        "text-left rounded-2xl border p-5 transition-all backdrop-blur-md",
        active
          ? "border-mesa-neon bg-mesa-neon/10 shadow-neon-sm"
          : "border-hairline bg-ink-900/50 hover:border-mesa-neon/40",
      )}
    >
      <div
        className={cn(
          "size-10 rounded-xl flex items-center justify-center mb-3 transition-colors",
          active
            ? "bg-mesa-neon text-ink-950"
            : "bg-white/5 text-chalk-muted border border-hairline",
        )}
      >
        {icon}
      </div>
      <div className="font-display font-semibold text-[16px] tracking-tight text-chalk mb-1">
        {title}
      </div>
      <div className="text-[13px] text-chalk-muted leading-relaxed">{desc}</div>
    </motion.button>
  );
}
