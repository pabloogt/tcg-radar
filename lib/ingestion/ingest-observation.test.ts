import { describe, expect, it } from "vitest";
import { FakeStoreMonitor } from "@/lib/monitors/fake-monitor";
import type { NormalizedListingObservation } from "@/lib/monitors/types";
import { ingestObservation } from "./ingest-observation";
import type { IngestionRepository, ListingIdentity, StoreIdentity } from "./repository";

class MemoryRepository implements IngestionRepository {
  stores = new Map<string, { id: string; name: string }>();
  products = new Map<string, { id: string; name: string }>();
  listings = new Map<string, { id: string; productId: string; storeId: string; priceCents: number; shippingCents: number; stockStatus: string }>();
  history: Array<{ price: number; stock: string }> = [];
  targetPriceCents: number | null = null;

  async findStore(identity: StoreIdentity) { return this.stores.get(identity.sourceKey) ?? this.stores.get(identity.domain) ?? null; }
  async createStore(identity: StoreIdentity, value: NormalizedListingObservation["store"]) { const row = { id: "store-1", name: value.name }; this.stores.set(identity.sourceKey, row); this.stores.set(identity.domain, row); return row; }
  async findProduct(key: string) { return this.products.get(key) ?? null; }
  async createProduct(key: string, value: NormalizedListingObservation["product"]) { const row = { id: "product-1", name: value.name }; this.products.set(key, row); return row; }
  async findListing(identity: ListingIdentity) { return this.listings.get(identity.sourceProductId ?? identity.canonicalUrl) ?? null; }
  async createListing(identity: ListingIdentity, productId: string, storeId: string, observation: NormalizedListingObservation) { const row = { id: "listing-1", productId, storeId, priceCents: observation.listing.priceCents, shippingCents: observation.listing.shippingCents ?? 0, stockStatus: observation.listing.stockStatus }; this.listings.set(identity.sourceProductId ?? identity.canonicalUrl, row); return row; }
  async updateListing(id: string, observation: NormalizedListingObservation) { const entry = [...this.listings.entries()].find(([, row]) => row.id === id); if (entry) this.listings.set(entry[0], { ...entry[1], priceCents: observation.listing.priceCents, shippingCents: observation.listing.shippingCents ?? 0, stockStatus: observation.listing.stockStatus }); }
  async createPriceHistory(_id: string, observation: NormalizedListingObservation) { this.history.push({ price: observation.listing.priceCents, stock: observation.listing.stockStatus }); }
  async getActiveListingTargetPrice() { return this.targetPriceCents; }
}

const financialAssumptions = {
  purchase_fees_cents: 0,
  expected_sale_price_cents: 10000,
  sale_platform_fee_basis_points: 0,
  fixed_sale_fee_cents: 0,
  seller_shipping_cents: 0,
  packaging_cost_cents: 0,
  estimated_holding_months: 1,
  target_roi_basis_points: 2000,
};

async function fakeBase(): Promise<NormalizedListingObservation> {
  const [base] = await new FakeStoreMonitor().run();
  return base;
}

describe("automatic ingestion", () => {
  it("deduplicates entities and records only changes", async () => {
    const repository = new MemoryRepository();
    const observations = await new FakeStoreMonitor().run();
    const first = await ingestObservation(repository, observations[0]);
    const duplicate = await ingestObservation(repository, observations[0]);
    const decrease = await ingestObservation(repository, observations[1]);
    const stockLoss = await ingestObservation(repository, observations[2]);
    const stockReturn = await ingestObservation(repository, observations[3]);
    expect(first.alertCandidates.map((candidate) => candidate.alertType)).toEqual(["new_product"]);
    expect(duplicate.alertCandidates).toHaveLength(0);
    expect(decrease.alertCandidates[0]?.alertType).toBe("price_drop");
    expect(stockLoss.listing.stockChanged).toBe(true);
    expect(stockReturn.alertCandidates[0]?.alertType).toBe("back_in_stock");
    expect(repository.stores.size).toBe(2);
    expect(repository.products.size).toBe(1);
    expect(repository.listings.size).toBe(1);
    expect(repository.history).toHaveLength(4);
  });

  it("creates NEW PRODUCT once for a new in-stock listing", async () => {
    const repository = new MemoryRepository();
    const base = await fakeBase();
    const first = await ingestObservation(repository, base);
    const repeated = await ingestObservation(repository, base);
    expect(first.alertCandidates).toHaveLength(1);
    expect(first.alertCandidates[0]).toMatchObject({ alertType: "new_product", dedupeKey: "new_product:listing-1" });
    expect(repeated.alertCandidates).toHaveLength(0);
  });

  it("creates NEW PRODUCT for preorder but not for out-of-stock or unknown listings", async () => {
    const base = await fakeBase();
    for (const stockStatus of ["preorder", "out_of_stock", "unknown"] as const) {
      const result = await ingestObservation(new MemoryRepository(), { ...base, listing: { ...base.listing, stockStatus } });
      expect(result.alertCandidates.map((candidate) => candidate.alertType)).toEqual(stockStatus === "preorder" ? ["new_product"] : []);
    }
  });

  it("does not create NEW PRODUCT for an unsupported product type", async () => {
    const repository = new MemoryRepository();
    const base = await fakeBase();
    const result = await ingestObservation(repository, { ...base, product: { ...base.product, productType: "accessory" } });
    expect(result.alertCandidates).toHaveLength(0);
  });

  it("does not backfill NEW PRODUCT for a historical unchanged listing", async () => {
    const repository = new MemoryRepository();
    const base = await fakeBase();
    const identity = base.sourceProductId ?? base.listing.url;
    repository.stores.set("fake_store", { id: "store-1", name: "Fake Cards" });
    repository.products.set("pokemon|demo set|elite trainer box|elite trainer box|es", { id: "product-1", name: base.product.name });
    repository.listings.set(identity, { id: "listing-1", productId: "product-1", storeId: "store-1", priceCents: base.listing.priceCents, shippingCents: 0, stockStatus: base.listing.stockStatus });
    const result = await ingestObservation(repository, base);
    expect(result.listing.created).toBe(false);
    expect(result.alertCandidates).toHaveLength(0);
  });

  it("returns deterministic price-drop candidates for delivery deduplication", async () => {
    const repository = new MemoryRepository();
    const observations = await new FakeStoreMonitor().run();
    await ingestObservation(repository, observations[0]);
    const firstDrop = await ingestObservation(repository, observations[1]);
    await ingestObservation(repository, observations[0]);
    const repeatedDrop = await ingestObservation(repository, observations[1]);
    expect(firstDrop.alertCandidates[0]?.dedupeKey).toBe(repeatedDrop.alertCandidates[0]?.dedupeKey);
  });

  it("reports insufficient market data", async () => {
    const result = await ingestObservation(new MemoryRepository(), await fakeBase());
    expect(result.evaluationStatus).toBe("insufficient_market_data");
    expect(result.evaluation).toBeNull();
  });

  it("does not evaluate or recommend a BUY when shipping is unknown", async () => {
    const base = await fakeBase();
    const observation = { ...base, listing: { ...base.listing, shippingCents: null, shippingKnown: false }, financialAssumptions };
    const result = await ingestObservation(new MemoryRepository(), observation);
    expect(result.evaluationStatus).toBe("insufficient_cost_data");
    expect(result.evaluation).toBeNull();
    expect(result.alertCandidates.some((candidate) => candidate.alertType === "financial_opportunity")).toBe(false);
  });

  it.each([[0, 4500], [595, 3905]])("evaluates known shipping normally (%i cents)", async (shippingCents, expectedProfit) => {
    const base = await fakeBase();
    const result = await ingestObservation(new MemoryRepository(), { ...base, listing: { ...base.listing, priceCents: 5000, shippingCents, shippingKnown: true }, financialAssumptions: { ...financialAssumptions, expected_sale_price_cents: 9500 } });
    expect(result.evaluationStatus).toBe("evaluated");
    expect(result.evaluation?.net_profit_cents).toBe(expectedProfit);
    expect(result.evaluation?.recommendation).toBe("STRONG_BUY");
  });

  it("keeps price-drop and back-in-stock alerts with unknown shipping", async () => {
    const repository = new MemoryRepository();
    const base = await fakeBase();
    await ingestObservation(repository, { ...base, listing: { ...base.listing, priceCents: 6000, shippingCents: null, shippingKnown: false, stockStatus: "out_of_stock" }, financialAssumptions });
    const result = await ingestObservation(repository, { ...base, listing: { ...base.listing, priceCents: 5000, shippingCents: null, shippingKnown: false, stockStatus: "in_stock" }, financialAssumptions });
    expect(result.alertCandidates.map((candidate) => candidate.alertType)).toEqual(["price_drop", "back_in_stock"]);
    expect(result.alertCandidates.every((candidate) => candidate.totalAcquisitionCostCents === null && candidate.financialRecommendation === null)).toBe(true);
  });

  it("suppresses STRONG_BUY and target alerts while out of stock", async () => {
    const base = await fakeBase();
    const opportunityRepository = new MemoryRepository();
    await ingestObservation(opportunityRepository, base);
    const opportunity = await ingestObservation(opportunityRepository, { ...base, listing: { ...base.listing, stockStatus: "out_of_stock" }, financialAssumptions });
    expect(opportunity.evaluation?.recommendation).toBe("STRONG_BUY");
    expect(opportunity.alertCandidates).toHaveLength(0);

    const targetRepository = new MemoryRepository();
    targetRepository.targetPriceCents = 5000;
    await ingestObservation(targetRepository, { ...base, listing: { ...base.listing, priceCents: 6000, stockStatus: "out_of_stock" } });
    const target = await ingestObservation(targetRepository, { ...base, listing: { ...base.listing, priceCents: 4900, stockStatus: "out_of_stock" } });
    expect(target.alertCandidates).toHaveLength(0);
  });

  it("allows an in-stock target crossing and not repeated below-target alerts", async () => {
    const repository = new MemoryRepository();
    repository.targetPriceCents = 5000;
    const base = await fakeBase();
    await ingestObservation(repository, { ...base, listing: { ...base.listing, priceCents: 6000 } });
    const crossing = await ingestObservation(repository, { ...base, listing: { ...base.listing, priceCents: 4900 } });
    const below = await ingestObservation(repository, { ...base, listing: { ...base.listing, priceCents: 4800 } });
    expect(crossing.alertCandidates.some((candidate) => candidate.alertType === "target_price")).toBe(true);
    expect(below.alertCandidates.some((candidate) => candidate.alertType === "target_price")).toBe(false);
  });

  it("allows a financial opportunity in preorder", async () => {
    const repository = new MemoryRepository();
    const base = await fakeBase();
    await ingestObservation(repository, { ...base, listing: { ...base.listing, priceCents: 6000, stockStatus: "preorder" } });
    const result = await ingestObservation(repository, { ...base, listing: { ...base.listing, priceCents: 5000, stockStatus: "preorder" }, financialAssumptions });
    expect(result.alertCandidates.some((candidate) => candidate.alertType === "financial_opportunity")).toBe(true);
  });

  it("combines restock and an already-satisfied target into one alert", async () => {
    const repository = new MemoryRepository();
    repository.targetPriceCents = 5500;
    const base = await fakeBase();
    await ingestObservation(repository, { ...base, listing: { ...base.listing, priceCents: 5000, stockStatus: "out_of_stock" } });
    const result = await ingestObservation(repository, { ...base, listing: { ...base.listing, priceCents: 5000, stockStatus: "in_stock" } });
    expect(result.alertCandidates).toHaveLength(1);
    expect(result.alertCandidates[0]).toMatchObject({ alertType: "back_in_stock", targetPriceCents: 5500 });
  });

  it("combines restock and financial opportunity into one alert", async () => {
    const repository = new MemoryRepository();
    const base = await fakeBase();
    await ingestObservation(repository, { ...base, listing: { ...base.listing, priceCents: 5000, stockStatus: "out_of_stock" } });
    const result = await ingestObservation(repository, { ...base, listing: { ...base.listing, priceCents: 5000, stockStatus: "in_stock" }, financialAssumptions });
    expect(result.alertCandidates).toHaveLength(1);
    expect(result.alertCandidates[0]).toMatchObject({ alertType: "back_in_stock", financialRecommendation: "STRONG_BUY" });
  });

  it("tracks price increases and unchanged observations without alerts", async () => {
    const repository = new MemoryRepository();
    const base = await fakeBase();
    await ingestObservation(repository, base);
    const increase = await ingestObservation(repository, { ...base, listing: { ...base.listing, priceCents: 6999 } });
    const unchanged = await ingestObservation(repository, { ...base, listing: { ...base.listing, priceCents: 6999 } });
    expect(increase.alertCandidates).toHaveLength(0);
    expect(unchanged.alertCandidates).toHaveLength(0);
    expect(unchanged.listing.historyCreated).toBe(false);
  });
});
