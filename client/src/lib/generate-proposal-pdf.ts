import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

interface ProposalPDFData {
  clientName: string;
  clientCompany?: string;
  clientCnpj?: string;
  clientEmail?: string;
  clientPhone?: string;
  quotationName?: string;
  coasterVolume: number;
  numRestaurants: number;
  coastersPerRestaurant: number;
  contractDuration: number;
  pricePerRestaurant: number;
  monthlyTotal: number;
  contractTotal: number;
  includesProduction: boolean;
  restaurants: Array<{
    name: string;
    neighborhood: string;
    coasters: number;
  }>;
  validityDays?: number;
}

const ORANGE = [255, 102, 0] as const;
const BLACK = [13, 13, 13] as const;
const GRAY = [120, 120, 120] as const;
const LIGHT_GRAY = [240, 240, 240] as const;
const WHITE = [255, 255, 255] as const;

function fmtCurrency(val: number): string {
  return `R$ ${val.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function fmtNumber(val: number): string {
  return val.toLocaleString("pt-BR");
}

function drawHeader(doc: jsPDF, pageWidth: number) {
  doc.setFillColor(...BLACK);
  doc.rect(0, 0, pageWidth, 50, "F");

  doc.setFillColor(...ORANGE);
  doc.rect(0, 50, pageWidth, 3, "F");

  doc.setTextColor(...WHITE);
  doc.setFontSize(28);
  doc.setFont("helvetica", "bold");
  doc.text("Mesa", 20, 28);

  const mesaWidth = doc.getTextWidth("Mesa");
  doc.setTextColor(...ORANGE);
  doc.text("Ads", 20 + mesaWidth + 2, 28);

  doc.setTextColor(...WHITE);
  doc.setFontSize(11);
  doc.setFont("helvetica", "normal");
  doc.text("Mídia em Bolachas de Chopp", 20, 40);

  doc.setFontSize(22);
  doc.setFont("helvetica", "bold");
  doc.text("PROPOSTA COMERCIAL", pageWidth - 20, 28, { align: "right" });

  doc.setFontSize(9);
  doc.setFont("helvetica", "normal");
  const today = new Date().toLocaleDateString("pt-BR", { day: "2-digit", month: "long", year: "numeric" });
  doc.text(today, pageWidth - 20, 40, { align: "right" });
}

function drawSection(doc: jsPDF, title: string, y: number, pageWidth: number): number {
  doc.setFillColor(...ORANGE);
  doc.rect(20, y, 4, 14, "F");

  doc.setTextColor(...BLACK);
  doc.setFontSize(11);
  doc.setFont("helvetica", "bold");
  doc.text(title, 30, y + 10);

  doc.setDrawColor(230, 230, 230);
  doc.line(30, y + 16, pageWidth - 20, y + 16);

  return y + 24;
}

function drawInfoRow(doc: jsPDF, label: string, value: string, y: number, pageWidth: number): number {
  doc.setTextColor(...GRAY);
  doc.setFontSize(9);
  doc.setFont("helvetica", "normal");
  doc.text(label, 30, y);

  doc.setTextColor(...BLACK);
  doc.setFont("helvetica", "bold");
  doc.text(value, pageWidth / 2, y);

  return y + 7;
}

function checkPageBreak(doc: jsPDF, y: number, needed: number): number {
  const pageHeight = doc.internal.pageSize.getHeight();
  if (y + needed > pageHeight - 30) {
    doc.addPage();
    return 25;
  }
  return y;
}

export function generateProposalPdf(data: ProposalPDFData) {
  const doc = new jsPDF();
  const pageWidth = doc.internal.pageSize.getWidth();

  drawHeader(doc, pageWidth);

  let y = 68;

  if (data.quotationName) {
    doc.setTextColor(...GRAY);
    doc.setFontSize(9);
    doc.setFont("helvetica", "normal");
    doc.text(`Ref: ${data.quotationName}`, 20, y);
    y += 12;
  }

  y = drawSection(doc, "DESTINATÁRIO", y, pageWidth);

  if (data.clientCompany) {
    y = drawInfoRow(doc, "Empresa:", data.clientCompany, y, pageWidth);
  }
  y = drawInfoRow(doc, "Nome:", data.clientName, y, pageWidth);
  if (data.clientCnpj) {
    y = drawInfoRow(doc, "CNPJ:", data.clientCnpj, y, pageWidth);
  }
  if (data.clientEmail) {
    y = drawInfoRow(doc, "E-mail:", data.clientEmail, y, pageWidth);
  }
  if (data.clientPhone) {
    y = drawInfoRow(doc, "Telefone:", data.clientPhone, y, pageWidth);
  }

  y += 10;
  y = drawSection(doc, "SOBRE A MESA ADS", y, pageWidth);

  doc.setTextColor(60, 60, 60);
  doc.setFontSize(9);
  doc.setFont("helvetica", "normal");
  const aboutText = [
    "A Mesa Ads é especialista em mídia offline de alto impacto: bolachas de chopp",
    "personalizadas, distribuídas em restaurantes e bares selecionados.",
    "",
    "Sua marca presente na mesa do consumidor — no momento mais descontraído",
    "do dia, gerando milhares de impressões orgânicas por mês com alta retenção.",
  ];
  aboutText.forEach(line => {
    doc.text(line, 30, y);
    y += line === "" ? 4 : 6;
  });

  y += 10;
  y = checkPageBreak(doc, y, 70);
  y = drawSection(doc, "DESCRIÇÃO DO SERVIÇO", y, pageWidth);

  y = drawInfoRow(doc, "Formato:", "Bolachas de chopp personalizadas (frente e verso)", y, pageWidth);
  y = drawInfoRow(doc, "Volume total:", `${fmtNumber(data.coasterVolume)} bolachas/mês`, y, pageWidth);
  y = drawInfoRow(doc, "Distribuição:", `${data.numRestaurants} restaurantes parceiros`, y, pageWidth);
  y = drawInfoRow(doc, "Por restaurante:", `${fmtNumber(data.coastersPerRestaurant)} bolachas/mês`, y, pageWidth);
  y = drawInfoRow(doc, "Duração:", `${data.contractDuration} ${data.contractDuration === 1 ? "mês" : "meses"}`, y, pageWidth);
  if (data.includesProduction) {
    y = drawInfoRow(doc, "Produção:", "Inclusa no valor", y, pageWidth);
  }

  y += 10;
  y = checkPageBreak(doc, y, 80);
  y = drawSection(doc, "INVESTIMENTO", y, pageWidth);

  doc.setFillColor(...LIGHT_GRAY);
  doc.roundedRect(30, y, pageWidth - 60, 50, 3, 3, "F");

  doc.setTextColor(...GRAY);
  doc.setFontSize(9);
  doc.setFont("helvetica", "normal");
  doc.text("Valor mensal por restaurante", 40, y + 12);
  doc.text("Investimento mensal total", 40, y + 26);
  doc.text("Valor total do contrato", 40, y + 40);

  doc.setTextColor(...BLACK);
  doc.setFontSize(12);
  doc.setFont("helvetica", "bold");
  doc.text(fmtCurrency(data.pricePerRestaurant), pageWidth - 40, y + 12, { align: "right" });

  doc.setTextColor(...ORANGE);
  doc.setFontSize(14);
  doc.text(fmtCurrency(data.monthlyTotal), pageWidth - 40, y + 26, { align: "right" });

  doc.setTextColor(...BLACK);
  doc.setFontSize(16);
  doc.text(fmtCurrency(data.contractTotal), pageWidth - 40, y + 42, { align: "right" });

  doc.setDrawColor(200, 200, 200);
  doc.line(40, y + 17, pageWidth - 40, y + 17);
  doc.line(40, y + 31, pageWidth - 40, y + 31);

  y += 62;

  if (data.restaurants.length > 0) {
    y += 6;
    y = checkPageBreak(doc, y, 60);
    y = drawSection(doc, "REDE DE DISTRIBUIÇÃO", y, pageWidth);

    autoTable(doc, {
      startY: y,
      head: [["#", "Restaurante", "Bairro", "Bolachas/mês"]],
      body: data.restaurants.map((r, i) => [
        String(i + 1),
        r.name,
        r.neighborhood || "—",
        fmtNumber(r.coasters),
      ]),
      foot: [[
        "",
        `${data.restaurants.length} restaurantes`,
        "",
        fmtNumber(data.restaurants.reduce((s, r) => s + r.coasters, 0)),
      ]],
      theme: "grid",
      headStyles: {
        fillColor: [...BLACK],
        textColor: [...WHITE],
        fontSize: 8,
        fontStyle: "bold",
      },
      bodyStyles: { fontSize: 8, textColor: [40, 40, 40] },
      footStyles: {
        fillColor: [...LIGHT_GRAY],
        textColor: [...BLACK],
        fontSize: 8,
        fontStyle: "bold",
      },
      alternateRowStyles: { fillColor: [250, 250, 250] },
      margin: { left: 30, right: 30 },
      columnStyles: {
        0: { cellWidth: 12, halign: "center" },
        3: { halign: "right", fontStyle: "bold" },
      },
    });

    y = (doc as any).lastAutoTable?.finalY || y + 40;
  }

  y += 12;
  y = checkPageBreak(doc, y, 60);
  y = drawSection(doc, "CONDIÇÕES", y, pageWidth);

  const validityDays = data.validityDays || 15;
  const conditions = [
    `• Esta proposta é válida por ${validityDays} dias a partir da data de emissão.`,
    "• Pagamento conforme condições acordadas entre as partes.",
    "• A produção das bolachas será iniciada após aprovação da arte pelo anunciante.",
    "• A Mesa Ads se reserva o direito de selecionar os restaurantes parceiros",
    "  conforme disponibilidade e perfil da campanha.",
    "• Valores sujeitos a alteração após o período de validade.",
  ];

  doc.setTextColor(60, 60, 60);
  doc.setFontSize(8.5);
  doc.setFont("helvetica", "normal");
  conditions.forEach(line => {
    y = checkPageBreak(doc, y, 8);
    doc.text(line, 30, y);
    y += 6;
  });

  y += 16;
  y = checkPageBreak(doc, y, 40);

  doc.setDrawColor(200, 200, 200);
  doc.line(30, y, 90, y);
  doc.line(pageWidth - 90, y, pageWidth - 30, y);
  y += 5;
  doc.setFontSize(8);
  doc.setTextColor(...GRAY);
  doc.text("Anunciante", 60, y, { align: "center" });
  doc.text("Mesa Ads", pageWidth - 60, y, { align: "center" });

  y += 5;
  doc.setFontSize(7);
  doc.text(data.clientName, 60, y, { align: "center" });
  doc.text("Representante Legal", pageWidth - 60, y, { align: "center" });

  const pageHeight = doc.internal.pageSize.getHeight();
  const totalPages = doc.getNumberOfPages();
  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i);

    doc.setFillColor(...BLACK);
    doc.rect(0, pageHeight - 18, pageWidth, 18, "F");

    doc.setFontSize(7);
    doc.setTextColor(...GRAY);
    doc.text(
      `Mesa Ads — Proposta Comercial — Gerado em ${new Date().toLocaleDateString("pt-BR")}`,
      pageWidth / 2,
      pageHeight - 10,
      { align: "center" }
    );

    doc.setTextColor(80, 80, 80);
    doc.text(`${i}/${totalPages}`, pageWidth - 20, pageHeight - 10, { align: "right" });
  }

  const filename = data.quotationName
    ? `Proposta_${data.quotationName.replace(/[^a-zA-Z0-9]/g, "_")}.pdf`
    : `Proposta_${data.clientName.replace(/[^a-zA-Z0-9]/g, "_")}.pdf`;
  doc.save(filename);
}
