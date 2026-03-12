import { useState, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Slider } from "@/components/ui/slider";
import { formatCurrency } from "@/lib/format";
import { DollarSign, Percent, Package, Calculator, CreditCard, Clock, TrendingUp, Info, TrendingDown, BarChart3, PieChart } from "lucide-react";
import PageContainer from "@/components/PageContainer";
import Section from "@/components/Section";

const CUSTOS_VOLUME: Record<number, { custoGPC: number; margem: number; frete: number; artes: number }> = {
  1000:  { custoGPC: 0.4190, margem: 0.50, frete: 80.38,   artes: 1 },
  2000:  { custoGPC: 0.3495, margem: 0.50, frete: 138.16,  artes: 1 },
  3000:  { custoGPC: 0.3330, margem: 0.50, frete: 219.03,  artes: 1 },
  4000:  { custoGPC: 0.3248, margem: 0.50, frete: 299.41,  artes: 1 },
  5000:  { custoGPC: 0.2998, margem: 0.50, frete: 357.19,  artes: 1 },
  6000:  { custoGPC: 0.2998, margem: 0.50, frete: 438.06,  artes: 1 },
  7000:  { custoGPC: 0.2998, margem: 0.50, frete: 518.44,  artes: 1 },
  8000:  { custoGPC: 0.2998, margem: 0.50, frete: 576.22,  artes: 1 },
  9000:  { custoGPC: 0.2998, margem: 0.50, frete: 657.09,  artes: 1 },
  10000: { custoGPC: 0.2700, margem: 0.50, frete: 737.47,  artes: 1 },
  11000: { custoGPC: 0.2700, margem: 0.50, frete: 876.12,  artes: 1 },
  12000: { custoGPC: 0.2700, margem: 0.50, frete: 956.50,  artes: 1 },
  13000: { custoGPC: 0.2700, margem: 0.50, frete: 1094.66, artes: 1 },
  14000: { custoGPC: 0.2700, margem: 0.50, frete: 1175.53, artes: 1 },
  15000: { custoGPC: 0.2700, margem: 0.50, frete: 1255.91, artes: 1 },
  16000: { custoGPC: 0.2700, margem: 0.50, frete: 1313.69, artes: 1 },
  17000: { custoGPC: 0.2700, margem: 0.50, frete: 1394.56, artes: 1 },
  18000: { custoGPC: 0.2700, margem: 0.50, frete: 1474.94, artes: 1 },
  19000: { custoGPC: 0.2700, margem: 0.50, frete: 1532.72, artes: 1 },
  20000: { custoGPC: 0.2600, margem: 0.50, frete: 1613.59, artes: 1 },
};

const VOLUMES = Object.keys(CUSTOS_VOLUME).map(Number);

const PREMISSAS = {
  irpj: 0.06,
  comissaoRestaurante: 0.15,
  comissaoComercial: 0.10,
};

const DESCONTOS_SEMANAS: { semanas: number; desconto: number }[] = [
  { semanas: 4,  desconto: 0.00 },
  { semanas: 8,  desconto: 0.03 },
  { semanas: 12, desconto: 0.05 },
  { semanas: 16, desconto: 0.07 },
  { semanas: 20, desconto: 0.09 },
  { semanas: 24, desconto: 0.11 },
  { semanas: 28, desconto: 0.13 },
  { semanas: 32, desconto: 0.15 },
  { semanas: 36, desconto: 0.17 },
  { semanas: 40, desconto: 0.19 },
  { semanas: 44, desconto: 0.21 },
  { semanas: 48, desconto: 0.23 },
  { semanas: 52, desconto: 0.25 },
];

const FORMAS_PAGAMENTO = [
  { id: "pix",    label: "Pix",    ajuste: -0.05 },
  { id: "boleto", label: "Boleto", ajuste: 0 },
  { id: "cartao", label: "Cartão", ajuste: 0 },
];

export default function PriceTable() {
  const [volumeIdx, setVolumeIdx] = useState(0);
  const [semanaIdx, setSemanaIdx] = useState(0);
  const [formaPagamento, setFormaPagamento] = useState("boleto");

  const volume = VOLUMES[volumeIdx];
  const dados = CUSTOS_VOLUME[volume];
  const semanaInfo = DESCONTOS_SEMANAS[semanaIdx];
  const pagamento = FORMAS_PAGAMENTO.find((f) => f.id === formaPagamento)!;

  const calc = useMemo(() => {
    const totalDeducoesPerc = PREMISSAS.irpj + PREMISSAS.comissaoRestaurante + PREMISSAS.comissaoComercial;
    const denominador = 1 - dados.margem - totalDeducoesPerc;

    const custoProducao = dados.custoGPC * dados.artes * volume;
    const custoTotal4sem = custoProducao + dados.frete;

    const precoTotalBase4sem = denominador > 0 ? custoTotal4sem / denominador : 0;
    const precoUnit4sem = volume > 0 ? precoTotalBase4sem / volume : 0;

    const precoUnit1000 = (() => {
      const d = CUSTOS_VOLUME[1000];
      const ct = d.custoGPC * d.artes * 1000 + d.frete;
      const den = 1 - d.margem - totalDeducoesPerc;
      return den > 0 ? ct / den / 1000 : 0;
    })();
    const descontoQuantidade = precoUnit1000 > 0 && volume > 1000 ? 1 - (precoUnit4sem / precoUnit1000) : 0;

    const nPeriodos = semanaInfo.semanas / 4;
    const precoSemDesconto = precoTotalBase4sem * nPeriodos;
    const precoComDescDuracao = precoSemDesconto * (1 - semanaInfo.desconto);
    const precoFinal = precoComDescDuracao * (1 - (pagamento.ajuste < 0 ? Math.abs(pagamento.ajuste) : -pagamento.ajuste));

    const precoUnitComDesc = volume > 0 ? precoFinal / volume : 0;
    const descCombinado = precoUnit1000 > 0 ? 1 - (precoUnitComDesc / precoUnit1000) : 0;

    const custoTotalPeriodo = custoTotal4sem * nPeriodos;

    const valorIRPJ = precoFinal * PREMISSAS.irpj;
    const valorComRest = precoFinal * PREMISSAS.comissaoRestaurante;
    const valorComCom = precoFinal * PREMISSAS.comissaoComercial;
    const totalDeducoesValor = valorIRPJ + valorComRest + valorComCom;
    const receitaLiquida = precoFinal - totalDeducoesValor;
    const lucroBruto = receitaLiquida - custoTotalPeriodo;
    const margemLiquida = precoFinal > 0 ? lucroBruto / precoFinal : 0;
    const margemSobreReceita = dados.margem;
    const lucroPorUnidade = volume > 0 ? lucroBruto / volume : 0;
    const custoPorUnidade = volume > 0 ? custoTotal4sem / volume : 0;

    const decomposicaoUnit = [
      { label: "Custo GPC", valor: dados.custoGPC, perc: precoUnit4sem > 0 ? dados.custoGPC / precoUnit4sem : 0 },
      { label: "Frete/un.", valor: volume > 0 ? dados.frete / volume : 0, perc: precoUnit4sem > 0 ? (dados.frete / volume) / precoUnit4sem : 0 },
      { label: "IRPJ", valor: precoUnit4sem * PREMISSAS.irpj, perc: PREMISSAS.irpj },
      { label: "Com. Restaurante", valor: precoUnit4sem * PREMISSAS.comissaoRestaurante, perc: PREMISSAS.comissaoRestaurante },
      { label: "Com. Comercial", valor: precoUnit4sem * PREMISSAS.comissaoComercial, perc: PREMISSAS.comissaoComercial },
      { label: "Margem / Lucro", valor: precoUnit4sem * dados.margem, perc: margemLiquida > 0 ? margemLiquida : dados.margem },
    ];

    const tabela = DESCONTOS_SEMANAS.map((s) => {
      const mult = s.semanas / 4;
      const pSemDesc = precoTotalBase4sem * mult;
      const pComDesc = pSemDesc * (1 - s.desconto);
      const pFinal = pComDesc * (1 - (pagamento.ajuste < 0 ? Math.abs(pagamento.ajuste) : -pagamento.ajuste));
      return {
        semanas: s.semanas,
        desconto: s.desconto,
        precoSemDesconto: pSemDesc,
        precoComDesconto: pComDesc,
        economia: pSemDesc - pComDesc,
        precoFinal: pFinal,
      };
    });

    return {
      totalDeducoesPerc,
      denominador,
      custoProducao,
      custoTotal4sem,
      custoTotalPeriodo,
      precoTotalBase4sem,
      precoUnit4sem,
      precoUnit1000,
      descontoQuantidade,
      nPeriodos,
      precoSemDesconto,
      precoComDescDuracao,
      precoFinal,
      precoUnitComDesc,
      descCombinado,
      valorIRPJ,
      valorComRest,
      valorComCom,
      totalDeducoesValor,
      receitaLiquida,
      lucroBruto,
      margemLiquida,
      margemSobreReceita,
      lucroPorUnidade,
      custoPorUnidade,
      decomposicaoUnit,
      tabela,
    };
  }, [volume, dados, semanaInfo, pagamento]);

  return (
    <PageContainer title="Tabela de Preços — Simulador VEXA">
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="lg:col-span-1 space-y-4">
          <Section title="Inputs" icon={Package}>
            <div className="space-y-5">
              <div className="space-y-2">
                <Label className="text-xs flex items-center justify-between">
                  <span className="flex items-center gap-1.5"><Package className="w-3 h-3" /> Quantidade (un.)</span>
                  <span className="font-mono font-bold text-primary">{volume.toLocaleString("pt-BR")}</span>
                </Label>
                <Slider min={0} max={VOLUMES.length - 1} step={1} value={[volumeIdx]} onValueChange={([v]) => setVolumeIdx(v)} />
                <div className="flex justify-between text-[10px] text-muted-foreground font-mono">
                  <span>1.000</span><span>20.000</span>
                </div>
              </div>
              <div className="space-y-2">
                <Label className="text-xs flex items-center justify-between">
                  <span className="flex items-center gap-1.5"><Clock className="w-3 h-3" /> Semanas</span>
                  <span className="font-mono font-bold text-primary">{semanaInfo.semanas}</span>
                </Label>
                <Slider min={0} max={DESCONTOS_SEMANAS.length - 1} step={1} value={[semanaIdx]} onValueChange={([v]) => setSemanaIdx(v)} />
                <div className="flex justify-between text-[10px] text-muted-foreground font-mono">
                  <span>4</span><span>52</span>
                </div>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs flex items-center gap-1.5"><CreditCard className="w-3 h-3" /> Pagamento</Label>
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
              </div>
            </div>
          </Section>

          <Section title="Custos" icon={Calculator}>
            <div className="space-y-2">
              <EconRow label="Custo GPC Unitário" value={`R$ ${dados.custoGPC.toFixed(4)}`} />
              <EconRow label="Custo Produção Total" value={formatCurrency(calc.custoProducao)} />
              <EconRow label="Frete" value={formatCurrency(dados.frete)} />
              <EconRow label="Custo Total (Prod+Frete)" value={formatCurrency(calc.custoTotal4sem)} bold />
            </div>
          </Section>

          <Section title="Preço Sem Desconto" icon={DollarSign}>
            <div className="space-y-2">
              <EconRow label="Margem Alvo" value={`${(dados.margem * 100).toFixed(0)}%`} />
              <EconRow label="Denominador" value={calc.denominador.toFixed(4)} />
              <EconRow label="Preço Unit. (4 sem, s/ desc.)" value={formatCurrency(calc.precoUnit4sem)} bold />
              <EconRow label="Preço Total (4 sem, s/ desc.)" value={formatCurrency(calc.precoTotalBase4sem)} bold />
            </div>
          </Section>

          <Section title="Descontos" icon={TrendingDown}>
            <div className="space-y-2">
              <EconRow label="Desc. por Prazo" value={semanaInfo.desconto > 0 ? `${(semanaInfo.desconto * 100).toFixed(0)}%` : "—"} accent={semanaInfo.desconto > 0} />
              <EconRow label="Desc. por Quantidade" value={calc.descontoQuantidade > 0 ? `${(calc.descontoQuantidade * 100).toFixed(1)}%` : "—"} accent={calc.descontoQuantidade > 0} />
              <EconRow label="Desc. Forma Pagamento" value={pagamento.ajuste !== 0 ? `${Math.abs(pagamento.ajuste * 100).toFixed(0)}%` : "—"} accent={pagamento.ajuste < 0} />
              <EconRow label="Desc. Combinado (vs base 1k/4sem)" value={calc.descCombinado > 0 ? `${(calc.descCombinado * 100).toFixed(1)}%` : "—"} accent={calc.descCombinado > 0} />
              <div className="border-t border-border/20 pt-2" />
              <EconRow label={`Nº Períodos (×4 sem)`} value={`${calc.nPeriodos}`} />
              <EconRow label="Preço Total c/ Descontos" value={formatCurrency(calc.precoFinal)} bold />
              <EconRow label="Preço Unit. c/ Descontos" value={formatCurrency(calc.precoUnitComDesc)} bold />
            </div>
          </Section>
        </div>

        <div className="lg:col-span-2 space-y-4">
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            <KpiCard label="Preço Total" value={formatCurrency(calc.precoFinal)} sub={`${semanaInfo.semanas} sem • ${pagamento.label}`} variant="primary" icon={DollarSign} />
            <KpiCard label="Preço Unitário" value={formatCurrency(calc.precoUnitComDesc)} sub="por bolacha c/ descontos" icon={TrendingUp} />
            <KpiCard label="Desconto Total" value={calc.descCombinado > 0 ? `${(calc.descCombinado * 100).toFixed(1)}%` : "—"} sub="vs base 1k / 4 sem" variant="discount" icon={TrendingDown} />
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            <KpiCard label="Lucro Bruto" value={formatCurrency(calc.lucroBruto)} sub={`rec. líquida − custo total`} variant="success" icon={Percent} />
            <KpiCard label="Margem Líquida" value={`${(calc.margemLiquida * 100).toFixed(1)}%`} sub="após deduções" variant="success" icon={PieChart} />
            <KpiCard label="Custo Total" value={formatCurrency(calc.custoTotalPeriodo)} sub={`${calc.nPeriodos} períodos`} icon={Calculator} />
          </div>

          <Section title="Comissões e Impostos" icon={BarChart3}>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-2">
              <EconRow label={`IRPJ (${(PREMISSAS.irpj * 100).toFixed(0)}%)`} value={formatCurrency(calc.valorIRPJ)} />
              <EconRow label={`Comissão Restaurante (${(PREMISSAS.comissaoRestaurante * 100).toFixed(0)}%)`} value={formatCurrency(calc.valorComRest)} />
              <EconRow label={`Comissão Comercial (${(PREMISSAS.comissaoComercial * 100).toFixed(0)}%)`} value={formatCurrency(calc.valorComCom)} />
              <EconRow label="Total Deduções" value={formatCurrency(calc.totalDeducoesValor)} bold />
            </div>
          </Section>

          <Section title="Resultado Final" icon={TrendingUp}>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-2">
              <EconRow label="Receita Líquida (após deduções)" value={formatCurrency(calc.receitaLiquida)} />
              <EconRow label="Lucro Bruto (Rec.Líq. − Custo Total)" value={formatCurrency(calc.lucroBruto)} bold accent />
              <EconRow label="Margem Líquida (após deduções)" value={`${(calc.margemLiquida * 100).toFixed(1)}%`} accent />
              <EconRow label="Margem sobre Receita Total" value={`${(calc.margemSobreReceita * 100).toFixed(0)}%`} />
              <EconRow label="Lucro por Unidade" value={formatCurrency(calc.lucroPorUnidade)} />
              <EconRow label="Custo por Unidade (total)" value={formatCurrency(calc.custoPorUnidade)} />
            </div>
          </Section>

          <Section title="Decomposição do Preço (por unidade)" icon={PieChart}>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border/20">
                    <th className="text-left p-2 text-xs text-muted-foreground font-medium">Componente</th>
                    <th className="text-right p-2 text-xs text-muted-foreground font-medium">R$/un.</th>
                    <th className="text-right p-2 text-xs text-muted-foreground font-medium">% do Preço</th>
                  </tr>
                </thead>
                <tbody>
                  {calc.decomposicaoUnit.map((d) => (
                    <tr key={d.label} className="border-b border-border/10">
                      <td className="p-2 text-xs">{d.label}</td>
                      <td className="p-2 text-right font-mono text-xs">{formatCurrency(d.valor)}</td>
                      <td className="p-2 text-right font-mono text-xs">{(d.perc * 100).toFixed(1)}%</td>
                    </tr>
                  ))}
                  <tr className="border-t border-border/30">
                    <td className="p-2 text-xs font-semibold">Preço Unit. c/ Desc.</td>
                    <td className="p-2 text-right font-mono text-xs font-semibold text-primary">{formatCurrency(calc.precoUnitComDesc)}</td>
                    <td className="p-2 text-right font-mono text-xs font-semibold">100%</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </Section>

          <Section title="Tabela de Preços por Duração" icon={Clock}>
            <div className="overflow-x-auto">
              <table className="w-full text-sm min-w-[550px]">
                <thead>
                  <tr className="border-b border-border/20">
                    <th className="text-left p-2.5 text-xs text-muted-foreground font-medium">Duração</th>
                    <th className="text-right p-2.5 text-xs text-muted-foreground font-medium">Preço s/ Desc.</th>
                    <th className="text-center p-2.5 text-xs text-muted-foreground font-medium">Desc.</th>
                    <th className="text-right p-2.5 text-xs text-muted-foreground font-medium">Economia</th>
                    <th className="text-right p-2.5 text-xs text-muted-foreground font-medium">Preço Final</th>
                  </tr>
                </thead>
                <tbody>
                  {calc.tabela.map((row) => (
                    <tr
                      key={row.semanas}
                      className={`border-b border-border/10 transition-colors ${row.semanas === semanaInfo.semanas ? "bg-primary/10" : "hover:bg-muted/20"}`}
                    >
                      <td className="p-2.5 font-medium">{row.semanas} sem</td>
                      <td className="p-2.5 text-right font-mono text-muted-foreground">{formatCurrency(row.precoSemDesconto)}</td>
                      <td className="p-2.5 text-center">
                        {row.desconto > 0 ? (
                          <span className="text-emerald-400 font-mono text-xs font-semibold">-{(row.desconto * 100).toFixed(0)}%</span>
                        ) : (
                          <span className="text-muted-foreground text-xs">—</span>
                        )}
                      </td>
                      <td className="p-2.5 text-right font-mono text-emerald-400">{row.economia > 0 ? formatCurrency(row.economia) : "—"}</td>
                      <td className="p-2.5 text-right font-mono font-semibold text-primary">{formatCurrency(row.precoFinal)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Section>
        </div>
      </div>
    </PageContainer>
  );
}

function EconRow({ label, value, bold, accent }: { label: string; value: string; bold?: boolean; accent?: boolean }) {
  return (
    <div className="flex items-center justify-between text-xs">
      <span className={`text-muted-foreground ${bold ? "font-medium" : ""}`}>{label}</span>
      <span className={`font-mono ${bold ? "font-semibold" : "font-medium"} ${accent ? "text-emerald-400" : ""}`}>{value}</span>
    </div>
  );
}

function KpiCard({ label, value, sub, variant, icon: Icon }: { label: string; value: string; sub: string; variant?: "primary" | "success" | "discount"; icon: typeof DollarSign }) {
  const borderClass = variant === "primary" ? "border-primary/30 bg-primary/5" : variant === "success" ? "border-emerald-500/30 bg-emerald-500/5" : variant === "discount" ? "border-orange-500/30 bg-orange-500/5" : "border-border/30";
  const valueClass = variant === "primary" ? "text-primary" : variant === "success" ? "text-emerald-400" : variant === "discount" ? "text-orange-400" : "";
  return (
    <Card className={borderClass}>
      <CardHeader className="pb-1 pt-3 px-3">
        <CardTitle className="text-[10px] uppercase tracking-wider text-muted-foreground flex items-center gap-1">
          <Icon className="w-3 h-3" /> {label}
        </CardTitle>
      </CardHeader>
      <CardContent className="px-3 pb-3">
        <p className={`text-lg font-bold font-mono ${valueClass}`}>{value}</p>
        <p className="text-[10px] text-muted-foreground mt-0.5">{sub}</p>
      </CardContent>
    </Card>
  );
}
