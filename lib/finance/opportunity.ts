import { z } from "zod";

const maxCents = 2_147_483_647;
const cents = z.number().int().min(0).max(maxCents);
const basisPoints = z.number().int().min(0).max(10_000);

export const opportunityInputSchema = z.object({
  product_price_cents: cents,
  purchase_shipping_cents: cents,
  purchase_fees_cents: cents,
  expected_sale_price_cents: cents,
  sale_platform_fee_basis_points: basisPoints,
  fixed_sale_fee_cents: cents,
  seller_shipping_cents: cents,
  packaging_cost_cents: cents,
  estimated_holding_months: z.number().int().min(0).max(1_200),
  target_roi_basis_points: basisPoints,
});

export type OpportunityInput = z.infer<typeof opportunityInputSchema>;
export type HoldingHorizon = "SHORT_TERM" | "MEDIUM_TERM" | "LONG_TERM";
export type Recommendation = "STRONG_BUY" | "BUY" | "WATCH" | "PASS";

export type OpportunityResult = {
  total_acquisition_cost_cents: number;
  gross_sale_revenue_cents: number;
  marketplace_fee_cents: number;
  total_selling_costs_cents: number;
  net_profit_cents: number;
  roi_basis_points: number;
  annualized_roi_basis_points: number;
  break_even_sale_price_cents: number | null;
  maximum_purchase_price_cents: number;
  profitable: boolean;
  profit_margin_basis_points: number;
  capital_tied_up_cents: number;
  estimated_profit_per_month_cents: number;
  holding_horizon: HoldingHorizon;
  recommendation: Recommendation;
  recommendation_explanation: string;
};

function roundDivide(numerator: number, denominator: number): number {
  if (denominator <= 0) throw new Error("Denominator must be positive");
  const sign = Math.sign(numerator);
  return sign * Math.floor((Math.abs(numerator) + denominator / 2) / denominator);
}

function marketplaceFee(salePriceCents: number, feeBasisPoints: number): number {
  return roundDivide(salePriceCents * feeBasisPoints, 10_000);
}

function profitFor(input: OpportunityInput, productPriceCents: number, salePriceCents: number): number {
  const acquisition = productPriceCents + input.purchase_shipping_cents + input.purchase_fees_cents;
  const selling = marketplaceFee(salePriceCents, input.sale_platform_fee_basis_points)
    + input.fixed_sale_fee_cents + input.seller_shipping_cents + input.packaging_cost_cents;
  return salePriceCents - selling - acquisition;
}

function findFirstProfitableSale(input: OpportunityInput): number | null {
  if (input.sale_platform_fee_basis_points === 10_000) return null;
  let low = 0;
  let high = 1;
  while (profitFor(input, input.product_price_cents, high) < 0 && high < maxCents) high = Math.min(high * 2, maxCents);
  if (profitFor(input, input.product_price_cents, high) < 0) return null;
  while (low < high) {
    const middle = Math.floor((low + high) / 2);
    if (profitFor(input, input.product_price_cents, middle) >= 0) high = middle;
    else low = middle + 1;
  }
  return low;
}

function reachesTarget(input: OpportunityInput, productPriceCents: number): boolean {
  const acquisition = productPriceCents + input.purchase_shipping_cents + input.purchase_fees_cents;
  const profit = profitFor(input, productPriceCents, input.expected_sale_price_cents);
  if (acquisition === 0) return profit >= 0;
  return profit * 10_000 >= acquisition * input.target_roi_basis_points;
}

function findMaximumPurchasePrice(input: OpportunityInput): number {
  if (!reachesTarget(input, 0)) return 0;
  let low = 0;
  let high = Math.min(input.expected_sale_price_cents, maxCents);
  while (low < high) {
    const middle = Math.ceil((low + high) / 2);
    if (reachesTarget(input, middle)) low = middle;
    else high = middle - 1;
  }
  return low;
}

export function classifyHoldingHorizon(months: number): HoldingHorizon {
  if (months <= 3) return "SHORT_TERM";
  if (months <= 18) return "MEDIUM_TERM";
  return "LONG_TERM";
}

function recommend(netProfitCents: number, roiBasisPoints: number): Recommendation {
  if (netProfitCents <= 0 || roiBasisPoints < 1_000) return "PASS";
  if (netProfitCents >= 1_500 && roiBasisPoints >= 3_000) return "STRONG_BUY";
  if (netProfitCents >= 1_000 && roiBasisPoints >= 2_000) return "BUY";
  return "WATCH";
}

function formatSpanishNumber(value: number): string {
  return new Intl.NumberFormat("es-ES", { minimumFractionDigits: 1, maximumFractionDigits: 1 }).format(value);
}

function recommendationExplanation(recommendation: Recommendation, roiBasisPoints: number, profitCents: number): string {
  const roi = formatSpanishNumber(roiBasisPoints / 100);
  const profit = new Intl.NumberFormat("es-ES", { style: "currency", currency: "EUR" }).format(profitCents / 100);
  if (recommendation === "STRONG_BUY") return `Buen margen inmediato: ROI estimado del ${roi} % y ${profit} de beneficio neto.`;
  if (recommendation === "BUY") return `Oportunidad atractiva: ROI estimado del ${roi} % y ${profit} de beneficio neto.`;
  if (recommendation === "WATCH") return `Margen positivo pero moderado: ROI estimado del ${roi} % y ${profit} de beneficio neto.`;
  return "Margen demasiado pequeño para compensar el capital y el riesgo.";
}

export function calculateOpportunity(rawInput: OpportunityInput): OpportunityResult {
  const input = opportunityInputSchema.parse(rawInput);
  const totalAcquisition = input.product_price_cents + input.purchase_shipping_cents + input.purchase_fees_cents;
  const marketplace = marketplaceFee(input.expected_sale_price_cents, input.sale_platform_fee_basis_points);
  const totalSelling = marketplace + input.fixed_sale_fee_cents + input.seller_shipping_cents + input.packaging_cost_cents;
  const netProfit = input.expected_sale_price_cents - totalSelling - totalAcquisition;
  const roi = totalAcquisition === 0 ? (netProfit > 0 ? 10_000 : netProfit < 0 ? -10_000 : 0) : roundDivide(netProfit * 10_000, totalAcquisition);
  const margin = input.expected_sale_price_cents === 0 ? (netProfit < 0 ? -10_000 : 0) : roundDivide(netProfit * 10_000, input.expected_sale_price_cents);
  const annualized = input.estimated_holding_months === 0 ? roi : roundDivide(roi * 12, input.estimated_holding_months);
  const monthlyProfit = input.estimated_holding_months === 0 ? netProfit : roundDivide(netProfit, input.estimated_holding_months);
  const recommendation = recommend(netProfit, roi);
  return {
    total_acquisition_cost_cents: totalAcquisition,
    gross_sale_revenue_cents: input.expected_sale_price_cents,
    marketplace_fee_cents: marketplace,
    total_selling_costs_cents: totalSelling,
    net_profit_cents: netProfit,
    roi_basis_points: roi,
    annualized_roi_basis_points: annualized,
    break_even_sale_price_cents: findFirstProfitableSale(input),
    maximum_purchase_price_cents: findMaximumPurchasePrice(input),
    profitable: netProfit > 0,
    profit_margin_basis_points: margin,
    capital_tied_up_cents: totalAcquisition,
    estimated_profit_per_month_cents: monthlyProfit,
    holding_horizon: classifyHoldingHorizon(input.estimated_holding_months),
    recommendation,
    recommendation_explanation: recommendationExplanation(recommendation, roi, netProfit),
  };
}
