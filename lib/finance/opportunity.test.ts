import { describe, expect, it } from "vitest";
import { calculateOpportunity, classifyHoldingHorizon, type OpportunityInput } from "./opportunity";

const base: OpportunityInput = { product_price_cents: 5_000, purchase_shipping_cents: 0, purchase_fees_cents: 0, expected_sale_price_cents: 10_000, sale_platform_fee_basis_points: 0, fixed_sale_fee_cents: 0, seller_shipping_cents: 0, packaging_cost_cents: 0, estimated_holding_months: 2, target_roi_basis_points: 2_000 };
const calculate = (changes: Partial<OpportunityInput> = {}) => calculateOpportunity({ ...base, ...changes });

describe("calculateOpportunity", () => {
  it("calculates a profitable sale", () => expect(calculate().net_profit_cents).toBe(5_000));
  it("handles a loss", () => expect(calculate({ expected_sale_price_cents: 4_000 }).net_profit_cents).toBe(-1_000));
  it("handles zero fees", () => expect(calculate().total_selling_costs_cents).toBe(0));
  it("rounds a percentage marketplace fee to nearest cent", () => expect(calculate({ expected_sale_price_cents: 9_999, sale_platform_fee_basis_points: 1_000 }).marketplace_fee_cents).toBe(1_000));
  it("includes a fixed sale fee", () => expect(calculate({ fixed_sale_fee_cents: 125 }).total_selling_costs_cents).toBe(125));
  it("includes purchase and seller shipping", () => { const result = calculate({ purchase_shipping_cents: 500, seller_shipping_cents: 600 }); expect(result.total_acquisition_cost_cents).toBe(5_500); expect(result.total_selling_costs_cents).toBe(600); });
  it("includes packaging", () => expect(calculate({ packaging_cost_cents: 99 }).net_profit_cents).toBe(4_901));
  it("finds break-even with no percentage fee", () => expect(calculate({ fixed_sale_fee_cents: 100 }).break_even_sale_price_cents).toBe(5_100));
  it("finds break-even with percentage rounding", () => expect(calculate({ sale_platform_fee_basis_points: 1_000 }).break_even_sale_price_cents).toBe(5_556));
  it("returns no finite break-even at 100% fee", () => expect(calculate({ sale_platform_fee_basis_points: 10_000 }).break_even_sale_price_cents).toBeNull());
  it("finds maximum product price for target ROI", () => expect(calculate().maximum_purchase_price_cents).toBe(8_333));
  it("classifies short term", () => expect(classifyHoldingHorizon(3)).toBe("SHORT_TERM"));
  it("classifies medium term", () => expect(classifyHoldingHorizon(4)).toBe("MEDIUM_TERM"));
  it("classifies long term", () => expect(classifyHoldingHorizon(19)).toBe("LONG_TERM"));
  it("returns STRONG_BUY", () => expect(calculate().recommendation).toBe("STRONG_BUY"));
  it("returns BUY", () => expect(calculate({ product_price_cents: 5_000, expected_sale_price_cents: 6_200 }).recommendation).toBe("BUY"));
  it("returns WATCH", () => expect(calculate({ product_price_cents: 5_000, expected_sale_price_cents: 5_600 }).recommendation).toBe("WATCH"));
  it("returns PASS for low ROI", () => expect(calculate({ product_price_cents: 5_000, expected_sale_price_cents: 5_400 }).recommendation).toBe("PASS"));
  it("handles rounding of signed ROI", () => expect(calculate({ product_price_cents: 3, expected_sale_price_cents: 2 }).roi_basis_points).toBe(-3_333));
  it("handles zero acquisition cost without division by zero", () => { const result = calculate({ product_price_cents: 0 }); expect(result.roi_basis_points).toBe(10_000); expect(result.profitable).toBe(true); });
  it("uses simple ROI for immediate holding", () => { const result = calculate({ estimated_holding_months: 0 }); expect(result.annualized_roi_basis_points).toBe(result.roi_basis_points); expect(result.estimated_profit_per_month_cents).toBe(result.net_profit_cents); });
});
