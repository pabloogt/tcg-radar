import { describe, expect, it } from "vitest";
import { calculateProductVehicleScore, getDefaultVehicleScore, type ProductInvestmentProfile } from "./product-vehicle";

const profile = (values: Partial<ProductInvestmentProfile> = {}): ProductInvestmentProfile => ({ vehicleScoreOverride: null, exclusive: false, limitedDistribution: false, specialPromoScore: null, storageEfficiencyScore: null, liquidityScore: null, sealedCollectabilityScore: null, notes: null, ...values });

describe("product vehicle score", () => {
  it("uses the configured booster box baseline", () => expect(getDefaultVehicleScore("booster_box")).toBe(92));
  it("uses the configured ETB baseline", () => expect(getDefaultVehicleScore("elite_trainer_box")).toBe(82));
  it("uses the configured booster bundle baseline", () => expect(getDefaultVehicleScore("booster_bundle")).toBe(78));
  it("recognizes quantity-specific sealed case variants", () => expect(getDefaultVehicleScore("sealed_case_10_etb")).toBe(88));
  it("lets a manual override take absolute precedence", () => expect(calculateProductVehicleScore("booster_box", "pokemon", profile({ vehicleScoreOverride: 61, exclusive: true })).score).toBe(61));
  it("applies structured positive and negative modifiers", () => { expect(calculateProductVehicleScore("premium_collection", "pokemon", profile({ exclusive: true, liquidityScore: 90 })).score).toBeGreaterThan(70); expect(calculateProductVehicleScore("premium_collection", "pokemon", profile({ storageEfficiencyScore: 0, liquidityScore: 0 })).score).toBeLessThan(70); });
  it("caps modifiers between zero and one hundred", () => { expect(calculateProductVehicleScore("booster_box", "pokemon", profile({ exclusive: true, limitedDistribution: true, specialPromoScore: 100, storageEfficiencyScore: 100, liquidityScore: 100, sealedCollectabilityScore: 100 })).score).toBe(100); expect(calculateProductVehicleScore("booster_pack", "pokemon", profile({ specialPromoScore: 0, storageEfficiencyScore: 0, liquidityScore: 0, sealedCollectabilityScore: 0 })).score).toBeGreaterThanOrEqual(0); });
});
