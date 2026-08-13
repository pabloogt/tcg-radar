import "server-only";

import type { NormalizedListingObservation } from "@/lib/monitors/types";
import { createClient } from "@/lib/supabase/server";
import { ingestObservation } from "./ingest-observation";
import { SupabaseIngestionRepository } from "./supabase-repository";

export async function ingestForAuthenticatedUser(
  observation: NormalizedListingObservation,
  options: { minimumPriceDropBasisPoints?: number } = {},
) {
  const client = await createClient();
  const { data: { user }, error } = await client.auth.getUser();
  if (error || !user) throw new Error("Authenticated user required for ingestion");
  return ingestObservation(
    new SupabaseIngestionRepository(client, user.id),
    observation,
    options,
  );
}
