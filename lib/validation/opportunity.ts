import { z } from "zod";
import { opportunityInputSchema } from "@/lib/finance/opportunity";

const euroToCents = z.preprocess((value) => {
  if (typeof value !== "string") return value;
  const euros = Number(value.trim().replace(",", "."));
  return Number.isFinite(euros) ? Math.round(euros * 100) : value;
}, z.number().int().min(0).max(2_147_483_647));

const percentToBasisPoints = z.preprocess((value) => {
  if (typeof value !== "string") return value;
  const percent = Number(value.trim().replace(",", "."));
  return Number.isFinite(percent) ? Math.round(percent * 100) : value;
}, z.number().int().min(0).max(10_000));

export const opportunityFormSchema = z.object({
  product_price_cents: euroToCents,
  purchase_shipping_cents: euroToCents,
  purchase_fees_cents: euroToCents,
  expected_sale_price_cents: euroToCents,
  sale_platform_fee_basis_points: percentToBasisPoints,
  fixed_sale_fee_cents: euroToCents,
  seller_shipping_cents: euroToCents,
  packaging_cost_cents: euroToCents,
  estimated_holding_months: z.coerce.number().int().min(0).max(1_200),
  target_roi_basis_points: percentToBasisPoints,
}).pipe(opportunityInputSchema);
