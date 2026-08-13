import { describe, expect, it, vi } from "vitest";
import { parseScheduledEnvironment } from "./env";
import { handlePokemillonCron } from "./pokemillon-handler";
import type { ScheduledMonitorSummary } from "./scheduled-pokemillon";

const secret = "a".repeat(48);
const configuredOwner = "11111111-1111-4111-8111-111111111111";

function completedSummary(): ScheduledMonitorSummary {
  return { ok: true, source: "pokemillon", status: "completed", productsSeen: 1, observations: 1, productsCreated: 0, productsMatched: 1, listingsCreated: 0, listingsUpdated: 0, priceHistoriesCreated: 0, alertCandidates: 0, alertsSent: 0, alertsSuppressed: 0, alertsFailed: 0, errors: 0, startedAt: "2026-01-01T00:00:00.000Z", finishedAt: "2026-01-01T00:01:00.000Z" };
}

function dependencies(run = vi.fn(async () => ({ statusCode: 200, body: completedSummary() }))) {
  return { getCronSecret: () => secret, getOwnerUserId: () => configuredOwner, run };
}

describe("Pokemillon cron endpoint handler", () => {
  it("rejects a missing authorization secret", async () => { const response = await handlePokemillonCron(new Request("http://localhost/api/cron/monitors/pokemillon", { method: "POST" }), dependencies()); expect(response.status).toBe(401); });
  it("rejects an incorrect authorization secret", async () => { const response = await handlePokemillonCron(new Request("http://localhost/api/cron/monitors/pokemillon", { method: "POST", headers: { Authorization: "Bearer incorrect" } }), dependencies()); expect(response.status).toBe(401); });
  it("allows the configured secret", async () => { const response = await handlePokemillonCron(new Request("http://localhost/api/cron/monitors/pokemillon", { method: "POST", headers: { Authorization: `Bearer ${secret}` } }), dependencies()); expect(response.status).toBe(200); });
  it("ignores an owner user ID supplied by the caller", async () => { const run = vi.fn(async () => ({ statusCode: 200, body: completedSummary() })); const request = new Request("http://localhost/api/cron/monitors/pokemillon?user_id=attacker", { method: "POST", headers: { Authorization: `Bearer ${secret}`, "Content-Type": "application/json" }, body: JSON.stringify({ user_id: "attacker" }) }); await handlePokemillonCron(request, dependencies(run)); expect(run).toHaveBeenCalledWith(configuredOwner); });
  it("returns a safe configuration failure for an invalid owner UUID", async () => { const response = await handlePokemillonCron(new Request("http://localhost/api/cron/monitors/pokemillon", { method: "POST", headers: { Authorization: `Bearer ${secret}` } }), { ...dependencies(), getOwnerUserId: () => { throw new Error("TCG_RADAR_OWNER_USER_ID must be a UUID"); } }); expect(response.status).toBe(503); expect(await response.json()).toEqual({ ok: false, error: "Scheduled monitor is not configured." }); });
  it("validates the configured owner UUID", () => { expect(() => parseScheduledEnvironment({ NEXT_PUBLIC_SUPABASE_URL: "https://project.supabase.co", SUPABASE_SECRET_KEY: "sb_secret_test", CRON_SECRET: secret, TCG_RADAR_OWNER_USER_ID: "attacker" })).toThrow(); });
});
