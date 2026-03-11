export const RATING_CONFIG = {
  pesos: {
    fluxo: 0.25,
    ticket: 0.20,
    localizacao: 0.20,
    mesas: 0.10,
    perfil: 0.20,
    digital: 0.05,
  },

  faixas: {
    fluxo: [
      { max: 2000, pontos: 1 },
      { max: 5000, pontos: 2 },
      { max: 10000, pontos: 3 },
      { max: 20000, pontos: 4 },
      { max: Infinity, pontos: 5 },
    ],
    ticket: [
      { max: 30, pontos: 1 },
      { max: 60, pontos: 2 },
      { max: 100, pontos: 3 },
      { max: 180, pontos: 4 },
      { max: Infinity, pontos: 5 },
    ],
    mesas: [
      { max: 10, pontos: 1 },
      { max: 25, pontos: 2 },
      { max: 50, pontos: 3 },
      { max: 80, pontos: 4 },
      { max: Infinity, pontos: 5 },
    ],
  },

  tiers: [
    { maxScore: 2.00, nome: "bronze" as const, cor: "#CD7F32" },
    { maxScore: 3.00, nome: "prata" as const, cor: "#C0C0C0" },
    { maxScore: 4.00, nome: "ouro" as const, cor: "#FFD700" },
    { maxScore: 5.00, nome: "diamante" as const, cor: "#4169E1" },
  ],
};

export function calcularMultiplicador(score: number): number {
  if (score <= 2.0) return 1.00;
  return Math.round(Math.min(2.00, 1.0 + (score - 2.0) / 3.0) * 100) / 100;
}

export const TIER_COLORS: Record<string, string> = {
  bronze: "#CD7F32",
  prata: "#C0C0C0",
  ouro: "#FFD700",
  diamante: "#4169E1",
};

export const TIER_LABELS: Record<string, string> = {
  bronze: "Bronze",
  prata: "Prata",
  ouro: "Ouro",
  diamante: "Diamante",
};

export const LOCATION_RATING_LABELS: Record<number, string> = {
  1: "Periferia / Baixo fluxo de pedestres",
  2: "Bairro residencial de classe média",
  3: "Zona comercial ativa / Avenida movimentada",
  4: "Bairro nobre",
  5: "Ponto turístico / Premium (Ponta Negra, orla, Largo do São Sebastião, Shoppings)",
};

export const VENUE_TYPE_LABELS: Record<number, string> = {
  1: "Lanchonete / Fast food",
  2: "Bar popular / Boteco",
  3: "Restaurante casual",
  4: "Gastropub / Bar temático / Cervejaria artesanal",
  5: "Fine dining / Rooftop / Lounge",
  6: "Sala VIP",
};

export const DIGITAL_PRESENCE_LABELS: Record<number, string> = {
  1: "Sem redes sociais ou inativo",
  2: "Redes sociais com pouca atividade",
  3: "Ativo nas redes, até 5.000 seguidores",
  4: "Engajado, 5.000 a 20.000 seguidores",
  5: "Influente, 20.000+ seguidores ou perfil verificado",
};

export const PRIMARY_DRINK_LABELS: Record<string, string> = {
  cerveja: "Cerveja / Chopp",
  drinks: "Drinks / Coquetéis",
  vinho: "Vinho",
  nao_alcoolico: "Sucos / Não alcoólicos",
  variado: "Variado / Sem predominância",
};

export const RATING_DIMENSION_LABELS: Record<string, string> = {
  fluxo: "Fluxo de bebidas",
  ticket: "Ticket médio",
  localizacao: "Localização",
  mesas: "Mesas",
  perfil: "Perfil",
  digital: "Digital",
};
