import type { NormalizedListingObservation, StoreMonitor } from "@/lib/monitors/types";
import { fetchPokemillonCollection, type FetchCollectionOptions } from "./fetcher";
import { parsePokemillonCollectionPage } from "./parser";
import {
  POKEMILLON_SOURCE_KEY,
  type MonitorRunError,
  type MonitorSkip,
  type PokemillonCollection,
  type PokemillonRunLog,
} from "./types";

export const POKEMILLON_COLLECTIONS: readonly PokemillonCollection[] = [
  { handle: "cajas-elite-de-entrenador", tcg: "pokemon", label: "Pokémon ETB" },
  { handle: "cajas-de-sobres", tcg: "pokemon", label: "Pokémon cajas de sobres" },
  { handle: "caja-one-piece", tcg: "one_piece", label: "One Piece cajas" },
  { handle: "mazos-y-barajas-one-piece", tcg: "one_piece", label: "One Piece mazos" },
];

export type PokemillonMonitorOptions = {
  maxPages?: number;
  pageSize?: number;
  delayMs?: number;
  timeoutMs?: number;
  retries?: number;
  collections?: readonly PokemillonCollection[];
  fetchImplementation?: typeof fetch;
  observedAt?: string;
};

export type PokemillonMonitorResult = {
  observations: NormalizedListingObservation[];
  skipped: MonitorSkip[];
  errors: MonitorRunError[];
  log: PokemillonRunLog;
};

function pause(milliseconds: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

export class PokemillonMonitor implements StoreMonitor {
  readonly sourceKey = POKEMILLON_SOURCE_KEY;

  constructor(private readonly options: PokemillonMonitorOptions = {}) {}

  async run(): Promise<NormalizedListingObservation[]> {
    return (await this.runDetailed()).observations;
  }

  async runDetailed(): Promise<PokemillonMonitorResult> {
    const startedAt = new Date().toISOString();
    const observedAt = this.options.observedAt ?? startedAt;
    const observations: NormalizedListingObservation[] = [];
    const skipped: MonitorSkip[] = [];
    const errors: MonitorRunError[] = [];
    let pagesFetched = 0;
    let productsSeen = 0;

    const collections = this.options.collections ?? POKEMILLON_COLLECTIONS;
    for (const [collectionIndex, collection] of collections.entries()) {
      const fetchOptions: FetchCollectionOptions = {
        handle: collection.handle,
        maxPages: this.options.maxPages,
        pageSize: this.options.pageSize,
        delayMs: this.options.delayMs,
        timeoutMs: this.options.timeoutMs,
        retries: this.options.retries,
        fetchImplementation: this.options.fetchImplementation,
      };
      const fetched = await fetchPokemillonCollection(fetchOptions);
      errors.push(...fetched.errors);
      pagesFetched += fetched.pages.length;
      for (const page of fetched.pages) {
        const parsed = parsePokemillonCollectionPage(page.body, collection, observedAt);
        productsSeen += parsed.productsSeen;
        observations.push(...parsed.observations);
        skipped.push(...parsed.skipped);
        errors.push(...parsed.errors);
      }
      if (collectionIndex < collections.length - 1) await pause(Math.max(this.options.delayMs ?? 750, 0));
    }

    const unique = new Map<string, NormalizedListingObservation>();
    for (const observation of observations) {
      const key = `${observation.source}:${observation.sourceProductId ?? observation.listing.url}`;
      if (unique.has(key)) {
        skipped.push({ sourceUrl: observation.listing.url, reason: "duplicate", title: observation.product.name });
      } else {
        unique.set(key, observation);
      }
    }
    const deduplicated = [...unique.values()];
    const finishedAt = new Date().toISOString();
    const ambiguousProducts = skipped.filter((item) => item.reason === "ambiguous_variant" || item.reason === "ambiguous_product_type").length;
    const parsingErrors = errors.filter((error) => error.stage === "parse" || error.stage === "classification").length;
    return {
      observations: deduplicated,
      skipped,
      errors,
      log: {
        startedAt,
        finishedAt,
        sourceKey: POKEMILLON_SOURCE_KEY,
        pagesFetched,
        productsSeen,
        observationsProduced: deduplicated.length,
        observationsSkipped: skipped.length,
        errorsCount: errors.length,
        pokemon: deduplicated.filter((item) => item.product.tcg === "pokemon").length,
        onePiece: deduplicated.filter((item) => item.product.tcg === "one_piece").length,
        ambiguousProducts,
        parsingErrors,
      },
    };
  }
}

export async function runPokemillonMonitor(options: PokemillonMonitorOptions = {}): Promise<PokemillonMonitorResult> {
  return new PokemillonMonitor(options).runDetailed();
}
