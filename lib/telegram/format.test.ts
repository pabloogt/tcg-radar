import { describe, expect, it } from "vitest";
import type { AlertCandidate } from "@/lib/alerts/evaluate-alerts";
import { formatTelegramAlert } from "./format";

const candidate: AlertCandidate = { alertType: "price_drop", productId: "p", productName: "ETB Chaos Rising", tcg: "pokemon", language: "es", storeId: "s", storeName: "Pokemillon", listingId: "l", listingUrl: "https://example.com/listing", stockStatus: "in_stock", shippingCents: null, oldPriceCents: 6490, newPriceCents: 5090, targetPriceCents: null, totalAcquisitionCostCents: null, financialRecommendation: null, reason: "Precio reducido.", dedupeKey: "price_drop:l:5090" };

describe("Telegram formatter", () => {
  it("formats a concise Spanish price-drop message with unknown shipping", () => { const message = formatTelegramAlert(candidate); expect(message).toContain("BAJADA DE PRECIO"); expect(message).toContain("64,90 € → 50,90 €"); expect(message).toContain("Bajada: 21,57 %"); expect(message).toContain("Envío: Desconocido"); });
  it("formats target price details", () => { const message = formatTelegramAlert({ ...candidate, alertType: "target_price", targetPriceCents: 5000, newPriceCents: 4799 }); expect(message).toContain("Precio objetivo: 50,00 €"); expect(message).toContain("Precio actual: 47,99 €"); });
});
