export type PullScoreAnchor = readonly [number, number];

export type PullRateScoringProfile = {
  hitFrequencyPacks: readonly PullScoreAnchor[];
  chaseDifficultyPacks: readonly PullScoreAnchor[];
  difficultyAppeal: readonly PullScoreAnchor[];
  communitySamples: { medium: number; high: number; established: number };
  conflictRatioBps: number;
  staleAfterDays: number;
};

const pokemon: PullRateScoringProfile = {
  hitFrequencyPacks: [[1, 55], [3, 82], [8, 100], [15, 82], [40, 35], [100, 5]],
  chaseDifficultyPacks: [[1, 0], [20, 25], [100, 50], [500, 75], [1_000, 88], [5_000, 100]],
  difficultyAppeal: [[0, 30], [30, 70], [60, 100], [82, 90], [100, 55]],
  communitySamples: { medium: 2_000, high: 10_000, established: 5_000 },
  conflictRatioBps: 25_000,
  staleAfterDays: 730,
};

export const PULL_RATE_SCORING_CONFIG: Readonly<Record<string, PullRateScoringProfile>> = {
  pokemon,
  one_piece: {
    ...pokemon,
    hitFrequencyPacks: [[1, 50], [2, 82], [6, 100], [12, 82], [30, 35], [80, 5]],
    chaseDifficultyPacks: [[1, 0], [25, 25], [150, 52], [600, 76], [1_200, 90], [6_000, 100]],
  },
  lorcana: {
    ...pokemon,
    hitFrequencyPacks: [[1, 50], [3, 85], [7, 100], [14, 80], [35, 35], [90, 5]],
    chaseDifficultyPacks: [[1, 0], [20, 25], [120, 52], [500, 75], [1_000, 88], [5_000, 100]],
  },
};

export const PULL_SOURCE_BASE_CONFIDENCE = {
  official: 92,
  community: 70,
  manual: 48,
  derived: 55,
  external: 62,
} as const;

export function pullRateProfile(tcg: string): PullRateScoringProfile {
  return PULL_RATE_SCORING_CONFIG[tcg] ?? pokemon;
}
