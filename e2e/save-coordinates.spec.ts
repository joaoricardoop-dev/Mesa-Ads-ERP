import { test, expect } from "@playwright/test";
import { devLoginAdmin, trpcMutation, trpcQuery } from "./_finance-helpers";

// Task #354 — cobre o fluxo NORMAL de cadastro/edição: as coordenadas escolhidas
// no AddressAutocomplete (origem única no client) são enviadas ao servidor e
// PERSISTEM no banco. O backfill (geocodificação de endereços legados sem coords)
// já é coberto por e2e/backfill-coordinates.spec.ts; aqui validamos o caminho
// create/update onde lat/lng vêm no input e devem ser gravados verbatim.
//
// Este teste prova, de ponta a ponta contra o servidor real:
//   1. activeRestaurant.create COM lat/lng grava esses valores (não null, iguais);
//   2. o zod input ACEITA lat/lng (se removidos do schema, a mutation falharia);
//   3. activeRestaurant.update COM lat/lng atualiza os valores persistidos.
//
// As coordenadas usadas são DISTINTAS do stub de geocodificação
// (GEOCODE_STUB_LATLNG em playwright.config.ts, São Paulo). Assim, se o hook de
// auto-geocode sobrescrevesse as coords enviadas, o teste pegaria a divergência.

// Coords arbitrárias (Rio de Janeiro), claramente diferentes do stub de SP.
const CREATE_LAT = -22.906847;
const CREATE_LNG = -43.172896;
// Coords de update (Belo Horizonte), também distintas do stub.
const UPDATE_LAT = -19.916681;
const UPDATE_LNG = -43.934493;

type ActiveRestaurant = { id: number; lat: string | null; lng: string | null };

function baseLocationInput(suffix: string) {
  return {
    name: `E2E Coords ${suffix}`,
    address: "Av. Atlântica, 1702",
    neighborhood: "Copacabana",
    contactName: "Contato E2E",
    contactRole: "Gerente",
    whatsapp: "21999990000",
    tableCount: 10,
    seatCount: 40,
    monthlyCustomers: 3000,
  };
}

test.describe("persistência de coordenadas no create/update (activeRestaurant)", () => {
  test("create com lat/lng grava as coordenadas enviadas", async ({ request }) => {
    await devLoginAdmin(request);

    const created = await trpcMutation<ActiveRestaurant>(request, "activeRestaurant.create", {
      ...baseLocationInput(`create-${Date.now()}`),
      lat: String(CREATE_LAT),
      lng: String(CREATE_LNG),
    });
    expect(created.id).toBeGreaterThan(0);

    // Lê de volta do banco e confirma que as coords não são null e batem com o
    // que foi enviado (não foram sobrescritas pelo auto-geocode).
    const after = await trpcQuery<ActiveRestaurant>(request, "activeRestaurant.get", {
      id: created.id,
    });
    expect(after.lat, "lat deve persistir após o create").not.toBeNull();
    expect(after.lng, "lng deve persistir após o create").not.toBeNull();
    expect(Number(after.lat)).toBeCloseTo(CREATE_LAT, 5);
    expect(Number(after.lng)).toBeCloseTo(CREATE_LNG, 5);
  });

  test("update com lat/lng atualiza as coordenadas persistidas", async ({ request }) => {
    await devLoginAdmin(request);

    // Cria sem coords; o auto-geocode preenche via stub (SP). Em seguida o update
    // envia coords explícitas, que devem sobrescrever o valor do stub.
    const created = await trpcMutation<ActiveRestaurant>(request, "activeRestaurant.create", {
      ...baseLocationInput(`update-${Date.now()}`),
    });
    expect(created.id).toBeGreaterThan(0);

    const updated = await trpcMutation<ActiveRestaurant>(request, "activeRestaurant.update", {
      id: created.id,
      lat: String(UPDATE_LAT),
      lng: String(UPDATE_LNG),
    });
    expect(updated.id).toBe(created.id);

    const after = await trpcQuery<ActiveRestaurant>(request, "activeRestaurant.get", {
      id: created.id,
    });
    expect(after.lat, "lat deve persistir após o update").not.toBeNull();
    expect(after.lng, "lng deve persistir após o update").not.toBeNull();
    expect(Number(after.lat)).toBeCloseTo(UPDATE_LAT, 5);
    expect(Number(after.lng)).toBeCloseTo(UPDATE_LNG, 5);
  });
});
