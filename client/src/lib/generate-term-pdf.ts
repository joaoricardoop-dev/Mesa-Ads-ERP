import jsPDF from "jspdf";

interface TermPDFData {
  title: string;
  content: string;
  signerName: string;
  signerCpf: string;
  signerEmail: string;
  signedAt: string;
  termHash?: string;
}

function stripHtml(html: string): string {
  const parsed = new DOMParser().parseFromString(html, "text/html");
  const div = parsed.body;

  const blocks = div.querySelectorAll("h1, h2, h3, p, li, hr");
  if (blocks.length === 0) {
    return div.textContent || "";
  }

  const lines: string[] = [];
  function walk(node: Node) {
    if (node.nodeType === Node.TEXT_NODE) {
      return;
    }
    const el = node as HTMLElement;
    const tag = el.tagName?.toLowerCase();

    if (tag === "hr") {
      lines.push("───────────────────────────────────────");
      return;
    }
    if (tag === "br") {
      lines.push("");
      return;
    }

    const text = el.textContent?.trim() || "";
    if (!text) return;

    if (tag === "h1") {
      lines.push("");
      lines.push(text.toUpperCase());
      lines.push("");
    } else if (tag === "h2") {
      lines.push("");
      lines.push(text);
      lines.push("");
    } else if (tag === "h3") {
      lines.push(text);
    } else if (tag === "li") {
      const parent = el.parentElement;
      if (parent?.tagName?.toLowerCase() === "ol") {
        const idx = Array.from(parent.children).indexOf(el) + 1;
        lines.push(`  ${idx}. ${text}`);
      } else {
        lines.push(`  • ${text}`);
      }
    } else if (tag === "p") {
      lines.push(text);
      lines.push("");
    } else if (tag === "ul" || tag === "ol") {
      for (const child of Array.from(el.children)) {
        walk(child);
      }
      lines.push("");
    } else {
      for (const child of Array.from(el.children)) {
        walk(child);
      }
    }
  }

  for (const child of Array.from(div.children)) {
    walk(child);
  }

  return lines.join("\n").replace(/\n{3,}/g, "\n\n").trim();
}

export function generateTermPdf(data: TermPDFData) {
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
  doc.text("TERMO DE ACEITE", margin, 34);

  doc.setTextColor(100, 100, 100);
  doc.setFontSize(8);
  const dateStr = new Date(data.signedAt).toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "long",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
  doc.text(dateStr, pageWidth - margin, 34, { align: "right" });

  let y = 56;

  doc.setTextColor(13, 13, 13);
  doc.setFontSize(14);
  doc.setFont("helvetica", "bold");
  const titleLines = doc.splitTextToSize(data.title, contentWidth);
  doc.text(titleLines, margin, y);
  y += titleLines.length * 7 + 6;

  doc.setDrawColor(220, 220, 220);
  doc.line(margin, y, pageWidth - margin, y);
  y += 8;

  const textContent = stripHtml(data.content);
  doc.setFontSize(9);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(40, 40, 40);

  const wrappedLines = doc.splitTextToSize(textContent, contentWidth);

  for (const line of wrappedLines) {
    if (y > pageHeight - 70) {
      doc.addPage();
      y = 20;
    }
    doc.text(line, margin, y);
    y += 4.5;
  }

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

  doc.setFontSize(9);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(60, 60, 60);

  const signerRows = [
    ["Nome:", data.signerName],
    ["CPF:", data.signerCpf],
    ["E-mail:", data.signerEmail],
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
  if (data.termHash) {
    doc.text(`Verificação: ${data.termHash.substring(0, 32)}...`, margin, footerY + 4);
  }

  doc.setFontSize(7);
  doc.setTextColor(39, 216, 3);
  doc.text("mesa.ads", pageWidth - margin, footerY, { align: "right" });

  const fileName = `termo_${data.title.replace(/[^a-zA-Z0-9]/g, "_").toLowerCase()}_${new Date(data.signedAt).toISOString().split("T")[0]}.pdf`;
  doc.save(fileName);
}
