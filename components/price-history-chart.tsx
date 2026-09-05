"use client";

import { formatEuro } from "@/lib/compare";

export interface PriceSeries {
  storeSlug: string;
  storeName: string;
  color: string;
  points: { t: number; cents: number }[];
}

export function PriceHistoryChart({ series, height = 220 }: { series: PriceSeries[]; height?: number }) {
  const withData = series.filter((s) => s.points.length >= 2);
  const allT = withData.flatMap((s) => s.points.map((p) => p.t));
  const allC = withData.flatMap((s) => s.points.map((p) => p.cents));

  if (allT.length < 4) {
    return <p className="rounded-xl border border-line bg-raised p-6 text-sm text-muted">Nog te weinig data voor een grafiek.</p>;
  }

  const tMin = Math.min(...allT);
  const tMax = Math.max(...allT);
  const cLo = Math.min(...allC);
  const cHi = Math.max(...allC);
  const pad = (cHi - cLo) * 0.15 || 20;
  const yMin = Math.max(0, cLo - pad);
  const yMax = cHi + pad;

  const W = 680;
  const H = height;
  const L = 46;
  const B = 22;
  const T = 8;
  const R = 12;
  const x = (t: number) => L + ((t - tMin) / (tMax - tMin || 1)) * (W - L - R);
  const y = (c: number) => T + (1 - (c - yMin) / (yMax - yMin || 1)) * (H - T - B);

  const yTicks = [0, 1, 2, 3].map((i) => yMin + ((yMax - yMin) * i) / 3);
  const month = (t: number) => new Intl.DateTimeFormat("nl-NL", { month: "short" }).format(new Date(t));
  const xTicks = [tMin, tMin + (tMax - tMin) / 2, tMax];

  return (
    <div>
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full" role="img" aria-label="Prijsverloop per supermarkt">
        {yTicks.map((c, i) => (
          <g key={i}>
            <line
              x1={L}
              x2={W - R}
              y1={y(c)}
              y2={y(c)}
              stroke="var(--color-line)"
              strokeWidth="1"
              strokeDasharray={i === 0 ? "" : "2 3"}
            />
            <text x={L - 6} y={y(c) + 3} textAnchor="end" fontSize="9" fontFamily="var(--font-mono)" fill="var(--color-muted)">
              {formatEuro(Math.round(c))}
            </text>
          </g>
        ))}
        {xTicks.map((t, i) => (
          <text
            key={i}
            x={x(t)}
            y={H - 6}
            textAnchor={i === 0 ? "start" : i === xTicks.length - 1 ? "end" : "middle"}
            fontSize="9"
            fontFamily="var(--font-mono)"
            fill="var(--color-muted)"
          >
            {month(t)}
          </text>
        ))}
        {withData.map((s) => {
          const d = s.points
            .map((p, i) => `${i ? "L" : "M"}${x(p.t).toFixed(1)} ${y(p.cents).toFixed(1)}`)
            .join(" ");
          const last = s.points[s.points.length - 1];
          return (
            <g key={s.storeSlug}>
              <path d={d} fill="none" stroke={s.color} strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />
              <circle cx={x(last.t)} cy={y(last.cents)} r="3.5" fill={s.color} />
            </g>
          );
        })}
      </svg>

      <div className="mt-3 flex flex-wrap gap-x-5 gap-y-1.5 text-xs">
        {withData.map((s) => {
          const cs = s.points.map((p) => p.cents);
          const lo = Math.min(...cs);
          const avg = Math.round(cs.reduce((a, b) => a + b, 0) / cs.length);
          return (
            <span key={s.storeSlug} className="flex items-center gap-1.5 text-muted">
              <span className="h-2 w-4 rounded-full" style={{ background: s.color }} />
              <span className="text-ink">{s.storeName}</span> nu {formatEuro(s.points.at(-1)!.cents)} · laagst {formatEuro(lo)} · gem. {formatEuro(avg)}
            </span>
          );
        })}
      </div>
    </div>
  );
}
