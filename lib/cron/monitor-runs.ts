import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database, TablesUpdate } from "@/lib/supabase/database.types";

const LOCK_EXPIRY_MILLISECONDS = 15 * 60 * 1_000;

export type MonitorRunStatus = "completed" | "failed" | "partial";
export type MonitorRunCounts = {
  productsSeen: number;
  observations: number;
  productsCreated: number;
  productsMatched: number;
  listingsCreated: number;
  listingsUpdated: number;
  priceHistoriesCreated: number;
  alertCandidates: number;
  alertsSent: number;
  alertsSuppressed: number;
  alertsFailed: number;
  errorsCount: number;
};

export type LockResult = { acquired: true; runId: string; startedAt: string } | { acquired: false };

export interface MonitorRunRepository {
  acquireScheduledLock(ownerUserId: string, sourceKey: string, now?: Date): Promise<LockResult>;
  finish(runId: string, ownerUserId: string, status: MonitorRunStatus, counts: MonitorRunCounts, safeErrorSummary?: string): Promise<void>;
}

export class SupabaseMonitorRunRepository implements MonitorRunRepository {
  constructor(private readonly client: SupabaseClient<Database>) {}

  async acquireScheduledLock(ownerUserId: string, sourceKey: string, now: Date = new Date()): Promise<LockResult> {
    const startedAt = now.toISOString();
    const staleBefore = new Date(now.getTime() - LOCK_EXPIRY_MILLISECONDS).toISOString();
    const stale = await this.client.from("monitor_runs").update({
      status: "failed",
      finished_at: startedAt,
      safe_error_summary: "La ejecución anterior superó el tiempo máximo y su bloqueo caducó.",
      errors_count: 1,
    }).eq("user_id", ownerUserId).eq("source_key", sourceKey).eq("status", "running").lt("started_at", staleBefore);
    if (stale.error) throw stale.error;

    const inserted = await this.client.from("monitor_runs").insert({
      user_id: ownerUserId,
      source_key: sourceKey,
      trigger_type: "scheduled",
      status: "running",
      started_at: startedAt,
    }).select("id").single();
    if (!inserted.error) return { acquired: true, runId: inserted.data.id, startedAt };
    if (inserted.error.code === "23505") return { acquired: false };
    throw inserted.error;
  }

  async finish(runId: string, ownerUserId: string, status: MonitorRunStatus, counts: MonitorRunCounts, safeErrorSummary?: string): Promise<void> {
    const values: TablesUpdate<"monitor_runs"> = {
      status,
      finished_at: new Date().toISOString(),
      products_seen: counts.productsSeen,
      observations: counts.observations,
      products_created: counts.productsCreated,
      products_matched: counts.productsMatched,
      listings_created: counts.listingsCreated,
      listings_updated: counts.listingsUpdated,
      price_histories_created: counts.priceHistoriesCreated,
      alert_candidates: counts.alertCandidates,
      alerts_sent: counts.alertsSent,
      alerts_suppressed: counts.alertsSuppressed,
      alerts_failed: counts.alertsFailed,
      errors_count: counts.errorsCount,
      safe_error_summary: safeErrorSummary?.slice(0, 500) ?? null,
    };
    const result = await this.client.from("monitor_runs").update(values).eq("id", runId).eq("user_id", ownerUserId).eq("status", "running").select("id").maybeSingle();
    if (result.error) throw result.error;
    if (!result.data) throw new Error("Scheduled monitor run could not be finalized.");
  }
}
