"use client";

import { useId, useMemo, useState } from "react";

/** Courbe de chiffre d'affaires : SVG pur (aucune bibliothèque), tracé animé,
 *  info-bulle au survol ET au clavier, tableau de données masqué pour les lecteurs
 *  d'écran. */
export function AreaChart({
  points,
  height = 180,
  label,
}: {
  points: { date: string; value: number; orders?: number }[];
  height?: number;
  label: string;
}) {
  const gradientId = useId();
  const [active, setActive] = useState<number | null>(null);
  const width = 640;
  const pad = 8;
  const max = Math.max(1, ...points.map((p) => p.value));
  const coords = useMemo(
    () =>
      points.map((p, i) => ({
        x: pad + (i * (width - pad * 2)) / Math.max(1, points.length - 1),
        y: height - pad - (p.value / max) * (height - pad * 2 - 10),
      })),
    [points, max, height],
  );
  const line = coords.map((c, i) => `${i === 0 ? "M" : "L"}${c.x.toFixed(1)},${c.y.toFixed(1)}`).join(" ");
  const area = `${line} L${coords.at(-1)?.x ?? 0},${height} L${coords[0]?.x ?? 0},${height} Z`;
  const fmt = (n: number) => new Intl.NumberFormat("fr-SN").format(n);
  const activePoint = active !== null ? points[active] : null;

  return (
    <figure className="relative">
      <figcaption className="sr-only">{label}</figcaption>
      <svg
        viewBox={`0 0 ${width} ${height}`}
        className="h-auto w-full overflow-visible"
        role="img"
        aria-label={label}
        onMouseLeave={() => setActive(null)}
      >
        <defs>
          <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="rgb(59 91 255)" stopOpacity="0.28" />
            <stop offset="1" stopColor="rgb(34 211 238)" stopOpacity="0" />
          </linearGradient>
        </defs>
        {[0.25, 0.5, 0.75].map((f) => (
          <line key={f} x1="0" x2={width} y1={height * f} y2={height * f} stroke="rgb(15 20 44 / 0.06)" strokeDasharray="4 6" />
        ))}
        <path d={area} fill={`url(#${gradientId})`} />
        <path d={line} fill="none" stroke="rgb(59 91 255)" strokeWidth="2.5" strokeLinejoin="round" strokeLinecap="round" className="yc-draw" style={{ ["--yc-dash" as string]: 2000 }} />
        {coords.map((c, i) => (
          <g key={i}>
            <rect
              x={c.x - (width / points.length) / 2}
              y="0"
              width={width / points.length}
              height={height}
              fill="transparent"
              onMouseEnter={() => setActive(i)}
              onFocus={() => setActive(i)}
              tabIndex={0}
              aria-label={`${points[i]!.date} : ${fmt(points[i]!.value)} FCFA`}
            />
            {active === i && (
              <>
                <line x1={c.x} x2={c.x} y1="0" y2={height} stroke="rgb(59 91 255 / 0.3)" />
                <circle cx={c.x} cy={c.y} r="5" fill="white" stroke="rgb(59 91 255)" strokeWidth="2.5" />
              </>
            )}
          </g>
        ))}
      </svg>
      {activePoint && active !== null && (
        <div
          className="pointer-events-none absolute -top-2 z-10 -translate-x-1/2 -translate-y-full rounded-xl bg-yc-night-900 px-3 py-2 text-xs text-white shadow-yc-float"
          style={{ left: `${(coords[active]!.x / width) * 100}%` }}
        >
          <p className="font-semibold">{fmt(activePoint.value)} FCFA</p>
          <p className="opacity-70">
            {new Date(activePoint.date).toLocaleDateString("fr-FR", { day: "numeric", month: "short" })}
            {activePoint.orders !== undefined && ` · ${activePoint.orders} cmd`}
          </p>
        </div>
      )}
      <table className="sr-only">
        <tbody>
          {points.map((p) => (
            <tr key={p.date}>
              <td>{p.date}</td>
              <td>{p.value} FCFA</td>
            </tr>
          ))}
        </tbody>
      </table>
    </figure>
  );
}
