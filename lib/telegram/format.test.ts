import { describe, expect, it } from "vitest";
import type { AlertCandidate } from "@/lib/alerts/evaluate-alerts";
import { formatTelegramAlert } from "./format";

const candidate: AlertCandidate = {
  alertType: "price_drop",
  productId: "p",
  productName: "ETB Chaos Rising",
  tcg: "pokemon",
  language: "es",
  storeId: "s",
  storeName: "Pokemillon",
  listingId: "l",
  listingUrl: "https://example.com/listing",
  stockStatus: "in_stock",
  shippingCents: null,
  oldPriceCents: 6490,
  newPriceCents: 5090,
  targetPriceCents: null,
  totalAcquisitionCostCents: null,
  financialRecommendation: null,
  reason: "Precio reducido.",
  dedupeKey: "price_drop:l:5090",
};

describe("Telegram formatter", () => {
  it("formats a concise Spanish price-drop message with unknown shipping", () => {
    const message = formatTelegramAlert(candidate);
    expect(message).toContain("BAJADA DE PRECIO");
    expect(message).toContain("64,90 € → 50,90 €");
    expect(message).toContain("Bajada: 21,57 %");
    expect(message).toContain("Envío: Desconocido");
  });

  it("formats a new in-stock product", () => {
    const message = formatTelegramAlert({ ...candidate, alertType: "new_product", oldPriceCents: null, newPriceCents: 5990, dedupeKey: "new_product:l" });
    expect(message).toContain("🆕 NUEVO PRODUCTO");
    expect(message).toContain("59,90 €");
    expect(message).toContain("Stock: Disponible");
  });

  it("labels preorder opportunities clearly", () => {
    const message = formatTelegramAlert({ ...candidate, alertType: "financial_opportunity", stockStatus: "preorder", financialRecommendation: "STRONG_BUY" });
    expect(message).toContain("OPORTUNIDAD FINANCIERA");
    expect(message).toContain("Stock: PREVENTA");
  });

  it("formats target price details with stock", () => {
    const message = formatTelegramAlert({ ...candidate, alertType: "target_price", targetPriceCents: 5000, newPriceCents: 4799 });
    expect(message).toContain("Precio objetivo: 50,00 €");
    expect(message).toContain("Precio actual: 47,99 €");
    expect(message).toContain("Stock: Disponible");
  });

  it("formats restock plus target as one combined opportunity", () => {
    const message = formatTelegramAlert({ ...candidate, alertType: "back_in_stock", oldPriceCents: 4990, newPriceCents: 4990, targetPriceCents: 5500, dedupeKey: "back_in_stock:l:out_of_stock:in_stock:4990" });
    expect(message).toContain("REPOSICIÓN + OPORTUNIDAD");
    expect(message).toContain("Ha vuelto a estar disponible.");
    expect(message).toContain("Precio objetivo: 55,00 €");
  });

  it("formats restock plus financial recommendation as one combined opportunity", () => {
    const message = formatTelegramAlert({ ...candidate, alertType: "back_in_stock", financialRecommendation: "BUY", dedupeKey: "back_in_stock:l:out_of_stock:in_stock:5090" });
    expect(message).toContain("REPOSICIÓN + OPORTUNIDAD");
    expect(message).toContain("Recomendación financiera: BUY");
  });

  it("formats a market deal without calling it a profitable flip", () => {
    const message = formatTelegramAlert({ ...candidate, alertType: "deal_bargain", dealClassification: "CHOLLO", marketReferenceCents: 6_190, marketDifferenceBps: 1_777, comparisonBasis: "BASE_PRICE", referenceConfidence: "MEDIUM", newPriceCents: 5_090, dedupeKey: "deal:l:CHOLLO:cycle" });
    expect(message).toContain("CHOLLO DETECTADO");
    expect(message).toContain("Referencia de mercado: 61,90 €");
    expect(message).toContain("Diferencia: -17,77 %");
    expect(message).toContain("Confianza: Media");
    expect(message).not.toContain("rentable");
  });
});
