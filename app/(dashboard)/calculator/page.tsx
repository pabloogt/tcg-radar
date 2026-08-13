import { OpportunityCalculator } from "@/components/calculator/opportunity-calculator";
import { PageHeader } from "@/components/page-header";
import { requireUser } from "@/lib/auth/require-user";

export default async function CalculatorPage({ searchParams }: { searchParams: Promise<{ listing?: string }> }) {
  const { listing: initialListingId } = await searchParams; const { supabase, user } = await requireUser();
  const [{ data: products }, { data: listings }, { data: stores }] = await Promise.all([
    supabase.from("products").select("id, name, reprint_risk, demand_score, long_term_score, retail_price_cents").eq("user_id", user.id).order("name"),
    supabase.from("listings").select("id, product_id, store_id, price_cents, shipping_cents, shipping_known").eq("user_id", user.id).order("checked_at", { ascending: false }),
    supabase.from("stores").select("id, name").eq("user_id", user.id),
  ]);
  const productMap = new Map((products ?? []).map((item) => [item.id, item])); const storeMap = new Map((stores ?? []).map((item) => [item.id, item]));
  const listingOptions = (listings ?? []).flatMap((item) => { const product = productMap.get(item.product_id); const store = storeMap.get(item.store_id); return product && store ? [{ id: item.id, product_id: item.product_id, product_name: product.name, store_name: store.name, price_cents: item.price_cents, shipping_cents: item.shipping_cents, shipping_known: item.shipping_known }] : []; });
  return <><PageHeader title="Calculadora de oportunidades" description="Evalúa beneficio, ROI, break-even y precio máximo de compra con reglas deterministas." /><OpportunityCalculator products={products ?? []} listings={listingOptions} initialListingId={initialListingId} /></>;
}
