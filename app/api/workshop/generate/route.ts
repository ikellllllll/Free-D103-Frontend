import { NextResponse } from "next/server";

import { startWorkshopGeneration } from "@/lib/workshop/server";
import type { WorkshopGenerateInput } from "@/lib/workshop/types";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as Partial<WorkshopGenerateInput>;
    const state = await startWorkshopGeneration({
      targetPath: body.targetPath ?? "",
      prompt: body.prompt ?? ""
    });
    return NextResponse.json(state, { status: 202 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "워크숍 생성 요청 처리에 실패했습니다.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
