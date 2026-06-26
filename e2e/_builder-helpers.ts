import { expect, type APIRequestContext } from "@playwright/test";

// Helpers compartilhados para specs do builder /montar-campanha (e portais
// self-service que reusam o MediaShopBuilder).
//
// Motivação (Task #337): o builder persiste o plano em andamento no servidor,
// keyed pelo clientId do anunciante (campaign_drafts via
// anunciantePortal.saveCartDraft), e re-hidrata na próxima execução. Como o
// banco de teste E2E é compartilhado entre runs, esse draft VAZA entre
// execuções — um local fica selecionado, as datas ficam as de um teste anterior
// (ex.: 2099) e popups/CTA mudam de "Adicionar" para "Remover". Cada spec que
// exercita o builder precisaria repetir a mesma dança (resolver o clientId do
// anunciante via dev-ensure-anunciante e então limpar o draft via
// dev-clear-cart-draft). Este módulo centraliza isso para evitar divergência e
// novos specs flaky.

export type EnsuredAnunciante = {
  id: string;
  clientId: number | null;
};

// Resolve (criando se necessário) o anunciante de teste e devolve sua
// identidade. O draft de carrinho é keyed pelo clientId desse anunciante (Vexa
// pay Ltda), que não é necessariamente o primeiro cliente da tabela — por isso
// resolvemos explicitamente em vez de assumir.
export async function ensureTestAnunciante(
  request: APIRequestContext,
): Promise<EnsuredAnunciante> {
  const res = await request.post("/api/dev-ensure-anunciante", { data: {} });
  expect(
    res.ok(),
    `dev-ensure-anunciante falhou: ${res.status()} ${await res.text()}`,
  ).toBeTruthy();
  const { user } = (await res.json()) as { user: EnsuredAnunciante };
  return user;
}

// Zera todo o scratch state por-anunciante que o builder persiste no servidor
// entre runs (hoje: campaign_drafts). Resolve o clientId do anunciante de teste
// e limpa o draft, garantindo isolamento determinístico entre execuções. Use no
// beforeEach/beforeAll de qualquer spec que monte um plano em /montar-campanha
// ou nos portais self-service — assim nenhum spec precisa reimplementar a dança.
export async function resetTestAdvertiserState(
  request: APIRequestContext,
): Promise<{ clientId: number | null }> {
  const user = await ensureTestAnunciante(request);
  const res = await request.post("/api/dev-clear-cart-draft", {
    data: user.clientId != null ? { clientId: user.clientId } : {},
  });
  expect(
    res.ok(),
    `dev-clear-cart-draft falhou: ${res.status()} ${await res.text()}`,
  ).toBeTruthy();
  return { clientId: user.clientId };
}
