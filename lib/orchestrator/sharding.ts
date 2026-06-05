import type { ShardAssignment, WorkerInfo } from "@/types";
import { resolveModel } from "@/lib/models";

/**
 * Partitions a model's transformer layers across a set of workers so that no
 * single node has to hold the whole model. Workers with more VRAM are given a
 * proportionally larger contiguous band of layers.
 *
 * This is a pipeline-parallel layout: layers [start, end) run on one node and
 * hand the residual stream to the node holding the next band.
 */
export function planShards(
  modelId: string,
  workers: WorkerInfo[]
): ShardAssignment[] | null {
  const model = resolveModel(modelId);
  if (!model || workers.length === 0) return null;

  const totalVram = workers.reduce((s, w) => s + w.vramMb, 0);
  if (totalVram < model.minVramMb) return null; // not enough aggregate VRAM

  const assignments: ShardAssignment[] = [];
  let cursor = 0;
  let remainingLayers = model.layers;

  workers.forEach((w, i) => {
    const isLast = i === workers.length - 1;
    const share = isLast
      ? remainingLayers
      : Math.max(1, Math.round((w.vramMb / totalVram) * model.layers));
    const layerEnd = Math.min(model.layers, cursor + share);
    assignments.push({ workerId: w.id, layerStart: cursor, layerEnd });
    remainingLayers -= layerEnd - cursor;
    cursor = layerEnd;
  });

  return assignments;
}
