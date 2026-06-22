import { NextRequest } from "next/server";
import { z } from "zod";
import { submitJob, streamJob } from "@/lib/orchestrator/client";
import { resolveModel } from "@/lib/models";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const ChatRequest = z.object({
  model: z.string().default("xynq"),
  messages: z
    .array(
      z.object({
        role: z.enum(["system", "user", "assistant"]),
        content: z.string(),
      })
    )
    .min(1),
  stream: z.boolean().optional().default(false),
  temperature: z.number().min(0).max(2).optional(),
  max_tokens: z.number().int().positive().optional(),
});

/**
 * OpenAI-compatible chat completions.
 *
 * The request is turned into a network job, dispatched to the orchestrator,
 * and the resulting tokens are streamed back as SSE. Nothing about the prompt
 * is persisted — only the anonymous job accounting needed for reward math.
 */
export async function POST(req: NextRequest) {
  let body: z.infer<typeof ChatRequest>;
  try {
    body = ChatRequest.parse(await req.json());
  } catch (err) {
    return Response.json(
      { error: { message: "invalid request body", detail: String(err) } },
      { status: 400 }
    );
  }

  const model = resolveModel(body.model);
  if (!model) {
    return Response.json(
      { error: { message: `unknown model: ${body.model}` } },
      { status: 404 }
    );
  }

  const job = await submitJob({
    kind: "chat",
    model: model.id,
    messages: body.messages,
    params: {
      temperature: body.temperature ?? 0.7,
      maxTokens: body.max_tokens ?? 1024,
    },
  });

  if (!body.stream) {
    const text = await collect(streamJob(job.id));
    return Response.json(buildCompletion(model.id, text));
  }

  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      try {
        for await (const delta of streamJob(job.id)) {
          const chunk = {
            id: job.id,
            object: "chat.completion.chunk",
            model: model.id,
            choices: [{ index: 0, delta: { content: delta }, finish_reason: null }],
          };
          controller.enqueue(encoder.encode(`data: ${JSON.stringify(chunk)}\n\n`));
        }
        controller.enqueue(encoder.encode("data: [DONE]\n\n"));
      } catch (err) {
        controller.enqueue(
          encoder.encode(
            `data: ${JSON.stringify({ error: String(err) })}\n\n`
          )
        );
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
    },
  });
}

async function collect(it: AsyncIterable<string>): Promise<string> {
  let out = "";
  for await (const d of it) out += d;
  return out;
}

function buildCompletion(model: string, content: string) {
  return {
    id: `chatcmpl_${crypto.randomUUID()}`,
    object: "chat.completion",
    created: Math.floor(Date.now() / 1000),
    model,
    choices: [
      {
        index: 0,
        message: { role: "assistant", content },
        finish_reason: "stop",
      },
    ],
  };
}
