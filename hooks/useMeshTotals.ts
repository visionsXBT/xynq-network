"use client";

import { useEffect, useState } from "react";

export interface MeshTotals {
  nodes: number;
  vramGb: number;
  tflops: number;
}

/** Polls aggregate mesh telemetry for the dashboard. */
export function useMeshTotals(intervalMs = 10_000): MeshTotals {
  const [totals, setTotals] = useState<MeshTotals>({ nodes: 0, vramGb: 0, tflops: 0 });

  useEffect(() => {
    let active = true;
    const load = () =>
      fetch("/api/mesh/totals")
        .then((r) => r.json())
        .then((d) => active && setTotals(d))
        .catch(() => {});
    load();
    const iv = setInterval(load, intervalMs);
    return () => {
      active = false;
      clearInterval(iv);
    };
  }, [intervalMs]);

  return totals;
}
