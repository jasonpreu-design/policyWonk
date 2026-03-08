import { startScheduler } from "./scheduler";
import { initEngineDb } from "./db";
import { log } from "./logger";

async function main() {
  log("info", "PolicyWonk Background Engine starting...");
  initEngineDb();
  startScheduler();
  log("info", "Background Engine running. Press Ctrl+C to stop.");
}

main().catch((err) => {
  log("error", "Engine failed to start", {
    error: err instanceof Error ? err.message : String(err),
  });
  process.exit(1);
});
