import { useState, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Slider } from "@/components/ui/slider";
import { formatCurrency } from "@/lib/format";
import { DollarSign, Percent, Package, Calculator, CreditCard, Clock, TrendingUp, Info, TrendingDown } from "lucide-react";
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
    const totalDeducoes = PREMISSAS.irpj + PREMISSAS.comissaoRestaurante + PREMISSAS.comissaoComercial;
    const denominador = 1 - dados.margem - totalDeducoes;

    const custoProducao = dados.custoGPC * dados.artes * volume;
    const custoTotal = custoProducao + dados.frete;

    const precoTotalBase4sem = denominador > 0 ? custoTotal / denominador : 0;
    const precoUnitario = volume > 0 ? precoTotalBase4sem / volume : 0;

    const precoUnit1000 = (() => {
      const d1000 = CUSTOS_VOLUME[1000];
      const cp = d1000.custoGPC * d1000.artes * 1000;
      const ct = cp + d1000.frete;
      const den = 1 - d1000.margem - totalDeducoes;
      return den > 0 ? ct / den / 1000 : 0;
    })();
    const descontoQuantidade = precoUnit1000 > 0 ? 1 - (precoUnitario / precoUnit1000) : 0;

    const multiplicador = semanaInfo.semanas / 4;
    const precoSemDesconto = precoTotalBase4sem * multiplicador;
    const precoComDescontoDuracao = precoSemDesconto * (1 - semanaInfo.desconto);
    const precoFinal = precoComDescontoDuracao * (1 + pagamento.ajuste);

    const economiaDuracao = precoSemDesconto - precoComDescontoDuracao;
    const economiaPagamento = precoComDescontoDuracao - precoFinal;

    const lucroBase4sem = precoTotalBase4sem * dados.margem;
    const comissaoRestaurante4sem = precoTotalBase4sem * PREMISSAS.comissaoRestaurante;
    const comissaoComercial4sem = precoTotalBase4sem * PREMISSAS.comissaoComercial;
    const irpj4sem = precoTotalBase4sem * PREMISSAS.irpj;

    const tabela = DESCONTOS_SEMANAS.map((s) => {
      const mult = s.semanas / 4;
      const pSemDesc = precoTotalBase4sem * mult;
      const pComDesc = pSemDesc * (1 - s.desconto);
      const pFinal = pComDesc * (1 + pagamento.ajuste);
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
      totalDeducoes,
      denominador,
      custoProducao,
      custoTotal,
      precoTotalBase4sem,
      precoUnitario,
      precoUnit1000,
      descontoQuantidade,
      precoSemDesconto,
      precoComDescontoDuracao,
      precoFinal,
      economiaDuracao,
      economiaPagamento,
      lucroBase4sem,
      comissaoRestaurante4sem,
      comissaoComercial4sem,
      irpj4sem,
      tabela,
    };
  }, [volume, dados, semanaInfo, pagamento]);

  return (
    <PageContainer title="Tabela de Preços — Simulador VEXA">
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="lg:col-span-1 space-y-4">
          <Section title="Parâmetros" icon={Package}>
            <div className="space-y-5">
              <div className="space-y-2">
                <Label className="text-xs flex items-center justify-between">
                  <span className="flex items-center gap-1.5"><Package className="w-3 h-3" /> Quantidade</span>
                  <span className="font-mono font-bold text-primary">{volume.toLocaleString("pt-BR")} un.</span>
                </Label>
                <Slider
                  min={0}
                  max={VOLUMES.length - 1}
                  step={1}
                  value={[volumeIdx]}
                  onValueChange={([v]) => setVolumeIdx(v)}
                />
                <div className="flex justify-between text-[10px] text-muted-foreground font-mono">
                  <span>1.000</span>
                  <span>20.000</span>
                </div>
              </div>

              <div className="space-y-2">
                <Label className="text-xs flex items-center justify-between">
                  <span className="flex items-center gap-1.5"><Clock className="w-3 h-3" /> Prazo</span>
                  <span className="font-mono font-bold text-primary">{semanaInfo.semanas} semanas</span>
                </Label>
                <Slider
                  min={0}
                  max={DESCONTOS_SEMANAS.length - 1}
                  step={1}
                  value={[semanaIdx]}
                  onValueChange={([v]) => setSemanaIdx(v)}
                />
                <div className="flex justify-between text-[10px] text-muted-foreground font-mono">
                  <span>4 sem</span>
                  <span>52 sem</span>
                </div>
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs flex items-center gap-1.5"><CreditCard className="w-3 h-3" /> Forma de Pagamento</Label>
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

          <Section title="Premissas do Volume" icon={Info}>
            <div className="space-y-2">
              <PremissaRow label="Custo GPC Unit." value={`R$ ${dados.custoGPC.toFixed(4)}`} />
              <PremissaRow label="Margem Alvo" value={`${(dados.margem * 100).toFixed(0)}%`} />
              <PremissaRow label="Frete" value={formatCurrency(dados.frete)} />
              <PremissaRow label="Artes" value={`${dados.artes}`} />
              <div className="border-t border-border/20 pt-2 mt-2" />
              <PremissaRow label="IRPJ" value={`${(PREMISSAS.irpj * 100).toFixed(0)}%`} />
              <PremissaRow label="Comissão Restaurante" value={`${(PREMISSAS.comissaoRestaurante * 100).toFixed(0)}%`} />
              <PremissaRow label="Comissão Comercial" value={`${(PREMISSAS.comissaoComercial * 100).toFixed(0)}%`} />
              <div className="border-t border-border/20 pt-2">
                <PremissaRow label="Total Deduções" value={`${(calc.totalDeducoes * 100).toFixed(0)}%`} bold />
                <PremissaRow label="Denominador" value={calc.denominador.toFixed(4)} bold />
              </div>
            </div>
          </Section>

          <Section title="Descontos Aplicados" icon={TrendingDown}>
            <div className="space-y-2">
              <PremissaRow label="Desc. Quantidade" value={calc.descontoQuantidade > 0 ? `${(calc.descontoQuantidade * 100).toFixed(1)}%` : "—"} accent={calc.descontoQuantidade > 0} />
              <PremissaRow label="Desc. Duração" value={semanaInfo.desconto > 0 ? `${(semanaInfo.desconto * 100).toFixed(0)}%` : "—"} accent={semanaInfo.desconto > 0} />
              <PremissaRow label="Ajuste Pagamento" value={pagamento.ajuste !== 0 ? `${pagamento.ajuste > 0 ? "+" : ""}${(pagamento.ajuste * 100).toFixed(0)}%` : "—"} accent={pagamento.ajuste < 0} />
            </div>
          </Section>
        </div>

        <div className="lg:col-span-2 space-y-4">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <KpiCard label="Preço Final" value={formatCurrency(calc.precoFinal)} sub={`${semanaInfo.semanas} sem • ${pagamento.label}`} variant="primary" icon={DollarSign} />
            <KpiCard label="Preço Unit." value={formatCurrency(calc.precoUnitario)} sub="por bolacha (base 4 sem)" icon={TrendingUp} />
            <KpiCard label="Lucro Base" value={formatCurrency(calc.lucroBase4sem)} sub={`${(dados.margem * 100).toFixed(0)}% margem (4 sem)`} variant="success" icon={Percent} />
            <KpiCard label="Custo Total" value={formatCurrency(calc.custoTotal)} sub="produção + frete" icon={Calculator} />
          </div>

          <Section title="Decomposição do Preço (4 semanas)" icon={Calculator}>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              <KpiMini label="Custo Produção" value={formatCurrency(calc.custoProducao)} />
              <KpiMini label="Frete" value={formatCurrency(dados.frete)} />
              <KpiMini label="Custo Total" value={formatCurrency(calc.custoTotal)} />
              <KpiMini label="Preço Base (4 sem)" value={formatCurrency(calc.precoTotalBase4sem)} accent />
              <KpiMini label="IRPJ" value={formatCurrency(calc.irpj4sem)} />
              <KpiMini label="Com. Restaurante" value={formatCurrency(calc.comissaoRestaurante4sem)} />
              <KpiMini label="Com. Comercial" value={formatCurrency(calc.comissaoComercial4sem)} />
              <KpiMini label="Lucro" value={formatCurrency(calc.lucroBase4sem)} accent />
              <KpiMini label="Preço Unitário" value={formatCurrency(calc.precoUnitario)} accent />
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

function PremissaRow({ label, value, bold, accent }: { label: string; value: string; bold?: boolean; accent?: boolean }) {
  return (
    <div className="flex items-center justify-between text-xs">
      <span className={`text-muted-foreground ${bold ? "font-medium" : ""}`}>{label}</span>
      <span className={`font-mono ${bold ? "font-semibold" : "font-medium"} ${accent ? "text-emerald-400" : ""}`}>{value}</span>
    </div>
  );
}

function KpiCard({ label, value, sub, variant, icon: Icon }: { label: string; value: string; sub: string; variant?: "primary" | "success"; icon: typeof DollarSign }) {
  const borderClass = variant === "primary" ? "border-primary/30 bg-primary/5" : variant === "success" ? "border-emerald-500/30 bg-emerald-500/5" : "border-border/30";
  const valueClass = variant === "primary" ? "text-primary" : variant === "success" ? "text-emerald-400" : "";
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

function KpiMini({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  return (
    <div className="bg-card border border-border/30 rounded-lg p-2.5">
      <p className="text-[10px] uppercase tracking-wider text-muted-foreground mb-0.5">{label}</p>
      <p className={`text-sm font-bold font-mono ${accent ? "text-primary" : ""}`}>{value}</p>
    </div>
  );
}
