import { test, expect, type Page } from "@playwright/test";

// Cobre a busca de endereço com autocomplete (AddressAutocomplete.tsx) na tela
// pública de cadastro de local (/locais) — escolhida por NÃO exigir auth.
//
// O componente depende da Places API (New) do Google, carregada via
// `loadGoogleMaps()` + `window.google.maps.importLibrary("places")`. Não
// queremos (nem podemos) bater na API real no e2e: sem chave válida ela
// falharia, e mesmo com chave seria flaky/billável. Em vez disso, pré-injetamos
// um `window.google.maps` fake via `addInitScript` ANTES de qualquer script da
// página rodar. Como `loadGoogleMaps()` retorna imediatamente quando
// `window.google?.maps` já existe, o script real nunca é carregado e o
// componente consome nossas respostas mockadas:
//   importLibrary("places") -> { AutocompleteSuggestion, AutocompleteSessionToken }
//   AutocompleteSuggestion.fetchAutocompleteSuggestions() -> 1 sugestão
//   prediction.toPlace().fetchFields() -> addressComponents + location
// Assim validamos o caminho real do componente (debounce, dropdown, parsing dos
// address_components e preenchimento dos campos separados).

const MOCK = {
  street: "Avenida Paulista",
  number: "1578",
  neighborhood: "Bela Vista",
  city: "São Paulo",
  stateShort: "SP",
  cep: "01310-200",
  lat: -23.5614,
  lng: -46.6559,
  formatted: "Av. Paulista, 1578 - Bela Vista, São Paulo - SP, 01310-200, Brasil",
};

async function installGoogleMapsMock(page: Page) {
  await page.addInitScript((mock) => {
    const addressComponents = [
      { types: ["route"], longText: mock.street, shortText: mock.street },
      { types: ["street_number"], longText: mock.number, shortText: mock.number },
      {
        types: ["sublocality_level_1", "sublocality"],
        longText: mock.neighborhood,
        shortText: mock.neighborhood,
      },
      {
        types: ["administrative_area_level_2", "political"],
        longText: mock.city,
        shortText: mock.city,
      },
      {
        types: ["administrative_area_level_1", "political"],
        longText: "São Paulo",
        shortText: mock.stateShort,
      },
      { types: ["postal_code"], longText: mock.cep, shortText: mock.cep },
      { types: ["country", "political"], longText: "Brasil", shortText: "BR" },
    ];

    const place = {
      addressComponents,
      location: { lat: () => mock.lat, lng: () => mock.lng },
      formattedAddress: mock.formatted,
      // O componente chama fetchFields antes de ler os campos acima.
      fetchFields: async () => {},
    };

    const prediction = {
      placeId: "fake-place-paulista-1578",
      text: { text: `${mock.street}, ${mock.number}` },
      mainText: { text: `${mock.street}, ${mock.number}` },
      secondaryText: { text: `${mock.neighborhood}, ${mock.city} - ${mock.stateShort}` },
      toPlace: () => place,
    };

    class AutocompleteSessionToken {}
    const AutocompleteSuggestion = {
      fetchAutocompleteSuggestions: async () => ({
        suggestions: [{ placePrediction: prediction }],
      }),
    };

    // `loadGoogleMaps()` faz `if (window.google?.maps) return` — então definir
    // isto curto-circuita o carregamento do script real do Google.
    (window as unknown as { google: unknown }).google = {
      maps: {
        importLibrary: async (name: string) => {
          if (name === "places") return { AutocompleteSuggestion, AutocompleteSessionToken };
          return {};
        },
      },
    };
  }, MOCK);
}

test.describe("AddressAutocomplete — cadastro público de local (/locais)", () => {
  test("escolher uma sugestão preenche logradouro, número, bairro, cidade, UF e CEP", async ({
    page,
  }) => {
    await installGoogleMapsMock(page);
    await page.goto("/locais");

    // O passo 0 do onboarding (dados do estabelecimento) já vem renderizado.
    const search = page.getByTestId("input-address-search");
    await expect(search).toBeVisible();

    // Campos separados começam vazios.
    const logradouro = page.getByPlaceholder("Rua, Av...");
    const numero = page.getByPlaceholder("123");
    const bairro = page.getByPlaceholder("Bairro");
    const cidade = page.getByPlaceholder("Cidade");
    const cep = page.getByPlaceholder("00000-000");
    await expect(logradouro).toHaveValue("");
    await expect(numero).toHaveValue("");

    // Digitar dispara o fetch (debounce de 250ms) e abre o dropdown.
    await search.fill("Avenida Paulista");
    const list = page.getByTestId("address-autocomplete-list");
    await expect(list).toBeVisible();

    const suggestion = page.getByTestId("address-suggestion-0");
    await expect(suggestion).toBeVisible();
    await expect(suggestion).toContainText("Avenida Paulista");

    // Escolher a sugestão -> toPlace().fetchFields() -> parsing -> onSelect.
    await suggestion.click();

    // Dropdown fecha e os campos separados são preenchidos a partir do parsing.
    await expect(list).toBeHidden();
    await expect(logradouro).toHaveValue(MOCK.street);
    await expect(numero).toHaveValue(MOCK.number);
    await expect(bairro).toHaveValue(MOCK.neighborhood);
    await expect(cidade).toHaveValue(MOCK.city);
    await expect(cep).toHaveValue(MOCK.cep);

    // UF é um Select (shadcn) — o trigger passa a exibir a sigla curta.
    await expect(page.getByText(MOCK.stateShort, { exact: true })).toBeVisible();

    // O próprio input de busca reflete o endereço formatado escolhido.
    await expect(search).toHaveValue(MOCK.formatted);
  });

  test("seleção via teclado (ArrowDown + Enter) também preenche os campos", async ({ page }) => {
    await installGoogleMapsMock(page);
    await page.goto("/locais");

    const search = page.getByTestId("input-address-search");
    await expect(search).toBeVisible();

    await search.fill("Avenida Paulista");
    await expect(page.getByTestId("address-autocomplete-list")).toBeVisible();

    await search.press("ArrowDown");
    await search.press("Enter");

    await expect(page.getByPlaceholder("Rua, Av...")).toHaveValue(MOCK.street);
    await expect(page.getByPlaceholder("123")).toHaveValue(MOCK.number);
    await expect(page.getByPlaceholder("Bairro")).toHaveValue(MOCK.neighborhood);
  });
});
