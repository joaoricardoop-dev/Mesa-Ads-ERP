import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { HOST_GROTESK_REGULAR, HOST_GROTESK_BOLD, LOGO_WHITE_BASE64 } from "./pdf-assets";

interface ProposalItem {
  productName: string;
  volume: number;
  semanas: number;
  unitPrice: number;
  totalPrice: number;
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
  pixDiscountPercent?: number;
  hasPartnerDiscount?: boolean;
  productName?: string;
  productUnitLabelPlural?: string;
  semanas?: number;
  /** Multi-product items from BudgetCreator. When provided, switches to multi-product PDF layout. */
  items?: ProposalItem[];
  isBonificada?: boolean;
}

const FONT_NAME = "HostGrotesk";
const GREEN = [39, 216, 3] as const;
const BLACK = [13, 13, 13] as const;
const DARK_GRAY = [60, 60, 60] as const;
const GRAY = [100, 100, 100] as const;
const LIGHT_GRAY = [240, 240, 240] as const;
const WHITE = [255, 255, 255] as const;

const PRICING_DEDUCTIONS = { irpj: 0.06, comRestaurante: 0.15, comComercial: 0.10 };

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

function calcUnitPriceFromTier(tier: typeof DEFAULT_CUSTOS_VOLUME[0], vol: number): number {
  const custoTotal = tier.custoGPC * tier.artes * vol + tier.frete;
  const denominador = 1 - tier.margem - PRICING_DEDUCTIONS.irpj - PRICING_DEDUCTIONS.comRestaurante - PRICING_DEDUCTIONS.comComercial;
  return denominador > 0 ? custoTotal / denominador / vol : 0;
}

function getVexaUnitPrice1000(): number {
  const tier = getTierForVolume(1000);
  return calcUnitPriceFromTier(tier, 1000);
}

function getVexaUnitPriceForVolume(vol: number): number {
  const tier = getTierForVolume(vol);
  return calcUnitPriceFromTier(tier, vol);
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

function registerFonts(doc: jsPDF) {
  doc.addFileToVFS("HostGrotesk-Regular.ttf", HOST_GROTESK_REGULAR);
  doc.addFont("HostGrotesk-Regular.ttf", FONT_NAME, "normal");
  doc.addFileToVFS("HostGrotesk-Bold.ttf", HOST_GROTESK_BOLD);
  doc.addFont("HostGrotesk-Bold.ttf", FONT_NAME, "bold");
  doc.setFont(FONT_NAME, "normal");
}

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

function drawHeader(doc: jsPDF, pageWidth: number, margin: number) {
  doc.setFillColor(...BLACK);
  doc.rect(0, 0, pageWidth, 42, "F");

  doc.setFillColor(...GREEN);
  doc.rect(0, 42, pageWidth, 2, "F");

  try {
    const logoWidth = 40;
    const logoHeight = logoWidth / 4.254;
    doc.addImage(LOGO_WHITE_BASE64, "PNG", margin, 14, logoWidth, logoHeight);
  } catch {
    doc.setTextColor(...WHITE);
    doc.setFontSize(22);
    doc.setFont(FONT_NAME, "bold");
    doc.text("mesa", margin, 24);
    const mesaWidth = doc.getTextWidth("mesa");
    doc.setTextColor(...GREEN);
    doc.text(".ads", margin + mesaWidth, 24);
  }

  doc.setTextColor(...WHITE);
  doc.setFontSize(9);
  doc.setFont(FONT_NAME, "normal");
  doc.text("PROPOSTA COMERCIAL", margin, 34);

  const today = new Date().toLocaleDateString("pt-BR", { day: "2-digit", month: "long", year: "numeric" });
  doc.setTextColor(200, 200, 200);
  doc.setFontSize(8);
  doc.text(today, pageWidth - margin, 34, { align: "right" });
}

function drawSectionTitle(doc: jsPDF, title: string, y: number, margin: number): number {
  doc.setTextColor(...BLACK);
  doc.setFontSize(12);
  doc.setFont(FONT_NAME, "bold");
  doc.text(title, margin, y);
  y += 3;
  doc.setDrawColor(220, 220, 220);
  doc.line(margin, y, doc.internal.pageSize.getWidth() - margin, y);
  return y + 8;
}

function drawInfoRow(doc: jsPDF, label: string, value: string, y: number, margin: number): number {
  doc.setTextColor(...GRAY);
  doc.setFontSize(9);
  doc.setFont(FONT_NAME, "bold");
  doc.text(label, margin, y);
  doc.setFont(FONT_NAME, "normal");
  doc.setTextColor(...DARK_GRAY);
  doc.text(value, margin + 35, y);
  return y + 6;
}

function checkPageBreak(doc: jsPDF, y: number, needed: number): number {
  const pageHeight = doc.internal.pageSize.getHeight();
  if (y + needed > pageHeight - 30) {
    doc.addPage();
    return 25;
  }
  return y;
}

export function generateProposalPdf(data: ProposalPDFData) {
  const doc = new jsPDF();
  registerFonts(doc);

  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 20;
  const contentWidth = pageWidth - margin * 2;

  const isMultiProduct = !!(data.items && data.items.length > 0);
  const isBonificada = data.isBonificada === true;

  const numRest = data.numRestaurants > 0 ? data.numRestaurants : 1;
  const monthlyTotal = data.monthlyTotal > 0 ? data.monthlyTotal : data.pricePerRestaurant * numRest;
  const pricePerRestaurant = data.pricePerRestaurant > 0 ? data.pricePerRestaurant : (monthlyTotal / numRest);
  const contractTotal = data.contractTotal > 0 ? data.contractTotal : monthlyTotal * data.contractDuration;
  const pixDiscount = data.pixDiscountPercent ?? 5;

  const cycles = data.contractDuration;
  const semanas = data.semanas ?? (cycles * 4);

  const vexaUnitPrice1000 = getVexaUnitPrice1000();
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
  if (isMultiProduct) {
    // Multi-product layout: show a table of all budget items
    y = checkPageBreak(doc, y, 60);
    y = drawSectionTitle(doc, "PRODUTOS DO ORÇAMENTO", y, margin);

    const items = data.items!;
    const totalVolume = items.reduce((s, i) => s + i.volume, 0);

    autoTable(doc, {
      startY: y,
      head: [["Produto", "Duração", "Volume", "Preço/un.", "Total"]],
      body: items.map(item => [
        item.productName,
        `${item.semanas} sem.`,
        fmtNumber(item.volume) + " un.",
        isBonificada ? "—" : `R$ ${item.unitPrice.toFixed(4)}`,
        isBonificada ? "Bonificado" : fmtCurrency(item.totalPrice),
      ]),
      foot: [[
        `${items.length} produto${items.length !== 1 ? "s" : ""}`,
        "",
        fmtNumber(totalVolume) + " un.",
        "",
        isBonificada ? "R$ 0,00" : fmtCurrency(contractTotal),
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
        1: { halign: "center", cellWidth: 22 },
        2: { halign: "right", cellWidth: 28 },
        3: { halign: "right", cellWidth: 28 },
        4: { halign: "right", fontStyle: "bold", cellWidth: 32 },
      },
    });

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
  } else {
    // Single-product layout (original flow)
    y = checkPageBreak(doc, y, 60);
    y = drawSectionTitle(doc, "DESCRIÇÃO DO SERVIÇO", y, margin);

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

  // ── SECTION: Investimento ─────────────────────────────────────────────────
  y += 8;
  y = checkPageBreak(doc, y, 70);
  y = drawSectionTitle(doc, "INVESTIMENTO", y, margin);

  if (isMultiProduct) {
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
      for (const item of multiItems) {
        doc.setFontSize(7.5);
        doc.setFont(FONT_NAME, "normal");
        doc.setTextColor(...GRAY);
        doc.text(`${item.productName} · ${item.semanas} sem. · ${fmtNumber(item.volume)} un.`, margin + 12, rowTop);
        doc.setFont(FONT_NAME, "bold");
        doc.setTextColor(...DARK_GRAY);
        doc.text(fmtCurrency(item.totalPrice), pageWidth - margin - 10, rowTop, { align: "right" });
        rowTop += 10;
      }

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

  if (discountPercent > 0) {
    y += 4;
    const hasPartner = data.hasPartnerDiscount === true;

    if (hasDetailedDiscounts) {
      const vexaUnitPriceAtVolume = getVexaUnitPriceForVolume(data.coasterVolume);
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

  if (data.restaurants.length > 0) {
    y += 4;
    y = checkPageBreak(doc, y, 60);
    y = drawSectionTitle(doc, "REDE DE DISTRIBUIÇÃO", y, margin);

    autoTable(doc, {
      startY: y,
      head: [["#", "Restaurante", "Bairro", `${(data.productUnitLabelPlural || "Bolachas").charAt(0).toUpperCase() + (data.productUnitLabelPlural || "Bolachas").slice(1)}/mês`]],
      body: data.restaurants.map((r, i) => [
        String(i + 1),
        r.name,
        r.neighborhood || "—",
        fmtNumber(r.coasters),
      ]),
      foot: [[
        "",
        `${data.restaurants.length} restaurantes`,
        "",
        fmtNumber(data.restaurants.reduce((s, r) => s + r.coasters, 0)),
      ]],
      theme: "grid",
      styles: {
        font: FONT_NAME,
      },
      headStyles: {
        fillColor: [...BLACK],
        textColor: [...WHITE],
        fontSize: 8,
        fontStyle: "bold",
        font: FONT_NAME,
      },
      bodyStyles: { fontSize: 8, textColor: [40, 40, 40], font: FONT_NAME },
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
        3: { halign: "right", fontStyle: "bold" },
      },
    });

    y = (doc as unknown as { lastAutoTable?: { finalY?: number } }).lastAutoTable?.finalY || y + 40;
  }

  y += 10;
  y = checkPageBreak(doc, y, 75);

  y = drawSectionTitle(doc, "FORMAS DE PAGAMENTO", y, margin);

  const pixTotal = contractTotal * (1 - pixDiscount / 100);
  const pixSaving = contractTotal - pixTotal;
  const boletoParcela = data.contractDuration > 0 ? contractTotal / data.contractDuration : contractTotal;

  const paymentBoxHeight = 34;
  const paymentBoxGap = 6;
  const threeBoxWidth = (contentWidth - paymentBoxGap * 2) / 3;

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
    margin, y, threeBoxWidth,
    "💳", "Cartão de Crédito",
    "Parcela única sem juros",
    fmtCurrency(contractTotal),
    "1x sem juros",
    false,
  );

  drawPaymentBox(
    margin + threeBoxWidth + paymentBoxGap, y, threeBoxWidth,
    "📄", "Boleto Bancário",
    `Parcelado em ${data.contractDuration}x`,
    fmtCurrency(boletoParcela) + "/mês",
    `${data.contractDuration}x de ${fmtCurrency(boletoParcela)}`,
    false,
  );

  drawPaymentBox(
    margin + (threeBoxWidth + paymentBoxGap) * 2, y, threeBoxWidth,
    "⚡", "PIX à Vista",
    `${pixDiscount}% de desconto adicional`,
    fmtCurrency(pixTotal),
    `Economia de ${fmtCurrency(pixSaving)}`,
    true,
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

  y += 14;
  y = checkPageBreak(doc, y, 30);

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

  const filename = data.quotationName
    ? `Proposta_${data.quotationName.replace(/[^a-zA-Z0-9]/g, "_")}.pdf`
    : `Proposta_${data.clientName.replace(/[^a-zA-Z0-9]/g, "_")}.pdf`;
  doc.save(filename);
}
