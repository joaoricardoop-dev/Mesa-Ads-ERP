import { useState, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { formatCurrency } from "@/lib/format";
import { DollarSign, Percent, Package, Truck, Palette, Calculator, CreditCard, Clock, TrendingUp, Info } from "lucide-react";
import PageContainer from "@/components/PageContainer";
import Section from "@/components/Section";

const PREMISSAS = {
  irpj: 0.06,
  comissaoRestaurante: 0.15,
  comissaoComercial: 0.10,
  somaFixa: 0.40,
};

const DESCONTOS_SEMANAS = [
  { semanas: 4, multiplicador: 1, desconto: 0 },
  { semanas: 8, multiplicador: 2, desconto: 0.05 },
  { semanas: 12, multiplicador: 3, desconto: 0.08 },
  { semanas: 16, multiplicador: 4, desconto: 0.10 },
];

const FORMAS_PAGAMENTO = [
  { id: "pix", label: "À Vista (Pix/Dinheiro)", ajuste: -0.05 },
  { id: "credito_1x", label: "Cartão de Crédito (1x)", ajuste: 0 },
  { id: "credito_3x", label: "Cartão de Crédito (3x)", ajuste: 0.03 },
  { id: "credito_6x", label: "Cartão de Crédito (6x)", ajuste: 0.06 },
];

export default function PriceTable() {
  const [volume, setVolume] = useState(1000);
  const [custoGPC, setCustoGPC] = useState(0.18);
  const [margem, setMargem] = useState(0.15);
  const [frete, setFrete] = useState(350);
  const [artes, setArtes] = useState(1.0);
  const [formaPagamento, setFormaPagamento] = useState("credito_1x");
  const [semanaSelecionada, setSemanaSelecionada] = useState(0);

  const calc = useMemo(() => {
    const denominador = 1 - margem - PREMISSAS.irpj - PREMISSAS.comissaoRestaurante - PREMISSAS.comissaoComercial - PREMISSAS.somaFixa;
    const custoProdTotal = custoGPC * artes * volume;
    const custoTotal = custoProdTotal + frete;
    const precoTotalBase = denominador > 0 ? custoTotal / denominador : 0;
    const precoUnitario = volume > 0 ? precoTotalBase / volume : 0;
    const lucro = precoTotalBase * margem;

    const precosPorSemana = DESCONTOS_SEMANAS.map((d) => {
      const precoSemDesconto = precoTotalBase * d.multiplicador;
      const precoComDesconto = precoSemDesconto * (1 - d.desconto);
      return {
        ...d,
        precoSemDesconto,
        precoComDesconto,
        economia: precoSemDesconto - precoComDesconto,
      };
    });

    const pagamento = FORMAS_PAGAMENTO.find((f) => f.id === formaPagamento)!;
    const precoFinalPorSemana = precosPorSemana.map((p) => ({
      ...p,
      precoFinal: p.precoComDesconto * (1 + pagamento.ajuste),
    }));

    return {
      denominador,
      custoProdTotal,
      custoTotal,
      precoTotalBase,
      precoUnitario,
      lucro,
      precosPorSemana: precoFinalPorSemana,
      pagamento,
    };
  }, [volume, custoGPC, margem, frete, artes, formaPagamento]);

  const denominadorValido = calc.denominador > 0;

  return (
    <PageContainer title="Tabela de Preços">
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="lg:col-span-1 space-y-4">
          <Section title="Variáveis de Entrada" icon={Package}>
            <div className="space-y-3">
              <div className="space-y-1.5">
                <Label className="text-xs flex items-center gap-1.5"><Package className="w-3 h-3" /> Volume (A)</Label>
                <Input type="number" min={1} step={100} value={volume} onChange={(e) => setVolume(Math.max(1, parseInt(e.target.value) || 1))} className="bg-background border-border/30 h-9 text-sm font-mono" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs flex items-center gap-1.5"><DollarSign className="w-3 h-3" /> Custo GPC Unitário (B)</Label>
                <Input type="number" min={0} step={0.01} value={custoGPC} onChange={(e) => setCustoGPC(Math.max(0, parseFloat(e.target.value) || 0))} className="bg-background border-border/30 h-9 text-sm font-mono" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs flex items-center gap-1.5"><Percent className="w-3 h-3" /> Margem (C)</Label>
                <Input type="number" min={0} max={0.99} step={0.01} value={margem} onChange={(e) => setMargem(Math.min(0.99, Math.max(0, parseFloat(e.target.value) || 0)))} className="bg-background border-border/30 h-9 text-sm font-mono" />
                <p className="text-[10px] text-muted-foreground">{(margem * 100).toFixed(0)}% de margem</p>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs flex items-center gap-1.5"><Truck className="w-3 h-3" /> Frete Azul Cargo (D)</Label>
                <Input type="number" min={0} step={10} value={frete} onChange={(e) => setFrete(Math.max(0, parseFloat(e.target.value) || 0))} className="bg-background border-border/30 h-9 text-sm font-mono" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs flex items-center gap-1.5"><Palette className="w-3 h-3" /> Artes (E)</Label>
                <Input type="number" min={0.1} step={0.1} value={artes} onChange={(e) => setArtes(Math.max(0.1, parseFloat(e.target.value) || 1))} className="bg-background border-border/30 h-9 text-sm font-mono" />
              </div>
            </div>
          </Section>

          <Section title="Premissas Fixas" icon={Info}>
            <div className="space-y-2">
              {[
                { label: "IRPJ", value: PREMISSAS.irpj },
                { label: "Comissão Restaurante", value: PREMISSAS.comissaoRestaurante },
                { label: "Comissão Comercial", value: PREMISSAS.comissaoComercial },
                { label: "Soma Fixa", value: PREMISSAS.somaFixa },
              ].map((p) => (
                <div key={p.label} className="flex items-center justify-between text-xs">
                  <span className="text-muted-foreground">{p.label}</span>
                  <span className="font-mono font-medium">{(p.value * 100).toFixed(0)}%</span>
                </div>
              ))}
              <div className="border-t border-border/20 pt-2 flex items-center justify-between text-xs">
                <span className="text-muted-foreground font-medium">Total Deduções</span>
                <span className="font-mono font-semibold">{((PREMISSAS.irpj + PREMISSAS.comissaoRestaurante + PREMISSAS.comissaoComercial + PREMISSAS.somaFixa) * 100).toFixed(0)}%</span>
              </div>
            </div>
          </Section>

          <Section title="Forma de Pagamento" icon={CreditCard}>
            <Select value={formaPagamento} onValueChange={setFormaPagamento}>
              <SelectTrigger className="bg-background border-border/30 h-9 text-sm">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {FORMAS_PAGAMENTO.map((f) => (
                  <SelectItem key={f.id} value={f.id}>
                    {f.label} {f.ajuste !== 0 && `(${f.ajuste > 0 ? "+" : ""}${(f.ajuste * 100).toFixed(0)}%)`}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Section>
        </div>

        <div className="lg:col-span-2 space-y-4">
          {!denominadorValido && (
            <div className="bg-destructive/10 border border-destructive/30 rounded-lg p-4 text-sm text-destructive flex items-center gap-2">
              <Info className="w-4 h-4 flex-shrink-0" />
              A margem é alta demais. A soma da margem + deduções fixas excede 100%, tornando o cálculo inválido. Reduza a margem para continuar.
            </div>
          )}

          <Section title="Cálculos Intermediários" icon={Calculator}>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              <KpiMini label="Denominador (F)" value={calc.denominador.toFixed(4)} warn={!denominadorValido} />
              <KpiMini label="Custo Prod Total (G)" value={formatCurrency(calc.custoProdTotal)} />
              <KpiMini label="Custo Total (H)" value={formatCurrency(calc.custoTotal)} />
              <KpiMini label="Preço Unitário (I)" value={formatCurrency(calc.precoUnitario)} accent />
              <KpiMini label="Preço Total Base 4sem (J)" value={formatCurrency(calc.precoTotalBase)} accent />
              <KpiMini label="Lucro (N)" value={formatCurrency(calc.lucro)} accent />
            </div>
          </Section>

          <Section title="Descontos Progressivos por Duração" icon={Clock}>
            <div className="overflow-x-auto">
              <table className="w-full text-sm min-w-[500px]">
                <thead>
                  <tr className="border-b border-border/20">
                    <th className="text-left p-3 text-xs text-muted-foreground font-medium">Duração</th>
                    <th className="text-right p-3 text-xs text-muted-foreground font-medium">Preço s/ Desconto</th>
                    <th className="text-center p-3 text-xs text-muted-foreground font-medium">Desconto</th>
                    <th className="text-right p-3 text-xs text-muted-foreground font-medium">Preço c/ Desconto</th>
                    <th className="text-right p-3 text-xs text-muted-foreground font-medium">Economia</th>
                    <th className="text-right p-3 text-xs text-muted-foreground font-medium">Preço Final</th>
                  </tr>
                </thead>
                <tbody>
                  {calc.precosPorSemana.map((p, i) => (
                    <tr
                      key={p.semanas}
                      className={`border-b border-border/10 cursor-pointer transition-colors ${semanaSelecionada === i ? "bg-primary/10" : "hover:bg-muted/20"}`}
                      onClick={() => setSemanaSelecionada(i)}
                    >
                      <td className="p-3 font-medium">{p.semanas} semanas</td>
                      <td className="p-3 text-right font-mono text-muted-foreground">{formatCurrency(p.precoSemDesconto)}</td>
                      <td className="p-3 text-center">
                        {p.desconto > 0 ? (
                          <span className="text-emerald-400 font-mono text-xs font-semibold">-{(p.desconto * 100).toFixed(0)}%</span>
                        ) : (
                          <span className="text-muted-foreground text-xs">—</span>
                        )}
                      </td>
                      <td className="p-3 text-right font-mono">{formatCurrency(p.precoComDesconto)}</td>
                      <td className="p-3 text-right font-mono text-emerald-400">{p.economia > 0 ? formatCurrency(p.economia) : "—"}</td>
                      <td className="p-3 text-right font-mono font-semibold text-primary">{formatCurrency(p.precoFinal)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Section>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <Card className="border-primary/30 bg-primary/5">
              <CardHeader className="pb-1 pt-3 px-4">
                <CardTitle className="text-[10px] uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                  <DollarSign className="w-3 h-3" /> Preço Final
                </CardTitle>
              </CardHeader>
              <CardContent className="px-4 pb-3">
                <p className="text-xl font-bold font-mono text-primary">
                  {formatCurrency(calc.precosPorSemana[semanaSelecionada]?.precoFinal ?? 0)}
                </p>
                <p className="text-[10px] text-muted-foreground mt-0.5">
                  {calc.precosPorSemana[semanaSelecionada]?.semanas} semanas • {calc.pagamento.label}
                </p>
              </CardContent>
            </Card>
            <Card className="border-border/30">
              <CardHeader className="pb-1 pt-3 px-4">
                <CardTitle className="text-[10px] uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                  <TrendingUp className="w-3 h-3" /> Preço Unitário
                </CardTitle>
              </CardHeader>
              <CardContent className="px-4 pb-3">
                <p className="text-xl font-bold font-mono">
                  {formatCurrency(calc.precoUnitario)}
                </p>
                <p className="text-[10px] text-muted-foreground mt-0.5">por bolacha (base 4 semanas)</p>
              </CardContent>
            </Card>
            <Card className="border-emerald-500/30 bg-emerald-500/5">
              <CardHeader className="pb-1 pt-3 px-4">
                <CardTitle className="text-[10px] uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                  <Percent className="w-3 h-3" /> Lucro Estimado
                </CardTitle>
              </CardHeader>
              <CardContent className="px-4 pb-3">
                <p className="text-xl font-bold font-mono text-emerald-400">
                  {formatCurrency(calc.lucro)}
                </p>
                <p className="text-[10px] text-muted-foreground mt-0.5">{(margem * 100).toFixed(0)}% de margem (base 4 sem)</p>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </PageContainer>
  );
}

function KpiMini({ label, value, accent, warn }: { label: string; value: string; accent?: boolean; warn?: boolean }) {
  return (
    <div className="bg-card border border-border/30 rounded-lg p-3">
      <p className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1">{label}</p>
      <p className={`text-sm font-bold font-mono ${warn ? "text-destructive" : accent ? "text-primary" : ""}`}>{value}</p>
    </div>
  );
}
