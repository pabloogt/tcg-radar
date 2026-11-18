import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/database.types";
import { productInvestmentFingerprint, shouldCreateProductInvestmentSnapshot, type ProductSnapshotValues } from "./product-scoring";
import type { ProductInvestmentAnalysis } from "./product-data";

export function snapshotValuesFromAnalysis(analysis: ProductInvestmentAnalysis): ProductSnapshotValues {
  return {
    shortScore: analysis.result.finalScores.short.score,
    mediumScore: analysis.result.finalScores.medium.score,
    longScore: analysis.result.finalScores.long.score,
    setShortScore: analysis.setScores.short.score,
    setMediumScore: analysis.setScores.medium.score,
    setLongScore: analysis.setScores.long.score,
    vehicleScore: analysis.vehicle.score,
    entryScore: analysis.entry.score,
    entryConfidence: analysis.entry.confidence,
    entryCompleteness: analysis.entry.completeness,
    bestListingPriceCents: analysis.result.bestListingPriceCents,
    marketReferenceCents: analysis.entry.marketReferenceCents,
  };
}

export async function persistProductInvestmentSnapshot(client: SupabaseClient<Database>, userId: string, analysis: ProductInvestmentAnalysis): Promise<boolean> {
  const values = snapshotValuesFromAnalysis(analysis);
  const fingerprint = productInvestmentFingerprint(values);
  const { data: latest, error: latestError } = await client.from("product_investment_snapshots").select("calculation_fingerprint").eq("user_id", userId).eq("product_id", analysis.product.id).order("created_at", { ascending: false }).limit(1).maybeSingle();
  if (latestError) throw latestError;
  if (!shouldCreateProductInvestmentSnapshot(latest?.calculation_fingerprint ?? null, values)) return false;
  const { error } = await client.from("product_investment_snapshots").insert({ user_id: userId, product_id: analysis.product.id, short_score: values.shortScore, medium_score: values.mediumScore, long_score: values.longScore, set_short_score: values.setShortScore, set_medium_score: values.setMediumScore, set_long_score: values.setLongScore, vehicle_score: values.vehicleScore, entry_score: values.entryScore, entry_confidence: values.entryConfidence, entry_completeness: values.entryCompleteness, best_listing_price_cents: values.bestListingPriceCents, market_reference_cents: values.marketReferenceCents, comparison_basis: analysis.bestListing ? analysis.entry.comparisonBasis : null, calculation_fingerprint: fingerprint });
  if (error) throw error;
  return true;
}
