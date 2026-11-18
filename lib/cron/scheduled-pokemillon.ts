import "server-only";

import { deliverAlertCandidates, SupabaseAlertDeliveryRepository } from "@/lib/alerts/delivery";
import { ingestObservation } from "@/lib/ingestion/ingest-observation";
import { SupabaseIngestionRepository } from "@/lib/ingestion/supabase-repository";
import { executePokemillonMonitor, type PokemillonExecutionResult } from "@/lib/monitors/pokemillon";
import { createAdminClient } from "@/lib/supabase/admin";
import { loadProductInvestmentAnalyses } from "@/lib/investment/product-data";
import { persistProductInvestmentSnapshot } from "@/lib/investment/product-snapshots";
import { refreshMarketSignalsForProductsSafely } from "@/lib/market-signals/refresh";
import type { MonitorRunCounts, MonitorRunRepository } from "./monitor-runs";
import { SupabaseMonitorRunRepository } from "./monitor-runs";

const SOURCE_KEY = "pokemillon";

export type ScheduledMonitorSummary = {
  ok: boolean;
  source: typeof SOURCE_KEY;
  status: "completed" | "partial" | "failed" | "already_running";
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
  errors: number;
  startedAt: string | null;
  finishedAt: string | null;
  message?: string;
};

type ScheduledMonitorDependencies = {
  runs: MonitorRunRepository;
  execute: () => Promise<PokemillonExecutionResult>;
};

function emptyCounts(): MonitorRunCounts {
  return { productsSeen: 0, observations: 0, productsCreated: 0, productsMatched: 0, listingsCreated: 0, listingsUpdated: 0, priceHistoriesCreated: 0, alertCandidates: 0, alertsSent: 0, alertsSuppressed: 0, alertsFailed: 0, errorsCount: 0 };
}

function countsFrom(result: PokemillonExecutionResult): MonitorRunCounts {
  return {
    productsSeen: result.log.productsSeen,
    observations: result.log.observationsProduced,
    productsCreated: result.ingestion.productsCreated,
    productsMatched: result.ingestion.productsMatched,
    listingsCreated: result.ingestion.listingsCreated,
    listingsUpdated: result.ingestion.listingsUpdated,
    priceHistoriesCreated: result.ingestion.priceHistoriesCreated,
    alertCandidates: result.ingestion.alertCandidates,
    alertsSent: result.ingestion.alertsSent,
    alertsSuppressed: result.ingestion.alertsDuplicate,
    alertsFailed: result.ingestion.alertsFailed,
    errorsCount: result.ingestion.errors,
  };
}

function summary(status: ScheduledMonitorSummary["status"], counts: MonitorRunCounts, startedAt: string | null, finishedAt: string | null, message?: string): ScheduledMonitorSummary {
  return { ok: status === "completed" || status === "partial", source: SOURCE_KEY, status, productsSeen: counts.productsSeen, observations: counts.observations, productsCreated: counts.productsCreated, productsMatched: counts.productsMatched, listingsCreated: counts.listingsCreated, listingsUpdated: counts.listingsUpdated, priceHistoriesCreated: counts.priceHistoriesCreated, alertCandidates: counts.alertCandidates, alertsSent: counts.alertsSent, alertsSuppressed: counts.alertsSuppressed, alertsFailed: counts.alertsFailed, errors: counts.errorsCount, startedAt, finishedAt, ...(message ? { message } : {}) };
}

export async function orchestrateScheduledPokemillon(ownerUserId: string, dependencies: ScheduledMonitorDependencies): Promise<{ statusCode: number; body: ScheduledMonitorSummary }> {
  const lock = await dependencies.runs.acquireScheduledLock(ownerUserId, SOURCE_KEY);
  if (!lock.acquired) return { statusCode: 409, body: summary("already_running", emptyCounts(), null, null, "Monitor already running") };

  try {
    const result = await dependencies.execute();
    const counts = countsFrom(result);
    const finishedAt = new Date().toISOString();
    if (result.log.pagesFetched === 0) {
      const message = "No se pudo obtener ninguna página pública de Pokemillon.";
      await dependencies.runs.finish(lock.runId, ownerUserId, "failed", { ...counts, errorsCount: Math.max(1, counts.errorsCount) }, message);
      return { statusCode: 502, body: summary("failed", { ...counts, errorsCount: Math.max(1, counts.errorsCount) }, lock.startedAt, finishedAt, message) };
    }
    const status = counts.errorsCount > 0 || counts.alertsFailed > 0 ? "partial" : "completed";
    const safeError = status === "partial" ? "La ejecución terminó con errores aislados; revisa el historial del monitor." : undefined;
    await dependencies.runs.finish(lock.runId, ownerUserId, status, counts, safeError);
    return { statusCode: 200, body: summary(status, counts, lock.startedAt, finishedAt, safeError) };
  } catch {
    const counts = { ...emptyCounts(), errorsCount: 1 };
    const finishedAt = new Date().toISOString();
    const message = "La ejecución programada no pudo completarse.";
    try { await dependencies.runs.finish(lock.runId, ownerUserId, "failed", counts, message); } catch { /* Preserve the original safe response. */ }
    return { statusCode: 502, body: summary("failed", counts, lock.startedAt, finishedAt, message) };
  }
}

export async function runConfiguredScheduledPokemillon(ownerUserId: string): Promise<{ statusCode: number; body: ScheduledMonitorSummary }> {
  const admin = createAdminClient();
  const owner = await admin.auth.admin.getUserById(ownerUserId);
  if (owner.error || !owner.data.user) return { statusCode: 503, body: summary("failed", { ...emptyCounts(), errorsCount: 1 }, null, null, "La configuración del propietario no es válida.") };
  const ingestion = new SupabaseIngestionRepository(admin, ownerUserId);
  const delivery = new SupabaseAlertDeliveryRepository(admin, ownerUserId);
  return orchestrateScheduledPokemillon(ownerUserId, {
    runs: new SupabaseMonitorRunRepository(admin),
    execute: () => executePokemillonMonitor({
      dryRun: false,
      maxPages: 1,
      pageSize: 50,
      delayMs: 750,
      timeoutMs: 12_000,
      retries: 2,
      ingest: (observation) => ingestObservation(ingestion, observation),
      deliver: async (outcome) => (await deliverAlertCandidates(delivery, outcome.alertCandidates)).summary,
      afterIngestion: async (productIds) => { await refreshMarketSignalsForProductsSafely(admin, ownerUserId, productIds); const analyses = await loadProductInvestmentAnalyses(admin, ownerUserId, { productIds, limit: productIds.length }); for (const analysis of analyses) await persistProductInvestmentSnapshot(admin, ownerUserId, analysis); },
    }),
  });
}
