import { notFound } from "next/navigation";
import { z } from "zod";
import { PageHeader } from "@/components/page-header";
import { SetForm } from "@/components/investment/set-form";
import { requireUser } from "@/lib/auth/require-user";
import { updateSet } from "../../../actions";
export default async function EditSetPage({ params }: { params: Promise<{ id: string }> }) { const { id } = await params; if (!z.uuid().safeParse(id).success) notFound(); const { supabase, user } = await requireUser(); const { data } = await supabase.from("tcg_sets").select("*").eq("id", id).eq("user_id", user.id).maybeSingle(); if (!data) notFound(); return <><PageHeader title="Editar colección" description="Actualiza la identidad y metadatos del set." /><SetForm action={updateSet} set={data} /></>; }
