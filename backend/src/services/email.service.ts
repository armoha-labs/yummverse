import { env } from "../config/env.js";
import { logger } from "../config/logger.js";

export interface EmailMessage {
  to: string;
  subject: string;
  text: string;
  html?: string;
  attachments?: { filename: string; content: Buffer; contentType?: string }[];
}

let transporter: import("nodemailer").Transporter | undefined;

async function getTransporter() {
  if (!env.SMTP_HOST) return null; // not configured — caller logs instead (§54's optional pair)
  if (!transporter) {
    const nodemailer = await import("nodemailer");
    transporter = nodemailer.createTransport({
      host: env.SMTP_HOST,
      port: env.SMTP_PORT,
      secure: env.SMTP_SECURE,
      auth: env.SMTP_USER ? { user: env.SMTP_USER, pass: env.SMTP_PASS } : undefined,
    });
  }
  return transporter;
}

export const emailService = {
  /** Never throws — a broken SMTP config degrades to logging instead of blocking whatever
   * invite/notification flow triggered the send. */
  async send(message: EmailMessage): Promise<boolean> {
    const t = await getTransporter();
    if (!t) {
      logger.info({ to: message.to, subject: message.subject }, "Email (SMTP not configured — logging only)");
      return false;
    }
    try {
      await t.sendMail({ from: env.EMAIL_FROM || env.SMTP_USER, ...message });
      return true;
    } catch (err) {
      logger.warn({ err, to: message.to }, "Failed to send email");
      return false;
    }
  },
};
