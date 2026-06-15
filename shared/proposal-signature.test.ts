import { describe, expect, it } from "vitest";
import { buildProposalSignature, buildOSSignature } from "./proposalData";

describe("buildProposalSignature", () => {
  it("monta o registro digital quando há signedAt + signatureData", () => {
    const sig = buildProposalSignature({
      signedAt: "2026-01-15T12:30:00.000Z",
      signedBy: "Fulano de Tal",
      signatureData: JSON.stringify({
        name: "João da Silva",
        cpf: "123.456.789-00",
        ip: "200.1.2.3",
        hash: "abc123",
      }),
    });

    expect(sig).toEqual({
      signerName: "João da Silva",
      signerCpf: "123.456.789-00",
      signedAt: "2026-01-15T12:30:00.000Z",
      signatureHash: "abc123",
      ip: "200.1.2.3",
    });
  });

  it("aceita signedAt como Date e normaliza para ISO", () => {
    const sig = buildProposalSignature({
      signedAt: new Date("2026-03-01T08:00:00.000Z"),
      signedBy: "Cliente",
      signatureData: JSON.stringify({ name: "Maria" }),
    });

    expect(sig?.signedAt).toBe("2026-03-01T08:00:00.000Z");
    expect(sig?.signerName).toBe("Maria");
  });

  it("cai para signedBy quando signatureData não traz name", () => {
    const sig = buildProposalSignature({
      signedAt: "2026-01-15T12:30:00.000Z",
      signedBy: "Fulano de Tal",
      signatureData: JSON.stringify({ cpf: "123" }),
    });

    expect(sig?.signerName).toBe("Fulano de Tal");
    expect(sig?.signerCpf).toBe("123");
    expect(sig?.signatureHash).toBeUndefined();
    expect(sig?.ip).toBeUndefined();
  });

  it('usa "Cliente" quando não há name nem signedBy', () => {
    const sig = buildProposalSignature({
      signedAt: "2026-01-15T12:30:00.000Z",
      signedBy: null,
      signatureData: JSON.stringify({}),
    });

    expect(sig?.signerName).toBe("Cliente");
  });

  it("retorna undefined sem signedAt (mantém linhas manuais)", () => {
    expect(
      buildProposalSignature({
        signedAt: null,
        signedBy: "Fulano",
        signatureData: JSON.stringify({ name: "João" }),
      }),
    ).toBeUndefined();
  });

  it("retorna undefined sem signatureData (mantém linhas manuais)", () => {
    expect(
      buildProposalSignature({
        signedAt: "2026-01-15T12:30:00.000Z",
        signedBy: "Fulano",
        signatureData: null,
      }),
    ).toBeUndefined();
  });

  it("retorna undefined quando signedAt é inválido", () => {
    expect(
      buildProposalSignature({
        signedAt: "data-invalida",
        signedBy: "Fulano",
        signatureData: JSON.stringify({ name: "João" }),
      }),
    ).toBeUndefined();
  });

  it("faz fallback para signedBy quando signatureData é JSON inválido", () => {
    const sig = buildProposalSignature({
      signedAt: "2026-01-15T12:30:00.000Z",
      signedBy: "Fulano de Tal",
      signatureData: "{not-json",
    });

    expect(sig).toEqual({
      signerName: "Fulano de Tal",
      signedAt: "2026-01-15T12:30:00.000Z",
    });
  });

  it('faz fallback para "Cliente" com JSON inválido e sem signedBy', () => {
    const sig = buildProposalSignature({
      signedAt: "2026-01-15T12:30:00.000Z",
      signedBy: null,
      signatureData: "{not-json",
    });

    expect(sig).toEqual({
      signerName: "Cliente",
      signedAt: "2026-01-15T12:30:00.000Z",
    });
  });
});

describe("buildOSSignature", () => {
  it("monta o registro digital quando há signedAt + signedByName", () => {
    const sig = buildOSSignature({
      signedAt: "2026-02-20T15:45:00.000Z",
      signedByName: "Empresa XPTO",
      signedByCpf: "987.654.321-00",
      signatureHash: "hash-os-1",
    });

    expect(sig).toEqual({
      signerName: "Empresa XPTO",
      signerCpf: "987.654.321-00",
      signedAt: "2026-02-20T15:45:00.000Z",
      signatureHash: "hash-os-1",
    });
  });

  it("aceita signedAt como Date e normaliza para ISO", () => {
    const sig = buildOSSignature({
      signedAt: new Date("2026-04-10T10:00:00.000Z"),
      signedByName: "Empresa XPTO",
    });

    expect(sig?.signedAt).toBe("2026-04-10T10:00:00.000Z");
  });

  it("omite signerCpf e signatureHash quando ausentes", () => {
    const sig = buildOSSignature({
      signedAt: "2026-02-20T15:45:00.000Z",
      signedByName: "Empresa XPTO",
      signedByCpf: null,
      signatureHash: null,
    });

    expect(sig).toEqual({
      signerName: "Empresa XPTO",
      signedAt: "2026-02-20T15:45:00.000Z",
      signerCpf: undefined,
      signatureHash: undefined,
    });
  });

  it("retorna undefined sem signedAt (mantém linhas manuais)", () => {
    expect(
      buildOSSignature({
        signedAt: null,
        signedByName: "Empresa XPTO",
      }),
    ).toBeUndefined();
  });

  it("retorna undefined sem signedByName (mantém linhas manuais)", () => {
    expect(
      buildOSSignature({
        signedAt: "2026-02-20T15:45:00.000Z",
        signedByName: null,
      }),
    ).toBeUndefined();
  });

  it("retorna undefined quando signedAt é inválido", () => {
    expect(
      buildOSSignature({
        signedAt: "data-invalida",
        signedByName: "Empresa XPTO",
      }),
    ).toBeUndefined();
  });
});
