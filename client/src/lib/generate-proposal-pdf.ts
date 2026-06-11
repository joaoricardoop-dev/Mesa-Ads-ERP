import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { LOGO_WHITE_BASE64 } from "./pdf-assets";
import { computeProposalLinePrices } from "@shared/proposal-line-pricing";
import { PROPOSAL_BINDING_CLAUSE_PREFIX, CAMPAIGN_TERM_BINDING_CLAUSE_PREFIX } from "@shared/const";
import { fetchContractLinks } from "./contract-links";
import {
  PDF_FONT as FONT_NAME,
  PDF_COLORS,
  GREEN,
  BLACK,
  WHITE,
  DARK_GRAY,
  GRAY,
  LIGHT_GRAY,
  registerPdfFonts,
  drawPdfHeader,
  drawPdfSectionTitle,
  drawPdfInfoRow,
  pdfCheckPageBreak,
} from "./pdf-branding";

interface ProposalItem {
  productName: string;
  volume: number;
  semanas: number;
  unitPrice: number;
  totalPrice: number;
  spotSeconds?: 15 | 30 | null;
  impressionsPerRestaurant?: number;
  numRestaurants?: number;
}

interface ProposalPDFData {
  clientName: string;
  clientCompany?: string;
  clientCnpj?: string;
  clientEmail?: string;
  clientPhone?: string;
  quotationName?: string;
  coasterVolume: number;
  numRestaurants: number;
  coastersPerRestaurant: number;
  contractDuration: number;
  pricePerRestaurant: number;
  monthlyTotal: number;
  contractTotal: number;
  includesProduction: boolean;
  restaurants: Array<{
    name: string;
    neighborhood: string;
    coasters: number;
  }>;
  validityDays?: number;
  agencyCommissionPercent?: number;
  hasPartnerDiscount?: boolean;
  productName?: string;
  productUnitLabelPlural?: string;
  semanas?: number;
  /** Multi-product items from BudgetCreator. When provided, switches to multi-product PDF layout. */
  items?: ProposalItem[];
  isBonificada?: boolean;
  periodStart?: string;
  batchWeeks?: number;
  /** Custom product (Projeto Sob Medida) fields */
  isCustomProduct?: boolean;
  customProductName?: string;
  customProjectCost?: number;
  customPricingMode?: string;
  customMarginPercent?: number;
  customRestaurantCommission?: number;
  customPartnerCommission?: number;
  customSellerCommission?: number;
  customFinalPrice?: number;
  /** Telas (screen/TV) product fields */
  isTelas?: boolean;
  telasMonthlyCustomers?: number;
  telasImpressions30s?: number;
  telasImpressions15s?: number;
  /** IRPJ rate for the product (decimal, e.g. 0.06). Defaults to 6% if not provided. */
  irpj?: number;
  /** Task #197 — cronograma de parcelas (opcional). */
  billingSchedule?: Array<{ sequence: number; amount: string | number; dueDate: string; notes?: string | null }>;
  /**
   * Registro de assinatura digital — presente apenas para cotações
   * convertidas/assinadas. Origem única: quotations.signedAt / signedBy /
   * signatureData (campo JSON com name, cpf, ip, userAgent, hash). Quando
   * presente, o PDF mostra o registro do cliente em vez das linhas de
   * assinatura manual.
   */
  signature?: {
    signerName: string;
    signerCpf?: string;
    signedAt: string;
    signatureHash?: string;
    ip?: string;
  };
}

const DEFAULT_IRPJ = 0.06;
void PDF_COLORS;
const PRICING_DEDUCTIONS = { comRestaurante: 0.15, comComercial: 0.10 };

const DEFAULT_CUSTOS_VOLUME: Array<{ vol: number; custoGPC: number; frete: number; artes: number; margem: number }> = [
  { vol: 1000,  custoGPC: 0.4190, frete: 80.38,   artes: 1, margem: 0.50 },
  { vol: 2000,  custoGPC: 0.3495, frete: 138.16,  artes: 1, margem: 0.50 },
  { vol: 3000,  custoGPC: 0.3330, frete: 219.03,  artes: 1, margem: 0.50 },
  { vol: 4000,  custoGPC: 0.3248, frete: 299.41,  artes: 1, margem: 0.50 },
  { vol: 5000,  custoGPC: 0.2998, frete: 357.19,  artes: 1, margem: 0.50 },
  { vol: 6000,  custoGPC: 0.2998, frete: 438.06,  artes: 1, margem: 0.50 },
  { vol: 7000,  custoGPC: 0.2998, frete: 518.44,  artes: 1, margem: 0.50 },
  { vol: 8000,  custoGPC: 0.2998, frete: 576.22,  artes: 1, margem: 0.50 },
  { vol: 9000,  custoGPC: 0.2998, frete: 657.09,  artes: 1, margem: 0.50 },
  { vol: 10000, custoGPC: 0.2700, frete: 737.47,  artes: 1, margem: 0.50 },
  { vol: 11000, custoGPC: 0.2700, frete: 876.12,  artes: 1, margem: 0.50 },
  { vol: 12000, custoGPC: 0.2700, frete: 956.50,  artes: 1, margem: 0.50 },
  { vol: 13000, custoGPC: 0.2700, frete: 1094.66, artes: 1, margem: 0.50 },
  { vol: 14000, custoGPC: 0.2700, frete: 1175.53, artes: 1, margem: 0.50 },
  { vol: 15000, custoGPC: 0.2700, frete: 1255.91, artes: 1, margem: 0.50 },
  { vol: 16000, custoGPC: 0.2700, frete: 1313.69, artes: 1, margem: 0.50 },
  { vol: 17000, custoGPC: 0.2700, frete: 1394.56, artes: 1, margem: 0.50 },
  { vol: 18000, custoGPC: 0.2700, frete: 1474.94, artes: 1, margem: 0.50 },
  { vol: 19000, custoGPC: 0.2700, frete: 1532.72, artes: 1, margem: 0.50 },
  { vol: 20000, custoGPC: 0.2600, frete: 1613.59, artes: 1, margem: 0.50 },
];

const DEFAULT_DESCONTOS_PRAZO: Record<number, number> = {
  4: 0, 8: 3, 12: 5, 16: 7, 20: 9, 24: 11, 28: 13, 32: 15, 36: 17, 40: 19, 44: 21, 48: 23, 52: 25,
};

function getTierForVolume(vol: number) {
  const sorted = [...DEFAULT_CUSTOS_VOLUME].sort((a, b) => a.vol - b.vol);
  let match = sorted[0];
  for (const tier of sorted) {
    if (vol >= tier.vol) match = tier;
    else break;
  }
  return match;
}

function calcUnitPriceFromTier(tier: typeof DEFAULT_CUSTOS_VOLUME[0], vol: number, irpjRate: number = DEFAULT_IRPJ): number {
  const custoTotal = tier.custoGPC * tier.artes * vol + tier.frete;
  const denominadorBase = 1 - tier.margem - irpjRate - PRICING_DEDUCTIONS.comRestaurante;
  const comCom = PRICING_DEDUCTIONS.comComercial;
  const precoBase = denominadorBase > 0 ? custoTotal / denominadorBase : 0;
  const precoTotal = comCom < 1 ? precoBase / (1 - comCom) : 0;
  return vol > 0 ? precoTotal / vol : 0;
}

function getVexaUnitPrice1000(irpjRate: number = DEFAULT_IRPJ): number {
  const tier = getTierForVolume(1000);
  return calcUnitPriceFromTier(tier, 1000, irpjRate);
}

function getVexaUnitPriceForVolume(vol: number, irpjRate: number = DEFAULT_IRPJ): number {
  const tier = getTierForVolume(vol);
  return calcUnitPriceFromTier(tier, vol, irpjRate);
}

function getPrazoDiscountPercent(semanas: number): number {
  const keys = Object.keys(DEFAULT_DESCONTOS_PRAZO).map(Number).sort((a, b) => a - b);
  let pct = 0;
  for (const k of keys) {
    if (semanas >= k) pct = DEFAULT_DESCONTOS_PRAZO[k];
    else break;
  }
  return pct;
}

const registerFonts = registerPdfFonts;

function fmtCurrency(val: number): string {
  return `R$ ${val.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function fmtNumber(val: number): string {
  return val.toLocaleString("pt-BR");
}

function fmtPercent(val: number): string {
  return `${val.toLocaleString("pt-BR", { minimumFractionDigits: 1, maximumFractionDigits: 1 })}%`;
}

function justifyText(doc: jsPDF, text: string, x: number, y: number, maxWidth: number, lineHeight: number): number {
  const words = text.split(" ");
  let line = "";
  const lines: string[] = [];

  for (const word of words) {
    const testLine = line ? `${line} ${word}` : word;
    if (doc.getTextWidth(testLine) > maxWidth && line) {
      lines.push(line);
      line = word;
    } else {
      line = testLine;
    }
  }
  if (line) lines.push(line);

  for (let i = 0; i < lines.length; i++) {
    const isLastLine = i === lines.length - 1;
    if (isLastLine || lines[i].split(" ").length <= 1) {
      doc.text(lines[i], x, y);
    } else {
      const lineWords = lines[i].split(" ");
      const totalTextWidth = lineWords.reduce((sum, w) => sum + doc.getTextWidth(w), 0);
      const totalSpacing = maxWidth - totalTextWidth;
      const spaceWidth = totalSpacing / (lineWords.length - 1);
      let currentX = x;
      for (let j = 0; j < lineWords.length; j++) {
        doc.text(lineWords[j], currentX, y);
        currentX += doc.getTextWidth(lineWords[j]) + spaceWidth;
      }
    }
    y += lineHeight;
  }

  return y;
}

function drawHeader(doc: jsPDF, _pageWidth: number, margin: number) {
  const today = new Date().toLocaleDateString("pt-BR", { day: "2-digit", month: "long", year: "numeric" });
  drawPdfHeader(doc, { eyebrow: "PROPOSTA COMERCIAL", meta: today, margin });
}

const drawSectionTitle = drawPdfSectionTitle;
const drawInfoRow = drawPdfInfoRow;
const checkPageBreak = pdfCheckPageBreak;

export async function generateProposalPdf(data: ProposalPDFData) {
  const { masterContractUrl, campaignTermUrl } = await fetchContractLinks();
  const doc = new jsPDF();
  registerFonts(doc);

  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 20;
  const contentWidth = pageWidth - margin * 2;

  const isMultiProduct = !!(data.items && data.items.length > 0);
  const isCustomProduct = data.isCustomProduct === true;
  const isBonificada = data.isBonificada === true;
  // Em cotações mistas (custom + itens), customFinalPrice carrega a fatia
  // do projeto sob medida e contractTotal é a soma. Subtraímos para obter
  // o subtotal só dos itens padrão.
  const customFinalPriceVal = isCustomProduct && data.customFinalPrice && data.customFinalPrice > 0
    ? data.customFinalPrice : 0;
  const isMixed = isCustomProduct && isMultiProduct;

  const numRest = data.numRestaurants > 0 ? data.numRestaurants : 1;
  const monthlyTotal = data.monthlyTotal > 0 ? data.monthlyTotal : data.pricePerRestaurant * numRest;
  const pricePerRestaurant = data.pricePerRestaurant > 0 ? data.pricePerRestaurant : (monthlyTotal / numRest);
  const contractTotal = data.contractTotal > 0 ? data.contractTotal : monthlyTotal * data.contractDuration;
  const cycles = data.contractDuration;
  const semanas = data.semanas ?? (cycles * 4);

  const irpjRate = data.irpj ?? DEFAULT_IRPJ;
  const vexaUnitPrice1000 = getVexaUnitPrice1000(irpjRate);
  const listPriceTotal = vexaUnitPrice1000 * data.coasterVolume * cycles;

  const hasDetailedDiscounts = data.semanas !== undefined;

  let discountPercent = 0;
  let discountValue = 0;

  if (!isMultiProduct && listPriceTotal > 0 && listPriceTotal > contractTotal) {
    discountValue = listPriceTotal - contractTotal;
    discountPercent = (discountValue / listPriceTotal) * 100;
  }

  drawHeader(doc, pageWidth, margin);

  let y = 56;

  if (data.quotationName) {
    doc.setTextColor(...GRAY);
    doc.setFontSize(8);
    doc.setFont(FONT_NAME, "normal");
    doc.text(`Ref: ${data.quotationName}`, margin, y);
    y += 10;
  }

  y = drawSectionTitle(doc, "DESTINATÁRIO", y, margin);

  if (data.clientCompany) {
    y = drawInfoRow(doc, "Empresa:", data.clientCompany, y, margin);
  }
  y = drawInfoRow(doc, "Nome:", data.clientName, y, margin);
  if (data.clientCnpj) {
    y = drawInfoRow(doc, "CNPJ:", data.clientCnpj, y, margin);
  }
  if (data.clientEmail) {
    y = drawInfoRow(doc, "E-mail:", data.clientEmail, y, margin);
  }
  if (data.clientPhone) {
    y = drawInfoRow(doc, "Telefone:", data.clientPhone, y, margin);
  }

  y += 8;
  y = drawSectionTitle(doc, "SOBRE A MESA ADS", y, margin);

  doc.setTextColor(...DARK_GRAY);
  doc.setFontSize(9);
  doc.setFont(FONT_NAME, "normal");
  const unitLabel = data.productUnitLabelPlural || "bolachas de chopp";
  const prodName = data.productName || "bolachas de chopp personalizadas";
  const aboutText =
    `A Mesa Ads é especialista em mídia offline de alto impacto: ${unitLabel} personalizadas, distribuídas em restaurantes e bares selecionados. Sua marca presente na mesa do consumidor — no momento mais descontraído do dia, gerando milhares de impressões orgânicas por mês com alta retenção.`;
  y = justifyText(doc, aboutText, margin, y, contentWidth, 4.5);
  y += 8;

  // ── SECTION: Service description / Products ──────────────────────────────
  // Em cotações mistas, renderizamos os dois blocos de forma aditiva: tabela
  // de itens padrão primeiro (usando itemsSubtotal no rodapé) e em seguida o
  // bloco de projeto sob medida. Single-product cai no `else` final.
  const itemsSubtotalForPdf = isMixed
    ? Math.max(0, contractTotal - customFinalPriceVal)
    : contractTotal;

  if (isMultiProduct) {
    // Multi-product layout: show a table of all budget items
    y = checkPageBreak(doc, y, 60);
    y = drawSectionTitle(doc, "PRODUTOS DO ORÇAMENTO", y, margin);

    const items = data.items!;
    const totalVolume = items.reduce((s, i) => s + i.volume, 0);
    const scaledLines = computeProposalLinePrices(items, itemsSubtotalForPdf);
    const itemsFootLabel = isMixed ? "Subtotal itens" : "Total";
    const hasTelasItems = items.some(i => i.spotSeconds !== null && i.spotSeconds !== undefined);

    if (hasTelasItems) {
      autoTable(doc, {
        startY: y,
        head: [["Produto", "Duração", "Spot", "Impressões/Rest./Mês", "Total"]],
        body: items.map((item, idx) => [
          item.productName,
          `${item.semanas} sem.`,
          item.spotSeconds ? `${item.spotSeconds}s` : "—",
          item.impressionsPerRestaurant !== undefined ? fmtNumber(item.impressionsPerRestaurant) : "—",
          isBonificada ? "Bonificado" : fmtCurrency(scaledLines[idx].totalPrice),
        ]),
        foot: [[
          `${items.length} produto${items.length !== 1 ? "s" : ""}`,
          "",
          "",
          itemsFootLabel,
          isBonificada ? "R$ 0,00" : fmtCurrency(itemsSubtotalForPdf),
        ]],
        theme: "grid",
        styles: { font: FONT_NAME, fontSize: 8 },
        headStyles: { fillColor: [...BLACK], textColor: [...WHITE], fontSize: 8, fontStyle: "bold", font: FONT_NAME },
        bodyStyles: { textColor: [40, 40, 40], font: FONT_NAME },
        footStyles: { fillColor: [...LIGHT_GRAY], textColor: [...BLACK], fontSize: 8, fontStyle: "bold", font: FONT_NAME },
        alternateRowStyles: { fillColor: [250, 250, 250] },
        margin: { left: margin, right: margin },
        columnStyles: {
          1: { halign: "center", cellWidth: 20 },
          2: { halign: "center", cellWidth: 16 },
          3: { halign: "right", cellWidth: 42 },
          4: { halign: "right", fontStyle: "bold", cellWidth: 32 },
        },
      });
    } else {
      autoTable(doc, {
        startY: y,
        head: [["Produto", "Duração", "Volume", "Preço/un.", "Total"]],
        body: items.map((item, idx) => [
          item.productName,
          `${item.semanas} sem.`,
          fmtNumber(item.volume) + " un.",
          isBonificada ? "—" : `R$ ${scaledLines[idx].unitPrice.toFixed(4)}`,
          isBonificada ? "Bonificado" : fmtCurrency(scaledLines[idx].totalPrice),
        ]),
        foot: [[
          `${items.length} produto${items.length !== 1 ? "s" : ""}`,
          "",
          fmtNumber(totalVolume) + " un.",
          itemsFootLabel,
          isBonificada ? "R$ 0,00" : fmtCurrency(itemsSubtotalForPdf),
        ]],
        theme: "grid",
        styles: { font: FONT_NAME, fontSize: 8 },
        headStyles: { fillColor: [...BLACK], textColor: [...WHITE], fontSize: 8, fontStyle: "bold", font: FONT_NAME },
        bodyStyles: { textColor: [40, 40, 40], font: FONT_NAME },
        footStyles: { fillColor: [...LIGHT_GRAY], textColor: [...BLACK], fontSize: 8, fontStyle: "bold", font: FONT_NAME },
        alternateRowStyles: { fillColor: [250, 250, 250] },
        margin: { left: margin, right: margin },
        columnStyles: {
          1: { halign: "center", cellWidth: 22 },
          2: { halign: "right", cellWidth: 28 },
          3: { halign: "right", cellWidth: 28 },
          4: { halign: "right", fontStyle: "bold", cellWidth: 32 },
        },
      });
    }

    y = (doc as unknown as { lastAutoTable?: { finalY?: number } }).lastAutoTable?.finalY || y + 40;
    y += 8;

    // Service info below table
    y = checkPageBreak(doc, y, 30);
    if (data.includesProduction) {
      y = drawInfoRow(doc, "Produção:", "Inclusa no valor", y, margin);
    }
    if (data.numRestaurants > 0) {
      y = drawInfoRow(doc, "Distribuição:", `${data.numRestaurants} restaurante${data.numRestaurants !== 1 ? "s" : ""} parceiro${data.numRestaurants !== 1 ? "s" : ""}`, y, margin);
    }
  }

  if (isCustomProduct) {
    y = checkPageBreak(doc, y, 60);
    y = drawSectionTitle(doc, isMixed ? "PROJETO SOB MEDIDA" : "PROPOSTA DE PROJETO", y, margin);
    const projName = data.customProductName || data.productName || "Projeto Sob Medida";
    y = drawInfoRow(doc, "Projeto:", projName, y, margin);
    y += 4;
    if (!isMixed) {
      // Em pure-custom mantemos o bloco "VALOR DO PROJETO". Em mixed, o total
      // geral aparece depois, no bloco unificado de INVESTIMENTO.
      y = checkPageBreak(doc, y, 20);
      y = drawSectionTitle(doc, "VALOR DO PROJETO", y, margin);
      y = drawInfoRow(doc, "Valor Total:", isBonificada ? "R$ 0,00 (Bonificada)" : fmtCurrency(contractTotal), y, margin);
    } else {
      y = drawInfoRow(doc, "Subtotal projeto:", isBonificada ? "R$ 0,00" : fmtCurrency(customFinalPriceVal), y, margin);
    }
    y += 8;
  }

  if (!isCustomProduct && !isMultiProduct) {
    // Single-product layout (original flow)
    y = checkPageBreak(doc, y, 60);
    y = drawSectionTitle(doc, "DESCRIÇÃO DO SERVIÇO", y, margin);

    if (data.isTelas) {
      y = drawInfoRow(doc, "Formato:", `${prodName}`, y, margin);
      if (data.numRestaurants > 0) {
        y = drawInfoRow(doc, "Distribuição:", `${data.numRestaurants} restaurante${data.numRestaurants !== 1 ? "s" : ""} parceiro${data.numRestaurants !== 1 ? "s" : ""}`, y, margin);
      } else {
        y = drawInfoRow(doc, "Distribuição:", "A definir", y, margin);
      }
      y = drawInfoRow(doc, "Duração:", `${data.contractDuration} ${data.contractDuration === 1 ? "mês" : "meses"}`, y, margin);
      y += 4;
      y = checkPageBreak(doc, y, 40);
      y = drawSectionTitle(doc, "OPÇÕES DE SPOT E IMPRESSÕES", y, margin);
      if (data.telasMonthlyCustomers) {
        y = drawInfoRow(doc, "Consumidores/mês (média):", `${fmtNumber(data.telasMonthlyCustomers)} clientes`, y, margin);
      }
      if (data.telasImpressions30s !== undefined) {
        y = drawInfoRow(doc, "Spot 30s (50 inserções/dia):", `${fmtNumber(data.telasImpressions30s)} impressões/mês/restaurante`, y, margin);
      }
      if (data.telasImpressions15s !== undefined) {
        y = drawInfoRow(doc, "Spot 15s (100 inserções/dia):", `${fmtNumber(data.telasImpressions15s)} impressões/mês/restaurante`, y, margin);
      }
    } else {
      y = drawInfoRow(doc, "Formato:", `${prodName} (frente e verso)`, y, margin);
      y = drawInfoRow(doc, "Volume total:", `${fmtNumber(data.coasterVolume)} ${unitLabel}/mês`, y, margin);
      if (data.numRestaurants > 0) {
        y = drawInfoRow(doc, "Distribuição:", `${data.numRestaurants} restaurante${data.numRestaurants !== 1 ? "s" : ""} parceiro${data.numRestaurants !== 1 ? "s" : ""}`, y, margin);
        y = drawInfoRow(doc, "Por restaurante:", `${fmtNumber(data.coastersPerRestaurant)} ${unitLabel}/mês`, y, margin);
      } else {
        y = drawInfoRow(doc, "Distribuição:", "A definir", y, margin);
      }
      y = drawInfoRow(doc, "Duração:", `${data.contractDuration} ${data.contractDuration === 1 ? "mês" : "meses"}`, y, margin);
      if (data.includesProduction) {
        y = drawInfoRow(doc, "Produção:", "Inclusa no valor", y, margin);
      }
    }
  }

  if (data.periodStart) {
    y += 8;
    y = checkPageBreak(doc, y, 60);
    y = drawSectionTitle(doc, "PERÍODO DE VEICULAÇÃO", y, margin);

    const batchWks = data.batchWeeks && data.batchWeeks > 0 ? data.batchWeeks : 4;
    const totalWks = data.semanas ?? (cycles * 4);
    const numBatches = Math.ceil(totalWks / batchWks);

    const fmtDate = (d: Date) =>
      d.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric" });

    const [year, month, day] = data.periodStart.split("-").map(Number);
    const startBase = new Date(year, month - 1, day);

    const batchRows: string[][] = [];
    for (let i = 0; i < numBatches; i++) {
      const bStart = new Date(startBase);
      bStart.setDate(bStart.getDate() + i * batchWks * 7);
      const bEnd = new Date(bStart);
      bEnd.setDate(bEnd.getDate() + batchWks * 7 - 1);
      const wksInBatch = Math.min(batchWks, totalWks - i * batchWks);
      batchRows.push([
        String(i + 1),
        `Lote ${i + 1}`,
        fmtDate(bStart),
        fmtDate(bEnd),
        `${wksInBatch} sem.`,
      ]);
    }

    autoTable(doc, {
      startY: y,
      head: [["#", "Período", "Início", "Fim", "Duração"]],
      body: batchRows,
      foot: [[
        "",
        `${numBatches} período${numBatches !== 1 ? "s" : ""}`,
        "",
        "",
        `${totalWks} sem. total`,
      ]],
      theme: "grid",
      styles: { font: FONT_NAME, fontSize: 8 },
      headStyles: {
        fillColor: [...BLACK],
        textColor: [...WHITE],
        fontSize: 8,
        fontStyle: "bold",
        font: FONT_NAME,
      },
      bodyStyles: { textColor: [40, 40, 40], font: FONT_NAME },
      footStyles: {
        fillColor: [...LIGHT_GRAY],
        textColor: [...BLACK],
        fontSize: 8,
        fontStyle: "bold",
        font: FONT_NAME,
      },
      alternateRowStyles: { fillColor: [250, 250, 250] },
      margin: { left: margin, right: margin },
      columnStyles: {
        0: { cellWidth: 12, halign: "center" },
        2: { halign: "center", cellWidth: 32 },
        3: { halign: "center", cellWidth: 32 },
        4: { halign: "right", cellWidth: 24, fontStyle: "bold" },
      },
    });

    y = (doc as unknown as { lastAutoTable?: { finalY?: number } }).lastAutoTable?.finalY || y + 40;
    y += 8;
  }

  // ── SECTION: Investimento ─────────────────────────────────────────────────
  y += 8;
  y = checkPageBreak(doc, y, 70);
  y = drawSectionTitle(doc, "INVESTIMENTO", y, margin);

  if (isMixed) {
    // Composição: itens padrão + linha do projeto sob medida + total geral.
    const multiItems = data.items!;
    const compositionRows = multiItems.length + 1; // +1 para a linha do custom
    const boxH = isBonificada
      ? 30
      : 8 + 12 + compositionRows * 10 + 4 + 14 + 4;

    y = checkPageBreak(doc, y, boxH + 10);
    doc.setFillColor(...LIGHT_GRAY);
    doc.roundedRect(margin, y, contentWidth, boxH, 3, 3, "F");

    if (isBonificada) {
      doc.setTextColor(...GRAY);
      doc.setFontSize(9);
      doc.setFont(FONT_NAME, "normal");
      doc.text("Campanha bonificada — sem custo para o anunciante", margin + 10, y + 12);
      doc.setTextColor(180, 130, 0);
      doc.setFontSize(14);
      doc.setFont(FONT_NAME, "bold");
      doc.text("R$ 0,00", pageWidth - margin - 10, y + 22, { align: "right" });
    } else {
      doc.setTextColor(...GRAY);
      doc.setFontSize(8);
      doc.setFont(FONT_NAME, "normal");
      doc.text("Composição do investimento", margin + 10, y + 10);

      let rowTop = y + 20;
      const scaledMultiItems = computeProposalLinePrices(multiItems, itemsSubtotalForPdf);
      multiItems.forEach((item, idx) => {
        doc.setFontSize(7.5);
        doc.setFont(FONT_NAME, "normal");
        doc.setTextColor(...GRAY);
        doc.text(`${item.productName} · ${item.semanas} sem. · ${fmtNumber(item.volume)} un.`, margin + 12, rowTop);
        doc.setFont(FONT_NAME, "bold");
        doc.setTextColor(...DARK_GRAY);
        doc.text(fmtCurrency(scaledMultiItems[idx].totalPrice), pageWidth - margin - 10, rowTop, { align: "right" });
        rowTop += 10;
      });
      // Linha do projeto sob medida
      doc.setFontSize(7.5);
      doc.setFont(FONT_NAME, "normal");
      doc.setTextColor(...GRAY);
      doc.text(`${data.customProductName || "Projeto Sob Medida"} · projeto`, margin + 12, rowTop);
      doc.setFont(FONT_NAME, "bold");
      doc.setTextColor(...DARK_GRAY);
      doc.text(fmtCurrency(customFinalPriceVal), pageWidth - margin - 10, rowTop, { align: "right" });
      rowTop += 10;

      doc.setDrawColor(200, 200, 200);
      doc.line(margin + 10, rowTop + 2, pageWidth - margin - 10, rowTop + 2);

      doc.setTextColor(...GRAY);
      doc.setFontSize(8);
      doc.setFont(FONT_NAME, "normal");
      doc.text("TOTAL DA PROPOSTA", margin + 10, rowTop + 12);
      doc.setTextColor(...GREEN);
      doc.setFontSize(14);
      doc.setFont(FONT_NAME, "bold");
      doc.text(fmtCurrency(contractTotal), pageWidth - margin - 10, rowTop + 12, { align: "right" });
    }

    y += boxH + 10;
  } else if (isCustomProduct) {
    const boxH = 36;
    y = checkPageBreak(doc, y, boxH + 10);
    doc.setFillColor(...LIGHT_GRAY);
    doc.roundedRect(margin, y, contentWidth, boxH, 3, 3, "F");
    doc.setTextColor(...GRAY);
    doc.setFontSize(9);
    doc.setFont(FONT_NAME, "normal");
    doc.text("Valor total desta proposta", margin + 10, y + 12);
    doc.setTextColor(...GREEN);
    doc.setFontSize(14);
    doc.setFont(FONT_NAME, "bold");
    doc.text(isBonificada ? "R$ 0,00" : fmtCurrency(contractTotal), pageWidth - margin - 10, y + 28, { align: "right" });
    y += boxH + 10;
  } else if (isMultiProduct) {
    const multiItems = data.items!;
    // Dynamic box height: 8 top pad + label row (12) + N item rows (10 each) + separator + total row (14) + 4 bottom pad
    const boxH = isBonificada
      ? 30
      : multiItems.length > 1
        ? 8 + 12 + multiItems.length * 10 + 4 + 14 + 4
        : 36;

    y = checkPageBreak(doc, y, boxH + 10);
    doc.setFillColor(...LIGHT_GRAY);
    doc.roundedRect(margin, y, contentWidth, boxH, 3, 3, "F");

    if (isBonificada) {
      doc.setTextColor(...GRAY);
      doc.setFontSize(9);
      doc.setFont(FONT_NAME, "normal");
      doc.text("Campanha bonificada — sem custo para o anunciante", margin + 10, y + 12);
      doc.setTextColor(180, 130, 0);
      doc.setFontSize(14);
      doc.setFont(FONT_NAME, "bold");
      doc.text("R$ 0,00", pageWidth - margin - 10, y + 22, { align: "right" });
    } else if (multiItems.length <= 1) {
      // Single item — compact: label + total
      doc.setTextColor(...GRAY);
      doc.setFontSize(9);
      doc.setFont(FONT_NAME, "normal");
      doc.text("Valor total desta proposta", margin + 10, y + 12);
      doc.setTextColor(...GREEN);
      doc.setFontSize(14);
      doc.setFont(FONT_NAME, "bold");
      doc.text(fmtCurrency(contractTotal), pageWidth - margin - 10, y + 28, { align: "right" });
    } else {
      // Multiple items — show each subtotal then grand total
      doc.setTextColor(...GRAY);
      doc.setFontSize(8);
      doc.setFont(FONT_NAME, "normal");
      doc.text("Composição do investimento", margin + 10, y + 10);

      let rowTop = y + 20;
      const scaledMultiItems = computeProposalLinePrices(multiItems, itemsSubtotalForPdf);
      multiItems.forEach((item, idx) => {
        doc.setFontSize(7.5);
        doc.setFont(FONT_NAME, "normal");
        doc.setTextColor(...GRAY);
        doc.text(`${item.productName} · ${item.semanas} sem. · ${fmtNumber(item.volume)} un.`, margin + 12, rowTop);
        doc.setFont(FONT_NAME, "bold");
        doc.setTextColor(...DARK_GRAY);
        doc.text(fmtCurrency(scaledMultiItems[idx].totalPrice), pageWidth - margin - 10, rowTop, { align: "right" });
        rowTop += 10;
      });

      // Separator before total
      doc.setDrawColor(200, 200, 200);
      doc.line(margin + 10, rowTop + 2, pageWidth - margin - 10, rowTop + 2);

      doc.setTextColor(...GRAY);
      doc.setFontSize(8);
      doc.setFont(FONT_NAME, "normal");
      doc.text("TOTAL DA PROPOSTA", margin + 10, rowTop + 12);
      doc.setTextColor(...GREEN);
      doc.setFontSize(14);
      doc.setFont(FONT_NAME, "bold");
      doc.text(fmtCurrency(contractTotal), pageWidth - margin - 10, rowTop + 12, { align: "right" });
    }

    y += boxH + 10;
  } else {
    // Original single-product investment box
    doc.setFillColor(...LIGHT_GRAY);
    doc.roundedRect(margin, y, contentWidth, 50, 3, 3, "F");

    doc.setTextColor(...GRAY);
    doc.setFontSize(9);
    doc.setFont(FONT_NAME, "normal");
    doc.text("Valor mensal por restaurante", margin + 10, y + 12);
    doc.text("Investimento mensal total", margin + 10, y + 26);
    doc.text("Valor total do contrato", margin + 10, y + 40);

    doc.setTextColor(...BLACK);
    doc.setFontSize(12);
    doc.setFont(FONT_NAME, "bold");
    doc.text(fmtCurrency(pricePerRestaurant), pageWidth - margin - 10, y + 12, { align: "right" });

    doc.setTextColor(...GREEN);
    doc.setFontSize(14);
    doc.text(fmtCurrency(monthlyTotal), pageWidth - margin - 10, y + 26, { align: "right" });

    doc.setTextColor(...BLACK);
    doc.setFontSize(16);
    doc.text(fmtCurrency(contractTotal), pageWidth - margin - 10, y + 42, { align: "right" });

    doc.setDrawColor(200, 200, 200);
    doc.line(margin + 10, y + 17, pageWidth - margin - 10, y + 17);
    doc.line(margin + 10, y + 31, pageWidth - margin - 10, y + 31);

    y += 62;
  }

  // Task #197 — Condições de pagamento (cronograma de parcelas)
  if (data.billingSchedule && data.billingSchedule.length > 0 && !isBonificada) {
    const rows = data.billingSchedule;
    const headerH = 14;
    const rowH = 11;
    const boxH = 8 + headerH + rows.length * rowH + 6;
    y = checkPageBreak(doc, y, boxH + 20);
    y = drawSectionTitle(doc, "CONDIÇÕES DE PAGAMENTO", y, margin);
    doc.setFillColor(...LIGHT_GRAY);
    doc.roundedRect(margin, y, contentWidth, boxH, 3, 3, "F");
    doc.setTextColor(...GRAY);
    doc.setFontSize(8);
    doc.setFont(FONT_NAME, "bold");
    doc.text("#", margin + 10, y + 12);
    doc.text("VENCIMENTO", margin + 25, y + 12);
    doc.text("VALOR", pageWidth - margin - 10, y + 12, { align: "right" });
    doc.setDrawColor(220, 220, 220);
    doc.line(margin + 10, y + 16, pageWidth - margin - 10, y + 16);
    let ry = y + 12 + headerH;
    doc.setFont(FONT_NAME, "normal");
    doc.setFontSize(9);
    for (const r of rows) {
      doc.setTextColor(...GRAY);
      doc.text(String(r.sequence), margin + 10, ry);
      const due = r.dueDate.length >= 10 ? new Date(r.dueDate + "T00:00:00Z").toLocaleDateString("pt-BR", { timeZone: "UTC" }) : r.dueDate;
      doc.text(due, margin + 25, ry);
      doc.setTextColor(...DARK_GRAY);
      doc.setFont(FONT_NAME, "bold");
      doc.text(fmtCurrency(parseFloat(String(r.amount))), pageWidth - margin - 10, ry, { align: "right" });
      doc.setFont(FONT_NAME, "normal");
      ry += rowH;
    }
    y += boxH + 10;
  }

  if (discountPercent > 0) {
    y += 4;
    const hasPartner = data.hasPartnerDiscount === true;

    if (hasDetailedDiscounts) {
      const vexaUnitPriceAtVolume = getVexaUnitPriceForVolume(data.coasterVolume, irpjRate);
      const priceAfterQty = vexaUnitPriceAtVolume * data.coasterVolume * cycles;
      const qtyDiscountValue = listPriceTotal - priceAfterQty;
      const qtyDiscountPercent = listPriceTotal > 0 ? (qtyDiscountValue / listPriceTotal) * 100 : 0;

      const prazoPct = getPrazoDiscountPercent(semanas);
      const hasPrazoDiscount = prazoPct > 0;
      const priceAfterPrazo = priceAfterQty * (1 - prazoPct / 100);
      const prazoDiscountValue = priceAfterQty - priceAfterPrazo;

      const partnerDiscountValue = hasPartner ? priceAfterPrazo * 0.1 : 0;

      const rowH = 13;
      let rowCount = 3;
      if (qtyDiscountValue > 0.01) rowCount++;
      if (hasPrazoDiscount) rowCount++;
      if (hasPartner) rowCount++;
      const discountBoxHeight = 10 + rowCount * rowH;
      y = checkPageBreak(doc, y, discountBoxHeight + 15);
      y = drawSectionTitle(doc, "DESCONTO APLICADO", y, margin);

      doc.setFillColor(245, 255, 245);
      doc.roundedRect(margin, y, contentWidth, discountBoxHeight, 3, 3, "F");
      doc.setDrawColor(...GREEN);
      doc.setLineWidth(0.3);
      doc.roundedRect(margin, y, contentWidth, discountBoxHeight, 3, 3, "S");
      doc.setLineWidth(0.2);

      let row = 0;
      const rowY = (r: number) => y + 10 + r * rowH;
      const sepY = (r: number) => rowY(r) + 5;

      doc.setTextColor(...GRAY);
      doc.setFontSize(8);
      doc.setFont(FONT_NAME, "normal");
      doc.text(`Preço de tabela (ref. 1.000 un. / 4 sem. × ${fmtNumber(data.coasterVolume)} un. × ${cycles} per.)`, margin + 10, rowY(row));
      doc.setTextColor(160, 160, 160);
      doc.setFontSize(10);
      doc.text(fmtCurrency(listPriceTotal), pageWidth - margin - 10, rowY(row), { align: "right" });
      doc.setDrawColor(220, 220, 220);
      doc.line(margin + 10, sepY(row), pageWidth - margin - 10, sepY(row));
      row++;

      if (qtyDiscountValue > 0.01) {
        doc.setTextColor(...GRAY);
        doc.setFontSize(8);
        doc.setFont(FONT_NAME, "normal");
        doc.text(`Desconto por quantidade (−${fmtPercent(qtyDiscountPercent)})`, margin + 10, rowY(row));
        doc.setTextColor(...GREEN);
        doc.setFontSize(10);
        doc.setFont(FONT_NAME, "bold");
        doc.text(`−${fmtCurrency(qtyDiscountValue)}`, pageWidth - margin - 10, rowY(row), { align: "right" });
        doc.setDrawColor(220, 220, 220);
        doc.line(margin + 10, sepY(row), pageWidth - margin - 10, sepY(row));
        row++;
      }

      if (hasPrazoDiscount) {
        doc.setTextColor(...GRAY);
        doc.setFontSize(8);
        doc.setFont(FONT_NAME, "normal");
        doc.text(`Desconto por prazo (${semanas} semanas, −${fmtPercent(prazoPct)})`, margin + 10, rowY(row));
        doc.setTextColor(...GREEN);
        doc.setFontSize(10);
        doc.setFont(FONT_NAME, "bold");
        doc.text(`−${fmtCurrency(prazoDiscountValue)}`, pageWidth - margin - 10, rowY(row), { align: "right" });
        doc.setDrawColor(220, 220, 220);
        doc.line(margin + 10, sepY(row), pageWidth - margin - 10, sepY(row));
        row++;
      }

      if (hasPartner) {
        doc.setTextColor(...GRAY);
        doc.setFontSize(8);
        doc.setFont(FONT_NAME, "normal");
        doc.text("Desconto de parceiro (−10%)", margin + 10, rowY(row));
        doc.setTextColor(...GREEN);
        doc.setFontSize(10);
        doc.setFont(FONT_NAME, "bold");
        doc.text(`−${fmtCurrency(partnerDiscountValue)}`, pageWidth - margin - 10, rowY(row), { align: "right" });
        doc.setDrawColor(220, 220, 220);
        doc.line(margin + 10, sepY(row), pageWidth - margin - 10, sepY(row));
        row++;
      }

      doc.setTextColor(...GRAY);
      doc.setFontSize(8);
      doc.setFont(FONT_NAME, "normal");
      doc.text("Preço desta proposta", margin + 10, rowY(row));
      doc.setTextColor(...BLACK);
      doc.setFontSize(10);
      doc.setFont(FONT_NAME, "bold");
      doc.text(fmtCurrency(contractTotal), pageWidth - margin - 10, rowY(row), { align: "right" });
      doc.setDrawColor(220, 220, 220);
      doc.line(margin + 10, sepY(row), pageWidth - margin - 10, sepY(row));
      row++;

      doc.setTextColor(...GRAY);
      doc.setFontSize(8);
      doc.setFont(FONT_NAME, "normal");
      doc.text("Economia total acumulada", margin + 10, rowY(row));
      doc.setTextColor(...GREEN);
      doc.setFontSize(11);
      doc.setFont(FONT_NAME, "bold");
      doc.text(`${fmtCurrency(discountValue)}  (−${fmtPercent(discountPercent)})`, pageWidth - margin - 10, rowY(row), { align: "right" });

      y += discountBoxHeight + 10;
    } else {
      const priceBeforePartner = hasPartner ? contractTotal / 0.9 : contractTotal;
      const volumeDiscountValue = listPriceTotal - priceBeforePartner;
      const volumeDiscountPercent = listPriceTotal > 0 ? (volumeDiscountValue / listPriceTotal) * 100 : 0;
      const partnerDiscountValue = hasPartner ? priceBeforePartner * 0.1 : 0;

      const rowH = 13;
      const rowCount = hasPartner ? 5 : 4;
      const discountBoxHeight = 10 + rowCount * rowH;
      y = checkPageBreak(doc, y, discountBoxHeight + 15);
      y = drawSectionTitle(doc, "DESCONTO APLICADO", y, margin);

      doc.setFillColor(245, 255, 245);
      doc.roundedRect(margin, y, contentWidth, discountBoxHeight, 3, 3, "F");
      doc.setDrawColor(...GREEN);
      doc.setLineWidth(0.3);
      doc.roundedRect(margin, y, contentWidth, discountBoxHeight, 3, 3, "S");
      doc.setLineWidth(0.2);

      let row = 0;
      const rowY = (r: number) => y + 10 + r * rowH;
      const sepY = (r: number) => rowY(r) + 5;

      doc.setTextColor(...GRAY);
      doc.setFontSize(8);
      doc.setFont(FONT_NAME, "normal");
      doc.text("Preço de tabela (ref. 1.000 un. / 4 semanas)", margin + 10, rowY(row));
      doc.setTextColor(160, 160, 160);
      doc.setFontSize(10);
      doc.setFont(FONT_NAME, "normal");
      doc.text(fmtCurrency(listPriceTotal), pageWidth - margin - 10, rowY(row), { align: "right" });
      doc.setDrawColor(220, 220, 220);
      doc.line(margin + 10, sepY(row), pageWidth - margin - 10, sepY(row));
      row++;

      doc.setTextColor(...GRAY);
      doc.setFontSize(8);
      doc.setFont(FONT_NAME, "normal");
      doc.text("Desconto por volume e prazo", margin + 10, rowY(row));
      doc.setTextColor(...GREEN);
      doc.setFontSize(10);
      doc.setFont(FONT_NAME, "bold");
      doc.text(`−${fmtCurrency(volumeDiscountValue)}  (−${fmtPercent(volumeDiscountPercent)})`, pageWidth - margin - 10, rowY(row), { align: "right" });
      doc.setDrawColor(220, 220, 220);
      doc.line(margin + 10, sepY(row), pageWidth - margin - 10, sepY(row));
      row++;

      if (hasPartner) {
        doc.setTextColor(...GRAY);
        doc.setFontSize(8);
        doc.setFont(FONT_NAME, "normal");
        doc.text("Desconto de parceiro", margin + 10, rowY(row));
        doc.setTextColor(...GREEN);
        doc.setFontSize(10);
        doc.setFont(FONT_NAME, "bold");
        doc.text(`−${fmtCurrency(partnerDiscountValue)}  (−10%)`, pageWidth - margin - 10, rowY(row), { align: "right" });
        doc.setDrawColor(220, 220, 220);
        doc.line(margin + 10, sepY(row), pageWidth - margin - 10, sepY(row));
        row++;
      }

      doc.setTextColor(...GRAY);
      doc.setFontSize(8);
      doc.setFont(FONT_NAME, "normal");
      doc.text("Preço desta proposta", margin + 10, rowY(row));
      doc.setTextColor(...BLACK);
      doc.setFontSize(10);
      doc.setFont(FONT_NAME, "bold");
      doc.text(fmtCurrency(contractTotal), pageWidth - margin - 10, rowY(row), { align: "right" });
      doc.setDrawColor(220, 220, 220);
      doc.line(margin + 10, sepY(row), pageWidth - margin - 10, sepY(row));
      row++;

      doc.setTextColor(...GRAY);
      doc.setFontSize(8);
      doc.setFont(FONT_NAME, "normal");
      doc.text("Economia total", margin + 10, rowY(row));
      doc.setTextColor(...GREEN);
      doc.setFontSize(11);
      doc.setFont(FONT_NAME, "bold");
      doc.text(`${fmtCurrency(discountValue)}  (−${fmtPercent(discountPercent)})`, pageWidth - margin - 10, rowY(row), { align: "right" });

      y += discountBoxHeight + 10;
    }
  }

  y += 10;
  y = checkPageBreak(doc, y, 75);

  y = drawSectionTitle(doc, "FORMAS DE PAGAMENTO", y, margin);

  const boletoParcela = data.contractDuration > 0 ? contractTotal / data.contractDuration : contractTotal;

  const paymentBoxHeight = 34;
  const paymentBoxGap = 6;
  const twoBoxWidth = (contentWidth - paymentBoxGap) / 2;

  const drawPaymentBox = (
    xPos: number, yPos: number, width: number,
    icon: string, title: string, detail: string, highlight: string,
    sub: string, isAccent: boolean,
  ) => {
    if (isAccent) {
      doc.setFillColor(245, 255, 245);
      doc.roundedRect(xPos, yPos, width, paymentBoxHeight, 2, 2, "F");
      doc.setDrawColor(...GREEN);
      doc.setLineWidth(0.4);
      doc.roundedRect(xPos, yPos, width, paymentBoxHeight, 2, 2, "S");
      doc.setLineWidth(0.2);
    } else {
      doc.setFillColor(...LIGHT_GRAY);
      doc.roundedRect(xPos, yPos, width, paymentBoxHeight, 2, 2, "F");
    }

    doc.setTextColor(isAccent ? GREEN[0] : GRAY[0], isAccent ? GREEN[1] : GRAY[1], isAccent ? GREEN[2] : GRAY[2]);
    doc.setFontSize(10);
    doc.setFont(FONT_NAME, "bold");
    doc.text(icon, xPos + 6, yPos + 8);

    doc.setTextColor(...BLACK);
    doc.setFontSize(8);
    doc.setFont(FONT_NAME, "bold");
    doc.text(title, xPos + 14, yPos + 8);

    doc.setTextColor(...DARK_GRAY);
    doc.setFontSize(7);
    doc.setFont(FONT_NAME, "normal");
    doc.text(detail, xPos + 6, yPos + 16);

    doc.setTextColor(isAccent ? GREEN[0] : BLACK[0], isAccent ? GREEN[1] : BLACK[1], isAccent ? GREEN[2] : BLACK[2]);
    doc.setFontSize(10);
    doc.setFont(FONT_NAME, "bold");
    doc.text(highlight, xPos + 6, yPos + 25);

    doc.setTextColor(...GRAY);
    doc.setFontSize(6.5);
    doc.setFont(FONT_NAME, "normal");
    doc.text(sub, xPos + 6, yPos + 31);
  };

  drawPaymentBox(
    margin, y, twoBoxWidth,
    "💳", "Cartão de Crédito",
    "Parcela única sem juros",
    fmtCurrency(contractTotal),
    "1x sem juros",
    false,
  );

  drawPaymentBox(
    margin + twoBoxWidth + paymentBoxGap, y, twoBoxWidth,
    "📄", "Boleto Bancário",
    `Parcelado em ${data.contractDuration}x`,
    fmtCurrency(boletoParcela) + "/mês",
    `${data.contractDuration}x de ${fmtCurrency(boletoParcela)}`,
    false,
  );

  y += paymentBoxHeight + 10;

  y += 4;
  y = checkPageBreak(doc, y, 60);

  doc.setDrawColor(...GREEN);
  doc.setLineWidth(0.5);
  doc.line(margin, y, pageWidth - margin, y);
  y += 10;

  doc.setTextColor(...BLACK);
  doc.setFontSize(10);
  doc.setFont(FONT_NAME, "bold");
  doc.text("CONDIÇÕES", margin, y);
  y += 8;

  const validityDays = data.validityDays || 15;
  const conditions = [
    `Esta proposta é válida por ${validityDays} dias a partir da data de emissão.`,
    "Pagamento conforme condições acordadas entre as partes.",
    `A produção ${data.productUnitLabelPlural ? "dos " + data.productUnitLabelPlural : "das bolachas"} será iniciada após aprovação da arte pelo anunciante.`,
    "A Mesa Ads se reserva o direito de selecionar os restaurantes parceiros conforme disponibilidade e perfil da campanha.",
    "Valores sujeitos a alteração após o período de validade.",
  ];

  doc.setTextColor(...DARK_GRAY);
  doc.setFontSize(8.5);
  doc.setFont(FONT_NAME, "normal");
  conditions.forEach(line => {
    y = checkPageBreak(doc, y, 12);
    doc.text("•", margin, y);
    y = justifyText(doc, line, margin + 5, y, contentWidth - 5, 4.5);
    y += 2;
  });

  // Cláusula de vínculo ao contrato master (Termos e Condições Gerais).
  // O texto vem de shared/const.ts; a URL vem da fonte única do servidor
  // (fetchContractLinks), editável em Termos Padrão. Link clicável após o texto.
  y = checkPageBreak(doc, y, 18);
  doc.setTextColor(...DARK_GRAY);
  doc.setFontSize(8.5);
  doc.setFont(FONT_NAME, "normal");
  doc.text("•", margin, y);
  y = justifyText(doc, PROPOSAL_BINDING_CLAUSE_PREFIX, margin + 5, y, contentWidth - 5, 4.5);
  doc.setTextColor(...GREEN);
  doc.textWithLink(masterContractUrl, margin + 5, y, { url: masterContractUrl });
  y += 6;

  // Cláusula de vínculo ao Termo de Contratação de Campanha Publicitária,
  // com link público (não-logado) também vindo da fonte única do servidor.
  y = checkPageBreak(doc, y, 18);
  doc.setTextColor(...DARK_GRAY);
  doc.setFontSize(8.5);
  doc.setFont(FONT_NAME, "normal");
  doc.text("•", margin, y);
  y = justifyText(doc, CAMPAIGN_TERM_BINDING_CLAUSE_PREFIX, margin + 5, y, contentWidth - 5, 4.5);
  doc.setTextColor(...GREEN);
  doc.textWithLink(campaignTermUrl, margin + 5, y, { url: campaignTermUrl });
  y += 6;

  y += 14;
  y = checkPageBreak(doc, y, 30);

  if (data.signature) {
    // Cotação convertida/assinada: registra a assinatura digital do cliente
    // em vez das linhas de assinatura manual.
    y = checkPageBreak(doc, y, 56);
    doc.setDrawColor(...GREEN);
    doc.setLineWidth(0.5);
    doc.line(margin, y, pageWidth - margin, y);
    y += 8;

    doc.setFontSize(11);
    doc.setFont(FONT_NAME, "bold");
    doc.setTextColor(...BLACK);
    doc.text("REGISTRO DE ASSINATURA DIGITAL", margin, y);
    y += 7;

    const signedDateStr = new Date(data.signature.signedAt).toLocaleString("pt-BR", {
      day: "2-digit",
      month: "long",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });

    const sigRows: Array<[string, string]> = [["Assinado por:", data.signature.signerName]];
    if (data.signature.signerCpf) sigRows.push(["CPF:", data.signature.signerCpf]);
    sigRows.push(["Data/Hora:", signedDateStr]);
    if (data.signature.ip) sigRows.push(["IP:", data.signature.ip]);

    doc.setFontSize(9);
    for (const [label, value] of sigRows) {
      doc.setFont(FONT_NAME, "bold");
      doc.setTextColor(...DARK_GRAY);
      doc.text(label, margin, y);
      doc.setFont(FONT_NAME, "normal");
      doc.text(value, margin + 32, y);
      y += 6;
    }

    if (data.signature.signatureHash) {
      y += 1;
      doc.setFontSize(7.5);
      doc.setFont(FONT_NAME, "normal");
      doc.setTextColor(...GRAY);
      doc.text(`Verificação (SHA-256): ${data.signature.signatureHash}`, margin, y, { maxWidth: contentWidth });
      y += 5;
    }

    doc.setFontSize(7.5);
    doc.setFont(FONT_NAME, "normal");
    doc.setTextColor(...GRAY);
    doc.text("Assinado digitalmente via plataforma mesa.ads.", margin, y, { maxWidth: contentWidth });
  } else {
    doc.setDrawColor(200, 200, 200);
    doc.line(margin, y, margin + 60, y);
    doc.line(pageWidth - margin - 60, y, pageWidth - margin, y);
    y += 5;
    doc.setFontSize(8);
    doc.setTextColor(...GRAY);
    doc.setFont(FONT_NAME, "normal");
    doc.text("Anunciante", margin + 30, y, { align: "center" });
    doc.text("Mesa Ads", pageWidth - margin - 30, y, { align: "center" });
    y += 5;
    doc.setFontSize(7);
    doc.text(data.clientName, margin + 30, y, { align: "center" });
    doc.text("Representante Legal", pageWidth - margin - 30, y, { align: "center" });
  }

  const totalPages = doc.getNumberOfPages();
  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i);

    doc.setDrawColor(220, 220, 220);
    doc.line(margin, pageHeight - 22, pageWidth - margin, pageHeight - 22);

    doc.setFontSize(7);
    doc.setFont(FONT_NAME, "normal");
    doc.setTextColor(140, 140, 140);
    doc.text(
      `Documento gerado automaticamente pela plataforma mesa.ads`,
      margin,
      pageHeight - 14
    );

    doc.setTextColor(...GREEN);
    doc.text("mesa.ads", pageWidth - margin, pageHeight - 14, { align: "right" });

    doc.setTextColor(140, 140, 140);
    doc.text(`${i}/${totalPages}`, pageWidth / 2, pageHeight - 14, { align: "center" });
  }

  const baseName = (data.quotationName || data.clientName).replace(/[^a-zA-Z0-9]/g, "_");
  const filename = data.signature
    ? `Proposta_Assinada_${baseName}.pdf`
    : `Proposta_${baseName}.pdf`;
  doc.save(filename);
}
