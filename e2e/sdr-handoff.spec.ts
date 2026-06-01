import { test, expect, type APIRequestContext } from "@playwright/test";
import { devLoginAdmin, trpcMutation, trpcQuery } from "./_finance-helpers";

// Task #234 — trava o funil de Pré-vendas (SDR) e o handoff "Passar para o
// closer". O lead anunciante é criado + BANT preenchido via tRPC (paralelo-
// seguro, nome único por worker); o handoff e o prompt de desqualificação são
// exercitados PELA UI (os diálogos reais em client/src/pages/Leads.tsx), que
// é exatamente o que regressões silenciosas quebrariam. Asserções finais
// voltam ao tRPC (lead.get / opportunity.list) pra confirmar o estado servidor.

type CreatedLead = {
  id: number;
  stage: string;
  convertedToType: string | null;
  convertedToId: number | null;
};

async function createAnuncianteLead(
  request: APIRequestContext,
  name: string,
): Promise<CreatedLead> {
  return trpcMutation<CreatedLead>(request, "lead.create", {
    type: "anunciante",
    name,
    company: name,
    contactName: "Contato E2E",
    contactEmail: "contato.e2e@example.com",
    origin: "Prospecção Ativa",
    stage: "qualificacao_bant",
    // Qualificação BANT completa.
    cargo: "Diretor de Marketing",
    decisionRole: "decisor",
    produtoInteresse: "Bolacha + Tela",
    praca: "ambas",
    budgetEstimado: "5000",
    timing: "próximo trimestre",
    objecoes: "preço",
  });
}

async function openLeadInUI(page: import("@playwright/test").Page, name: string) {
  await page.goto("/comercial/leads");
  // A aba padrão é Pré-vendas (SDR) — leads anunciante. O card do lead exibe
  // o nome; clicar abre o Sheet de detalhe.
  const card = page.getByText(name, { exact: true }).first();
  await expect(card).toBeVisible({ timeout: 15_000 });
  await card.click();
  // O Sheet de detalhe abre com o nome no título.
  await expect(
    page.getByRole("dialog").filter({ hasText: name }).first(),
  ).toBeVisible();
}

test.describe("Funil SDR — handoff para o closer", () => {
  test.beforeEach(async ({ context }) => {
    await context.clearCookies();
  });

  test("qualifica e passa o lead para o closer, criando uma oportunidade", async ({
    page,
  }) => {
    // Usa page.request para que o cookie dev_user_id viva no mesmo contexto
    // do browser que navega a UI (o fixture `request` tem cookie jar próprio).
    const request = page.request;
    await devLoginAdmin(request);

    const name = `E2E SDR Handoff ${Date.now()}-${Math.floor(Math.random() * 1e4)}`;
    const lead = await createAnuncianteLead(request, name);
    expect(lead.id).toBeGreaterThan(0);

    await openLeadInUI(page, name);

    // Abre o diálogo de handoff.
    await page.getByRole("button", { name: /Passar para o closer/i }).click();

    const handoffDialog = page
      .getByRole("dialog")
      .filter({ hasText: "Passar para o closer" });
    await expect(handoffDialog).toBeVisible();

    // Seleciona o primeiro closer disponível (o próprio admin logado já
    // aparece, pois lead.listUsers devolve internos ativos).
    await handoffDialog.getByRole("combobox").click();
    await page.getByRole("option").first().click();

    await handoffDialog.getByRole("button", { name: /Confirmar handoff/i }).click();

    // O diálogo fecha e o Sheet re-renderiza como convertido.
    await expect(handoffDialog).toBeHidden();
    await expect(page.getByText("Convertido").first()).toBeVisible({
      timeout: 15_000,
    });
    await expect(
      page.getByText(/Qualificado \(handoff\)/i).first(),
    ).toBeVisible();

    // Asserções servidor: lead vira qualificado_handoff + aponta p/ oportunidade.
    const updated = await trpcQuery<CreatedLead>(request, "lead.get", {
      id: lead.id,
    });
    expect(updated.stage).toBe("qualificado_handoff");
    expect(updated.convertedToType).toBe("opportunity");
    expect(updated.convertedToId).toBeTruthy();

    // A oportunidade foi de fato criada no estágio "qualificada".
    const opps = await trpcQuery<Array<{ id: number; leadId: number | null; stage: string }>>(
      request,
      "opportunity.list",
    );
    const opp = opps.find((o) => o.leadId === lead.id);
    expect(opp, "oportunidade vinculada ao lead deve existir").toBeTruthy();
    expect(opp!.id).toBe(updated.convertedToId);
    expect(opp!.stage).toBe("qualificada");
  });

  test("desqualificar um lead exige escolher um motivo", async ({
    page,
  }) => {
    const request = page.request;
    await devLoginAdmin(request);

    const name = `E2E SDR Desq ${Date.now()}-${Math.floor(Math.random() * 1e4)}`;
    const lead = await createAnuncianteLead(request, name);

    await openLeadInUI(page, name);

    // Clicar no estágio "Desqualificado" dispara o prompt de motivo em vez de
    // gravar direto.
    await page
      .getByRole("button", { name: /^Desqualificado$/i })
      .first()
      .click();

    const disqualifyDialog = page
      .getByRole("dialog")
      .filter({ hasText: "Desqualificar lead" });
    await expect(disqualifyDialog).toBeVisible();

    // Sem motivo, o botão de confirmar fica desabilitado.
    const confirmBtn = disqualifyDialog.getByRole("button", {
      name: /^Desqualificar$/i,
    });
    await expect(confirmBtn).toBeDisabled();

    // Escolhe o motivo "Sem budget" e confirma.
    await disqualifyDialog.getByRole("combobox").click();
    await page.getByRole("option", { name: "Sem budget" }).click();
    await expect(confirmBtn).toBeEnabled();
    await confirmBtn.click();

    await expect(disqualifyDialog).toBeHidden();

    // Asserção servidor: estágio + motivo persistidos.
    const updated = await trpcQuery<{ stage: string; disqualifyReason: string | null }>(
      request,
      "lead.get",
      { id: lead.id },
    );
    expect(updated.stage).toBe("desqualificado");
    expect(updated.disqualifyReason).toBe("sem_budget");
  });
});
