import { notFound } from "next/navigation";
import { z } from "zod";
import { updateListing } from "@/app/(dashboard)/listings/actions";
import { ListingForm } from "@/components/listings/listing-form";
import { ListingTargetForm } from "@/components/listings/listing-target-form";
import { PageHeader } from "@/components/page-header";
import { requireUser } from "@/lib/auth/require-user";
export default async function EditListingPage({ params }: { params: Promise<{ id: string }> }) { const { id } = await params; if (!z.uuid().safeParse(id).success) notFound(); const { supabase, user } = await requireUser(); const [{ data: listing }, { data: products }, { data: stores }, { data: target }] = await Promise.all([supabase.from("listings").select("*").eq("id", id).eq("user_id", user.id).maybeSingle(), supabase.from("products").select("id, name").eq("user_id", user.id).order("name"), supabase.from("stores").select("id, name").eq("user_id", user.id).order("name"), supabase.from("listing_alert_targets").select("target_price_cents, enabled").eq("listing_id", id).eq("user_id", user.id).maybeSingle()]); if (!listing) notFound(); return <><PageHeader title="Editar listing" description="Actualiza precio, disponibilidad o relación comercial." /><ListingForm action={updateListing} listing={listing} products={products ?? []} stores={stores ?? []} /><ListingTargetForm listingId={listing.id} initialTarget={target} /></>; }
