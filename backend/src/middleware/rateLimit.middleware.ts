import rateLimit from "express-rate-limit";
import { env } from "../config/env.js";

export const loginRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  // The integration test suite creates many tenants/staff per file, each logging in at least
  // once, from the same source IP against one shared (module-singleton) limiter instance —
  // a much higher ceiling in test avoids that legitimate traffic tripping a real brute-force
  // control that nothing here is actually exercising.
  limit: env.NODE_ENV === "test" ? 10_000 : 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    error: { code: "TOO_MANY_ATTEMPTS", message: "Too many login attempts. Please try again later." },
  },
});
