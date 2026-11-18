"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { requireUser } from "@/lib/auth/require-user";
import { buildInvestmentPortfolio } from "@/lib/investment/portfolio";
import { loadPortfolioBuilderData } from "@/lib/investment/portfolio-data";
import type { Json } from "@/lib/supabase/database.types";
import { portfolioFormDataValues, portfolioInputSchema, portfolioOptions } from "@/lib/validation/portfolio";

const portfolioNameSchema = z.string().trim().min(1).max(120);

function returnWith(message: "saved" | "invalid" | "empty" | "database"): never {
  redirect(`/investment/portfolio?status=${message}`);
}

export async function savePortfolioScenario(formData: FormData): Promise<void> {
  const parsed = portfolioInputSchema.safeParse(portfolioFormDataValues(formData));
  const name = portfolioNameSchema.safeParse(formData.get("name"));
  if (!parsed.success || !name.success) returnWith("invalid");
  const { supabase, user } = await requireUser();
  const now = new Date();
  const data = await loadPortfolioBuilderData(supabase, user.id, now);
  const options = portfolioOptions(parsed.data);
  const result = buildInvestmentPortfolio({ candidates: data.candidates, options, existingExposure: data.existingExposure, now });
  if (!result.positions.length) returnWith("empty");

  const settings: Json = {
    tcgs: [...parsed.data.tcgs],
    languages: [...parsed.data.languages],
    productTypes: [...parsed.data.productTypes],
    includePreorder: parsed.data.includePreorder,
    allowUnknownShipping: parsed.data.allowUnknownShipping,
    minimumScore: parsed.data.minimumScore,
    minimumEntryConfidence: parsed.data.minimumEntryConfidence,
    maxProductPercent: parsed.data.maxProductPercent,
    maxSetPercent: parsed.data.maxSetPercent,
    maxTcgPercent: parsed.data.maxTcgPercent,
    maxUnitsPerProduct: parsed.data.maxUnitsPerProduct,
    minimumDistinctProducts: parsed.data.minimumDistinctProducts,
    maxDistinctProducts: parsed.data.maxDistinctProducts,
  };
  const { data: portfolio, error: portfolioError } = await supabase.from("investment_portfolios").insert({
    user_id: user.id,
    name: name.data,
    budget_cents: result.budgetCents,
    allocated_cents: result.allocatedCents,
    remaining_cents: result.remainingCents,
    horizon: result.horizon,
    strategy: result.strategy,
    portfolio_score: result.portfolioScore,
    confidence: result.confidence,
    settings,
    reasons: result.reasons,
    warnings: result.warnings,
  }).select("id").single();
  if (portfolioError || !portfolio) returnWith("database");

  const positions = result.positions.map((position) => ({
    user_id: user.id,
    portfolio_id: portfolio.id,
    product_id: position.candidate.productId,
    set_id: position.candidate.setId,
    listing_id: position.listing.listingId,
    product_name: position.candidate.productName,
    set_name: position.candidate.setName,
    store_name: position.listing.storeName,
    tcg: position.candidate.tcg,
    language: position.candidate.language,
    product_type: position.candidate.productType,
    horizon: result.horizon,
    quantity: position.quantity,
    unit_cost_cents: position.unitCostCents,
    total_cost_cents: position.totalCostCents,
    product_score: position.productInvestmentScore,
    set_score: position.setInvestmentScore,
    vehicle_score: position.candidate.vehicleScore,
    entry_score: position.candidate.entryScore,
    entry_confidence: position.candidate.entryConfidence,
    market_reference_cents: position.candidate.marketReferenceCents,
    deal_classification: position.candidate.dealClassification,
    shipping_known: position.listing.shippingKnown,
    stock_status: position.listing.stockStatus,
    country: position.listing.country,
    product_url: position.listing.url,
  }));
  const { error: positionsError } = await supabase.from("investment_portfolio_positions").insert(positions);
  if (positionsError) {
    await supabase.from("investment_portfolios").delete().eq("id", portfolio.id).eq("user_id", user.id);
    returnWith("database");
  }
  revalidatePath("/investment/portfolio");
  returnWith("saved");
}
