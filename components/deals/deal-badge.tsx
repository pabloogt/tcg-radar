import type { DealClassification } from "@/lib/market/deal";

const labels: Record<DealClassification, string> = { CHOLLO: "🔥 Chollo", OPPORTUNITY: "🟠 Oportunidad", GOOD_PRICE: "🟢 Buen precio", NORMAL: "⚪ Normal", EXPENSIVE: "🔴 Caro" };
const styles: Record<DealClassification, string> = { CHOLLO: "bg-red-50 text-red-800", OPPORTUNITY: "bg-orange-50 text-orange-800", GOOD_PRICE: "bg-emerald-50 text-emerald-800", NORMAL: "bg-slate-100 text-slate-700", EXPENSIVE: "bg-rose-50 text-rose-800" };

export function DealBadge({ classification }: { classification: DealClassification }) {
  return <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${styles[classification]}`}>{labels[classification]}</span>;
}
