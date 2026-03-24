import { useState, useMemo, useCallback, useEffect } from "react";
import { useLocation, useSearch } from "wouter";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Slider } from "@/components/ui/slider";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { formatCurrency } from "@/lib/format";
import { DollarSign, Percent, Package, Calculator, CreditCard, Clock, TrendingUp, TrendingDown, BarChart3, PieChart, Settings2, ChevronDown, ChevronRight, RotateCcw, FileText, Download, Rocket, Store, Search, X, Divide, CheckCircle2, AlertTriangle, MapPin, Eye, EyeOff, CalendarDays, Handshake } from "lucide-react";
import { Button } from "@/components/ui/button";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import PageContainer from "@/components/PageContainer";
import Section from "@/components/Section";
import { useRestaurantAllocation, COASTER_CAPACITY_FACTOR } from "@/hooks/useRestaurantAllocation";

const DEFAULT_CUSTOS_VOLUME: Record<number, { custoGPC: number; margem: number; frete: number; artes: number }> = {
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

const VOLUMES = Object.keys(DEFAULT_CUSTOS_VOLUME).map(Number);

const DEFAULT_PREMISSAS = {
  irpj: 6,
  comissaoRestaurante: 15,
  comissaoComercial: 10,
};

const DEFAULT_DESCONTOS_PRAZO: Record<number, number> = {
  4: 0, 8: 3, 12: 5, 16: 7, 20: 9, 24: 11, 28: 13, 32: 15, 36: 17, 40: 19, 44: 21, 48: 23, 52: 25,
};

const ZERO_DESCONTOS_PRAZO: Record<number, number> = {
  4: 0, 8: 0, 12: 0, 16: 0, 20: 0, 24: 0, 28: 0, 32: 0, 36: 0, 40: 0, 44: 0, 48: 0, 52: 0,
};

const DEFAULT_PAGAMENTO = {
  pix: 5,
  boleto: 0,
  cartao: 0,
};

const SEMANAS = [4, 8, 12, 16, 20, 24, 28, 32, 36, 40, 44, 48, 52];

const inputCls = "bg-background border-border/30 h-7 text-xs font-mono px-2 w-20 text-right";

export default function PriceTable() {
  const [volumeIdx, setVolumeIdx] = useState(0);
  const [semanaIdx, setSemanaIdx] = useState(0);
  const [formaPagamento, setFormaPagamento] = useState("boleto");
  const [showPremissas, setShowPremissas] = useState(false);
  const [presentationMode, setPresentationMode] = useState(false);
  const [descontoParceiro, setDescontoParceiro] = useState(false);

  const [premissas, setPremissas] = useState(DEFAULT_PREMISSAS);
  const [descontosPrazo, setDescontosPrazo] = useState(DEFAULT_DESCONTOS_PRAZO);
  const [pagamentoConfig, setPagamentoConfig] = useState(DEFAULT_PAGAMENTO);
  const [custosVolume, setCustosVolume] = useState(DEFAULT_CUSTOS_VOLUME);
  const [allocSearch, setAllocSearch] = useState("");

  const [selectedProductId, setSelectedProductId] = useState<number | null>(null);
  const { data: productsListRaw } = trpc.product.list.useQuery();
  const productsList = useMemo(() => productsListRaw ?? [], [productsListRaw]);
  const { data: productTiersRaw, refetch: refetchTiers } = trpc.product.getTiers.useQuery(
    { productId: selectedProductId! },
    { enabled: selectedProductId !== null }
  );
  const productTiers = useMemo(() => productTiersRaw ?? [], [productTiersRaw]);
  const { data: discountPriceTiersRaw } = trpc.product.listDiscountTiers.useQuery(
    { productId: selectedProductId! },
    { enabled: selectedProductId !== null }
  );
  const discountPriceTiers = useMemo(() => (discountPriceTiersRaw ?? []).map((t) => ({
    priceMin: parseFloat(String(t.priceMin)),
    priceMax: parseFloat(String(t.priceMax)),
    discountPercent: parseFloat(String(t.discountPercent)),
  })), [discountPriceTiersRaw]);
  const selectedProduct = useMemo(
    () => productsList.find((p) => p.id === selectedProductId),
    [productsList, selectedProductId]
  );
  const isPriceBasedProduct = selectedProduct?.pricingMode === "price_based";
  const isFixedQtyProduct = selectedProduct?.entryType === "fixed_quantities";
  const upsertTiersMutation = trpc.product.upsertTiers.useMutation({
    onSuccess: () => { refetchTiers(); toast.success("Faixas salvas!"); },
    onError: (err) => toast.error(`Erro: ${err.message}`),
  });

  useEffect(() => {
    if (productsList.length > 0 && selectedProductId === null) {
      setSelectedProductId(productsList[0].id);
    }
  }, [productsList]);

  useEffect(() => {
    if (productTiers.length > 0) {
      const newCustos: Record<number, { custoGPC: number; margem: number; frete: number; artes: number }> = {};
      for (const t of productTiers) {
        newCustos[t.volumeMin] = {
          custoGPC: parseFloat(t.custoUnitario),
          margem: parseFloat(t.margem) / 100,
          frete: parseFloat(t.frete),
          artes: t.artes ?? 1,
        };
      }
      setCustosVolume(newCustos);
    } else if (!selectedProductId) {
      setCustosVolume(DEFAULT_CUSTOS_VOLUME);
    } else {
      setCustosVolume({});
    }
    setVolumeIdx(0);
  }, [productTiers, selectedProductId]);

  useEffect(() => {
    if (selectedProduct) {
      setPremissas({
        irpj: parseFloat(selectedProduct.irpj ?? "6"),
        comissaoRestaurante: parseFloat(selectedProduct.comRestaurante ?? "15"),
        comissaoComercial: parseFloat(selectedProduct.comComercial ?? "10"),
      });
      setDescontosPrazo(
        selectedProduct.pricingMode === "price_based"
          ? ZERO_DESCONTOS_PRAZO
          : DEFAULT_DESCONTOS_PRAZO
      );
    }
  }, [selectedProduct]);

  const volumes = useMemo(() => {
    if (productTiers.length > 0) {
      return productTiers.map((t) => t.volumeMin).sort((a, b) => a - b);
    }
    return VOLUMES;
  }, [productTiers]);

  const handleSaveTiers = () => {
    if (!selectedProductId) return;
    const tiers = volumes.map((v: number) => {
      const d = custosVolume[v] || DEFAULT_CUSTOS_VOLUME[v];
      if (!d) return null;
      const idx = volumes.indexOf(v);
      const nextVol = idx < volumes.length - 1 ? volumes[idx + 1] : null;
      return {
        volumeMin: v,
        volumeMax: nextVol ? nextVol - 1 : null,
        custoUnitario: d.custoGPC.toFixed(4),
        frete: d.frete.toFixed(2),
        margem: (d.margem * 100).toFixed(2),
        artes: d.artes,
      };
    }).filter((t): t is NonNullable<typeof t> => t !== null);
    upsertTiersMutation.mutate({ productId: selectedProductId, tiers });
  };

  const { data: restaurantsListRaw } = trpc.activeRestaurant.list.useQuery();
  const restaurantsList = useMemo(() => restaurantsListRaw ?? [], [restaurantsListRaw]);
  const restaurantsForAllocation = useMemo(
    () => restaurantsList.map((r) => ({
      id: r.id,
      name: r.name,
      neighborhood: r.neighborhood,
      logoUrl: r.logoUrl,
      ratingScore: r.ratingScore,
      ratingMultiplier: r.ratingMultiplier,
      commissionPercent: r.commissionPercent,
      monthlyDrinksSold: r.monthlyDrinksSold,
      status: r.status,
    })),
    [restaurantsList]
  );

  const volume = volumes[Math.min(volumeIdx, volumes.length - 1)];
  const dados = custosVolume[volume] || { custoGPC: 0.27, margem: 0.50, frete: 0, artes: 1 };
  const semanas = SEMANAS[semanaIdx];
  const descPrazo = (descontosPrazo[semanas] || 0) / 100;

  const ajustePag = formaPagamento === "pix" ? -(pagamentoConfig.pix / 100)
    : formaPagamento === "boleto" ? -(pagamentoConfig.boleto / 100)
    : formaPagamento === "cartao" ? (pagamentoConfig.cartao / 100)
    : 0;

  const pagLabel = formaPagamento === "pix" ? "Pix" : formaPagamento === "boleto" ? "Boleto" : "Cartão";

  const allocation = useRestaurantAllocation(restaurantsForAllocation, volume);

  const availableRestaurants = useMemo(() => {
    const activeRests = restaurantsForAllocation.filter(r => r.status === "active" && !allocation.selectedIds.includes(r.id));
    if (!allocSearch.trim()) return activeRests;
    const q = allocSearch.toLowerCase();
    return activeRests.filter(r => r.name.toLowerCase().includes(q) || (r.neighborhood && r.neighborhood.toLowerCase().includes(q)));
  }, [restaurantsForAllocation, allocation.selectedIds, allocSearch]);

  const calc = useMemo(() => {
    const irpj = premissas.irpj / 100;
    const comRest = premissas.comissaoRestaurante / 100;
    const comCom = premissas.comissaoComercial / 100;
    const totalDeducoesPerc = irpj + comRest + comCom;
    const denominador = 1 - dados.margem - irpj - comRest - comCom;

    const custoProducao = dados.custoGPC * dados.artes * volume;
    const custoTotal4sem = custoProducao + dados.frete;

    const precoTotalBase4sem = denominador > 0
      ? custoTotal4sem / denominador
      : 0;
    const precoUnit4sem = volume > 0 ? precoTotalBase4sem / volume : 0;

    const smallestVolume = volumes.length > 0 ? volumes[0] : 1000;
    const precoUnitSmallest = (() => {
      const d = custosVolume[smallestVolume];
      if (!d) return precoUnit4sem;
      const ct = d.custoGPC * d.artes * smallestVolume + d.frete;
      const den = 1 - d.margem - irpj - comRest - comCom;
      return den > 0 ? (ct / den) / smallestVolume : 0;
    })();
    const descontoQuantidade = precoUnitSmallest > 0 && volume > smallestVolume ? 1 - (precoUnit4sem / precoUnitSmallest) : 0;

    const nPeriodos = semanas / 4;
    const precoSemDesconto = precoTotalBase4sem * nPeriodos;

    // Faixa discount applied on gross bruto amount (before prazo)
    const faixaDescTier = discountPriceTiers.find(t => precoSemDesconto >= t.priceMin && precoSemDesconto <= t.priceMax);
    const descFaixaPrecoPerc = faixaDescTier ? faixaDescTier.discountPercent / 100 : 0;
    const descFaixaPrecoVal = precoSemDesconto * descFaixaPrecoPerc;
    const precoPosFaixa = precoSemDesconto - descFaixaPrecoVal;
    const precoComDescDuracao = precoPosFaixa * (1 - descPrazo);

    const precoAntesDescParceiro = precoComDescDuracao * (1 + ajustePag);
    const descParcPerc = descontoParceiro ? 0.10 : 0;
    const precoFinal = precoAntesDescParceiro * (1 - descParcPerc);

    const precoUnitComDesc = volume > 0 ? precoFinal / (volume * nPeriodos) : 0;
    const precoMensal = nPeriodos > 0 ? precoFinal / nPeriodos : 0;
    const descCombinado = precoUnitSmallest > 0 ? 1 - (precoUnitComDesc / precoUnitSmallest) : 0;

    const custoTotalPeriodo = custoTotal4sem * nPeriodos;

    const valorIRPJ = precoFinal * irpj;
    const valorComRest = precoFinal * comRest;
    const valorComCom = precoFinal * comCom;
    const totalDeducoesValor = valorIRPJ + valorComRest + valorComCom;
    const receitaLiquida = precoFinal - totalDeducoesValor;
    const lucroBruto = receitaLiquida - custoTotalPeriodo;
    const margemLiquida = precoFinal > 0 ? lucroBruto / precoFinal : 0;
    const lucroPorUnidade = volume > 0 ? lucroBruto / volume : 0;
    const custoPorUnidade = volume > 0 ? custoTotal4sem / volume : 0;

    const decomposicaoUnit = [
      { label: "Custo GPC", valor: dados.custoGPC, perc: precoUnit4sem > 0 ? dados.custoGPC / precoUnit4sem : 0 },
      { label: "Frete/un.", valor: volume > 0 ? dados.frete / volume : 0, perc: precoUnit4sem > 0 ? (dados.frete / volume) / precoUnit4sem : 0 },
      { label: "IRPJ", valor: precoUnit4sem * irpj, perc: irpj },
      { label: "Com. Restaurante", valor: precoUnit4sem * comRest, perc: comRest },
      { label: "Com. Comercial", valor: precoUnit4sem * comCom, perc: comCom },
      { label: "Margem / Lucro", valor: precoUnit4sem * dados.margem, perc: margemLiquida > 0 ? margemLiquida : dados.margem },
    ];

    const tabela = SEMANAS.map((s) => {
      const mult = s / 4;
      const pSemDesc = precoTotalBase4sem * mult;
      const faixaTier = discountPriceTiers.find(t => pSemDesc >= t.priceMin && pSemDesc <= t.priceMax);
      const descFaixaTabela = faixaTier ? faixaTier.discountPercent / 100 : 0;
      const pPosFaixa = pSemDesc * (1 - descFaixaTabela);
      const dsc = (descontosPrazo[s] || 0) / 100;
      const pComDesc = pPosFaixa * (1 - dsc);
      const pFinal = pComDesc * (1 + ajustePag) * (1 - descParcPerc);
      return { semanas: s, desconto: dsc, descFaixa: descFaixaTabela, precoSemDesconto: pSemDesc, precoComDesconto: pComDesc, economia: pSemDesc - pComDesc, precoFinal: pFinal };
    });

    return {
      totalDeducoesPerc, denominador, custoProducao, custoTotal4sem, custoTotalPeriodo,
      precoTotalBase4sem, precoUnit4sem, precoUnitSmallest, descontoQuantidade,
      nPeriodos, precoSemDesconto, precoComDescDuracao, precoFinal, precoUnitComDesc, precoMensal, descCombinado,
      descParcPerc, descFaixaPrecoPerc, descFaixaPrecoVal,
      valorIRPJ, valorComRest, valorComCom, totalDeducoesValor,
      receitaLiquida, lucroBruto, margemLiquida, margemSobreReceita: dados.margem,
      lucroPorUnidade, custoPorUnidade, decomposicaoUnit, tabela,
      irpj, comRest, comCom,
    };
  }, [volume, dados, semanas, descPrazo, ajustePag, premissas, custosVolume, descontosPrazo, descontoParceiro, discountPriceTiers]);

  const updateVolumeDado = (vol: number, field: keyof typeof dados, val: number) => {
    setCustosVolume((prev) => ({ ...prev, [vol]: { ...prev[vol], [field]: val } }));
  };

  const resetPremissas = () => {
    if (selectedProduct) {
      setPremissas({
        irpj: parseFloat(selectedProduct.irpj ?? "6"),
        comissaoRestaurante: parseFloat(selectedProduct.comRestaurante ?? "15"),
        comissaoComercial: parseFloat(selectedProduct.comComercial ?? "10"),
      });
    } else {
      setPremissas(DEFAULT_PREMISSAS);
    }
    setDescontosPrazo(isPriceBasedProduct ? ZERO_DESCONTOS_PRAZO : DEFAULT_DESCONTOS_PRAZO);
    setPagamentoConfig(DEFAULT_PAGAMENTO);
    if (productTiers.length > 0) {
      const newCustos: Record<number, { custoGPC: number; margem: number; frete: number; artes: number }> = {};
      for (const t of productTiers) {
        newCustos[t.volumeMin] = {
          custoGPC: parseFloat(t.custoUnitario),
          margem: parseFloat(t.margem) / 100,
          frete: parseFloat(t.frete),
          artes: t.artes ?? 1,
        };
      }
      setCustosVolume(newCustos);
    } else if (!selectedProductId) {
      setCustosVolume(DEFAULT_CUSTOS_VOLUME);
    } else {
      setCustosVolume({});
    }
  };

  const [, navigate] = useLocation();
  const searchString = useSearch();
  const [showCotacaoDialog, setShowCotacaoDialog] = useState(false);
  const [selectedClientId, setSelectedClientId] = useState("none");
  const [selectedLeadId, setSelectedLeadId] = useState("none");
  const [cotacaoNotes, setCotacaoNotes] = useState("");
  const [cotacaoVolume, setCotacaoVolume] = useState(volume);

  const { data: clientsList = [] } = trpc.advertiser.list.useQuery();
  const { data: leadsList = [] } = trpc.lead.list.useQuery({ type: "anunciante" });
  const utils = trpc.useUtils();

  useEffect(() => {
    const params = new URLSearchParams(searchString);
    const leadIdParam = params.get("leadId");
    const clientIdParam = params.get("clientId");
    if (leadIdParam || clientIdParam) {
      if (clientIdParam) {
        setSelectedClientId(clientIdParam);
        setSelectedLeadId("none");
      }
      if (leadIdParam) {
        setSelectedLeadId(leadIdParam);
        if (!clientIdParam) setSelectedClientId("none");
      }
    }
  }, [searchString]);

  const setRestaurantsMutation = trpc.quotation.setRestaurants.useMutation();

  const createMutation = trpc.quotation.create.useMutation({
    onSuccess: async (created) => {
      if (allocation.hasAllocations && allocation.allocations.length > 0) {
        try {
          await setRestaurantsMutation.mutateAsync({
            quotationId: created.id,
            restaurants: allocation.allocations
              .filter(a => a.coasters > 0)
              .map(a => ({ restaurantId: a.restaurantId, coasterQuantity: a.coasters })),
          });
        } catch (e) {
          const msg = e instanceof Error ? e.message : "Erro desconhecido";
          toast.error(`Cotação criada, mas erro ao salvar restaurantes: ${msg}`);
        }
      }
      utils.quotation.list.invalidate();
      toast.success("Cotação criada com sucesso!");
      setShowCotacaoDialog(false);
      setTimeout(() => navigate("/comercial/cotacoes"), 600);
    },
    onError: (err) => toast.error(`Erro: ${err.message}`),
  });

  const handleCreateCotacao = () => {
    if (selectedClientId === "none" && selectedLeadId === "none") {
      toast.error("Selecione um cliente ou lead");
      return;
    }
    if (!selectedProductId) {
      toast.error("Selecione um produto");
      return;
    }
    if (cotacaoVolume < 1) {
      toast.error("Volume deve ser no mínimo 1");
      return;
    }
    if (allocation.hasAllocations && allocation.allocatedTotal !== cotacaoVolume) {
      toast.error(`Volume da distribuição (${allocation.allocatedTotal.toLocaleString("pt-BR")}) não corresponde ao volume da cotação (${cotacaoVolume.toLocaleString("pt-BR")})`);
      return;
    }
    const unitPriceStr = calc.precoUnitComDesc.toFixed(4);
    const totalValueStr = (calc.precoUnitComDesc * cotacaoVolume * calc.nPeriodos).toFixed(2);
    const productLabel = selectedProduct?.name || "VEXA";
    const notesAuto = `Tabela de Preços ${productLabel}: ${cotacaoVolume.toLocaleString("pt-BR")} un., ${semanas} semanas, ${pagLabel}, desc. prazo ${(descPrazo * 100).toFixed(0)}%`;

    createMutation.mutate({
      ...(selectedClientId !== "none" ? { clientId: parseInt(selectedClientId) } : {}),
      ...(selectedLeadId !== "none" ? { leadId: parseInt(selectedLeadId) } : {}),
      coasterVolume: cotacaoVolume,
      cycles: Math.ceil(semanas / 4),
      unitPrice: unitPriceStr,
      totalValue: totalValueStr,
      includesProduction: true,
      productId: selectedProductId!,
      notes: cotacaoNotes ? `${notesAuto}\n${cotacaoNotes}` : notesAuto,
    });
  };

  const handleExportPdf = useCallback(() => {
    try {
      const doc = new jsPDF("p", "mm", "a4");
      const pw = doc.internal.pageSize.getWidth();
      const orange = [255, 102, 0] as const;
      const black = [13, 13, 13] as const;

      doc.setFillColor(...black);
      doc.rect(0, 0, pw, 42, "F");
      doc.setFillColor(...orange);
      doc.rect(0, 42, pw, 2.5, "F");

      doc.setTextColor(255, 255, 255);
      doc.setFontSize(22);
      doc.setFont("helvetica", "bold");
      doc.text("MESA ADS", 14, 22);
      doc.setFontSize(11);
      doc.setFont("helvetica", "normal");
      doc.text(`Simulação de Preços — ${selectedProduct?.name || "Tabela VEXA"}`, 14, 32);

      doc.setFontSize(8);
      doc.setTextColor(180, 180, 180);
      doc.text(`Gerado em ${new Date().toLocaleDateString("pt-BR")} às ${new Date().toLocaleTimeString("pt-BR")}`, pw - 14, 32, { align: "right" });

      let y = 54;
      doc.setTextColor(0, 0, 0);
      doc.setFontSize(12);
      doc.setFont("helvetica", "bold");
      doc.text("Resumo da Simulação", 14, y);
      y += 8;

      const summaryData = [
        ["Quantidade", `${volume.toLocaleString("pt-BR")} unidades`],
        ["Duração", `${semanas} semanas (${calc.nPeriodos} períodos)`],
        ["Forma de Pagamento", pagLabel],
        ["Preço Total", formatCurrency(calc.precoFinal)],
        ["Preço Unitário (c/ desc.)", formatCurrency(calc.precoUnitComDesc)],
        ["Desconto Combinado", calc.descCombinado > 0 ? `${(calc.descCombinado * 100).toFixed(1)}%` : "—"],
        ["Lucro Bruto", formatCurrency(calc.lucroBruto)],
        ["Margem Líquida", `${(calc.margemLiquida * 100).toFixed(1)}%`],
      ];

      autoTable(doc, {
        startY: y,
        head: [["Parâmetro", "Valor"]],
        body: summaryData,
        theme: "striped",
        headStyles: { fillColor: [255, 102, 0], textColor: [255, 255, 255], fontStyle: "bold", fontSize: 9 },
        bodyStyles: { fontSize: 9 },
        columnStyles: { 0: { fontStyle: "bold" } },
        margin: { left: 14, right: 14 },
      });

      y = (doc as any).lastAutoTable.finalY + 12;

      doc.setFontSize(12);
      doc.setFont("helvetica", "bold");
      doc.text("Comissões e Impostos", 14, y);
      y += 6;

      autoTable(doc, {
        startY: y,
        head: [["Item", "% sobre Receita", "Valor (R$)"]],
        body: [
          ["IRPJ", `${premissas.irpj}%`, formatCurrency(calc.valorIRPJ)],
          ["Comissão Restaurante", `${premissas.comissaoRestaurante}%`, formatCurrency(calc.valorComRest)],
          ["Comissão Comercial", `${premissas.comissaoComercial}%`, formatCurrency(calc.valorComCom)],
          ["Total Deduções", `${(calc.totalDeducoesPerc * 100).toFixed(0)}%`, formatCurrency(calc.totalDeducoesValor)],
        ],
        theme: "striped",
        headStyles: { fillColor: [255, 102, 0], textColor: [255, 255, 255], fontStyle: "bold", fontSize: 9 },
        bodyStyles: { fontSize: 9 },
        margin: { left: 14, right: 14 },
      });

      y = (doc as any).lastAutoTable.finalY + 12;

      doc.setFontSize(12);
      doc.setFont("helvetica", "bold");
      doc.text("Resultado Final", 14, y);
      y += 6;

      autoTable(doc, {
        startY: y,
        head: [["Indicador", "Valor"]],
        body: [
          ["Receita Líquida", formatCurrency(calc.receitaLiquida)],
          ["Custo Total do Período", formatCurrency(calc.custoTotalPeriodo)],
          ["Lucro Bruto", formatCurrency(calc.lucroBruto)],
          ["Margem Líquida", `${(calc.margemLiquida * 100).toFixed(1)}%`],
          ["Lucro por Unidade", formatCurrency(calc.lucroPorUnidade)],
          ["Custo por Unidade", formatCurrency(calc.custoPorUnidade)],
        ],
        theme: "striped",
        headStyles: { fillColor: [255, 102, 0], textColor: [255, 255, 255], fontStyle: "bold", fontSize: 9 },
        bodyStyles: { fontSize: 9 },
        columnStyles: { 0: { fontStyle: "bold" } },
        margin: { left: 14, right: 14 },
      });

      y = (doc as any).lastAutoTable.finalY + 12;

      if (y > 240) { doc.addPage(); y = 20; }

      doc.setFontSize(12);
      doc.setFont("helvetica", "bold");
      doc.text("Tabela de Preços por Duração", 14, y);
      y += 6;

      autoTable(doc, {
        startY: y,
        head: [["Duração", "Preço s/ Desc.", "Desconto", "Economia", "Preço Final"]],
        body: calc.tabela.map((r) => [
          `${r.semanas} sem`,
          formatCurrency(r.precoSemDesconto),
          [r.desconto > 0 ? `Prazo: ${(r.desconto * 100).toFixed(0)}%` : "", r.descFaixa > 0 ? `Faixa: ${(r.descFaixa * 100).toFixed(0)}%` : ""].filter(Boolean).join(" + ") || "—",
          r.economia > 0 ? formatCurrency(r.economia) : "—",
          formatCurrency(r.precoFinal),
        ]),
        theme: "striped",
        headStyles: { fillColor: [255, 102, 0], textColor: [255, 255, 255], fontStyle: "bold", fontSize: 9 },
        bodyStyles: { fontSize: 8 },
        margin: { left: 14, right: 14 },
      });

      const pageCount = doc.getNumberOfPages();
      for (let i = 1; i <= pageCount; i++) {
        doc.setPage(i);
        doc.setFontSize(7);
        doc.setTextColor(150);
        doc.text(`Mesa Ads — ${selectedProduct?.name || "Tabela VEXA"} — Página ${i}/${pageCount}`, pw / 2, doc.internal.pageSize.getHeight() - 8, { align: "center" });
      }

      doc.save(`${(selectedProduct?.name || "VEXA").replace(/\s+/g, "_")}_${volume}un_${semanas}sem_${pagLabel}.pdf`);
      toast.success("PDF exportado!");
    } catch {
      toast.error("Erro ao gerar PDF");
    }
  }, [volume, semanas, pagLabel, calc, premissas, descPrazo]);

  return (
    <PageContainer
      title={`Tabela de Preços${selectedProduct ? ` — ${selectedProduct.name}` : ""}`}
      actions={
        <div className="flex items-center gap-2">
          <Select value={selectedProductId ? String(selectedProductId) : ""} onValueChange={(v) => setSelectedProductId(parseInt(v))}>
            <SelectTrigger className="bg-background border-border/30 h-8 text-xs w-48">
              <SelectValue placeholder="Selecione um produto" />
            </SelectTrigger>
            <SelectContent>
              {productsList.map((p) => (
                <SelectItem key={p.id} value={String(p.id)}>{p.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          {!presentationMode && selectedProductId && (
            <Button variant="outline" size="sm" className="gap-1.5 h-8 text-xs" onClick={handleSaveTiers} disabled={upsertTiersMutation.isPending}>
              {upsertTiersMutation.isPending ? "Salvando..." : "Salvar Faixas"}
            </Button>
          )}
          <Button
            variant={presentationMode ? "default" : "outline"}
            size="sm"
            className={`gap-1.5 ${presentationMode ? "bg-orange-500 hover:bg-orange-600 text-white" : ""}`}
            onClick={() => {
              const next = !presentationMode;
              setPresentationMode(next);
              if (next) setShowPremissas(false);
            }}
          >
            {presentationMode ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
            {presentationMode ? "Modo Apresentação" : "Apresentação"}
          </Button>
          <Button variant="outline" size="sm" className="gap-1.5" onClick={handleExportPdf}>
            <Download className="w-3.5 h-3.5" /> Exportar PDF
          </Button>
          <Button size="sm" className="gap-1.5" onClick={() => { setCotacaoNotes(""); const params = new URLSearchParams(window.location.search); if (!params.get("clientId")) setSelectedClientId("none"); if (!params.get("leadId")) setSelectedLeadId("none"); setCotacaoVolume(volume); setShowCotacaoDialog(true); }}>
            <Rocket className="w-3.5 h-3.5" /> Criar Cotação
          </Button>
        </div>
      }
    >
      {isPriceBasedProduct ? (
        productTiers.length === 0 ? (
          <div className="rounded-lg border border-border/40 bg-muted/20 p-6 text-center text-sm text-muted-foreground">
            <p className="font-medium text-foreground mb-1">Nenhuma entrada de preço cadastrada</p>
            <p>Adicione entradas de preço no cadastro do produto para visualizar a tabela.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            <div className="lg:col-span-1 space-y-4">
              <Section title="Inputs" icon={Package}>
                <div className="space-y-5">
                  <div className="space-y-1.5">
                    <Label className="text-xs flex items-center gap-1.5"><Package className="w-3 h-3" /> {isFixedQtyProduct ? "Quantidade" : "Entrada de Preço"}</Label>
                    <Select value={String(volumeIdx)} onValueChange={(v) => setVolumeIdx(parseInt(v))}>
                      <SelectTrigger className="bg-background border-border/30 h-9 text-sm"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {productTiers.map((tier, idx) => (
                          <SelectItem key={tier.id} value={String(idx)}>
                            {isFixedQtyProduct
                              ? `${tier.volumeMin.toLocaleString("pt-BR")} un.`
                              : tier.volumeMax
                                ? `${tier.volumeMin.toLocaleString("pt-BR")} – ${tier.volumeMax.toLocaleString("pt-BR")}`
                                : `${tier.volumeMin.toLocaleString("pt-BR")}+`}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label className="text-xs flex items-center justify-between">
                      <span className="flex items-center gap-1.5"><Clock className="w-3 h-3" /> Semanas</span>
                      <span className="font-mono font-bold text-primary">{semanas}</span>
                    </Label>
                    <Slider min={0} max={SEMANAS.length - 1} step={1} value={[semanaIdx]} onValueChange={([v]) => setSemanaIdx(v)} />
                    <div className="flex justify-between text-[10px] text-muted-foreground font-mono"><span>4</span><span>52</span></div>
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs flex items-center gap-1.5"><CreditCard className="w-3 h-3" /> Pagamento</Label>
                    <Select value={formaPagamento} onValueChange={setFormaPagamento}>
                      <SelectTrigger className="bg-background border-border/30 h-9 text-sm"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="pix">Pix {pagamentoConfig.pix > 0 && `(-${pagamentoConfig.pix}%)`}</SelectItem>
                        <SelectItem value="boleto">Boleto</SelectItem>
                        <SelectItem value="cartao">Cartão {pagamentoConfig.cartao > 0 && `(+${pagamentoConfig.cartao}%)`}</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs flex items-center gap-1.5"><Handshake className="w-3 h-3" /> Desconto Parceiro</Label>
                    <Button
                      variant={descontoParceiro ? "default" : "outline"}
                      size="sm"
                      className={`w-full gap-1.5 h-9 text-sm ${descontoParceiro ? "bg-emerald-600 hover:bg-emerald-700 text-white" : ""}`}
                      onClick={() => setDescontoParceiro(!descontoParceiro)}
                    >
                      <Handshake className="w-3.5 h-3.5" />
                      {descontoParceiro ? "Parceiro ativo (−10%)" : "Ativar desconto parceiro (−10%)"}
                    </Button>
                  </div>
                </div>
              </Section>

              {(() => {
                const tier = productTiers[Math.min(volumeIdx, productTiers.length - 1)];
                if (!tier) return null;
                const precoBase4sem = parseFloat(tier.precoBase ?? "0") || 0;
                const irpj = premissas.irpj / 100;
                const comRest = premissas.comissaoRestaurante / 100;
                const comCom = premissas.comissaoComercial / 100;
                const receitaLiquidaGPC = precoBase4sem * (1 - irpj - comRest - comCom);
                return (
                  <Section title="Receita Líquida GPC" icon={TrendingUp}>
                    <div className="space-y-2">
                      <EconRow label="Preço Base (4sem)" value={formatCurrency(precoBase4sem)} bold />
                      <EconRow label="IRPJ" value={`${premissas.irpj}% = ${formatCurrency(precoBase4sem * irpj)}`} />
                      <EconRow label="Com. Restaurante" value={`${premissas.comissaoRestaurante}% = ${formatCurrency(precoBase4sem * comRest)}`} />
                      <EconRow label="Com. Comercial" value={`${premissas.comissaoComercial}% = ${formatCurrency(precoBase4sem * comCom)}`} />
                      <EconRow label="Rec. Líquida GPC (4sem)" value={formatCurrency(receitaLiquidaGPC)} bold accent />
                    </div>
                  </Section>
                );
              })()}
            </div>

            <div className="lg:col-span-2 space-y-4">
              {(() => {
                const tier = productTiers[Math.min(volumeIdx, productTiers.length - 1)];
                if (!tier) return null;
                const precoBase4sem = parseFloat(tier.precoBase ?? "0") || 0;
                const irpj = premissas.irpj / 100;
                const comRest = premissas.comissaoRestaurante / 100;
                const comCom = premissas.comissaoComercial / 100;
                const receitaLiquidaGPC4sem = precoBase4sem * (1 - irpj - comRest - comCom);
                const nPeriodos = semanas / 4;
                const precoSemDescDuracao = precoBase4sem * nPeriodos;
                // Faixa discount applied on gross bruto amount (before prazo)
                const faixaTierDuracao = discountPriceTiers.find(t => precoSemDescDuracao >= t.priceMin && precoSemDescDuracao <= t.priceMax);
                const descFaixaDuracao = faixaTierDuracao ? faixaTierDuracao.discountPercent / 100 : 0;
                const precoPosFaixaDuracao = precoSemDescDuracao * (1 - descFaixaDuracao);
                const precoComDescDuracao = precoPosFaixaDuracao * (1 - descPrazo);
                const precoAntesDescParceiro = precoComDescDuracao * (1 + ajustePag);
                const descParcPerc = descontoParceiro ? 0.10 : 0;
                const precoFinal = precoAntesDescParceiro * (1 - descParcPerc);
                const descontoTotalValor = precoSemDescDuracao - precoFinal;
                const receitaMensal = nPeriodos > 0 ? precoFinal / nPeriodos : 0;

                const tabelaDuracao = SEMANAS.map((s) => {
                  const mult = s / 4;
                  const pSemDesc = precoBase4sem * mult;
                  const faixaTier = discountPriceTiers.find(t => pSemDesc >= t.priceMin && pSemDesc <= t.priceMax);
                  const descFaixa = faixaTier ? faixaTier.discountPercent / 100 : 0;
                  const pPosFaixa = pSemDesc * (1 - descFaixa);
                  const dsc = (descontosPrazo[s] || 0) / 100;
                  const pComDesc = pPosFaixa * (1 - dsc);
                  const pFinal = pComDesc * (1 + ajustePag) * (1 - descParcPerc);
                  const descontoTotalPerc = pSemDesc > 0 ? (pSemDesc - pFinal) / pSemDesc : 0;
                  const recMensal = mult > 0 ? pFinal / mult : 0;
                  return { semanas: s, desconto: dsc, descFaixa, precoSemDesconto: pSemDesc, precoComDesconto: pComDesc, precoFinal: pFinal, descontoTotalPerc, recMensal };
                });

                return (
                  <>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                      <KpiCard label="Preço Total" value={formatCurrency(precoFinal)} sub={`${semanas} sem • ${pagLabel}${descontoParceiro ? " • parceiro" : ""}`} variant="primary" icon={DollarSign} />
                      <KpiCard label="Preço Base (4sem)" value={formatCurrency(precoBase4sem)} sub="por período sem desconto" icon={TrendingUp} />
                      <KpiCard label="Receita Mensal" value={formatCurrency(receitaMensal)} sub={`${semanas} sem = ${nPeriodos} ${nPeriodos === 1 ? "mês" : "meses"}`} icon={CalendarDays} />
                      <KpiCard label="Desconto Total" value={formatCurrency(descontoTotalValor)} sub={`${semanas} sem economizados`} icon={PieChart} />
                    </div>

                    <Section title="Tabela por Duração" icon={BarChart3}>
                      <div className="overflow-x-auto -mx-3 px-3">
                        <table className="w-full text-xs min-w-[480px]">
                          <thead>
                            <tr className="border-b border-border/20">
                              <th className="text-left p-2.5 font-medium text-muted-foreground">Duração</th>
                              <th className="text-right p-2.5 font-medium text-muted-foreground">S/ Desc.</th>
                              <th className="text-center p-2.5 font-medium text-muted-foreground">Desc. Prazo</th>
                              <th className="text-right p-2.5 font-medium text-muted-foreground">Preço Final</th>
                              <th className="text-right p-2.5 font-medium text-muted-foreground text-blue-600 dark:text-blue-400">Rec. Mensal</th>
                              <th className="text-right p-2.5 font-medium text-muted-foreground text-emerald-600 dark:text-emerald-400">Desc. Total</th>
                            </tr>
                          </thead>
                          <tbody>
                            {tabelaDuracao.map((row) => (
                              <tr key={row.semanas} className={`border-b border-border/10 transition-colors ${row.semanas === semanas ? "bg-primary/10" : "hover:bg-muted/20"}`}>
                                <td className="p-2.5 font-medium">{row.semanas} sem</td>
                                <td className="p-2.5 text-right font-mono text-muted-foreground">{formatCurrency(row.precoSemDesconto)}</td>
                                <td className="p-2.5 text-center">
                                  {row.desconto > 0 ? <span className="text-emerald-400 font-mono text-xs font-semibold">-{(row.desconto * 100).toFixed(0)}%</span> : <span className="text-muted-foreground text-xs">—</span>}
                                  {row.descFaixa > 0 && <span className="block text-amber-400 font-mono text-[10px] font-semibold">faixa -{(row.descFaixa * 100).toFixed(0)}%</span>}
                                </td>
                                <td className="p-2.5 text-right font-mono font-semibold text-primary">{formatCurrency(row.precoFinal)}</td>
                                <td className="p-2.5 text-right font-mono text-blue-600 dark:text-blue-400">{formatCurrency(row.recMensal)}</td>
                                <td className="p-2.5 text-right font-mono text-emerald-600 dark:text-emerald-400">{row.descontoTotalPerc > 0 ? `-${(row.descontoTotalPerc * 100).toFixed(1)}%` : "—"}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </Section>
                  </>
                );
              })()}
            </div>
          </div>
        )
      ) : (
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="lg:col-span-1 space-y-4">
          <Section title="Inputs" icon={Package}>
            <div className="space-y-5">
              <div className="space-y-2">
                <Label className="text-xs flex items-center justify-between">
                  <span className="flex items-center gap-1.5"><Package className="w-3 h-3" /> Quantidade (un.)</span>
                  <span className="font-mono font-bold text-primary">{volume.toLocaleString("pt-BR")}</span>
                </Label>
                <Slider min={0} max={volumes.length - 1} step={1} value={[volumeIdx]} onValueChange={([v]) => setVolumeIdx(v)} />
                <div className="flex justify-between text-[10px] text-muted-foreground font-mono"><span>{volumes[0]?.toLocaleString("pt-BR")}</span><span>{volumes[volumes.length - 1]?.toLocaleString("pt-BR")}</span></div>
              </div>
              <div className="space-y-2">
                <Label className="text-xs flex items-center justify-between">
                  <span className="flex items-center gap-1.5"><Clock className="w-3 h-3" /> Semanas</span>
                  <span className="font-mono font-bold text-primary">{semanas}</span>
                </Label>
                <Slider min={0} max={SEMANAS.length - 1} step={1} value={[semanaIdx]} onValueChange={([v]) => setSemanaIdx(v)} />
                <div className="flex justify-between text-[10px] text-muted-foreground font-mono"><span>4</span><span>52</span></div>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs flex items-center gap-1.5"><CreditCard className="w-3 h-3" /> Pagamento</Label>
                <Select value={formaPagamento} onValueChange={setFormaPagamento}>
                  <SelectTrigger className="bg-background border-border/30 h-9 text-sm"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="pix">Pix {pagamentoConfig.pix > 0 && `(-${pagamentoConfig.pix}%)`}</SelectItem>
                    <SelectItem value="boleto">Boleto {pagamentoConfig.boleto > 0 && `(-${pagamentoConfig.boleto}%)`}</SelectItem>
                    <SelectItem value="cartao">Cartão {pagamentoConfig.cartao > 0 && `(+${pagamentoConfig.cartao}%)`}</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs flex items-center gap-1.5"><Handshake className="w-3 h-3" /> Desconto Parceiro</Label>
                <Button
                  variant={descontoParceiro ? "default" : "outline"}
                  size="sm"
                  className={`w-full gap-1.5 h-9 text-sm ${descontoParceiro ? "bg-emerald-600 hover:bg-emerald-700 text-white" : ""}`}
                  onClick={() => setDescontoParceiro(!descontoParceiro)}
                >
                  <Handshake className="w-3.5 h-3.5" />
                  {descontoParceiro ? "Parceiro ativo (−10%)" : "Ativar desconto parceiro (−10%)"}
                </Button>
              </div>
            </div>
          </Section>

          {!presentationMode && <div className="border border-border/30 rounded-lg overflow-hidden">
            <button
              onClick={() => setShowPremissas(!showPremissas)}
              className="w-full flex items-center justify-between p-3 text-xs font-medium text-muted-foreground hover:bg-muted/20 transition-colors"
            >
              <span className="flex items-center gap-1.5"><Settings2 className="w-3.5 h-3.5" /> Premissas (editáveis)</span>
              {showPremissas ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
            </button>

            {showPremissas && (
              <div className="p-3 pt-0 space-y-4">
                <div className="flex justify-end">
                  <Button variant="ghost" size="sm" className="h-6 text-[10px] gap-1 text-muted-foreground" onClick={resetPremissas}>
                    <RotateCcw className="w-3 h-3" /> Restaurar padrão
                  </Button>
                </div>

                <div className="space-y-2">
                  <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">Impostos e Comissões (%)</p>
                  <PremissaInput label="IRPJ" value={premissas.irpj} onChange={(v) => setPremissas((p) => ({ ...p, irpj: v }))} suffix="%" />
                  <PremissaInput label="Com. Restaurante" value={premissas.comissaoRestaurante} onChange={(v) => setPremissas((p) => ({ ...p, comissaoRestaurante: v }))} suffix="%" />
                  <PremissaInput label="Com. Comercial" value={premissas.comissaoComercial} onChange={(v) => setPremissas((p) => ({ ...p, comissaoComercial: v }))} suffix="%" />
                </div>

                <div className="space-y-2">
                  <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">Forma de Pagamento (%)</p>
                  <PremissaInput label="Desc. Pix" value={pagamentoConfig.pix} onChange={(v) => setPagamentoConfig((p) => ({ ...p, pix: v }))} suffix="%" />
                  <PremissaInput label="Desc. Boleto" value={pagamentoConfig.boleto} onChange={(v) => setPagamentoConfig((p) => ({ ...p, boleto: v }))} suffix="%" />
                  <PremissaInput label="Acrésc. Cartão" value={pagamentoConfig.cartao} onChange={(v) => setPagamentoConfig((p) => ({ ...p, cartao: v }))} suffix="%" />
                </div>

                <div className="space-y-2">
                  <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">Descontos por Prazo (%)</p>
                  <div className="grid grid-cols-2 gap-x-4 gap-y-1.5">
                    {SEMANAS.map((s) => (
                      <PremissaInput
                        key={s}
                        label={`${s} sem`}
                        value={descontosPrazo[s] ?? 0}
                        onChange={(v) => setDescontosPrazo((p) => ({ ...p, [s]: v }))}
                        suffix="%"
                      />
                    ))}
                  </div>
                </div>

                <div className="space-y-2">
                  <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">Custos por Volume</p>
                  <div className="overflow-x-auto -mx-3 px-3">
                    <table className="w-full text-[10px] min-w-[380px]">
                      <thead>
                        <tr className="border-b border-border/20">
                          <th className="text-left p-1 font-medium text-muted-foreground">Vol.</th>
                          <th className="text-right p-1 font-medium text-muted-foreground">GPC (R$)</th>
                          <th className="text-right p-1 font-medium text-muted-foreground">Margem</th>
                          <th className="text-right p-1 font-medium text-muted-foreground">Frete (R$)</th>
                          <th className="text-right p-1 font-medium text-muted-foreground">Artes</th>
                        </tr>
                      </thead>
                      <tbody>
                        {volumes.map((v: number) => (
                          <VolumeRow key={v} vol={v} data={custosVolume[v] || { custoGPC: 0.27, margem: 0.50, frete: 0, artes: 1 }} active={v === volume} onUpdate={(field, val) => updateVolumeDado(v, field, val)} />
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            )}
          </div>}

          {!presentationMode && <Section title="Custos" icon={Calculator}>
            <div className="space-y-2">
              <EconRow label="Custo GPC Unitário" value={`R$ ${dados.custoGPC.toFixed(4)}`} />
              <EconRow label="Custo Produção Total" value={formatCurrency(calc.custoProducao)} />
              <EconRow label="Frete" value={formatCurrency(dados.frete)} />
              <EconRow label="Custo Total (Prod+Frete)" value={formatCurrency(calc.custoTotal4sem)} bold />
            </div>
          </Section>}

          {!presentationMode && <Section title="Preço Sem Desconto" icon={DollarSign}>
            <div className="space-y-2">
              <EconRow label="Margem Alvo" value={`${(dados.margem * 100).toFixed(0)}%`} />
              <EconRow label="Denominador" value={calc.denominador.toFixed(4)} />
              {calc.denominador <= 0 && (
                <p className="text-[10px] text-red-400 font-medium">Denominador inválido: margem + deduções excedem 100%. Ajuste as premissas.</p>
              )}
              <EconRow label="Preço Unit. (4 sem, s/ desc.)" value={formatCurrency(calc.precoUnit4sem)} bold />
              <EconRow label="Preço Total (4 sem, s/ desc.)" value={formatCurrency(calc.precoTotalBase4sem)} bold />
            </div>
          </Section>}

          <Section title="Descontos" icon={TrendingDown}>
            <div className="space-y-2">
              <EconRow label="Desc. por Prazo" value={descPrazo > 0 ? `${(descPrazo * 100).toFixed(0)}%` : "—"} accent={descPrazo > 0} />
              <EconRow label="Desc. por Quantidade" value={calc.descontoQuantidade > 0 ? `${(calc.descontoQuantidade * 100).toFixed(1)}%` : "—"} accent={calc.descontoQuantidade > 0} />
              <EconRow label="Desc. Faixa de Preço" value={calc.descFaixaPrecoPerc > 0 ? `${(calc.descFaixaPrecoPerc * 100).toFixed(0)}%` : "—"} accent={calc.descFaixaPrecoPerc > 0} />
              <EconRow label="Desc. Forma Pagamento" value={ajustePag !== 0 ? `${Math.abs(ajustePag * 100).toFixed(0)}%` : "—"} accent={ajustePag < 0} />
              <EconRow label="Desc. Parceiro" value={descontoParceiro ? "10%" : "—"} accent={descontoParceiro} />
              <EconRow label="Desc. Combinado (vs base 1k/4sem)" value={calc.descCombinado > 0 ? `${(calc.descCombinado * 100).toFixed(1)}%` : "—"} accent={calc.descCombinado > 0} />
              <div className="border-t border-border/20 pt-2" />
              <EconRow label={`Nº Períodos (×4 sem)`} value={`${calc.nPeriodos}`} />
              <EconRow label="Preço Total c/ Descontos" value={formatCurrency(calc.precoFinal)} bold />
              <EconRow label="Preço Unit. c/ Descontos" value={formatCurrency(calc.precoUnitComDesc)} bold />
            </div>
          </Section>
        </div>

        <div className="lg:col-span-2 space-y-4">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <KpiCard label="Preço Total" value={formatCurrency(calc.precoFinal)} sub={`${semanas} sem • ${pagLabel}${descontoParceiro ? " • parceiro" : ""}`} variant="primary" icon={DollarSign} />
            <KpiCard label="Preço Unitário" value={formatCurrency(calc.precoUnitComDesc)} sub={`por ${selectedProduct?.unitLabel || "bolacha"} · ${semanas} semanas`} icon={TrendingUp} />
            <KpiCard label="Preço Mensal" value={formatCurrency(calc.precoMensal)} sub={`${semanas} sem = ${calc.nPeriodos} ${calc.nPeriodos === 1 ? "mês" : "meses"}`} icon={CalendarDays} />
            <KpiCard label="Desconto Total" value={calc.descCombinado > 0 ? `${(calc.descCombinado * 100).toFixed(1)}%` : "—"} sub={`vs base 1k / 4 sem${descontoParceiro ? " + parceiro" : ""}`} variant="discount" icon={TrendingDown} />
          </div>

          {!presentationMode && <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            <KpiCard label="Lucro Bruto" value={formatCurrency(calc.lucroBruto)} sub="rec. líquida − custo total" variant="success" icon={Percent} />
            <KpiCard label="Margem Líquida" value={`${(calc.margemLiquida * 100).toFixed(1)}%`} sub="após deduções" variant="success" icon={PieChart} />
            <KpiCard label="Custo Total" value={formatCurrency(calc.custoTotalPeriodo)} sub={`${calc.nPeriodos} períodos`} icon={Calculator} />
          </div>}

          {!presentationMode && <Section title="Comissões e Impostos" icon={BarChart3}>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-2">
              <EconRow label={`IRPJ (${premissas.irpj}%)`} value={formatCurrency(calc.valorIRPJ)} />
              <EconRow label={`Comissão Restaurante (${premissas.comissaoRestaurante}%)`} value={formatCurrency(calc.valorComRest)} />
              <EconRow label={`Comissão Comercial (${premissas.comissaoComercial}%)`} value={formatCurrency(calc.valorComCom)} />
              <EconRow label="Total Deduções" value={formatCurrency(calc.totalDeducoesValor)} bold />
            </div>
          </Section>}

          {!presentationMode && <Section title="Resultado Final" icon={TrendingUp}>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-2">
              <EconRow label="Receita Líquida (após deduções)" value={formatCurrency(calc.receitaLiquida)} />
              <EconRow label="Lucro Bruto (Rec.Líq. − Custo Total)" value={formatCurrency(calc.lucroBruto)} bold accent />
              <EconRow label="Margem Líquida (após deduções)" value={`${(calc.margemLiquida * 100).toFixed(1)}%`} accent />
              <EconRow label="Margem sobre Receita Total" value={`${(calc.margemSobreReceita * 100).toFixed(0)}%`} />
              <EconRow label="Lucro por Unidade" value={formatCurrency(calc.lucroPorUnidade)} />
              <EconRow label="Custo por Unidade (total)" value={formatCurrency(calc.custoPorUnidade)} />
            </div>
          </Section>}

          {!presentationMode && <Section title="Decomposição do Preço (por unidade)" icon={PieChart}>
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
          </Section>}

          <Section title="Distribuição de Restaurantes" icon={Store}>
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <div className="relative flex-1">
                  <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
                  <Input
                    placeholder="Buscar restaurante..."
                    className="pl-8 h-8 text-xs"
                    value={allocSearch}
                    onChange={(e) => setAllocSearch(e.target.value)}
                  />
                </div>
                {allocation.hasAllocations && (
                  <Button variant="outline" size="sm" className="h-8 gap-1 text-xs" onClick={allocation.distributeEvenly}>
                    <Divide className="w-3 h-3" /> Distribuir
                  </Button>
                )}
              </div>

              {allocSearch && availableRestaurants.length > 0 && (
                <div className="border border-border/20 rounded-md max-h-36 overflow-y-auto">
                  {availableRestaurants.slice(0, 10).map((r) => (
                    <button
                      key={r.id}
                      className="w-full flex items-center justify-between px-3 py-1.5 text-xs hover:bg-muted/30 transition-colors"
                      onClick={() => { allocation.addRestaurant(r.id); setAllocSearch(""); }}
                    >
                      <span className="flex items-center gap-1.5">
                        <Store className="w-3 h-3 text-muted-foreground" />
                        {r.name}
                        {r.neighborhood && <span className="text-muted-foreground flex items-center gap-0.5"><MapPin className="w-2.5 h-2.5" />{r.neighborhood}</span>}
                      </span>
                      <span className="text-muted-foreground font-mono">
                        {r.monthlyDrinksSold ? `cap. ${Math.round(r.monthlyDrinksSold * COASTER_CAPACITY_FACTOR)}` : ""}
                      </span>
                    </button>
                  ))}
                </div>
              )}

              {!allocation.hasAllocations && !allocSearch && (
                <p className="text-xs text-muted-foreground text-center py-3">Busque e adicione restaurantes para distribuir o volume de {volume.toLocaleString("pt-BR")} {selectedProduct?.unitLabelPlural || "bolachas"}</p>
              )}

              <div className="flex items-center justify-between text-xs">
                <span className="text-muted-foreground">{allocation.allocations.length} restaurante{allocation.allocations.length !== 1 ? "s" : ""}</span>
                <div className="flex items-center gap-2">
                  <span className="font-mono">{allocation.allocatedTotal.toLocaleString("pt-BR")} / {volume.toLocaleString("pt-BR")}</span>
                  {allocation.isValid ? (
                    <Badge variant="outline" className="border-emerald-500/30 bg-emerald-500/5 text-emerald-400 text-[10px] gap-1"><CheckCircle2 className="w-2.5 h-2.5" /> OK</Badge>
                  ) : allocation.hasAllocations ? (
                    <Badge variant="outline" className="border-amber-500/30 bg-amber-500/5 text-amber-400 text-[10px] gap-1"><AlertTriangle className="w-2.5 h-2.5" /> {allocation.remaining > 0 ? `faltam ${allocation.remaining.toLocaleString("pt-BR")}` : `excesso ${Math.abs(allocation.remaining).toLocaleString("pt-BR")}`}</Badge>
                  ) : null}
                </div>
              </div>

              {allocation.hasAllocations && (
                <div className="overflow-x-auto">
                  <table className="w-full text-xs min-w-[400px]">
                    <thead>
                      <tr className="border-b border-border/20">
                        <th className="text-left p-2 text-[10px] text-muted-foreground font-medium">Restaurante</th>
                        <th className="text-right p-2 text-[10px] text-muted-foreground font-medium">Cap.</th>
                        <th className="text-right p-2 text-[10px] text-muted-foreground font-medium">{selectedProduct?.unitLabelPlural ? selectedProduct.unitLabelPlural.charAt(0).toUpperCase() + selectedProduct.unitLabelPlural.slice(1) : "Bolachas"}</th>
                        <th className="text-center p-2 text-[10px] text-muted-foreground font-medium w-8"></th>
                      </tr>
                    </thead>
                    <tbody>
                      {allocation.allocations.map((a) => {
                        const rest = restaurantsForAllocation.find(r => r.id === a.restaurantId);
                        const cap = rest?.monthlyDrinksSold ? Math.round(rest.monthlyDrinksSold * COASTER_CAPACITY_FACTOR) : null;
                        const overCap = cap !== null && a.coasters > cap;
                        return (
                          <tr key={a.restaurantId} className="border-b border-border/5">
                            <td className="p-2">
                              <span className="font-medium">{rest?.name || `#${a.restaurantId}`}</span>
                              {rest?.neighborhood && <span className="text-muted-foreground ml-1 text-[10px]">{rest.neighborhood}</span>}
                            </td>
                            <td className="p-2 text-right font-mono text-muted-foreground">{cap !== null ? cap.toLocaleString("pt-BR") : "—"}</td>
                            <td className="p-2 text-right">
                              <input
                                type="number"
                                min={0}
                                className={`bg-transparent border border-border/30 rounded text-right font-mono w-16 text-xs h-6 px-1.5 focus:outline-none focus:border-primary/50 ${overCap ? "text-amber-400" : ""}`}
                                value={a.coasters}
                                onChange={(e) => allocation.updateCoasters(a.restaurantId, parseInt(e.target.value) || 0)}
                              />
                            </td>
                            <td className="p-2 text-center">
                              <button onClick={() => allocation.removeRestaurant(a.restaurantId)} className="text-muted-foreground hover:text-red-400 transition-colors">
                                <X className="w-3.5 h-3.5" />
                              </button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
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
                    <tr key={row.semanas} className={`border-b border-border/10 transition-colors ${row.semanas === semanas ? "bg-primary/10" : "hover:bg-muted/20"}`}>
                      <td className="p-2.5 font-medium">{row.semanas} sem</td>
                      <td className="p-2.5 text-right font-mono text-muted-foreground">{formatCurrency(row.precoSemDesconto)}</td>
                      <td className="p-2.5 text-center">
                        {row.desconto > 0 ? <span className="text-emerald-400 font-mono text-xs font-semibold">-{(row.desconto * 100).toFixed(0)}%</span> : <span className="text-muted-foreground text-xs">—</span>}
                        {row.descFaixa > 0 && <span className="block text-amber-400 font-mono text-[10px] font-semibold">faixa -{(row.descFaixa * 100).toFixed(0)}%</span>}
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
      )}

      <Dialog open={showCotacaoDialog} onOpenChange={setShowCotacaoDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FileText className="w-4 h-4 text-primary" />
              Criar Cotação
            </DialogTitle>
            <DialogDescription>
              Criar cotação a partir da simulação atual
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div className="space-y-3">
              <div className="space-y-1.5">
                <Label className="text-xs">Volume de {selectedProduct?.unitLabelPlural ? selectedProduct.unitLabelPlural.charAt(0).toUpperCase() + selectedProduct.unitLabelPlural.slice(1) : "Bolachas"} (un.)</Label>
                <input
                  type="number"
                  min={1}
                  className="w-full bg-background border border-border/30 rounded-md h-9 px-3 text-sm font-mono focus:outline-none focus:border-primary/50"
                  value={cotacaoVolume}
                  onChange={(e) => setCotacaoVolume(parseInt(e.target.value) || 0)}
                />
                <p className="text-[10px] text-muted-foreground">Pré-preenchido com o volume da simulação ({volume.toLocaleString("pt-BR")}). Ajuste conforme necessário.</p>
              </div>
              <div className="grid grid-cols-3 gap-3 p-3 bg-muted/30 rounded-lg text-xs">
                <div>
                  <span className="text-muted-foreground">Duração</span>
                  <p className="font-mono font-semibold">{semanas} semanas</p>
                </div>
                <div>
                  <span className="text-muted-foreground">Preço Unit.</span>
                  <p className="font-mono font-semibold">{formatCurrency(calc.precoUnitComDesc)}</p>
                </div>
                <div>
                  <span className="text-muted-foreground">Valor Total</span>
                  <p className="font-mono font-semibold text-primary">{formatCurrency(calc.precoUnitComDesc * cotacaoVolume * calc.nPeriodos)}</p>
                </div>
              </div>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs">Cliente (Anunciante)</Label>
              <Select value={selectedClientId} onValueChange={(v) => { setSelectedClientId(v); if (v !== "none") setSelectedLeadId("none"); }}>
                <SelectTrigger className="h-9 text-sm"><SelectValue placeholder="Selecione..." /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Nenhum</SelectItem>
                  {clientsList.filter((c) => c.status === "active").map((c) => (
                    <SelectItem key={c.id} value={String(c.id)}>{c.company || c.name} {c.cnpj ? `(${c.cnpj})` : ""}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs">Ou Lead</Label>
              <Select value={selectedLeadId} onValueChange={(v) => { setSelectedLeadId(v); if (v !== "none") setSelectedClientId("none"); }}>
                <SelectTrigger className="h-9 text-sm"><SelectValue placeholder="Selecione..." /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Nenhum</SelectItem>
                  {leadsList.map((l) => (
                    <SelectItem key={l.id} value={String(l.id)}>{l.company || l.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs">Observações (opcional)</Label>
              <Textarea
                className="text-sm resize-none"
                rows={3}
                placeholder="Anotações sobre esta cotação..."
                value={cotacaoNotes}
                onChange={(e) => setCotacaoNotes(e.target.value)}
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" size="sm" onClick={() => setShowCotacaoDialog(false)}>Cancelar</Button>
            <Button size="sm" className="gap-1.5" onClick={handleCreateCotacao} disabled={createMutation.isPending}>
              <Rocket className="w-3.5 h-3.5" />
              {createMutation.isPending ? "Criando..." : "Confirmar Cotação"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </PageContainer>
  );
}

function VolumeRow({ vol, data, active, onUpdate }: { vol: number; data: { custoGPC: number; margem: number; frete: number; artes: number }; active: boolean; onUpdate: (field: "custoGPC" | "margem" | "frete" | "artes", val: number) => void }) {
  const [gpc, setGpc] = useState(String(data.custoGPC));
  const [margem, setMargem] = useState(String(data.margem));
  const [frete, setFrete] = useState(String(data.frete));
  const [artes, setArtes] = useState(String(data.artes ?? 1));

  useEffect(() => { setGpc(String(data.custoGPC)); }, [data.custoGPC]);
  useEffect(() => { setMargem(String(data.margem)); }, [data.margem]);
  useEffect(() => { setFrete(String(data.frete)); }, [data.frete]);
  useEffect(() => { setArtes(String(data.artes ?? 1)); }, [data.artes]);

  const commit = (field: "custoGPC" | "margem" | "frete" | "artes", raw: string, setter: (s: string) => void, fallback: number) => {
    const parsed = parseFloat(raw);
    if (!isNaN(parsed)) onUpdate(field, parsed);
    else setter(String(fallback));
  };

  const cellCls = "bg-transparent border-none text-right font-mono text-[10px] focus:outline-none focus:bg-muted/30 rounded px-1";

  return (
    <tr className={`border-b border-border/5 ${active ? "bg-primary/5" : ""}`}>
      <td className="p-1 font-mono font-medium">{(vol / 1000).toFixed(0)}k</td>
      <td className="p-1 text-right">
        <input type="text" inputMode="decimal" className={`${cellCls} w-16`} value={gpc} onChange={(e) => setGpc(e.target.value)} onBlur={() => commit("custoGPC", gpc, setGpc, data.custoGPC)} />
      </td>
      <td className="p-1 text-right">
        <input type="text" inputMode="decimal" className={`${cellCls} w-12`} value={margem} onChange={(e) => setMargem(e.target.value)} onBlur={() => commit("margem", margem, setMargem, data.margem)} />
      </td>
      <td className="p-1 text-right">
        <input type="text" inputMode="decimal" className={`${cellCls} w-16`} value={frete} onChange={(e) => setFrete(e.target.value)} onBlur={() => commit("frete", frete, setFrete, data.frete)} />
      </td>
      <td className="p-1 text-right">
        <input type="text" inputMode="decimal" className={`${cellCls} w-10`} value={artes} onChange={(e) => setArtes(e.target.value)} onBlur={() => commit("artes", artes, setArtes, data.artes)} />
      </td>
    </tr>
  );
}

function PremissaInput({ label, value, onChange, suffix }: { label: string; value: number; onChange: (v: number) => void; suffix?: string }) {
  const [localVal, setLocalVal] = useState(String(value));

  useEffect(() => { setLocalVal(String(value)); }, [value]);

  const commitValue = () => {
    const parsed = parseFloat(localVal);
    if (!isNaN(parsed)) onChange(parsed);
    else setLocalVal(String(value));
  };
  return (
    <div className="flex items-center justify-between gap-2">
      <span className="text-[11px] text-muted-foreground">{label}</span>
      <div className="flex items-center gap-0.5">
        <input
          type="text"
          inputMode="decimal"
          className="bg-transparent border border-border/30 rounded text-right font-mono w-16 text-[11px] h-6 px-1.5 focus:outline-none focus:border-primary/50"
          value={localVal}
          onChange={(e) => setLocalVal(e.target.value)}
          onBlur={commitValue}
          onKeyDown={(e) => { if (e.key === "Enter") commitValue(); }}
        />
        {suffix && <span className="text-[10px] text-muted-foreground">{suffix}</span>}
      </div>
    </div>
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
  const borderClass = "border-border/30 bg-white dark:bg-card";
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
