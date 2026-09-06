export interface UploadedFile {
  buffer: Buffer;
  mimeType: string;
  originalName: string;
}

export interface StoredAsset {
  assetId: string;
  url: string;
}

/**
 * Storage is behind an interface so tenant branding/menu image uploads (§31A.2, §29A.2) don't
 * couple to one vendor. `key` is the logical path, e.g. `tenants/{tenantId}/branding/{imageId}`.
 */
export interface StorageProvider {
  upload(key: string, file: UploadedFile): Promise<StoredAsset>;
  delete(assetId: string): Promise<void>;
}
