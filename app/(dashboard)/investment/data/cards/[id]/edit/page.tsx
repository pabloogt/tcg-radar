import Link from "next/link";
import { notFound } from "next/navigation";
import { z } from "zod";
import { CardEditForm } from "@/components/investment/card-edit-form";
import { PageHeader } from "@/components/page-header";
import { requireUser } from "@/lib/auth/require-user";
import { updateCard } from "../../actions";

export default async function EditCardPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params; if (!z.uuid().safeParse(id).success) notFound(); const { supabase, user } = await requireUser(); const { data: card } = await supabase.from("tcg_cards").select("*").eq("id", id).eq("user_id", user.id).maybeSingle(); if (!card) notFound();
  return <><div className="mb-6 flex items-start justify-between gap-4"><PageHeader title="Corregir carta" description="Ajuste mínimo del catálogo usado por Investment Intelligence." /><Link href="/investment/data" className="rounded-lg border bg-white px-3 py-2 text-sm font-semibold">Volver a datos</Link></div><CardEditForm card={card} action={updateCard} /></>;
}
