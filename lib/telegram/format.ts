import type { AlertCandidate } from "@/lib/alerts/evaluate-alerts";
import { formatEuro } from "@/lib/formatters";

const tcgLabels: Record<string, string> = { pokemon: "Pokémon", one_piece: "One Piece", lorcana: "Lorcana" };
const stockLabels: Record<string, string> = { in_stock: "Disponible", out_of_stock: "Agotado", preorder: "PREVENTA", unknown: "Desconocido" };
const confidenceLabels: Record<string, string> = { HIGH: "Alta", MEDIUM: "Media", LOW: "Baja" };

function targetReached(candidate: AlertCandidate): boolean {
  return candidate.targetPriceCents !== null && candidate.newPriceCents <= candidate.targetPriceCents;
}

function attractive(candidate: AlertCandidate): boolean {
  return candidate.financialRecommendation === "BUY" || candidate.financialRecommendation === "STRONG_BUY";
}

function combinedRestock(candidate: AlertCandidate): boolean {
  return candidate.alertType === "back_in_stock" && (targetReached(candidate) || attractive(candidate));
}

function heading(candidate: AlertCandidate): string {
  if (candidate.alertType === "deal_bargain") return "🔥 CHOLLO DETECTADO";
  if (candidate.alertType === "deal_opportunity") return "🟠 OPORTUNIDAD";
  if (candidate.alertType === "deal_good_price") return "🟢 BUEN PRECIO";
  if (candidate.alertType === "new_product") return "🆕 NUEVO PRODUCTO";
  if (candidate.alertType === "price_drop") return "📉 BAJADA DE PRECIO";
  if (candidate.alertType === "new_price_low") return `📉 NUEVO MÍNIMO ${candidate.priceLowPeriodDays ?? 30} DÍAS`;
  if (combinedRestock(candidate)) return "🟢🔥 REPOSICIÓN + OPORTUNIDAD";
  if (candidate.alertType === "back_in_stock") return "🟢 REPOSICIÓN";
  if (candidate.alertType === "target_price") return "🎯 PRECIO OBJETIVO ALCANZADO";
  return "📊 OPORTUNIDAD FINANCIERA";
}

function shipping(candidate: AlertCandidate): string {
  return candidate.shippingCents === null ? "Desconocido" : formatEuro(candidate.shippingCents);
}

function stock(candidate: AlertCandidate): string {
  return stockLabels[candidate.stockStatus] ?? candidate.stockStatus;
}

export function formatTelegramAlert(candidate: AlertCandidate): string {
  const intro = `${heading(candidate)}\n\n${tcgLabels[candidate.tcg] ?? candidate.tcg} · ${candidate.language.toUpperCase()}\n${candidate.productName}\n\n${candidate.storeName}`;
  if (candidate.alertType === "deal_bargain" || candidate.alertType === "deal_opportunity" || candidate.alertType === "deal_good_price") {
    const difference = new Intl.NumberFormat("es-ES", { minimumFractionDigits: 1, maximumFractionDigits: 2 }).format((candidate.marketDifferenceBps ?? 0) / -100);
    return `${intro}\nPrecio: ${formatEuro(candidate.newPriceCents)}\n\nReferencia de mercado: ${formatEuro(candidate.marketReferenceCents ?? candidate.newPriceCents)}\nDiferencia: ${difference} %\n\nConfianza: ${confidenceLabels[candidate.referenceConfidence ?? "LOW"]}\n\n${candidate.listingUrl}`;
  }
  if (candidate.alertType === "new_product") {
    return `${intro}\n${formatEuro(candidate.newPriceCents)}\n\nStock: ${stock(candidate)}\n\n${candidate.listingUrl}`;
  }
  if (candidate.alertType === "price_drop") {
    const oldPrice = candidate.oldPriceCents ?? candidate.newPriceCents;
    const decreaseBasisPoints = oldPrice === 0 ? 0 : Math.round(((oldPrice - candidate.newPriceCents) * 10_000) / oldPrice);
    const decrease = new Intl.NumberFormat("es-ES", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(decreaseBasisPoints / 100);
    return `${intro}\n${formatEuro(oldPrice)} → ${formatEuro(candidate.newPriceCents)}\nBajada: ${decrease} %\n\nStock: ${stock(candidate)}\nEnvío: ${shipping(candidate)}\n\n${candidate.listingUrl}`;
  }
  if (candidate.alertType === "new_price_low") {
    const days = candidate.priceLowPeriodDays ?? 30;
    return `${intro}\n${formatEuro(candidate.newPriceCents)}\n\nAnterior mínimo ${days}d: ${formatEuro(candidate.previousLowCents ?? candidate.newPriceCents)}\nStock: ${stock(candidate)}\nEnvío: ${shipping(candidate)}\n\n${candidate.listingUrl}`;
  }
  if (candidate.alertType === "back_in_stock") {
    const opportunityDetails = [
      targetReached(candidate) ? `Precio objetivo: ${formatEuro(candidate.targetPriceCents!)}` : null,
      attractive(candidate) ? `Recomendación financiera: ${candidate.financialRecommendation}` : null,
    ].filter((line): line is string => line !== null);
    const details = opportunityDetails.length > 0 ? `\n${opportunityDetails.join("\n")}` : "";
    return `${intro}\nPrecio: ${formatEuro(candidate.newPriceCents)}\nEnvío: ${shipping(candidate)}\n\nHa vuelto a estar disponible.${details}\n\n${candidate.listingUrl}`;
  }
  if (candidate.alertType === "target_price") {
    return `${intro}\nPrecio objetivo: ${formatEuro(candidate.targetPriceCents ?? candidate.newPriceCents)}\nPrecio actual: ${formatEuro(candidate.newPriceCents)}\nStock: ${stock(candidate)}\n\n${candidate.listingUrl}`;
  }
  return `${intro}\nPrecio: ${formatEuro(candidate.newPriceCents)}\nCoste de adquisición: ${candidate.totalAcquisitionCostCents === null ? "Incompleto" : formatEuro(candidate.totalAcquisitionCostCents)}\nStock: ${stock(candidate)}\nRecomendación: ${candidate.financialRecommendation ?? "Sin recomendación"}\n\n${candidate.reason}\n\n${candidate.listingUrl}`;
}
