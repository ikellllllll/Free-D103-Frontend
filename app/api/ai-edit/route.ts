import { NextResponse } from "next/server";

import { startAiEdit } from "@/lib/ai-edit/server";
import type { AiEditStartInput } from "@/lib/ai-edit/types";

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as AiEditStartInput;
    const state = await startAiEdit(body);
    return NextResponse.json(state);
  } catch (error) {
    const message = error instanceof Error ? error.message : "요청 처리에 실패했습니다.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
