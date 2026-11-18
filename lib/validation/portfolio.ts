import { z } from "zod";
import { PORTFOLIO_LIMITS, PORTFOLIO_STRATEGY_DEFAULTS } from "@/lib/investment/portfolio-config";
import type { PortfolioOptions } from "@/lib/investment/portfolio";

function eurosToCents(value: unknown) {
  if (typeof value !== "string") return value;
  const normalized = value.trim().replace(/\s/g, "").replace("€", "").replace(",", ".");
  const euros = Number(normalized);
  return Number.isFinite(euros) ? Math.round(euros * 100) : value;
}

const stringArray = z.preprocess((value) => value === undefined ? [] : Array.isArray(value) ? value : [value], z.array(z.string().trim().min(1).max(100)).max(30));
const optionalInteger = (minimum: number, maximum: number) => z.preprocess((value) => value === "" || value === undefined || value === null ? null : value, z.coerce.number().int().min(minimum).max(maximum).nullable());

export const portfolioInputSchema = z.object({
  budgetCents: z.preprocess(eurosToCents, z.number().int().min(PORTFOLIO_LIMITS.minimumBudgetCents).max(PORTFOLIO_LIMITS.maximumBudgetCents)),
  horizon: z.enum(["short", "medium", "long"]),
  strategy: z.enum(["CONSERVATIVE", "BALANCED", "AGGRESSIVE"]),
  tcgs: stringArray.pipe(z.array(z.enum(["pokemon", "one_piece", "lorcana"])).min(1)),
  languages: stringArray,
  productTypes: stringArray,
  includePreorder: z.boolean(),
  allowUnknownShipping: z.boolean(),
  minimumScore: z.coerce.number().int().min(0).max(100),
  minimumEntryConfidence: z.enum(["LOW", "MEDIUM", "HIGH"]),
  maxProductPercent: z.coerce.number().int().min(5).max(100),
  maxSetPercent: z.coerce.number().int().min(5).max(100),
  maxTcgPercent: z.coerce.number().int().min(5).max(100),
  maxUnitsPerProduct: z.coerce.number().int().min(1).max(PORTFOLIO_LIMITS.maximumUnitsPerProduct),
  minimumDistinctProducts: optionalInteger(1, PORTFOLIO_LIMITS.maximumDistinctProducts),
  maxDistinctProducts: z.coerce.number().int().min(1).max(PORTFOLIO_LIMITS.maximumDistinctProducts),
}).superRefine((value, context) => {
  if (value.maxProductPercent > value.maxSetPercent) context.addIssue({ code: "custom", path: ["maxProductPercent"], message: "El límite por producto no puede superar el límite por colección." });
  if (value.maxSetPercent > value.maxTcgPercent) context.addIssue({ code: "custom", path: ["maxSetPercent"], message: "El límite por colección no puede superar el límite por TCG." });
  if (value.minimumDistinctProducts !== null && value.minimumDistinctProducts > value.maxDistinctProducts) context.addIssue({ code: "custom", path: ["minimumDistinctProducts"], message: "El mínimo de productos no puede superar el máximo." });
});

export type PortfolioFormInput = z.infer<typeof portfolioInputSchema>;

export function portfolioDefaults(strategy: keyof typeof PORTFOLIO_STRATEGY_DEFAULTS = "BALANCED"): PortfolioFormInput {
  const defaults = PORTFOLIO_STRATEGY_DEFAULTS[strategy];
  return {
    budgetCents: 30_000,
    horizon: "long",
    strategy,
    tcgs: ["pokemon", "one_piece", "lorcana"],
    languages: [],
    productTypes: [],
    includePreorder: false,
    allowUnknownShipping: false,
    minimumScore: defaults.minimumScore,
    minimumEntryConfidence: defaults.minimumEntryConfidence,
    maxProductPercent: defaults.maxProductBps / 100,
    maxSetPercent: defaults.maxSetBps / 100,
    maxTcgPercent: defaults.maxTcgBps / 100,
    maxUnitsPerProduct: defaults.maxUnitsPerProduct,
    minimumDistinctProducts: null,
    maxDistinctProducts: defaults.maxDistinctProducts,
  };
}

export function portfolioFormDataValues(formData: FormData) {
  return {
    budgetCents: formData.get("budget"),
    horizon: formData.get("horizon"),
    strategy: formData.get("strategy"),
    tcgs: formData.getAll("tcgs"),
    languages: formData.getAll("languages"),
    productTypes: formData.getAll("productTypes"),
    includePreorder: formData.get("includePreorder") === "on",
    allowUnknownShipping: formData.get("allowUnknownShipping") === "on",
    minimumScore: formData.get("minimumScore"),
    minimumEntryConfidence: formData.get("minimumEntryConfidence"),
    maxProductPercent: formData.get("maxProductPercent"),
    maxSetPercent: formData.get("maxSetPercent"),
    maxTcgPercent: formData.get("maxTcgPercent"),
    maxUnitsPerProduct: formData.get("maxUnitsPerProduct"),
    minimumDistinctProducts: formData.get("minimumDistinctProducts"),
    maxDistinctProducts: formData.get("maxDistinctProducts"),
  };
}

export function portfolioOptions(input: PortfolioFormInput): PortfolioOptions {
  return {
    budgetCents: input.budgetCents,
    horizon: input.horizon,
    strategy: input.strategy,
    tcgs: input.tcgs,
    languages: input.languages,
    productTypes: input.productTypes,
    includePreorder: input.includePreorder,
    allowUnknownShipping: input.allowUnknownShipping,
    minimumScore: input.minimumScore,
    minimumEntryConfidence: input.minimumEntryConfidence,
    maxProductBps: input.maxProductPercent * 100,
    maxSetBps: input.maxSetPercent * 100,
    maxTcgBps: input.maxTcgPercent * 100,
    maxUnitsPerProduct: input.maxUnitsPerProduct,
    minimumDistinctProducts: input.minimumDistinctProducts,
    maxDistinctProducts: input.maxDistinctProducts,
    staleListingHours: PORTFOLIO_LIMITS.staleListingHours,
  };
}
