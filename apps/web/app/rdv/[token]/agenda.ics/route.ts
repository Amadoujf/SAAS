import { type NextRequest } from "next/server";
import { resolveActiveTenant } from "@/lib/rendering/resolve-public-site";
import { isSalonTenant } from "@/lib/salon/salon-context";
import { getAppointmentForGuest } from "@/lib/salon/public-pipeline";

const stamp = (d: Date) => d.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
const esc = (s: string) => s.replace(/[\;,]/g, (c) => `\\${c}`).replace(/\n/g, "\\n");

/** Fichier agenda (.ics) du rendez-vous — uniquement pour SON jeton. */
export async function GET(request: NextRequest, { params }: { params: { token: string } }) {
  const active = await resolveActiveTenant(request.headers.get("host") ?? "");
  if (active.status !== "ok" || !(await isSalonTenant(active.tenantId))) return new Response("Introuvable", { status: 404 });
  const a = await getAppointmentForGuest(active.tenantId, params.token);
  if (!a || !a.endAt || !["requested", "confirmed"].includes(a.status)) return new Response("Introuvable", { status: 404 });
  const body = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Y-COM//Rendez-vous//FR",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    "BEGIN:VEVENT",
    `UID:${a.id}@y-com`,
    `DTSTAMP:${stamp(new Date())}`,
    `DTSTART:${stamp(a.startAt)}`,
    `DTEND:${stamp(a.endAt)}`,
    `SUMMARY:${esc(`${a.listing?.title ?? "Rendez-vous"} — ${active.tenantName}`)}`,
    `DESCRIPTION:${esc(`Avec ${a.appointment?.staff.displayName ?? "le salon"}. Réf. ${a.reference}.`)}`,
    "BEGIN:VALARM",
    "TRIGGER:-PT2H",
    "ACTION:DISPLAY",
    "DESCRIPTION:Rendez-vous dans 2 heures",
    "END:VALARM",
    "END:VEVENT",
    "END:VCALENDAR",
  ].join("\r\n");
  return new Response(body, { headers: { "content-type": "text/calendar; charset=utf-8", "content-disposition": `attachment; filename="rendez-vous-${a.reference}.ics"`, "cache-control": "no-store" } });
}
