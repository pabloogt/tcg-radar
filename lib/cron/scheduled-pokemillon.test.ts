import { describe, expect, it } from "vitest";
import type { PokemillonExecutionResult } from "@/lib/monitors/pokemillon";
import type { LockResult, MonitorRunCounts, MonitorRunRepository, MonitorRunStatus } from "./monitor-runs";
import { orchestrateScheduledPokemillon } from "./scheduled-pokemillon";

const owner = "11111111-1111-4111-8111-111111111111";

class MemoryRuns implements MonitorRunRepository {
  running = false;
  startedAt = "2026-01-01T00:00:00.000Z";
  finished: Array<{ owner: string; status: MonitorRunStatus; counts: MonitorRunCounts; error?: string }> = [];
  async acquireScheduledLock(): Promise<LockResult> { if (this.running) return { acquired: false }; this.running = true; return { acquired: true, runId: "run-1", startedAt: this.startedAt }; }
  async finish(_runId: string, ownerUserId: string, status: MonitorRunStatus, counts: MonitorRunCounts, safeErrorSummary?: string) { this.running = false; this.finished.push({ owner: ownerUserId, status, counts, ...(safeErrorSummary ? { error: safeErrorSummary } : {}) }); }
  recoverStale(startedAt: Date, now: Date) { if (this.running && now.getTime() - startedAt.getTime() >= 15 * 60 * 1_000) this.running = false; }
}

function result(overrides: { pagesFetched?: number; ingestionErrors?: number; alertsFailed?: number; listingsUpdated?: number } = {}): PokemillonExecutionResult {
  const finishedAt = "2026-01-01T00:01:00.000Z";
  return {
    mode: "ingest",
    observations: [], skipped: [], errors: [],
    log: { startedAt: "2026-01-01T00:00:00.000Z", finishedAt, sourceKey: "pokemillon", pagesFetched: overrides.pagesFetched ?? 1, productsSeen: 12, observationsProduced: 10, observationsSkipped: 2, errorsCount: 0, pokemon: 6, onePiece: 4, ambiguousProducts: 0, parsingErrors: 0 },
    ingestion: { observations: 10, productsCreated: 1, productsMatched: 9, storesCreated: 0, storesMatched: 10, listingsCreated: 1, listingsUpdated: overrides.listingsUpdated ?? 2, priceHistoriesCreated: 3, alertCandidates: 2, alertsSent: 1, alertsDuplicate: 1, alertsFailed: overrides.alertsFailed ?? 0, skipped: 2, errors: overrides.ingestionErrors ?? 0 },
  };
}

describe("scheduled Pokemillon orchestration", () => {
  it("blocks a simultaneous duplicate run", async () => { const runs = new MemoryRuns(); runs.running = true; const response = await orchestrateScheduledPokemillon(owner, { runs, execute: async () => result() }); expect(response.statusCode).toBe(409); expect(response.body.status).toBe("already_running"); });
  it("allows recovery after a stale lock", async () => { const runs = new MemoryRuns(); runs.running = true; runs.recoverStale(new Date("2026-01-01T00:00:00Z"), new Date("2026-01-01T00:16:00Z")); const response = await orchestrateScheduledPokemillon(owner, { runs, execute: async () => result() }); expect(response.statusCode).toBe(200); });
  it("persists a successful run for exactly the configured owner", async () => { const runs = new MemoryRuns(); const response = await orchestrateScheduledPokemillon(owner, { runs, execute: async () => result() }); expect(response.body.status).toBe("completed"); expect(runs.finished[0]).toMatchObject({ owner, status: "completed", counts: { productsSeen: 12, listingsUpdated: 2, alertsSent: 1 } }); });
  it("persists a whole-source failure", async () => { const runs = new MemoryRuns(); const response = await orchestrateScheduledPokemillon(owner, { runs, execute: async () => result({ pagesFetched: 0, ingestionErrors: 4 }) }); expect(response.statusCode).toBe(502); expect(runs.finished[0]?.status).toBe("failed"); });
  it("persists partial counts without failing the HTTP run", async () => { const runs = new MemoryRuns(); const response = await orchestrateScheduledPokemillon(owner, { runs, execute: async () => result({ ingestionErrors: 2, listingsUpdated: 3 }) }); expect(response.statusCode).toBe(200); expect(response.body.status).toBe("partial"); expect(runs.finished[0]?.counts).toMatchObject({ listingsUpdated: 3, errorsCount: 2 }); });
  it("treats Telegram failure as partial rather than a failed run", async () => { const runs = new MemoryRuns(); const response = await orchestrateScheduledPokemillon(owner, { runs, execute: async () => result({ alertsFailed: 1 }) }); expect(response.statusCode).toBe(200); expect(response.body.status).toBe("partial"); expect(runs.finished[0]?.counts.alertsFailed).toBe(1); });
});
