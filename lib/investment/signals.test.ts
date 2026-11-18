import { describe, expect, it } from "vitest";
import { deriveSetPriceMomentum, deriveSetScarcity } from "./signals";

describe("derived internal investment signals", () => {
  it("does not fake scarcity from one monitored store", () => expect(deriveSetScarcity({ distinctStores: 1, storesInStock: 0 })).toBeNull());
  it("derives scarcity only with useful coverage", () => expect(deriveSetScarcity({ distinctStores: 4, storesInStock: 1 })).toBe(75));
  it("derives positive, neutral, and negative momentum", () => { expect(deriveSetPriceMomentum([120, 121, 122], [100, 101, 102])).toBeGreaterThan(50); expect(deriveSetPriceMomentum([100, 100, 100], [100, 100, 100])).toBe(50); expect(deriveSetPriceMomentum([80, 81, 82], [100, 101, 102])).toBeLessThan(50); });
  it("caps extreme momentum and rejects insufficient samples", () => { expect(deriveSetPriceMomentum([1_000, 1_000, 1_000], [100, 100, 100])).toBe(100); expect(deriveSetPriceMomentum([100, 100], [100, 100, 100])).toBeNull(); });
});
