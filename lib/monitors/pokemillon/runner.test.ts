import { describe, expect, it, vi } from "vitest";
import type { IngestionResult } from "@/lib/ingestion/types";
import pokemonPage from "./__fixtures__/pokemon-page.json";
import { executePokemillonMonitor } from "./runner";

function jsonResponse(body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
}

function successfulIngestion(): IngestionResult {
  return {
    store: { id: "store-id", created: false },
    product: { id: "product-id", created: false },
    listing: {
      id: "listing-id",
      created: false,
      priceChanged: false,
      stockChanged: false,
      historyCreated: false,
    },
    evaluationStatus: "insufficient_market_data",
    evaluation: null,
    alertCandidates: [],
  };
}

const monitorOptions = {
  collections: [{ handle: "pokemon", tcg: "pokemon", label: "Pokemon" }] as const,
  maxPages: 1,
  retries: 0,
  delayMs: 0,
  observedAt: "2026-08-13T10:00:00.000Z",
};

describe("manual Pokemillon execution", () => {
  it("keeps dry runs read-only", async () => {
    const ingest = vi.fn(async () => successfulIngestion());
    const result = await executePokemillonMonitor({
      ...monitorOptions,
      dryRun: true,
      ingest,
      fetchImplementation: vi.fn<typeof fetch>().mockResolvedValue(jsonResponse(pokemonPage)),
    });

    expect(result.mode).toBe("dry_run");
    expect(result.observations.length).toBeGreaterThan(0);
    expect(ingest).not.toHaveBeenCalled();
  });

  it("keeps authenticated manual ingestion available through the shared runner", async () => {
    const ingest = vi.fn(async () => successfulIngestion());
    const result = await executePokemillonMonitor({
      ...monitorOptions,
      dryRun: false,
      ingest,
      fetchImplementation: vi.fn<typeof fetch>().mockResolvedValue(jsonResponse(pokemonPage)),
    });

    expect(result.mode).toBe("ingest");
    expect(ingest).toHaveBeenCalledTimes(result.observations.length);
    expect(result.ingestion.productsMatched).toBe(result.observations.length);
  });
});
