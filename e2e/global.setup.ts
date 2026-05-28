import { test as setup, expect } from "@playwright/test";
import path from "node:path";
import fs from "node:fs";
import { ANUNCIANTE_AUTH_FILE } from "./_auth-paths";

// Aquece a aplicação e prepara um storageState com o cookie `dev_user_id`
// já setado pra um anunciante de teste. Roda uma única vez antes de toda
// a suite (configurado como projeto `setup` no playwright.config.ts) e
// elimina a dependência de bootstrap do Clerk SDK no caminho crítico de
// cada spec autenticado — endereça o cold-start de cloud build CI (Task
// #179) que vinha bloqueando o pre-deploy.
setup("authenticate as anunciante", async ({ request }) => {
  fs.mkdirSync(path.dirname(ANUNCIANTE_AUTH_FILE), { recursive: true });

  // Aquecimento da rota raiz: absorve a primeira compilação Vite antes
  // de qualquer spec. O timeout é generoso pra cobrir cold-start do
  // cloud builder (cr-2-4, 2 vCPU). Falha de warm-up não derruba o
  // setup — o pior caso é que o primeiro spec paga o custo.
  try {
    await request.get("/", { timeout: 120_000 });
  } catch (err) {
    console.warn("[e2e setup] warm-up GET / falhou (não-fatal):", err);
  }

  const ensureRes = await request.post("/api/dev-ensure-anunciante", { data: {} });
  expect(
    ensureRes.ok(),
    `dev-ensure-anunciante falhou: ${ensureRes.status()} ${await ensureRes.text()}`,
  ).toBeTruthy();
  const { user } = (await ensureRes.json()) as {
    user: { id: string; clientId: number | null };
    created: boolean;
  };
  expect(user?.id, "dev-ensure-anunciante deve devolver user.id").toBeTruthy();
  expect(user?.clientId, "anunciante de teste deve ter clientId").toBeTruthy();

  const loginRes = await request.post("/api/dev-login", { data: { userId: user.id } });
  expect(
    loginRes.ok(),
    `dev-login falhou para ${user.id}: ${loginRes.status()} ${await loginRes.text()}`,
  ).toBeTruthy();

  // Garante ≥1 active_restaurant no banco fresh (Task #210). O spec
  // builder-locais navega como anunciante e espera ver pelo menos 1
  // card em /montar-campanha; sem seed, listAvailableLocations devolve
  // vazio e o teste falha por locator-not-found.
  const restRes = await request.post("/api/dev-ensure-restaurante", { data: {} });
  if (!restRes.ok()) {
    console.warn(
      `[e2e setup] dev-ensure-restaurante falhou (não-fatal p/ specs não-builder): ${restRes.status()} ${await restRes.text()}`,
    );
  }

  await request.storageState({ path: ANUNCIANTE_AUTH_FILE });
});
