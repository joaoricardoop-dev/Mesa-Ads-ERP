import { describe, expect, it, vi, beforeEach } from "vitest";

// ─── Mocks ──────────────────────────────────────────────────────────────────
// Geocode é a FONTE ÚNICA endereço→coordenadas (server/_core/geocode.ts).
// Aqui ela é stubada para não bater na Google Geocoding API (billing/flakiness),
// no mesmo espírito do `window.google.maps` FAKE de e2e/builder-locais.spec.ts.
const mocks = vi.hoisted(() => {
  const geocodeAddress = vi.fn();
  const insertReturning: { rows: unknown[] } = { rows: [] };
  const updateReturning: { rows: unknown[] } = { rows: [] };
  const updateSetPayloads: Record<string, unknown>[] = [];
  const fakeDb = {
    insert: vi.fn(() => ({
      values: vi.fn(() => ({
        returning: vi.fn(() => Promise.resolve(insertReturning.rows)),
      })),
    })),
    update: vi.fn(() => ({
      set: vi.fn((payload: Record<string, unknown>) => {
        updateSetPayloads.push(payload);
        return {
          where: vi.fn(() => ({
            returning: vi.fn(() => Promise.resolve(updateReturning.rows)),
          })),
        };
      }),
    })),
  };
  return { geocodeAddress, insertReturning, updateReturning, updateSetPayloads, fakeDb };
});

vi.mock("./_core/geocode", () => ({
  geocodeAddress: mocks.geocodeAddress,
  // Reusa a MESMA lógica de montagem do query da fonte única — não recria.
  buildGeocodeQuery: (parts: {
    address?: string | null;
    neighborhood?: string | null;
    city?: string | null;
    state?: string | null;
    cep?: string | null;
  }) =>
    [parts.address, parts.neighborhood, parts.city, parts.state, parts.cep, "Brasil"]
      .map((p) => (p ?? "").trim())
      .filter(Boolean)
      .join(", "),
}));

vi.mock("drizzle-orm/neon-serverless", () => ({
  drizzle: () => mocks.fakeDb,
}));

vi.mock("@neondatabase/serverless", () => ({
  Pool: class {
    constructor() {}
    on() {}
  },
  neonConfig: {},
}));

vi.mock("ws", () => ({ default: class {} }));

let createActiveRestaurant: typeof import("./db").createActiveRestaurant;
let autoGeocodeIfMissing: typeof import("./db").autoGeocodeIfMissing;

beforeEach(async () => {
  process.env.DATABASE_URL = "postgres://user:pass@localhost:5432/testdb";
  mocks.geocodeAddress.mockReset();
  mocks.fakeDb.insert.mockClear();
  mocks.fakeDb.update.mockClear();
  mocks.updateSetPayloads.length = 0;
  mocks.insertReturning.rows = [];
  mocks.updateReturning.rows = [];
  if (!createActiveRestaurant) {
    const db = await import("./db");
    createActiveRestaurant = db.createActiveRestaurant;
    autoGeocodeIfMissing = db.autoGeocodeIfMissing;
  }
});

// Local cadastrado SEM o AddressAutocomplete: endereço textual presente, mas
// lat/lng nulos. O builder/mapa só plota pin se houver coordenadas.
const plainAddressRow = {
  id: 42,
  name: "Bar sem picker",
  status: "active" as const,
  address: "Av. Paulista, 1000",
  neighborhood: "Bela Vista",
  city: "São Paulo",
  state: "SP",
  cep: "01310-100",
  lat: null,
  lng: null,
};

describe("autoGeocodeIfMissing — local criado sem o address picker", () => {
  it("popula lat/lng a partir do endereço quando estão ausentes", async () => {
    mocks.geocodeAddress.mockResolvedValue({
      lat: -23.5630,
      lng: -46.6543,
      formattedAddress: "Av. Paulista, 1000 - Bela Vista, São Paulo - SP",
    });
    mocks.updateReturning.rows = [
      { ...plainAddressRow, lat: "-23.563", lng: "-46.6543" },
    ];

    const result = await autoGeocodeIfMissing({ ...plainAddressRow });

    // A fonte única foi consultada com o endereço textual gravado.
    expect(mocks.geocodeAddress).toHaveBeenCalledTimes(1);
    expect(mocks.geocodeAddress).toHaveBeenCalledWith(
      "Av. Paulista, 1000, Bela Vista, São Paulo, SP, 01310-100, Brasil",
    );
    // O registro foi atualizado com as coordenadas recuperadas (vira pin).
    expect(mocks.fakeDb.update).toHaveBeenCalledTimes(1);
    expect(mocks.updateSetPayloads[0]).toMatchObject({
      lat: "-23.563",
      lng: "-46.6543",
    });
    expect(result?.lat).toBe("-23.563");
    expect(result?.lng).toBe("-46.6543");
  });

  it("não sobrescreve coordenadas já existentes (origem AddressAutocomplete)", async () => {
    const withCoords = {
      ...plainAddressRow,
      lat: "-23.1111",
      lng: "-46.2222",
    };

    const result = await autoGeocodeIfMissing({ ...withCoords });

    expect(mocks.geocodeAddress).not.toHaveBeenCalled();
    expect(mocks.fakeDb.update).not.toHaveBeenCalled();
    expect(result?.lat).toBe("-23.1111");
    expect(result?.lng).toBe("-46.2222");
  });

  it("não geocodifica locais inativos", async () => {
    const result = await autoGeocodeIfMissing({
      ...plainAddressRow,
      status: "inactive" as const,
    });
    expect(mocks.geocodeAddress).not.toHaveBeenCalled();
    expect(mocks.fakeDb.update).not.toHaveBeenCalled();
    expect(result?.lat).toBeNull();
  });

  it("não geocodifica quando não há endereço textual", async () => {
    const result = await autoGeocodeIfMissing({
      ...plainAddressRow,
      address: "",
    });
    expect(mocks.geocodeAddress).not.toHaveBeenCalled();
    expect(mocks.fakeDb.update).not.toHaveBeenCalled();
  });

  it("degrada com segurança quando o geocode falha (sem pin, mas sem quebrar)", async () => {
    mocks.geocodeAddress.mockRejectedValue(new Error("Geocoding HTTP 500"));
    const input = { ...plainAddressRow };
    const result = await autoGeocodeIfMissing(input);
    expect(mocks.fakeDb.update).not.toHaveBeenCalled();
    // Retorna o registro inalterado — o create/update nunca quebra por isso.
    expect(result?.lat).toBeNull();
    expect(result?.lng).toBeNull();
  });

  it("retorna inalterado quando o Google não acha o endereço (ZERO_RESULTS)", async () => {
    mocks.geocodeAddress.mockResolvedValue(null);
    const result = await autoGeocodeIfMissing({ ...plainAddressRow });
    expect(mocks.geocodeAddress).toHaveBeenCalledTimes(1);
    expect(mocks.fakeDb.update).not.toHaveBeenCalled();
    expect(result?.lat).toBeNull();
  });
});

describe("createActiveRestaurant — geocoda no cadastro sem o picker", () => {
  it("um local novo com endereço mas sem lat/lng acaba com coordenadas", async () => {
    // insert devolve o registro recém-criado SEM coordenadas (sem picker).
    mocks.insertReturning.rows = [{ ...plainAddressRow }];
    mocks.geocodeAddress.mockResolvedValue({
      lat: -23.563,
      lng: -46.6543,
      formattedAddress: "Av. Paulista, 1000",
    });
    mocks.updateReturning.rows = [
      { ...plainAddressRow, lat: "-23.563", lng: "-46.6543" },
    ];

    const created = await createActiveRestaurant({
      name: "Bar sem picker",
      address: "Av. Paulista, 1000",
      neighborhood: "Bela Vista",
      city: "São Paulo",
      state: "SP",
    } as Parameters<typeof createActiveRestaurant>[0]);

    expect(mocks.geocodeAddress).toHaveBeenCalledTimes(1);
    expect(created?.lat).toBe("-23.563");
    expect(created?.lng).toBe("-46.6543");
  });

  it("um local novo já com coordenadas mantém as originais", async () => {
    mocks.insertReturning.rows = [
      { ...plainAddressRow, lat: "-23.9999", lng: "-46.8888" },
    ];

    const created = await createActiveRestaurant({
      name: "Bar com picker",
      address: "Av. Paulista, 1000",
      lat: "-23.9999",
      lng: "-46.8888",
    } as Parameters<typeof createActiveRestaurant>[0]);

    expect(mocks.geocodeAddress).not.toHaveBeenCalled();
    expect(created?.lat).toBe("-23.9999");
    expect(created?.lng).toBe("-46.8888");
  });
});
