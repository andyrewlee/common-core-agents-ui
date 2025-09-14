## Common Core Agents — UI

Minimal Next.js UI for the Common Core AI Teammate. You can chat with the agent and watch a live activity log in a right‑hand panel that shows what’s happening under the hood (agent transfers, tool calls, arguments, results, and status updates).

Backend repo: https://github.com/andyrewlee/common-core-agents

### What this UI does
- Chat with streaming responses (AI SDK `useChat`).
- Side Activity panel that renders streamed `data-operation` events from the Run API (agent/tool activity, transfers, summaries, args/results).
- Health check button to verify connectivity to the backend.
- Optional toggles to log all raw stream events and view them.
- Sticky auto‑scroll for chat and activity; quick copy message content.

---

## Quickstart

Prereqs
- Node 18+ (or 20+), pnpm (recommended) or npm
- A running backend from the main repo above that exposes `/api/chat` (default local base is `http://localhost:3003`).

Install and run (dev server runs on port 4000):

```bash
pnpm install
cp .env.local.example .env.local
# If your backend isn’t on http://localhost:3003, update INKEEP_RUN_API_URL in .env.local
pnpm dev
```

Open http://localhost:4000 and start chatting.

---

## Configuration

Environment variables (see `.env.local.example`):
- `INKEEP_RUN_API_URL` — Base URL of the Run API that serves `/api/chat` (defaults to `http://localhost:3003`).
- `INKEEP_API_KEY` — Optional Bearer token if your backend requires it.
- `NEXT_PUBLIC_INKEEP_AGENTS_RUN_API_URL` — Optional client‑visible base; used only by the health check as a fallback.

Graph/tenant headers
- By default this UI targets `graphId: "common-core-agents"`, `tenantId: "default"`, `projectId: "default"` when proxying `/api/chat` in `app/api/chat/route.ts`. Adjust those constants if your backend expects different values.

---

## How it works

- Client uses `useChat` (Vercel AI SDK) to send messages to this app’s `/api/chat` endpoint.
- `/api/chat` proxies to your Run API (`INKEEP_RUN_API_URL`), forwards headers, and streams Server‑Sent Events back to the browser unchanged.
- The right‑hand Activity panel listens for streamed `data-operation` parts to visualize agent lifecycle, transfers, and tool calls with args/result snippets.
- The Health button calls `/api/health`, which checks that `GET {INKEEP_RUN_API_URL}/api/chat` responds.

Tip for richer activity
- If you only see minimal events (e.g., initialize + completion), enable status updates in your graph configuration (for example `statusUpdates: { numEvents: 2, timeInSeconds: 10 }`) so periodic summaries and tool events are streamed as `data-operation` parts.

---

## Development notes

- Main UI code: `app/page.tsx`
- API proxy: `app/api/chat/route.ts`
- Health check: `app/api/health/route.ts`
- UI components: `components/ui/*`

This project uses Next.js App Router and the Vercel AI SDK. Styling is Tailwind CSS v4 with a dark theme by default.
