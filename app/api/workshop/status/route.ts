import { NextResponse } from "next/server";

import { readWorkshopState } from "@/lib/workshop/server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET() {
  const state = await readWorkshopState();
  return NextResponse.json(state, {
    headers: {
      "Cache-Control": "no-store"
    }
  });
}
