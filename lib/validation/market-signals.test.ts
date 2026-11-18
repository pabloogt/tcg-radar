import { describe, expect, it } from "vitest";
import { marketSignalFormSchema } from "./market-signals";

const base = { set_id: "11111111-1111-4111-8111-111111111111", signal_type: "manual_hype", source_type: "manual", source_key: null, value: 80, confidence: "MEDIUM", observed_at: "2026-09-13T12:00:00.000Z", sample_size: null, note: null, reprint_status: null, confirmed_reprint: false, announcement_date: null, expected_supply_date: null };

describe("market signal validation", () => {
  it("accepts a bounded manual hype signal", () => expect(marketSignalFormSchema.safeParse(base).success).toBe(true));
  it("rejects scores outside 0–100", () => expect(marketSignalFormSchema.safeParse({ ...base, value: 101 }).success).toBe(false));
  it("requires manual provenance for manual signal types", () => expect(marketSignalFormSchema.safeParse({ ...base, source_type: "official" }).success).toBe(false));
  it("requires official provenance for official announcements", () => expect(marketSignalFormSchema.safeParse({ ...base, signal_type: "official_reprint_announced", source_type: "manual" }).success).toBe(false));
  it("accepts an explicitly confirmed official reprint", () => expect(marketSignalFormSchema.safeParse({ ...base, signal_type: "official_reprint_announced", source_type: "official", value: 90, confirmed_reprint: true, reprint_status: "CONFIRMED_REPRINT" }).success).toBe(true));
  it("does not let a generic supply note confirm a reprint", () => expect(marketSignalFormSchema.safeParse({ ...base, signal_type: "unknown_supply_status", confirmed_reprint: true }).success).toBe(false));
});
