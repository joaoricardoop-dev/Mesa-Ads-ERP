import jsPDF from "jspdf";

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
}

export function generateQuotationSignPdf(data: QuotationSignPDFData) {
  const doc = new jsPDF();
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 20;
  const contentWidth = pageWidth - margin * 2;

  doc.setFillColor(13, 13, 13);
  doc.rect(0, 0, pageWidth, 42, "F");

  doc.setFillColor(39, 216, 3);
  doc.rect(0, 42, pageWidth, 2, "F");

  doc.setTextColor(255, 255, 255);
  doc.setFontSize(22);
  doc.setFont("helvetica", "bold");
  doc.text("mesa", margin, 24);
  const mesaWidth = doc.getTextWidth("mesa");
  doc.setTextColor(39, 216, 3);
  doc.text(".ads", margin + mesaWidth, 24);
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(9);
  doc.setFont("helvetica", "normal");
  doc.text("ORDEM DE SERVIÇO", margin, 34);

  doc.setTextColor(200, 200, 200);
  doc.setFontSize(9);
  doc.text(`OS #${data.orderNumber}`, pageWidth - margin, 34, { align: "right" });

  let y = 56;

  doc.setTextColor(13, 13, 13);
  doc.setFontSize(14);
  doc.setFont("helvetica", "bold");
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
    doc.setFont("helvetica", "bold");
    doc.text(label, margin, y);
    doc.setFont("helvetica", "normal");
    const labelWidth = doc.getTextWidth(label) + 3;
    const valueLines = doc.splitTextToSize(value, contentWidth - labelWidth);
    doc.text(valueLines, margin + labelWidth, y);
    y += valueLines.length * 5 + 2;
  }

  y += 6;
  doc.setDrawColor(220, 220, 220);
  doc.line(margin, y, pageWidth - margin, y);
  y += 10;

  doc.setTextColor(13, 13, 13);
  doc.setFontSize(12);
  doc.setFont("helvetica", "bold");
  doc.text("FINANCEIRO", margin, y);
  y += 8;

  doc.setFontSize(9);
  doc.setTextColor(60, 60, 60);
  doc.setFont("helvetica", "bold");
  doc.text("Valor Total:", margin, y);
  doc.setFont("helvetica", "normal");
  doc.text(
    `R$ ${data.totalValue.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
    margin + 25,
    y
  );
  y += 10;

  doc.setDrawColor(220, 220, 220);
  doc.line(margin, y, pageWidth - margin, y);
  y += 10;

  doc.setTextColor(13, 13, 13);
  doc.setFontSize(12);
  doc.setFont("helvetica", "bold");
  doc.text("PERÍODO", margin, y);
  y += 8;

  doc.setFontSize(9);
  doc.setTextColor(60, 60, 60);

  const formatDate = (d: string) => {
    try {
      return new Date(d).toLocaleDateString("pt-BR");
    } catch {
      return d;
    }
  };

  doc.setFont("helvetica", "bold");
  doc.text("Início:", margin, y);
  doc.setFont("helvetica", "normal");
  doc.text(formatDate(data.periodStart), margin + 18, y);
  doc.setFont("helvetica", "bold");
  doc.text("Fim:", margin + 60, y);
  doc.setFont("helvetica", "normal");
  doc.text(formatDate(data.periodEnd), margin + 72, y);
  y += 10;

  doc.setDrawColor(220, 220, 220);
  doc.line(margin, y, pageWidth - margin, y);
  y += 10;

  if (y > pageHeight - 60) {
    doc.addPage();
    y = 20;
  }

  doc.setDrawColor(39, 216, 3);
  doc.setLineWidth(0.5);
  doc.line(margin, y, pageWidth - margin, y);
  y += 10;

  doc.setFontSize(10);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(13, 13, 13);
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
    doc.setFont("helvetica", "bold");
    doc.text(label, margin, y);
    doc.setFont("helvetica", "normal");
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
  doc.setTextColor(39, 216, 3);
  doc.text("mesa.ads", pageWidth - margin, footerY, { align: "right" });

  const fileName = `OS_${data.orderNumber}_cotacao_${data.quotationNumber}_${new Date(data.signedAt).toISOString().split("T")[0]}.pdf`;
  doc.save(fileName);
}
