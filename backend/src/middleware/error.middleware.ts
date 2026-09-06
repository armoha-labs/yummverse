import type { NextFunction, Request, Response } from "express";
import { ZodError } from "zod";
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

  logger.error({ err }, "Unhandled error");
  sendError(res, 500, "INTERNAL_ERROR", "Something went wrong. Please try again.");
}

export function notFoundHandler(req: Request, res: Response): void {
  sendError(res, 404, "NOT_FOUND", `No route matches ${req.method} ${req.path}.`);
}
