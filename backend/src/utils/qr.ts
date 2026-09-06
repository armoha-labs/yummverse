import QRCode from "qrcode";
import { env } from "../config/env.js";

/** §21's QR URL pattern — never the raw Mongo _id. */
export function buildTableQrUrl(qrToken: string): string {
  return `${env.FRONTEND_URL}/t/${qrToken}`;
}

export function generateQrPng(qrToken: string): Promise<Buffer> {
  return QRCode.toBuffer(buildTableQrUrl(qrToken), { type: "png", width: 512, margin: 2 });
}
