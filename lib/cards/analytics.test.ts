import { describe, expect, it } from "vitest";
import { calculateCardAnalyticsConfidence, calculateCardFundamentalsScore, calculateCardPriceChange, calculateCardValueScore, calculateChaseConcentration, calculateChaseDepth, calculateChaseStrength, calculateSetCardAnalytics, calculateSetCardMomentum, calculateTopCardMetrics, detectPriceOutlier, rankTopCards, resolveCurrentCardValue, type CardAnalyticsCard, type CardPriceObservation, type RankedCard } from "./analytics";
import { cardIntelligenceProfile } from "./config";

const NOW = new Date("2026-08-19T12:00:00.000Z");
const card = (id: string, overrides: Partial<CardAnalyticsCard> = {}): CardAnalyticsCard => ({ id, name: `Card ${id}`, cardNumber: id, rarity: "Special", rarityGroup: "special", imageUrl: null, characterName: null, variantName: null, ...overrides });
const observation = (cardId: string, price: number, daysAgo = 0, overrides: Partial<CardPriceObservation> = {}): CardPriceObservation => ({ id: `${cardId}-${daysAgo}-${overrides.source ?? "manual"}`, cardId, source: "manual", currency: "EUR", marketPriceCents: price, lowPriceCents: null, trendPriceCents: null, observedAt: new Date(NOW.getTime() - daysAgo * 86_400_000).toISOString(), ...overrides });

describe("set card intelligence analytics", () => {
  it("calculates top 1/3/5/10 values", () => {
    const metrics = calculateTopCardMetrics([10_000, 9_000, 8_000, 7_000, 6_000, 5_000, 4_000, 3_000, 2_000, 1_000], 10);
    expect(metrics).toMatchObject({ top1Value: 10_000, top3Total: 27_000, top5Total: 40_000, top10Total: 55_000 });
    expect(metrics.top3Average).toBe(9_000);
  });

  it("counts strict value thresholds", () => {
    const metrics = calculateTopCardMetrics([20_001, 10_001, 5_001, 3_001, 2_001, 1_001, 1_000], 7);
    expect(metrics).toMatchObject({ cardsAbove10: 6, cardsAbove20: 5, cardsAbove30: 4, cardsAbove50: 3, cardsAbove100: 2, cardsAbove200: 1 });
  });

  it("gives a distributed deep set stronger chase depth than a jackpot set", () => {
    const jackpot = calculateTopCardMetrics([40_000, 2_500, 1_800, 1_200, 1_000, 800, 700, 600, 500, 400], 10);
    const deep = calculateTopCardMetrics([20_000, 15_000, 11_000, 9_000, 7_000, 6_000, 5_500, 4_500, 4_000, 3_500], 10);
    expect(calculateChaseDepth(deep, "pokemon")!).toBeGreaterThan(calculateChaseDepth(jackpot, "pokemon")!);
  });

  it("detects high single-chase concentration", () => {
    const concentrated = calculateTopCardMetrics([40_000, 2_000, 1_000, 800, 500], 5);
    const distributed = calculateTopCardMetrics([20_000, 18_000, 16_000, 14_000, 12_000], 5);
    expect(concentrated.valueConcentration).toBeGreaterThan(70);
    expect(distributed.valueConcentration).toBeLessThan(concentrated.valueConcentration);
    expect(calculateChaseConcentration(distributed.top1ShareOfTop5Bps, distributed.top1ShareOfTop10Bps)).toBe(distributed.valueConcentration);
  });

  it("scores strong chase cards above weak chase cards", () => {
    const strong = calculateTopCardMetrics([40_000, 20_000, 15_000], 3);
    const weak = calculateTopCardMetrics([2_000, 1_000, 500], 3);
    expect(calculateChaseStrength(strong, "pokemon")!).toBeGreaterThan(90);
    expect(calculateChaseStrength(weak, "pokemon")!).toBeLessThan(30);
  });

  it("scores a deep valuable ecosystem highly", () => {
    const deep = calculateTopCardMetrics([20_000, 15_000, 11_000, 9_000, 7_000, 6_000, 5_500, 4_500, 4_000, 3_500], 10);
    expect(calculateCardValueScore(deep, "pokemon")!).toBeGreaterThan(70);
  });

  it("uses TCG-specific chase curves", () => {
    const metrics = calculateTopCardMetrics([10_000, 8_000, 6_000], 3);
    expect(calculateChaseStrength(metrics, "pokemon")).not.toBe(calculateChaseStrength(metrics, "one_piece"));
  });

  it("excludes one-cent and absurd prices but preserves a normal expensive card", () => {
    const profile = cardIntelligenceProfile("pokemon");
    expect(detectPriceOutlier({ priceCents: 1, currency: "EUR", observedAt: NOW.toISOString(), now: NOW, profile }).reason).toBe("price_too_low");
    expect(detectPriceOutlier({ priceCents: 99_999_900, currency: "EUR", observedAt: NOW.toISOString(), now: NOW, profile }).reason).toBe("price_too_high");
    expect(detectPriceOutlier({ priceCents: 100_000, currency: "EUR", observedAt: NOW.toISOString(), now: NOW, profile }).status).toBe("valid");
  });

  it("marks an extreme historical jump as suspect", () => {
    const result = detectPriceOutlier({ priceCents: 100_000, currency: "EUR", observedAt: NOW.toISOString(), now: NOW, profile: cardIntelligenceProfile("pokemon"), historicalPrices: [10_000, 10_500, 9_500] });
    expect(result).toEqual({ status: "suspect", reason: "extreme_jump" });
  });

  it("never mixes USD into EUR analytics", () => {
    expect(resolveCurrentCardValue("a", [observation("a", 10_000, 0, { currency: "USD" }), observation("a", 8_000, 0, { source: "eur" })], "pokemon", NOW)).toMatchObject({ priceCents: 8_000, source: "eur" });
  });

  it("uses robust median across independent current sources", () => {
    const result = resolveCurrentCardValue("a", [observation("a", 10_000, 0, { source: "a" }), observation("a", 10_500, 0, { source: "b" }), observation("a", 80_000, 0, { source: "c" })], "pokemon", NOW);
    expect(result).toMatchObject({ priceCents: 10_500, confidence: "HIGH" });
  });

  it("uses one valid price with low confidence", () => {
    expect(resolveCurrentCardValue("a", [observation("a", 10_000)], "pokemon", NOW)?.confidence).toBe("LOW");
  });

  it("prefers a market value over an extreme lowest listing field", () => {
    const value = resolveCurrentCardValue("a", [observation("a", 10_000, 0, { lowPriceCents: 1 })], "pokemon", NOW);
    expect(value?.priceCents).toBe(10_000);
  });

  it("stale current data is excluded and reduces coverage", () => {
    const analytics = calculateSetCardAnalytics({ setId: "set", tcg: "pokemon", cards: [card("a"), card("b")], observations: [observation("a", 10_000, 8), observation("b", 5_000, 0)], now: NOW });
    expect(analytics.metrics.pricedCardCount).toBe(1);
    expect(analytics.confidence).toBe("INSUFFICIENT");
  });

  it("calculates nearest-before 1d/7d/30d price changes", () => {
    const observations = [observation("a", 13_000, 0), observation("a", 12_000, 2), observation("a", 10_000, 8), observation("a", 8_000, 31)];
    expect(calculateCardPriceChange(13_000, observations, "pokemon", NOW)).toEqual({ oneDayBps: 833, sevenDayBps: 3_000, thirtyDayBps: 6_250 });
  });

  function ranked(id: string, sevenDayBps: number | null, thirtyDayBps: number | null): RankedCard { return { card: card(id), value: { cardId: id, priceCents: 10_000, source: "manual", confidence: "LOW", observedAt: NOW.toISOString(), flag: { status: "valid", reason: null } }, changes: { oneDayBps: null, sevenDayBps, thirtyDayBps } }; }

  it("maps positive, negative and neutral momentum around 50", () => {
    expect(calculateSetCardMomentum([ranked("a", 1_500, 1_500), ranked("b", 1_500, 1_500), ranked("c", 1_500, 1_500)], 8_000).score).toBeGreaterThan(70);
    expect(calculateSetCardMomentum([ranked("a", -1_500, -1_500), ranked("b", -1_500, -1_500), ranked("c", -1_500, -1_500)], 8_000).score).toBeLessThan(30);
    expect(calculateSetCardMomentum([ranked("a", 0, 0), ranked("b", 0, 0), ranked("c", 0, 0)], 8_000).score).toBe(50);
  });

  it("returns insufficient momentum with fewer than two cards", () => {
    expect(calculateSetCardMomentum([ranked("a", 500, 500)], 10_000)).toMatchObject({ score: null, confidence: "INSUFFICIENT" });
  });

  it("exposes every card analytics confidence band", () => {
    expect(calculateCardAnalyticsConfidence(9_000, 20)).toBe("HIGH");
    expect(calculateCardAnalyticsConfidence(6_000, 8)).toBe("MEDIUM");
    expect(calculateCardAnalyticsConfidence(3_000, 3)).toBe("LOW");
    expect(calculateCardAnalyticsConfidence(1_000, 1)).toBe("INSUFFICIENT");
  });

  it("calculates card fundamentals as 40/35/25", () => {
    expect(calculateCardFundamentalsScore(100, 80, 60)).toMatchObject({ score: 83, completeness: 100, confidence: "HIGH" });
  });

  it("calculates high-rarity top-card coverage", () => {
    const cards = [card("a", { rarityGroup: "secret" }), card("b", { rarityGroup: "common" }), card("c", { rarityGroup: "special" })];
    const analytics = calculateSetCardAnalytics({ setId: "set", tcg: "pokemon", cards, observations: [observation("a", 10_000), observation("b", 100)], now: NOW });
    expect(analytics.topCardCoverageBps).toBe(5_000);
  });

  it("keeps one best card per character in character summary", () => {
    const cards = [card("a", { characterName: "Eevee" }), card("b", { characterName: "Eevee" }), card("c", { characterName: "Greninja" })];
    const analytics = calculateSetCardAnalytics({ setId: "set", tcg: "pokemon", cards, observations: [observation("a", 10_000), observation("b", 5_000), observation("c", 8_000)], now: NOW });
    expect(analytics.topCharacters).toEqual([{ name: "Eevee", priceCents: 10_000, cardName: "Card a" }, { name: "Greninja", priceCents: 8_000, cardName: "Card c" }]);
  });

  it("ranks top cards deterministically", () => {
    const cards = [card("b"), card("a")]; const prices = [observation("a", 10_000), observation("b", 10_000)];
    expect(rankTopCards(cards, prices, "pokemon", NOW).map((item) => item.card.id)).toEqual(["a", "b"]);
  });

  it("produces identical analytics for identical data", () => {
    const input = { setId: "set", tcg: "pokemon", cards: [card("a"), card("b")], observations: [observation("a", 10_000), observation("b", 5_000)], now: NOW };
    expect(calculateSetCardAnalytics(input)).toEqual(calculateSetCardAnalytics(input));
  });
});
