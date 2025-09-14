"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useChat } from "@ai-sdk/react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Switch } from "@/components/ui/switch";
import { Copy } from "lucide-react";

type UIPart =
  | { type: "text"; text: string }
  | { type: "file"; mediaType?: string; url: string }
  | { type: "data-component"; data: any }
  | { type: "data-artifact"; data: any }
  | { type: "data-operation"; data: any }
  | Record<string, any>;

// We avoid typing the full UIMessage generic from the SDK here to keep
// compatibility across SDK versions and custom data parts.

type OperationEvent = {
  id?: string;
  type?: string;
  label?: string;
  ctx?: Record<string, any>;
};

function bytesToBase64(data: ArrayBuffer) {
  let binary = "";
  const bytes = new Uint8Array(data);
  const len = bytes.byteLength;
  for (let i = 0; i < len; i++) binary += String.fromCharCode(bytes[i]);
  return btoa(binary);
}

async function convertFilesToDataURLs(files: FileList) {
  const results: Array<{ type: "file"; mediaType?: string; url: string }> = [];
  for (const file of Array.from(files)) {
    const buf = await file.arrayBuffer();
    const b64 = bytesToBase64(buf);
    const url = `data:${file.type};base64,${b64}`;
    results.push({ type: "file", mediaType: file.type, url });
  }
  return results;
}

export default function Page() {
  const [input, setInput] = useState("");
  const [files, setFiles] = useState<FileList | undefined>(undefined);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [ops, setOps] = useState<OperationEvent[]>([]);
  const [conn, setConn] = useState<{
    state: "idle" | "testing" | "ok" | "fail";
    info?: string;
    status?: number | null;
    url?: string;
  }>({ state: "idle" });

  const chatScrollRef = useRef<HTMLDivElement>(null);
  const [logAllParts, setLogAllParts] = useState(false);
  const [showRaw, setShowRaw] = useState(false);
  const [rawParts, setRawParts] = useState<Array<{ t: number; part: any }>>([]);

  const { messages, sendMessage, status, error, clearError } = useChat({
    api: "/api/chat",
    onData: (dataPart: any) => {
      if (logAllParts) {
        setRawParts((prev) => [...prev, { t: Date.now(), part: dataPart }]);
      }
      if (dataPart?.type === "data-operation") {
        const ev: OperationEvent = dataPart.data || {};
        setOps((prev) => [
          ...prev,
          {
            id: dataPart.id,
            type: ev.type,
            label: (ev as any).label || undefined,
            ctx: (ev as any).ctx || undefined,
          },
        ]);
      }
    },
  } as any);

  // Auto-scroll chat on new messages
  useEffect(() => {
    const el = chatScrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [messages]);

  async function testConnection() {
    try {
      setConn({ state: "testing" });
      const res = await fetch("/api/health", { cache: "no-store" });
      const data = await res.json();
      if (data.reachable) {
        setConn({ state: "ok", info: data.message, status: data.httpStatus, url: data.resource });
      } else {
        setConn({ state: "fail", info: data.message, status: data.httpStatus, url: data.resource });
      }
    } catch (e: any) {
      setConn({ state: "fail", info: e?.message || String(e) });
    }
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    const fileParts = files && files.length > 0 ? await convertFilesToDataURLs(files) : [];

    await sendMessage({
      role: "user",
      parts: [
        ...(input ? [{ type: "text", text: input }] : []),
        ...fileParts,
      ],
    } as any);

    setInput("");
    setFiles(undefined);
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  return (
    <main className="min-h-screen p-6 grid gap-6 md:grid-cols-[2fr_1fr]">
      {error ? (
        <div className="md:col-span-2 border border-red-800 bg-red-950 text-red-200 rounded p-3 text-sm flex items-start justify-between">
          <div>
            <strong className="mr-2">Error:</strong>
            {String(error.message || error)}
          </div>
          <button className="ml-4 underline" onClick={() => clearError?.()}>
            Dismiss
          </button>
        </div>
      ) : null}
      <section className="space-y-4">
        <div className="flex items-center gap-3 flex-wrap">
          <h1 className="text-xl font-semibold">Inkeep Multimodal Test UI</h1>
          <Badge className="uppercase tracking-wide">{status}</Badge>
          <Button variant="outline" size="sm" onClick={testConnection} disabled={conn.state === "testing"}>
            {conn.state === "testing" ? "Testing…" : "Test Connection"}
          </Button>
          {conn.state === "ok" ? (
            <Badge variant="green">OK{conn.status ? ` (${conn.status})` : ""}</Badge>
          ) : conn.state === "fail" ? (
            <Badge variant="red">Failed{conn.status ? ` (${conn.status})` : ""}</Badge>
          ) : null}
          {conn.info ? (
            <span className="text-xs text-neutral-400">{conn.info}</span>
          ) : null}
          <label className="ml-2 inline-flex items-center gap-2 text-xs text-neutral-300">
            <span>Log all stream events</span>
            <Switch checked={logAllParts} onCheckedChange={setLogAllParts} />
          </label>
          <label className="inline-flex items-center gap-2 text-xs text-neutral-300">
            <span>Show raw</span>
            <Switch checked={showRaw} onCheckedChange={setShowRaw} />
          </label>
        </div>

        <div className="rounded-lg border border-neutral-800 bg-neutral-900 text-neutral-100 h-[70vh] flex flex-col">
          <div className="p-2 border-b border-neutral-800 text-sm text-neutral-400">Conversation</div>
          <div className="flex-1 overflow-auto">
            <div ref={chatScrollRef} className="p-3 space-y-4">
          {messages.map((m) => {
            const parts = m.parts ?? [];
            type RenderItem =
              | { kind: "text"; text: string }
              | { kind: "file"; mediaType?: string; url: string }
              | { kind: "component"; data: any }
              | { kind: "artifact"; data: any }
              | { kind: "other"; raw: any };

            const items: RenderItem[] = [];
            let textBuf = "";
            const flushText = () => {
              if (textBuf.trim().length) items.push({ kind: "text", text: textBuf });
              textBuf = "";
            };
            for (const p of parts as any[]) {
              if (!p || typeof p !== "object") continue;
              if (p.type === "data-operation") {
                // Hide ops in chat; they are shown in the right panel
                continue;
              }
              if (p.type === "text") {
                textBuf += (p.text || "") + "";
                continue;
              }
              if (p.type === "file") {
                flushText();
                items.push({ kind: "file", mediaType: p.mediaType, url: p.url });
                continue;
              }
              if (p.type === "data-component") {
                flushText();
                items.push({ kind: "component", data: p.data });
                continue;
              }
              if (p.type === "data-artifact") {
                flushText();
                items.push({ kind: "artifact", data: p.data });
                continue;
              }
              flushText();
              items.push({ kind: "other", raw: p });
            }
            flushText();

            function escapeHtml(str: string) {
              return str
                .replaceAll(/&/g, "&amp;")
                .replaceAll(/</g, "&lt;")
                .replaceAll(/>/g, "&gt;");
            }
            function formatMarkdownLite(str: string) {
              // Very small markdown dialect: bold **text** only, after escaping
              const escaped = escapeHtml(str);
              return escaped.replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>");
            }

            return (
              <div key={m.id}>
                <div className="text-[11px] tracking-wide text-neutral-400 mb-1 font-medium flex items-center gap-2">
                  <span>{m.role.toUpperCase()}</span>
                  <Button
                    type="button"
                    size="icon"
                    variant="ghost"
                    title="Copy message"
                    onClick={() => {
                      try {
                        const text = (m.parts || [])
                          .map((p: any) => (p?.type === "text" ? p.text : ""))
                          .filter(Boolean)
                          .join("\n");
                        if (text) navigator.clipboard.writeText(text);
                      } catch {}
                    }}
                  >
                    <Copy className="h-4 w-4" />
                  </Button>
                </div>
                {items.map((it, idx) => {
                  if (it.kind === "text") {
                    return (
                      <div
                        key={idx}
                        className="whitespace-pre-wrap break-words leading-relaxed text-[15px]"
                        dangerouslySetInnerHTML={{ __html: formatMarkdownLite(it.text) }}
                      />
                    );
                  }
                  if (it.kind === "file") {
                    const p = it;
                    if (p.mediaType?.startsWith("image/")) {
                      return (
                        <img key={idx} src={p.url} alt={`image-${idx}`} className="max-w-full rounded border" />
                      );
                    }
                    if (p.mediaType === "application/pdf") {
                      return (
                        <iframe key={idx} src={p.url} className="w-full h-96 border rounded" title={`pdf-${idx}`} />
                      );
                    }
                  }
                  if (it.kind === "component") {
                    const data = it.data;
                    if (data?.type === "image-result" && data?.props?.url) {
                      return (
                        <figure key={idx}>
                          <img src={data.props.url} alt={data.props.alt || "image-result"} className="max-w-full rounded border" />
                          {data.props.alt ? (
                            <figcaption className="text-xs text-gray-500">{data.props.alt}</figcaption>
                          ) : null}
                        </figure>
                      );
                    }
                    return (
                      <pre key={idx} className="bg-neutral-900/60 text-xs p-2 rounded border border-neutral-800 overflow-auto text-neutral-200">
                        {JSON.stringify(data, null, 2)}
                      </pre>
                    );
                  }
                  if (it.kind === "artifact") {
                    const data = it.data;
                    const imageBlock = Array.isArray(data?.content)
                      ? data.content.find((b: any) => b?.type === "image" && b?.url)
                      : undefined;
                    if (imageBlock?.url) {
                      return <img key={idx} src={imageBlock.url} alt="artifact-image" className="max-w-full rounded border" />;
                    }
                    return (
                      <pre key={idx} className="bg-neutral-900/60 text-xs p-2 rounded border border-neutral-800 overflow-auto text-neutral-200">
                        {JSON.stringify(data, null, 2)}
                      </pre>
                    );
                  }
                  return (
                    <pre key={idx} className="bg-neutral-900/60 text-xs p-2 rounded border border-neutral-800 overflow-auto text-neutral-200">
                      {JSON.stringify((it as any).raw, null, 2)}
                    </pre>
                  );
                })}
              </div>
            );
          })}
            </div>
          </div>
        </div>

        <form onSubmit={onSubmit} className="flex gap-2 items-center">
          <input
            type="file"
            accept="image/*,application/pdf"
            multiple
            ref={fileInputRef}
            onChange={(e) => setFiles(e.target.files || undefined)}
          />
          <Input
            className="flex-1"
            placeholder="Type a message… (attach images if you like)"
            value={input}
            onChange={(e) => setInput(e.target.value)}
          />
          <Button type="submit">Send</Button>
        </form>
      </section>

      <aside className="space-y-3">
        <h2 className="text-lg font-semibold">Agent & Tool Activity</h2>
        <div className="border border-neutral-800 rounded p-3 h-[60vh] overflow-auto bg-neutral-900 text-neutral-100">
          {ops.length === 0 ? (
            <div className="text-sm text-neutral-500">No activity yet.</div>
          ) : (
            <ul className="space-y-2 text-sm">
              {ops.map((ev, i) => (
                <li key={i} className="border border-neutral-800 rounded p-2">
                  <div className="font-mono text-[11px] text-neutral-400 mb-1">
                    {ev.type || "data-operation"}
                  </div>
                  {ev.label ? <div className="font-medium">{ev.label}</div> : null}
                  {ev.ctx?.summary ? <div className="text-neutral-200 leading-snug">{ev.ctx.summary}</div> : null}

                  {/* Rich context details */}
                  <div className="mt-1 grid gap-1 text-xs text-gray-700">
                    {ev.ctx?.sessionId ? (
                      <div>
                        <span className="font-semibold">session:</span> {ev.ctx.sessionId}
                      </div>
                    ) : null}
                    {ev.ctx?.agent ? (
                      <div>
                        <span className="font-semibold">agent:</span> {String(ev.ctx.agent)}
                      </div>
                    ) : null}
                    {ev.ctx?.fromAgent || ev.ctx?.toAgent ? (
                      <div>
                        <span className="font-semibold">transfer:</span> {ev.ctx?.fromAgent || "?"} → {ev.ctx?.toAgent || "?"}
                      </div>
                    ) : null}
                    {ev.ctx?.tool || ev.ctx?.toolName ? (
                      <div>
                        <span className="font-semibold">tool:</span> {String(ev.ctx.tool || ev.ctx.toolName)}
                      </div>
                    ) : null}
                    {ev.ctx?.args || ev.ctx?.input ? (
                      <pre className="bg-neutral-900/60 p-2 rounded border border-neutral-800 overflow-auto text-neutral-200">
                        {JSON.stringify(ev.ctx.args ?? ev.ctx.input, null, 2)}
                      </pre>
                    ) : null}
                    {ev.ctx?.result || ev.ctx?.output ? (
                      <pre className="bg-neutral-900/60 p-2 rounded border border-neutral-800 overflow-auto text-neutral-200">
                        {JSON.stringify(ev.ctx.result ?? ev.ctx.output, null, 2)}
                      </pre>
                    ) : null}
                  </div>

                  {Array.isArray(ev.ctx?.components) && ev.ctx.components.length > 0 ? (
                    <div className="mt-2">
                      <div className="text-xs font-semibold mb-1">Components</div>
                      <pre className="bg-neutral-900/60 text-xs p-2 rounded border border-neutral-800 overflow-auto text-neutral-200">
                        {JSON.stringify(ev.ctx.components, null, 2)}
                      </pre>
                    </div>
                  ) : null}
                </li>
              ))}
            </ul>
          )}
        </div>
        {ops.length > 0 && ops.every((e) => e.type === "agent_initializing" || e.type === "completion") ? (
          <div className="text-xs text-neutral-400 border border-neutral-800 bg-neutral-900 p-2 rounded">
            Only minimal events received (init + completion). For richer activity (transfers, tools, summaries), enable statusUpdates in your graph, e.g. {`{ numEvents: 2, timeInSeconds: 10 }`}.
          </div>
        ) : null}

        {showRaw && rawParts.length > 0 ? (
          <div className="border border-neutral-800 rounded p-2 bg-neutral-900 text-neutral-200 text-xs max-h-[30vh] overflow-auto">
            <div className="font-semibold mb-1">Raw stream events ({rawParts.length})</div>
            {rawParts.slice(-200).map((r, idx) => (
              <pre key={idx} className="border-t border-neutral-800 py-1 whitespace-pre-wrap break-all">
                {JSON.stringify(r.part)}
              </pre>
            ))}
          </div>
        ) : null}
        <p className="text-xs text-gray-500">
          This panel listens for <code>data-operation</code> parts streamed by the Run API.
        </p>
      </aside>
    </main>
  );
}
