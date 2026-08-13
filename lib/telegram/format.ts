import type { AlertCandidate } from "@/lib/alerts/evaluate-alerts";
import { formatEuro } from "@/lib/formatters";

const tcgLabels: Record<string, string> = { pokemon: "Pokémon", one_piece: "One Piece", lorcana: "Lorcana" };
const stockLabels: Record<string, string> = { in_stock: "Disponible", out_of_stock: "Agotado", preorder: "Preventa", unknown: "Desconocido" };

function heading(candidate: AlertCandidate): string {
  if (candidate.alertType === "price_drop") return "📉 BAJADA DE PRECIO";
  if (candidate.alertType === "back_in_stock") return "🟢 REPOSICIÓN";
  if (candidate.alertType === "target_price") return "🎯 PRECIO OBJETIVO ALCANZADO";
  return "📊 OPORTUNIDAD FINANCIERA";
}

function shipping(candidate: AlertCandidate): string {
  return candidate.shippingCents === null ? "Desconocido" : formatEuro(candidate.shippingCents);
}

export function formatTelegramAlert(candidate: AlertCandidate): string {
  const intro = `${heading(candidate)}\n\n${tcgLabels[candidate.tcg] ?? candidate.tcg} · ${candidate.language.toUpperCase()}\n${candidate.productName}\n\n${candidate.storeName}`;
  if (candidate.alertType === "price_drop") {
    const oldPrice = candidate.oldPriceCents ?? candidate.newPriceCents;
    const decreaseBasisPoints = oldPrice === 0 ? 0 : Math.round(((oldPrice - candidate.newPriceCents) * 10_000) / oldPrice);
    const decrease = new Intl.NumberFormat("es-ES", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(decreaseBasisPoints / 100);
    return `${intro}\n${formatEuro(oldPrice)} → ${formatEuro(candidate.newPriceCents)}\nBajada: ${decrease} %\n\nStock: ${stockLabels[candidate.stockStatus] ?? candidate.stockStatus}\nEnvío: ${shipping(candidate)}\n\n${candidate.listingUrl}`;
  }
  if (candidate.alertType === "back_in_stock") {
    return `${intro}\nPrecio: ${formatEuro(candidate.newPriceCents)}\nEnvío: ${shipping(candidate)}\n\nHa vuelto a estar disponible.\n\n${candidate.listingUrl}`;
  }
  if (candidate.alertType === "target_price") {
    return `${intro}\nPrecio objetivo: ${formatEuro(candidate.targetPriceCents ?? candidate.newPriceCents)}\nPrecio actual: ${formatEuro(candidate.newPriceCents)}\n\n${candidate.listingUrl}`;
  }
  return `${intro}\nPrecio: ${formatEuro(candidate.newPriceCents)}\nCoste de adquisición: ${candidate.totalAcquisitionCostCents === null ? "Incompleto" : formatEuro(candidate.totalAcquisitionCostCents)}\nRecomendación: ${candidate.financialRecommendation ?? "Sin recomendación"}\n\n${candidate.reason}\n\n${candidate.listingUrl}`;
}
