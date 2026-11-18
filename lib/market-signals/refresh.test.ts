import { describe, expect, it } from "vitest";
import { shouldPersistDerivedMarketSignal } from "./refresh";

describe("derived market signal history", () => {
  it("persists first and material score changes", () => {
    expect(shouldPersistDerivedMarketSignal(null, { value: 70, confidence: "MEDIUM" })).toBe(true);
    expect(shouldPersistDerivedMarketSignal({ value: 70, confidence: "MEDIUM" }, { value: 73, confidence: "MEDIUM" })).toBe(true);
  });

  it("does not append meaningless duplicates", () => {
    expect(shouldPersistDerivedMarketSignal({ value: 70, confidence: "MEDIUM" }, { value: 72, confidence: "MEDIUM" })).toBe(false);
  });

  it("persists confidence changes even when the score is stable", () => {
    expect(shouldPersistDerivedMarketSignal({ value: 70, confidence: "LOW" }, { value: 70, confidence: "MEDIUM" })).toBe(true);
  });
});
