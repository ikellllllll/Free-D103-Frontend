import { NextResponse } from "next/server";

import { readAiEditState } from "@/lib/ai-edit/server";

export async function GET() {
  try {
    const state = await readAiEditState();
    return NextResponse.json(state);
  } catch (error) {
    const message = error instanceof Error ? error.message : "상태 조회에 실패했습니다.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
