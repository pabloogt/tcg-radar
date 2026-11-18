import { formatEuro } from "@/lib/formatters";
import type { AggregatedHistoryPoint } from "@/lib/analytics/price-history";

export function PriceHistoryChart({ points }: { points: readonly AggregatedHistoryPoint[] }) {
  if (points.length === 0) return <p className="rounded-lg bg-slate-50 p-4 text-sm text-slate-500">Datos insuficientes para dibujar la tendencia.</p>;
  const width = 760;
  const height = 230;
  const padding = 32;
  const values = points.map((point) => point.cents);
  const minimum = Math.min(...values);
  const maximum = Math.max(...values);
  const range = Math.max(maximum - minimum, 100);
  const x = (index: number) => padding + (points.length === 1 ? (width - padding * 2) / 2 : index * (width - padding * 2) / (points.length - 1));
  const y = (cents: number) => height - padding - ((cents - minimum) / range) * (height - padding * 2);

  return <div><div className="overflow-x-auto rounded-xl border bg-white p-3"><svg role="img" aria-label="Tendencia del mejor precio durante los últimos 30 días" viewBox={`0 0 ${width} ${height}`} className="h-56 min-w-[620px] w-full"><title>Tendencia del mejor precio durante los últimos 30 días</title><path d={`M ${padding} ${padding / 2} V ${height - padding} H ${width - padding / 2}`} fill="none" stroke="#cbd5e1" />{points.slice(1).map((point, index) => { const previous = points[index]; const sameKind = previous.kind === point.kind; return <line key={`${point.date}-${point.kind}`} x1={x(index)} y1={y(previous.cents)} x2={x(index + 1)} y2={y(point.cents)} stroke={sameKind && point.kind === "confirmed_total" ? "#059669" : "#d97706"} strokeWidth="2.5" strokeDasharray={sameKind && point.kind === "confirmed_total" ? undefined : "6 5"} />; })}{points.map((point, index) => <g key={`${point.date}-${index}`}><circle cx={x(index)} cy={y(point.cents)} r={index === points.length - 1 ? 5 : 3.5} fill={point.kind === "confirmed_total" ? "#059669" : "#d97706"} /><title>{point.date}: {formatEuro(point.cents)} · {point.kind === "confirmed_total" ? "total confirmado" : "solo precio del producto"}</title></g>)}<text x={padding} y={height - 8} className="fill-slate-500 text-[11px]">{points[0]?.date}</text><text x={width - padding} y={height - 8} textAnchor="end" className="fill-slate-500 text-[11px]">Actual</text><text x={padding} y={padding - 8} className="fill-slate-500 text-[11px]">{formatEuro(maximum)}</text><text x={padding} y={height - padding - 8} className="fill-slate-500 text-[11px]">{formatEuro(minimum)}</text></svg></div><div className="mt-2 flex flex-wrap gap-4 text-xs text-slate-600"><span className="flex items-center gap-2"><span className="size-2.5 rounded-full bg-emerald-600" />Total confirmado</span><span className="flex items-center gap-2"><span className="size-2.5 rounded-full bg-amber-600" />Solo producto; envío desconocido</span></div></div>;
}
