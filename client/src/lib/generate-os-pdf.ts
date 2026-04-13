import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

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

export function generateOSPdf(data: OSPDFData) {
  const doc = new jsPDF();
  const pageWidth = doc.internal.pageSize.getWidth();

  const subtitle = (data.type && TYPE_SUBTITLE[data.type]) || TYPE_SUBTITLE.anunciante;

  doc.setFillColor(13, 13, 13);
  doc.rect(0, 0, pageWidth, 40, "F");

  doc.setTextColor(255, 255, 255);
  doc.setFontSize(20);
  doc.setFont("helvetica", "bold");
  doc.text("Mesa", 20, 22);
  doc.setTextColor(255, 102, 0);
  doc.text("Ads", 44, 22);
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(10);
  doc.text(subtitle, 20, 32);

  doc.setTextColor(255, 255, 255);
  doc.setFontSize(12);
  doc.setFont("helvetica", "bold");
  doc.text(data.orderNumber, pageWidth - 20, 22, { align: "right" });
  doc.setFontSize(8);
  doc.setFont("helvetica", "normal");
  doc.text(`Ref: ${data.quotationNumber}`, pageWidth - 20, 30, { align: "right" });

  let y = 55;
  doc.setTextColor(0, 0, 0);

  doc.setFontSize(10);
  doc.setFont("helvetica", "bold");
  doc.text("DADOS DO ANUNCIANTE", 20, y);
  y += 8;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.text(`Nome: ${data.clientName}`, 20, y);
  y += 6;
  if (data.clientCompany) {
    doc.text(`Empresa: ${data.clientCompany}`, 20, y);
    y += 6;
  }

  y += 4;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  doc.text("DETALHES DA CAMPANHA", 20, y);
  y += 8;
  doc.setFont("helvetica", "normal");
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
    const fmtDate = (d: string) => new Date(d + "T00:00:00").toLocaleDateString("pt-BR");
    doc.text(`Período: ${fmtDate(data.periodStart)} a ${fmtDate(data.periodEnd)}`, 20, y);
    y += 6;
  }
  if (data.description) {
    doc.text(`Descrição: ${data.description}`, 20, y);
    y += 6;
  }

  if (data.restaurants.length > 0) {
    y += 6;
    doc.setFont("helvetica", "bold");
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
      headStyles: { fillColor: [13, 13, 13], fontSize: 8 },
      bodyStyles: { fontSize: 8 },
      footStyles: { fillColor: [240, 240, 240], textColor: [0, 0, 0], fontSize: 8, fontStyle: "bold" },
      margin: { left: 20, right: 20 },
    });

    y = (doc as any).lastAutoTable?.finalY || y + 40;
  }

  y += 20;
  doc.setDrawColor(200, 200, 200);
  doc.line(20, y, 90, y);
  doc.line(pageWidth - 90, y, pageWidth - 20, y);
  y += 6;
  doc.setFontSize(8);
  doc.setFont("helvetica", "normal");
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
