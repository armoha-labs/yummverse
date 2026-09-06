import { env } from "../config/env.js";
import { CloudinaryStorageProvider } from "./CloudinaryStorageProvider.js";
import { LocalDiskStorageProvider } from "./LocalDiskStorageProvider.js";
import type { StorageProvider } from "./StorageProvider.js";

let instance: StorageProvider | undefined;

export function getStorageProvider(): StorageProvider {
  if (instance) return instance;

  if (env.CLOUDINARY_CLOUD_NAME && env.CLOUDINARY_API_KEY && env.CLOUDINARY_API_SECRET) {
    instance = new CloudinaryStorageProvider({
      cloudName: env.CLOUDINARY_CLOUD_NAME,
      apiKey: env.CLOUDINARY_API_KEY,
      apiSecret: env.CLOUDINARY_API_SECRET,
    });
  } else {
    instance = new LocalDiskStorageProvider(env.BACKEND_PUBLIC_URL);
  }

  return instance;
}

export type { StorageProvider, UploadedFile, StoredAsset } from "./StorageProvider.js";
