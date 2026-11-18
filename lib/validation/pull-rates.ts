import { z } from "zod";

const blankToNull = (value: unknown) => value === undefined || value === null || typeof value === "string" && value.trim() === "" ? null : value;
const optionalText = (maximum: number) => z.preprocess(blankToNull, z.string().trim().min(1).max(maximum).nullable());
const optionalPositiveInteger = z.preprocess(blankToNull, z.coerce.number().int().positive().max(2_147_483_647).nullable());
const optionalSample = z.preprocess(blankToNull, z.coerce.number().int().min(0).max(2_147_483_647).nullable());
const optionalPpm = z.preprocess(blankToNull, z.coerce.number().int().min(1).max(1_000_000).nullable());
const optionalBps = z.preprocess(blankToNull, z.coerce.number().int().min(1).max(10_000).nullable());
const probabilityPercent = z.preprocess((value) => typeof value === "string" ? value.trim().replace("%", "").replace(",", ".") : value, z.coerce.number().positive().max(100).nullable()).transform((value) => value === null ? null : Math.round(value * 10_000));
const packsPerHit = z.preprocess((value) => typeof value === "string" ? value.trim().replace(",", ".") : value, z.coerce.number().positive().max(1_000_000).nullable()).transform((value) => value === null ? null : Math.round(value * 1_000));
const categoryGroup = z.enum(["ANY_HIT", "HIGH_RARITY_HIT", "CHASE_TIER", "TOP_CHASE", "SPECIFIC_CARD", "SPECIAL_SLOT", "BOX_HIT", "OTHER"]);

export const pullRateInputSchema = z.object({
  category: z.string().trim().min(1).max(160),
  category_group: z.preprocess(blankToNull, categoryGroup.nullable()),
  subcategory: optionalText(160),
  card_id: z.preprocess(blankToNull, z.uuid().nullable()),
  card_number: optionalText(80),
  variant_name: optionalText(200),
  odds_numerator: optionalPositiveInteger,
  odds_denominator: optionalPositiveInteger,
  probability_ppm: optionalPpm,
  probability_bps: optionalBps,
  probability: z.preprocess(blankToNull, probabilityPercent),
  packs_per_hit: z.preprocess(blankToNull, packsPerHit),
  sample_size: optionalSample,
  source: z.string().trim().min(1).max(120),
  source_type: z.enum(["official", "community", "manual", "derived", "external"]),
  confidence: z.preprocess(blankToNull, z.enum(["HIGH", "MEDIUM", "LOW"]).nullable()),
  source_note: optionalText(1_000),
  outcome_group: optionalText(120),
  mutually_exclusive: z.preprocess((value) => value === true || value === "true" || value === "on" || value === "1", z.boolean()),
  observed_at: z.preprocess(blankToNull, z.iso.datetime({ offset: true }).nullable()),
}).superRefine((value, context) => {
  const representations = [value.probability_ppm, value.probability_bps, value.probability, value.packs_per_hit, value.odds_numerator !== null || value.odds_denominator !== null ? 1 : null].filter((entry) => entry !== null);
  if (!representations.length) context.addIssue({ code: "custom", message: "Indica odds, probabilidad o sobres por hit." });
  if ((value.odds_numerator === null) !== (value.odds_denominator === null)) context.addIssue({ code: "custom", message: "Las odds necesitan numerador y denominador." });
  if (value.odds_numerator !== null && value.odds_denominator !== null && value.odds_numerator > value.odds_denominator) context.addIssue({ code: "custom", message: "La probabilidad no puede superar el 100 %." });
});

export const setPackConfigurationSchema = z.object({
  packs_per_booster_box: z.preprocess(blankToNull, z.coerce.number().int().min(1).max(1_000).nullable()),
  cards_per_pack: z.preprocess(blankToNull, z.coerce.number().int().min(1).max(1_000).nullable()),
});
