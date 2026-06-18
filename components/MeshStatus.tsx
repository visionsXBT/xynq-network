"use client";

import { useEffect, useState } from "react";

interface Live {
  id: string;
  live_replicas: number;
}

/** Shows which models are currently live across the mesh. */
export function MeshStatus() {
  const [models, setModels] = useState<Live[]>([]);

  useEffect(() => {
    let active = true;
    const load = () =>
      fetch("/api/v1/models")
        .then((r) => r.json())
        .then((d) => active && setModels(d.data ?? []))
        .catch(() => {});
    load();
    const iv = setInterval(load, 15_000);
    return () => {
      active = false;
      clearInterval(iv);
    };
  }, []);

  return (
    <div style={{ marginBottom: 16, fontSize: 12, color: "#5b7468" }}>
      mesh:{" "}
      {models.length === 0
        ? "warming up…"
        : models.map((m) => `${m.id} ×${m.live_replicas}`).join("  ·  ")}
    </div>
  );
}
