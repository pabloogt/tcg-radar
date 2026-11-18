import type { DealClassification } from "@/lib/market/deal";
import type { InvestmentHorizon } from "./config";
import type { EntryConfidence } from "./entry-price";
import { PORTFOLIO_CONFIDENCE_RANK, PORTFOLIO_LIMITS, PORTFOLIO_STRATEGY_DEFAULTS, type PortfolioStrategy } from "./portfolio-config";
import type { ScoreConfidence } from "./scoring";

export type PortfolioListing = {
  listingId: string;
  storeId: string;
  storeName: string;
  priceCents: number;
  shippingCents: number | null;
  shippingKnown: boolean;
  totalCostCents: number | null;
  stockStatus: string;
  checkedAt: string;
  country: string;
  url: string;
};

export type PortfolioCandidate = {
  productId: string;
  productName: string;
  setId: string;
  setName: string;
  tcg: string;
  language: string;
  productType: string;
  imageUrl: string | null;
  investmentScores: Record<InvestmentHorizon, number | null>;
  investmentConfidence: Record<InvestmentHorizon, ScoreConfidence>;
  setScores: Record<InvestmentHorizon, number | null>;
  vehicleScore: number;
  entryScore: number | null;
  entryConfidence: EntryConfidence;
  entryCompleteness: number;
  dealClassification: DealClassification | null;
  marketReferenceCents: number | null;
  bestListing: PortfolioListing | null;
  alternativeListings: PortfolioListing[];
  availableQuantity: number | null;
};

export type ExistingExposure = {
  totalCents: number;
  byProduct: Readonly<Record<string, number>>;
  bySet: Readonly<Record<string, number>>;
  byTcg: Readonly<Record<string, number>>;
};

export type PortfolioOptions = {
  budgetCents: number;
  horizon: InvestmentHorizon;
  strategy: PortfolioStrategy;
  tcgs: readonly string[];
  languages: readonly string[];
  productTypes: readonly string[];
  includePreorder: boolean;
  allowUnknownShipping: boolean;
  minimumScore: number;
  minimumEntryConfidence: Exclude<EntryConfidence, "INSUFFICIENT">;
  maxProductBps: number;
  maxSetBps: number;
  maxTcgBps: number;
  maxUnitsPerProduct: number;
  minimumDistinctProducts: number | null;
  maxDistinctProducts: number;
  staleListingHours: number;
};

export type PortfolioPosition = {
  candidate: PortfolioCandidate;
  listing: PortfolioListing;
  quantity: number;
  unitCostCents: number;
  totalCostCents: number;
  productInvestmentScore: number;
  setInvestmentScore: number | null;
  candidateUtility: number;
  reasons: string[];
};

export type PortfolioAlternative = {
  candidate: PortfolioCandidate;
  reason: string;
  kind: "alternative" | "watch";
};

export type PortfolioExposure = {
  product: Record<string, number>;
  set: Record<string, number>;
  tcg: Record<string, number>;
};

export type PortfolioResult = {
  budgetCents: number;
  allocatedCents: number;
  remainingCents: number;
  horizon: InvestmentHorizon;
  strategy: PortfolioStrategy;
  positions: PortfolioPosition[];
  diversification: PortfolioExposure;
  portfolioScore: number | null;
  confidence: EntryConfidence;
  reasons: string[];
  warnings: string[];
  alternatives: PortfolioAlternative[];
  relaxedConstraints: boolean;
};

type Rejection = { candidate: PortfolioCandidate; reason: string; kind: "alternative" | "watch" };

const emptyExposure = (): PortfolioExposure => ({ product: {}, set: {}, tcg: {} });
const cents = (record: Readonly<Record<string, number>>, key: string) => record[key] ?? 0;
const clamp = (value: number) => Math.max(0, Math.min(100, Math.round(value)));

function listingAgeHours(checkedAt: string, now: Date): number {
  return (now.getTime() - new Date(checkedAt).getTime()) / 3_600_000;
}

export function calculateCandidateUtility(candidate: PortfolioCandidate, options: PortfolioOptions): number {
  const score = candidate.investmentScores[options.horizon] ?? 0;
  const setScore = candidate.setScores[options.horizon] ?? score;
  const entry = candidate.entryScore ?? 0;
  const completeness = candidate.entryCompleteness;
  const unitCost = candidate.bestListing?.totalCostCents ?? candidate.bestListing?.priceCents ?? options.budgetCents;
  const capitalEfficiency = clamp(100 - Math.round((unitCost * 50) / Math.max(options.budgetCents, 1)));
  const weights = options.strategy === "CONSERVATIVE"
    ? { investment: 62, set: 15, entry: 8, completeness: 10, capital: 5 }
    : options.strategy === "AGGRESSIVE"
      ? { investment: 62, set: 5, entry: 20, completeness: 5, capital: 8 }
      : { investment: 70, set: 5, entry: 10, completeness: 10, capital: 5 };
  const raw = (score * weights.investment + setScore * weights.set + entry * weights.entry + completeness * weights.completeness + capitalEfficiency * weights.capital) / 100;
  const confidenceFactor = { HIGH: 1, MEDIUM: 0.95, LOW: 0.85, INSUFFICIENT: 0 }[candidate.entryConfidence];
  const availabilityFactor = candidate.bestListing?.stockStatus === "preorder" ? 0.96 : 1;
  return Math.round(raw * confidenceFactor * availabilityFactor * 100) / 100;
}

function candidateUnitCost(candidate: PortfolioCandidate, allowUnknownShipping: boolean): number | null {
  const listing = candidate.bestListing;
  if (!listing) return null;
  if (listing.totalCostCents !== null) return listing.totalCostCents;
  return allowUnknownShipping ? listing.priceCents : null;
}

function filterCandidate(candidate: PortfolioCandidate, options: PortfolioOptions, now: Date): string | null {
  if (!options.tcgs.includes(candidate.tcg)) return "TCG excluido por los filtros.";
  if (options.languages.length && !options.languages.includes(candidate.language)) return "Idioma excluido por los filtros.";
  if (options.productTypes.length && !options.productTypes.includes(candidate.productType)) return "Formato excluido por los filtros.";
  const score = candidate.investmentScores[options.horizon];
  if (score === null || score < options.minimumScore) return "Investment Score inferior al mínimo configurado.";
  if (candidate.entryConfidence === "INSUFFICIENT") return "Datos de entrada insuficientes.";
  if (PORTFOLIO_CONFIDENCE_RANK[candidate.entryConfidence] < PORTFOLIO_CONFIDENCE_RANK[options.minimumEntryConfidence]) return "Confianza de entrada inferior al mínimo configurado.";
  if (candidate.entryScore === null || candidate.entryScore < PORTFOLIO_STRATEGY_DEFAULTS[options.strategy].minimumEntryScore) return "Precio de entrada poco atractivo para la estrategia seleccionada.";
  const listing = candidate.bestListing;
  if (!listing) return "No hay una oferta comprable actual.";
  if (listing.stockStatus === "preorder" && !options.includePreorder) return "La preventa está desactivada.";
  if (listing.stockStatus !== "in_stock" && listing.stockStatus !== "preorder") return "Producto no disponible.";
  if (candidate.availableQuantity !== null && candidate.availableQuantity <= 0) return "Producto sin unidades disponibles.";
  if (listingAgeHours(listing.checkedAt, now) > options.staleListingHours) return "Precio posiblemente desactualizado.";
  if (!listing.shippingKnown && !options.allowUnknownShipping) return "Envío desconocido; total de adquisición incompleto.";
  const unitCost = candidateUnitCost(candidate, options.allowUnknownShipping);
  if (unitCost === null || unitCost < PORTFOLIO_LIMITS.minimumValidUnitCostCents) return "Precio de adquisición no válido.";
  if (unitCost > options.budgetCents) return "Supera el presupuesto disponible.";
  return null;
}

export function calculateProductExposure(positions: readonly PortfolioPosition[]): Record<string, number> {
  return positions.reduce<Record<string, number>>((result, position) => ({ ...result, [position.candidate.productId]: cents(result, position.candidate.productId) + position.totalCostCents }), {});
}

export function calculateSetExposure(positions: readonly PortfolioPosition[]): Record<string, number> {
  return positions.reduce<Record<string, number>>((result, position) => ({ ...result, [position.candidate.setId]: cents(result, position.candidate.setId) + position.totalCostCents }), {});
}

export function calculateTcgExposure(positions: readonly PortfolioPosition[]): Record<string, number> {
  return positions.reduce<Record<string, number>>((result, position) => ({ ...result, [position.candidate.tcg]: cents(result, position.candidate.tcg) + position.totalCostCents }), {});
}

export function checkDiversificationConstraints(input: {
  candidate: PortfolioCandidate;
  unitCostCents: number;
  positions: readonly PortfolioPosition[];
  options: PortfolioOptions;
  existingExposure: ExistingExposure;
}): string | null {
  const { candidate, unitCostCents, positions, options, existingExposure } = input;
  const product = calculateProductExposure(positions);
  const set = calculateSetExposure(positions);
  const tcg = calculateTcgExposure(positions);
  const denominator = Math.max(existingExposure.totalCents + options.budgetCents, options.budgetCents);
  const exceeds = (current: number, existing: number, maximumBps: number) => current + existing + unitCostCents > Math.floor((denominator * maximumBps) / 10_000);
  if (exceeds(cents(product, candidate.productId), cents(existingExposure.byProduct, candidate.productId), options.maxProductBps)) return "Superaría el límite de concentración por producto.";
  if (exceeds(cents(set, candidate.setId), cents(existingExposure.bySet, candidate.setId), options.maxSetBps)) return "Superaría el límite de concentración por colección.";
  if (exceeds(cents(tcg, candidate.tcg), cents(existingExposure.byTcg, candidate.tcg), options.maxTcgBps)) return "Superaría el límite de concentración por TCG.";
  return null;
}

export function selectPortfolioQuantity(candidate: PortfolioCandidate, positions: readonly PortfolioPosition[], options: PortfolioOptions): number {
  const current = positions.find((position) => position.candidate.productId === candidate.productId)?.quantity ?? 0;
  const available = candidate.availableQuantity ?? Number.POSITIVE_INFINITY;
  return Math.max(0, Math.min(options.maxUnitsPerProduct, available) - current);
}

function marginalUtility(candidate: PortfolioCandidate, positions: readonly PortfolioPosition[], options: PortfolioOptions): number {
  const base = calculateCandidateUtility(candidate, options);
  const sameProduct = positions.find((position) => position.candidate.productId === candidate.productId)?.quantity ?? 0;
  const sameSet = positions.filter((position) => position.candidate.setId === candidate.setId).reduce((sum, position) => sum + position.quantity, 0);
  const sameTcg = positions.filter((position) => position.candidate.tcg === candidate.tcg).reduce((sum, position) => sum + position.quantity, 0);
  const sameType = positions.filter((position) => position.candidate.productType === candidate.productType).length;
  const newProductBonus = sameProduct === 0 ? 2 : 0;
  return base + newProductBonus - sameProduct * 4 - sameSet * 1.5 - sameTcg * 0.35 - sameType * 0.25;
}

function addUnit(positions: PortfolioPosition[], candidate: PortfolioCandidate, unitCostCents: number, options: PortfolioOptions) {
  const existing = positions.find((position) => position.candidate.productId === candidate.productId);
  if (existing) {
    existing.quantity += 1;
    existing.totalCostCents += unitCostCents;
    existing.candidateUtility = calculateCandidateUtility(candidate, options);
    return;
  }
  const listing = candidate.bestListing!;
  positions.push({
    candidate,
    listing,
    quantity: 1,
    unitCostCents,
    totalCostCents: unitCostCents,
    productInvestmentScore: candidate.investmentScores[options.horizon]!,
    setInvestmentScore: candidate.setScores[options.horizon],
    candidateUtility: calculateCandidateUtility(candidate, options),
    reasons: [
      `Investment Score ${options.horizon}: ${candidate.investmentScores[options.horizon]}/100.`,
      `Entry Score: ${candidate.entryScore ?? "sin dato"}/100 con confianza ${candidate.entryConfidence.toLowerCase()}.`,
      listing.shippingKnown ? "Total de adquisición confirmado." : "Total provisional: envío desconocido.",
    ],
  });
}

export function relaxConstraintsForSmallBudget(candidates: readonly PortfolioCandidate[], options: PortfolioOptions): boolean {
  const affordable = candidates.map((candidate) => candidateUnitCost(candidate, options.allowUnknownShipping)).filter((value): value is number => value !== null && value <= options.budgetCents);
  if (!affordable.length) return false;
  const cheapest = Math.min(...affordable);
  const productLimit = Math.floor((options.budgetCents * options.maxProductBps) / 10_000);
  return cheapest > productLimit && options.budgetCents < cheapest * 3;
}

export function rankPortfolioCandidates(candidates: readonly PortfolioCandidate[], options: PortfolioOptions): PortfolioCandidate[] {
  return [...candidates].sort((left, right) => calculateCandidateUtility(right, options) - calculateCandidateUtility(left, options)
    || (right.investmentScores[options.horizon] ?? -1) - (left.investmentScores[options.horizon] ?? -1)
    || (candidateUnitCost(left, options.allowUnknownShipping) ?? Number.POSITIVE_INFINITY) - (candidateUnitCost(right, options.allowUnknownShipping) ?? Number.POSITIVE_INFINITY)
    || left.productId.localeCompare(right.productId));
}

export function calculatePortfolioConfidence(positions: readonly PortfolioPosition[]): EntryConfidence {
  if (!positions.length) return "INSUFFICIENT";
  const total = positions.reduce((sum, position) => sum + position.totalCostCents, 0);
  const weighted = positions.reduce((sum, position) => sum + PORTFOLIO_CONFIDENCE_RANK[position.candidate.entryConfidence] * position.totalCostCents, 0) / Math.max(total, 1);
  if (weighted >= 2.75) return "HIGH";
  if (weighted >= 1.75) return "MEDIUM";
  if (weighted >= 1) return "LOW";
  return "INSUFFICIENT";
}

export function calculatePortfolioScore(positions: readonly PortfolioPosition[], budgetCents: number): number | null {
  if (!positions.length) return null;
  const allocated = positions.reduce((sum, position) => sum + position.totalCostCents, 0);
  const weightedInvestment = positions.reduce((sum, position) => sum + position.productInvestmentScore * position.totalCostCents, 0) / allocated;
  const weightedEntry = positions.reduce((sum, position) => sum + (position.candidate.entryScore ?? 0) * position.totalCostCents, 0) / allocated;
  const confidence = positions.reduce((sum, position) => sum + (PORTFOLIO_CONFIDENCE_RANK[position.candidate.entryConfidence] / 3) * 100 * position.totalCostCents, 0) / allocated;
  const productExposure = calculateProductExposure(positions);
  const maximumProductShare = Math.max(...Object.values(productExposure)) / Math.max(allocated, 1);
  const distinctBonus = Math.min(100, positions.length * 25);
  const diversification = clamp((1 - maximumProductShare) * 70 + distinctBonus * 0.3);
  const utilization = Math.min(100, Math.round((allocated * 100) / Math.max(budgetCents, 1)));
  return clamp(weightedInvestment * 0.65 + weightedEntry * 0.15 + confidence * 0.1 + diversification * 0.07 + utilization * 0.03);
}

export function generatePortfolioReasons(positions: readonly PortfolioPosition[], options: PortfolioOptions): string[] {
  if (!positions.length) return [];
  const sets = new Set(positions.map((position) => position.candidate.setId)).size;
  const allAvailable = positions.every((position) => position.listing.stockStatus === "in_stock");
  return [
    `Se priorizó el score de inversión a ${options.horizon === "short" ? "corto" : options.horizon === "medium" ? "medio" : "largo"} plazo con entrada y confianza suficientes.`,
    `${positions.length} productos distintos de ${sets} colecciones.`,
    allAvailable ? "Todos los productos seleccionados están en stock." : "La propuesta incluye preventas habilitadas expresamente.",
  ];
}

export function generatePortfolioWarnings(input: { positions: readonly PortfolioPosition[]; options: PortfolioOptions; allocatedCents: number; relaxed: boolean; existingExposure: ExistingExposure }): string[] {
  const warnings: string[] = [];
  if (input.relaxed) warnings.push("El presupuesto limita la diversificación; se relajaron los límites solo para la primera posición.");
  if (input.positions.some((position) => !position.listing.shippingKnown)) warnings.push("Una posición usa precio base porque el envío es desconocido; el coste final puede ser mayor.");
  if (input.allocatedCents < input.options.budgetCents) warnings.push(`${((input.options.budgetCents - input.allocatedCents) / 100).toLocaleString("es-ES", { minimumFractionDigits: 2 })} € quedan sin asignar; no se añadió producto débil para consumirlos.`);
  if (input.options.minimumDistinctProducts !== null && input.positions.length < input.options.minimumDistinctProducts) warnings.push("No se alcanzó el mínimo solicitado de productos distintos con candidatos válidos.");
  if (input.existingExposure.totalCents > 0) warnings.push("Los límites de concentración incluyen las posiciones existentes no vendidas.");
  return warnings;
}

function finalAlternativeReason(candidate: PortfolioCandidate, positions: readonly PortfolioPosition[], options: PortfolioOptions, existingExposure: ExistingExposure, remainingCents: number): string {
  const unitCost = candidateUnitCost(candidate, options.allowUnknownShipping);
  if (unitCost === null) return "Coste total de adquisición desconocido.";
  if (unitCost > remainingCents) return "No cabe en el capital restante.";
  if (!positions.some((position) => position.candidate.productId === candidate.productId) && positions.length >= options.maxDistinctProducts) return "Se alcanzó el máximo de productos distintos.";
  if (selectPortfolioQuantity(candidate, positions, options) <= 0) return "Se alcanzó el máximo de unidades de este producto.";
  return checkDiversificationConstraints({ candidate, unitCostCents: unitCost, positions, options, existingExposure }) ?? "Quedó por debajo de otras opciones por utilidad y diversificación.";
}

export function findPortfolioAlternatives(candidates: readonly PortfolioCandidate[], positions: readonly PortfolioPosition[], options: PortfolioOptions, existingExposure: ExistingExposure, remainingCents: number, initialRejections: readonly Rejection[]): PortfolioAlternative[] {
  const selected = new Set(positions.map((position) => position.candidate.productId));
  const rejectedIds = new Set(initialRejections.map((rejection) => rejection.candidate.productId));
  const notSelected = rankPortfolioCandidates(candidates.filter((candidate) => !selected.has(candidate.productId) && !rejectedIds.has(candidate.productId)), options)
    .map((candidate) => ({ candidate, reason: finalAlternativeReason(candidate, positions, options, existingExposure, remainingCents), kind: "alternative" as const }));
  return [...initialRejections, ...notSelected].slice(0, 12);
}

export function buildInvestmentPortfolio(input: { candidates: readonly PortfolioCandidate[]; options: PortfolioOptions; existingExposure?: ExistingExposure; now?: Date }): PortfolioResult {
  const { candidates, options } = input;
  const existingExposure = input.existingExposure ?? { totalCents: 0, byProduct: {}, bySet: {}, byTcg: {} };
  const now = input.now ?? new Date();
  const rejections: Rejection[] = [];
  const eligible = candidates.filter((candidate) => {
    const reason = filterCandidate(candidate, options, now);
    if (!reason) return true;
    const watchReasons = ["No hay una oferta comprable actual.", "Producto no disponible.", "Producto sin unidades disponibles.", "Precio posiblemente desactualizado.", "Datos de entrada insuficientes.", "Precio de entrada poco atractivo para la estrategia seleccionada.", "Envío desconocido; total de adquisición incompleto."];
    rejections.push({ candidate, reason, kind: watchReasons.includes(reason) ? "watch" : "alternative" });
    return false;
  });
  const ranked = rankPortfolioCandidates(eligible, options);
  const positions: PortfolioPosition[] = [];
  let remaining = options.budgetCents;
  let relaxed = false;
  const maximumIterations = Math.max(1, options.maxDistinctProducts * options.maxUnitsPerProduct);

  for (let iteration = 0; iteration < maximumIterations; iteration += 1) {
    const choices = ranked.flatMap((candidate) => {
      const unitCost = candidateUnitCost(candidate, options.allowUnknownShipping);
      if (unitCost === null || unitCost > remaining || selectPortfolioQuantity(candidate, positions, options) <= 0) return [];
      if (!positions.some((position) => position.candidate.productId === candidate.productId) && positions.length >= options.maxDistinctProducts) return [];
      const constraint = checkDiversificationConstraints({ candidate, unitCostCents: unitCost, positions, options, existingExposure });
      if (constraint) return [];
      return [{ candidate, unitCost, utility: marginalUtility(candidate, positions, options) }];
    }).sort((left, right) => right.utility - left.utility || left.unitCost - right.unitCost || left.candidate.productId.localeCompare(right.candidate.productId));
    const choice = choices[0];
    if (!choice) break;
    addUnit(positions, choice.candidate, choice.unitCost, options);
    remaining -= choice.unitCost;
  }

  if (!positions.length && relaxConstraintsForSmallBudget(ranked, options)) {
    const choice = ranked.flatMap((candidate) => { const unitCost = candidateUnitCost(candidate, options.allowUnknownShipping); return unitCost !== null && unitCost <= remaining ? [{ candidate, unitCost }] : []; })[0];
    if (choice) { addUnit(positions, choice.candidate, choice.unitCost, options); remaining -= choice.unitCost; relaxed = true; }
  }

  positions.sort((left, right) => right.candidateUtility - left.candidateUtility || left.candidate.productId.localeCompare(right.candidate.productId));
  const allocatedCents = options.budgetCents - remaining;
  return {
    budgetCents: options.budgetCents,
    allocatedCents,
    remainingCents: remaining,
    horizon: options.horizon,
    strategy: options.strategy,
    positions,
    diversification: positions.length ? { product: calculateProductExposure(positions), set: calculateSetExposure(positions), tcg: calculateTcgExposure(positions) } : emptyExposure(),
    portfolioScore: calculatePortfolioScore(positions, options.budgetCents),
    confidence: calculatePortfolioConfidence(positions),
    reasons: generatePortfolioReasons(positions, options),
    warnings: generatePortfolioWarnings({ positions, options, allocatedCents, relaxed, existingExposure }),
    alternatives: findPortfolioAlternatives(candidates, positions, options, existingExposure, remaining, rejections),
    relaxedConstraints: relaxed,
  };
}
