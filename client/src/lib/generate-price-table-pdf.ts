import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

const GPC_COSTS = [
  { qty: 1000, unit: 0.4190, margin: 0.50 },
  { qty: 2000, unit: 0.3495, margin: 0.48 },
  { qty: 3000, unit: 0.3330, margin: 0.45 },
  { qty: 4000, unit: 0.3248, margin: 0.43 },
  { qty: 5000, unit: 0.2998, margin: 0.40 },
  { qty: 10000, unit: 0.2700, margin: 0.37 },
  { qty: 20000, unit: 0.2600, margin: 0.35 },
];

const FREIGHT_AZUL: Record<number, number> = {
  1000: 152.01,
  2000: 279.06,
  3000: 430.26,
  4000: 566.51,
  5000: 723.32,
  10000: 1548.62,
};

const FREIGHT_TABLE = [
  {
    qty: 1000,
    azul: 152.01,
    melhorEnvioPrazo: { logistica: "Sedex", valor: 202.03, prazo: "4 dias úteis" },
    melhorEnvioPreco: { logistica: "Latam", valor: 80.38, prazo: "7 dias úteis" },
    centralFretePrazo: null,
    centralFretePreco: null,
  },
  {
    qty: 2000,
    azul: 279.06,
    melhorEnvioPrazo: { logistica: "Sedex", valor: 386.50, prazo: "4 dias úteis" },
    melhorEnvioPreco: { logistica: "Latam", valor: 138.16, prazo: "7 dias úteis" },
    centralFretePrazo: null,
    centralFretePreco: null,
  },
  {
    qty: 3000,
    azul: 430.26,
    melhorEnvioPrazo: { logistica: "Sedex", valor: 609.54, prazo: "4 dias úteis" },
    melhorEnvioPreco: { logistica: "Latam", valor: 219.03, prazo: "7 dias úteis" },
    centralFretePrazo: null,
    centralFretePreco: null,
  },
  {
    qty: 4000,
    azul: 566.51,
    melhorEnvioPrazo: null,
    melhorEnvioPreco: null,
    centralFretePrazo: { logistica: "Atual Cargas", valor: 532.13, prazo: "19 dias úteis" },
    centralFretePreco: { logistica: "Amazon", valor: 194.87, prazo: "20 dias úteis" },
  },
  {
    qty: 5000,
    azul: 723.32,
    melhorEnvioPrazo: null,
    melhorEnvioPreco: null,
    centralFretePrazo: { logistica: "Atual Cargas", valor: 551.14, prazo: "19 dias úteis" },
    centralFretePreco: { logistica: "Favorita", valor: 234.64, prazo: "27 dias úteis" },
  },
  {
    qty: 10000,
    azul: 1548.62,
    melhorEnvioPrazo: null,
    melhorEnvioPreco: null,
    centralFretePrazo: { logistica: "Atual Cargas", valor: 624.49, prazo: "19 dias úteis" },
    centralFretePreco: { logistica: "Favorita", valor: 275.57, prazo: "27 dias úteis" },
  },
];

const WEEKS = [4, 8, 12, 16];

const BRAND_GREEN = [39, 216, 3] as const;
const DARK_BG = [13, 13, 13] as const;
const CARD_BG = [24, 24, 24] as const;
const HEADER_BG = [30, 30, 30] as const;
const TEXT_WHITE = [240, 240, 240] as const;
const TEXT_GRAY = [140, 140, 140] as const;
const TEXT_LIGHT = [200, 200, 200] as const;
const AMBER = [245, 158, 11] as const;

function fmtBRL(n: number): string {
  return n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function fmtUnit(n: number): string {
  return `R$ ${n.toFixed(4).replace(".", ",")}`;
}

function fmtQty(n: number): string {
  return n.toLocaleString("pt-BR");
}

function drawPageBg(doc: jsPDF) {
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  doc.setFillColor(...DARK_BG);
  doc.rect(0, 0, pageW, pageH, "F");
  doc.setFillColor(...BRAND_GREEN);
  doc.rect(0, 0, pageW, 3, "F");
}

function drawLogo(doc: jsPDF, x: number, y: number) {
  doc.setFont("helvetica", "bold");
  doc.setFontSize(22);
  doc.setTextColor(...TEXT_WHITE);
  doc.text("mesa", x, y);
  const mesaW = doc.getTextWidth("mesa");
  doc.setTextColor(...BRAND_GREEN);
  doc.text(".ads", x + mesaW, y);
}

function drawFooter(doc: jsPDF) {
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  doc.setFontSize(7);
  doc.setTextColor(...TEXT_GRAY);
  doc.setFont("helvetica", "normal");
  doc.text("mesa.ads — Plataforma de gestão", pageW / 2, pageH - 8, { align: "center" });
  doc.text("Documento confidencial — uso interno", pageW / 2, pageH - 4, { align: "center" });
}

function getFreightForQty(qty: number): number {
  if (FREIGHT_AZUL[qty]) return FREIGHT_AZUL[qty];
  if (qty === 20000) return FREIGHT_AZUL[10000] * 2;
  return 0;
}

export function generatePriceTablePDF(irpjOverride?: number) {
  const irpj = irpjOverride ?? 0.06;
  const comissaoRest = 0.15;
  const comissaoComercial = 0.10;
  function getDenominatorBase(m: number) { return 1 - m - irpj - comissaoRest; }
  function fmtPct(n: number) { return `${(n * 100).toFixed(0)}%`; }

  const doc = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();

  drawPageBg(doc);
  drawLogo(doc, 20, 22);

  doc.setFontSize(16);
  doc.setTextColor(...TEXT_WHITE);
  doc.setFont("helvetica", "bold");
  doc.text("Tabela de Preços", 20, 34);

  doc.setFontSize(9);
  doc.setTextColor(...TEXT_GRAY);
  doc.setFont("helvetica", "normal");
  const today = new Date().toLocaleDateString("pt-BR");
  doc.text(`Gerada em ${today}  |  Inclui frete (Azul Cargo)`, 20, 40);

  doc.setFillColor(...CARD_BG);
  doc.roundedRect(pageW - 155, 12, 140, 24, 3, 3, "F");
  doc.setFontSize(8);
  doc.setTextColor(...TEXT_GRAY);
  doc.text("COMPOSIÇÃO DO PREÇO", pageW - 150, 19);
  doc.setFontSize(8.5);
  doc.setTextColor(...TEXT_LIGHT);
  doc.text(`Margem: 50%→35% (escalonada)  |  IRPJ: ${(irpj * 100).toFixed(0)}%  |  Com. Rest.: 15%  |  Com. Comerc.: 10%`, pageW - 150, 26);
  doc.setTextColor(...TEXT_GRAY);
  doc.setFontSize(8);
  const irpjComRestPct = ((irpj + comissaoRest) * 100).toFixed(0);
  doc.text(`Preço = [(Custo + Frete) / (1 − margem − ${irpjComRestPct}%)] / (1 − 10%)`, pageW - 150, 32);

  function drawPriceTable(faces: number, startY: number) {
    const label = faces === 1 ? "1 FACE (frente)" : "2 FACES (frente e verso)";
    let yPos = startY;

    doc.setFillColor(...BRAND_GREEN);
    doc.roundedRect(20, yPos, 6, 6, 1, 1, "F");
    doc.setFont("helvetica", "bold");
    doc.setFontSize(11);
    doc.setTextColor(...TEXT_WHITE);
    doc.text(label, 30, yPos + 5);
    yPos += 10;

    const head = [["Volume", "Margem", "Produção", "Frete", "Custo Total", "Preço Unit.", "4 sem", "8 sem", "12 sem", "16 sem", "Lucro (4 sem)"]];
    const body: string[][] = [];

    for (const { qty, unit, margin: rowMargin } of GPC_COSTS) {
      const prodCost = unit * faces * qty;
      const freight = getFreightForQty(qty);
      const totalCost = prodCost + freight;
      const totalCostUnit = totalCost / qty;
      const denomBase = getDenominatorBase(rowMargin);
      const priceUnitBase = denomBase > 0 ? totalCostUnit / denomBase : 0;
      const priceUnit = comissaoComercial < 1 ? priceUnitBase / (1 - comissaoComercial) : 0;
      const total4 = priceUnit * qty;
      const lucro = total4 * rowMargin;
      const row = [
        fmtQty(qty),
        fmtPct(rowMargin),
        fmtBRL(prodCost),
        fmtBRL(freight),
        fmtBRL(totalCost),
        fmtUnit(priceUnit),
        ...WEEKS.map(w => fmtBRL(total4 * (w / 4))),
        fmtBRL(lucro),
      ];
      body.push(row);
    }

    autoTable(doc, {
      startY: yPos,
      head,
      body,
      theme: "plain",
      margin: { left: 12, right: 8 },
      styles: {
        fontSize: 7.5,
        textColor: TEXT_LIGHT as unknown as number[],
        cellPadding: { top: 2.5, bottom: 2.5, left: 2, right: 2 },
        lineColor: [40, 40, 40],
        lineWidth: 0.3,
      },
      headStyles: {
        fillColor: HEADER_BG as unknown as number[],
        textColor: TEXT_GRAY as unknown as number[],
        fontSize: 6.5,
        fontStyle: "bold",
        cellPadding: { top: 2.5, bottom: 2.5, left: 2, right: 2 },
      },
      bodyStyles: {
        fillColor: CARD_BG as unknown as number[],
      },
      alternateRowStyles: {
        fillColor: [20, 20, 20],
      },
      columnStyles: {
        0: { fontStyle: "bold", cellWidth: 16 },
        1: { halign: "center", fontStyle: "bold", textColor: AMBER as unknown as number[], cellWidth: 15 },
        2: { halign: "right", cellWidth: 22 },
        3: { halign: "right", cellWidth: 22 },
        4: { halign: "right", cellWidth: 24 },
        5: { fontStyle: "bold", textColor: BRAND_GREEN as unknown as number[], cellWidth: 24 },
        6: { halign: "right", cellWidth: 26 },
        7: { halign: "right", cellWidth: 26 },
        8: { halign: "right", cellWidth: 26 },
        9: { halign: "right", cellWidth: 26 },
        10: { halign: "right", fontStyle: "bold", textColor: [52, 211, 153] as unknown as number[], cellWidth: 26 },
      },
    });

    return (doc as any).lastAutoTable.finalY;
  }

  const tableEndY = drawPriceTable(1, 50);

  const boxY = tableEndY + 10;
  const boxH = 32;
  doc.setFillColor(...CARD_BG);
  doc.roundedRect(20, boxY, pageW - 35, boxH, 3, 3, "F");

  doc.setFont("helvetica", "bold");
  doc.setFontSize(8);
  doc.setTextColor(...TEXT_GRAY);
  doc.text("EXEMPLO: 5.000 BOLACHAS, 1 FACE, 4 SEMANAS (MARGEM 40%)", 28, boxY + 7);

  const exMargin = 0.40;
  const exDenomBase = getDenominatorBase(exMargin);
  const exProd = 0.2998 * 5000;
  const exFreight = FREIGHT_AZUL[5000];
  const exCostTotal = exProd + exFreight;
  const exPriceUnitBase = exDenomBase > 0 ? (exCostTotal / 5000) / exDenomBase : 0;
  const exPriceUnit = comissaoComercial < 1 ? exPriceUnitBase / (1 - comissaoComercial) : 0;
  const exTotal = exPriceUnit * 5000;

  const col1X = 28;
  const col2X = 105;
  const col3X = 192;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  doc.setTextColor(...TEXT_LIGHT);

  let lineY = boxY + 13;
  doc.text(`Produção: ${fmtBRL(exProd)}`, col1X, lineY);
  doc.text(`Frete (Azul Cargo): ${fmtBRL(exFreight)}`, col1X + 50, lineY);
  doc.setFont("helvetica", "bold");
  doc.text(`Custo base: ${fmtBRL(exCostTotal)}`, col2X + 32, lineY);
  doc.setTextColor(...BRAND_GREEN);
  doc.text(`PREÇO TOTAL: ${fmtBRL(exTotal)}`, col3X, lineY);

  lineY += 6;
  doc.setFont("helvetica", "normal");
  doc.setTextColor(...TEXT_LIGHT);
  doc.text(`IRPJ (${(irpj * 100).toFixed(0)}%): ${fmtBRL(exTotal * irpj)}`, col1X, lineY);
  doc.text(`Com. rest. (15%): ${fmtBRL(exTotal * comissaoRest)}`, col1X + 50, lineY);
  doc.text(`Com. comerc. (10%): ${fmtBRL(exTotal * comissaoComercial)}`, col2X + 32, lineY);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(...BRAND_GREEN);
  doc.text(`Preço unit.: ${fmtUnit(exPriceUnit)}`, col3X, lineY);

  lineY += 6;
  doc.setFont("helvetica", "normal");
  doc.setTextColor(...TEXT_LIGHT);
  doc.text(`Margem bruta (40%): ${fmtBRL(exTotal * exMargin)}`, col1X, lineY);

  drawFooter(doc);

  doc.addPage("a4", "landscape");
  drawPageBg(doc);
  drawLogo(doc, 20, 22);

  doc.setFontSize(16);
  doc.setTextColor(...TEXT_WHITE);
  doc.setFont("helvetica", "bold");
  doc.text("Tabela de Preços — 2 Faces", 20, 34);

  doc.setFontSize(9);
  doc.setTextColor(...TEXT_GRAY);
  doc.setFont("helvetica", "normal");
  doc.text(`Gerada em ${today}  |  Inclui frete (Azul Cargo)`, 20, 40);

  doc.setFillColor(...CARD_BG);
  doc.roundedRect(pageW - 155, 12, 140, 24, 3, 3, "F");
  doc.setFontSize(8);
  doc.setTextColor(...TEXT_GRAY);
  doc.text("COMPOSIÇÃO DO PREÇO", pageW - 150, 19);
  doc.setFontSize(8.5);
  doc.setTextColor(...TEXT_LIGHT);
  doc.text(`Margem: 50%→35% (escalonada)  |  IRPJ: ${(irpj * 100).toFixed(0)}%  |  Com. Rest.: 15%  |  Com. Comerc.: 10%`, pageW - 150, 26);
  doc.setTextColor(...TEXT_GRAY);
  doc.setFontSize(8);
  doc.text(`Preço = [(Custo × 2 + Frete) / (1 − margem − ${irpjComRestPct}%)] / (1 − 10%)`, pageW - 150, 32);

  drawPriceTable(2, 50);
  drawFooter(doc);

  doc.addPage("a4", "landscape");
  drawPageBg(doc);
  drawLogo(doc, 20, 22);

  doc.setFontSize(16);
  doc.setTextColor(...TEXT_WHITE);
  doc.setFont("helvetica", "bold");
  doc.text("Cotações de Frete", 20, 34);

  doc.setFontSize(9);
  doc.setTextColor(...TEXT_GRAY);
  doc.setFont("helvetica", "normal");
  doc.text("Azul Cargo e Plataformas  |  Referência: caixas padrão (1.000 un: 12×27×47 / 2.000 un: 24×27×47)", 20, 40);

  const freightHead = [[
    "Volume",
    "Azul Cargo",
    "ME - Melhor Prazo",
    "",
    "ME - Menor Preço",
    "",
    "CF - Melhor Prazo",
    "",
    "CF - Menor Preço",
    "",
  ]];

  const freightSubHead = [[
    "",
    "",
    "Logística / Valor",
    "Prazo",
    "Logística / Valor",
    "Prazo",
    "Logística / Valor",
    "Prazo",
    "Logística / Valor",
    "Prazo",
  ]];

  const freightBody: string[][] = [];

  for (const row of FREIGHT_TABLE) {
    const mePrazo = row.melhorEnvioPrazo;
    const mePreco = row.melhorEnvioPreco;
    const cfPrazo = row.centralFretePrazo;
    const cfPreco = row.centralFretePreco;

    freightBody.push([
      fmtQty(row.qty),
      fmtBRL(row.azul),
      mePrazo ? `${mePrazo.logistica} / ${fmtBRL(mePrazo.valor)}` : "—",
      mePrazo ? mePrazo.prazo : "—",
      mePreco ? `${mePreco.logistica} / ${fmtBRL(mePreco.valor)}` : "—",
      mePreco ? mePreco.prazo : "—",
      cfPrazo ? `${cfPrazo.logistica} / ${fmtBRL(cfPrazo.valor)}` : "—",
      cfPrazo ? cfPrazo.prazo : "—",
      cfPreco ? `${cfPreco.logistica} / ${fmtBRL(cfPreco.valor)}` : "—",
      cfPreco ? cfPreco.prazo : "—",
    ]);
  }

  autoTable(doc, {
    startY: 48,
    head: freightHead,
    body: [freightSubHead[0], ...freightBody],
    theme: "plain",
    margin: { left: 15, right: 15 },
    styles: {
      fontSize: 8,
      textColor: TEXT_LIGHT as unknown as number[],
      cellPadding: { top: 2.5, bottom: 2.5, left: 3, right: 3 },
      lineColor: [40, 40, 40],
      lineWidth: 0.3,
    },
    headStyles: {
      fillColor: HEADER_BG as unknown as number[],
      textColor: TEXT_GRAY as unknown as number[],
      fontSize: 7,
      fontStyle: "bold",
    },
    bodyStyles: {
      fillColor: CARD_BG as unknown as number[],
    },
    alternateRowStyles: {
      fillColor: [20, 20, 20],
    },
    columnStyles: {
      0: { fontStyle: "bold", cellWidth: 18 },
      1: { fontStyle: "bold", textColor: AMBER as unknown as number[], cellWidth: 24 },
    },
    didParseCell: (data: any) => {
      if (data.section === "body" && data.row.index === 0) {
        data.cell.styles.fillColor = HEADER_BG;
        data.cell.styles.textColor = TEXT_GRAY;
        data.cell.styles.fontSize = 6.5;
        data.cell.styles.fontStyle = "bold";
      }
    },
  });

  const ftY = (doc as any).lastAutoTable.finalY + 10;
  doc.setFillColor(...CARD_BG);
  doc.roundedRect(15, ftY, pageW - 30, 18, 3, 3, "F");
  doc.setFont("helvetica", "bold");
  doc.setFontSize(8);
  doc.setTextColor(...TEXT_GRAY);
  doc.text("OBSERVAÇÕES", 22, ftY + 6);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  doc.setTextColor(...TEXT_LIGHT);
  doc.text("• Cotações realizadas com referências de caixas padrões", 22, ftY + 11);
  doc.text("• Caixa 1.000 unidades: 12×27×47  |  Caixa 2.000 unidades: 24×27×47", 22, ftY + 15.5);

  const bkY = ftY + 24;
  const bkH = 70;
  doc.setFillColor(...CARD_BG);
  doc.roundedRect(15, bkY, pageW - 30, bkH, 3, 3, "F");

  doc.setFont("helvetica", "bold");
  doc.setFontSize(9);
  doc.setTextColor(...TEXT_GRAY);
  doc.text("BREAKDOWN DE CUSTOS E FÓRMULA DE PRECIFICAÇÃO", 22, bkY + 7);

  doc.setDrawColor(...BRAND_GREEN);
  doc.setLineWidth(0.5);
  doc.line(22, bkY + 10, pageW - 22, bkY + 10);

  const leftX = 22;
  const midX = 150;
  let bkLineY = bkY + 17;

  doc.setFont("helvetica", "bold");
  doc.setFontSize(8.5);
  doc.setTextColor(...BRAND_GREEN);
  doc.text("COMPOSIÇÃO DO PREÇO DE VENDA", leftX, bkLineY);

  doc.setTextColor(...TEXT_WHITE);
  doc.text("FÓRMULA", midX, bkLineY);

  bkLineY += 7;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  doc.setTextColor(...TEXT_LIGHT);

  const components = [
    { label: "Custo de Produção (GPC)", pct: "variável", desc: "Custo unitário × faces × quantidade" },
    { label: "Frete (Azul Cargo)", pct: "variável", desc: "Custo fixo por faixa de volume" },
    { label: "Margem Bruta (escalonada)", pct: "50%→35%", desc: "Maior volume = menor margem" },
    { label: "IRPJ (tributário)", pct: `${(irpj * 100).toFixed(0)}%`, desc: "Imposto sobre receita" },
    { label: "Comissão Restaurante", pct: "15%", desc: "Repasse ao parceiro restaurante" },
    { label: "Comissão Comercial", pct: "10%", desc: "Comissão do vendedor" },
  ];

  for (const c of components) {
    doc.setTextColor(...TEXT_LIGHT);
    doc.text(`• ${c.label}`, leftX + 2, bkLineY);
    doc.setTextColor(...TEXT_GRAY);
    doc.text(`(${c.pct})`, leftX + 62, bkLineY);
    doc.text(`— ${c.desc}`, leftX + 82, bkLineY);
    bkLineY += 5;
  }

  const fmLeftX = midX;
  let fmY = bkY + 24;
  doc.setFillColor(20, 20, 20);
  doc.roundedRect(fmLeftX - 2, fmY - 3, pageW - fmLeftX - 20, 41, 2, 2, "F");

  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  doc.setTextColor(...TEXT_GRAY);
  doc.text("1.", fmLeftX + 4, fmY + 2);
  doc.setTextColor(...TEXT_LIGHT);
  doc.text("Custo Base = (GPC unit. × faces × qtd) + Frete", fmLeftX + 10, fmY + 2);

  fmY += 7;
  doc.setTextColor(...TEXT_GRAY);
  doc.text("2.", fmLeftX + 4, fmY + 2);
  doc.setTextColor(...TEXT_LIGHT);
  doc.text(`Preço Base = Custo Base / (1 − margem − ${irpj.toFixed(2).replace(".", ",")} − 0,15)`, fmLeftX + 10, fmY + 2);

  fmY += 7;
  doc.setTextColor(...TEXT_GRAY);
  doc.text("3.", fmLeftX + 4, fmY + 2);
  doc.setTextColor(...TEXT_LIGHT);
  doc.text("Preço Unit. = (Preço Base / qtd) / (1 − 0,10)", fmLeftX + 10, fmY + 2);

  fmY += 7;
  doc.setFont("helvetica", "normal");
  doc.setTextColor(...TEXT_GRAY);
  doc.text("4.", fmLeftX + 4, fmY + 2);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(...BRAND_GREEN);
  doc.text("Preço Total = Preço Unit. × quantidade × (semanas / 4)", fmLeftX + 10, fmY + 2);

  drawFooter(doc);

  doc.save("tabela-precos-mesa-ads.pdf");
}
