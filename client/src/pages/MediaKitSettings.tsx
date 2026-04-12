import { useState, useEffect } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Save, Download, BookOpen, RefreshCcw } from "lucide-react";
import { generateMediaKitPdf } from "@/lib/generate-mediakit-pdf";

export default function MediaKitSettings() {
  const { data, isLoading, refetch } = trpc.mediaKit.getPublicData.useQuery();

  const [tagline, setTagline] = useState("");
  const [intro, setIntro] = useState("");
  const [contactName, setContactName] = useState("");
  const [contactEmail, setContactEmail] = useState("");
  const [contactPhone, setContactPhone] = useState("");
  const [website, setWebsite] = useState("");
  const [footerText, setFooterText] = useState("");

  useEffect(() => {
    if (data?.settings) {
      const s = data.settings;
      setTagline(s.tagline ?? "");
      setIntro(s.intro ?? "");
      setContactName(s.contactName ?? "");
      setContactEmail(s.contactEmail ?? "");
      setContactPhone(s.contactPhone ?? "");
      setWebsite(s.website ?? "");
      setFooterText(s.footerText ?? "");
    }
  }, [data?.settings]);

  const updateMutation = trpc.mediaKit.updateSettings.useMutation({
    onSuccess: () => {
      toast.success("Configurações do Media Kit salvas");
      refetch();
    },
    onError: (err) => toast.error(err.message),
  });

  function handleSave() {
    updateMutation.mutate({
      tagline: tagline || undefined,
      intro: intro || undefined,
      contactName: contactName || undefined,
      contactEmail: contactEmail || undefined,
      contactPhone: contactPhone || undefined,
      website: website || undefined,
      footerText: footerText || undefined,
    });
  }

  function handlePreview() {
    if (!data) return;
    generateMediaKitPdf({
      settings: {
        tagline,
        intro,
        contactName,
        contactEmail,
        contactPhone,
        website,
        footerText,
        updatedAt: data.settings?.updatedAt,
      },
      products: data.products,
    });
  }

  const lastUpdated = data?.settings?.updatedAt
    ? new Date(data.settings.updatedAt).toLocaleDateString("pt-BR", {
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      })
    : null;

  return (
    <div className="p-6 max-w-3xl mx-auto space-y-6">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <BookOpen className="w-5 h-5 text-primary" />
            <h1 className="text-2xl font-bold tracking-tight">Media Kit</h1>
          </div>
          <p className="text-sm text-muted-foreground">
            Configure o conteúdo do Media Kit disponibilizado para anunciantes e parceiros.
          </p>
          {lastUpdated && (
            <p className="text-xs text-muted-foreground mt-1">
              Última atualização: {lastUpdated}
            </p>
          )}
        </div>
        <div className="flex gap-2 flex-wrap">
          <Button variant="outline" className="gap-2" onClick={handlePreview} disabled={isLoading}>
            <Download className="w-4 h-4" />
            Pré-visualizar PDF
          </Button>
          <Button className="gap-2" onClick={handleSave} disabled={updateMutation.isPending}>
            {updateMutation.isPending ? (
              <RefreshCcw className="w-4 h-4 animate-spin" />
            ) : (
              <Save className="w-4 h-4" />
            )}
            Salvar
          </Button>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Capa e Introdução</CardTitle>
          <CardDescription>Texto exibido na capa e na introdução do PDF.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-1.5">
            <Label>Tagline</Label>
            <Input
              value={tagline}
              onChange={(e) => setTagline(e.target.value)}
              placeholder="Ex: Publicidade Que Conecta Marcas a Pessoas"
              maxLength={200}
            />
            <p className="text-xs text-muted-foreground">{tagline.length}/200 caracteres</p>
          </div>
          <div className="space-y-1.5">
            <Label>Texto de introdução</Label>
            <Textarea
              value={intro}
              onChange={(e) => setIntro(e.target.value)}
              placeholder="Descreva brevemente a empresa e os diferenciais da plataforma..."
              rows={4}
            />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Informações de Contato</CardTitle>
          <CardDescription>Exibidas na seção de contato do PDF.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label>Nome do contato</Label>
              <Input
                value={contactName}
                onChange={(e) => setContactName(e.target.value)}
                placeholder="Ex: João Silva"
                maxLength={100}
              />
            </div>
            <div className="space-y-1.5">
              <Label>E-mail</Label>
              <Input
                type="email"
                value={contactEmail}
                onChange={(e) => setContactEmail(e.target.value)}
                placeholder="contato@mesaads.com.br"
                maxLength={100}
              />
            </div>
            <div className="space-y-1.5">
              <Label>Telefone / WhatsApp</Label>
              <Input
                value={contactPhone}
                onChange={(e) => setContactPhone(e.target.value)}
                placeholder="(11) 99999-9999"
                maxLength={50}
              />
            </div>
            <div className="space-y-1.5">
              <Label>Website</Label>
              <Input
                value={website}
                onChange={(e) => setWebsite(e.target.value)}
                placeholder="www.mesaads.com.br"
                maxLength={200}
              />
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Rodapé</CardTitle>
          <CardDescription>Texto exibido no rodapé de todas as páginas.</CardDescription>
        </CardHeader>
        <CardContent>
          <Textarea
            value={footerText}
            onChange={(e) => setFooterText(e.target.value)}
            placeholder="Ex: Mesa ADS — Publicidade em Ambientes Gastronômicos"
            rows={2}
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Produtos incluídos no PDF</CardTitle>
          <CardDescription>
            Todos os produtos ativos são incluídos automaticamente. Gerencie a lista em{" "}
            <a href="/produtos" className="underline text-primary">
              Produtos &amp; Preços
            </a>
            .
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <p className="text-sm text-muted-foreground">Carregando...</p>
          ) : (
            <div className="flex flex-wrap gap-2">
              {(data?.products ?? []).map((p) => (
                <Badge key={p.id} variant="secondary" className="gap-1">
                  {p.name}
                </Badge>
              ))}
              {(data?.products ?? []).length === 0 && (
                <p className="text-sm text-muted-foreground">Nenhum produto ativo encontrado.</p>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
