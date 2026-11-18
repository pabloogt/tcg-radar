import { describe, expect, it } from "vitest";
import { provenanceFromJson } from "./storage";

describe("investment metric provenance", () => {
  it("accepts safe per-metric provenance", () => {
    expect(provenanceFromJson({ demand: { sourceType: "manual", confidence: "HIGH", sourceNote: "Observed demand" } })).toEqual({ demand: { sourceType: "manual", confidence: "HIGH", sourceNote: "Observed demand" } });
  });

  it("ignores malformed external JSON", () => {
    expect(provenanceFromJson({ demand: { sourceType: "unknown", confidence: "HIGH", sourceNote: null }, hype: "manual" })).toEqual({});
  });
});
