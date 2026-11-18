import { describe, expect, it } from "vitest";
import { calculateOpportunity } from "@/lib/finance/opportunity";
import { evaluateAlertCandidates, isAlertableSealedProductType, type AlertContext } from "./evaluate-alerts";

const base: AlertContext = {
  productId: "product",
  productName: "ETB Demo",
  productType: "elite_trainer_box",
  tcg: "pokemon",
  language: "es",
  storeId: "store",
  storeName: "Pokemillon",
  listingId: "listing",
  listingUrl: "https://example.com/product",
  oldPriceCents: 6000,
  oldStockStatus: "in_stock",
  newPriceCents: 5000,
  shippingCents: 500,
  newStockStatus: "in_stock",
};

const strongBuy = calculateOpportunity({
  product_price_cents: 5000,
  purchase_shipping_cents: 500,
  purchase_fees_cents: 0,
  expected_sale_price_cents: 10000,
  sale_platform_fee_basis_points: 0,
  fixed_sale_fee_cents: 0,
  seller_shipping_cents: 0,
  packaging_cost_cents: 0,
  estimated_holding_months: 2,
  target_roi_basis_points: 2000,
});

describe("alert evaluation", () => {
  it("creates an alert for a 10 percent in-stock price decrease", () => {
    expect(evaluateAlertCandidates({ ...base, oldPriceCents: 5000, newPriceCents: 4500 })[0]?.alertType).toBe("price_drop");
  });

  it("does not alert for a one-cent decrease or a price increase", () => {
    expect(evaluateAlertCandidates({ ...base, oldPriceCents: 5000, newPriceCents: 4999 })).toHaveLength(0);
    expect(evaluateAlertCandidates({ ...base, oldPriceCents: 5000, newPriceCents: 5100 })).toHaveLength(0);
  });

  it("creates a deterministic new-low candidate instead of a duplicate price-drop message", () => {
    const context = { ...base, newPriceLow: { periodDays: 30 as const, previousMinimumCents: 5_490 } };
    const first = evaluateAlertCandidates(context);
    const repeated = evaluateAlertCandidates(context);
    expect(first).toHaveLength(1);
    expect(first[0]).toMatchObject({ alertType: "new_price_low", previousLowCents: 5_490, dedupeKey: "price_drop:listing:5000" });
    expect(repeated[0]?.dedupeKey).toBe(first[0]?.dedupeKey);
  });

  it("does not create an actionable price drop while out of stock or unknown", () => {
    expect(evaluateAlertCandidates({ ...base, newStockStatus: "out_of_stock" })).toHaveLength(0);
    expect(evaluateAlertCandidates({ ...base, newStockStatus: "unknown" })).toHaveLength(0);
  });

  it("creates a back-in-stock alert only for out_of_stock to in_stock", () => {
    expect(evaluateAlertCandidates({ ...base, oldPriceCents: 5000, oldStockStatus: "out_of_stock", newStockStatus: "in_stock" })[0]?.alertType).toBe("back_in_stock");
    expect(evaluateAlertCandidates({ ...base, oldPriceCents: 5000, oldStockStatus: "in_stock", newStockStatus: "in_stock" })).toHaveLength(0);
    expect(evaluateAlertCandidates({ ...base, oldPriceCents: 5000, oldStockStatus: "in_stock", newStockStatus: "out_of_stock" })).toHaveLength(0);
  });

  it("allows a target crossing only when in stock or preorder", () => {
    expect(evaluateAlertCandidates({ ...base, oldPriceCents: 5100, newPriceCents: 4999, targetPriceCents: 5000 }).some((item) => item.alertType === "target_price")).toBe(true);
    expect(evaluateAlertCandidates({ ...base, oldPriceCents: 5100, newPriceCents: 4999, targetPriceCents: 5000, newStockStatus: "preorder" }).some((item) => item.alertType === "target_price")).toBe(true);
    expect(evaluateAlertCandidates({ ...base, oldPriceCents: 5100, newPriceCents: 4999, targetPriceCents: 5000, newStockStatus: "out_of_stock" })).toHaveLength(0);
    expect(evaluateAlertCandidates({ ...base, oldPriceCents: 4900, newPriceCents: 4800, targetPriceCents: 5000 })).toHaveLength(0);
  });

  it("allows financial opportunities only when in stock or preorder", () => {
    expect(evaluateAlertCandidates({ ...base, oldPriceCents: 5000, newPriceCents: 5000, evaluation: strongBuy })[0]?.alertType).toBe("financial_opportunity");
    expect(evaluateAlertCandidates({ ...base, oldPriceCents: 5000, newPriceCents: 5000, newStockStatus: "preorder", evaluation: strongBuy })[0]?.alertType).toBe("financial_opportunity");
    expect(evaluateAlertCandidates({ ...base, oldPriceCents: 5000, newPriceCents: 5000, newStockStatus: "out_of_stock", evaluation: strongBuy })).toHaveLength(0);
    expect(evaluateAlertCandidates({ ...base, oldPriceCents: 5000, newPriceCents: 5000, newStockStatus: "unknown", evaluation: strongBuy })).toHaveLength(0);
  });

  it("creates a new-product alert only for a new purchasable sealed listing", () => {
    expect(evaluateAlertCandidates({ ...base, oldPriceCents: null, oldStockStatus: null, isNewListing: true })[0]).toMatchObject({ alertType: "new_product", dedupeKey: "new_product:listing" });
    expect(evaluateAlertCandidates({ ...base, oldPriceCents: null, oldStockStatus: null, isNewListing: true, newStockStatus: "preorder" })[0]?.alertType).toBe("new_product");
    expect(evaluateAlertCandidates({ ...base, oldPriceCents: null, oldStockStatus: null, isNewListing: true, newStockStatus: "out_of_stock" })).toHaveLength(0);
    expect(evaluateAlertCandidates({ ...base, oldPriceCents: null, oldStockStatus: null, isNewListing: true, newStockStatus: "unknown" })).toHaveLength(0);
  });

  it("rejects irrelevant and ambiguous product types from new-product alerts", () => {
    for (const productType of ["accessory", "single", "mystery_box", "sealed_case", "ETB"]) {
      expect(evaluateAlertCandidates({ ...base, productType, oldPriceCents: null, oldStockStatus: null, isNewListing: true })).toHaveLength(0);
    }
    expect(isAlertableSealedProductType("sealed_case_10_etb")).toBe(true);
    expect(isAlertableSealedProductType("sealed_case_6_booster_box")).toBe(true);
  });

  it("combines restock and target satisfaction into one candidate", () => {
    const candidates = evaluateAlertCandidates({ ...base, oldStockStatus: "out_of_stock", oldPriceCents: 4900, newPriceCents: 4900, targetPriceCents: 5000 });
    expect(candidates).toHaveLength(1);
    expect(candidates[0]).toMatchObject({ alertType: "back_in_stock", targetPriceCents: 5000 });
  });

  it("combines restock and financial opportunity into one candidate", () => {
    const candidates = evaluateAlertCandidates({ ...base, oldStockStatus: "out_of_stock", oldPriceCents: 5000, newPriceCents: 5000, evaluation: strongBuy });
    expect(candidates).toHaveLength(1);
    expect(candidates[0]).toMatchObject({ alertType: "back_in_stock", financialRecommendation: "STRONG_BUY" });
  });

  it("keeps a restock alert with unknown shipping without inventing acquisition cost", () => {
    const candidates = evaluateAlertCandidates({ ...base, oldPriceCents: 5000, shippingCents: null, oldStockStatus: "out_of_stock", newStockStatus: "in_stock" });
    expect(candidates).toHaveLength(1);
    expect(candidates[0]).toMatchObject({ alertType: "back_in_stock", totalAcquisitionCostCents: null });
  });
});
