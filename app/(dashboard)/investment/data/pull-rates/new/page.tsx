import { PullRateForm } from "@/components/investment/pull-rate-form";
import { PageHeader } from "@/components/page-header";
import { requireUser } from "@/lib/auth/require-user";
import { savePullRate } from "../actions";

export default async function NewPullRatePage({ searchParams }: { searchParams: Promise<{ setId?: string }> }) {
  const { setId } = await searchParams; const { supabase, user } = await requireUser();
  const [{ data: sets }, { data: cards }] = await Promise.all([
    supabase.from("tcg_sets").select("id,name,tcg").eq("user_id", user.id).order("name").limit(500),
    supabase.from("tcg_cards").select("id,set_id,name,card_number,variant_name").eq("user_id", user.id).order("name").limit(5_000),
  ]);
  return <><PageHeader title="Nuevo pull rate" description="Añade una observación manual y conserva su fuente y nivel de confianza." /><PullRateForm action={savePullRate} sets={sets ?? []} cards={(cards ?? []).filter((card) => !setId || card.set_id === setId)} selectedSetId={setId} /></>;
}
