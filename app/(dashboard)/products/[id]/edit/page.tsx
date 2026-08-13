import { notFound } from "next/navigation";
import { z } from "zod";
import { updateProduct } from "@/app/(dashboard)/products/actions";
import { PageHeader } from "@/components/page-header";
import { ProductForm } from "@/components/products/product-form";
import { requireUser } from "@/lib/auth/require-user";
export default async function EditProductPage({ params }: { params: Promise<{ id: string }> }) { const { id } = await params; if (!z.uuid().safeParse(id).success) notFound(); const { supabase, user } = await requireUser(); const { data } = await supabase.from("products").select("*").eq("id", id).eq("user_id", user.id).maybeSingle(); if (!data) notFound(); return <><PageHeader title="Editar producto" description="Actualiza los datos del producto sellado." /><ProductForm action={updateProduct} product={data} /></>; }
