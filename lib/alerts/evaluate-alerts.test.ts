import { describe, expect, it } from "vitest";
import { evaluateAlertCandidates, type AlertContext } from "./evaluate-alerts";
import { calculateOpportunity } from "@/lib/finance/opportunity";

const base: AlertContext = { productId: "product", productName: "ETB Demo", tcg: "pokemon", language: "es", storeId: "store", storeName: "Pokemillon", listingId: "listing", listingUrl: "https://example.com/product", oldPriceCents: 6000, oldStockStatus: "in_stock", newPriceCents: 5000, shippingCents: 500, newStockStatus: "in_stock" };

describe("alert evaluation", () => {
  it("creates an alert for a 10 percent price decrease", () => expect(evaluateAlertCandidates({ ...base, oldPriceCents: 5000, newPriceCents: 4500 })[0]?.alertType).toBe("price_drop"));
  it("does not alert for a one-cent decrease", () => expect(evaluateAlertCandidates({ ...base, oldPriceCents: 5000, newPriceCents: 4999 })).toHaveLength(0));
  it("does not alert for a price increase", () => expect(evaluateAlertCandidates({ ...base, oldPriceCents: 5000, newPriceCents: 5100 })).toHaveLength(0));
  it("creates a back-in-stock alert only for out_of_stock to in_stock", () => {
    expect(evaluateAlertCandidates({ ...base, oldPriceCents: 5000, oldStockStatus: "out_of_stock", newStockStatus: "in_stock" })[0]?.alertType).toBe("back_in_stock");
    expect(evaluateAlertCandidates({ ...base, oldPriceCents: 5000, oldStockStatus: "in_stock", newStockStatus: "in_stock" })).toHaveLength(0);
    expect(evaluateAlertCandidates({ ...base, oldPriceCents: 5000, oldStockStatus: "in_stock", newStockStatus: "out_of_stock" })).toHaveLength(0);
  });
  it("alerts only when crossing a listing target from above", () => {
    expect(evaluateAlertCandidates({ ...base, oldPriceCents: 5100, newPriceCents: 4999, targetPriceCents: 5000 }).some((item) => item.alertType === "target_price")).toBe(true);
    expect(evaluateAlertCandidates({ ...base, oldPriceCents: 4900, newPriceCents: 4800, targetPriceCents: 5000 }).some((item) => item.alertType === "target_price")).toBe(false);
  });
  it("creates a financial candidate from the shared engine", () => { const evaluation = calculateOpportunity({ product_price_cents: 5000, purchase_shipping_cents: 500, purchase_fees_cents: 0, expected_sale_price_cents: 10000, sale_platform_fee_basis_points: 0, fixed_sale_fee_cents: 0, seller_shipping_cents: 0, packaging_cost_cents: 0, estimated_holding_months: 2, target_roi_basis_points: 2000 }); expect(evaluateAlertCandidates({ ...base, oldPriceCents: 5000, evaluation })[0]?.alertType).toBe("financial_opportunity"); });
  it("keeps non-financial alerts without inventing an acquisition total", () => { const candidates = evaluateAlertCandidates({ ...base, shippingCents: null, oldStockStatus: "out_of_stock", newStockStatus: "in_stock" }); expect(candidates.map((candidate) => candidate.alertType)).toEqual(["price_drop", "back_in_stock"]); expect(candidates.every((candidate) => candidate.totalAcquisitionCostCents === null)).toBe(true); });
});
