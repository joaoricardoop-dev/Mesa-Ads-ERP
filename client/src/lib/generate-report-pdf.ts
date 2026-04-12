import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { HOST_GROTESK_REGULAR, HOST_GROTESK_BOLD, LOGO_WHITE_BASE64 } from "./pdf-assets";

const FONT_NAME = "HostGrotesk";
const GREEN = [39, 216, 3] as const;
const BLACK = [13, 13, 13] as const;
const DARK_GRAY = [60, 60, 60] as const;
const GRAY = [100, 100, 100] as const;
const LIGHT_GRAY = [240, 240, 240] as const;
const WHITE = [255, 255, 255] as const;

export interface ReportPDFData {
  campaignName: string;
  clientName?: string;
  reportTitle: string;
  periodStart: string;
  periodEnd: string;
  reportType: "coaster" | "telas" | "ativacao";
  numRestaurants: number;
  coastersDistributed: number;
  usagePerDay: number;
  daysInPeriod: number;
  numScreens: number;
  spotsPerDay: number;
  spotDurationSeconds: number;
  activationEvents: number;
  peoplePerEvent: number;
  totalImpressions: number;
  notes?: string | null;
  photos: Array<{ url: string; caption?: string | null }>;
  publishedAt?: string | null;
}

function registerFonts(doc: jsPDF) {
  doc.addFileToVFS("HostGrotesk-Regular.ttf", HOST_GROTESK_REGULAR);
  doc.addFont("HostGrotesk-Regular.ttf", FONT_NAME, "normal");
  doc.addFileToVFS("HostGrotesk-Bold.ttf", HOST_GROTESK_BOLD);
  doc.addFont("HostGrotesk-Bold.ttf", FONT_NAME, "bold");
  doc.setFont(FONT_NAME, "normal");
}

function fmtNumber(val: number): string {
  return val.toLocaleString("pt-BR");
}

function fmtDate(d: string): string {
  try {
    const [y, m, day] = d.split("-").map(Number);
    return new Date(y, m - 1, day).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric" });
  } catch {
    return d;
  }
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
  doc.text("RELATÓRIO DE CAMPANHA", margin, 34);

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
  doc.text(value, margin + 45, y);
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

function getTypeLabel(reportType: string): string {
  if (reportType === "telas") return "Telas / Digital";
  if (reportType === "ativacao") return "Ativação";
  return "Coasters / Porta-Copos";
}

function getMetricsRows(data: ReportPDFData): string[][] {
  const rows: string[][] = [];

  if (data.reportType === "coaster") {
    rows.push(["Restaurantes ativos", fmtNumber(data.numRestaurants)]);
    rows.push(["Coasters distribuídos", `${fmtNumber(data.coastersDistributed)} un.`]);
    rows.push(["Usos por dia (estimativa)", `${fmtNumber(data.usagePerDay)} vezes/dia`]);
    rows.push(["Dias no período", `${fmtNumber(data.daysInPeriod)} dias`]);
    rows.push(["Total de impressões", fmtNumber(data.totalImpressions)]);
  } else if (data.reportType === "telas") {
    rows.push(["Telas ativas", fmtNumber(data.numScreens)]);
    rows.push(["Spots por dia", `${fmtNumber(data.spotsPerDay)} spots/dia`]);
    rows.push(["Duração do spot", `${data.spotDurationSeconds}s`]);
    rows.push(["Dias no período", `${fmtNumber(data.daysInPeriod)} dias`]);
    rows.push(["Total de impressões", fmtNumber(data.totalImpressions)]);
  } else if (data.reportType === "ativacao") {
    rows.push(["Eventos de ativação", fmtNumber(data.activationEvents)]);
    rows.push(["Pessoas por evento (estimativa)", fmtNumber(data.peoplePerEvent)]);
    rows.push(["Total de impressões", fmtNumber(data.totalImpressions)]);
  }

  return rows;
}

export async function generateReportPdf(data: ReportPDFData): Promise<void> {
  const doc = new jsPDF();
  registerFonts(doc);

  const pageWidth = doc.internal.pageSize.getWidth();
  const margin = 20;

  drawHeader(doc, pageWidth, margin);

  let y = 56;

  doc.setTextColor(...GRAY);
  doc.setFontSize(8);
  doc.setFont(FONT_NAME, "normal");
  doc.text(`Ref: ${data.campaignName}`, margin, y);
  y += 10;

  y = drawSectionTitle(doc, "INFORMAÇÕES DO RELATÓRIO", y, margin);
  if (data.clientName) {
    y = drawInfoRow(doc, "Anunciante:", data.clientName, y, margin);
  }
  y = drawInfoRow(doc, "Campanha:", data.campaignName, y, margin);
  y = drawInfoRow(doc, "Título do Relatório:", data.reportTitle, y, margin);
  y = drawInfoRow(doc, "Tipo:", getTypeLabel(data.reportType), y, margin);
  y = drawInfoRow(doc, "Período:", `${fmtDate(data.periodStart)} – ${fmtDate(data.periodEnd)}`, y, margin);
  if (data.publishedAt) {
    y = drawInfoRow(doc, "Publicado em:", new Date(data.publishedAt).toLocaleDateString("pt-BR"), y, margin);
  }

  y += 8;
  y = checkPageBreak(doc, y, 60);
  y = drawSectionTitle(doc, "MÉTRICAS DE IMPACTO", y, margin);

  const metricsRows = getMetricsRows(data);

  autoTable(doc, {
    startY: y,
    head: [["Métrica", "Valor"]],
    body: metricsRows,
    theme: "grid",
    styles: { font: FONT_NAME, fontSize: 9 },
    headStyles: { fillColor: [...BLACK], textColor: [...WHITE], fontSize: 9, fontStyle: "bold", font: FONT_NAME },
    bodyStyles: { textColor: [40, 40, 40], font: FONT_NAME },
    alternateRowStyles: { fillColor: [250, 250, 250] },
    margin: { left: margin, right: margin },
    columnStyles: {
      0: { fontStyle: "bold", cellWidth: 80 },
      1: { halign: "right" },
    },
  });

  y = (doc as unknown as { lastAutoTable?: { finalY?: number } }).lastAutoTable?.finalY || y + 40;
  y += 8;

  const highlightBoxH = 28;
  y = checkPageBreak(doc, y, highlightBoxH + 10);
  doc.setFillColor(39, 216, 3, 0.1);
  doc.setFillColor(240, 250, 240);
  doc.roundedRect(margin, y, pageWidth - margin * 2, highlightBoxH, 3, 3, "F");
  doc.setDrawColor(39, 216, 3);
  doc.roundedRect(margin, y, pageWidth - margin * 2, highlightBoxH, 3, 3, "S");

  doc.setTextColor(...GRAY);
  doc.setFontSize(8);
  doc.setFont(FONT_NAME, "normal");
  doc.text("Total de Impressões Estimadas no Período", margin + 8, y + 10);

  doc.setTextColor(...BLACK);
  doc.setFontSize(16);
  doc.setFont(FONT_NAME, "bold");
  doc.text(fmtNumber(data.totalImpressions), pageWidth - margin - 8, y + 20, { align: "right" });

  y += highlightBoxH + 8;

  if (data.notes && data.notes.trim()) {
    y = checkPageBreak(doc, y, 40);
    y = drawSectionTitle(doc, "OBSERVAÇÕES", y, margin);
    doc.setTextColor(...DARK_GRAY);
    doc.setFontSize(9);
    doc.setFont(FONT_NAME, "normal");
    const lines = doc.splitTextToSize(data.notes.trim(), pageWidth - margin * 2);
    doc.text(lines, margin, y);
    y += lines.length * 5 + 8;
  }

  if (data.photos.length > 0) {
    y = checkPageBreak(doc, y, 30);
    y = drawSectionTitle(doc, "FOTOS DA VEICULAÇÃO", y, margin);

    const colCount = 2;
    const imgWidth = (pageWidth - margin * 2 - 8) / colCount;
    const imgHeight = 60;
    const gapX = 8;
    const gapY = 12;

    for (let i = 0; i < data.photos.length; i++) {
      const photo = data.photos[i];
      const col = i % colCount;
      const x = margin + col * (imgWidth + gapX);

      if (col === 0 && i > 0) {
        y += imgHeight + gapY;
      }

      y = checkPageBreak(doc, y, imgHeight + 20);

      try {
        const response = await fetch(photo.url);
        const blob = await response.blob();
        const dataUrl = await new Promise<string>((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = () => resolve(reader.result as string);
          reader.onerror = reject;
          reader.readAsDataURL(blob);
        });

        const img = new Image();
        await new Promise<void>((resolve, reject) => {
          img.onload = () => resolve();
          img.onerror = reject;
          img.src = dataUrl;
        });

        const imgFormat = photo.url.toLowerCase().endsWith(".png") ? "PNG" : "JPEG";
        doc.addImage(dataUrl, imgFormat, x, y, imgWidth, imgHeight, undefined, "MEDIUM");

        if (photo.caption) {
          doc.setFontSize(7);
          doc.setFont(FONT_NAME, "normal");
          doc.setTextColor(...GRAY);
          doc.text(photo.caption, x, y + imgHeight + 4, { maxWidth: imgWidth });
        }
      } catch {
        doc.setFillColor(...LIGHT_GRAY);
        doc.rect(x, y, imgWidth, imgHeight, "F");
        doc.setFontSize(8);
        doc.setTextColor(...GRAY);
        doc.text("Foto indisponível", x + imgWidth / 2, y + imgHeight / 2, { align: "center" });
      }
    }

    y += imgHeight + gapY;
  }

  const totalPages = (doc.internal as unknown as { pages: unknown[] }).pages?.length ?? 1;
  for (let p = 1; p <= totalPages; p++) {
    doc.setPage(p);
    const ph = doc.internal.pageSize.getHeight();
    const pw = doc.internal.pageSize.getWidth();
    doc.setFillColor(...BLACK);
    doc.rect(0, ph - 18, pw, 18, "F");
    doc.setTextColor(150, 150, 150);
    doc.setFontSize(7);
    doc.setFont(FONT_NAME, "normal");
    doc.text("Mesa Ads · Relatório de Campanha · Confidencial", margin, ph - 6);
    doc.text(`Página ${p}`, pw - margin, ph - 6, { align: "right" });
  }

  const safeName = data.reportTitle.replace(/[^a-zA-Z0-9]/g, "_").substring(0, 50);
  doc.save(`relatorio_${safeName}.pdf`);
}
