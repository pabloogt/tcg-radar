import { describe, expect, it, vi } from "vitest";
import pokemonPage from "./__fixtures__/pokemon-page.json";
import { fetchPokemillonCollection } from "./fetcher";
import { runPokemillonMonitor } from "./monitor";

function jsonResponse(body: unknown): Response {
  return new Response(JSON.stringify(body), { status: 200, headers: { "Content-Type": "application/json" } });
}

describe("Pokemillon monitor network boundary", () => {
  it("paginates deterministically and stops on an incomplete page", async () => {
    const fullPage = { products: Array.from({ length: 2 }, (_, index) => ({ id: index })) };
    const fetchImplementation = vi.fn<typeof fetch>()
      .mockResolvedValueOnce(jsonResponse(fullPage))
      .mockResolvedValueOnce(jsonResponse({ products: [] }));
    const result = await fetchPokemillonCollection({ handle: "demo", maxPages: 4, pageSize: 2, delayMs: 0, retries: 0, fetchImplementation });
    expect(result.pages).toHaveLength(2);
    expect(fetchImplementation.mock.calls[0]?.[0]).toContain("page=1");
    expect(fetchImplementation.mock.calls[1]?.[0]).toContain("page=2");
  });

  it("deduplicates products repeated across collection pages", async () => {
    const fetchImplementation = vi.fn<typeof fetch>().mockImplementation(async () => jsonResponse(pokemonPage));
    const result = await runPokemillonMonitor({
      collections: [
        { handle: "first", tcg: "pokemon", label: "First" },
        { handle: "second", tcg: "pokemon", label: "Second" },
      ],
      maxPages: 1,
      fetchImplementation,
      retries: 0,
      delayMs: 0,
      observedAt: "2026-08-13T10:00:00.000Z",
    });
    expect(result.observations).toHaveLength(3);
    expect(result.skipped.filter((item) => item.reason === "duplicate")).toHaveLength(3);
  });

  it("isolates a parser failure and continues with another collection", async () => {
    const fetchImplementation = vi.fn<typeof fetch>()
      .mockResolvedValueOnce(jsonResponse({ invalid: true }))
      .mockResolvedValueOnce(jsonResponse(pokemonPage));
    const result = await runPokemillonMonitor({
      collections: [
        { handle: "broken", tcg: "pokemon", label: "Broken" },
        { handle: "working", tcg: "pokemon", label: "Working" },
      ],
      maxPages: 1,
      fetchImplementation,
      retries: 0,
      delayMs: 0,
    });
    expect(result.errors.some((item) => item.stage === "parse")).toBe(true);
    expect(result.observations.length).toBeGreaterThan(0);
  });
});
