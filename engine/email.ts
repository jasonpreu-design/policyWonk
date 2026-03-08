import nodemailer from "nodemailer";

export async function sendEmail(
  to: string,
  subject: string,
  html: string,
): Promise<void> {
  const transport = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: parseInt(process.env.SMTP_PORT || "587"),
    secure: process.env.SMTP_SECURE === "true",
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS,
    },
  });

  await transport.sendMail({
    from: process.env.SMTP_FROM || "Wonk HQ <wonkhq@policywonk.local>",
    to,
    subject,
    html,
  });
}
