import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { HOST_GROTESK_REGULAR, HOST_GROTESK_BOLD, LOGO_WHITE_BASE64 } from "./pdf-assets";

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
}

const FONT_NAME = "HostGrotesk";
const GREEN = [39, 216, 3] as const;
const BLACK = [13, 13, 13] as const;
const DARK_GRAY = [60, 60, 60] as const;
const GRAY = [100, 100, 100] as const;
const LIGHT_GRAY = [240, 240, 240] as const;
const WHITE = [255, 255, 255] as const;

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
    const logoHeight = 14;
    doc.addImage(LOGO_WHITE_BASE64, "PNG", margin, 12, logoWidth, logoHeight);
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

  const numRest = data.numRestaurants > 0 ? data.numRestaurants : 1;
  const monthlyTotal = data.monthlyTotal > 0 ? data.monthlyTotal : data.pricePerRestaurant * numRest;
  const pricePerRestaurant = data.pricePerRestaurant > 0 ? data.pricePerRestaurant : (monthlyTotal / numRest);
  const contractTotal = data.contractTotal > 0 ? data.contractTotal : monthlyTotal * data.contractDuration;

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
  const aboutText =
    "A Mesa Ads é especialista em mídia offline de alto impacto: bolachas de chopp personalizadas, distribuídas em restaurantes e bares selecionados. Sua marca presente na mesa do consumidor — no momento mais descontraído do dia, gerando milhares de impressões orgânicas por mês com alta retenção.";
  y = justifyText(doc, aboutText, margin, y, contentWidth, 4.5);
  y += 8;

  y = checkPageBreak(doc, y, 60);
  y = drawSectionTitle(doc, "DESCRIÇÃO DO SERVIÇO", y, margin);

  y = drawInfoRow(doc, "Formato:", "Bolachas de chopp personalizadas (frente e verso)", y, margin);
  y = drawInfoRow(doc, "Volume total:", `${fmtNumber(data.coasterVolume)} bolachas/mês`, y, margin);
  if (data.numRestaurants > 0) {
    y = drawInfoRow(doc, "Distribuição:", `${data.numRestaurants} restaurante${data.numRestaurants !== 1 ? "s" : ""} parceiro${data.numRestaurants !== 1 ? "s" : ""}`, y, margin);
    y = drawInfoRow(doc, "Por restaurante:", `${fmtNumber(data.coastersPerRestaurant)} bolachas/mês`, y, margin);
  } else {
    y = drawInfoRow(doc, "Distribuição:", "A definir", y, margin);
  }
  y = drawInfoRow(doc, "Duração:", `${data.contractDuration} ${data.contractDuration === 1 ? "mês" : "meses"}`, y, margin);
  if (data.includesProduction) {
    y = drawInfoRow(doc, "Produção:", "Inclusa no valor", y, margin);
  }

  y += 8;
  y = checkPageBreak(doc, y, 70);
  y = drawSectionTitle(doc, "INVESTIMENTO", y, margin);

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

  if (data.restaurants.length > 0) {
    y += 4;
    y = checkPageBreak(doc, y, 60);
    y = drawSectionTitle(doc, "REDE DE DISTRIBUIÇÃO", y, margin);

    autoTable(doc, {
      startY: y,
      head: [["#", "Restaurante", "Bairro", "Bolachas/mês"]],
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

    y = (doc as any).lastAutoTable?.finalY || y + 40;
  }

  y += 10;
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
    "A produção das bolachas será iniciada após aprovação da arte pelo anunciante.",
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
