import { notFound } from "next/navigation";
import { z } from "zod";
import { PullRateForm } from "@/components/investment/pull-rate-form";
import { PageHeader } from "@/components/page-header";
import { requireUser } from "@/lib/auth/require-user";
import { savePullRate } from "../../actions";

export default async function EditPullRatePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params; if (!z.uuid().safeParse(id).success) notFound(); const { supabase, user } = await requireUser();
  const { data: rate } = await supabase.from("set_pull_rates").select("*").eq("id", id).eq("user_id", user.id).maybeSingle(); if (!rate) notFound();
  const [{ data: sets }, { data: cards }] = await Promise.all([
    supabase.from("tcg_sets").select("id,name,tcg").eq("id", rate.set_id).eq("user_id", user.id),
    supabase.from("tcg_cards").select("id,set_id,name,card_number,variant_name").eq("set_id", rate.set_id).eq("user_id", user.id).order("name").limit(5_000),
  ]);
  return <><PageHeader title="Editar pull rate" description="Corrige la observación conservando su identidad y procedencia." /><PullRateForm action={savePullRate} sets={sets ?? []} cards={cards ?? []} rate={rate} /></>;
}
