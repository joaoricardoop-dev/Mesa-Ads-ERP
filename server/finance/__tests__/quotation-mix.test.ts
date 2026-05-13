// Task #186 — Cobertura dos 4 cenários de cotação:
//   1. puro-single (1 produto padrão)
//   2. puro-multi (vários produtos padrão, sem custom)
//   3. puro-custom (só projeto sob medida)
//   4. misto (custom + itens padrão)
//
// Testamos as funções puras `computeQuotationCommissionMix` (alíquotas
// ponderadas gravadas no campaign em signOS/markWin) e `calcCustomVipRepasse`
// (auto-materialização da fatia custom-digital). Os materializadores
// downstream apenas aplicam `campaign.<rate> × invoice.amount` — então
// validar que a média ponderada bate com `standardSlice×stdRate +
// customSlice×customRate` cobre o resultado em AP.

import { describe, it, expect } from "vitest";
import {
  computeQuotationCommissionMix,
  calcCustomVipRepasse,
  calcRestaurantCommission,
  calcPartnerCommission,
  type CampaignLike,
  type InvoiceLike,
  type VipProviderLike,
  type PartnerLike,
} from "../calc";

const STD = {
  restaurantCommissionPercent: 20,
  sellerCommissionPercent: 10,
  agencyBvPercent: 20,
};

function buildInvoice(amount: number): InvoiceLike {
  return {
    id: 1,
    invoiceNumber: "NF-1",
    campaignId: 100,
    campaignPhaseId: null,
    amount: amount.toFixed(2),
    issRate: "0",
    issRetained: false,
    issueDate: "2026-05-01",
    paymentDate: "2026-05-15",
  };
}

function buildCampaign(overrides: Partial<CampaignLike> = {}): CampaignLike {
  return {
    id: 100,
    isBonificada: false,
    restaurantCommission: "20.00",
    sellerCommission: "10.00",
    productId: 1,
    partnerId: null,
    hasAgencyBv: true,
    agencyBvPercent: "20.00",
    quotationId: 50,
    clientId: 1,
    ...overrides,
  };
}

describe("computeQuotationCommissionMix — cenários de cotação", () => {
  it("Cenário 1 — puro-single: preserva alíquotas-padrão", () => {
    const mix = computeQuotationCommissionMix({
      totalValue: "10000.00",
      isCustomProduct: false,
      customFinalPrice: null,
      customRestaurantCommission: null,
      customSellerCommission: null,
      customPartnerCommission: null,
    }, STD);
    expect(mix.hasCustomSlice).toBe(false);
    expect(mix.restaurantCommission).toBe("20.00");
    expect(mix.sellerCommission).toBe("10.00");
    expect(mix.agencyBvPercent).toBe("20.00");
  });

  it("Cenário 2 — puro-multi: preserva alíquotas-padrão (mesmo agregado)", () => {
    const mix = computeQuotationCommissionMix({
      totalValue: "30000.00",
      isCustomProduct: false,
      customFinalPrice: null,
      customRestaurantCommission: null,
      customSellerCommission: null,
      customPartnerCommission: null,
    }, STD);
    expect(mix.hasCustomSlice).toBe(false);
    expect(mix.restaurantCommission).toBe("20.00");
  });

  it("Cenário 3 — puro-custom: alíquotas custom prevalecem (slice = 100%)", () => {
    const mix = computeQuotationCommissionMix({
      totalValue: "5000.00",
      isCustomProduct: true,
      customFinalPrice: "5000.00",
      customRestaurantCommission: "0.00",
      customSellerCommission: "5.00",
      customPartnerCommission: "15.00",
    }, STD);
    expect(mix.hasCustomSlice).toBe(true);
    expect(mix.restaurantCommission).toBe("0.00");
    expect(mix.sellerCommission).toBe("5.00");
    expect(mix.agencyBvPercent).toBe("15.00");
  });

  it("Cenário 4 — misto: alíquotas ponderadas por receita das fatias", () => {
    // standardSlice = 8000 (rate 20%), customSlice = 2000 (rate 0%)
    // weighted = (8000×20 + 2000×0) / 10000 = 16.00
    const mix = computeQuotationCommissionMix({
      totalValue: "10000.00",
      isCustomProduct: true,
      customFinalPrice: "2000.00",
      customRestaurantCommission: "0.00",
      customSellerCommission: "5.00",
      customPartnerCommission: "30.00",
    }, STD);
    expect(mix.hasCustomSlice).toBe(true);
    expect(mix.restaurantCommission).toBe("16.00");
    // seller: (8000×10 + 2000×5)/10000 = 9.00
    expect(mix.sellerCommission).toBe("9.00");
    // bv: (8000×20 + 2000×30)/10000 = 22.00
    expect(mix.agencyBvPercent).toBe("22.00");
  });

  it("Identidade do materializador — misto: campaign.rate × invoice.amount === Σ(slice×rate)", () => {
    const totalValue = 10000;
    const customFinal = 2000;
    const standard = totalValue - customFinal;
    const stdRate = 20, customRate = 0;
    const mix = computeQuotationCommissionMix({
      totalValue: totalValue.toFixed(2),
      isCustomProduct: true,
      customFinalPrice: customFinal.toFixed(2),
      customRestaurantCommission: customRate.toFixed(2),
      customSellerCommission: "0.00",
      customPartnerCommission: "0.00",
    }, { ...STD, restaurantCommissionPercent: stdRate });

    const campaign = buildCampaign({ restaurantCommission: mix.restaurantCommission });
    const invoice = buildInvoice(totalValue);
    const apAmount = calcRestaurantCommission(invoice, campaign, null);
    const expected = (standard * stdRate + customFinal * customRate) / 100;
    expect(apAmount).toBeCloseTo(expected, 2);
  });
});

describe("calcCustomVipRepasse — auto-materialização para custom-digital", () => {
  const provider: VipProviderLike = { id: 7, status: "active", repassePercent: "30.00", name: "VIP X" };

  it("retorna 0 quando cotação não é custom", () => {
    const r = calcCustomVipRepasse({
      quotation: { isCustomProduct: false, customFinalPrice: null, customVipProviderId: null, totalValue: "1000" },
      invoice: buildInvoice(1000),
      campaign: buildCampaign(),
      vipProvider: provider,
    });
    expect(r).toBe(0);
  });

  it("retorna 0 quando custom não tem vipProviderId", () => {
    const r = calcCustomVipRepasse({
      quotation: { isCustomProduct: true, customFinalPrice: "1000", customVipProviderId: null, totalValue: "1000" },
      invoice: buildInvoice(1000),
      campaign: buildCampaign(),
      vipProvider: provider,
    });
    expect(r).toBe(0);
  });

  it("retorna 0 quando provider está inativo", () => {
    const r = calcCustomVipRepasse({
      quotation: { isCustomProduct: true, customFinalPrice: "1000", customVipProviderId: 7, totalValue: "1000" },
      invoice: buildInvoice(1000),
      campaign: buildCampaign(),
      vipProvider: { ...provider, status: "inactive" },
    });
    expect(r).toBe(0);
  });

  it("Cenário 3 puro-custom-digital: invoice 100% = customSlice → repasse sobre base líquida", () => {
    const invoice = buildInvoice(5000);
    const r = calcCustomVipRepasse({
      quotation: {
        isCustomProduct: true,
        customFinalPrice: "5000",
        customVipProviderId: 7,
        totalValue: "5000",
        customSellerCommission: "5.00",
      },
      invoice,
      campaign: buildCampaign(),
      vipProvider: provider,
    });
    // share = 5000, taxes = 5000 × 6% (irpj) + 0 (pis/cofins zero) = 300
    // sellerComm = 5000 × 5% = 250
    // base = 5000 - 300 - 250 = 4450
    // repasse = 4450 × 30% = 1335.00
    expect(r).toBeCloseTo(1335.0, 2);
  });

  it("Cenário 4 misto-custom-digital: repasse calculado só sobre fatia custom", () => {
    // total 10000, custom 2000 → custom share da invoice = invoice × 0.2
    const invoice = buildInvoice(10000);
    const r = calcCustomVipRepasse({
      quotation: {
        isCustomProduct: true,
        customFinalPrice: "2000",
        customVipProviderId: 7,
        totalValue: "10000",
        customSellerCommission: "5.00",
      },
      invoice,
      campaign: buildCampaign(),
      vipProvider: provider,
    });
    // share = 10000 × 0.2 = 2000
    // taxes = 2000 × 6% = 120
    // sellerComm = 2000 × 5% = 100
    // base = 2000 - 120 - 100 = 1780
    // repasse = 1780 × 30% = 534.00
    expect(r).toBeCloseTo(534.0, 2);
  });

  it("é idempotente em forma: mesma entrada → mesma saída", () => {
    const args = {
      quotation: {
        isCustomProduct: true as const,
        customFinalPrice: "3000",
        customVipProviderId: 7,
        totalValue: "10000",
        customSellerCommission: "10.00",
      },
      invoice: buildInvoice(10000),
      campaign: buildCampaign(),
      vipProvider: provider,
    };
    expect(calcCustomVipRepasse(args)).toBe(calcCustomVipRepasse(args));
  });
});

describe("Bonificada anula tudo (regressão)", () => {
  it("computeQuotationCommissionMix não muda — mas campaign.isBonificada=true zera no insert", () => {
    // O zeramento real acontece no signOS/markWin (`isBonificada ? "0.00" : mix.x`).
    // Aqui apenas validamos que o helper continua devolvendo o ponderado.
    const mix = computeQuotationCommissionMix({
      totalValue: "10000",
      isCustomProduct: true,
      customFinalPrice: "5000",
      customRestaurantCommission: "0",
      customSellerCommission: "0",
      customPartnerCommission: "0",
    }, STD);
    expect(mix.hasCustomSlice).toBe(true);
    expect(mix.restaurantCommission).toBe("10.00"); // (5000×20 + 5000×0)/10000
  });

  it("calcCustomVipRepasse retorna 0 se campanha bonificada", () => {
    const r = calcCustomVipRepasse({
      quotation: { isCustomProduct: true, customFinalPrice: "1000", customVipProviderId: 7, totalValue: "1000" },
      invoice: buildInvoice(1000),
      campaign: buildCampaign({ isBonificada: true }),
      vipProvider: { id: 7, status: "active", repassePercent: "30.00", name: "VIP X" },
    });
    expect(r).toBe(0);
  });
});

describe("calcPartnerCommission integra com weightedRate (regressão BV)", () => {
  it("misto: BV ponderado aplicado sobre invoice cheia produz amount esperado", () => {
    // standard 8000 @ BV 20%, custom 2000 @ BV 30% → weighted 22%
    // base = invoice - taxes - restComm
    // taxes = 10000 × 6% = 600
    // restComm: weighted rest = (8000×20+2000×0)/10000 = 16% → 1600
    // base = 10000 - 600 - 1600 = 7800; bv = 7800 × 22% = 1716
    const partner: PartnerLike = { id: 1, name: "P", commissionPercent: "20.00" };
    const campaign = buildCampaign({
      restaurantCommission: "16.00",
      agencyBvPercent: "22.00",
      partnerId: 1,
    });
    const result = calcPartnerCommission(buildInvoice(10000), campaign, null, partner);
    expect(result.amount).toBeCloseTo(1716.0, 1);
    expect(result.ratePercent).toBeCloseTo(22, 1);
  });
});
