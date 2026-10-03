import { NextResponse, type NextRequest } from "next/server";
import { isSameOriginRequest } from "@/lib/domains/same-origin";
import {
  applyProposal,
  chooseDirection,
  generateDirections,
  loadStudio,
  manualChange,
  proposeEdit,
  publishStudioDraft,
  undoLastChange,
  type StudioResult,
} from "@/lib/site-ai/pipeline";

/** « Mon site » : état complet (brouillon, assistant, quotas) pour rafraîchir l'écran. */
export async function GET() {
  const studio = await loadStudio();
  if (!studio) return NextResponse.json({ error: "Action non autorisée." }, { status: 403 });
  return NextResponse.json({ data: studio });
}

const ACTIONS: Record<string, (body: unknown) => Promise<StudioResult>> = {
  directions: generateDirections,
  choose: chooseDirection,
  propose: proposeEdit,
  apply: applyProposal,
  undo: () => undoLastChange(),
  manual: manualChange,
  publish: () => publishStudioDraft(),
};

/** Actions de « Mon site » et de l'assistant — toutes serveur, même origine uniquement. */
export async function POST(request: NextRequest) {
  if (!isSameOriginRequest(request)) return NextResponse.json({ error: "Origine refusée." }, { status: 403 });
  const body = (await request.json().catch(() => null)) as { action?: string } | null;
  const run = body?.action ? ACTIONS[body.action] : undefined;
  if (!run) return NextResponse.json({ error: "Action inconnue." }, { status: 400 });
  const result = await run(body);
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: result.status });
  return NextResponse.json({ data: result.data });
}
