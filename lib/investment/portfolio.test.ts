import { describe, expect, it } from "vitest";
import { buildInvestmentPortfolio, calculateCandidateUtility, calculatePortfolioConfidence, calculatePortfolioScore, checkDiversificationConstraints, type ExistingExposure, type PortfolioCandidate, type PortfolioOptions } from "./portfolio";
import { PORTFOLIO_STRATEGY_DEFAULTS, type PortfolioStrategy } from "./portfolio-config";
import { calculateExistingExposure } from "./portfolio-data";
import { portfolioInputSchema } from "@/lib/validation/portfolio";

const NOW = new Date("2026-08-19T12:00:00.000Z");

function candidate(overrides: Partial<PortfolioCandidate> & { productId: string }): PortfolioCandidate {
  const price = overrides.bestListing?.priceCents ?? 5_000;
  return {
    productName: `Product ${overrides.productId}`,
    setId: "set-a",
    setName: "Set A",
    tcg: "pokemon",
    language: "es",
    productType: "elite_trainer_box",
    imageUrl: null,
    investmentScores: { short: 82, medium: 84, long: 86 },
    investmentConfidence: { short: "HIGH", medium: "HIGH", long: "HIGH" },
    setScores: { short: 80, medium: 84, long: 90 },
    vehicleScore: 82,
    entryScore: 80,
    entryConfidence: "HIGH",
    entryCompleteness: 90,
    dealClassification: "GOOD_PRICE",
    marketReferenceCents: 6_000,
    bestListing: {
      listingId: `listing-${overrides.productId}`,
      storeId: "store-a",
      storeName: "Store A",
      priceCents: price,
      shippingCents: 0,
      shippingKnown: true,
      totalCostCents: price,
      stockStatus: "in_stock",
      checkedAt: "2026-08-19T10:00:00.000Z",
      country: "ES",
      url: `https://example.com/${overrides.productId}`,
    },
    alternativeListings: [],
    availableQuantity: null,
    ...overrides,
  };
}

function options(strategy: PortfolioStrategy = "BALANCED", overrides: Partial<PortfolioOptions> = {}): PortfolioOptions {
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
    maxProductBps: defaults.maxProductBps,
    maxSetBps: defaults.maxSetBps,
    maxTcgBps: defaults.maxTcgBps,
    maxUnitsPerProduct: defaults.maxUnitsPerProduct,
    minimumDistinctProducts: null,
    maxDistinctProducts: defaults.maxDistinctProducts,
    staleListingHours: 24,
    ...overrides,
  };
}

const noExposure: ExistingExposure = { totalCents: 0, byProduct: {}, bySet: {}, byTcg: {} };

describe("investment portfolio builder", () => {
  it.each([[10_000, 10_000], [30_000, 30_000], [100_000, 100_000]])("respects a %i cent budget", (budgetCents, expected) => {
    const result = buildInvestmentPortfolio({ candidates: [candidate({ productId: "a" }), candidate({ productId: "b", setId: "set-b" })], options: options("BALANCED", { budgetCents }), now: NOW });
    expect(result.allocatedCents).toBeLessThanOrEqual(expected);
    expect(result.allocatedCents + result.remainingCents).toBe(expected);
  });

  it("returns empty when no product is affordable", () => {
    const result = buildInvestmentPortfolio({ candidates: [candidate({ productId: "a", bestListing: { ...candidate({ productId: "a" }).bestListing!, priceCents: 12_000, totalCostCents: 12_000 } })], options: options("BALANCED", { budgetCents: 10_000 }), now: NOW });
    expect(result.positions).toHaveLength(0);
    expect(result.portfolioScore).toBeNull();
  });

  it("allows unused cash instead of adding a weak filler", () => {
    const weak = candidate({ productId: "weak", investmentScores: { short: 50, medium: 50, long: 50 } });
    const result = buildInvestmentPortfolio({ candidates: [candidate({ productId: "good" }), weak], options: options("BALANCED", { budgetCents: 30_000 }), now: NOW });
    expect(result.positions.some((position) => position.candidate.productId === "weak")).toBe(false);
    expect(result.remainingCents).toBeGreaterThan(0);
  });

  it.each(["short", "medium", "long"] as const)("uses only the %s horizon score", (horizon) => {
    const scores = { short: 99, medium: 60, long: 60 };
    const other = { short: 70, medium: 95, long: 96 };
    const result = buildInvestmentPortfolio({ candidates: [candidate({ productId: "a", investmentScores: scores }), candidate({ productId: "b", setId: "set-b", investmentScores: other })], options: options("AGGRESSIVE", { horizon, budgetCents: 5_000, maxProductBps: 10_000, maxSetBps: 10_000, maxTcgBps: 10_000, maxUnitsPerProduct: 1 }), now: NOW });
    expect(result.positions[0]?.candidate.productId).toBe(horizon === "short" ? "a" : "b");
  });

  it("does not select the highest score when its cost cannot fit concentration", () => {
    const expensive = candidate({ productId: "expensive", investmentScores: { short: 99, medium: 99, long: 99 }, bestListing: { ...candidate({ productId: "expensive" }).bestListing!, priceCents: 20_000, totalCostCents: 20_000 } });
    const efficient = candidate({ productId: "efficient", setId: "set-b", investmentScores: { short: 88, medium: 88, long: 88 }, bestListing: { ...candidate({ productId: "efficient" }).bestListing!, priceCents: 8_000, totalCostCents: 8_000 } });
    const result = buildInvestmentPortfolio({ candidates: [expensive, efficient], options: options("BALANCED", { budgetCents: 30_000 }), now: NOW });
    expect(result.positions.some((position) => position.candidate.productId === "efficient")).toBe(true);
    expect(result.positions.some((position) => position.candidate.productId === "expensive")).toBe(false);
  });

  it("selects strong affordable candidates", () => {
    const result = buildInvestmentPortfolio({ candidates: [candidate({ productId: "a", setId: "set-a" }), candidate({ productId: "b", setId: "set-b", tcg: "one_piece" })], options: options(), now: NOW });
    expect(result.positions.map((position) => position.candidate.productId)).toEqual(expect.arrayContaining(["a", "b"]));
  });

  it("keeps languages separate through portfolio filters", () => {
    const result = buildInvestmentPortfolio({ candidates: [candidate({ productId: "es", language: "es" }), candidate({ productId: "en", language: "en", setId: "set-b" })], options: options("BALANCED", { languages: ["es"], maxProductBps: 10_000, maxSetBps: 10_000, maxTcgBps: 10_000 }), now: NOW });
    expect(result.positions.every((position) => position.candidate.language === "es")).toBe(true);
  });

  it("filters product types without merging formats", () => {
    const result = buildInvestmentPortfolio({ candidates: [candidate({ productId: "etb" }), candidate({ productId: "box", setId: "set-b", productType: "booster_box" })], options: options("BALANCED", { productTypes: ["booster_box"], maxProductBps: 10_000, maxSetBps: 10_000, maxTcgBps: 10_000 }), now: NOW });
    expect(result.positions.map((position) => position.candidate.productId)).toEqual(["box"]);
  });

  it("respects maximum distinct products", () => {
    const result = buildInvestmentPortfolio({ candidates: [candidate({ productId: "a" }), candidate({ productId: "b", setId: "set-b" }), candidate({ productId: "c", setId: "set-c" })], options: options("BALANCED", { maxDistinctProducts: 2, maxProductBps: 10_000, maxSetBps: 10_000, maxTcgBps: 10_000, maxUnitsPerProduct: 1 }), now: NOW });
    expect(result.positions).toHaveLength(2);
  });

  it("enforces the 35% product concentration limit", () => {
    const result = buildInvestmentPortfolio({ candidates: [candidate({ productId: "a" })], options: options("BALANCED", { budgetCents: 30_000 }), now: NOW });
    expect(result.positions[0]?.quantity).toBe(2);
    expect(result.positions[0]?.totalCostCents).toBe(10_000);
  });

  it("enforces maximum units", () => {
    const result = buildInvestmentPortfolio({ candidates: [candidate({ productId: "a" })], options: options("AGGRESSIVE", { budgetCents: 100_000, maxUnitsPerProduct: 2 }), now: NOW });
    expect(result.positions[0]?.quantity).toBe(2);
  });

  it("relaxes concentration for a genuinely small budget", () => {
    const result = buildInvestmentPortfolio({ candidates: [candidate({ productId: "a", bestListing: { ...candidate({ productId: "a" }).bestListing!, priceCents: 4_990, totalCostCents: 4_990 } })], options: options("BALANCED", { budgetCents: 5_000 }), now: NOW });
    expect(result.positions).toHaveLength(1);
    expect(result.relaxedConstraints).toBe(true);
    expect(result.warnings.join(" ")).toContain("limita la diversificación");
  });

  it("counts multiple products from the same set together", () => {
    const positionCandidate = candidate({ productId: "a", setId: "set-a" });
    const existingPosition = { candidate: positionCandidate, listing: positionCandidate.bestListing!, quantity: 2, unitCostCents: 5_000, totalCostCents: 10_000, productInvestmentScore: 86, setInvestmentScore: 90, candidateUtility: 80, reasons: [] };
    const reason = checkDiversificationConstraints({ candidate: candidate({ productId: "b", setId: "set-a" }), unitCostCents: 7_000, positions: [existingPosition], options: options("BALANCED", { budgetCents: 30_000 }), existingExposure: noExposure });
    expect(reason).toContain("colección");
  });

  it("caps combined TCG exposure in a mixed portfolio", () => {
    const pokemon = ["a", "b", "c", "d"].map((id, index) => candidate({ productId: id, setId: `set-${id}`, bestListing: { ...candidate({ productId: id }).bestListing!, priceCents: 7_000, totalCostCents: 7_000 }, investmentScores: { short: 95 - index, medium: 95 - index, long: 95 - index } }));
    const onePiece = candidate({ productId: "op", setId: "set-op", tcg: "one_piece", bestListing: { ...candidate({ productId: "op" }).bestListing!, priceCents: 7_000, totalCostCents: 7_000 } });
    const result = buildInvestmentPortfolio({ candidates: [...pokemon, onePiece], options: options("BALANCED", { budgetCents: 40_000, maxProductBps: 10_000, maxSetBps: 10_000, maxTcgBps: 7_500, maxUnitsPerProduct: 1 }), now: NOW });
    expect(result.positions.some((position) => position.candidate.tcg === "one_piece")).toBe(true);
    expect(result.diversification.tcg.pokemon).toBeLessThanOrEqual(30_000);
  });

  it("existing product exposure reduces new allocation", () => {
    const exposure: ExistingExposure = { totalCents: 8_000, byProduct: { a: 8_000 }, bySet: { "set-a": 8_000 }, byTcg: { pokemon: 8_000 } };
    const result = buildInvestmentPortfolio({ candidates: [candidate({ productId: "a" }), candidate({ productId: "b", setId: "set-b", tcg: "one_piece" })], options: options("BALANCED", { budgetCents: 30_000 }), existingExposure: exposure, now: NOW });
    expect(result.positions.find((position) => position.candidate.productId === "a")?.quantity ?? 0).toBeLessThanOrEqual(1);
    expect(result.warnings.join(" ")).toContain("posiciones existentes");
  });

  it("calculates unsold inventory exposure including proportional shipping", () => {
    const exposure = calculateExistingExposure(
      [{ id: "purchase-a", product_id: "a", quantity: 4, unit_cost_cents: 5_000, shipping_cents: 800 }],
      [{ purchase_id: "purchase-a", quantity: 1 }],
      [{ id: "a", set_id: "set-a", tcg: "pokemon" }],
    );
    expect(exposure.totalCents).toBe(15_600);
    expect(exposure.byProduct.a).toBe(15_600);
    expect(exposure.bySet["set-a"]).toBe(15_600);
    expect(exposure.byTcg.pokemon).toBe(15_600);
  });

  it("never creates negative exposure from inconsistent sales", () => {
    const exposure = calculateExistingExposure(
      [{ id: "purchase-a", product_id: "a", quantity: 1, unit_cost_cents: 5_000, shipping_cents: 0 }],
      [{ purchase_id: "purchase-a", quantity: 2 }],
      [{ id: "a", set_id: "set-a", tcg: "pokemon" }],
    );
    expect(exposure.totalCents).toBe(0);
  });

  it("selects in-stock products", () => {
    expect(buildInvestmentPortfolio({ candidates: [candidate({ productId: "a" })], options: options("BALANCED", { budgetCents: 5_000, maxProductBps: 10_000, maxSetBps: 10_000, maxTcgBps: 10_000 }), now: NOW }).positions).toHaveLength(1);
  });

  it("excludes preorder by default and allows it explicitly", () => {
    const preorder = candidate({ productId: "pre", bestListing: { ...candidate({ productId: "pre" }).bestListing!, stockStatus: "preorder" } });
    expect(buildInvestmentPortfolio({ candidates: [preorder], options: options(), now: NOW }).positions).toHaveLength(0);
    expect(buildInvestmentPortfolio({ candidates: [preorder], options: options("BALANCED", { includePreorder: true, maxProductBps: 10_000, maxSetBps: 10_000, maxTcgBps: 10_000 }), now: NOW }).positions).toHaveLength(1);
  });

  it.each(["out_of_stock", "unknown"])("never selects %s listings", (stockStatus) => {
    const unavailable = candidate({ productId: stockStatus, bestListing: { ...candidate({ productId: stockStatus }).bestListing!, stockStatus } });
    expect(buildInvestmentPortfolio({ candidates: [unavailable], options: options(), now: NOW }).positions).toHaveLength(0);
  });

  it("excludes unknown shipping by default", () => {
    const unknown = candidate({ productId: "a", bestListing: { ...candidate({ productId: "a" }).bestListing!, shippingKnown: false, shippingCents: null, totalCostCents: null } });
    const result = buildInvestmentPortfolio({ candidates: [unknown], options: options(), now: NOW });
    expect(result.positions).toHaveLength(0);
    expect(result.alternatives[0]?.reason).toContain("Envío desconocido");
  });

  it("uses confirmed acquisition total", () => {
    const withShipping = candidate({ productId: "a", bestListing: { ...candidate({ productId: "a" }).bestListing!, priceCents: 5_000, shippingCents: 595, totalCostCents: 5_595 } });
    const result = buildInvestmentPortfolio({ candidates: [withShipping], options: options("BALANCED", { maxProductBps: 10_000, maxSetBps: 10_000, maxTcgBps: 10_000, maxUnitsPerProduct: 1 }), now: NOW });
    expect(result.positions[0]?.unitCostCents).toBe(5_595);
  });

  it("allows unknown shipping only when explicitly enabled and warns", () => {
    const unknown = candidate({ productId: "a", bestListing: { ...candidate({ productId: "a" }).bestListing!, shippingKnown: false, shippingCents: null, totalCostCents: null } });
    const result = buildInvestmentPortfolio({ candidates: [unknown], options: options("BALANCED", { allowUnknownShipping: true, maxProductBps: 10_000, maxSetBps: 10_000, maxTcgBps: 10_000, maxUnitsPerProduct: 1 }), now: NOW });
    expect(result.positions[0]?.unitCostCents).toBe(5_000);
    expect(result.warnings.join(" ")).toContain("envío es desconocido");
  });

  it("excludes insufficient confidence", () => {
    const insufficient = candidate({ productId: "a", entryConfidence: "INSUFFICIENT", entryScore: null, entryCompleteness: 20 });
    expect(buildInvestmentPortfolio({ candidates: [insufficient], options: options(), now: NOW }).positions).toHaveLength(0);
  });

  it("treats low confidence according to strategy", () => {
    const low = candidate({ productId: "a", entryConfidence: "LOW", investmentScores: { short: 85, medium: 85, long: 85 } });
    expect(buildInvestmentPortfolio({ candidates: [low], options: options("BALANCED"), now: NOW }).positions).toHaveLength(0);
    expect(buildInvestmentPortfolio({ candidates: [low], options: options("AGGRESSIVE", { maxProductBps: 10_000, maxSetBps: 10_000, maxTcgBps: 10_000 }), now: NOW }).positions).toHaveLength(1);
  });

  it("prefers high confidence at a similar score", () => {
    const high = candidate({ productId: "high", entryConfidence: "HIGH", investmentScores: { short: 85, medium: 85, long: 85 } });
    const medium = candidate({ productId: "medium", setId: "set-b", entryConfidence: "MEDIUM", investmentScores: { short: 86, medium: 86, long: 86 } });
    const result = buildInvestmentPortfolio({ candidates: [medium, high], options: options("BALANCED", { budgetCents: 5_000, maxProductBps: 10_000, maxSetBps: 10_000, maxTcgBps: 10_000, maxUnitsPerProduct: 1 }), now: NOW });
    expect(result.positions[0]?.candidate.productId).toBe("high");
  });

  it("conservative requires stronger quality while aggressive tolerates more", () => {
    const moderate = candidate({ productId: "a", entryConfidence: "LOW", investmentScores: { short: 68, medium: 68, long: 68 } });
    expect(buildInvestmentPortfolio({ candidates: [moderate], options: options("CONSERVATIVE"), now: NOW }).positions).toHaveLength(0);
    expect(buildInvestmentPortfolio({ candidates: [moderate], options: options("AGGRESSIVE", { maxProductBps: 10_000, maxSetBps: 10_000, maxTcgBps: 10_000 }), now: NOW }).positions).toHaveLength(1);
  });

  it("aggressive utility gives entry quality more influence", () => {
    const strongEntry = candidate({ productId: "entry", entryScore: 100, investmentScores: { short: 78, medium: 78, long: 78 } });
    const strongSet = candidate({ productId: "set", entryScore: 60, setScores: { short: 98, medium: 98, long: 98 }, investmentScores: { short: 80, medium: 80, long: 80 } });
    expect(calculateCandidateUtility(strongEntry, options("AGGRESSIVE")) - calculateCandidateUtility(strongSet, options("AGGRESSIVE"))).toBeGreaterThan(calculateCandidateUtility(strongEntry, options("CONSERVATIVE")) - calculateCandidateUtility(strongSet, options("CONSERVATIVE")));
  });

  it("excludes stale listings", () => {
    const stale = candidate({ productId: "a", bestListing: { ...candidate({ productId: "a" }).bestListing!, checkedAt: "2026-08-17T10:00:00.000Z" } });
    const result = buildInvestmentPortfolio({ candidates: [stale], options: options(), now: NOW });
    expect(result.positions).toHaveLength(0);
    expect(result.alternatives[0]?.reason).toContain("desactualizado");
  });

  it("rejects a malformed one-cent price", () => {
    const malformed = candidate({ productId: "a", bestListing: { ...candidate({ productId: "a" }).bestListing!, priceCents: 1, totalCostCents: 1 } });
    expect(buildInvestmentPortfolio({ candidates: [malformed], options: options(), now: NOW }).positions).toHaveLength(0);
  });

  it("explains alternatives rejected by budget", () => {
    const expensive = candidate({ productId: "a", bestListing: { ...candidate({ productId: "a" }).bestListing!, priceCents: 31_000, totalCostCents: 31_000 } });
    const result = buildInvestmentPortfolio({ candidates: [expensive], options: options(), now: NOW });
    expect(result.alternatives[0]?.reason).toContain("presupuesto");
  });

  it("explains alternatives rejected by entry confidence", () => {
    const weakEntry = candidate({ productId: "a", entryConfidence: "INSUFFICIENT", entryCompleteness: 10, entryScore: null });
    const result = buildInvestmentPortfolio({ candidates: [weakEntry], options: options(), now: NOW });
    expect(result.alternatives[0]?.reason).toContain("insuficientes");
  });

  it("watches a strong product when its current entry price is unattractive", () => {
    const poorEntry = candidate({ productId: "a", entryScore: 25, investmentScores: { short: 90, medium: 90, long: 94 } });
    const result = buildInvestmentPortfolio({ candidates: [poorEntry], options: options("BALANCED"), now: NOW });
    expect(result.positions).toHaveLength(0);
    expect(result.alternatives[0]?.reason).toContain("entrada poco atractivo");
  });

  it("does not select an explicitly zero-quantity listing", () => {
    const unavailable = candidate({ productId: "a", availableQuantity: 0 });
    const result = buildInvestmentPortfolio({ candidates: [unavailable], options: options(), now: NOW });
    expect(result.positions).toHaveLength(0);
    expect(result.alternatives[0]?.reason).toContain("sin unidades");
  });

  it("produces deterministic output", () => {
    const candidates = [candidate({ productId: "b", setId: "set-b" }), candidate({ productId: "a", setId: "set-a" })];
    const first = buildInvestmentPortfolio({ candidates, options: options(), now: NOW });
    const second = buildInvestmentPortfolio({ candidates: [...candidates].reverse(), options: options(), now: NOW });
    expect(second.positions.map((position) => [position.candidate.productId, position.quantity])).toEqual(first.positions.map((position) => [position.candidate.productId, position.quantity]));
  });

  it.each([["HIGH", "HIGH"], ["MEDIUM", "MEDIUM"], ["LOW", "LOW"]] as const)("calculates %s portfolio confidence", (entryConfidence, expected) => {
    const item = candidate({ productId: "a", entryConfidence });
    const position = { candidate: item, listing: item.bestListing!, quantity: 1, unitCostCents: 5_000, totalCostCents: 5_000, productInvestmentScore: 86, setInvestmentScore: 90, candidateUtility: 80, reasons: [] };
    expect(calculatePortfolioConfidence([position])).toBe(expected);
  });

  it("calculates a bounded portfolio quality score", () => {
    const item = candidate({ productId: "a" });
    const position = { candidate: item, listing: item.bestListing!, quantity: 1, unitCostCents: 5_000, totalCostCents: 5_000, productInvestmentScore: 86, setInvestmentScore: 90, candidateUtility: 80, reasons: [] };
    expect(calculatePortfolioScore([position], 10_000)).toBeGreaterThanOrEqual(0);
    expect(calculatePortfolioScore([position], 10_000)).toBeLessThanOrEqual(100);
  });

  it("accepts natural comma-separated euros and rejects overlapping limits", () => {
    const valid = portfolioInputSchema.safeParse({ budgetCents: "300,50", horizon: "long", strategy: "BALANCED", tcgs: ["pokemon"], languages: [], productTypes: [], includePreorder: false, allowUnknownShipping: false, minimumScore: 70, minimumEntryConfidence: "MEDIUM", maxProductPercent: 35, maxSetPercent: 55, maxTcgPercent: 75, maxUnitsPerProduct: 3, minimumDistinctProducts: null, maxDistinctProducts: 6 });
    expect(valid.success && valid.data.budgetCents).toBe(30_050);
    const invalid = portfolioInputSchema.safeParse({ budgetCents: "300", horizon: "long", strategy: "BALANCED", tcgs: ["pokemon"], languages: [], productTypes: [], includePreorder: false, allowUnknownShipping: false, minimumScore: 70, minimumEntryConfidence: "MEDIUM", maxProductPercent: 60, maxSetPercent: 55, maxTcgPercent: 75, maxUnitsPerProduct: 3, minimumDistinctProducts: null, maxDistinctProducts: 6 });
    expect(invalid.success).toBe(false);
  });
});
