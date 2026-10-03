import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { INVITABLE_ROLES } from "@yamacommerce/database";
import { isSameOriginRequest } from "@/lib/domains/same-origin";
import { changeTeamMemberRole, inviteTeamMember, removeTeamMember, revokeTeamInvitation } from "@/lib/team/team-pipeline";

const role = z.enum(INVITABLE_ROLES);
const bodySchema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("invite"), email: z.string().email().max(200), roleName: role }),
  z.object({ action: z.literal("revoke"), invitationId: z.string().min(1) }),
  z.object({ action: z.literal("role"), memberId: z.string().min(1), roleName: role }),
  z.object({ action: z.literal("remove"), memberId: z.string().min(1) }),
]);

/** Actions de l'équipe — permission vérifiée par action (employees.*), isolation RLS. */
export async function POST(request: NextRequest) {
  if (!isSameOriginRequest(request)) return NextResponse.json({ error: "Origine refusée." }, { status: 403 });
  const parsed = bodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Requête invalide." }, { status: 400 });
  const body = parsed.data;
  const host = request.headers.get("x-forwarded-host") ?? request.headers.get("host") ?? request.nextUrl.host;
  const proto = request.headers.get("x-forwarded-proto") ?? request.nextUrl.protocol.replace(":", "");
  const result =
    body.action === "invite"
      ? await inviteTeamMember(body.email, body.roleName, `${proto}://${host}`)
      : body.action === "revoke"
        ? await revokeTeamInvitation(body.invitationId)
        : body.action === "role"
          ? await changeTeamMemberRole(body.memberId, body.roleName)
          : await removeTeamMember(body.memberId);
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: result.status });
  return NextResponse.json({ data: result.data });
}
