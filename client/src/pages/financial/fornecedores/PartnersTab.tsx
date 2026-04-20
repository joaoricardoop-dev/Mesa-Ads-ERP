import { useLocation } from "wouter";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Handshake, ExternalLink } from "lucide-react";

export default function PartnersTab() {
  const [, navigate] = useLocation();
  const { data: partners = [], isLoading } = trpc.partner.list.useQuery();

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          Parceiros comerciais que vendem produtos Mesa Ads e recebem comissão. A gestão completa permanece em Comercial &gt; Parceiros.
        </p>
        <Button onClick={() => navigate("/comercial/parceiros")} variant="outline">
          <ExternalLink className="w-4 h-4 mr-2" /> Gerenciar Parceiros
        </Button>
      </div>

      {isLoading ? (
        <p className="text-muted-foreground text-sm">Carregando…</p>
      ) : partners.length === 0 ? (
        <div className="border border-dashed border-border rounded-lg p-12 text-center">
          <Handshake className="w-12 h-12 text-muted-foreground mx-auto mb-3" />
          <p className="text-muted-foreground">Nenhum parceiro cadastrado.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {partners.map((p) => (
            <div
              key={p.id}
              className="border border-border rounded-lg p-4 flex items-center justify-between hover:bg-accent/5 cursor-pointer"
              onClick={() => navigate("/comercial/parceiros")}
            >
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <h3 className="font-semibold">{p.name}</h3>
                  {p.company && (
                    <span className="text-sm text-muted-foreground">— {p.company}</span>
                  )}
                  <Badge
                    variant="outline"
                    className={
                      p.status === "active"
                        ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/30"
                        : "bg-muted/20 text-muted-foreground"
                    }
                  >
                    {p.status === "active" ? "Ativo" : "Inativo"}
                  </Badge>
                </div>
                <div className="text-xs text-muted-foreground flex flex-wrap gap-x-4 gap-y-1">
                  {p.cnpj && <span>CNPJ {p.cnpj}</span>}
                  {p.contactEmail && <span>✉️ {p.contactEmail}</span>}
                  {p.contactPhone && <span>📞 {p.contactPhone}</span>}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
