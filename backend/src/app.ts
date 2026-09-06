import express, { type Express } from "express";
import cors from "cors";
import helmet from "helmet";
import { pinoHttp } from "pino-http";
import { env } from "./config/env.js";
import { logger } from "./config/logger.js";
import { apiRouter } from "./routes/index.js";
import { errorHandler, notFoundHandler } from "./middleware/error.middleware.js";
import { UPLOADS_ROOT } from "./storage/LocalDiskStorageProvider.js";

export function createApp(): Express {
  const app = express();

  app.use(helmet());
  app.use(cors({ origin: env.FRONTEND_URL, credentials: true }));
  // Registered before the global json() parser below: webhook signature verification (§37)
  // needs the exact raw bytes Razorpay signed, not a re-serialized JSON.parse/stringify round trip.
  app.use("/api/v1/payments/webhook", express.raw({ type: "*/*" }));
  app.use(express.json());
  app.use(pinoHttp({ logger, autoLogging: env.NODE_ENV !== "test" }));

  // Serves local-disk-stored images (dev fallback, §54) — a no-op path in production once
  // CLOUDINARY_* env vars are set, since uploads never land on disk in that case.
  app.use("/uploads", express.static(UPLOADS_ROOT));

  app.use("/api/v1", apiRouter);

  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}
