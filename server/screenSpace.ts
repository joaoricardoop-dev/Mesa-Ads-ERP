// ─── Materialização do Espaço de Mídia a partir do inventário de telas ───────
// Quando um local tem ≥1 tela ATIVA, os campos screen* de active_restaurants
// são DERIVADOS do inventário (fonte única: shared/screen-space.ts →
// deriveScreenSpace) e persistidos aqui — assim catálogo, cotação e portais
// continuam lendo as mesmas colunas de sempre, agora com uma única origem.
// Campos não deriváveis (pendências no inventário) viram NULL — nunca caem em
// silêncio nos valores manuais antigos. Task #417: sem telas ativas, os campos
// materializados são LIMPOS (screensCount=0, demais NULL) — não existe mais
// modo manual; o inventário é a única fonte do Espaço de Mídia.

import { eq } from "drizzle-orm";
import { telas, activeRestaurants } from "../drizzle/schema";
import { deriveScreenSpace, type ScreenSpaceDerivation } from "../shared/screen-space";

export async function materializeScreenSpace(
  db: any,
  restaurantId: number,
): Promise<ScreenSpaceDerivation | null> {
  const rows = await db
    .select({
      id: telas.id,
      nome: telas.nome,
      status: telas.status,
      loopDuration: telas.loopDuration,
      spotDuration: telas.spotDuration,
      insertionsPerWeek: telas.insertionsPerWeek,
      costPerInsertion: telas.costPerInsertion,
      impactsPerInsertion: telas.impactsPerInsertion,
      screenOperatingHours: telas.screenOperatingHours,
    })
    .from(telas)
    .where(eq(telas.restaurantId, restaurantId));

  const derived = deriveScreenSpace(rows);
  if (!derived) {
    // Sem telas ativas → limpa os campos materializados para o espaço não
    // continuar "precificado" com valores antigos em catálogo/cotações.
    await db
      .update(activeRestaurants)
      .set({
        screensCount: 0,
        screenOperatingHours: null,
        screenWeeklyHours: null,
        screenInsertionsPerHour: null,
        screenImpactsPerInsertion: null,
        screenCpm: null,
        screenExposureSec: null,
        updatedAt: new Date(),
      })
      .where(eq(activeRestaurants.id, restaurantId));
    return null;
  }

  // Exposição (s) por inserção do espaço = média simples do spotDuration das
  // telas ativas que o informam (campo informativo; não entra na precificação).
  const activeSpots = rows
    .filter((r: any) => r.status === "active" && r.spotDuration != null && Number(r.spotDuration) > 0)
    .map((r: any) => Number(r.spotDuration));
  const exposureSec =
    activeSpots.length > 0
      ? Math.round(activeSpots.reduce((a: number, b: number) => a + b, 0) / activeSpots.length)
      : null;

  await db
    .update(activeRestaurants)
    .set({
      screensCount: derived.screensCount,
      screenExposureSec: exposureSec,
      screenOperatingHours:
        derived.operatingHours.length > 0 ? JSON.stringify(derived.operatingHours) : null,
      screenWeeklyHours: derived.weeklyHours > 0 ? derived.weeklyHours.toFixed(2) : null,
      screenInsertionsPerHour:
        derived.insertionsPerHour != null ? Math.round(derived.insertionsPerHour) : null,
      screenImpactsPerInsertion:
        derived.impactsPerInsertion != null ? derived.impactsPerInsertion.toFixed(2) : null,
      screenCpm: derived.cpm != null ? derived.cpm.toFixed(2) : null,
      updatedAt: new Date(),
    })
    .where(eq(activeRestaurants.id, restaurantId));

  return derived;
}
