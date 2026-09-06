import { v2 as cloudinary } from "cloudinary";
import type { StorageProvider, StoredAsset, UploadedFile } from "./StorageProvider.js";

export class CloudinaryStorageProvider implements StorageProvider {
  constructor(config: { cloudName: string; apiKey: string; apiSecret: string }) {
    cloudinary.config({
      cloud_name: config.cloudName,
      api_key: config.apiKey,
      api_secret: config.apiSecret,
      secure: true,
    });
  }

  upload(key: string, file: UploadedFile): Promise<StoredAsset> {
    return new Promise((resolve, reject) => {
      const stream = cloudinary.uploader.upload_stream(
        { public_id: key, resource_type: "image", overwrite: true },
        (error, result) => {
          if (error || !result) {
            reject(error ?? new Error("Cloudinary upload failed with no result."));
            return;
          }
          resolve({ assetId: result.public_id, url: result.secure_url });
        },
      );
      stream.end(file.buffer);
    });
  }

  async delete(assetId: string): Promise<void> {
    await cloudinary.uploader.destroy(assetId);
  }
}
