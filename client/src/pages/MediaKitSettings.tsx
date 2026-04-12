import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { toast } from "sonner";
import { BookOpen, Upload, Trash2, ExternalLink } from "lucide-react";
import { ObjectUploader } from "@/components/ObjectUploader";

export default function MediaKitSettings() {
  const utils = trpc.useUtils();
  const { data, isLoading } = trpc.mediaKit.getPublicData.useQuery();

  const [uploading, setUploading] = useState(false);

  const updateMutation = trpc.mediaKit.updatePdfUrl.useMutation({
    onSuccess: () => {
      utils.mediaKit.getPublicData.invalidate();
      toast.success("Media Kit atualizado com sucesso");
      setUploading(false);
    },
    onError: (err) => {
      toast.error(err.message);
      setUploading(false);
    },
  });

  function handleRemove() {
    if (!confirm("Remover o PDF atual do Media Kit?")) return;
    updateMutation.mutate({ pdfUrl: null });
  }

  const lastUpdated = data?.updatedAt && data?.pdfUrl
    ? new Date(data.updatedAt).toLocaleDateString("pt-BR", {
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      })
    : null;

  return (
    <div className="p-6 max-w-xl mx-auto space-y-6">
      <div className="flex items-center gap-2">
        <BookOpen className="w-5 h-5 text-primary" />
        <div>
          <h1 className="text-xl font-bold tracking-tight">Media Kit</h1>
          <p className="text-sm text-muted-foreground">
            Suba o PDF que será disponibilizado para anunciantes e parceiros.
          </p>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Arquivo atual</CardTitle>
          {lastUpdated && (
            <CardDescription>Atualizado em {lastUpdated}</CardDescription>
          )}
        </CardHeader>
        <CardContent className="space-y-4">
          {isLoading ? (
            <p className="text-sm text-muted-foreground">Carregando...</p>
          ) : data?.pdfUrl ? (
            <div className="flex items-center gap-3 p-3 rounded-lg border bg-muted/30">
              <BookOpen className="w-5 h-5 text-primary shrink-0" />
              <span className="text-sm flex-1 truncate">Media Kit.pdf</span>
              <Button
                variant="ghost"
                size="icon"
                className="shrink-0"
                asChild
              >
                <a href={data.pdfUrl} target="_blank" rel="noopener noreferrer">
                  <ExternalLink className="w-4 h-4" />
                </a>
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="shrink-0 text-destructive hover:text-destructive"
                onClick={handleRemove}
                disabled={updateMutation.isPending}
              >
                <Trash2 className="w-4 h-4" />
              </Button>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">
              Nenhum PDF cadastrado. Faça o upload abaixo.
            </p>
          )}

          <ObjectUploader
            maxNumberOfFiles={1}
            maxFileSize={20971520}
            onGetUploadParameters={async (file) => {
              const res = await fetch("/api/uploads/request-url", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ name: file.name, size: file.size, contentType: file.type }),
              });
              const result = await res.json();
              return { method: "PUT" as const, url: result.uploadURL };
            }}
            onComplete={(result) => {
              const file = result.successful?.[0];
              if (!file) return;
              const uploadedUrl =
                (file as { uploadURL?: string }).uploadURL ||
                file.response?.uploadURL ||
                "";
              const objectPath = uploadedUrl ? new URL(uploadedUrl).pathname.split("?")[0] : "";
              const servingUrl = objectPath ? `/objects${objectPath}` : "";
              if (servingUrl) {
                setUploading(true);
                updateMutation.mutate({ pdfUrl: servingUrl });
              } else {
                toast.error("Não foi possível obter a URL do arquivo.");
              }
            }}
          >
            <Upload className="w-4 h-4 mr-2" />
            {data?.pdfUrl ? "Substituir PDF" : "Subir PDF"}
          </ObjectUploader>

          <p className="text-xs text-muted-foreground">
            Tamanho máximo: 20 MB. Formato: PDF.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
