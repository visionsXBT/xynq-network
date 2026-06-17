import { NextRequest } from "next/server";
import { z } from "zod";
import { submitJob, streamJob } from "@/lib/orchestrator/client";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const ImageRequest = z.object({
  prompt: z.string().min(1),
  steps: z.number().int().min(1).max(60).optional().default(28),
  width: z.number().int().optional().default(1024),
  height: z.number().int().optional().default(1024),
});

/**
 * Image generation routed to ComfyUI workers on the mesh.
 * Returns a base64 image. The prompt and output are never stored.
 */
export async function POST(req: NextRequest) {
  let body: z.infer<typeof ImageRequest>;
  try {
    body = ImageRequest.parse(await req.json());
  } catch (err) {
    return Response.json({ error: String(err) }, { status: 400 });
  }

  const job = await submitJob({
    kind: "image",
    model: "comfyui-sdxl",
    prompt: body.prompt,
    params: { steps: body.steps, width: body.width, height: body.height },
  });

  let b64 = "";
  for await (const chunk of streamJob(job.id)) b64 += chunk;

  return Response.json({
    created: Math.floor(Date.now() / 1000),
    data: [{ b64_json: b64 }],
  });
}
