import { CARD_FUNDAMENTALS_WEIGHTS, HIGH_RARITY_GROUPS, MOMENTUM_RANK_WEIGHTS, cardIntelligenceProfile, type CardIntelligenceProfile, type ScoreAnchor } from "./config";

export type CardAnalyticsConfidence = "HIGH" | "MEDIUM" | "LOW" | "INSUFFICIENT";
export type CardValueFlag = { status: "valid" | "suspect" | "excluded"; reason: "price_too_low" | "price_too_high" | "extreme_jump" | "invalid_currency" | "stale" | null };
export type CardAnalyticsCard = { id: string; name: string; cardNumber: string; rarity: string; rarityGroup: string | null; imageUrl: string | null; characterName: string | null; variantName: string | null };
export type CardPriceObservation = { id: string; cardId: string; source: string; currency: string; marketPriceCents: number | null; lowPriceCents: number | null; trendPriceCents: number | null; observedAt: string };
export type CardMarketValue = { cardId: string; priceCents: number; source: string; confidence: Exclude<CardAnalyticsConfidence, "INSUFFICIENT">; observedAt: string; flag: CardValueFlag };
export type CardPriceChanges = { oneDayBps: number | null; sevenDayBps: number | null; thirtyDayBps: number | null };
export type RankedCard = { card: CardAnalyticsCard; value: CardMarketValue; changes: CardPriceChanges };
export type TopCardMetrics = {
  cardCount: number; pricedCardCount: number; top1Value: number | null; top3Total: number | null; top5Total: number | null; top10Total: number | null;
  top3Average: number | null; top5Average: number | null; top10Average: number | null;
  cardsAbove10: number; cardsAbove20: number; cardsAbove30: number; cardsAbove50: number; cardsAbove100: number; cardsAbove200: number;
  medianCardPrice: number | null; meanTop10Price: number | null; top1ShareOfTop5Bps: number | null; top1ShareOfTop10Bps: number | null;
  valueConcentration: number; priceCoverageBps: number;
};
export type SetCardMomentum = { score: number | null; weightedChangeBps: number | null; confidence: CardAnalyticsConfidence; cardsUsed: number };
export type SetCardAnalytics = {
  setId: string; tcg: string; metrics: TopCardMetrics; topCards: RankedCard[]; chaseStrength: number | null; chaseDepth: number | null; cardValue: number | null;
  chaseConcentration: number; jackpotDependency: boolean; concentrationLabel: "LOW" | "MEDIUM" | "HIGH";
  priceCoverageBps: number; topCardCoverageBps: number; confidence: CardAnalyticsConfidence; momentum: SetCardMomentum;
  cardFundamentalsScore: number | null; cardFundamentalsCompleteness: number; cardFundamentalsConfidence: CardAnalyticsConfidence;
  topCharacters: { name: string; priceCents: number; cardName: string }[];
};

const DAY = 86_400_000;
const validInteger = (value: number | null): value is number => value !== null && Number.isInteger(value);
const clamp = (value: number) => Math.max(0, Math.min(100, Math.round(value)));

function median(values: readonly number[]): number | null { if (!values.length) return null; const sorted = [...values].sort((a, b) => a - b); const middle = Math.floor(sorted.length / 2); return sorted.length % 2 ? sorted[middle] : Math.round((sorted[middle - 1] + sorted[middle]) / 2); }
function sumTop(values: readonly number[], count: number): number | null { return values.length ? values.slice(0, count).reduce((sum, value) => sum + value, 0) : null; }
function averageTop(values: readonly number[], count: number): number | null { const selected = values.slice(0, count); return selected.length ? Math.round(selected.reduce((sum, value) => sum + value, 0) / selected.length) : null; }
function interpolate(value: number, anchors: readonly ScoreAnchor[]): number { if (value <= anchors[0][0]) return anchors[0][1]; if (value >= anchors.at(-1)![0]) return anchors.at(-1)![1]; for (let index = 1; index < anchors.length; index += 1) { const left = anchors[index - 1]; const right = anchors[index]; if (value <= right[0]) return Math.round(left[1] + ((value - left[0]) * (right[1] - left[1])) / (right[0] - left[0])); } return anchors.at(-1)![1]; }
function preferredPrice(observation: CardPriceObservation): number | null { return observation.marketPriceCents ?? observation.trendPriceCents ?? observation.lowPriceCents; }

export function detectPriceOutlier(input: { priceCents: number; currency: string; observedAt: string; now: Date; profile: CardIntelligenceProfile; historicalPrices?: readonly number[] }): CardValueFlag {
  if (input.currency !== "EUR") return { status: "excluded", reason: "invalid_currency" };
  if (input.priceCents < input.profile.minimumPriceCents) return { status: "excluded", reason: "price_too_low" };
  if (input.priceCents > input.profile.maximumPriceCents) return { status: "excluded", reason: "price_too_high" };
  const age = input.now.getTime() - new Date(input.observedAt).getTime();
  if (age > input.profile.staleAfterDays * DAY) return { status: "excluded", reason: "stale" };
  const baseline = median((input.historicalPrices ?? []).filter((value) => value >= input.profile.minimumPriceCents && value <= input.profile.maximumPriceCents));
  if (baseline && input.priceCents > baseline * 5 && input.priceCents - baseline > 50_000) return { status: "suspect", reason: "extreme_jump" };
  return { status: "valid", reason: null };
}

export function resolveCurrentCardValue(cardId: string, observations: readonly CardPriceObservation[], tcg: string, now: Date): CardMarketValue | null {
  const profile = cardIntelligenceProfile(tcg);
  const cardObservations = observations.filter((entry) => entry.cardId === cardId).sort((a, b) => b.observedAt.localeCompare(a.observedAt));
  const latestBySource = new Map<string, CardPriceObservation>();
  for (const observation of cardObservations) if (!latestBySource.has(observation.source)) latestBySource.set(observation.source, observation);
  const usable = [...latestBySource.values()].flatMap((observation) => { const price = preferredPrice(observation); if (!validInteger(price)) return []; const older = cardObservations.filter((entry) => entry.observedAt < observation.observedAt).flatMap((entry) => { const value = preferredPrice(entry); return validInteger(value) ? [value] : []; }); const flag = detectPriceOutlier({ priceCents: price, currency: observation.currency, observedAt: observation.observedAt, now, profile, historicalPrices: older }); return flag.status === "valid" ? [{ observation, price, flag }] : []; });
  if (!usable.length) return null;
  const priceCents = median(usable.map((item) => item.price))!;
  const observedAt = usable.map((item) => item.observation.observedAt).sort().at(-1)!;
  return { cardId, priceCents, source: usable.map((item) => item.observation.source).sort().join("+"), confidence: usable.length >= 3 ? "HIGH" : usable.length === 2 ? "MEDIUM" : "LOW", observedAt, flag: { status: "valid", reason: null } };
}

function nearestBefore(observations: readonly CardPriceObservation[], target: Date, maximumLookbackDays: number, profile: CardIntelligenceProfile): number | null {
  const lower = target.getTime() - maximumLookbackDays * DAY;
  for (const observation of [...observations].sort((a, b) => b.observedAt.localeCompare(a.observedAt))) { const timestamp = new Date(observation.observedAt).getTime(); const price = preferredPrice(observation); if (timestamp <= target.getTime() && timestamp >= lower && observation.currency === "EUR" && validInteger(price) && price >= profile.minimumPriceCents && price <= profile.maximumPriceCents) return price; }
  return null;
}

export function calculateCardPriceChange(currentPriceCents: number, observations: readonly CardPriceObservation[], tcg: string, now: Date): CardPriceChanges {
  const profile = cardIntelligenceProfile(tcg);
  const change = (days: number, tolerance: number) => { const previous = nearestBefore(observations, new Date(now.getTime() - days * DAY), tolerance, profile); return previous ? Math.round(((currentPriceCents - previous) * 10_000) / previous) : null; };
  return { oneDayBps: change(1, 3), sevenDayBps: change(7, 7), thirtyDayBps: change(30, 14) };
}

export function rankTopCards(cards: readonly CardAnalyticsCard[], observations: readonly CardPriceObservation[], tcg: string, now: Date): RankedCard[] {
  return cards.flatMap((card) => { const value = resolveCurrentCardValue(card.id, observations, tcg, now); return value ? [{ card, value, changes: calculateCardPriceChange(value.priceCents, observations.filter((entry) => entry.cardId === card.id), tcg, now) }] : []; }).sort((a, b) => b.value.priceCents - a.value.priceCents || a.card.id.localeCompare(b.card.id));
}

export function calculateChaseConcentration(top1ShareOfTop5Bps: number | null, top1ShareOfTop10Bps: number | null): number {
  if (top1ShareOfTop5Bps === null && top1ShareOfTop10Bps === null) return 0;
  const top5 = top1ShareOfTop5Bps ?? top1ShareOfTop10Bps!;
  const top10 = top1ShareOfTop10Bps ?? top5;
  return clamp(((top5 - 2_000) * 70) / 6_000 + ((top10 - 1_000) * 30) / 7_000);
}

export function calculateTopCardMetrics(pricesDescending: readonly number[], cardCount: number): TopCardMetrics {
  const prices = pricesDescending.filter((value) => Number.isInteger(value) && value > 0).sort((a, b) => b - a);
  const top1 = prices[0] ?? null; const top5 = sumTop(prices, 5); const top10 = sumTop(prices, 10);
  const share = (total: number | null) => top1 !== null && total ? Math.round((top1 * 10_000) / total) : null;
  const top1ShareOfTop5Bps = share(top5); const top1ShareOfTop10Bps = share(top10);
  return { cardCount, pricedCardCount: prices.length, top1Value: top1, top3Total: sumTop(prices, 3), top5Total: top5, top10Total: top10, top3Average: averageTop(prices, 3), top5Average: averageTop(prices, 5), top10Average: averageTop(prices, 10), cardsAbove10: prices.filter((value) => value > 1_000).length, cardsAbove20: prices.filter((value) => value > 2_000).length, cardsAbove30: prices.filter((value) => value > 3_000).length, cardsAbove50: prices.filter((value) => value > 5_000).length, cardsAbove100: prices.filter((value) => value > 10_000).length, cardsAbove200: prices.filter((value) => value > 20_000).length, medianCardPrice: median(prices), meanTop10Price: averageTop(prices, 10), top1ShareOfTop5Bps, top1ShareOfTop10Bps, valueConcentration: calculateChaseConcentration(top1ShareOfTop5Bps, top1ShareOfTop10Bps), priceCoverageBps: cardCount ? Math.round((prices.length * 10_000) / cardCount) : 0 };
}

export function calculateChaseStrength(metrics: TopCardMetrics, tcg: string): number | null { if (metrics.top1Value === null || metrics.top3Average === null || metrics.top3Total === null) return null; const profile = cardIntelligenceProfile(tcg); return clamp(interpolate(metrics.top1Value, profile.top1) * 0.45 + interpolate(metrics.top3Average, profile.top3Average) * 0.3 + interpolate(metrics.top3Total, profile.top3Total) * 0.25); }
export function calculateChaseDepth(metrics: TopCardMetrics, tcg: string): number | null { if (metrics.top5Average === null || metrics.top10Total === null) return null; const profile = cardIntelligenceProfile(tcg); const breadth = clamp(metrics.cardsAbove20 * 8 + metrics.cardsAbove50 * 5 + metrics.cardsAbove100 * 4); return clamp(interpolate(metrics.top5Average, profile.top5Average) * 0.3 + interpolate(metrics.top10Total, profile.top10Total) * 0.25 + breadth * 0.25 + (100 - metrics.valueConcentration) * 0.2); }
export function calculateCardValueScore(metrics: TopCardMetrics, tcg: string): number | null { if (metrics.top5Total === null || metrics.top10Total === null) return null; const profile = cardIntelligenceProfile(tcg); const top5Score = interpolate(metrics.top5Total, profile.top3Total); const top10Score = interpolate(metrics.top10Total, profile.top10Total); const medianScore = metrics.medianCardPrice === null ? 0 : interpolate(metrics.medianCardPrice, profile.meaningfulMedian); const breadth = clamp(metrics.cardsAbove10 * 4 + metrics.cardsAbove20 * 6 + metrics.cardsAbove50 * 5); return clamp(top5Score * 0.35 + top10Score * 0.35 + medianScore * 0.15 + breadth * 0.15); }
export function calculateCardFundamentalsScore(chaseStrength: number | null, chaseDepth: number | null, cardValue: number | null): { score: number | null; completeness: number; confidence: CardAnalyticsConfidence } { const entries: { value: number | null; weight: number }[] = [{ value: chaseStrength, weight: CARD_FUNDAMENTALS_WEIGHTS.chaseStrength }, { value: chaseDepth, weight: CARD_FUNDAMENTALS_WEIGHTS.chaseDepth }, { value: cardValue, weight: CARD_FUNDAMENTALS_WEIGHTS.cardValue }]; const available = entries.filter((entry) => entry.value !== null); const completeness = available.reduce((sum, entry) => sum + entry.weight, 0); const score = completeness ? Math.round(available.reduce((sum, entry) => sum + (entry.value ?? 0) * entry.weight, 0) / completeness) : null; return { score, completeness, confidence: completeness === 100 ? "HIGH" : completeness >= 65 ? "MEDIUM" : completeness >= 40 ? "LOW" : "INSUFFICIENT" }; }
export function calculatePriceCoverage(cardCount: number, pricedCardCount: number): number { return cardCount > 0 ? Math.min(10_000, Math.round((pricedCardCount * 10_000) / cardCount)) : 0; }
export function calculateCardAnalyticsConfidence(priceCoverageBps: number, pricedCardCount: number, staleCount = 0): CardAnalyticsConfidence { const adjusted = Math.max(0, priceCoverageBps - Math.round((staleCount * 10_000) / Math.max(pricedCardCount + staleCount, 1))); if (pricedCardCount >= 10 && adjusted >= 7_500) return "HIGH"; if (pricedCardCount >= 5 && adjusted >= 5_000) return "MEDIUM"; if (pricedCardCount >= 2 && adjusted >= 2_000) return "LOW"; return "INSUFFICIENT"; }

export function calculateSetCardMomentum(topCards: readonly RankedCard[], priceCoverageBps: number): SetCardMomentum {
  const movements = topCards.slice(0, 10).flatMap((card, index) => { const available = [card.changes.sevenDayBps, card.changes.thirtyDayBps].filter((value): value is number => value !== null); if (!available.length) return []; const movement = available.length === 2 ? Math.round(available[0] * 0.6 + available[1] * 0.4) : available[0]; return [{ movement: Math.max(-3_000, Math.min(3_000, movement)), weight: MOMENTUM_RANK_WEIGHTS[index] }]; });
  if (movements.length < 2) return { score: null, weightedChangeBps: null, confidence: "INSUFFICIENT", cardsUsed: movements.length };
  const weight = movements.reduce((sum, item) => sum + item.weight, 0); const weightedChangeBps = Math.round(movements.reduce((sum, item) => sum + item.movement * item.weight, 0) / weight); const score = clamp(50 + weightedChangeBps / 60);
  const confidence: CardAnalyticsConfidence = movements.length >= 5 && priceCoverageBps >= 7_000 ? "HIGH" : movements.length >= 3 && priceCoverageBps >= 5_000 ? "MEDIUM" : "LOW";
  return { score, weightedChangeBps, confidence, cardsUsed: movements.length };
}

export function calculateSetCardAnalytics(input: { setId: string; tcg: string; cards: readonly CardAnalyticsCard[]; observations: readonly CardPriceObservation[]; now: Date }): SetCardAnalytics {
  const topCards = rankTopCards(input.cards, input.observations, input.tcg, input.now);
  const metrics = calculateTopCardMetrics(topCards.map((card) => card.value.priceCents), input.cards.length);
  const chaseStrength = calculateChaseStrength(metrics, input.tcg); const chaseDepth = calculateChaseDepth(metrics, input.tcg); const cardValue = calculateCardValueScore(metrics, input.tcg);
  const highRarity = input.cards.filter((card) => card.rarityGroup && HIGH_RARITY_GROUPS.has(card.rarityGroup)); const priced = new Set(topCards.map((card) => card.card.id)); const topCardCoverageBps = highRarity.length ? Math.round((highRarity.filter((card) => priced.has(card.id)).length * 10_000) / highRarity.length) : metrics.priceCoverageBps;
  const staleCount = input.cards.filter((card) => input.observations.some((entry) => entry.cardId === card.id) && !priced.has(card.id)).length;
  const confidence = calculateCardAnalyticsConfidence(metrics.priceCoverageBps, metrics.pricedCardCount, staleCount); const momentum = calculateSetCardMomentum(topCards, metrics.priceCoverageBps); const fundamentals = calculateCardFundamentalsScore(chaseStrength, chaseDepth, cardValue); const profile = cardIntelligenceProfile(input.tcg);
  const characters = new Map<string, { name: string; priceCents: number; cardName: string }>(); for (const ranked of topCards) { const name = ranked.card.characterName; if (!name) continue; const current = characters.get(name.toLocaleLowerCase("es")); if (!current || ranked.value.priceCents > current.priceCents) characters.set(name.toLocaleLowerCase("es"), { name, priceCents: ranked.value.priceCents, cardName: ranked.card.name }); }
  return { setId: input.setId, tcg: input.tcg, metrics, topCards: topCards.slice(0, 10), chaseStrength, chaseDepth, cardValue, chaseConcentration: metrics.valueConcentration, jackpotDependency: (metrics.top1ShareOfTop5Bps ?? 0) >= profile.jackpotTop1ShareOfTop5Bps, concentrationLabel: metrics.valueConcentration >= 70 ? "HIGH" : metrics.valueConcentration >= 40 ? "MEDIUM" : "LOW", priceCoverageBps: metrics.priceCoverageBps, topCardCoverageBps, confidence, momentum, cardFundamentalsScore: fundamentals.score, cardFundamentalsCompleteness: fundamentals.completeness, cardFundamentalsConfidence: fundamentals.confidence, topCharacters: [...characters.values()].sort((a, b) => b.priceCents - a.priceCents || a.name.localeCompare(b.name)).slice(0, 5) };
}
