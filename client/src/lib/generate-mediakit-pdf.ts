import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { HOST_GROTESK_REGULAR, HOST_GROTESK_BOLD, LOGO_WHITE_BASE64 } from "./pdf-assets";

const FONT_NAME = "HostGrotesk";
const GREEN = [39, 216, 3] as const;
const BLACK = [13, 13, 13] as const;
const DARK_GRAY = [60, 60, 60] as const;
const GRAY = [120, 120, 120] as const;
const LIGHT_GRAY = [245, 245, 245] as const;
const WHITE = [255, 255, 255] as const;

const TIPO_LABELS: Record<string, string> = {
  coaster: "Porta-Copo",
  display: "Display",
  cardapio: "Cardápio",
  totem: "Totem",
  adesivo: "Adesivo",
  porta_guardanapo: "Porta-Guardanapo",
  outro: "Outro",
  impressos: "Impresso",
  eletronicos: "Eletrônico",
  telas: "Telas / Mídia Digital",
};

export interface MediaKitData {
  settings: {
    tagline?: string | null;
    intro?: string | null;
    contactName?: string | null;
    contactEmail?: string | null;
    contactPhone?: string | null;
    website?: string | null;
    footerText?: string | null;
    updatedAt?: string | Date | null;
  } | null;
  products: Array<{
    id: number;
    name: string;
    description?: string | null;
    tipo?: string | null;
    unitLabel?: string | null;
    unitLabelPlural?: string | null;
    defaultQtyPerLocation?: number | null;
    defaultSemanas?: number | null;
  }>;
}

function registerFonts(doc: jsPDF) {
  doc.addFileToVFS("HostGrotesk-Regular.ttf", HOST_GROTESK_REGULAR);
  doc.addFont("HostGrotesk-Regular.ttf", FONT_NAME, "normal");
  doc.addFileToVFS("HostGrotesk-Bold.ttf", HOST_GROTESK_BOLD);
  doc.addFont("HostGrotesk-Bold.ttf", FONT_NAME, "bold");
  doc.setFont(FONT_NAME, "normal");
}

function drawPageHeader(doc: jsPDF, pageWidth: number) {
  doc.setFillColor(...BLACK);
  doc.rect(0, 0, pageWidth, 40, "F");
  doc.setFillColor(...GREEN);
  doc.rect(0, 40, pageWidth, 2, "F");

  const logoW = 36;
  const logoH = 10;
  const logoX = 14;
  const logoY = (40 - logoH) / 2;
  doc.addImage(LOGO_WHITE_BASE64, "PNG", logoX, logoY, logoW, logoH);

  const year = new Date().getFullYear();
  doc.setFont(FONT_NAME, "normal");
  doc.setFontSize(8);
  doc.setTextColor(...GRAY);
  doc.text(`Media Kit ${year}`, pageWidth - 14, 23, { align: "right" });
}

function drawPageFooter(doc: jsPDF, pageWidth: number, pageHeight: number, footerText?: string | null) {
  const y = pageHeight - 12;
  doc.setFillColor(...BLACK);
  doc.rect(0, y - 4, pageWidth, 16, "F");
  doc.setFont(FONT_NAME, "normal");
  doc.setFontSize(7);
  doc.setTextColor(...GRAY);
  const txt = footerText || "Mesa ADS — Publicidade em Ambientes Gastronômicos";
  doc.text(txt, 14, y + 2);
  doc.text(`${doc.getCurrentPageInfo().pageNumber}`, pageWidth - 14, y + 2, { align: "right" });
}

export function generateMediaKitPdf(data: MediaKitData): void {
  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
  registerFonts(doc);

  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 14;

  const settings = data.settings ?? {};
  const tagline = settings.tagline || "Publicidade Que Conecta Marcas a Pessoas";
  const intro = settings.intro || "A Mesa ADS é uma plataforma de mídia especializada em ambientes gastronômicos, conectando marcas ao público certo no momento certo.";

  doc.setFillColor(...BLACK);
  doc.rect(0, 0, pageWidth, pageHeight, "F");

  const logoW = 56;
  const logoH = 16;
  doc.addImage(LOGO_WHITE_BASE64, "PNG", (pageWidth - logoW) / 2, 52, logoW, logoH);

  doc.setFillColor(...GREEN);
  doc.rect((pageWidth - 40) / 2, 76, 40, 2, "F");

  doc.setFont(FONT_NAME, "bold");
  doc.setFontSize(22);
  doc.setTextColor(...WHITE);
  const taglineLines = doc.splitTextToSize(tagline, pageWidth - margin * 2 - 20) as string[];
  let ty = 90;
  for (const line of taglineLines) {
    doc.text(line, pageWidth / 2, ty, { align: "center" });
    ty += 9;
  }

  doc.setFont(FONT_NAME, "normal");
  doc.setFontSize(10);
  doc.setTextColor(200, 200, 200);
  const introLines = doc.splitTextToSize(intro, pageWidth - margin * 2 - 20) as string[];
  let iy = ty + 10;
  for (const line of introLines) {
    doc.text(line, pageWidth / 2, iy, { align: "center" });
    iy += 5.5;
  }

  const year = new Date().getFullYear();
  doc.setFontSize(9);
  doc.setTextColor(...GRAY);
  doc.text(`Media Kit ${year}`, pageWidth / 2, pageHeight - 20, { align: "center" });

  if (settings.website) {
    doc.setTextColor(...GREEN);
    doc.text(settings.website, pageWidth / 2, pageHeight - 14, { align: "center" });
  }

  doc.addPage();
  drawPageHeader(doc, pageWidth);

  let y = 54;

  doc.setFont(FONT_NAME, "bold");
  doc.setFontSize(15);
  doc.setTextColor(...BLACK);
  doc.text("Nossos Formatos de Mídia", margin, y);
  y += 6;
  doc.setFillColor(...GREEN);
  doc.rect(margin, y, 30, 1.5, "F");
  y += 10;

  doc.setFont(FONT_NAME, "normal");
  doc.setFontSize(9.5);
  doc.setTextColor(...DARK_GRAY);
  doc.text("Soluções de mídia out-of-home integradas ao cotidiano gastronômico do seu público.", margin, y, { maxWidth: pageWidth - margin * 2 });
  y += 12;

  const tableBody = data.products.map((p) => [
    p.name,
    TIPO_LABELS[p.tipo ?? ""] || p.tipo || "—",
    p.description
      ? p.description.length > 120
        ? p.description.substring(0, 117) + "..."
        : p.description
      : "—",
  ]);

  autoTable(doc, {
    startY: y,
    head: [["Produto", "Tipo", "Descrição"]],
    body: tableBody.length > 0 ? tableBody : [["Nenhum produto cadastrado", "", ""]],
    margin: { left: margin, right: margin },
    headStyles: {
      fillColor: [...BLACK] as [number, number, number],
      textColor: [...WHITE] as [number, number, number],
      fontStyle: "bold",
      fontSize: 9,
      cellPadding: { top: 4, bottom: 4, left: 4, right: 4 },
    },
    bodyStyles: {
      fontSize: 8.5,
      textColor: [...DARK_GRAY] as [number, number, number],
      fontStyle: "normal",
      cellPadding: { top: 4, bottom: 4, left: 4, right: 4 },
    },
    alternateRowStyles: { fillColor: [...LIGHT_GRAY] as [number, number, number] },
    columnStyles: {
      0: { cellWidth: 48, fontStyle: "bold" },
      1: { cellWidth: 36 },
      2: { cellWidth: "auto" },
    },
    didDrawPage: (hookData) => {
      drawPageHeader(doc, pageWidth);
      drawPageFooter(doc, pageWidth, pageHeight, settings.footerText);
      hookData.settings.startY = 50;
    },
  });

  const contactFields = [
    settings.contactName,
    settings.contactEmail,
    settings.contactPhone,
    settings.website,
  ].filter(Boolean);

  if (contactFields.length > 0) {
    const afterTableY = (doc as any).lastAutoTable?.finalY ?? 0;
    const remaining = pageHeight - afterTableY - 30;
    const contactBlockH = 28 + contactFields.length * 7;

    if (remaining < contactBlockH) {
      doc.addPage();
      drawPageHeader(doc, pageWidth);
      y = 54;
    } else {
      y = afterTableY + 14;
    }

    doc.setFont(FONT_NAME, "bold");
    doc.setFontSize(12);
    doc.setTextColor(...BLACK);
    doc.text("Entre em Contato", margin, y);
    y += 4;
    doc.setFillColor(...GREEN);
    doc.rect(margin, y, 22, 1.2, "F");
    y += 9;

    doc.setFont(FONT_NAME, "normal");
    doc.setFontSize(9.5);
    doc.setTextColor(...DARK_GRAY);
    for (const field of contactFields) {
      doc.text(field as string, margin, y);
      y += 7;
    }
  }

  const totalPages = doc.getNumberOfPages();
  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i);
    if (i > 1) {
      drawPageFooter(doc, pageWidth, pageHeight, settings.footerText);
    }
  }

  doc.save(`media-kit-mesa-ads-${new Date().getFullYear()}.pdf`);
}
