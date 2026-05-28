import jsPDF from "jspdf";
import { HOST_GROTESK_REGULAR, HOST_GROTESK_BOLD, LOGO_WHITE_BASE64 } from "./pdf-assets";

export const PDF_FONT = "HostGrotesk";

export const PDF_COLORS = {
  neon:        [0, 194, 56]    as const,
  neonSoft:    [0, 230, 64]    as const,
  magenta:     [229, 30, 117]  as const,
  ink:         [10, 10, 12]    as const,
  inkSoft:     [20, 20, 24]    as const,
  paper:       [250, 249, 246] as const,
  white:       [255, 255, 255] as const,
  textPrimary: [13, 13, 14]    as const,
  textBody:    [55, 55, 58]    as const,
  textMuted:   [107, 107, 112] as const,
  textFaint:   [160, 160, 165] as const,
  hairline:    [228, 226, 220] as const,
  hairlineSoft:[238, 236, 230] as const,
  surfaceSoft: [243, 241, 237] as const,
  surfaceMuted:[248, 247, 243] as const,
  neonTint:    [231, 251, 234] as const,
  amber:       [245, 158, 11]  as const,
} as const;

export const GREEN = PDF_COLORS.neon;
export const BLACK = PDF_COLORS.ink;
export const WHITE = PDF_COLORS.white;
export const DARK_GRAY = PDF_COLORS.textBody;
export const GRAY = PDF_COLORS.textMuted;
export const LIGHT_GRAY = PDF_COLORS.surfaceSoft;

export function registerPdfFonts(doc: jsPDF) {
  doc.addFileToVFS("HostGrotesk-Regular.ttf", HOST_GROTESK_REGULAR);
  doc.addFont("HostGrotesk-Regular.ttf", PDF_FONT, "normal");
  doc.addFileToVFS("HostGrotesk-Bold.ttf", HOST_GROTESK_BOLD);
  doc.addFont("HostGrotesk-Bold.ttf", PDF_FONT, "bold");
  doc.setFont(PDF_FONT, "normal");
}

export interface DrawHeaderOptions {
  /** Uppercase, mono-style eyebrow shown under the logo. */
  eyebrow: string;
  /** Right-aligned secondary text (date, ref, etc). */
  meta?: string;
  /** Defaults to 20. */
  margin?: number;
  /** Defaults to 44 (42 + 2 accent bar). */
  height?: number;
}

export function drawPdfHeader(doc: jsPDF, opts: DrawHeaderOptions) {
  const pageWidth = doc.internal.pageSize.getWidth();
  const margin = opts.margin ?? 20;
  const baseHeight = opts.height ?? 42;

  doc.setFillColor(...PDF_COLORS.ink);
  doc.rect(0, 0, pageWidth, baseHeight, "F");

  doc.setFillColor(...PDF_COLORS.neon);
  doc.rect(0, baseHeight, pageWidth, 2, "F");

  let logoDrawn = false;
  try {
    const logoWidth = 40;
    const logoHeight = logoWidth / 4.254;
    doc.addImage(LOGO_WHITE_BASE64, "PNG", margin, 14, logoWidth, logoHeight);
    logoDrawn = true;
  } catch {
    // fall through to text fallback
  }
  if (!logoDrawn) {
    doc.setTextColor(...PDF_COLORS.white);
    doc.setFontSize(22);
    doc.setFont(PDF_FONT, "bold");
    doc.text("mesa", margin, 24);
    const mesaWidth = doc.getTextWidth("mesa");
    doc.setTextColor(...PDF_COLORS.neon);
    doc.text(".ads", margin + mesaWidth, 24);
  }

  doc.setTextColor(...PDF_COLORS.white);
  doc.setFontSize(8.5);
  doc.setFont(PDF_FONT, "bold");
  doc.text(opts.eyebrow, margin, 34);

  if (opts.meta) {
    doc.setTextColor(200, 200, 200);
    doc.setFontSize(8);
    doc.setFont(PDF_FONT, "normal");
    doc.text(opts.meta, pageWidth - margin, 34, { align: "right" });
  }
}

export function drawPdfSectionTitle(doc: jsPDF, title: string, y: number, margin = 20): number {
  doc.setTextColor(...PDF_COLORS.textPrimary);
  doc.setFontSize(11.5);
  doc.setFont(PDF_FONT, "bold");
  doc.text(title, margin, y);
  y += 3;
  doc.setDrawColor(...PDF_COLORS.hairline);
  doc.setLineWidth(0.3);
  doc.line(margin, y, doc.internal.pageSize.getWidth() - margin, y);
  return y + 8;
}

export function drawPdfInfoRow(
  doc: jsPDF,
  label: string,
  value: string,
  y: number,
  margin = 20,
  labelWidth = 35,
): number {
  doc.setTextColor(...PDF_COLORS.textMuted);
  doc.setFontSize(9);
  doc.setFont(PDF_FONT, "bold");
  doc.text(label, margin, y);
  doc.setFont(PDF_FONT, "normal");
  doc.setTextColor(...PDF_COLORS.textBody);
  doc.text(value, margin + labelWidth, y);
  return y + 6;
}

export function pdfCheckPageBreak(doc: jsPDF, y: number, needed: number, topMargin = 25): number {
  const pageHeight = doc.internal.pageSize.getHeight();
  if (y + needed > pageHeight - 30) {
    doc.addPage();
    return topMargin;
  }
  return y;
}

export interface DrawFooterOptions {
  /** Centered/left footer line. */
  label?: string;
  /** Right-aligned text (page numbers etc handled separately). */
  margin?: number;
}

export function drawPdfFooter(doc: jsPDF, opts: DrawFooterOptions = {}) {
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = opts.margin ?? 20;
  const footerY = pageHeight - 15;

  doc.setDrawColor(...PDF_COLORS.hairline);
  doc.setLineWidth(0.3);
  doc.line(margin, footerY - 8, pageWidth - margin, footerY - 8);

  doc.setFontSize(7);
  doc.setFont(PDF_FONT, "normal");
  doc.setTextColor(...PDF_COLORS.textFaint);
  doc.text(opts.label || "Documento gerado automaticamente pela plataforma mesa.ads", margin, footerY);

  doc.setFontSize(7);
  doc.setFont(PDF_FONT, "bold");
  doc.setTextColor(...PDF_COLORS.neon);
  doc.text("mesa.ads", pageWidth - margin, footerY, { align: "right" });
}

export function fmtBRL(val: number): string {
  return `R$ ${val.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export function fmtNumberBR(val: number): string {
  return val.toLocaleString("pt-BR");
}
