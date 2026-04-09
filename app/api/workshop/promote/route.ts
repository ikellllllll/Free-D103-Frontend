import { NextResponse } from "next/server";

import { promoteWorkshopVariant } from "@/lib/workshop/server";
import type { WorkshopPromoteInput } from "@/lib/workshop/types";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as Partial<WorkshopPromoteInput>;

    if (body.variant !== "a" && body.variant !== "b") {
      return NextResponse.json({ error: "반영할 시안을 선택해 주세요." }, { status: 400 });
    }

    const state = await promoteWorkshopVariant(body.variant);
    return NextResponse.json(state);
  } catch (error) {
    const message = error instanceof Error ? error.message : "시안 반영에 실패했습니다.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
