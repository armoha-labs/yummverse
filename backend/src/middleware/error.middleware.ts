import type { NextFunction, Request, Response } from "express";
import { ZodError } from "zod";
import { MulterError } from "multer";
import { ApiError } from "../utils/ApiError.js";
import { sendError } from "../utils/apiResponse.js";
import { logger } from "../config/logger.js";

export function errorHandler(
  err: unknown,
  _req: Request,
  res: Response,
  _next: NextFunction,
): void {
  if (err instanceof ApiError) {
    sendError(res, err.status, err.code, err.message);
    return;
  }

  if (err instanceof ZodError) {
    sendError(res, 400, "VALIDATION_ERROR", err.issues.map((i) => i.message).join(", "));
    return;
  }

  // A rejected upload (too large, too many files, etc.) is a client error, not a server
  // fault — was previously falling through to the generic 500 below.
  if (err instanceof MulterError) {
    const message = err.code === "LIMIT_FILE_SIZE" ? "File is too large." : err.message;
    sendError(res, 400, `UPLOAD_${err.code}`, message);
    return;
  }

  logger.error({ err }, "Unhandled error");
  sendError(res, 500, "INTERNAL_ERROR", "Something went wrong. Please try again.");
}

export function notFoundHandler(req: Request, res: Response): void {
  sendError(res, 404, "NOT_FOUND", `No route matches ${req.method} ${req.path}.`);
}
