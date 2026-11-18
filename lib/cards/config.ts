export type ScoreAnchor = readonly [cents: number, score: number];

export type CardIntelligenceProfile = {
  minimumPriceCents: number;
  maximumPriceCents: number;
  staleAfterDays: number;
  jackpotTop1ShareOfTop5Bps: number;
  top1: readonly ScoreAnchor[];
  top3Average: readonly ScoreAnchor[];
  top3Total: readonly ScoreAnchor[];
  top5Average: readonly ScoreAnchor[];
  top10Total: readonly ScoreAnchor[];
  meaningfulMedian: readonly ScoreAnchor[];
};

const pokemon: CardIntelligenceProfile = {
  minimumPriceCents: 50,
  maximumPriceCents: 2_000_000,
  staleAfterDays: 7,
  jackpotTop1ShareOfTop5Bps: 6_000,
  top1: [[2_000, 10], [5_000, 40], [10_000, 68], [20_000, 88], [40_000, 100]],
  top3Average: [[1_000, 10], [3_000, 38], [7_500, 70], [15_000, 90], [25_000, 100]],
  top3Total: [[3_000, 10], [10_000, 40], [25_000, 72], [50_000, 92], [80_000, 100]],
  top5Average: [[800, 8], [2_500, 35], [6_000, 70], [12_000, 92], [20_000, 100]],
  top10Total: [[5_000, 8], [20_000, 35], [50_000, 68], [100_000, 90], [180_000, 100]],
  meaningfulMedian: [[1_000, 10], [2_000, 35], [5_000, 68], [10_000, 90], [20_000, 100]],
};

export const CARD_INTELLIGENCE_CONFIG: Readonly<Record<string, CardIntelligenceProfile>> = {
  pokemon,
  one_piece: { ...pokemon, maximumPriceCents: 3_000_000, top1: [[2_000, 8], [7_500, 38], [15_000, 68], [30_000, 90], [60_000, 100]] },
  lorcana: { ...pokemon, maximumPriceCents: 1_500_000, top1: [[1_500, 10], [4_000, 42], [8_000, 70], [16_000, 90], [30_000, 100]] },
};

export const CARD_FUNDAMENTALS_WEIGHTS = { chaseStrength: 40, chaseDepth: 35, cardValue: 25 } as const;
export const MOMENTUM_RANK_WEIGHTS = [20, 17, 15, 12, 10, 8, 7, 6, 3, 2] as const;
export const HIGH_RARITY_GROUPS = new Set(["ultra", "special", "secret", "promo"]);

export function cardIntelligenceProfile(tcg: string): CardIntelligenceProfile {
  return CARD_INTELLIGENCE_CONFIG[tcg] ?? pokemon;
}
