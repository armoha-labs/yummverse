import multer from "multer";
import { ApiError } from "../utils/ApiError.js";

const ALLOWED_IMAGE_TYPES = new Set(["image/png", "image/jpeg", "image/svg+xml", "image/webp"]);
// §31A.1 specifies 2MB; reduced to 1MB since the logo is now stored as base64 directly on
// the tenant document (tenant.service.ts) — every branding API response carries the full
// image inline, so a smaller cap keeps that payload reasonable.
const MAX_IMAGE_BYTES = 1 * 1024 * 1024; // 1MB

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

const ALLOWED_SPREADSHEET_TYPES = new Set([
  "text/csv",
  "application/vnd.ms-excel", // some browsers/OSes report CSV as this
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", // .xlsx
]);
const MAX_SPREADSHEET_BYTES = 5 * 1024 * 1024; // 5MB — generous for a menu-sized CSV/XLSX

/** Menu bulk import (§29A's category/item list) — CSV or .xlsx, uploaded once and parsed
 * entirely in memory (no disk persistence needed, unlike a logo). */
export const spreadsheetUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_SPREADSHEET_BYTES },
  fileFilter: (_req, file, callback) => {
    if (!ALLOWED_SPREADSHEET_TYPES.has(file.mimetype)) {
      callback(ApiError.badRequest("UNSUPPORTED_FILE_TYPE", "Allowed types: CSV, XLSX."));
      return;
    }
    callback(null, true);
  },
});
