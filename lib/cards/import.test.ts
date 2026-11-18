import { describe, expect, it } from "vitest";
import { runCardImport, runCardPriceImport, type CardImportRepository, type CardWrite, type ExistingImportCard, type PriceWrite } from "./import";

class FakeRepository implements CardImportRepository {
  cards: ExistingImportCard[] = [];
  keys = new Set<string>();
  cardWrites: CardWrite[][] = [];
  priceWrites: PriceWrite[][] = [];
  async listCards() { return this.cards; }
  async upsertCards(cards: readonly CardWrite[]) { this.cardWrites.push([...cards]); }
  async listObservationKeys() { return this.keys; }
  async insertPrices(prices: readonly PriceWrite[]) { this.priceWrites.push([...prices]); }
}

const existing = (overrides: Partial<ExistingImportCard> = {}): ExistingImportCard => ({ id: "card-1", setId: "set-1", name: "Greninja ex", cardNumber: "214/167", rarity: "SIR", variantName: "Special Illustration Rare", externalIds: { import: "greninja-214" }, ...overrides });

describe("card CSV/JSON imports", () => {
  it("matches a duplicate card instead of creating it", async () => {
    const repository = new FakeRepository(); repository.cards = [existing()];
    const summary = await runCardImport({ content: JSON.stringify([{ name: "Greninja ex", card_number: "214/167", rarity: "SIR", variant_name: "Special Illustration Rare" }]), format: "json", setId: "set-1", tcg: "pokemon", dryRun: true, repository });
    expect(summary).toMatchObject({ cardsCreated: 0, cardsMatched: 1 });
  });

  it("matches the same numbered variant when a provider corrects its title", async () => {
    const repository = new FakeRepository(); repository.cards = [existing()];
    const summary = await runCardImport({ content: JSON.stringify([{ name: "Greninja ex corrected", card_number: "214/167", rarity: "SIR", variant_name: "Special Illustration Rare" }]), format: "json", setId: "set-1", tcg: "pokemon", dryRun: true, repository });
    expect(summary).toMatchObject({ cardsCreated: 0, cardsMatched: 1 });
  });

  it("preserves existing provider aliases when adding another external ID", async () => {
    const repository = new FakeRepository(); repository.cards = [existing()];
    await runCardImport({ content: JSON.stringify([{ name: "Greninja ex", card_number: "214/167", rarity: "SIR", variant_name: "Special Illustration Rare", external_source: "provider_b", external_id: "b-214" }]), format: "json", setId: "set-1", tcg: "pokemon", dryRun: false, repository });
    expect(repository.cardWrites[0][0].externalIds).toEqual({ import: "greninja-214", "provider-b": "b-214" });
  });

  it("keeps distinct variants separate", async () => {
    const repository = new FakeRepository(); repository.cards = [existing()];
    const summary = await runCardImport({ content: JSON.stringify([{ name: "Greninja ex", card_number: "214/167", rarity: "SIR", variant_name: "Serialized" }]), format: "json", setId: "set-1", tcg: "pokemon", dryRun: true, repository });
    expect(summary).toMatchObject({ cardsCreated: 1, cardsMatched: 0 });
  });

  it("skips malformed rows safely", async () => {
    const repository = new FakeRepository();
    const summary = await runCardImport({ content: JSON.stringify([{ name: "", card_number: "1", rarity: "Rare" }]), format: "json", setId: "set-1", tcg: "pokemon", dryRun: true, repository });
    expect(summary.errors).toHaveLength(1);
    expect(summary.skipped).toBe(1);
  });

  it("supports quoted CSV card imports", async () => {
    const repository = new FakeRepository();
    const content = 'name,card_number,rarity,character_name\n"Pikachu, Special",025,SIR,Pikachu';
    const summary = await runCardImport({ content, format: "csv", setId: "set-1", tcg: "pokemon", dryRun: false, repository });
    expect(summary.cardsCreated).toBe(1);
    expect(repository.cardWrites[0][0].name).toBe("Pikachu, Special");
  });

  it("preview causes no writes", async () => {
    const repository = new FakeRepository();
    await runCardImport({ content: JSON.stringify([{ name: "Pikachu", card_number: "025", rarity: "Rare" }]), format: "json", setId: "set-1", tcg: "pokemon", dryRun: true, repository });
    expect(repository.cardWrites).toHaveLength(0);
    expect(repository.priceWrites).toHaveLength(0);
  });

  it("price preview also causes no writes", async () => {
    const repository = new FakeRepository(); repository.cards = [existing()];
    const summary = await runCardPriceImport({ content: JSON.stringify([{ external_id: "greninja-214", source: "manual", currency: "EUR", price: 100, observed_at: "2026-08-19T10:00:00Z" }]), format: "json", setId: "set-1", dryRun: true, repository });
    expect(summary.pricesCreated).toBe(1);
    expect(repository.priceWrites).toHaveLength(0);
  });

  it("matches a price by external ID and converts euros to cents", async () => {
    const repository = new FakeRepository(); repository.cards = [existing()];
    const summary = await runCardPriceImport({ content: JSON.stringify([{ external_id: "greninja-214", source: "manual", currency: "EUR", price: "285,40", observed_at: "2026-08-19T10:00:00+02:00" }]), format: "json", setId: "set-1", dryRun: false, repository });
    expect(summary.pricesCreated).toBe(1);
    expect(repository.priceWrites[0][0].marketPriceCents).toBe(28_540);
  });

  it("matches price by card number and explicit variant", async () => {
    const repository = new FakeRepository(); repository.cards = [existing(), existing({ id: "card-2", variantName: "Serialized", externalIds: {} })];
    const summary = await runCardPriceImport({ content: JSON.stringify([{ card_number: "214/167", variant_name: "Serialized", source: "manual", currency: "EUR", market_price: 500, observed_at: "2026-08-19T10:00:00Z" }]), format: "json", setId: "set-1", dryRun: true, repository });
    expect(summary).toMatchObject({ cardsMatched: 1, pricesCreated: 1 });
  });

  it("rejects ambiguous card-number price rows", async () => {
    const repository = new FakeRepository(); repository.cards = [existing(), existing({ id: "card-2", variantName: "Serialized", externalIds: {} })];
    const summary = await runCardPriceImport({ content: JSON.stringify([{ card_number: "214/167", source: "manual", currency: "EUR", price: 100, observed_at: "2026-08-19T10:00:00Z" }]), format: "json", setId: "set-1", dryRun: true, repository });
    expect(summary.errors[0].message).toContain("ambigua");
  });

  it("deduplicates an existing price observation", async () => {
    const repository = new FakeRepository(); repository.cards = [existing()];
    repository.keys.add("card-1|manual|EUR|2026-08-19T10:00:00Z|10000|null|null");
    const summary = await runCardPriceImport({ content: JSON.stringify([{ external_id: "greninja-214", source: "manual", currency: "EUR", price: 100, observed_at: "2026-08-19T10:00:00Z" }]), format: "json", setId: "set-1", dryRun: false, repository });
    expect(summary.pricesCreated).toBe(0);
    expect(repository.priceWrites).toHaveLength(0);
  });

  it("returns a safe JSON parsing error", async () => {
    const summary = await runCardImport({ content: "{broken", format: "json", setId: "set-1", tcg: "pokemon", dryRun: true, repository: new FakeRepository() });
    expect(summary.errors[0].message).toContain("JSON válido");
  });
});
