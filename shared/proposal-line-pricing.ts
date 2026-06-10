/**
 * Fonte única de verdade para o preço por linha exibido nas propostas.
 *
 * O preço/un. e o total de cada item são "escalados" para que a soma das
 * linhas bata exatamente com o total-alvo da seção (subtotal de itens ou
 * total do contrato), embutindo o fator BV/comissão. Esta função centraliza
 * o cálculo do fator de escala e o arredondamento para os centavos fecharem,
 * eliminando recomputações divergentes em PDF e telas.
 */

export interface ProposalLineItemInput {
  /** Quantidade/volume da linha (usado para derivar o preço/un.). */
  volume: number;
  /** Preço unitário cru vindo do banco. */
  unitPrice: number;
  /** Total cru da linha vindo do banco. */
  totalPrice: number;
}

export interface ProposalLinePrice {
  volume: number;
  /** Preço unitário escalado, coerente com o total escalado. */
  unitPrice: number;
  /** Total da linha escalado e arredondado para centavos (soma = total-alvo). */
  totalPrice: number;
}

/**
 * Escala os preços por linha para que somem exatamente `targetTotal`.
 *
 * @param items lista de itens com `unitPrice`/`totalPrice` crus do banco.
 * @param targetTotal total-alvo da seção (ex.: subtotal de itens ou contrato).
 * @returns por item, `unitPrice` e `totalPrice` escalados; a soma dos
 *          `totalPrice` (em centavos) é igual a `targetTotal` arredondado.
 */
export function computeProposalLinePrices(
  items: ProposalLineItemInput[],
  targetTotal: number,
): ProposalLinePrice[] {
  const n = items.length;
  if (n === 0) return [];

  const rawTotal = items.reduce((s, i) => s + (Number(i.totalPrice) || 0), 0);
  const target = Number(targetTotal) || 0;
  const scale = rawTotal > 0 ? target / rawTotal : 1;

  // Escala em centavos e distribui o resíduo por maior-resto para fechar.
  const targetCents = Math.round(target * 100);
  const ideal = items.map((i) => (Number(i.totalPrice) || 0) * scale * 100);
  const cents = ideal.map((c) => Math.floor(c));
  let residual = targetCents - cents.reduce((s, c) => s + c, 0);

  // Índices ordenados por maior parte fracionária (para adicionar centavos)
  // e o inverso (para remover, caso o resíduo seja negativo).
  const byFracDesc = ideal
    .map((c, idx) => ({ idx, frac: c - Math.floor(c) }))
    .sort((a, b) => b.frac - a.frac)
    .map((e) => e.idx);

  let k = 0;
  while (residual > 0) {
    cents[byFracDesc[k % n]] += 1;
    residual -= 1;
    k += 1;
  }
  k = 0;
  while (residual < 0) {
    cents[byFracDesc[(n - 1 - (k % n) + n) % n]] -= 1;
    residual += 1;
    k += 1;
  }

  return items.map((i, idx) => {
    const totalPrice = cents[idx] / 100;
    const volume = Number(i.volume) || 0;
    const unitPrice = volume > 0 ? totalPrice / volume : (Number(i.unitPrice) || 0) * scale;
    return { volume, unitPrice, totalPrice };
  });
}
