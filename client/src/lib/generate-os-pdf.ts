import jsPDF from "jspdf";
import { formatIsoDateBR } from "@shared/billingSchedule";
import autoTable from "jspdf-autotable";
import {
  PDF_FONT as FONT_NAME,
  PDF_COLORS,
  registerPdfFonts,
  drawPdfHeader,
} from "./pdf-branding";
import { PROPOSAL_BINDING_CLAUSE_PREFIX, CAMPAIGN_TERM_BINDING_CLAUSE_PREFIX } from "@shared/const";
import { fetchContractLinks } from "./contract-links";

const TYPE_SUBTITLE: Record<string, string> = {
  anunciante:  "ORDEM DE SERVIÇO — ANUNCIANTE",
  producao:    "ORDEM DE SERVIÇO — PRODUÇÃO",
  distribuicao:"ORDEM DE SERVIÇO — DISTRIBUIÇÃO",
};

interface OSPDFData {
  orderNumber: string;
  quotationNumber: string;
  type?: string;
  clientName: string;
  clientCompany?: string;
  coasterVolume: number;
  totalValue?: string;
  paymentTerms?: string;
  periodStart?: string;
  periodEnd?: string;
  description?: string;
  restaurants: Array<{
    name: string;
    coasterQuantity: number;
  }>;
}

export async function generateOSPdf(data: OSPDFData) {
  const { masterContractUrl, campaignTermUrl } = await fetchContractLinks();
  const doc = new jsPDF();
  const pageWidth = doc.internal.pageSize.getWidth();

  registerPdfFonts(doc);
  const subtitle = (data.type && TYPE_SUBTITLE[data.type]) || TYPE_SUBTITLE.anunciante;

  drawPdfHeader(doc, {
    eyebrow: subtitle,
    meta: `${data.orderNumber}  ·  Ref: ${data.quotationNumber}`,
    margin: 20,
  });

  let y = 55;
  doc.setTextColor(0, 0, 0);

  doc.setFontSize(10);
  doc.setFont(FONT_NAME, "bold");
  doc.text("DADOS DO ANUNCIANTE", 20, y);
  y += 8;
  doc.setFont(FONT_NAME, "normal");
  doc.setFontSize(9);
  doc.text(`Nome: ${data.clientName}`, 20, y);
  y += 6;
  if (data.clientCompany) {
    doc.text(`Empresa: ${data.clientCompany}`, 20, y);
    y += 6;
  }

  y += 4;
  doc.setFont(FONT_NAME, "bold");
  doc.setFontSize(10);
  doc.text("DETALHES DA CAMPANHA", 20, y);
  y += 8;
  doc.setFont(FONT_NAME, "normal");
  doc.setFontSize(9);
  doc.text(`Volume: ${data.coasterVolume.toLocaleString("pt-BR")} bolachas`, 20, y);
  y += 6;
  if (data.totalValue) {
    doc.text(`Valor Total: R$ ${Number(data.totalValue).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`, 20, y);
    y += 6;
  }
  if (data.paymentTerms) {
    doc.text(`Condições: ${data.paymentTerms}`, 20, y);
    y += 6;
  }
  if (data.periodStart && data.periodEnd) {
    const fmtDate = (d: string) => formatIsoDateBR(d);
    doc.text(`Período: ${fmtDate(data.periodStart)} a ${fmtDate(data.periodEnd)}`, 20, y);
    y += 6;
  }
  if (data.description) {
    doc.text(`Descrição: ${data.description}`, 20, y);
    y += 6;
  }

  if (data.restaurants.length > 0) {
    y += 6;
    doc.setFont(FONT_NAME, "bold");
    doc.setFontSize(10);
    doc.text("ALOCAÇÃO DE RESTAURANTES", 20, y);
    y += 4;

    autoTable(doc, {
      startY: y,
      head: [["#", "Restaurante", "Bolachas"]],
      body: data.restaurants.map((r, i) => [
        String(i + 1),
        r.name,
        r.coasterQuantity.toLocaleString("pt-BR"),
      ]),
      foot: [["", "TOTAL", data.restaurants.reduce((s, r) => s + r.coasterQuantity, 0).toLocaleString("pt-BR")]],
      theme: "grid",
      headStyles: { fillColor: [...PDF_COLORS.ink] as [number,number,number], fontSize: 8 },
      bodyStyles: { fontSize: 8 },
      footStyles: { fillColor: [240, 240, 240], textColor: [0, 0, 0], fontSize: 8, fontStyle: "bold" },
      margin: { left: 20, right: 20 },
    });

    y = (doc as any).lastAutoTable?.finalY || y + 40;
  }

  // ── Termos e condições (links para contrato master + termo de campanha) ──────
  // Links vindos da fonte única do servidor (fetchContractLinks), editáveis em
  // Termos Padrão. Mantém o mesmo vínculo contratual exibido nas propostas.
  const pageHeightT = doc.internal.pageSize.getHeight();
  const contentWidthT = pageWidth - 40;
  y += 12;
  if (y > pageHeightT - 70) {
    doc.addPage();
    y = 20;
  }
  doc.setTextColor(0, 0, 0);
  doc.setFont(FONT_NAME, "bold");
  doc.setFontSize(10);
  doc.text("TERMOS E CONDIÇÕES", 20, y);
  y += 7;
  doc.setFont(FONT_NAME, "normal");
  doc.setFontSize(8);
  doc.setTextColor(60, 60, 60);

  const drawClauseWithLink = (prefix: string, url: string) => {
    const lines = doc.splitTextToSize(prefix, contentWidthT) as string[];
    doc.setTextColor(60, 60, 60);
    doc.text(lines, 20, y);
    y += lines.length * 4.2 + 1;
    doc.setTextColor(...PDF_COLORS.neon);
    doc.textWithLink(url, 20, y, { url });
    y += 7;
  };

  drawClauseWithLink(PROPOSAL_BINDING_CLAUSE_PREFIX, masterContractUrl);
  drawClauseWithLink(CAMPAIGN_TERM_BINDING_CLAUSE_PREFIX, campaignTermUrl);

  y += 8;
  if (y > pageHeightT - 40) {
    doc.addPage();
    y = 20;
  }
  doc.setDrawColor(200, 200, 200);
  doc.line(20, y, 90, y);
  doc.line(pageWidth - 90, y, pageWidth - 20, y);
  y += 6;
  doc.setFontSize(8);
  doc.setFont(FONT_NAME, "normal");
  doc.text("Anunciante", 55, y, { align: "center" });
  doc.text("Mesa Ads", pageWidth - 55, y, { align: "center" });

  y += 12;
  doc.text(`Data: ____/____/________`, 20, y);
  doc.text(`Local: ________________________`, pageWidth / 2, y);

  const pageHeight = doc.internal.pageSize.getHeight();
  doc.setFontSize(7);
  doc.setTextColor(150, 150, 150);
  doc.text(`Documento gerado em ${new Date().toLocaleDateString("pt-BR")} — Mesa Ads ERP`, pageWidth / 2, pageHeight - 10, { align: "center" });

  doc.save(`${data.orderNumber}.pdf`);
}
