export const COOKIE_NAME = "app_session_id";
export const ONE_YEAR_MS = 1000 * 60 * 60 * 24 * 365;
export const AXIOS_TIMEOUT_MS = 30_000;
export const UNAUTHED_ERR_MSG = 'Please login (10001)';
export const NOT_ADMIN_ERR_MSG = 'You do not have required permission (10002)';

/**
 * Contrato de Prestação de Serviços – Termos e Condições Gerais (contrato master).
 * Fonte única do link e da cláusula de vínculo exibida nas propostas (geradas e
 * assinadas). Qualquer tela que precise referenciar o contrato master DEVE
 * importar daqui — não duplicar o texto nem a URL.
 */
export const MASTER_CONTRACT_URL = "https://link.kaizenco.io/contratomaster1-2023";
export const PROPOSAL_BINDING_CLAUSE_PREFIX =
  "Ao preencher e assinar o presente Pedido de Aquisição de Bens e Serviços, o Cliente aceita e concorda em se vincular, de forma irretratável e irrevogável (salvo disposição expressa em contrário), a todos os termos e condições dispostos do Contrato de Prestação de Serviços – Termos e Condições Gerais, acessível através do endereço eletrônico";

/**
 * Termo de Contratação de Campanha Publicitária — termo com conteúdo interno,
 * gerenciado em "Termos Padrão" e exposto via página pública não-logada.
 * Cláusula de vínculo exibida nas propostas/OS junto ao link público.
 */
export const CAMPAIGN_TERM_BINDING_CLAUSE_PREFIX =
  "O Cliente declara ainda ciência e concordância com o Termo de Contratação de Campanha Publicitária, parte integrante desta contratação, acessível através do endereço eletrônico";

/**
 * Slugs canônicos das linhas especiais de `term_templates` (documentos
 * contratuais). Fonte única — backend e migrations referenciam estas chaves.
 */
export const CONTRACT_MASTER_SLUG = "contrato-master";
export const CAMPAIGN_TERM_SLUG = "contratacao-campanha";

/** Caminho da página pública que renderiza um termo por slug. */
export const PUBLIC_TERM_PATH = (slug: string) => `/termo/${slug}`;
