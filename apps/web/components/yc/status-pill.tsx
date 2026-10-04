import { ORDER_STATUS_META, PAYMENT_STATUS_META, type Tone } from "@/lib/commerce/order-status-meta";

const TONES: Record<Tone, string> = {
  neutral: "bg-yc-ink/[0.06] text-yc-ink-soft ring-yc-ink/10",
  info: "bg-yc-electric/[0.08] text-yc-electric ring-yc-electric/20",
  warning: "bg-yc-warning/[0.12] text-[rgb(146_84_0)] ring-yc-warning/30",
  success: "bg-yc-success/[0.1] text-[rgb(4_120_87)] ring-yc-success/25",
  danger: "bg-yc-danger/[0.08] text-[rgb(185_28_28)] ring-yc-danger/25",
  accent: "bg-yc-violet/[0.09] text-[rgb(109_40_217)] ring-yc-violet/25",
};

const DOTS: Record<Tone, string> = {
  neutral: "bg-white/60", info: "bg-sky-300", warning: "bg-amber-300", success: "bg-emerald-300", danger: "bg-rose-300", accent: "bg-violet-300",
};

export function Pill({ tone = "neutral", children, dot = true, onDark = false }: { tone?: Tone; children: React.ReactNode; dot?: boolean; onDark?: boolean }) {
  return (
    <span className={`inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-2.5 py-1 text-xs font-semibold ring-1 ring-inset ${onDark ? "bg-white/10 text-white ring-white/20" : TONES[tone]}`}>
      {dot && <span className={`h-1.5 w-1.5 rounded-full ${onDark ? DOTS[tone] : "bg-current"}`} aria-hidden="true" />}
      {children}
    </span>
  );
}

export function OrderStatusPill({ status, onDark }: { status: string; onDark?: boolean }) {
  const meta = ORDER_STATUS_META[status] ?? { label: status, tone: "neutral" as Tone };
  return <Pill tone={meta.tone} onDark={onDark}>{meta.label}</Pill>;
}

export function PaymentStatusPill({ status, onDark }: { status: string; onDark?: boolean }) {
  const meta = PAYMENT_STATUS_META[status] ?? { label: status, tone: "neutral" as Tone };
  return <Pill tone={meta.tone} onDark={onDark}>{meta.label}</Pill>;
}
