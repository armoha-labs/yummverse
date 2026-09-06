import multer from "multer";
import { ApiError } from "../utils/ApiError.js";

const ALLOWED_IMAGE_TYPES = new Set(["image/png", "image/jpeg", "image/svg+xml", "image/webp"]);
const MAX_IMAGE_BYTES = 2 * 1024 * 1024; // 2MB, §31A.1

/** Server-side enforcement of §31A.2's validation rules — never trust client-side checks alone. */
export const imageUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_IMAGE_BYTES },
  fileFilter: (_req, file, callback) => {
    if (!ALLOWED_IMAGE_TYPES.has(file.mimetype)) {
      callback(ApiError.badRequest("UNSUPPORTED_FILE_TYPE", "Allowed types: PNG, JPG, SVG, WEBP."));
      return;
    }
    callback(null, true);
  },
});
