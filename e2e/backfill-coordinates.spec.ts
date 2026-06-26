import { test, expect } from "@playwright/test";
import { devLoginAdmin, trpcMutation, trpcQuery } from "./_finance-helpers";

// Task #347 — cobre a persistência de coordenadas + o backfill geocodificado.
//
// O fluxo normal de cadastro grava lat/lng escolhidos no AddressAutocomplete
// (fonte única no client). Locais legados podem existir SEM coordenadas, e o
// CatalogMap os filtra (nenhum pin). O backfill (activeRestaurant.backfillCoordinates,
// internalProcedure) recupera essas coordenadas a partir do endereço já
// cadastrado e grava em active_restaurants.lat/lng.
//
// Este teste prova, de ponta a ponta contra o servidor real:
//   1. um local ativo COM endereço mas SEM coordenadas é semeado (lat/lng NULL);
//   2. rodar o backfill geocodifica e grava lat/lng;
//   3. lat/lng deixam de ser null.
//
// A geocodificação é STUBADA no servidor (server/_core/geocode.ts) via a env
// var GEOCODE_STUB_LATLNG, honrada SOMENTE com DEV_FIXTURES=1 (setada no
// webServer do playwright.config.ts). Assim o teste é determinístico e NÃO bate
// na Google Geocoding API (sem rede/billing/flakiness).

// Mesmas coords do stub configurado em playwright.config.ts (GEOCODE_STUB_LATLNG).
const STUB_LAT = -23.55052;
const STUB_LNG = -46.633308;

type ActiveRestaurant = { id: number; lat: string | null; lng: string | null };
type BackfillResult = {
  candidates: number;
  geocoded: number;
  skipped: number;
  failed: number;
  failures: { id: number; name: string; reason: string }[];
};

test.describe("backfill de coordenadas (activeRestaurant.backfillCoordinates)", () => {
  test("geocodifica e persiste lat/lng de um local semeado sem coordenadas", async ({
    request,
  }) => {
    await devLoginAdmin(request);

    // (1) Semeia um local ativo com endereço conhecido, mas SEM lat/lng.
    const seedRes = await request.post("/api/dev-seed-location-without-coords", {
      data: {},
    });
    expect(
      seedRes.ok(),
      `dev-seed-location-without-coords falhou: ${seedRes.status()} ${await seedRes.text()}`,
    ).toBeTruthy();
    const { restaurantId } = (await seedRes.json()) as { restaurantId: number };
    expect(restaurantId).toBeGreaterThan(0);

    // Sanidade: recém-semeado, lat/lng devem ser null.
    const before = await trpcQuery<ActiveRestaurant>(request, "activeRestaurant.get", {
      id: restaurantId,
    });
    expect(before.lat, "lat deve começar null").toBeNull();
    expect(before.lng, "lng deve começar null").toBeNull();

    // (2) Roda o backfill (internalProcedure — admin autorizado). A geocodificação
    // é stubada no servidor (não bate na Google).
    const result = await trpcMutation<BackfillResult>(
      request,
      "activeRestaurant.backfillCoordinates",
    );
    expect(result.candidates, "deve haver ao menos 1 candidato").toBeGreaterThan(0);
    expect(result.geocoded, "ao menos o local semeado deve ser geocodificado").toBeGreaterThan(0);

    // (3) lat/lng deixam de ser null e batem com o stub determinístico.
    const after = await trpcQuery<ActiveRestaurant>(request, "activeRestaurant.get", {
      id: restaurantId,
    });
    expect(after.lat, "lat deve ser persistido após o backfill").not.toBeNull();
    expect(after.lng, "lng deve ser persistido após o backfill").not.toBeNull();
    expect(Number(after.lat)).toBeCloseTo(STUB_LAT, 4);
    expect(Number(after.lng)).toBeCloseTo(STUB_LNG, 4);
  });

  test("é idempotente: re-rodar não toca locais já com coordenadas", async ({ request }) => {
    await devLoginAdmin(request);

    const seedRes = await request.post("/api/dev-seed-location-without-coords", {
      data: {},
    });
    expect(seedRes.ok()).toBeTruthy();
    const { restaurantId } = (await seedRes.json()) as { restaurantId: number };

    // Primeira passada: geocodifica o local recém-semeado.
    await trpcMutation<BackfillResult>(request, "activeRestaurant.backfillCoordinates");
    const after = await trpcQuery<ActiveRestaurant>(request, "activeRestaurant.get", {
      id: restaurantId,
    });
    expect(after.lat).not.toBeNull();

    // Segunda passada: o local já tem coords, então não deve mais ser candidato.
    const second = await trpcMutation<BackfillResult>(
      request,
      "activeRestaurant.backfillCoordinates",
    );
    const stillCandidate = second.failures.some((f) => f.id === restaurantId);
    expect(stillCandidate, "local já geocodificado não deve reaparecer como falha").toBeFalsy();

    // E suas coordenadas permanecem inalteradas.
    const afterSecond = await trpcQuery<ActiveRestaurant>(request, "activeRestaurant.get", {
      id: restaurantId,
    });
    expect(afterSecond.lat).toBe(after.lat);
    expect(afterSecond.lng).toBe(after.lng);
  });
});
