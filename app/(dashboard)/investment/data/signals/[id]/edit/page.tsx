import { notFound } from "next/navigation";
import { z } from "zod";
import { MarketSignalForm } from "@/components/investment/market-signal-form";
import { PageHeader } from "@/components/page-header";
import { requireUser } from "@/lib/auth/require-user";
import { updateMarketSignal } from "../../actions";

export default async function EditMarketSignalPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params; if (!z.uuid().safeParse(id).success) notFound(); const { supabase, user } = await requireUser();
  const [{ data: signal }, { data: sets }] = await Promise.all([
    supabase.from("set_market_signals").select("*").eq("id", id).eq("user_id", user.id).in("source_type", ["manual", "official"]).maybeSingle(),
    supabase.from("tcg_sets").select("id,name,tcg").eq("user_id", user.id).order("name").limit(500),
  ]);
  if (!signal) notFound();
  return <><PageHeader title="Editar señal" description="Corrige únicamente observaciones manuales u oficiales introducidas por ti." /><MarketSignalForm action={updateMarketSignal} sets={sets ?? []} row={signal} /></>;
}
