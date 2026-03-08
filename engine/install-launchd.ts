import { $ } from "bun";
import { writeFileSync, mkdirSync, existsSync } from "fs";
import { join } from "path";
import { homedir } from "os";

const PROJECT_ROOT = join(import.meta.dir, "..");
const LAUNCH_AGENTS = join(homedir(), "Library", "LaunchAgents");
const LOG_DIR = join(homedir(), "Library", "Logs", "PolicyWonk");

const BUN_PATH = process.env.HOME
  ? join(process.env.HOME, ".bun", "bin", "bun")
  : "/usr/local/bin/bun";

function generatePlist(
  label: string,
  script: string,
  logPrefix: string
): string {
  return `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>Label</key>
  <string>${label}</string>
  <key>ProgramArguments</key>
  <array>
    <string>${BUN_PATH}</string>
    <string>run</string>
    <string>${script}</string>
  </array>
  <key>WorkingDirectory</key>
  <string>${PROJECT_ROOT}</string>
  <key>RunAtLoad</key>
  <true/>
  <key>KeepAlive</key>
  <true/>
  <key>StandardOutPath</key>
  <string>${join(LOG_DIR, `${logPrefix}-stdout.log`)}</string>
  <key>StandardErrorPath</key>
  <string>${join(LOG_DIR, `${logPrefix}-stderr.log`)}</string>
  <key>EnvironmentVariables</key>
  <dict>
    <key>PATH</key>
    <string>${process.env.HOME}/.bun/bin:/usr/local/bin:/usr/bin:/bin</string>
  </dict>
</dict>
</plist>`;
}

const services = [
  {
    label: "com.policywonk.web",
    script: "start",
    logPrefix: "web",
    description: "Wonk HQ Web Server",
  },
  {
    label: "com.policywonk.engine",
    script: "engine",
    logPrefix: "engine",
    description: "Wonk HQ Background Engine",
  },
];

async function install() {
  console.log("\nInstalling PolicyWonk LaunchD services...\n");

  // Create log directory
  if (!existsSync(LOG_DIR)) {
    mkdirSync(LOG_DIR, { recursive: true });
    console.log(`  Created log directory: ${LOG_DIR}`);
  }

  // Create LaunchAgents directory if needed
  if (!existsSync(LAUNCH_AGENTS)) {
    mkdirSync(LAUNCH_AGENTS, { recursive: true });
  }

  for (const service of services) {
    const plistContent = generatePlist(
      service.label,
      service.script,
      service.logPrefix
    );
    const plistPath = join(LAUNCH_AGENTS, `${service.label}.plist`);

    // Unload if already loaded (ignore errors)
    try {
      await $`launchctl unload ${plistPath} 2>/dev/null`.quiet();
    } catch {
      // Not loaded, that's fine
    }

    writeFileSync(plistPath, plistContent);
    console.log(`  Wrote ${plistPath}`);

    await $`launchctl load ${plistPath}`;
    console.log(`  Loaded ${service.description}`);
  }

  console.log("\nPolicyWonk services installed and running.");
  console.log(`Logs: ${LOG_DIR}`);
  console.log("\nTo check status:");
  console.log("  launchctl list | grep policywonk");
  console.log("\nTo uninstall:");
  console.log("  bun run engine/uninstall-launchd.ts\n");
}

install().catch((err) => {
  console.error("Failed to install LaunchD services:", err);
  process.exit(1);
});
