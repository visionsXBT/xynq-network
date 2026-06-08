import { listLiveModels } from "@/lib/models";

export const runtime = "nodejs";

/** OpenAI-compatible model listing — reflects what is live across the mesh. */
export async function GET() {
  const models = await listLiveModels();
  return Response.json({
    object: "list",
    data: models.map((m) => ({
      id: m.id,
      object: "model",
      created: m.since,
      owned_by: "xynq-network",
      live_replicas: m.replicas,
    })),
  });
}
