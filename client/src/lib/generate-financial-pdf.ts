import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import {
  PDF_FONT as FONT_NAME,
  GREEN,
  BLACK,
  WHITE,
  DARK_GRAY,
  GRAY,
  LIGHT_GRAY,
  registerPdfFonts,
  drawPdfHeader,
  drawPdfSectionTitle,
  pdfCheckPageBreak,
} from "./pdf-branding";

void GREEN;

export interface FinancialReportData {
  startDate: string;
  endDate: string;
  totalRevenue: number;
  totalCosts: number;
  margin: number;
  marginPercent: number;
  byCampaign: Array<{ name: string; revenue: number; costs: number; margin: number }>;
  byClient: Array<{ name: string; revenue: number }>;
  byRestaurant: Array<{ name: string; total: number }>;
  monthlyRevenue: Array<{ month: string; revenue: number }>;
  invoiceList: Array<{
    invoiceNumber: string;
    clientName: string;
    campaignName: string;
    amount: number;
    issueDate: string;
    dueDate: string;
    paymentDate: string | null;
    status: string;
    paymentMethod: string | null;
  }>;
}

const registerFonts = registerPdfFonts;

function fmtCurrency(val: number): string {
  return `R$ ${val.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function fmtPercent(val: number): string {
  return `${val.toFixed(1)}%`;
}

function fmtDate(dateStr: string): string {
  const [y, m, d] = dateStr.split("-");
  return `${d}/${m}/${y}`;
}

function fmtMonth(monthStr: string): string {
  const [y, m] = monthStr.split("-");
  const months = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];
  return `${months[parseInt(m, 10) - 1]}/${y}`;
}

function fmtStatus(status: string): string {
  const map: Record<string, string> = {
    paga: "Paga",
    emitida: "Emitida",
    vencida: "Vencida",
    cancelada: "Cancelada",
  };
  return map[status] || status;
}

function drawHeader(doc: jsPDF, _pageWidth: number, margin: number) {
  const today = new Date().toLocaleDateString("pt-BR", { day: "2-digit", month: "long", year: "numeric" });
  drawPdfHeader(doc, { eyebrow: "RELATÓRIO FINANCEIRO", meta: today, margin });
}

const drawSectionTitle = drawPdfSectionTitle;
const checkPageBreak = pdfCheckPageBreak;

type LastAutoTable = { lastAutoTable?: { finalY?: number } };

export function generateFinancialPdf(data: FinancialReportData) {
  const doc = new jsPDF();
  registerFonts(doc);

  const pageWidth = doc.internal.pageSize.getWidth();
  const margin = 20;

  drawHeader(doc, pageWidth, margin);

  let y = 56;

  doc.setTextColor(...GRAY);
  doc.setFontSize(9);
  doc.setFont(FONT_NAME, "normal");
  doc.text(`Período: ${fmtDate(data.startDate)} — ${fmtDate(data.endDate)}`, margin, y);
  y += 12;

  // ── KPI Summary ───────────────────────────────────────────────────────────
  y = drawSectionTitle(doc, "RESUMO DO PERÍODO", y, margin);

  const kpiData = [
    ["Receita Total", fmtCurrency(data.totalRevenue)],
    ["Custos Totais", fmtCurrency(data.totalCosts)],
    ["Margem Bruta", fmtCurrency(data.margin)],
    ["Margem %", fmtPercent(data.marginPercent)],
  ];

  autoTable(doc, {
    startY: y,
    body: kpiData,
    theme: "grid",
    styles: { font: FONT_NAME, fontSize: 9 },
    bodyStyles: { textColor: [...DARK_GRAY], font: FONT_NAME },
    alternateRowStyles: { fillColor: [250, 250, 250] },
    margin: { left: margin, right: margin },
    columnStyles: {
      0: { fontStyle: "bold", cellWidth: 60 },
      1: { halign: "right", fontStyle: "bold" },
    },
  });

  y = (doc as unknown as LastAutoTable).lastAutoTable?.finalY || y + 30;
  y += 10;

  // ── Monthly Revenue ───────────────────────────────────────────────────────
  y = checkPageBreak(doc, y, 50);
  y = drawSectionTitle(doc, "FATURAMENTO MENSAL", y, margin);

  {
    const totalMonthly = data.monthlyRevenue.reduce((s, m) => s + m.revenue, 0);
    const monthlyBody = data.monthlyRevenue.length > 0
      ? data.monthlyRevenue.map((m) => [fmtMonth(m.month), fmtCurrency(m.revenue)])
      : [["Sem dados no período", "R$ 0,00"]];

    autoTable(doc, {
      startY: y,
      head: [["Mês", "Receita"]],
      body: monthlyBody,
      foot: [["Total", fmtCurrency(totalMonthly)]],
      theme: "grid",
      styles: { font: FONT_NAME, fontSize: 8 },
      headStyles: { fillColor: [...BLACK], textColor: [...WHITE], fontSize: 8, fontStyle: "bold", font: FONT_NAME },
      bodyStyles: { textColor: [40, 40, 40], font: FONT_NAME },
      footStyles: { fillColor: [...LIGHT_GRAY], textColor: [...BLACK], fontSize: 8, fontStyle: "bold", font: FONT_NAME },
      alternateRowStyles: { fillColor: [250, 250, 250] },
      margin: { left: margin, right: margin },
      columnStyles: {
        0: { cellWidth: 40 },
        1: { halign: "right", fontStyle: "bold" },
      },
    });

    y = (doc as unknown as LastAutoTable).lastAutoTable?.finalY || y + 40;
    y += 10;
  }

  // ── Invoice List ──────────────────────────────────────────────────────────
  y = checkPageBreak(doc, y, 50);
  y = drawSectionTitle(doc, "FATURAS DO PERÍODO", y, margin);

  {
    const invoiceTotal = data.invoiceList.reduce((s, inv) => s + inv.amount, 0);
    const invoiceBody = data.invoiceList.length > 0
      ? data.invoiceList.map((inv) => [
          inv.invoiceNumber,
          inv.clientName,
          inv.campaignName,
          fmtDate(inv.issueDate),
          fmtDate(inv.dueDate),
          inv.paymentDate ? fmtDate(inv.paymentDate) : "—",
          inv.paymentMethod || "—",
          fmtStatus(inv.status),
          fmtCurrency(inv.amount),
        ])
      : [["Sem dados no período", "", "", "", "", "", "", "", "R$ 0,00"]];

    autoTable(doc, {
      startY: y,
      head: [["Nº Fatura", "Anunciante", "Campanha", "Emissão", "Vencimento", "Pagamento", "Método", "Status", "Valor"]],
      body: invoiceBody,
      foot: [[
        `${data.invoiceList.length} fatura${data.invoiceList.length !== 1 ? "s" : ""}`,
        "", "", "", "", "", "", "",
        fmtCurrency(invoiceTotal),
      ]],
      theme: "grid",
      styles: { font: FONT_NAME, fontSize: 6 },
      headStyles: { fillColor: [...BLACK], textColor: [...WHITE], fontSize: 6, fontStyle: "bold", font: FONT_NAME },
      bodyStyles: { textColor: [40, 40, 40], font: FONT_NAME },
      footStyles: { fillColor: [...LIGHT_GRAY], textColor: [...BLACK], fontSize: 6, fontStyle: "bold", font: FONT_NAME },
      alternateRowStyles: { fillColor: [250, 250, 250] },
      margin: { left: margin, right: margin },
      columnStyles: {
        0: { cellWidth: 24 },
        3: { halign: "center", cellWidth: 18 },
        4: { halign: "center", cellWidth: 18 },
        5: { halign: "center", cellWidth: 18 },
        6: { cellWidth: 16 },
        7: { cellWidth: 16 },
        8: { halign: "right", fontStyle: "bold", cellWidth: 26 },
      },
    });

    y = (doc as unknown as LastAutoTable).lastAutoTable?.finalY || y + 40;
    y += 10;
  }

  const pageCount = doc.getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    const ph = doc.internal.pageSize.getHeight();
    const pw = doc.internal.pageSize.getWidth();
    doc.setFontSize(7);
    doc.setTextColor(160, 160, 160);
    doc.setFont(FONT_NAME, "normal");
    doc.text(`Mesa Ads — Relatório Financeiro ${fmtDate(data.startDate)} a ${fmtDate(data.endDate)}`, margin, ph - 10);
    doc.text(`${i} / ${pageCount}`, pw - margin, ph - 10, { align: "right" });
  }

  const fileName = `relatorio-financeiro-${data.startDate}-${data.endDate}.pdf`;
  doc.save(fileName);
}
