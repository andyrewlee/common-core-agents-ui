// app/api/chat/route.ts
import type { NextRequest } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type UIPart =
  | { type: "text"; text: string }
  | { type: "file"; mediaType?: string; url: string }
  | Record<string, unknown>;

type UIMessage = {
  role: "user" | "assistant" | "system";
  parts?: UIPart[];
  content?: string;
};

function toInkeepMessages(messages: UIMessage[]) {
  const out: Array<{ role: UIMessage["role"]; content: any }> = [];
  for (const m of messages) {
    const parts = Array.isArray(m.parts) ? m.parts : [];
    const textParts = parts.filter((p: any) => p?.type === "text");
    const fileParts = parts.filter((p: any) => p?.type === "file");

    const text = textParts
      .map((p: any) => (typeof p.text === "string" ? p.text : ""))
      .filter(Boolean)
      .join("\n\n")
      .trim();

    const hasFiles = fileParts.length > 0;

    // Prefer plain string content when there are no files — many agents
    // extract `userText` from a string, not from parts.
    if (!hasFiles && text) {
      out.push({ role: m.role, content: text });
      continue;
    }

    if (hasFiles || text) {
      const safeParts = [
        ...fileParts,
        ...(text ? [{ type: "text", text }] : []),
      ];
      out.push({ role: m.role, content: { parts: safeParts } });
      continue;
    }

    if (typeof (m as any).content === "string") {
      out.push({ role: m.role, content: (m as any).content });
      continue;
    }
    // Skip empty/unsupported assistant parts to avoid confusing the agent.
  }
  return out;
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { messages, conversationId: bodyConversationId, requestContext } = body;
    // Use the client-provided chat id as conversation id when not set explicitly
    const chatId: string | undefined = body?.id;
    const conversationId = bodyConversationId || chatId;
    // Hard-code the graph id as requested.
    const graphId = "weather-graph";
    // Hard-code the tenant id and project id as requested.
    const tenantId = "default";
    const projectId = "default";

    const base = process.env.INKEEP_RUN_API_URL || "http://localhost:3003";

    const upstream = await fetch(`${base}/api/chat`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(process.env.INKEEP_API_KEY
          ? { Authorization: `Bearer ${process.env.INKEEP_API_KEY}` }
          : {}),
        "x-inkeep-graph-id": graphId,
        "x-inkeep-tenant-id": tenantId,
        "x-inkeep-project-id": projectId,
      },
      body: JSON.stringify({
        messages: toInkeepMessages(messages as UIMessage[]),
        graphId,
        tenantId,
        projectId,
        ...(conversationId ? { conversationId } : {}),
        ...(requestContext ? { requestContext } : {}),
      }),
    });

    const headers = new Headers(upstream.headers);
    const ct = headers.get("content-type") || "";
    if (upstream.ok && ct.includes("text/event-stream")) {
      headers.set("Content-Type", "text/event-stream");
      headers.set("Cache-Control", "no-cache");
      headers.set("Connection", "keep-alive");
      return new Response(upstream.body, { status: upstream.status, headers });
    }
    // On errors or non-SSE responses, forward as-is to surface JSON errors.
    return new Response(await upstream.arrayBuffer(), {
      status: upstream.status,
      headers,
    });
  } catch (err: any) {
    return Response.json(
      { error: err?.message || "proxy_failed" },
      { status: 500 }
    );
  }
}
