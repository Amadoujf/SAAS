import { NextResponse } from "next/server";
import { getDemoPublishingSnapshot, resetDemoPublishingState } from "@/lib/publishing/demo-publishing-context";

export async function POST() {
  resetDemoPublishingState();
  return NextResponse.json(getDemoPublishingSnapshot());
}
