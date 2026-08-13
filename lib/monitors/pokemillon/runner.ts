import type { IngestionResult } from "@/lib/ingestion/types";
import type { AlertDeliverySummary } from "@/lib/alerts/delivery";
import type { NormalizedListingObservation } from "@/lib/monitors/types";
import { runPokemillonMonitor, type PokemillonMonitorOptions, type PokemillonMonitorResult } from "./monitor";
import type { MonitorRunError } from "./types";

export type PokemillonIngestionSummary = {
  observations: number;
  productsCreated: number;
  productsMatched: number;
  storesCreated: number;
  storesMatched: number;
  listingsCreated: number;
  listingsUpdated: number;
  priceHistoriesCreated: number;
  alertCandidates: number;
  alertsSent: number;
  alertsDuplicate: number;
  alertsFailed: number;
  skipped: number;
  errors: number;
};

export type PokemillonExecutionResult = PokemillonMonitorResult & {
  mode: "dry_run" | "ingest";
  ingestion: PokemillonIngestionSummary;
};

function emptySummary(result: PokemillonMonitorResult): PokemillonIngestionSummary {
  return { observations: result.observations.length, productsCreated: 0, productsMatched: 0, storesCreated: 0, storesMatched: 0, listingsCreated: 0, listingsUpdated: 0, priceHistoriesCreated: 0, alertCandidates: 0, alertsSent: 0, alertsDuplicate: 0, alertsFailed: 0, skipped: result.skipped.length, errors: result.errors.length };
}

export async function executePokemillonMonitor(options: PokemillonMonitorOptions & { dryRun: boolean; ingest?: (observation: NormalizedListingObservation) => Promise<IngestionResult>; deliver?: (result: IngestionResult) => Promise<AlertDeliverySummary> }): Promise<PokemillonExecutionResult> {
  const result = await runPokemillonMonitor(options);
  const ingestion = emptySummary(result);
  if (options.dryRun) return { ...result, mode: "dry_run", ingestion };
  if (!options.ingest) throw new Error("La ejecución real requiere un servicio de ingesta autenticado.");

  const ingestionErrors: MonitorRunError[] = [];
  for (const observation of result.observations) {
    try {
      const outcome = await options.ingest(observation);
      ingestion.productsCreated += Number(outcome.product.created);
      ingestion.productsMatched += Number(!outcome.product.created);
      ingestion.storesCreated += Number(outcome.store.created);
      ingestion.storesMatched += Number(!outcome.store.created);
      ingestion.listingsCreated += Number(outcome.listing.created);
      ingestion.listingsUpdated += Number(!outcome.listing.created && (outcome.listing.priceChanged || outcome.listing.stockChanged));
      ingestion.priceHistoriesCreated += Number(outcome.listing.historyCreated);
      ingestion.alertCandidates += outcome.alertCandidates.length;
      if (options.deliver && outcome.alertCandidates.length > 0) {
        try {
          const delivery = await options.deliver(outcome);
          ingestion.alertsSent += delivery.sent;
          ingestion.alertsDuplicate += delivery.duplicates;
          ingestion.alertsFailed += delivery.failed;
        } catch {
          ingestion.alertsFailed += outcome.alertCandidates.length;
        }
      }
    } catch {
      ingestionErrors.push({ sourceUrl: observation.listing.url, stage: "ingestion", message: "La observación no pudo guardarse y fue omitida." });
    }
  }
  ingestion.errors += ingestionErrors.length;
  return { ...result, errors: [...result.errors, ...ingestionErrors], mode: "ingest", ingestion };
}
