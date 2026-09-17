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
  // maxAge caches the preflight (OPTIONS) response in the browser — every request carrying
  // an Authorization header (i.e. nearly every authenticated call this app makes) is a
  // non-simple request, so without this the browser re-sends a full preflight round trip
  // before EVERY such call once its (very short, ~5s) default cache expires, roughly
  // doubling perceived API latency in normal use. 86400s = 24h; browsers cap it to their own
  // maximum (Chrome: 2h) regardless, so there's no harm setting it higher than that cap.
  app.use(cors({ origin: env.FRONTEND_URL, credentials: true, maxAge: 86400 }));
  // Registered before the global json() parser below: webhook signature verification (§37)
  // needs the exact raw bytes Razorpay signed, not a re-serialized JSON.parse/stringify round trip.
  app.use("/api/v1/payments/webhook", express.raw({ type: "*/*" }));
  app.use(express.json());
  app.use(pinoHttp({ logger, autoLogging: env.NODE_ENV !== "test" }));

  // Serves local-disk-stored images (dev fallback, §54) — a no-op path in production once
  // CLOUDINARY_* env vars are set, since uploads never land on disk in that case.
  // Relaxes helmet()'s default Cross-Origin-Resource-Policy: same-origin, which otherwise
  // blocks the frontend (a different origin from the API, even in local dev) from loading
  // these images at all — branding logos are meant to be publicly embeddable, unlike the
  // JSON API responses same-origin is protecting.
  app.use(
    "/uploads",
    (_req, res, next) => {
      res.setHeader("Cross-Origin-Resource-Policy", "cross-origin");
      next();
    },
    express.static(UPLOADS_ROOT),
  );

  app.use("/api/v1", apiRouter);

  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}
