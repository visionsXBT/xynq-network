// Memory-safe production build wrapper: caps the Next.js build heap so it runs
// inside constrained CI/containers, then runs `next build`.
import { execSync } from "node:child_process";

const MAX_OLD_SPACE = process.env.BUILD_MAX_OLD_SPACE_MB ?? "4096";

try {
  execSync("next build", {
    stdio: "inherit",
    env: { ...process.env, NODE_OPTIONS: `--max-old-space-size=${MAX_OLD_SPACE}` },
  });
} catch (err) {
  console.error("[build] failed");
  process.exit(typeof err?.status === "number" ? err.status : 1);
}
