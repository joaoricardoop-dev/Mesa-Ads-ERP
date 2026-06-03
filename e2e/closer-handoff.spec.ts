import { test, expect, type APIRequestContext } from "@playwright/test";
import {
  devLoginAdmin,
  devCreateInternalUser,
  devDeleteUser,
  trpcMutation,
  trpcQuery,
} from "./_finance-helpers";

// Task #248 — trava o handoff por tag Closer. Desde a mudança em
// `server/leadRouter.ts`, `handoffToCloser` só aceita usuários com a tag
// Closer (ativa) e o seletor da UI usa `lead.listClosers`. Estes testes
// garantem que:
//   (a) só usuários com a tag Closer aparecem no seletor do diálogo de handoff;
//   (b) a mutation recusa um alvo interno SEM a tag Closer;
//   (c) o handoff completo (oportunidade atribuída ao closer + caminho de
//       e-mail) funciona para um closer válido — exercitado pela UI real.
//
// Os usuários de teste nascem com prefixo "e2e-internal-" (via endpoint dev)
// e são removidos no afterEach para não poluir `lead.listClosers` entre runs.

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
  const card = page.getByText(name, { exact: true }).first();
  await expect(card).toBeVisible({ timeout: 15_000 });
  await card.click();
  await expect(
    page.getByRole("dialog").filter({ hasText: name }).first(),
  ).toBeVisible();
}

test.describe("Handoff por tag Closer", () => {
  // Coleta de ids criados em cada teste p/ cleanup mesmo em caso de falha.
  let createdUserIds: string[] = [];

  test.beforeEach(async ({ context }) => {
    await context.clearCookies();
    createdUserIds = [];
  });

  test.afterEach(async ({ request }) => {
    for (const id of createdUserIds) {
      await devDeleteUser(request, id);
    }
  });

  test("seletor de handoff lista só usuários com a tag Closer e conclui o handoff", async ({
    page,
  }) => {
    const request = page.request;
    await devLoginAdmin(request);

    const stamp = `${Date.now()}-${Math.floor(Math.random() * 1e4)}`;
    const closerLast = `Closer ${stamp}`;
    const nonCloserLast = `NaoCloser ${stamp}`;

    const closer = await devCreateInternalUser(request, {
      role: "comercial",
      isCloser: true,
      firstName: "E2E",
      lastName: closerLast,
    });
    createdUserIds.push(closer.id);

    const nonCloser = await devCreateInternalUser(request, {
      role: "comercial",
      isCloser: false,
      firstName: "E2E",
      lastName: nonCloserLast,
    });
    createdUserIds.push(nonCloser.id);

    // Sanidade no servidor: listClosers inclui o closer e exclui o não-closer.
    const closers = await trpcQuery<Array<{ id: string }>>(request, "lead.listClosers");
    expect(closers.some((u) => u.id === closer.id)).toBe(true);
    expect(closers.some((u) => u.id === nonCloser.id)).toBe(false);

    const name = `E2E Closer Handoff ${stamp}`;
    const lead = await createAnuncianteLead(request, name);
    expect(lead.id).toBeGreaterThan(0);

    await openLeadInUI(page, name);

    await page.getByRole("button", { name: /Passar para o closer/i }).click();

    const handoffDialog = page
      .getByRole("dialog")
      .filter({ hasText: "Passar para o closer" });
    await expect(handoffDialog).toBeVisible();

    // Abre o seletor de closers.
    await handoffDialog.getByRole("combobox").click();

    // O closer aparece como opção; o interno sem a tag NÃO aparece.
    await expect(
      page.getByRole("option").filter({ hasText: closerLast }),
    ).toBeVisible();
    await expect(
      page.getByRole("option").filter({ hasText: nonCloserLast }),
    ).toHaveCount(0);

    // Seleciona o closer criado e confirma o handoff.
    await page.getByRole("option").filter({ hasText: closerLast }).click();
    await handoffDialog.getByRole("button", { name: /Confirmar handoff/i }).click();

    await expect(handoffDialog).toBeHidden();
    await expect(page.getByText("Convertido").first()).toBeVisible({
      timeout: 15_000,
    });

    // Asserções servidor: lead convertido + oportunidade atribuída ao closer.
    const updated = await trpcQuery<CreatedLead>(request, "lead.get", {
      id: lead.id,
    });
    expect(updated.stage).toBe("qualificado_handoff");
    expect(updated.convertedToType).toBe("opportunity");
    expect(updated.convertedToId).toBeTruthy();

    const opps = await trpcQuery<
      Array<{ id: number; leadId: number | null; stage: string; ownerId: string | null }>
    >(request, "opportunity.list");
    const opp = opps.find((o) => o.leadId === lead.id);
    expect(opp, "oportunidade vinculada ao lead deve existir").toBeTruthy();
    expect(opp!.id).toBe(updated.convertedToId);
    expect(opp!.stage).toBe("qualificada");
    // O handoff atribui a oportunidade ao closer escolhido (caminho de e-mail
    // depende do closer.email, que o fixture sempre define).
    expect(opp!.ownerId).toBe(closer.id);
  });

  test("a mutation recusa handoff para um interno sem a tag Closer", async ({
    page,
  }) => {
    const request = page.request;
    await devLoginAdmin(request);

    const stamp = `${Date.now()}-${Math.floor(Math.random() * 1e4)}`;

    const nonCloser = await devCreateInternalUser(request, {
      role: "comercial",
      isCloser: false,
      firstName: "E2E",
      lastName: `NaoCloser ${stamp}`,
    });
    createdUserIds.push(nonCloser.id);

    const name = `E2E Closer Reject ${stamp}`;
    const lead = await createAnuncianteLead(request, name);

    // A mutation deve recusar: usuário existe mas não tem a tag Closer.
    await expect(
      trpcMutation(request, "lead.handoffToCloser", {
        leadId: lead.id,
        closerId: nonCloser.id,
      }),
    ).rejects.toThrow(/tag Closer/i);

    // O lead permanece intocado (nenhuma oportunidade criada).
    const after = await trpcQuery<CreatedLead>(request, "lead.get", { id: lead.id });
    expect(after.stage).not.toBe("qualificado_handoff");
    expect(after.convertedToId).toBeFalsy();
  });

  test("a mutation recusa handoff para um closer inativo", async ({ page }) => {
    const request = page.request;
    await devLoginAdmin(request);

    const stamp = `${Date.now()}-${Math.floor(Math.random() * 1e4)}`;

    const inactiveCloser = await devCreateInternalUser(request, {
      role: "comercial",
      isCloser: true,
      isActive: false,
      firstName: "E2E",
      lastName: `CloserInativo ${stamp}`,
    });
    createdUserIds.push(inactiveCloser.id);

    const name = `E2E Closer Inativo ${stamp}`;
    const lead = await createAnuncianteLead(request, name);

    await expect(
      trpcMutation(request, "lead.handoffToCloser", {
        leadId: lead.id,
        closerId: inactiveCloser.id,
      }),
    ).rejects.toThrow(/inativo/i);

    // Inativo também não deve aparecer no seletor (listClosers filtra isActive).
    const closers = await trpcQuery<Array<{ id: string }>>(request, "lead.listClosers");
    expect(closers.some((u) => u.id === inactiveCloser.id)).toBe(false);
  });
});
