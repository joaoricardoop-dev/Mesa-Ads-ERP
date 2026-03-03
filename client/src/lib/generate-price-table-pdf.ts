import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

const GPC_COSTS = [
  { qty: 1000, unit: 0.4190 },
  { qty: 2000, unit: 0.3495 },
  { qty: 3000, unit: 0.3330 },
  { qty: 4000, unit: 0.3248 },
  { qty: 5000, unit: 0.2998 },
  { qty: 10000, unit: 0.2700 },
  { qty: 20000, unit: 0.2600 },
];

const WEEKS = [4, 8, 12, 16];

const BRAND_GREEN = [39, 216, 3] as const;
const DARK_BG = [13, 13, 13] as const;
const CARD_BG = [24, 24, 24] as const;
const HEADER_BG = [30, 30, 30] as const;
const TEXT_WHITE = [240, 240, 240] as const;
const TEXT_GRAY = [140, 140, 140] as const;
const TEXT_LIGHT = [200, 200, 200] as const;

function fmtBRL(n: number): string {
  return n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function fmtUnit(n: number): string {
  return `R$ ${n.toFixed(4).replace(".", ",")}`;
}

function fmtQty(n: number): string {
  return n.toLocaleString("pt-BR");
}

export function generatePriceTablePDF() {
  const margin = 0.35;
  const irpj = 0.15;
  const comissaoRest = 0.15;
  const comissaoComercial = 0.10;
  const denominator = 1 - margin - irpj - comissaoRest - comissaoComercial;

  const doc = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();

  doc.setFillColor(...DARK_BG);
  doc.rect(0, 0, pageW, pageH, "F");

  doc.setFillColor(...BRAND_GREEN);
  doc.rect(0, 0, pageW, 3, "F");

  let logoLoaded = false;
  try {
    doc.setFont("helvetica", "bold");
    doc.setFontSize(22);
    doc.setTextColor(...TEXT_WHITE);
    doc.text("mesa", 20, 22);
    const mesaW = doc.getTextWidth("mesa");
    doc.setTextColor(...BRAND_GREEN);
    doc.text(".ads", 20 + mesaW, 22);
  } catch {
    doc.setFont("helvetica", "bold");
    doc.setFontSize(22);
    doc.setTextColor(...BRAND_GREEN);
    doc.text("mesa.ads", 20, 22);
  }

  doc.setFontSize(16);
  doc.setTextColor(...TEXT_WHITE);
  doc.setFont("helvetica", "bold");
  doc.text("Tabela de Preços", 20, 34);

  doc.setFontSize(9);
  doc.setTextColor(...TEXT_GRAY);
  doc.setFont("helvetica", "normal");
  const today = new Date().toLocaleDateString("pt-BR");
  doc.text(`Gerada em ${today}`, 20, 40);

  doc.setFillColor(...CARD_BG);
  doc.roundedRect(pageW - 135, 12, 120, 24, 3, 3, "F");
  doc.setFontSize(8);
  doc.setTextColor(...TEXT_GRAY);
  doc.text("COMPOSIÇÃO DO PREÇO", pageW - 130, 19);
  doc.setFontSize(9);
  doc.setTextColor(...TEXT_LIGHT);
  doc.text(`Margem: 35%  |  IRPJ: 15%  |  Comissão Rest.: 15%  |  Comissão Comerc.: 10%`, pageW - 130, 26);
  doc.setTextColor(...TEXT_GRAY);
  doc.setFontSize(8);
  doc.text(`Preço = Custo GPC / ${denominator.toFixed(2).replace(".", ",")}`, pageW - 130, 32);

  let yPos = 50;

  for (const faces of [1, 2]) {
    const label = faces === 1 ? "1 FACE (frente)" : "2 FACES (frente e verso)";

    doc.setFillColor(...BRAND_GREEN);
    doc.roundedRect(20, yPos, 6, 6, 1, 1, "F");
    doc.setFont("helvetica", "bold");
    doc.setFontSize(11);
    doc.setTextColor(...TEXT_WHITE);
    doc.text(label, 30, yPos + 5);
    yPos += 10;

    const head = [["Volume", "Custo GPC", "Preço Unit.", "4 semanas", "8 semanas", "12 semanas", "16 semanas"]];
    const body: string[][] = [];

    for (const { qty, unit } of GPC_COSTS) {
      const cost = unit * faces;
      const price = cost / denominator;
      const total4 = price * qty;
      const row = [
        fmtQty(qty),
        fmtUnit(cost),
        fmtUnit(price),
        ...WEEKS.map(w => fmtBRL(total4 * (w / 4))),
      ];
      body.push(row);
    }

    autoTable(doc, {
      startY: yPos,
      head,
      body,
      theme: "plain",
      margin: { left: 20, right: 15 },
      styles: {
        fontSize: 9,
        textColor: TEXT_LIGHT as unknown as number[],
        cellPadding: { top: 3, bottom: 3, left: 4, right: 4 },
        lineColor: [40, 40, 40],
        lineWidth: 0.3,
      },
      headStyles: {
        fillColor: HEADER_BG as unknown as number[],
        textColor: TEXT_GRAY as unknown as number[],
        fontSize: 7.5,
        fontStyle: "bold",
        cellPadding: { top: 3, bottom: 3, left: 4, right: 4 },
      },
      bodyStyles: {
        fillColor: CARD_BG as unknown as number[],
      },
      alternateRowStyles: {
        fillColor: [20, 20, 20],
      },
      columnStyles: {
        0: { fontStyle: "bold", cellWidth: 22 },
        1: { cellWidth: 28 },
        2: { fontStyle: "bold", textColor: BRAND_GREEN as unknown as number[], cellWidth: 28 },
        3: { halign: "right", cellWidth: 35 },
        4: { halign: "right", cellWidth: 35 },
        5: { halign: "right", cellWidth: 35 },
        6: { halign: "right", cellWidth: 35 },
      },
    });

    yPos = (doc as any).lastAutoTable.finalY + 12;
  }

  doc.setFillColor(...CARD_BG);
  const boxY = yPos;
  const boxH = 38;
  doc.roundedRect(20, boxY, pageW - 35, boxH, 3, 3, "F");

  doc.setFont("helvetica", "bold");
  doc.setFontSize(8);
  doc.setTextColor(...TEXT_GRAY);
  doc.text("EXEMPLO: 5.000 BOLACHAS, 1 FACE, 4 SEMANAS", 28, boxY + 8);

  const exCost = 0.2998;
  const exPrice = exCost / denominator;
  const exTotal = exPrice * 5000;

  const col1X = 28;
  const col2X = 110;
  const col3X = 192;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8.5);
  doc.setTextColor(...TEXT_LIGHT);

  let lineY = boxY + 15;
  doc.text(`Custo produção (25%):`, col1X, lineY);
  doc.text(fmtBRL(exCost * 5000), col1X + 55, lineY);
  doc.text(`IRPJ (15%):`, col2X, lineY);
  doc.text(fmtBRL(exTotal * irpj), col2X + 40, lineY);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(...BRAND_GREEN);
  doc.text(`PREÇO TOTAL:`, col3X, lineY);
  doc.text(fmtBRL(exTotal), col3X + 40, lineY);

  lineY += 6;
  doc.setFont("helvetica", "normal");
  doc.setTextColor(...TEXT_LIGHT);
  doc.text(`Comissão rest. (15%):`, col1X, lineY);
  doc.text(fmtBRL(exTotal * comissaoRest), col1X + 55, lineY);
  doc.text(`Comissão comerc. (10%):`, col2X, lineY);
  doc.text(fmtBRL(exTotal * comissaoComercial), col2X + 40, lineY);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(...BRAND_GREEN);
  doc.text(`Preço unitário:`, col3X, lineY);
  doc.text(fmtUnit(exPrice), col3X + 40, lineY);

  lineY += 6;
  doc.setFont("helvetica", "normal");
  doc.setTextColor(...TEXT_LIGHT);
  doc.text(`Margem bruta (35%):`, col1X, lineY);
  doc.text(fmtBRL(exTotal * margin), col1X + 55, lineY);

  doc.setFontSize(7);
  doc.setTextColor(...TEXT_GRAY);
  doc.text("mesa.ads — Plataforma de gestão", pageW / 2, pageH - 8, { align: "center" });
  doc.text("Documento confidencial — uso interno", pageW / 2, pageH - 4, { align: "center" });

  doc.save("tabela-precos-mesa-ads.pdf");
}
