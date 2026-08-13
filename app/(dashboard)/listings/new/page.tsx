import { createListing } from "@/app/(dashboard)/listings/actions";
import { EmptyState } from "@/components/empty-state";
import { ListingForm } from "@/components/listings/listing-form";
import { PageHeader } from "@/components/page-header";
import { requireUser } from "@/lib/auth/require-user";
export default async function NewListingPage() { const { supabase, user } = await requireUser(); const [{ data: products }, { data: stores }] = await Promise.all([supabase.from("products").select("id, name").eq("user_id", user.id).order("name"), supabase.from("stores").select("id, name").eq("user_id", user.id).order("name")]); const ready = Boolean(products?.length && stores?.length); return <><PageHeader title="Nuevo listing" description="Relaciona un producto con una tienda y registra su precio actual." />{ready ? <ListingForm action={createListing} products={products ?? []} stores={stores ?? []} /> : <EmptyState title="Faltan datos previos" description="Necesitas al menos un producto y una tienda antes de crear un listing." action={{ label: products?.length ? "Crear tienda" : "Crear producto", href: products?.length ? "/stores/new" : "/products/new" }} />}</>; }
