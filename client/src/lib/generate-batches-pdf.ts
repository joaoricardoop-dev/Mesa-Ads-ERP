import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { HOST_GROTESK_REGULAR, HOST_GROTESK_BOLD, LOGO_WHITE_BASE64 } from "./pdf-assets";

export interface BatchPDFItem {
  id: number;
  batchNumber: number;
  label: string;
  startDate: string;
  endDate: string;
  isActive: boolean;
  year: number;
}

const FONT_NAME = "HostGrotesk";
const GREEN  = [39, 216, 3]   as const;
const BLACK  = [13, 13, 13]   as const;
const WHITE  = [255, 255, 255] as const;
const DARK_GRAY = [60, 60, 60] as const;
const GRAY   = [100, 100, 100] as const;
const LIGHT_GRAY = [245, 245, 245] as const;

function registerFonts(doc: jsPDF) {
  doc.addFileToVFS("HostGrotesk-Regular.ttf", HOST_GROTESK_REGULAR);
  doc.addFont("HostGrotesk-Regular.ttf", FONT_NAME, "normal");
  doc.addFileToVFS("HostGrotesk-Bold.ttf", HOST_GROTESK_BOLD);
  doc.addFont("HostGrotesk-Bold.ttf", FONT_NAME, "bold");
  doc.setFont(FONT_NAME, "normal");
}

function fmtDate(dateStr: string): string {
  const d = new Date(dateStr + "T12:00:00");
  return d.toLocaleDateString("pt-BR", { day: "2-digit", month: "short", year: "numeric" });
}

function fmtDateShort(dateStr: string): string {
  const d = new Date(dateStr + "T12:00:00");
  return d.toLocaleDateString("pt-BR", { day: "2-digit", month: "short" });
}

function getBatchStatus(batch: BatchPDFItem): string {
  if (!batch.isActive) return "Inativo";
  const today = new Date().toISOString().split("T")[0];
  if (batch.endDate < today) return "Encerrado";
  if (batch.startDate <= today && batch.endDate >= today) return "Em andamento";
  return "Futuro";
}

function drawHeader(doc: jsPDF, pageWidth: number, margin: number, year: number) {
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
  doc.text("BATCHES DE VEICULAÇÃO", margin, 34);

  doc.setTextColor(200, 200, 200);
  doc.setFontSize(8);
  const rightLabel = `Ciclo ${year}  ·  Abr ${year} — Abr ${year + 1}`;
  doc.text(rightLabel, pageWidth - margin, 34, { align: "right" });
}

function drawFooter(doc: jsPDF, pageWidth: number, margin: number) {
  const pageHeight = doc.internal.pageSize.getHeight();
  const today = new Date().toLocaleDateString("pt-BR", { day: "2-digit", month: "long", year: "numeric" });

  doc.setFillColor(...BLACK);
  doc.rect(0, pageHeight - 18, pageWidth, 18, "F");

  doc.setTextColor(180, 180, 180);
  doc.setFontSize(7.5);
  doc.setFont(FONT_NAME, "normal");
  doc.text("mesa.ads — Gestão de Campanhas Publicitárias", margin, pageHeight - 7);
  doc.text(`Gerado em ${today}`, pageWidth - margin, pageHeight - 7, { align: "right" });
}

function getStatusColors(status: string): { text: [number, number, number]; fill: [number, number, number] } {
  switch (status) {
    case "Em andamento":
      return { text: [20, 160, 20], fill: [220, 255, 220] };
    case "Futuro":
      return { text: [30, 100, 200], fill: [220, 235, 255] };
    case "Encerrado":
      return { text: [100, 100, 100], fill: [240, 240, 240] };
    case "Inativo":
      return { text: [180, 40, 40], fill: [255, 230, 230] };
    default:
      return { text: [80, 80, 80], fill: [245, 245, 245] };
  }
}

export function generateBatchesPdf(batches: BatchPDFItem[], year: number) {
  const doc = new jsPDF();
  registerFonts(doc);

  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 14;

  drawHeader(doc, pageWidth, margin, year);

  const today = new Date().toISOString().split("T")[0];
  const totalActive   = batches.filter(b => b.isActive).length;
  const totalInactive = batches.filter(b => !b.isActive).length;
  const totalCurrent  = batches.filter(b => b.isActive && b.startDate <= today && b.endDate >= today).length;
  const totalFuture   = batches.filter(b => b.isActive && b.startDate > today).length;

  let y = 56;

  doc.setFont(FONT_NAME, "bold");
  doc.setFontSize(13);
  doc.setTextColor(...BLACK);
  doc.text(`Calendário de Batches — ${year}`, margin, y);
  y += 5;

  doc.setFont(FONT_NAME, "normal");
  doc.setFontSize(8.5);
  doc.setTextColor(...GRAY);
  doc.text(`Ciclo de 13 períodos de 4 semanas com início em 15 de abril de ${year}.`, margin, y);
  y += 10;

  const summaryBoxW = (pageWidth - margin * 2 - 9) / 4;
  const summaryItems = [
    { label: "Total de batches", value: String(batches.length) },
    { label: "Em andamento",     value: String(totalCurrent) },
    { label: "Futuros",          value: String(totalFuture) },
    { label: "Encerrados/Inativ.", value: String(batches.length - totalCurrent - totalFuture) },
  ];

  summaryItems.forEach((item, idx) => {
    const bx = margin + idx * (summaryBoxW + 3);
    doc.setFillColor(...LIGHT_GRAY);
    doc.roundedRect(bx, y, summaryBoxW, 18, 2, 2, "F");

    doc.setFont(FONT_NAME, "bold");
    doc.setFontSize(14);
    doc.setTextColor(...BLACK);
    doc.text(item.value, bx + summaryBoxW / 2, y + 10, { align: "center" });

    doc.setFont(FONT_NAME, "normal");
    doc.setFontSize(7);
    doc.setTextColor(...GRAY);
    doc.text(item.label, bx + summaryBoxW / 2, y + 15.5, { align: "center" });
  });

  y += 26;

  const tableBody = batches.map(batch => {
    const status = getBatchStatus(batch);
    const start = fmtDateShort(batch.startDate);
    const end = fmtDate(batch.endDate);
    const labelClean = batch.label
      .replace(/🛍️|🏆|🎭/g, "")
      .replace("Black Friday", "★ Black Friday")
      .replace("Copa do Mundo", "★ Copa do Mundo")
      .replace("Festival de Parintins", "★ Parintins")
      .trim();

    return [
      batch.batchNumber,
      labelClean,
      `${start} — ${end}`,
      "28 dias",
      status,
    ];
  });

  autoTable(doc, {
    startY: y,
    head: [["#", "Batch", "Período", "Duração", "Status"]],
    body: tableBody,
    margin: { left: margin, right: margin },
    headStyles: {
      fillColor: [...BLACK] as [number, number, number],
      textColor: [...WHITE] as [number, number, number],
      fontStyle: "bold",
      fontSize: 8.5,
      font: FONT_NAME,
      cellPadding: { top: 5, bottom: 5, left: 5, right: 5 },
    },
    columnStyles: {
      0: { halign: "center", cellWidth: 10 },
      1: { cellWidth: "auto", fontStyle: "bold" },
      2: { cellWidth: 58, halign: "center" },
      3: { cellWidth: 20, halign: "center" },
      4: { cellWidth: 28, halign: "center" },
    },
    alternateRowStyles: {
      fillColor: [250, 250, 250],
    },
    bodyStyles: {
      font: FONT_NAME,
      fontSize: 8.5,
      textColor: [...DARK_GRAY] as [number, number, number],
      cellPadding: { top: 4, bottom: 4, left: 5, right: 5 },
    },
    didDrawCell: (data) => {
      if (data.section === "body" && data.column.index === 4) {
        const status = String(data.cell.raw);
        const colors = getStatusColors(status);
        const { x, y: cy, width, height } = data.cell;
        const pad = 2;

        doc.setFillColor(...colors.fill);
        doc.roundedRect(x + pad, cy + pad, width - pad * 2, height - pad * 2, 2, 2, "F");

        doc.setFont(FONT_NAME, "bold");
        doc.setFontSize(7.5);
        doc.setTextColor(...colors.text);
        doc.text(status, x + width / 2, cy + height / 2 + 1, { align: "center" });
      }

      if (data.section === "body" && data.column.index === 0) {
        const { x, y: cy, width, height } = data.cell;
        const batchNum = Number(data.cell.raw);
        const status = getBatchStatus(batches[data.row.index]);
        const isActive = status === "Em andamento";

        if (isActive) {
          doc.setFillColor(...GREEN);
        } else {
          doc.setFillColor(220, 220, 220);
        }
        const r = 3.5;
        const cx2 = x + width / 2;
        const cy2 = cy + height / 2;
        doc.circle(cx2, cy2, r, "F");

        doc.setFont(FONT_NAME, "bold");
        doc.setFontSize(7);
        doc.setTextColor(isActive ? 255 : 80, isActive ? 255 : 80, isActive ? 255 : 80);
        doc.text(String(batchNum), cx2, cy2 + 1, { align: "center" });
      }
    },
    willDrawCell: (data) => {
      if (data.section === "body" && data.column.index === 4) {
        data.cell.text = [];
      }
      if (data.section === "body" && data.column.index === 0) {
        data.cell.text = [];
      }
    },
  });

  const finalY = (doc as any).lastAutoTable?.finalY ?? y + 20;

  if (finalY < pageHeight - 40) {
    const noteY = finalY + 10;
    doc.setFont(FONT_NAME, "normal");
    doc.setFontSize(7.5);
    doc.setTextColor(...GRAY);
    doc.text(
      "* Cada batch corresponde a um período de 28 dias (4 semanas) de veiculação das campanhas.",
      margin,
      noteY,
    );
    doc.text(
      "  Datas podem ser ajustadas manualmente via painel de gestão de batches.",
      margin,
      noteY + 5,
    );
  }

  drawFooter(doc, pageWidth, margin);

  const fileName = `batches-${year}.pdf`;
  doc.save(fileName);
}
