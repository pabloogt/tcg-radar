import "server-only";

import { z } from "zod";

const scheduledEnvironmentSchema = z.object({
  NEXT_PUBLIC_SUPABASE_URL: z.url(),
  SUPABASE_SECRET_KEY: z.string().trim().regex(/^sb_secret_[A-Za-z0-9_-]+$/, "Invalid SUPABASE_SECRET_KEY format"),
  CRON_SECRET: z.string().min(32, "CRON_SECRET must contain at least 32 characters"),
  TCG_RADAR_OWNER_USER_ID: z.uuid("TCG_RADAR_OWNER_USER_ID must be a UUID"),
});

export type ScheduledEnvironment = z.infer<typeof scheduledEnvironmentSchema>;

export function parseScheduledEnvironment(values: Record<string, unknown>): ScheduledEnvironment {
  return scheduledEnvironmentSchema.parse(values);
}

export function getCronSecret(): string {
  const parsed = z.string().min(32).safeParse(process.env.CRON_SECRET);
  if (!parsed.success) throw new Error("Missing or invalid CRON_SECRET configuration.");
  return parsed.data;
}

export function getScheduledEnvironment(): ScheduledEnvironment {
  const parsed = scheduledEnvironmentSchema.safeParse({
    NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
    SUPABASE_SECRET_KEY: process.env.SUPABASE_SECRET_KEY,
    CRON_SECRET: process.env.CRON_SECRET,
    TCG_RADAR_OWNER_USER_ID: process.env.TCG_RADAR_OWNER_USER_ID,
  });
  if (!parsed.success) {
    const invalid = parsed.error.issues.map((issue) => issue.path.join(".")).join(", ");
    throw new Error(`Missing or invalid scheduled-monitor configuration: ${invalid}`);
  }
  return parsed.data;
}

export function isScheduledMonitorConfigured(): boolean {
  try { getScheduledEnvironment(); return true; } catch { return false; }
}
