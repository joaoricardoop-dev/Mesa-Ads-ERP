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

export interface CommissionStatementPayment {
  id: number;
  amountNumber: number;
  referenceMonth: string | null;
  paymentDate: string | Date | null;
  status: string | null;
  periodStart: string | Date | null;
  periodEnd: string | Date | null;
  campaignNumber: string | null;
  campaignName: string;
  clientLabel: string;
}

export interface CommissionStatementCampaign {
  campaignId: number | null;
  campaignNumber: string | null;
  campaignName: string;
  clientLabel: string;
  totalAmount: number;
  paidAmount: number;
  pendingAmount: number;
  paymentCount: number;
  payments: CommissionStatementPayment[];
}

export interface CommissionStatementRestaurant {
  name: string;
  razaoSocial?: string | null;
  cnpj?: string | null;
  address?: string | null;
  neighborhood?: string | null;
  city?: string | null;
  state?: string | null;
  cep?: string | null;
  contactName?: string | null;
  email?: string | null;
  whatsapp?: string | null;
}

export interface CommissionStatementData {
  restaurant: CommissionStatementRestaurant;
  periodLabel: string;
  totalAmount: number;
  totalPaid: number;
  totalPending: number;
  paymentCount: number;
  byCampaign: CommissionStatementCampaign[];
}

export interface CommissionSourcePayment {
  id: number;
  amountNumber: number;
  referenceMonth: string | null;
  paymentDate: string | Date | null;
  status: string | null;
  periodStart: string | Date | null;
  periodEnd: string | Date | null;
  campaignId: number | null;
  campaignNumber: string | null;
  campaignName: string | null;
  clientName: string | null;
  clientCompany: string | null;
}

export interface CommissionSourceData {
  payments: CommissionSourcePayment[];
}

export function buildCommissionStatementData(
  commissions: CommissionSourceData,
  restaurant: CommissionStatementRestaurant,
  period: { start: string; end: string },
  formatRefMonth: (m: string) => string,
): CommissionStatementData | null {
  const inRange = (m: string | null | undefined): boolean => {
    if (!m) return !period.start && !period.end;
    if (period.start && m < period.start) return false;
    if (period.end && m > period.end) return false;
    return true;
  };

  const filtered = commissions.payments.filter(p => inRange(p.referenceMonth));
  if (filtered.length === 0) return null;

  let totalAmount = 0;
  let totalPaid = 0;
  let totalPending = 0;
  const byCampaignMap = new Map<string, CommissionStatementCampaign>();

  for (const p of filtered) {
    const isPaid = p.status === "pago" || p.status === "paid";
    totalAmount += p.amountNumber;
    if (isPaid) totalPaid += p.amountNumber;
    else totalPending += p.amountNumber;

    const clientLabel = p.clientCompany
      ? `${p.clientName ?? ""} (${p.clientCompany})`
      : (p.clientName ?? "");
    const paymentEntry: CommissionStatementPayment = {
      id: p.id,
      amountNumber: p.amountNumber,
      referenceMonth: p.referenceMonth,
      paymentDate: p.paymentDate,
      status: p.status,
      periodStart: p.periodStart,
      periodEnd: p.periodEnd,
      campaignNumber: p.campaignNumber,
      campaignName: p.campaignName ?? "Sem campanha vinculada",
      clientLabel,
    };

    const key = p.campaignId != null ? `c${p.campaignId}` : "none";
    const existing = byCampaignMap.get(key);
    if (existing) {
      existing.totalAmount += p.amountNumber;
      if (isPaid) existing.paidAmount += p.amountNumber;
      else existing.pendingAmount += p.amountNumber;
      existing.paymentCount += 1;
      existing.payments.push(paymentEntry);
    } else {
      byCampaignMap.set(key, {
        campaignId: p.campaignId,
        campaignNumber: p.campaignNumber,
        campaignName: p.campaignName ?? "Sem campanha vinculada",
        clientLabel,
        totalAmount: p.amountNumber,
        paidAmount: isPaid ? p.amountNumber : 0,
        pendingAmount: isPaid ? 0 : p.amountNumber,
        paymentCount: 1,
        payments: [paymentEntry],
      });
    }
  }

  const periodLabel = period.start || period.end
    ? `${period.start ? formatRefMonth(period.start) : "início"} — ${period.end ? formatRefMonth(period.end) : "atual"}`
    : "Todo o histórico";

  return {
    restaurant,
    periodLabel,
    totalAmount,
    totalPaid,
    totalPending,
    paymentCount: filtered.length,
    byCampaign: Array.from(byCampaignMap.values()).sort((a, b) => b.totalAmount - a.totalAmount),
  };
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

function fmtDate(d: string | Date | null | undefined): string {
  if (!d) return "—";
  const date = typeof d === "string" ? new Date(d) : d;
  if (isNaN(date.getTime())) return "—";
  return date.toLocaleDateString("pt-BR");
}

function fmtRefMonth(m: string | null | undefined): string {
  if (!m) return "—";
  const [y, mo] = m.split("-");
  if (!y || !mo) return m;
  const months = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];
  return `${months[parseInt(mo, 10) - 1] || mo}/${y}`;
}

function fmtStatus(s: string | null | undefined): string {
  if (!s) return "—";
  if (s === "pago" || s === "paid") return "Pago";
  if (s === "pendente" || s === "pending") return "Pendente";
  return s.charAt(0).toUpperCase() + s.slice(1);
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
  doc.text("EXTRATO DE COMISSÕES", margin, 34);

  const today = new Date().toLocaleDateString("pt-BR", { day: "2-digit", month: "long", year: "numeric" });
  doc.setTextColor(200, 200, 200);
  doc.setFontSize(8);
  doc.text(`Emitido em ${today}`, pageWidth - margin, 34, { align: "right" });
}

function drawSectionTitle(doc: jsPDF, title: string, y: number, margin: number): number {
  doc.setTextColor(...BLACK);
  doc.setFontSize(11);
  doc.setFont(FONT_NAME, "bold");
  doc.text(title, margin, y);
  y += 2.5;
  doc.setDrawColor(220, 220, 220);
  doc.line(margin, y, doc.internal.pageSize.getWidth() - margin, y);
  return y + 7;
}

function checkPageBreak(doc: jsPDF, y: number, needed: number): number {
  const pageHeight = doc.internal.pageSize.getHeight();
  if (y + needed > pageHeight - 25) {
    doc.addPage();
    return 60;
  }
  return y;
}

type LastAutoTable = { lastAutoTable?: { finalY?: number } };

export function generateCommissionStatementPdf(data: CommissionStatementData) {
  const doc = new jsPDF();
  registerFonts(doc);

  const pageWidth = doc.internal.pageSize.getWidth();
  const margin = 20;

  drawHeader(doc, pageWidth, margin);

  let y = 56;

  // ── Restaurant header ─────────────────────────────────────────────────────
  const r = data.restaurant;
  doc.setTextColor(...BLACK);
  doc.setFont(FONT_NAME, "bold");
  doc.setFontSize(14);
  doc.text(r.name || "Restaurante", margin, y);
  y += 6;

  doc.setFont(FONT_NAME, "normal");
  doc.setFontSize(9);
  doc.setTextColor(...GRAY);

  const subLines: string[] = [];
  if (r.razaoSocial && r.razaoSocial !== r.name) subLines.push(r.razaoSocial);
  if (r.cnpj) subLines.push(`CNPJ ${r.cnpj}`);

  const addressParts = [
    r.address,
    r.neighborhood,
    [r.city, r.state].filter(Boolean).join("/"),
    r.cep,
  ].filter(Boolean);
  const addressLine = addressParts.join(" — ");
  if (addressLine) subLines.push(addressLine);

  const contactParts: string[] = [];
  if (r.contactName) contactParts.push(r.contactName);
  if (r.email) contactParts.push(r.email);
  if (r.whatsapp) contactParts.push(r.whatsapp);
  if (contactParts.length) subLines.push(contactParts.join(" · "));

  for (const line of subLines) {
    doc.text(line, margin, y);
    y += 4.5;
  }

  y += 4;
  doc.setTextColor(...DARK_GRAY);
  doc.setFont(FONT_NAME, "bold");
  doc.setFontSize(9);
  doc.text(`Período: ${data.periodLabel}`, margin, y);
  y += 8;

  // ── KPI Summary ───────────────────────────────────────────────────────────
  y = drawSectionTitle(doc, "RESUMO", y, margin);

  autoTable(doc, {
    startY: y,
    body: [
      ["Total acumulado", fmtCurrency(data.totalAmount)],
      ["Já recebido", fmtCurrency(data.totalPaid)],
      ["A receber", fmtCurrency(data.totalPending)],
      ["Pagamentos", String(data.paymentCount)],
    ],
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

  // ── Per-campaign breakdown ────────────────────────────────────────────────
  y = checkPageBreak(doc, y, 30);
  y = drawSectionTitle(doc, "COMISSÕES POR CAMPANHA", y, margin);

  if (data.byCampaign.length === 0) {
    doc.setFont(FONT_NAME, "normal");
    doc.setFontSize(9);
    doc.setTextColor(...GRAY);
    doc.text("Nenhuma comissão registrada no período.", margin, y);
    y += 8;
  } else {
    for (const g of data.byCampaign) {
      y = checkPageBreak(doc, y, 30);

      doc.setFont(FONT_NAME, "bold");
      doc.setFontSize(10);
      doc.setTextColor(...BLACK);
      doc.text(g.campaignName, margin, y);

      doc.setFont(FONT_NAME, "normal");
      doc.setFontSize(8);
      doc.setTextColor(...GRAY);
      const meta = [g.campaignNumber, g.clientLabel].filter(Boolean).join(" · ");
      if (meta) {
        y += 4;
        doc.text(meta, margin, y);
      }
      y += 5;

      const rows = g.payments.map(p => [
        fmtRefMonth(p.referenceMonth),
        p.periodStart ? `${fmtDate(p.periodStart)} — ${fmtDate(p.periodEnd)}` : "—",
        fmtDate(p.paymentDate),
        fmtStatus(p.status),
        fmtCurrency(p.amountNumber),
      ]);

      autoTable(doc, {
        startY: y,
        head: [["Referência", "Período", "Pagamento", "Status", "Valor"]],
        body: rows,
        foot: [[
          `${g.paymentCount} pagamento${g.paymentCount !== 1 ? "s" : ""}`,
          `Pago ${fmtCurrency(g.paidAmount)}`,
          `A receber ${fmtCurrency(g.pendingAmount)}`,
          "Total",
          fmtCurrency(g.totalAmount),
        ]],
        theme: "grid",
        styles: { font: FONT_NAME, fontSize: 8 },
        headStyles: { fillColor: [...BLACK], textColor: [...WHITE], fontSize: 8, fontStyle: "bold", font: FONT_NAME },
        bodyStyles: { textColor: [40, 40, 40], font: FONT_NAME },
        footStyles: { fillColor: [...LIGHT_GRAY], textColor: [...BLACK], fontSize: 8, fontStyle: "bold", font: FONT_NAME },
        alternateRowStyles: { fillColor: [250, 250, 250] },
        margin: { left: margin, right: margin },
        columnStyles: {
          0: { cellWidth: 24 },
          1: { cellWidth: 56 },
          2: { halign: "center", cellWidth: 28 },
          3: { halign: "center", cellWidth: 24 },
          4: { halign: "right", fontStyle: "bold" },
        },
      });

      y = (doc as unknown as LastAutoTable).lastAutoTable?.finalY || y + 20;
      y += 8;
    }
  }

  // ── Totals footer table ───────────────────────────────────────────────────
  y = checkPageBreak(doc, y, 30);
  autoTable(doc, {
    startY: y,
    body: [[
      "TOTAL GERAL",
      `Pago ${fmtCurrency(data.totalPaid)}`,
      `A receber ${fmtCurrency(data.totalPending)}`,
      fmtCurrency(data.totalAmount),
    ]],
    theme: "grid",
    styles: { font: FONT_NAME, fontSize: 9, fontStyle: "bold" },
    bodyStyles: { fillColor: [...BLACK], textColor: [...WHITE], font: FONT_NAME },
    margin: { left: margin, right: margin },
    columnStyles: {
      0: { cellWidth: 50 },
      1: { halign: "center" },
      2: { halign: "center" },
      3: { halign: "right" },
    },
  });

  // ── Footer ────────────────────────────────────────────────────────────────
  const pageCount = doc.getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    const ph = doc.internal.pageSize.getHeight();
    const pw = doc.internal.pageSize.getWidth();
    doc.setFontSize(7);
    doc.setTextColor(160, 160, 160);
    doc.setFont(FONT_NAME, "normal");
    doc.text(`Mesa Ads — Extrato de Comissões · ${r.name}`, margin, ph - 10);
    doc.text(`${i} / ${pageCount}`, pw - margin, ph - 10, { align: "right" });
  }

  const safeName = (r.name || "restaurante").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
  const today = new Date().toISOString().slice(0, 10);
  doc.save(`extrato-comissoes-${safeName}-${today}.pdf`);
}
