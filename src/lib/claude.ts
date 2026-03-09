import { spawn } from "child_process";
import { existsSync } from "fs";

export interface ClaudeResponse {
  content: string;
  error?: string;
}

export async function askClaude(
  prompt: string,
  options: {
    systemPrompt?: string;
    maxTokens?: number;
    timeoutMs?: number;
  } = {}
): Promise<ClaudeResponse> {
  const { systemPrompt, timeoutMs = 120_000 } = options;

  const args = ["--print"];
  if (systemPrompt) {
    args.push("--system-prompt", systemPrompt);
  }
  args.push(prompt);

  return new Promise((resolve, reject) => {
    const env = { ...process.env };
    delete env.CLAUDECODE;

    // Find claude binary — execFile doesn't use shell so we need the path
    const home = env.HOME || "/Users/jasonpreu";
    const claudePaths = [
      `${home}/.local/bin/claude`,
      `${home}/.claude/local/claude`,
      "/usr/local/bin/claude",
    ];
    const claudeBin = claudePaths.find(p => existsSync(p)) || "claude";

    const proc = spawn(claudeBin, args, {
      timeout: timeoutMs,
      env,
    });
    proc.stdin.end();

    let stdout = "";
    let stderr = "";

    proc.stdout?.on("data", (data: Buffer) => {
      stdout += data.toString();
    });
    proc.stderr?.on("data", (data: Buffer) => {
      stderr += data.toString();
    });

    proc.on("close", (code: number | null) => {
      if (code === 0) {
        resolve({ content: stdout.trim() });
      } else {
        resolve({
          content: stdout.trim(),
          error: stderr.trim() || `Exit code ${code}`,
        });
      }
    });

    proc.on("error", (err: Error) => {
      reject(new Error(`Failed to spawn claude: ${err.message}`));
    });
  });
}

export async function askClaudeJson<T>(
  prompt: string,
  options: Parameters<typeof askClaude>[1] = {}
): Promise<{ data: T | null; error?: string }> {
  const response = await askClaude(prompt, options);
  if (response.error) {
    return { data: null, error: response.error };
  }
  try {
    const data = extractJson<T>(response.content);
    return { data };
  } catch (e) {
    return {
      data: null,
      error: `Failed to parse JSON: ${(e as Error).message}\nRaw: ${response.content.slice(0, 500)}`,
    };
  }
}

/** Extract JSON from a string that may be wrapped in markdown code blocks */
export function extractJson<T>(raw: string): T {
  let jsonStr = raw;
  const jsonMatch = jsonStr.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (jsonMatch) {
    jsonStr = jsonMatch[1].trim();
  }
  return JSON.parse(jsonStr) as T;
}
