import jsPDF from "jspdf";
import {
  PDF_FONT as FONT_NAME,
  PDF_COLORS,
  registerPdfFonts,
  drawPdfHeader,
  drawPdfFooter,
} from "./pdf-branding";
import { formatIsoDateBR } from "@shared/billingSchedule";
import { PROPOSAL_BINDING_CLAUSE_PREFIX, CAMPAIGN_TERM_BINDING_CLAUSE_PREFIX } from "@shared/const";
import { fetchContractLinks } from "./contract-links";

export interface QuotationSignPDFData {
  orderNumber: string;
  quotationNumber: string;
  quotationName: string;
  description?: string;
  totalValue: number;
  coasterVolume: number;
  periodStart: string;
  periodEnd: string;
  restaurants: string[];
  signerName: string;
  signerCpf: string;
  signedAt: string;
  signatureHash?: string;
  /** Task #197 — cronograma de parcelas (opcional). */
  billingSchedule?: Array<{ sequence: number; amount: string | number; dueDate: string }>;
}

export async function generateQuotationSignPdf(data: QuotationSignPDFData) {
  const { masterContractUrl, campaignTermUrl } = await fetchContractLinks();
  const doc = new jsPDF();
  registerPdfFonts(doc);
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 20;
  const contentWidth = pageWidth - margin * 2;
  void contentWidth;

  drawPdfHeader(doc, {
    eyebrow: "ORDEM DE SERVIÇO",
    meta: `OS #${data.orderNumber}`,
    margin,
  });

  let y = 56;

  doc.setTextColor(...PDF_COLORS.ink);
  doc.setFontSize(14);
  doc.setFont(FONT_NAME, "bold");
  doc.text("DETALHES DA COTAÇÃO", margin, y);
  y += 10;

  doc.setFontSize(9);
  doc.setTextColor(60, 60, 60);

  const quotationRows: [string, string][] = [
    ["Cotação:", `#${data.quotationNumber}`],
    ["Nome:", data.quotationName],
    ["Volume de Bolachas:", `${data.coasterVolume.toLocaleString("pt-BR")} unidades`],
  ];

  if (data.description) {
    quotationRows.push(["Descrição:", data.description]);
  }

  for (const [label, value] of quotationRows) {
    doc.setFont(FONT_NAME, "bold");
    doc.text(label, margin, y);
    doc.setFont(FONT_NAME, "normal");
    const labelWidth = doc.getTextWidth(label) + 3;
    const valueLines = doc.splitTextToSize(value, contentWidth - labelWidth);
    doc.text(valueLines, margin + labelWidth, y);
    y += valueLines.length * 5 + 2;
  }

  y += 6;
  doc.setDrawColor(220, 220, 220);
  doc.line(margin, y, pageWidth - margin, y);
  y += 10;

  doc.setTextColor(...PDF_COLORS.ink);
  doc.setFontSize(12);
  doc.setFont(FONT_NAME, "bold");
  doc.text("FINANCEIRO", margin, y);
  y += 8;

  doc.setFontSize(9);
  doc.setTextColor(60, 60, 60);
  doc.setFont(FONT_NAME, "bold");
  doc.text("Valor Total:", margin, y);
  doc.setFont(FONT_NAME, "normal");
  doc.text(
    `R$ ${data.totalValue.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
    margin + 25,
    y
  );
  y += 10;

  doc.setDrawColor(220, 220, 220);
  doc.line(margin, y, pageWidth - margin, y);
  y += 10;

  doc.setTextColor(...PDF_COLORS.ink);
  doc.setFontSize(12);
  doc.setFont(FONT_NAME, "bold");
  doc.text("PERÍODO", margin, y);
  y += 8;

  doc.setFontSize(9);
  doc.setTextColor(60, 60, 60);

  const formatDate = (d: string) => formatIsoDateBR(d);

  doc.setFont(FONT_NAME, "bold");
  doc.text("Início:", margin, y);
  doc.setFont(FONT_NAME, "normal");
  doc.text(formatDate(data.periodStart), margin + 18, y);
  doc.setFont(FONT_NAME, "bold");
  doc.text("Fim:", margin + 60, y);
  doc.setFont(FONT_NAME, "normal");
  doc.text(formatDate(data.periodEnd), margin + 72, y);
  y += 10;

  doc.setDrawColor(220, 220, 220);
  doc.line(margin, y, pageWidth - margin, y);
  y += 10;

  // Task #197 — Condições de pagamento
  if (data.billingSchedule && data.billingSchedule.length > 0) {
    if (y > pageHeight - (40 + data.billingSchedule.length * 7)) {
      doc.addPage();
      y = 20;
    }
    doc.setTextColor(...PDF_COLORS.ink);
    doc.setFontSize(12);
    doc.setFont(FONT_NAME, "bold");
    doc.text("CONDIÇÕES DE PAGAMENTO", margin, y);
    y += 8;
    doc.setFontSize(9);
    doc.setTextColor(100, 100, 100);
    doc.setFont(FONT_NAME, "bold");
    doc.text("#", margin, y);
    doc.text("Vencimento", margin + 15, y);
    doc.text("Valor", pageWidth - margin, y, { align: "right" });
    y += 2;
    doc.setDrawColor(220, 220, 220);
    doc.line(margin, y, pageWidth - margin, y);
    y += 5;
    doc.setFont(FONT_NAME, "normal");
    doc.setTextColor(60, 60, 60);
    for (const r of data.billingSchedule) {
      const due = formatIsoDateBR(r.dueDate);
      doc.text(String(r.sequence), margin, y);
      doc.text(due, margin + 15, y);
      doc.text(
        `R$ ${parseFloat(String(r.amount)).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
        pageWidth - margin,
        y,
        { align: "right" },
      );
      y += 6;
    }
    y += 6;
    doc.setDrawColor(220, 220, 220);
    doc.line(margin, y, pageWidth - margin, y);
    y += 10;
  }

  // ── Termos e condições (links contrato master + termo de campanha) ──────────
  // Fonte única do servidor (fetchContractLinks), editável em Termos Padrão.
  if (y > pageHeight - 80) {
    doc.addPage();
    y = 20;
  }
  doc.setTextColor(...PDF_COLORS.ink);
  doc.setFontSize(11);
  doc.setFont(FONT_NAME, "bold");
  doc.text("TERMOS E CONDIÇÕES", margin, y);
  y += 7;
  doc.setFont(FONT_NAME, "normal");
  doc.setFontSize(8);

  const drawClauseWithLink = (prefix: string, url: string) => {
    const lines = doc.splitTextToSize(prefix, contentWidth) as string[];
    doc.setTextColor(80, 80, 80);
    doc.text(lines, margin, y);
    y += lines.length * 4.2 + 1;
    doc.setTextColor(...PDF_COLORS.neon);
    doc.textWithLink(url, margin, y, { url });
    y += 7;
  };

  drawClauseWithLink(PROPOSAL_BINDING_CLAUSE_PREFIX, masterContractUrl);
  drawClauseWithLink(CAMPAIGN_TERM_BINDING_CLAUSE_PREFIX, campaignTermUrl);
  y += 6;

  if (y > pageHeight - 60) {
    doc.addPage();
    y = 20;
  }

  doc.setDrawColor(...PDF_COLORS.neon);
  doc.setLineWidth(0.5);
  doc.line(margin, y, pageWidth - margin, y);
  y += 10;

  doc.setFontSize(10);
  doc.setFont(FONT_NAME, "bold");
  doc.setTextColor(...PDF_COLORS.ink);
  doc.text("DADOS DO SIGNATÁRIO", margin, y);
  y += 8;

  const dateStr = new Date(data.signedAt).toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "long",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });

  doc.setFontSize(9);
  doc.setTextColor(60, 60, 60);

  const signerRows: [string, string][] = [
    ["Nome:", data.signerName],
    ["CPF:", data.signerCpf],
    ["Data/Hora:", dateStr],
  ];

  for (const [label, value] of signerRows) {
    doc.setFont(FONT_NAME, "bold");
    doc.text(label, margin, y);
    doc.setFont(FONT_NAME, "normal");
    doc.text(value, margin + 25, y);
    y += 6;
  }

  const footerY = pageHeight - 15;
  doc.setDrawColor(220, 220, 220);
  doc.line(margin, footerY - 8, pageWidth - margin, footerY - 8);

  doc.setFontSize(7);
  doc.setTextColor(140, 140, 140);
  doc.text("Documento gerado automaticamente pela plataforma mesa.ads", margin, footerY);
  if (data.signatureHash) {
    doc.text(`Verificação: ${data.signatureHash.substring(0, 32)}...`, margin, footerY + 4);
  }

  doc.setFontSize(7);
  doc.setTextColor(...PDF_COLORS.neon);
  doc.text("mesa.ads", pageWidth - margin, footerY, { align: "right" });

  const fileName = `OS_${data.orderNumber}_cotacao_${data.quotationNumber}_${new Date(data.signedAt).toISOString().split("T")[0]}.pdf`;
  doc.save(fileName);
}
