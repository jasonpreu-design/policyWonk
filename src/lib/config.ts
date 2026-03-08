export interface Config {
  dbPath: string;
  congressApiKey: string | null;
  digestEmail: string | null;
  smtp: {
    host: string | null;
    port: number;
    secure: boolean;
    user: string | null;
    pass: string | null;
    from: string;
  };
  port: number;
}

export function getConfig(): Config {
  return {
    dbPath: process.env.POLICYWONK_DB_PATH ?? "./data/policywonk.db",
    congressApiKey: process.env.CONGRESS_API_KEY || null,
    digestEmail: process.env.DIGEST_TO_EMAIL || null,
    smtp: {
      host: process.env.SMTP_HOST || null,
      port: parseInt(process.env.SMTP_PORT || "587"),
      secure: process.env.SMTP_SECURE === "true",
      user: process.env.SMTP_USER || null,
      pass: process.env.SMTP_PASS || null,
      from: process.env.SMTP_FROM || "Wonk HQ <wonkhq@policywonk.local>",
    },
    port: parseInt(process.env.PORT || "3000"),
  };
}

// Validate that required config for a feature is present
export function validateConfig(feature: "digest" | "bills" | "all"): string[] {
  const config = getConfig();
  const errors: string[] = [];

  if (feature === "digest" || feature === "all") {
    if (!config.digestEmail) errors.push("DIGEST_TO_EMAIL is required for daily digest");
    if (!config.smtp.host) errors.push("SMTP_HOST is required for daily digest");
    if (!config.smtp.user) errors.push("SMTP_USER is required for daily digest");
    if (!config.smtp.pass) errors.push("SMTP_PASS is required for daily digest");
  }

  if (feature === "bills" || feature === "all") {
    if (!config.congressApiKey) errors.push("CONGRESS_API_KEY is required for bill monitoring (get one free at https://api.congress.gov/sign-up/)");
  }

  return errors;
}
