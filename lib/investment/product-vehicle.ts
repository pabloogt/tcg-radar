import { DEFAULT_PRODUCT_VEHICLE_SCORES, PRODUCT_VEHICLE_MODIFIERS, SUPPORTED_PRODUCT_INVESTMENT_TYPES, TCG_PRODUCT_VEHICLE_OVERRIDES } from "./product-config";

export type ProductInvestmentProfile = {
  vehicleScoreOverride: number | null;
  exclusive: boolean;
  limitedDistribution: boolean;
  specialPromoScore: number | null;
  storageEfficiencyScore: number | null;
  liquidityScore: number | null;
  sealedCollectabilityScore: number | null;
  notes: string | null;
};

export type ProductVehicleResult = { score: number; baseline: number; modifier: number; overridden: boolean };

function clampScore(value: number): number {
  return Math.max(0, Math.min(100, Math.round(value)));
}

export function getDefaultVehicleScore(productType: string, tcg?: string): number {
  const normalizedType = productType.startsWith("sealed_case_") ? "sealed_case" : productType;
  return TCG_PRODUCT_VEHICLE_OVERRIDES[tcg ?? ""]?.[normalizedType] ?? DEFAULT_PRODUCT_VEHICLE_SCORES[normalizedType] ?? DEFAULT_PRODUCT_VEHICLE_SCORES.other_sealed;
}

export function isSupportedProductInvestmentType(productType: string): boolean {
  return SUPPORTED_PRODUCT_INVESTMENT_TYPES.has(productType) || productType.startsWith("sealed_case_");
}

export function calculateProductVehicleScore(productType: string, tcg: string, profile?: ProductInvestmentProfile | null): ProductVehicleResult {
  const baseline = getDefaultVehicleScore(productType, tcg);
  if (profile?.vehicleScoreOverride !== null && profile?.vehicleScoreOverride !== undefined) return { score: clampScore(profile.vehicleScoreOverride), baseline, modifier: clampScore(profile.vehicleScoreOverride) - baseline, overridden: true };
  if (!profile) return { score: baseline, baseline, modifier: 0, overridden: false };
  const centered = (value: number | null, weight: number) => value === null ? 0 : (value - 50) * weight;
  const modifier = (profile.exclusive ? PRODUCT_VEHICLE_MODIFIERS.exclusive : 0)
    + (profile.limitedDistribution ? PRODUCT_VEHICLE_MODIFIERS.limitedDistribution : 0)
    + centered(profile.specialPromoScore, PRODUCT_VEHICLE_MODIFIERS.specialPromo)
    + centered(profile.storageEfficiencyScore, PRODUCT_VEHICLE_MODIFIERS.storageEfficiency)
    + centered(profile.liquidityScore, PRODUCT_VEHICLE_MODIFIERS.liquidity)
    + centered(profile.sealedCollectabilityScore, PRODUCT_VEHICLE_MODIFIERS.sealedCollectability);
  const score = clampScore(baseline + modifier);
  return { score, baseline, modifier: score - baseline, overridden: false };
}
