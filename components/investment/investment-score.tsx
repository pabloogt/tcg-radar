import type { InvestmentLabel, InvestmentScore } from "@/lib/investment/scoring";

const labels: Record<InvestmentLabel, string> = { EXCEPTIONAL: "🔥 Excepcional", STRONG: "🟢 Muy fuerte", INTERESTING: "🟡 Interesante", WATCH: "⚪ Vigilar", WEAK: "🔴 Débil" };
const confidence: Record<InvestmentScore["confidence"], string> = { HIGH: "Alta", MEDIUM: "Media", LOW: "Baja", INSUFFICIENT: "Insuficiente" };
export function InvestmentScoreView({ score, compact = false }: { score: InvestmentScore; compact?: boolean }) { return <div><p className={compact ? "text-xl font-semibold" : "text-3xl font-semibold"}>{score.score === null ? "—" : `${score.score}/100`}</p><p className="mt-1 text-sm font-medium">{score.label ? labels[score.label] : "Datos insuficientes"}</p><p className="mt-1 text-xs text-slate-500">Confianza {confidence[score.confidence]} · cobertura {score.dataCompleteness}%</p></div>; }
