import "server-only";

import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { getScheduledEnvironment } from "@/lib/cron/env";
import type { Database } from "@/lib/supabase/database.types";

export function createAdminClient(): SupabaseClient<Database> {
  const environment = getScheduledEnvironment();
  return createClient<Database>(environment.NEXT_PUBLIC_SUPABASE_URL, environment.SUPABASE_SECRET_KEY, {
    auth: { autoRefreshToken: false, detectSessionInUrl: false, persistSession: false },
  });
}
