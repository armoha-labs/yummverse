import type { Server as HttpServer } from "node:http";
import { Server, type Socket } from "socket.io";
import { env } from "../config/env.js";
import { logger } from "../config/logger.js";
import { verifyAccessToken } from "../utils/jwt.js";
import { customerSessionService } from "../services/customerSession.service.js";
import { rooms } from "./rooms.js";

let io: Server | undefined;

export function getIo(): Server | undefined {
  return io;
}

async function authenticateSocket(socket: Socket): Promise<void> {
  const auth = socket.handshake.auth as { type?: "staff" | "customer"; token?: string };

  if (auth.type === "staff" && auth.token) {
    const payload = verifyAccessToken(auth.token); // throws on invalid/expired — caught by caller
    if (payload.role === "TENANT_ADMIN") {
      await socket.join(rooms.tenantAdmin(payload.tenantId));
    } else if (payload.role === "KITCHEN") {
      await socket.join(rooms.kitchen(payload.tenantId, payload.branchId));
    } else if (payload.role === "WAITER") {
      await socket.join(rooms.waiters(payload.tenantId, payload.branchId));
    }
    return;
  }

  if (auth.type === "customer" && auth.token) {
    const session = await customerSessionService.resolveActiveSession(auth.token);
    await socket.join(rooms.customer(session._id.toString()));
    return;
  }

  throw new Error("Missing or invalid socket auth");
}

export function initSocketServer(httpServer: HttpServer): Server {
  io = new Server(httpServer, {
    cors: { origin: env.FRONTEND_URL, credentials: true },
  });

  io.on("connection", (socket) => {
    authenticateSocket(socket)
      .then(() => {
        socket.emit("connected", { ok: true });
      })
      .catch((err: unknown) => {
        logger.warn({ err }, "Socket authentication failed");
        socket.emit("connect_error", { message: "Authentication failed" });
        socket.disconnect(true);
      });
  });

  return io;
}
