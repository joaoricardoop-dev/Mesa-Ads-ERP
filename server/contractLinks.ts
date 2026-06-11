import { appUrl } from "./_core/appUrl";
import {
  CONTRACT_MASTER_SLUG,
  CAMPAIGN_TERM_SLUG,
  PUBLIC_TERM_PATH,
  MASTER_CONTRACT_URL,
} from "@shared/const";

export interface ContractLinks {
  masterContractUrl: string;
  campaignTermUrl: string;
}

/**
 * Fonte ÚNICA dos links de contrato impressos em todos os PDFs (proposta e OS).
 *
 *  - `masterContractUrl`: URL externa editável em Termos Padrão (linha
 *    `contrato-master`). Cai no default `MASTER_CONTRACT_URL` se ainda não
 *    configurada.
 *  - `campaignTermUrl`: página pública não-logada que renderiza o termo de
 *    campanha (`/termo/contratacao-campanha`), montada via `appUrl()`.
 *
 * Lido pelo tRPC `termTemplate.getContractLinks` (telas internas) e pelo
 * endpoint público `/api/contract-links` (contexto de assinatura). Nenhuma
 * tela recalcula esses links por conta própria.
 */
export async function getContractLinks(): Promise<ContractLinks> {
  const campaignTermUrl = `${appUrl()}${PUBLIC_TERM_PATH(CAMPAIGN_TERM_SLUG)}`;
  let masterContractUrl = MASTER_CONTRACT_URL;
  try {
    const { getDb } = await import("./db");
    const db = await getDb();
    if (db) {
      const { termTemplates } = await import("../drizzle/schema");
      const { eq } = await import("drizzle-orm");
      const [master] = await db
        .select({ externalUrl: termTemplates.externalUrl })
        .from(termTemplates)
        .where(eq(termTemplates.slug, CONTRACT_MASTER_SLUG))
        .limit(1);
      if (master?.externalUrl) masterContractUrl = master.externalUrl;
    }
  } catch (err) {
    console.error("[contractLinks] falha ao ler contrato master, usando default:", err);
  }
  return { masterContractUrl, campaignTermUrl };
}
