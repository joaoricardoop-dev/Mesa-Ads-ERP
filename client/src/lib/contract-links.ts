import { MASTER_CONTRACT_URL, CAMPAIGN_TERM_SLUG, PUBLIC_TERM_PATH } from "@shared/const";

export interface ContractLinks {
  masterContractUrl: string;
  campaignTermUrl: string;
}

let cached: ContractLinks | null = null;
let inflight: Promise<ContractLinks> | null = null;

function fallback(): ContractLinks {
  return {
    masterContractUrl: MASTER_CONTRACT_URL,
    campaignTermUrl: `${window.location.origin}${PUBLIC_TERM_PATH(CAMPAIGN_TERM_SLUG)}`,
  };
}

/**
 * Busca (com cache de sessão) os links de contrato impressos nos PDFs.
 * Fonte única no servidor (`/api/contract-links`); cai num fallback seguro
 * em caso de falha para nunca quebrar a geração do documento.
 */
export async function fetchContractLinks(): Promise<ContractLinks> {
  if (cached) return cached;
  if (inflight) return inflight;
  inflight = (async () => {
    try {
      const res = await fetch("/api/contract-links");
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = (await res.json()) as Partial<ContractLinks>;
      cached = {
        masterContractUrl: data.masterContractUrl || MASTER_CONTRACT_URL,
        campaignTermUrl: data.campaignTermUrl || fallback().campaignTermUrl,
      };
      return cached;
    } catch (err) {
      console.error("[contract-links] falha ao buscar, usando fallback:", err);
      return fallback();
    } finally {
      inflight = null;
    }
  })();
  return inflight;
}
