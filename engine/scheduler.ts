import { log } from "./logger";
import { runBillMonitor } from "./jobs/bill-monitor";
import { runNewsScanner } from "./jobs/news-scanner";
import { runContentGenerator } from "./jobs/content-generator";
import { runCurriculumScheduler } from "./jobs/curriculum-scheduler";
import { runDigestEmailer } from "./jobs/digest-emailer";
import { getEngineDb } from "./db";

interface ScheduledJob {
  name: string;
  intervalMs: number;
  run: () => Promise<void>;
  lastRun?: Date;
  running: boolean;
}

const jobs: ScheduledJob[] = [];
const intervals: Timer[] = [];

export function registerJob(
  name: string,
  intervalMs: number,
  run: () => Promise<void>,
): void {
  jobs.push({ name, intervalMs, run, running: false });
}

function hasRunToday(jobName: string): boolean {
  const db = getEngineDb();
  const row = db
    .prepare(
      "SELECT value FROM app_state WHERE key = ?",
    )
    .get(`last_run:${jobName}`) as { value: string } | undefined;

  if (!row) return false;

  const lastRun = new Date(row.value);
  const now = new Date();
  return (
    lastRun.getFullYear() === now.getFullYear() &&
    lastRun.getMonth() === now.getMonth() &&
    lastRun.getDate() === now.getDate()
  );
}

function recordRun(jobName: string): void {
  const db = getEngineDb();
  db.prepare(
    `INSERT INTO app_state (key, value) VALUES (?, ?)
     ON CONFLICT(key) DO UPDATE SET value = excluded.value`,
  ).run(`last_run:${jobName}`, new Date().toISOString());
}

const DAILY_MS = 24 * 60 * 60 * 1000;

export function startScheduler(): void {
  // Register all jobs
  registerJob(
    "bill-monitor",
    Number(process.env.BILL_MONITOR_INTERVAL_MS) || 3 * 60 * 60 * 1000,
    runBillMonitor,
  );
  registerJob(
    "news-scanner",
    Number(process.env.NEWS_SCANNER_INTERVAL_MS) || 3 * 60 * 60 * 1000,
    runNewsScanner,
  );
  registerJob(
    "content-generator",
    Number(process.env.CONTENT_GENERATOR_INTERVAL_MS) || DAILY_MS,
    runContentGenerator,
  );
  registerJob(
    "curriculum-scheduler",
    Number(process.env.CURRICULUM_SCHEDULER_INTERVAL_MS) || DAILY_MS,
    runCurriculumScheduler,
  );
  registerJob(
    "digest-emailer",
    Number(process.env.DIGEST_EMAILER_INTERVAL_MS) || DAILY_MS,
    runDigestEmailer,
  );

  for (const job of jobs) {
    log("info", `Scheduling job: ${job.name}`, {
      intervalMs: job.intervalMs,
    });

    // Run immediately on startup (unless already ran today for daily jobs)
    (async () => {
      if (job.intervalMs >= DAILY_MS && hasRunToday(job.name)) {
        log("debug", `Skipping initial run of ${job.name}: already ran today`);
        return;
      }
      job.running = true;
      log("info", `Job initial run: ${job.name}`);
      const start = Date.now();
      try {
        await job.run();
        const durationMs = Date.now() - start;
        job.lastRun = new Date();
        recordRun(job.name);
        log("info", `Job initial run completed: ${job.name}`, { durationMs });
      } catch (err) {
        log("error", `Job initial run failed: ${job.name}`, {
          error: err instanceof Error ? err.message : String(err),
        });
      } finally {
        job.running = false;
      }
    })();

    const interval = setInterval(async () => {
      if (job.running) {
        log("warn", `Skipping ${job.name}: still running from previous invocation`);
        return;
      }

      // For daily jobs, check if already run today
      if (job.intervalMs >= DAILY_MS && hasRunToday(job.name)) {
        log("debug", `Skipping ${job.name}: already ran today`);
        return;
      }

      job.running = true;
      log("info", `Job started: ${job.name}`);
      const start = Date.now();

      try {
        await job.run();
        const durationMs = Date.now() - start;
        job.lastRun = new Date();
        recordRun(job.name);
        log("info", `Job completed: ${job.name}`, { durationMs });
      } catch (err) {
        const durationMs = Date.now() - start;
        log("error", `Job failed: ${job.name}`, {
          durationMs,
          error: err instanceof Error ? err.message : String(err),
        });
      } finally {
        job.running = false;
      }
    }, job.intervalMs);

    intervals.push(interval);
  }

  log("info", `Scheduler started with ${jobs.length} jobs`);
}

export function stopScheduler(): void {
  for (const interval of intervals) {
    clearInterval(interval);
  }
  intervals.length = 0;
  jobs.length = 0;
  log("info", "Scheduler stopped");
}
