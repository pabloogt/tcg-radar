import { z } from "zod";

const blankToNull = (value: unknown) => value === undefined || value === null || typeof value === "string" && value.trim() === "" ? null : value;
const euroCents = z.preprocess((value) => { if (value === null || value === undefined || value === "") return null; if (typeof value === "number") return Math.round(value * 100); if (typeof value !== "string") return value; const normalized = value.trim().replace(/\s/g, "").replace("€", "").replace(",", "."); const euros = Number(normalized); return Number.isFinite(euros) ? Math.round(euros * 100) : value; }, z.number().int().min(0).max(100_000_000).nullable());

export const cardImportRowSchema = z.object({
  name: z.string().trim().min(1).max(300),
  card_number: z.string().trim().min(1).max(80),
  rarity: z.string().trim().min(1).max(120),
  rarity_group: z.preprocess(blankToNull, z.enum(["common", "uncommon", "rare", "ultra", "special", "secret", "promo", "other"]).nullable()),
  character_name: z.preprocess(blankToNull, z.string().trim().min(1).max(200).nullable()),
  variant_name: z.preprocess(blankToNull, z.string().trim().min(1).max(200).nullable()),
  image_url: z.preprocess(blankToNull, z.url().max(2048).nullable()),
  external_id: z.preprocess(blankToNull, z.string().trim().min(1).max(300).nullable()),
  external_source: z.string().trim().min(1).max(100).default("import"),
});

export const cardPriceImportRowSchema = z.object({
  external_id: z.preprocess(blankToNull, z.string().trim().min(1).max(300).nullable()),
  card_number: z.preprocess(blankToNull, z.string().trim().min(1).max(80).nullable()),
  variant_name: z.preprocess(blankToNull, z.string().trim().min(1).max(200).nullable()),
  source: z.string().trim().min(1).max(100),
  currency: z.string().trim().toUpperCase().regex(/^[A-Z]{3}$/),
  market_price: euroCents,
  low_price: euroCents,
  trend_price: euroCents,
  observed_at: z.iso.datetime({ offset: true }),
}).refine((value) => value.external_id !== null || value.card_number !== null, { message: "Se necesita external_id o card_number." }).refine((value) => value.market_price !== null || value.low_price !== null || value.trend_price !== null, { message: "Se necesita al menos un precio." });

export const cardManualEditSchema = z.object({
  name: z.string().trim().min(1).max(300),
  card_number: z.string().trim().min(1).max(80),
  rarity: z.string().trim().min(1).max(120),
  rarity_group: z.preprocess(blankToNull, z.enum(["common", "uncommon", "rare", "ultra", "special", "secret", "promo", "other"]).nullable()),
  character_name: z.preprocess(blankToNull, z.string().trim().min(1).max(200).nullable()),
  variant_name: z.preprocess(blankToNull, z.string().trim().min(1).max(200).nullable()),
});
