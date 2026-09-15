import { NextResponse } from "next/server";
import { getDemoPublishingSnapshot } from "@/lib/publishing/demo-publishing-context";

export async function GET() {
  return NextResponse.json(getDemoPublishingSnapshot());
}
