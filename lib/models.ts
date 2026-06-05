// Model catalog and routing aliases.

export interface ModelDef {
  id: string;
  aliases: string[];
  layers: number; // used by the sharding planner
  minVramMb: number;
}

export const MODELS: ModelDef[] = [
  { id: "jaguar", aliases: ["xynq", "default", "jaguar"], layers: 40, minVramMb: 8000 },
  { id: "qwen-3.5-27b", aliases: ["qwen", "qwen-3.5-27b"], layers: 64, minVramMb: 16000 },
  { id: "supergemma-4-26b", aliases: ["supergemma", "supergemma-4-26b"], layers: 62, minVramMb: 16000 },
];

export function resolveModel(nameOrAlias: string): ModelDef | undefined {
  const q = nameOrAlias.toLowerCase();
  return MODELS.find((m) => m.id === q || m.aliases.includes(q));
}

export interface LiveModel {
  id: string;
  replicas: number;
  since: number;
}

/**
 * Reflects which models currently have enough healthy shard coverage to serve.
 * In production this is derived from the live worker table; here it reads the
 * orchestrator's in-memory registry.
 */
export async function listLiveModels(): Promise<LiveModel[]> {
  const { getRegistry } = await import("./orchestrator");
  const reg = getRegistry();
  return MODELS.map((m) => ({
    id: m.id,
    replicas: reg.replicaCount(m.id),
    since: reg.firstSeen(m.id),
  })).filter((m) => m.replicas > 0);
}
