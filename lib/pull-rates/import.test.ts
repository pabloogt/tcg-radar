import { describe, expect, it } from "vitest";
import { normalizePullCategory, runPullRateImport, type PullImportCard, type PullRateImportRepository, type PullRateWrite } from "./import";

class FakeRepository implements PullRateImportRepository {
  cards: PullImportCard[] = [];
  keys = new Set<string>();
  writes: PullRateWrite[][] = [];
  async listCards() { return this.cards; }
  async listObservationKeys() { return this.keys; }
  async upsertRates(rates: readonly PullRateWrite[]) { this.writes.push([...rates]); }
}

const card: PullImportCard = { id: "card-1", cardNumber: "214/167", variantName: "SIR", externalIds: {} };

describe("pull-rate imports", () => {
  it("imports quoted CSV and normalizes 1/10", async () => {
    const repository = new FakeRepository(); const csv = 'category,odds,source,source_type,sample_size\n"High rarity",1/10,study,community,10000';
    const summary = await runPullRateImport({ content: csv, format: "csv", setId: "set-1", dryRun: false, repository });
    expect(summary).toMatchObject({ rowsRead: 1, matchedSets: 1, recordsCreated: 1 }); expect(repository.writes[0][0].probabilityPpm).toBe(100_000);
  });

  it("supports JSON and natural percent values", async () => {
    const repository = new FakeRepository(); const content = JSON.stringify({ pull_rates: [{ category: "Any hit", probability: "10%", source: "manual", source_type: "manual" }] });
    await runPullRateImport({ content, format: "json", setId: "set-1", dryRun: false, repository });
    expect(repository.writes[0][0]).toMatchObject({ categoryGroup: "ANY_HIT", probabilityPpm: 100_000 });
  });

  it("matches a specific card and keeps variant identity strict", async () => {
    const repository = new FakeRepository(); repository.cards = [card];
    const content = JSON.stringify([{ category: "Specific card", card_number: "214/167", variant_name: "SIR", packs_per_hit: 900, source: "study", source_type: "community" }]);
    const summary = await runPullRateImport({ content, format: "json", setId: "set-1", dryRun: true, repository });
    expect(summary.matchedCards).toBe(1); expect(summary.recordsCreated).toBe(1);
  });

  it("rejects an invalid or ambiguous card link", async () => {
    const repository = new FakeRepository(); repository.cards = [card, { ...card, id: "card-2", variantName: "Parallel" }];
    const content = JSON.stringify([{ category: "Specific", card_number: "214/167", odds: "1/900", source: "study", source_type: "community" }]);
    const summary = await runPullRateImport({ content, format: "json", setId: "set-1", dryRun: true, repository });
    expect(summary.recordsCreated).toBe(0); expect(summary.errors[0].message).toContain("ambigua");
  });

  it("rejects malformed probabilities and negative samples", async () => {
    const repository = new FakeRepository(); const content = JSON.stringify([{ category: "Hit", odds: "1/0", sample_size: -1, source: "manual", source_type: "manual" }]);
    const summary = await runPullRateImport({ content, format: "json", setId: "set-1", dryRun: true, repository });
    expect(summary.errors).toHaveLength(1); expect(summary.recordsCreated).toBe(0);
  });

  it("rejects conflicting probability representations", async () => {
    const repository = new FakeRepository(); const content = JSON.stringify([{ category: "Hit", odds: "1/10", probability: "25%", source: "manual", source_type: "manual" }]);
    const summary = await runPullRateImport({ content, format: "json", setId: "set-1", dryRun: true, repository });
    expect(summary.recordsCreated).toBe(0); expect(summary.errors[0].message).toContain("normalizar");
  });

  it("previews without database writes", async () => {
    const repository = new FakeRepository(); const content = JSON.stringify([{ category: "High rarity", odds: "1/12", source: "manual", source_type: "manual" }]);
    const summary = await runPullRateImport({ content, format: "json", setId: "set-1", dryRun: true, repository });
    expect(summary.recordsCreated).toBe(1); expect(repository.writes).toHaveLength(0);
  });

  it("updates the same current observation instead of duplicating it", async () => {
    const repository = new FakeRepository(); repository.keys.add("manual|HIGH_RARITY_HIT|high rarity||tier|current");
    const content = JSON.stringify([{ category: "High rarity", category_group: "HIGH_RARITY_HIT", odds: "1/12", source: "manual", source_type: "manual" }]);
    const summary = await runPullRateImport({ content, format: "json", setId: "set-1", dryRun: false, repository });
    expect(summary).toMatchObject({ recordsCreated: 0, recordsUpdated: 1 }); expect(repository.writes).toHaveLength(1);
  });

  it("preserves dated observations as separate history", async () => {
    const repository = new FakeRepository(); const content = JSON.stringify([{ category: "High rarity", category_group: "HIGH_RARITY_HIT", odds: "1/12", source: "manual", source_type: "manual", observed_at: "2026-09-13T10:00:00Z" }]);
    const summary = await runPullRateImport({ content, format: "json", setId: "set-1", dryRun: true, repository });
    expect(summary.recordsCreated).toBe(1);
  });

  it("maps flexible generic categories without Pokémon-only enums", () => {
    expect(normalizePullCategory("Manga Rare", null, null)).toBe("TOP_CHASE");
    expect(normalizePullCategory("Enchanted", null, null)).toBe("TOP_CHASE");
    expect(normalizePullCategory("Unknown provider tier", null, null)).toBe("OTHER");
  });

  it("returns safe invalid JSON errors", async () => {
    const summary = await runPullRateImport({ content: "{broken", format: "json", setId: "set-1", dryRun: true, repository: new FakeRepository() });
    expect(summary.errors[0].message).toContain("JSON válido");
  });
});
