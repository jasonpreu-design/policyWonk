import { $ } from "bun";
import { unlinkSync, existsSync } from "fs";
import { join } from "path";
import { homedir } from "os";

const LAUNCH_AGENTS = join(homedir(), "Library", "LaunchAgents");

const services = [
  { label: "com.policywonk.web", description: "Wonk HQ Web Server" },
  { label: "com.policywonk.engine", description: "Wonk HQ Background Engine" },
];

async function uninstall() {
  console.log("\nUninstalling PolicyWonk LaunchD services...\n");

  for (const service of services) {
    const plistPath = join(LAUNCH_AGENTS, `${service.label}.plist`);

    if (!existsSync(plistPath)) {
      console.log(`  ${service.description}: not installed, skipping`);
      continue;
    }

    // Unload the service
    try {
      await $`launchctl unload ${plistPath}`.quiet();
      console.log(`  Unloaded ${service.description}`);
    } catch {
      console.log(`  ${service.description}: was not loaded`);
    }

    // Remove the plist file
    unlinkSync(plistPath);
    console.log(`  Removed ${plistPath}`);
  }

  console.log("\nPolicyWonk services uninstalled.");
  console.log("Note: Log files remain at ~/Library/Logs/PolicyWonk/\n");
}

uninstall().catch((err) => {
  console.error("Failed to uninstall LaunchD services:", err);
  process.exit(1);
});
