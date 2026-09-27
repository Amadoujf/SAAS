import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { isSameOriginRequest } from "@/lib/domains/same-origin";
import { resolveActiveTenant } from "@/lib/rendering/resolve-public-site";
import { cancelTravelBookingAsGuest, TravelBookingError } from "@/lib/travel/public-pipeline";

const body = z.object({ token: z.string().min(1).max(64) });

/** Annulation par le voyageur de SA réservation (jeton), avant le départ, sans paiement enregistré. */
export async function POST(request: NextRequest) {
  if (!isSameOriginRequest(request)) return NextResponse.json({ error: "Origine refusée." }, { status: 403 });
  const active = await resolveActiveTenant(request.headers.get("host") ?? "");
  if (active.status !== "ok") return NextResponse.json({ error: "Agence introuvable." }, { status: 404 });
  const parsed = body.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Requête invalide." }, { status: 400 });
  try {
    await cancelTravelBookingAsGuest(active.tenantId, parsed.data.token);
    return NextResponse.json({ data: null });
  } catch (error) {
    if (error instanceof TravelBookingError) return NextResponse.json({ error: error.message }, { status: error.status });
    return NextResponse.json({ error: "Annulation impossible pour le moment." }, { status: 500 });
  }
}
