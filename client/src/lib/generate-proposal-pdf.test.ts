import { beforeEach, describe, expect, it, vi } from "vitest";
import { generateProposalPdf } from "./generate-proposal-pdf";
import type { ProposalPDFData } from "@shared/proposalData";

// Os links de contrato vêm de um fetch (`/api/contract-links`) que depende de
// `window`/rede. Mockamos para o teste rodar em Node e nunca tocar a rede.
vi.mock("./contract-links", () => ({
  fetchContractLinks: async () => ({
    masterContractUrl: "https://example.com/contrato",
    campaignTermUrl: "https://example.com/termo",
  }),
}));

// O jsPDF copia seus métodos como propriedades próprias de CADA instância (não
// num prototype compartilhável), e o gerador instancia o doc internamente — então
// não dá para espionar um prototype antes. Mockamos o módulo `jspdf` para que
// cada `new jsPDF()` devolva a instância real com `text` instrumentado, gravando
// em `globalThis.__capturedPdfText` todo texto desenhado no documento. É a forma
// estável de inspecionar os comandos reais que vão para o PDF sem ter de extrair
// texto do binário (ilegível por causa das fontes TTF embutidas).
declare global {
  // eslint-disable-next-line no-var
  var __capturedPdfText: string[];
}

vi.mock("jspdf", async (importOriginal) => {
  const actual = (await importOriginal()) as { default: new (...args: unknown[]) => unknown };
  const RealDefault = actual.default;
  function Wrapped(this: unknown, ...args: unknown[]) {
    const inst = new RealDefault(...args) as { text: (...a: unknown[]) => unknown };
    const origText = inst.text.bind(inst);
    inst.text = (t: unknown, ...rest: unknown[]) => {
      const bucket = globalThis.__capturedPdfText;
      if (bucket) {
        if (Array.isArray(t)) bucket.push(...(t as string[]));
        else if (typeof t === "string") bucket.push(t);
      }
      return origText(t, ...rest);
    };
    return inst;
  }
  return { ...actual, default: Wrapped };
});

const baseData: ProposalPDFData = {
  clientName: "João da Silva",
  coasterVolume: 1000,
  numRestaurants: 1,
  coastersPerRestaurant: 1000,
  contractDuration: 1,
  pricePerRestaurant: 1000,
  monthlyTotal: 1000,
  contractTotal: 1000,
  includesProduction: true,
  restaurants: [],
};

describe("generateProposalPdf — registro de assinatura digital", () => {
  beforeEach(() => {
    globalThis.__capturedPdfText = [];
  });

  it("renderiza o registro digital (nome/CPF/data/hash) e omite as linhas manuais quando há signature", async () => {
    const data: ProposalPDFData = {
      ...baseData,
      signature: {
        signerName: "João da Silva",
        signerCpf: "123.456.789-00",
        signedAt: "2026-01-15T12:30:00.000Z",
        signatureHash: "abc123hashverificacao",
        ip: "200.1.2.3",
      },
    };

    const result = await generateProposalPdf(data, { autoSave: false });
    const text = globalThis.__capturedPdfText.join("\n");

    // Bloco de assinatura digital presente
    expect(text).toContain("REGISTRO DE ASSINATURA DIGITAL");
    expect(text).toContain("Assinado por:");
    expect(text).toContain("João da Silva");
    expect(text).toContain("CPF:");
    expect(text).toContain("123.456.789-00");
    expect(text).toContain("Data/Hora:");
    expect(text).toContain("IP:");
    expect(text).toContain("200.1.2.3");
    expect(text).toContain("Verificação (SHA-256): abc123hashverificacao");

    // Linhas de assinatura manual NÃO devem aparecer
    expect(text).not.toContain("Anunciante");
    expect(text).not.toContain("Representante Legal");

    // Nome do arquivo sinaliza a versão assinada
    expect(result.fileName).toBe("Proposta_Assinada_Jo_o_da_Silva.pdf");
    expect(result.base64.length).toBeGreaterThan(0);
  });

  it("mantém as linhas de assinatura manual e não desenha o registro digital quando NÃO há signature", async () => {
    const result = await generateProposalPdf(baseData, { autoSave: false });
    const text = globalThis.__capturedPdfText.join("\n");

    // Linhas de assinatura manual presentes
    expect(text).toContain("Anunciante");
    expect(text).toContain("Representante Legal");
    expect(text).toContain("João da Silva");

    // Registro digital NÃO deve aparecer
    expect(text).not.toContain("REGISTRO DE ASSINATURA DIGITAL");
    expect(text).not.toContain("Assinado por:");
    expect(text).not.toContain("Data/Hora:");

    // Nome do arquivo é a versão não assinada
    expect(result.fileName).toBe("Proposta_Jo_o_da_Silva.pdf");
  });
});
