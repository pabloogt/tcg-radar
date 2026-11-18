import { z } from "zod";
import { investmentMetricKeys } from "@/lib/investment/config";

const blankToNull = (value: unknown) => value === undefined || value === null || typeof value === "string" && value.trim() === "" ? null : value;
const optionalScore = z.preprocess(blankToNull, z.coerce.number().int().min(0).max(100).nullable());
const optionalNonnegative = z.preprocess(blankToNull, z.coerce.number().int().min(0).max(2_147_483_647).nullable());
const optionalBasisPoints = z.preprocess(blankToNull, z.coerce.number().int().min(-10_000).max(10_000).nullable());
const optionalEuroCents = z.preprocess((value) => { if (typeof value === "string" && value.trim() === "") return null; if (typeof value !== "string") return value; const euros = Number(value.trim().replace(",", ".")); return Number.isFinite(euros) ? Math.round(euros * 100) : value; }, z.number().int().min(0).max(2_147_483_647).nullable());

export const setFormSchema = z.object({
  tcg: z.enum(["pokemon", "one_piece", "lorcana"]),
  name: z.string().trim().min(1).max(200),
  release_date: z.preprocess(blankToNull, z.iso.date().nullable()),
  image_url: z.preprocess(blankToNull, z.url().max(2048).nullable()),
  series: z.preprocess(blankToNull, z.string().trim().min(1).max(200).nullable()),
  packs_per_booster_box: z.preprocess(blankToNull, z.coerce.number().int().min(1).max(1_000).nullable()),
  cards_per_pack: z.preprocess(blankToNull, z.coerce.number().int().min(1).max(1_000).nullable()),
});

export const investmentMetricsFormSchema = z.object({
  ...Object.fromEntries(investmentMetricKeys.map((key) => [key, optionalScore])),
  top_card_price_cents: optionalEuroCents,
  top3_cards_value_cents: optionalEuroCents,
  top5_cards_value_cents: optionalEuroCents,
  top10_cards_value_cents: optionalEuroCents,
  cards_over_20_eur: optionalNonnegative,
  cards_over_50_eur: optionalNonnegative,
  cards_over_100_eur: optionalNonnegative,
  estimated_hit_rate_bps: optionalBasisPoints.refine((value) => value === null || value >= 0),
  estimated_top_hit_rate_bps: optionalBasisPoints.refine((value) => value === null || value >= 0),
  stores_in_stock: optionalNonnegative,
  stock_decline_30d_bps: optionalBasisPoints,
  sealed_price_30d_change_bps: optionalBasisPoints,
  card_market_30d_change_bps: optionalBasisPoints,
  source_type: z.enum(["manual", "internal", "external", "derived"]),
  confidence: z.enum(["high", "medium", "low"]),
  source_note: z.preprocess(blankToNull, z.string().trim().max(500).nullable()),
});

export const productInvestmentProfileSchema = z.object({
  vehicle_score_override: optionalScore,
  exclusive: z.boolean(),
  limited_distribution: z.boolean(),
  special_promo_score: optionalScore,
  storage_efficiency_score: optionalScore,
  liquidity_score: optionalScore,
  sealed_collectability_score: optionalScore,
  notes: z.preprocess(blankToNull, z.string().trim().max(1_000).nullable()),
});
