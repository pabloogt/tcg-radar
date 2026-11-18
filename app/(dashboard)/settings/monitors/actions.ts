"use server";

import { revalidatePath } from "next/cache";
import { ingestObservation } from "@/lib/ingestion/ingest-observation";
import { deliverAlertCandidates, SupabaseAlertDeliveryRepository } from "@/lib/alerts/delivery";
import { SupabaseIngestionRepository } from "@/lib/ingestion/supabase-repository";
import { requireUser } from "@/lib/auth/require-user";
import { executePokemillonMonitor, type PokemillonExecutionResult } from "@/lib/monitors/pokemillon";
import { loadProductInvestmentAnalyses } from "@/lib/investment/product-data";
import { persistProductInvestmentSnapshot } from "@/lib/investment/product-snapshots";
import { refreshMarketSignalsForProductsSafely } from "@/lib/market-signals/refresh";

export type MonitorActionResult = {
  ok: boolean;
  error: string | null;
  result: PokemillonExecutionResult | null;
};

const monitorOptions = { maxPages: 1, pageSize: 50, delayMs: 750, timeoutMs: 12_000, retries: 2 } as const;

export async function runPokemillonDryAction(): Promise<MonitorActionResult> {
  await requireUser();
  try {
    const result = await executePokemillonMonitor({ ...monitorOptions, dryRun: true });
    return { ok: true, error: null, result };
  } catch {
    return { ok: false, error: "No se pudo completar la prueba en seco de Pokemillon.", result: null };
  }
}

export async function runPokemillonIngestAction(): Promise<MonitorActionResult> {
  const { supabase, user } = await requireUser();
  const repository = new SupabaseIngestionRepository(supabase, user.id);
  const alertRepository = new SupabaseAlertDeliveryRepository(supabase, user.id);
  try {
    const result = await executePokemillonMonitor({
      ...monitorOptions,
      dryRun: false,
      ingest: (observation) => ingestObservation(repository, observation),
      deliver: async (outcome) => (await deliverAlertCandidates(alertRepository, outcome.alertCandidates)).summary,
      afterIngestion: async (productIds) => { await refreshMarketSignalsForProductsSafely(supabase, user.id, productIds); const analyses = await loadProductInvestmentAnalyses(supabase, user.id, { productIds, limit: productIds.length }); for (const analysis of analyses) await persistProductInvestmentSnapshot(supabase, user.id, analysis); },
    });
    revalidatePath("/products");
    revalidatePath("/stores");
    revalidatePath("/listings");
    return { ok: true, error: null, result };
  } catch {
    return { ok: false, error: "No se pudo completar la ingesta de Pokemillon.", result: null };
  }
}
