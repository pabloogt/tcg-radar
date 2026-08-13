import { notFound } from "next/navigation";
import { z } from "zod";
import { updateStore } from "@/app/(dashboard)/stores/actions";
import { PageHeader } from "@/components/page-header";
import { StoreForm } from "@/components/stores/store-form";
import { requireUser } from "@/lib/auth/require-user";
export default async function EditStorePage({ params }: { params: Promise<{ id: string }> }) { const { id } = await params; if (!z.uuid().safeParse(id).success) notFound(); const { supabase, user } = await requireUser(); const { data } = await supabase.from("stores").select("*").eq("id", id).eq("user_id", user.id).maybeSingle(); if (!data) notFound(); return <><PageHeader title="Editar tienda" description="Actualiza los datos de la tienda." /><StoreForm action={updateStore} store={data} /></>; }
