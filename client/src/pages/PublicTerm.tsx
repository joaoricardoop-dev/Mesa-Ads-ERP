import { useEffect, useState } from "react";
import { useParams } from "wouter";
import DOMPurify from "dompurify";
import { FileText } from "lucide-react";

interface PublicTermData {
  title: string;
  content: string;
  version: number;
  updatedAt: string;
}

export default function PublicTerm() {
  const { slug } = useParams<{ slug: string }>();
  const [term, setTerm] = useState<PublicTermData | null>(null);
  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");

  useEffect(() => {
    let active = true;
    setStatus("loading");
    fetch(`/api/public-term/${slug}`)
      .then(async (res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return res.json();
      })
      .then((data: PublicTermData) => {
        if (!active) return;
        setTerm(data);
        setStatus("ready");
      })
      .catch(() => {
        if (!active) return;
        setStatus("error");
      });
    return () => {
      active = false;
    };
  }, [slug]);

  return (
    <div className="min-h-screen bg-background text-foreground">
      <div className="mx-auto max-w-3xl px-5 py-10 md:py-16">
        {status === "loading" && (
          <p className="text-center text-muted-foreground py-20">Carregando...</p>
        )}

        {status === "error" && (
          <div className="text-center py-20 space-y-3">
            <FileText className="w-12 h-12 text-muted-foreground/40 mx-auto" />
            <p className="text-muted-foreground">Termo não encontrado ou indisponível.</p>
          </div>
        )}

        {status === "ready" && term && (
          <article className="space-y-6">
            <header className="space-y-2 border-b border-border/40 pb-5">
              <span className="label-mono text-[11px] text-primary">mesa.ads</span>
              <h1 className="font-display text-2xl md:text-3xl font-semibold leading-tight">{term.title}</h1>
              <p className="text-xs text-muted-foreground">
                Versão {term.version} · Atualizado em{" "}
                {new Date(term.updatedAt).toLocaleDateString("pt-BR")}
              </p>
            </header>
            <div
              className="prose prose-sm md:prose-base dark:prose-invert max-w-none"
              dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(term.content) }}
            />
          </article>
        )}
      </div>
    </div>
  );
}
