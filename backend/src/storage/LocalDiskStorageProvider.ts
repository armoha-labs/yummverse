import fs from "node:fs/promises";
import path from "node:path";
import crypto from "node:crypto";
import type { StorageProvider, StoredAsset, UploadedFile } from "./StorageProvider.js";

const UPLOADS_ROOT = path.resolve(process.cwd(), "uploads");

/** Dev/test fallback when no cloud storage credentials are configured (§54). */
export class LocalDiskStorageProvider implements StorageProvider {
  constructor(private readonly publicBaseUrl: string) {}

  async upload(key: string, file: UploadedFile): Promise<StoredAsset> {
    const ext = path.extname(file.originalName) || "";
    const assetId = `${key}/${crypto.randomUUID()}${ext}`;
    const destination = path.join(UPLOADS_ROOT, assetId);

    await fs.mkdir(path.dirname(destination), { recursive: true });
    await fs.writeFile(destination, file.buffer);

    return { assetId, url: `${this.publicBaseUrl}/uploads/${assetId}` };
  }

  async delete(assetId: string): Promise<void> {
    const target = path.join(UPLOADS_ROOT, assetId);
    await fs.rm(target, { force: true });
  }
}

export { UPLOADS_ROOT };
