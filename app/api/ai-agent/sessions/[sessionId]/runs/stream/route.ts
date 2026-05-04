import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type RouteContext = {
  params: Promise<{ sessionId: string }>;
};

interface AgentRunProxyBody {
  userId?: number | string;
  message?: string;
}

const getAiBaseUrl = () =>
  (process.env.AI_API_BASE_URL ?? process.env.NEXT_PUBLIC_AI_API_BASE_URL ?? "").replace(/\/+$/, "");

export async function POST(request: Request, context: RouteContext) {
  const aiBaseUrl = getAiBaseUrl();

  if (!aiBaseUrl) {
    return NextResponse.json(
      { error: "AI_API_BASE_URL is not configured." },
      { status: 503 }
    );
  }

  const { sessionId } = await context.params;
  const body = (await request.json()) as AgentRunProxyBody;
  const userId = Number(body.userId);
  const message = body.message?.trim() ?? "";

  if (!Number.isFinite(userId) || !message) {
    return NextResponse.json(
      { error: "userId and message are required." },
      { status: 400 }
    );
  }

  const upstream = await fetch(
    `${aiBaseUrl}/api/v1/sessions/${encodeURIComponent(sessionId)}/agent/runs/stream`,
    {
      method: "POST",
      headers: {
        accept: "application/x-ndjson",
        "content-type": "application/json"
      },
      body: JSON.stringify({ userId, message }),
      cache: "no-store"
    }
  );

  if (!upstream.ok || !upstream.body) {
    const detail = await upstream.text().catch(() => "");
    return NextResponse.json(
      {
        error: "AI agent run request failed.",
        detail
      },
      { status: upstream.status || 502 }
    );
  }

  return new Response(upstream.body, {
    status: 200,
    headers: {
      "Cache-Control": "no-store",
      "Content-Type": "application/x-ndjson"
    }
  });
}
