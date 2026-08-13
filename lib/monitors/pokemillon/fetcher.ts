import { POKEMILLON_ORIGIN, pokemillonCollectionPageSchema, type MonitorRunError } from "./types";

const USER_AGENT = "TCGRadar/0.1 private-price-monitor";

export type FetchCollectionOptions = {
  handle: string;
  maxPages?: number;
  pageSize?: number;
  delayMs?: number;
  timeoutMs?: number;
  retries?: number;
  fetchImplementation?: typeof fetch;
};

export type FetchedCollectionPage = {
  pageNumber: number;
  sourceUrl: string;
  body: unknown;
};

export type FetchCollectionResult = {
  pages: FetchedCollectionPage[];
  errors: MonitorRunError[];
};

function wait(milliseconds: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

function isTransientStatus(status: number): boolean {
  return status === 408 || status === 429 || status >= 500;
}

async function fetchPage(url: string, fetchImplementation: typeof fetch, timeoutMs: number, retries: number): Promise<unknown> {
  let lastMessage = "Fallo de red desconocido.";
  for (let attempt = 0; attempt <= retries; attempt += 1) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const response = await fetchImplementation(url, {
        headers: { Accept: "application/json", "User-Agent": USER_AGENT },
        signal: controller.signal,
        cache: "no-store",
      });
      if (!response.ok) {
        lastMessage = `Pokemillon respondió con HTTP ${response.status}.`;
        if (!isTransientStatus(response.status) || attempt === retries) throw new Error(lastMessage);
      } else {
        return await response.json();
      }
    } catch (error) {
      lastMessage = error instanceof Error && error.name === "AbortError" ? "La petición a Pokemillon superó el tiempo límite." : error instanceof Error ? error.message : lastMessage;
      if (attempt === retries) throw new Error(lastMessage);
    } finally {
      clearTimeout(timeout);
    }
    await wait(500 * (attempt + 1));
  }
  throw new Error(lastMessage);
}

export async function fetchPokemillonCollection(options: FetchCollectionOptions): Promise<FetchCollectionResult> {
  const maxPages = Math.min(Math.max(options.maxPages ?? 1, 1), 5);
  const pageSize = Math.min(Math.max(options.pageSize ?? 50, 1), 250);
  const delayMs = Math.max(options.delayMs ?? 750, 0);
  const timeoutMs = Math.max(options.timeoutMs ?? 12_000, 1_000);
  const retries = Math.min(Math.max(options.retries ?? 2, 0), 2);
  const fetchImplementation = options.fetchImplementation ?? fetch;
  const pages: FetchedCollectionPage[] = [];
  const errors: MonitorRunError[] = [];

  for (let pageNumber = 1; pageNumber <= maxPages; pageNumber += 1) {
    const sourceUrl = `${POKEMILLON_ORIGIN}/collections/${encodeURIComponent(options.handle)}/products.json?limit=${pageSize}&page=${pageNumber}`;
    try {
      const body = await fetchPage(sourceUrl, fetchImplementation, timeoutMs, retries);
      pages.push({ pageNumber, sourceUrl, body });
      const pageShape = pokemillonCollectionPageSchema.safeParse(body);
      if (!pageShape.success || pageShape.data.products.length < pageSize) break;
    } catch (error) {
      errors.push({ sourceUrl, stage: "fetch", message: error instanceof Error ? error.message : "No se pudo descargar la colección." });
      break;
    }
    if (pageNumber < maxPages) await wait(delayMs);
  }
  return { pages, errors };
}
