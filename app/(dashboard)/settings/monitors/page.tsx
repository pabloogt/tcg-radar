import { PageHeader } from "@/components/page-header";
import { PokemillonCard } from "@/components/monitors/pokemillon-card";
import { requireUser } from "@/lib/auth/require-user";
import { isScheduledMonitorConfigured } from "@/lib/cron/env";

export default async function MonitorsPage() {
  const { supabase, user } = await requireUser();
  const { data: runs } = await supabase.from("monitor_runs").select("status, started_at, finished_at, alerts_sent, errors_count").eq("user_id", user.id).eq("source_key", "pokemillon").eq("trigger_type", "scheduled").order("started_at", { ascending: false }).limit(20);
  const lastRun = runs?.[0] ?? null;
  const lastSuccessfulRun = runs?.find((run) => run.status === "completed") ?? null;
  return <><PageHeader title="Monitores" description="Ejecuta adaptadores de tiendas de forma manual y revisa sus resultados antes de ingerirlos." /><PokemillonCard automaticConfigured={isScheduledMonitorConfigured()} scheduledStatus={{ lastRun, lastSuccessfulRun }} /></>;
}
