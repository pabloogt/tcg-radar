import { describe, expect, it } from "vitest";
import { executePokemillonMonitor } from "@/lib/monitors/pokemillon";

const liveRunEnabled = process.env.POKEMILLON_LIVE_DRY_RUN === "1";

describe.skipIf(!liveRunEnabled)("Pokemillon explicit live dry run", () => {
  it("fetches one page per configured public collection without ingesting", async () => {
    const result = await executePokemillonMonitor({ dryRun: true, maxPages: 1, pageSize: 50, delayMs: 750, timeoutMs: 12_000, retries: 2 });
    const samples = result.observations.slice(0, 5).map((observation) => ({
      sourceProductId: observation.sourceProductId,
      product: observation.product,
      listing: observation.listing,
      observedAt: observation.observedAt,
    }));
    console.log("POKEMILLON_DRY_RUN_SUMMARY", JSON.stringify({ ...result.log, skipped: result.skipped.length, errors: result.errors }, null, 2));
    console.log("POKEMILLON_DRY_RUN_SAMPLES", JSON.stringify(samples, null, 2));
    expect(result.mode).toBe("dry_run");
    expect(result.log.pagesFetched).toBeGreaterThan(0);
  }, 120_000);
});
