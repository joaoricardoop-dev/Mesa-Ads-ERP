import { useState } from "react";
import PageContainer from "@/components/PageContainer";
import { trpc } from "@/lib/trpc";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Megaphone, ChevronLeft, FileBarChart, Cookie, FileVideo } from "lucide-react";

const REPORT_LABELS: Record<string, string> = {
  relatoria_diaria_telas: "Relatoria diária — Telas",
  relatoria_semanal_telas: "Relatoria semanal — Telas",
  relatorio_semanal_bolachas: "Relatório semanal — Bolachas",
  relatorio_semanal_interno: "Relatório semanal — Interno",
  relatoria_mensal_telas: "Relatoria mensal — Telas",
  relatorio_mensal_geral: "Relatório mensal — Geral",
};

function CampaignDetail({ campaignId, name, onBack }: { campaignId: number; name: string; onBack: () => void }) {
  const { data, isLoading } = trpc.backoffice.campaigns.detail.useQuery({ campaignId });

  return (
    <PageContainer
      title={name}
      description="Relatórios gerados, consumo semanal de bolachas e material por local."
      actions={<Button size="sm" variant="outline" onClick={onBack}><ChevronLeft className="w-4 h-4 mr-1" />Voltar</Button>}
    >
      {isLoading || !data ? (
        <p className="text-sm text-muted-foreground py-8 text-center">Carregando...</p>
      ) : (
        <Tabs defaultValue="relatorios">
          <TabsList>
            <TabsTrigger value="relatorios"><FileBarChart className="w-3.5 h-3.5 mr-1.5" />Relatórios ({data.reports.length})</TabsTrigger>
            <TabsTrigger value="consumo"><Cookie className="w-3.5 h-3.5 mr-1.5" />Consumo semanal</TabsTrigger>
            <TabsTrigger value="material"><FileVideo className="w-3.5 h-3.5 mr-1.5" />Material ({data.materials.length})</TabsTrigger>
          </TabsList>

          <TabsContent value="relatorios">
            <div className="rounded-lg border border-border/30 overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Enviado em</TableHead>
                    <TableHead>Tipo</TableHead>
                    <TableHead>Referência</TableHead>
                    <TableHead>Destinatário</TableHead>
                    <TableHead>Link</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.reports.length === 0 ? (
                    <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground py-8">Nenhum relatório registrado para esta campanha. Registre em Relatórios escolhendo a campanha.</TableCell></TableRow>
                  ) : (
                    data.reports.map((r: any) => (
                      <TableRow key={r.id}>
                        <TableCell className="text-xs">{r.sentAt}</TableCell>
                        <TableCell className="text-xs">{REPORT_LABELS[r.reportType] || r.reportType}</TableCell>
                        <TableCell className="text-sm">{r.referenceLabel}</TableCell>
                        <TableCell className="text-xs text-muted-foreground">{r.recipientLabel || "—"}</TableCell>
                        <TableCell className="text-xs">{r.linkUrl ? <a href={r.linkUrl} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">abrir</a> : "—"}</TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
          </TabsContent>

          <TabsContent value="consumo" className="space-y-3">
            <div className="rounded-lg border border-border/30 overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Semana (segunda)</TableHead>
                    <TableHead className="text-right">Entregue/Reposto</TableHead>
                    <TableHead className="text-right">Retirado</TableHead>
                    <TableHead className="text-right">Contado</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.weeklyConsumption.length === 0 ? (
                    <TableRow><TableCell colSpan={4} className="text-center text-muted-foreground py-8">Sem movimentos ou contagens vinculados. Vincule pedidos de produção e contagens semanais a esta campanha.</TableCell></TableRow>
                  ) : (
                    data.weeklyConsumption.map((w: any) => (
                      <TableRow key={w.weekOf}>
                        <TableCell className="text-xs">{w.weekOf}</TableCell>
                        <TableCell className="text-right font-mono text-xs text-emerald-400">{w.delivered || "—"}</TableCell>
                        <TableCell className="text-right font-mono text-xs text-amber-400">{w.withdrawn || "—"}</TableCell>
                        <TableCell className="text-right font-mono text-xs">{w.counted ?? "—"}</TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
            <p className="text-[11px] text-muted-foreground">Entregas/retiradas vêm dos movimentos ligados aos pedidos de produção da campanha; "Contado" vem das contagens semanais vinculadas.</p>
          </TabsContent>

          <TabsContent value="material">
            <div className="rounded-lg border border-border/30 overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Restaurante</TableHead>
                    <TableHead>Material?</TableHead>
                    <TableHead>Recebido em</TableHead>
                    <TableHead>Anexo</TableHead>
                    <TableHead>Relatoria</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.materials.length === 0 ? (
                    <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground py-8">Nenhum material registrado para esta campanha.</TableCell></TableRow>
                  ) : (
                    data.materials.map((m: any) => (
                      <TableRow key={m.id}>
                        <TableCell className="text-sm">{m.restaurantName || "—"}</TableCell>
                        <TableCell>{m.materialReceived ? <Badge variant="outline" className="text-emerald-400 border-emerald-500/30">Sim</Badge> : <Badge variant="outline" className="text-amber-400 border-amber-500/30">Não</Badge>}</TableCell>
                        <TableCell className="text-xs">{m.materialReceivedAt || "—"}</TableCell>
                        <TableCell className="text-xs">{m.attachmentUrl ? <a href={m.attachmentUrl} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">{m.attachmentName || "arquivo"}</a> : "—"}</TableCell>
                        <TableCell className="text-xs capitalize">{m.reportingFrequency || "—"}</TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
          </TabsContent>
        </Tabs>
      )}
    </PageContainer>
  );
}

export default function BackofficeCampaigns() {
  const { data: list = [], isLoading } = trpc.backoffice.campaigns.list.useQuery();
  const [selected, setSelected] = useState<{ id: number; name: string } | null>(null);

  if (selected) {
    return <CampaignDetail campaignId={selected.id} name={selected.name} onBack={() => setSelected(null)} />;
  }

  return (
    <PageContainer title="Campanhas" description="Visão operacional por campanha: relatórios gerados e consumo semanal de bolachas.">
      <div className="rounded-lg border border-border/30 overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Campanha</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Produções</TableHead>
              <TableHead className="text-right">Material</TableHead>
              <TableHead className="text-right">Relatórios</TableHead>
              <TableHead className="text-right">Contagens</TableHead>
              <TableHead></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow><TableCell colSpan={7} className="text-center text-muted-foreground py-8">Carregando...</TableCell></TableRow>
            ) : list.length === 0 ? (
              <TableRow><TableCell colSpan={7} className="text-center text-muted-foreground py-8">
                <Megaphone className="w-6 h-6 mx-auto mb-2 opacity-40" /> Nenhuma campanha em acompanhamento.
              </TableCell></TableRow>
            ) : (
              list.map((c: any) => (
                <TableRow key={c.id} data-testid={`bo-campaign-row-${c.id}`}>
                  <TableCell className="font-medium text-sm">{c.name}</TableCell>
                  <TableCell className="text-xs text-muted-foreground">{c.status || "—"}</TableCell>
                  <TableCell className="text-right font-mono text-xs">{c.productionOrders}</TableCell>
                  <TableCell className="text-right font-mono text-xs">{c.materialsReceived}/{c.materialsTotal}</TableCell>
                  <TableCell className="text-right font-mono text-xs">{c.reportsCount}</TableCell>
                  <TableCell className="text-right font-mono text-xs">{c.stockCountsCount}</TableCell>
                  <TableCell>
                    <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={() => setSelected({ id: c.id, name: c.name })}>Detalhes</Button>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </PageContainer>
  );
}
