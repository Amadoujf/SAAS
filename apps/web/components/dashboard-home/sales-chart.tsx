"use client";

import { useEffect, useMemo, useRef, useState } from "react";

export interface SalesPoint { date: string; revenue: number; orders: number }

const RANGES = [7, 30, 90] as const;
type Range = (typeof RANGES)[number];

const fmt = new Intl.NumberFormat("fr-FR");
const fmtCompact = (n: number) => (n >= 1000 ? `${fmt.format(Math.round(n / 1000))} k` : fmt.format(n));

/** Graduation « ronde » de l'axe vertical (1 à 7,5 × 10ⁿ), jamais plus de ~25 % de vide. */
export function niceMax(value: number, ticks = 4) {
  if (value <= 0) return ticks;
  const raw = value / ticks;
  const pow = 10 ** Math.floor(Math.log10(raw));
  const step = [1, 1.25, 1.5, 2, 2.5, 3, 4, 5, 7.5, 10].map((m) => m * pow).find((s) => s >= raw)!;
  return step * ticks;
}

/** Évolution du chiffre d'affaires, jour par jour. Largeur mesurée (les points
 *  restent ronds à toutes les tailles) ; survol ou flèches du clavier pour lire
 *  un jour précis ; tableau équivalent pour les lecteurs d'écran. */
export function SalesChart({ series }: { series: SalesPoint[] }) {
  const [range, setRange] = useState<Range>(30);
  const [width, setWidth] = useState(320);
  const [hover, setHover] = useState<number | null>(null);
  const box = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = box.current;
    if (!el) return;
    const ro = new ResizeObserver(([e]) => setWidth(Math.max(260, Math.round(e!.contentRect.width))));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const points = useMemo(() => series.slice(-range), [series, range]);
  const compact = width < 480;
  const height = compact ? 170 : 250;
  const pad = { l: compact ? 34 : 56, r: 12, t: 10, b: 26 };
  const max = niceMax(Math.max(...points.map((p) => p.revenue), 0));
  const w = width - pad.l - pad.r;
  const h = height - pad.t - pad.b;
  const x = (i: number) => pad.l + (points.length === 1 ? w / 2 : (i / (points.length - 1)) * w);
  const y = (v: number) => pad.t + h - (v / max) * h;
  const line = points.map((p, i) => `${i ? "L" : "M"}${x(i).toFixed(1)},${y(p.revenue).toFixed(1)}`).join(" ");
  const area = `${line} L${x(points.length - 1).toFixed(1)},${pad.t + h} L${x(0).toFixed(1)},${pad.t + h} Z`;
  const total = points.reduce((s, p) => s + p.revenue, 0);
  const labelEvery = range === 7 ? 1 : range === 30 ? 5 : 15;
  const showDots = range !== 90;
  const active = hover !== null ? points[hover] : null;

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="font-ui text-[18px] font-bold tracking-[-0.015em]">Évolution des ventes</h2>
        <div role="group" aria-label="Période du graphique" className="flex rounded-lg border border-yc-ink/10 bg-white p-0.5 text-[13px]">
          {RANGES.map((r) => (
            <button key={r} type="button" aria-pressed={range === r} onClick={() => { setRange(r); setHover(null); }}
              className={`yc-focus rounded-md px-3 py-1.5 transition-colors ${range === r ? "bg-[#E8EFFF] font-semibold text-yc-electric" : "text-yc-ink-soft hover:text-yc-ink"}`}>
              {r} jours
            </button>
          ))}
        </div>
      </div>
      <p className="mt-1 text-sm text-yc-ink-soft"><span className="yc-num font-semibold text-yc-ink">{fmt.format(total)} FCFA</span> sur {range} jours</p>

      <div ref={box} className="relative mt-3" onMouseLeave={() => setHover(null)}>
        <svg
          width={width}
          height={height}
          role="img"
          aria-label={`Chiffre d'affaires des ${range} derniers jours : ${fmt.format(total)} FCFA au total. Utilisez les flèches pour parcourir les jours.`}
          tabIndex={0}
          className="block max-w-full overflow-visible focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-yc-electric/40"
          onKeyDown={(e) => {
            if (e.key === "ArrowRight") setHover((v) => Math.min(points.length - 1, (v ?? -1) + 1));
            else if (e.key === "ArrowLeft") setHover((v) => Math.max(0, (v ?? points.length) - 1));
            else return;
            e.preventDefault();
          }}
          onBlur={() => setHover(null)}
          onMouseMove={(e) => {
            const rect = e.currentTarget.getBoundingClientRect();
            const i = Math.round(((e.clientX - rect.left - pad.l) / w) * (points.length - 1));
            setHover(Math.max(0, Math.min(points.length - 1, i)));
          }}
        >
          <defs>
            <linearGradient id="yc-sales-area" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0" stopColor="#2F6BFF" stopOpacity="0.22" />
              <stop offset="1" stopColor="#2F6BFF" stopOpacity="0.02" />
            </linearGradient>
          </defs>
          {[0, 1, 2, 3, 4].map((t) => {
            const v = (max / 4) * t;
            return (
              <g key={t}>
                <line x1={pad.l} x2={width - pad.r} y1={y(v)} y2={y(v)} stroke="rgb(12 22 48 / 0.07)" />
                <text x={pad.l - 10} y={y(v) + 4} textAnchor="end" className="fill-yc-ink-soft text-[11px] yc-num">{compact ? fmtCompact(v) : fmt.format(v)}</text>
              </g>
            );
          })}
          <path d={area} fill="url(#yc-sales-area)" />
          <path d={line} fill="none" stroke="#1D4ED8" strokeWidth="2.25" strokeLinejoin="round" strokeLinecap="round" className="yc-draw" style={{ ["--yc-dash" as string]: 4000 }} />
          {showDots && points.map((p, i) => <circle key={p.date} cx={x(i)} cy={y(p.revenue)} r={compact ? 2.5 : 3.5} fill="#1D4ED8" />)}
          {points.map((p, i) => (i % labelEvery === 0 || i === points.length - 1) && (points.length - 1 - i >= labelEvery / 2 || i === points.length - 1) ? (
            <text key={`l-${p.date}`} x={x(i)} y={height - 6} textAnchor={i === points.length - 1 ? "end" : "middle"} className="fill-yc-ink-soft text-[11px] yc-num">{p.date.slice(8, 10)}</text>
          ) : null)}
          {active && hover !== null && (
            <g>
              <line x1={x(hover)} x2={x(hover)} y1={pad.t} y2={pad.t + h} stroke="rgb(29 78 216 / 0.3)" />
              <circle cx={x(hover)} cy={y(active.revenue)} r="5.5" fill="white" stroke="#1D4ED8" strokeWidth="2.5" />
            </g>
          )}
        </svg>
        {active && hover !== null && (
          <div className="pointer-events-none absolute top-0 z-10 -translate-x-1/2 rounded-lg bg-yc-ink px-3 py-2 text-xs text-white shadow-lg"
            style={{ left: Math.min(Math.max(x(hover), 70), width - 70) }} role="status">
            <p className="font-semibold">{new Intl.DateTimeFormat("fr-FR", { day: "numeric", month: "long", timeZone: "UTC" }).format(new Date(`${active.date}T00:00:00Z`))}</p>
            <p className="yc-num">{fmt.format(active.revenue)} FCFA · {active.orders} commande{active.orders > 1 ? "s" : ""}</p>
          </div>
        )}
      </div>
    </div>
  );
}
