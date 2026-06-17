import { getRegistry } from "@/lib/orchestrator";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Aggregate live mesh telemetry for the dashboard. */
export async function GET() {
  const t = getRegistry().totals();
  return Response.json({
    nodes: t.nodes,
    vramGb: Math.round(t.vramMb / 1000),
    tflops: Number(t.tflops.toFixed(1)),
  });
}
