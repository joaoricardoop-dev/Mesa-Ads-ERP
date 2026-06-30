// Repasse VIP por LOCAL no DRE por fase (fonte única).
//
// Após a unificação "sala VIP = local" e a consolidação do catálogo digital num
// único produto DOOH (tipo `telas`, sem `vipProviderId`), o repasse VIP do DRE
// por fase NÃO pode mais sair de `products.vipProviderId` — senão zera para toda
// campanha digital. Estes testes provam que `calcPhaseFinancials`:
//   1. gera repasse VIP > 0 para item DOOH cujo local é sala VIP;
//   2. bate EXATAMENTE com `calcVipRepasseLocal` (mesma fonte que o
//      materializador de AP em payables.ts) — paridade tela vs AP;
//   3. respeita bruto/liquido por sala;
//   4. zera quando o local não é sala VIP (regra tela vs bolacha).

import { describe, it, expect } from "vitest";
import {
  calcPhaseFinancials,
  calcVipRepasseLocal,
  type PhaseItemLike,
  type PhaseCampaignContext,
  type CampaignLike,
} from "../calc";

const IRPJ_PCT = 6; // 6% (system_config global)

const campaignCtx: PhaseCampaignContext = {
  isBonificada: false,
  restaurantCommission: 0,
  sellerCommission: 10, // 10%
  agencyBvPercent: null,
  hasAgencyBv: false,
  partnerCommissionPercent: null,
  partnerGrossUpRate: null,
  globalBvGrossUpRate: null,
};

// Espelho do objeto sintético usado dentro de calcPhaseFinancials para invocar
// a fonte canônica por-local (cada item = fatia atribuída ao seu local).
function expectedLocalRepasse(
  share: number,
  vipRepassePercent: number,
  vipBillingMode: "bruto" | "liquido",
): number {
  const synthCampaign: CampaignLike = {
    id: 0,
    isBonificada: false,
    restaurantCommission: 0,
    sellerCommission: 10,
    productId: null,
    clientId: 0,
  };
  return calcVipRepasseLocal({
    attributedShare: share,
    invoice: { id: 0, campaignId: null, amount: share, issueDate: "1970-01-01" },
    campaign: synthCampaign,
    room: { vipRepassePercent, vipBillingMode },
    irpjRatePercent: IRPJ_PCT,
  });
}

describe("calcPhaseFinancials — repasse VIP por LOCAL (DOOH)", () => {
  it("DOOH em sala VIP gera repasse > 0 e bate com calcVipRepasseLocal (bruto)", () => {
    const items: PhaseItemLike[] = [
      {
        productTipo: "telas", // DOOH canônico
        quantity: 1,
        unitPrice: "10000.00",
        totalPrice: "10000.00",
        isVipRoom: true,
        vipRepassePercent: "30.00",
        vipBillingMode: "bruto",
      },
    ];
    const f = calcPhaseFinancials({ items, campaign: campaignCtx, overrides: {}, irpjRatePercent: IRPJ_PCT });
    expect(f.canalTipo).toBe("vip");
    expect(f.canalValor).toBeGreaterThan(0);
    // bruto: share × 30%
    expect(f.canalValor).toBeCloseTo(3000, 2);
    expect(f.canalValor).toBeCloseTo(expectedLocalRepasse(10000, 30, "bruto"), 2);
  });

  it("DOOH em sala VIP modo liquido deduz impostos + comissão vendedor", () => {
    const items: PhaseItemLike[] = [
      {
        productTipo: "telas",
        quantity: 1,
        unitPrice: "10000.00",
        totalPrice: "10000.00",
        isVipRoom: true,
        vipRepassePercent: "30.00",
        vipBillingMode: "liquido",
      },
    ];
    const f = calcPhaseFinancials({ items, campaign: campaignCtx, overrides: {}, irpjRatePercent: IRPJ_PCT });
    expect(f.canalValor).toBeGreaterThan(0);
    // liquido < bruto (deduz impostos + seller)
    expect(f.canalValor).toBeLessThan(3000);
    expect(f.canalValor).toBeCloseTo(expectedLocalRepasse(10000, 30, "liquido"), 2);
  });

  it("salas mistas (bruto + liquido) somam por-local e batem com a fonte canônica", () => {
    const items: PhaseItemLike[] = [
      {
        productTipo: "telas",
        quantity: 1,
        unitPrice: "6000.00",
        totalPrice: "6000.00",
        isVipRoom: true,
        vipRepassePercent: "30.00",
        vipBillingMode: "bruto",
      },
      {
        productTipo: "telas",
        quantity: 1,
        unitPrice: "4000.00",
        totalPrice: "4000.00",
        isVipRoom: true,
        vipRepassePercent: "25.00",
        vipBillingMode: "liquido",
      },
    ];
    const f = calcPhaseFinancials({ items, campaign: campaignCtx, overrides: {}, irpjRatePercent: IRPJ_PCT });
    const expected =
      expectedLocalRepasse(6000, 30, "bruto") + expectedLocalRepasse(4000, 25, "liquido");
    expect(f.canalValor).toBeCloseTo(expected, 2);
  });

  it("DOOH cujo local NÃO é sala VIP não gera repasse (tela vs bolacha)", () => {
    const items: PhaseItemLike[] = [
      {
        productTipo: "telas",
        quantity: 1,
        unitPrice: "10000.00",
        totalPrice: "10000.00",
        isVipRoom: false,
        vipRepassePercent: null,
        vipBillingMode: null,
      },
    ];
    const f = calcPhaseFinancials({ items, campaign: campaignCtx, overrides: {}, irpjRatePercent: IRPJ_PCT });
    expect(f.canalTipo).toBe("vip");
    expect(f.canalValor).toBe(0);
  });

  it("campanha bonificada zera o repasse VIP", () => {
    const items: PhaseItemLike[] = [
      {
        productTipo: "telas",
        quantity: 1,
        unitPrice: "10000.00",
        totalPrice: "10000.00",
        isVipRoom: true,
        vipRepassePercent: "30.00",
        vipBillingMode: "bruto",
      },
    ];
    const f = calcPhaseFinancials({
      items,
      campaign: { ...campaignCtx, isBonificada: true },
      overrides: {},
      irpjRatePercent: IRPJ_PCT,
    });
    expect(f.canalValor).toBe(0);
  });

  it("override manual de % do batch prevalece (taxa única sobre base líquida)", () => {
    const items: PhaseItemLike[] = [
      {
        productTipo: "telas",
        quantity: 1,
        unitPrice: "10000.00",
        totalPrice: "10000.00",
        isVipRoom: true,
        vipRepassePercent: "30.00",
        vipBillingMode: "bruto",
      },
    ];
    const f = calcPhaseFinancials({
      items,
      campaign: campaignCtx,
      overrides: { vipRepasseOverride: "50.00" },
      irpjRatePercent: IRPJ_PCT,
    });
    expect(f.effective.vipRepasse.source).toBe("override");
    expect(f.effective.vipRepasse.value).toBeCloseTo(50, 2);
    // override aplica 50% sobre base liquida (receita - impostos - sellerComm),
    // NÃO o bruto por-local — comportamento legado preservado.
    const impostos = f.impostos;
    const seller = 10000 * 0.1;
    const baseVip = 10000 - impostos - seller;
    expect(f.canalValor).toBeCloseTo(baseVip * 0.5, 2);
    // sanity: difere do caminho por-local (que daria 5000 em bruto 50%).
    expect(f.canalValor).not.toBeCloseTo(5000, 2);
  });
});
