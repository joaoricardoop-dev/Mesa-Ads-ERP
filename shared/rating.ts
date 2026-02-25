import { RATING_CONFIG } from "./rating-config";

interface RestauranteRating {
  monthlyCustomers: number | null;
  tableCount: number | null;
  ticketMedio: number | string | null;
  avgStayMinutes: number | null;
  locationRating: number | null;
  venueType: number | null;
  digitalPresence: number | null;
}

interface RatingDetalhe {
  valor: number;
  pontos: number;
  peso: number;
}

export interface RatingResult {
  score: number;
  tier: string;
  multiplicador: number;
  cor: string;
  detalhamento: {
    fluxo: RatingDetalhe;
    ticket: RatingDetalhe;
    permanencia: RatingDetalhe;
    localizacao: RatingDetalhe;
    mesas: RatingDetalhe;
    perfil: RatingDetalhe;
    digital: RatingDetalhe;
  };
}

function converterParaPontos(valor: number, faixas: { max: number; pontos: number }[]): number {
  for (const faixa of faixas) {
    if (valor <= faixa.max) return faixa.pontos;
  }
  return 5;
}

export function temCamposRatingCompletos(restaurante: RestauranteRating): boolean {
  const ticket = typeof restaurante.ticketMedio === "string" ? parseFloat(restaurante.ticketMedio) : restaurante.ticketMedio;
  return (
    restaurante.monthlyCustomers != null && restaurante.monthlyCustomers > 0 &&
    restaurante.tableCount != null && restaurante.tableCount > 0 &&
    ticket != null && ticket > 0 &&
    restaurante.avgStayMinutes != null && restaurante.avgStayMinutes > 0 &&
    restaurante.locationRating != null && restaurante.locationRating >= 1 &&
    restaurante.venueType != null && restaurante.venueType >= 1 &&
    restaurante.digitalPresence != null && restaurante.digitalPresence >= 1
  );
}

export function calcularRating(restaurante: RestauranteRating): RatingResult {
  const { pesos, faixas, tiers } = RATING_CONFIG;

  const ticketVal = typeof restaurante.ticketMedio === "string" ? parseFloat(restaurante.ticketMedio) : (restaurante.ticketMedio || 0);

  const pontos = {
    fluxo: converterParaPontos(restaurante.monthlyCustomers || 0, faixas.fluxo),
    ticket: converterParaPontos(ticketVal, faixas.ticket),
    permanencia: converterParaPontos(restaurante.avgStayMinutes || 0, faixas.permanencia),
    localizacao: restaurante.locationRating || 1,
    mesas: converterParaPontos(restaurante.tableCount || 0, faixas.mesas),
    perfil: restaurante.venueType || 1,
    digital: restaurante.digitalPresence || 1,
  };

  const score = Math.round((
    (pontos.fluxo * pesos.fluxo) +
    (pontos.ticket * pesos.ticket) +
    (pontos.permanencia * pesos.permanencia) +
    (pontos.localizacao * pesos.localizacao) +
    (pontos.mesas * pesos.mesas) +
    (pontos.perfil * pesos.perfil) +
    (pontos.digital * pesos.digital)
  ) * 100) / 100;

  const tierInfo = tiers.find(t => score <= t.maxScore) || tiers[tiers.length - 1];

  return {
    score,
    tier: tierInfo.nome,
    multiplicador: tierInfo.multiplicador,
    cor: tierInfo.cor,
    detalhamento: {
      fluxo: { valor: restaurante.monthlyCustomers || 0, pontos: pontos.fluxo, peso: pesos.fluxo },
      ticket: { valor: ticketVal, pontos: pontos.ticket, peso: pesos.ticket },
      permanencia: { valor: restaurante.avgStayMinutes || 0, pontos: pontos.permanencia, peso: pesos.permanencia },
      localizacao: { valor: restaurante.locationRating || 1, pontos: pontos.localizacao, peso: pesos.localizacao },
      mesas: { valor: restaurante.tableCount || 0, pontos: pontos.mesas, peso: pesos.mesas },
      perfil: { valor: restaurante.venueType || 1, pontos: pontos.perfil, peso: pesos.perfil },
      digital: { valor: restaurante.digitalPresence || 1, pontos: pontos.digital, peso: pesos.digital },
    },
  };
}
