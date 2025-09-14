// app/api/health/route.ts
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const base =
    process.env.INKEEP_RUN_API_URL ||
    process.env.NEXT_PUBLIC_INKEEP_AGENTS_RUN_API_URL ||
    "http://localhost:3003";
  const resource = `${base}/api/chat`;
  try {
    const res = await fetch(resource, {
      method: "GET",
      headers: {
        "x-inkeep-tenant-id": "default",
        "x-inkeep-graph-id": "weather-graph",
        "x-inkeep-project-id": "default",
      },
    });
    const ok = !!res;
    const status = res.status;
    const message = `GET /api/chat responded with ${status}`;
    return Response.json({ target: base, resource, reachable: ok, httpStatus: status, message });
  } catch (err: any) {
    return Response.json({
      target: base,
      resource,
      reachable: false,
      httpStatus: null,
      message: err?.message || "fetch_failed",
    });
  }
}
