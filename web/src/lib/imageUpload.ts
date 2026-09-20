// Mirrors backend/src/middleware/upload.middleware.ts's imageUpload multer config exactly —
// checking client-side first gives instant feedback instead of waiting on a round trip only
// to hit the server's own 1MB cap.
export const MAX_IMAGE_BYTES = 1 * 1024 * 1024;

const ALLOWED_TYPES = new Set(["image/png", "image/jpeg", "image/svg+xml", "image/webp"]);

/** Returns an error message if the file fails client-side checks, or null if it's fine to upload. */
export function validateImageFile(file: File): string | null {
  if (!ALLOWED_TYPES.has(file.type)) {
    return "Allowed types: PNG, JPG, SVG, WEBP.";
  }
  if (file.size > MAX_IMAGE_BYTES) {
    return `Image is too large (${(file.size / (1024 * 1024)).toFixed(1)}MB) — must be 1MB or smaller.`;
  }
  return null;
}
