import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database, Tables } from "@/lib/supabase/database.types";
import { loadProductInvestmentAnalyses, type InvestmentListingView, type ProductInvestmentAnalysis } from "./product-data";
import type { ExistingExposure, PortfolioCandidate, PortfolioListing } from "./portfolio";

type PurchaseExposureRow = Pick<Tables<"purchases">, "id" | "product_id" | "quantity" | "unit_cost_cents" | "shipping_cents">;
type SaleExposureRow = Pick<Tables<"sales">, "purchase_id" | "quantity">;
type ProductExposureRow = Pick<Tables<"products">, "id" | "set_id" | "tcg">;

function listingFreshness(listing: InvestmentListingView, now: Date, staleHours: number): number {
  return now.getTime() - new Date(listing.checked_at).getTime() <= staleHours * 3_600_000 ? 0 : 1;
}

function stockOrder(stockStatus: string): number {
  return stockStatus === "in_stock" ? 0 : stockStatus === "preorder" ? 1 : 2;
}

function listingCost(listing: InvestmentListingView): number {
  return listing.shipping_known ? listing.price_cents + listing.shipping_cents : listing.price_cents;
}

export function selectBestPortfolioListing(listings: readonly InvestmentListingView[], now: Date, staleHours: number): InvestmentListingView | null {
  return [...listings]
    .filter((listing) => listing.stock_status === "in_stock" || listing.stock_status === "preorder")
    .sort((left, right) => listingFreshness(left, now, staleHours) - listingFreshness(right, now, staleHours)
      || stockOrder(left.stock_status) - stockOrder(right.stock_status)
      || Number(right.shipping_known) - Number(left.shipping_known)
      || listingCost(left) - listingCost(right)
      || left.id.localeCompare(right.id))[0] ?? null;
}

function toListing(listing: InvestmentListingView): PortfolioListing {
  return {
    listingId: listing.id,
    storeId: listing.store_id,
    storeName: listing.store?.name ?? "Tienda desconocida",
    priceCents: listing.price_cents,
    shippingCents: listing.shipping_known ? listing.shipping_cents : null,
    shippingKnown: listing.shipping_known,
    totalCostCents: listing.shipping_known ? listing.price_cents + listing.shipping_cents : null,
    stockStatus: listing.stock_status,
    checkedAt: listing.checked_at,
    country: listing.country,
    url: listing.url,
  };
}

export function portfolioCandidatesFromAnalyses(analyses: readonly ProductInvestmentAnalysis[], now = new Date(), staleHours = 24): PortfolioCandidate[] {
  return analyses.map((analysis) => {
    const selected = selectBestPortfolioListing(analysis.listings, now, staleHours);
    const alternatives = analysis.listings.filter((listing) => listing.id !== selected?.id && (listing.stock_status === "in_stock" || listing.stock_status === "preorder"))
      .sort((left, right) => stockOrder(left.stock_status) - stockOrder(right.stock_status) || Number(right.shipping_known) - Number(left.shipping_known) || listingCost(left) - listingCost(right))
      .map(toListing);
    return {
      productId: analysis.product.id,
      productName: analysis.product.name,
      setId: analysis.set.id,
      setName: analysis.set.name,
      tcg: analysis.product.tcg,
      language: analysis.product.language,
      productType: analysis.product.product_type,
      imageUrl: analysis.product.image_url,
      investmentScores: {
        short: analysis.result.finalScores.short.score,
        medium: analysis.result.finalScores.medium.score,
        long: analysis.result.finalScores.long.score,
      },
      investmentConfidence: {
        short: analysis.result.finalScores.short.confidence,
        medium: analysis.result.finalScores.medium.confidence,
        long: analysis.result.finalScores.long.confidence,
      },
      setScores: {
        short: analysis.setScores.short.score,
        medium: analysis.setScores.medium.score,
        long: analysis.setScores.long.score,
      },
      vehicleScore: analysis.vehicle.score,
      entryScore: analysis.entry.score,
      entryConfidence: analysis.entry.confidence,
      entryCompleteness: analysis.entry.completeness,
      dealClassification: analysis.deal?.classification ?? null,
      marketReferenceCents: analysis.market.reference?.referencePriceCents ?? null,
      bestListing: selected ? toListing(selected) : null,
      alternativeListings: alternatives,
      availableQuantity: selected?.available_quantity ?? null,
    };
  });
}

export function calculateExistingExposure(purchases: readonly PurchaseExposureRow[], sales: readonly SaleExposureRow[], products: readonly ProductExposureRow[]): ExistingExposure {
  const soldByPurchase = sales.reduce<Map<string, number>>((result, sale) => result.set(sale.purchase_id, (result.get(sale.purchase_id) ?? 0) + sale.quantity), new Map());
  const productMap = new Map(products.map((product) => [product.id, product]));
  const byProduct: Record<string, number> = {};
  const bySet: Record<string, number> = {};
  const byTcg: Record<string, number> = {};
  let totalCents = 0;
  for (const purchase of purchases) {
    const remainingQuantity = Math.max(0, purchase.quantity - (soldByPurchase.get(purchase.id) ?? 0));
    if (!remainingQuantity) continue;
    const shippingShare = Math.round((purchase.shipping_cents * remainingQuantity) / purchase.quantity);
    const exposureCents = purchase.unit_cost_cents * remainingQuantity + shippingShare;
    const product = productMap.get(purchase.product_id);
    if (!product || exposureCents <= 0) continue;
    byProduct[product.id] = (byProduct[product.id] ?? 0) + exposureCents;
    if (product.set_id) bySet[product.set_id] = (bySet[product.set_id] ?? 0) + exposureCents;
    byTcg[product.tcg] = (byTcg[product.tcg] ?? 0) + exposureCents;
    totalCents += exposureCents;
  }
  return { totalCents, byProduct, bySet, byTcg };
}

export async function loadExistingExposure(client: SupabaseClient<Database>, userId: string): Promise<ExistingExposure> {
  const { data: purchases, error: purchaseError } = await client.from("purchases").select("id,product_id,quantity,unit_cost_cents,shipping_cents").eq("user_id", userId).limit(2_000);
  if (purchaseError) throw purchaseError;
  if (!purchases?.length) return { totalCents: 0, byProduct: {}, bySet: {}, byTcg: {} };
  const purchaseIds = purchases.map((purchase) => purchase.id);
  const productIds = [...new Set(purchases.map((purchase) => purchase.product_id))];
  const [{ data: sales, error: salesError }, { data: products, error: productError }] = await Promise.all([
    client.from("sales").select("purchase_id,quantity").eq("user_id", userId).in("purchase_id", purchaseIds).limit(5_000),
    client.from("products").select("id,set_id,tcg").eq("user_id", userId).in("id", productIds),
  ]);
  if (salesError || productError) throw salesError ?? productError;
  return calculateExistingExposure(purchases, sales ?? [], products ?? []);
}

export async function loadPortfolioBuilderData(client: SupabaseClient<Database>, userId: string, now = new Date()) {
  const [analyses, existingExposure] = await Promise.all([
    loadProductInvestmentAnalyses(client, userId, { limit: 500, now }),
    loadExistingExposure(client, userId),
  ]);
  return { analyses, candidates: portfolioCandidatesFromAnalyses(analyses, now), existingExposure };
}
