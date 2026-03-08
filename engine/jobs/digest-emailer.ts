import { log } from "../logger";
import { getEngineDb } from "../db";
import { generateDigest } from "./digest-generator";
import { renderDigestEmail } from "../email-template";
import { sendEmail } from "../email";

export async function runDigestEmailer(): Promise<void> {
  const toEmail = process.env.DIGEST_TO_EMAIL;
  if (!toEmail) {
    log("warn", "Digest emailer: DIGEST_TO_EMAIL not set, skipping");
    return;
  }

  const db = getEngineDb();
  const digest = generateDigest(db);
  const html = renderDigestEmail(digest);
  const subject = `Wonk HQ Briefing — ${digest.date}`;

  await sendEmail(toEmail, subject, html);
  log("info", "Digest emailer: sent daily digest", { to: toEmail });
}
