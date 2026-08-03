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

/**
 * Papéis internos (staff) — fonte única. Antes duplicado manualmente em vários
 * arquivos (server/_core/context.ts, server/routers.ts, server/quotationRouter.ts,
 * client/src/App.tsx, DashboardLayout.tsx, Members.tsx); todos devem importar
 * daqui. "backoffice" é o papel do estagiário de operações (rotina de
 * bolachas/telas/permutas).
 */
export const INTERNAL_ROLES = ["admin", "comercial", "operacoes", "financeiro", "manager", "backoffice"] as const;

/**
 * Papéis externos — sempre EXCLUSIVOS: não se misturam entre si nem com
 * papéis internos (Task #426).
 */
export const EXTERNAL_ROLES = ["anunciante", "restaurante", "parceiro"] as const;

type RoleBearer = { role?: string | null; roles?: string[] | null } | null | undefined;

/**
 * Fonte única dos "papéis efetivos" de um usuário (Task #426 — múltiplos
 * papéis internos). Regras:
 *  - `role` (papel primário) sempre faz parte do conjunto.
 *  - `roles` (jsonb) adiciona papéis internos extras.
 *  - Se o papel primário é EXTERNO, o conjunto é APENAS ele — externos são
 *    exclusivos, e isso mantém a impersonação segura (role sobrescrito para
 *    "anunciante"/"restaurante" anula os papéis internos do array).
 *  - Papéis externos dentro de `roles` são ignorados quando o primário é
 *    interno (defesa em profundidade; a escrita já valida).
 */
export function getEffectiveRoles(user: RoleBearer): string[] {
  if (!user) return [];
  const primary = user.role || null;
  if (primary && (EXTERNAL_ROLES as readonly string[]).includes(primary)) return [primary];
  const set = new Set<string>();
  if (primary) set.add(primary);
  if (Array.isArray(user.roles)) {
    for (const r of user.roles) {
      if (typeof r === "string" && (INTERNAL_ROLES as readonly string[]).includes(r)) set.add(r);
    }
  }
  return Array.from(set);
}

/** True se ALGUM papel efetivo do usuário está na lista (sem passe de admin). */
export function hasAnyRole(user: RoleBearer, allowed: readonly string[]): boolean {
  return getEffectiveRoles(user).some((r) => allowed.includes(r));
}

/** True se o usuário é admin OU tem algum papel efetivo na lista permitida. */
export function canAccess(user: RoleBearer, allowed: readonly string[]): boolean {
  const roles = getEffectiveRoles(user);
  return roles.includes("admin") || roles.some((r) => allowed.includes(r));
}

/** True se o usuário tem algum papel interno (staff). */
export function isInternalUser(user: RoleBearer): boolean {
  return hasAnyRole(user, INTERNAL_ROLES);
}
