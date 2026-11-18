import Fastify, { FastifyInstance } from "fastify";
import fastifyCors from "@fastify/cors";
import fastifyRateLimit from "@fastify/rate-limit";
import { setupAuthPlugins } from "./plugins/auth.plugin";
import { authRoutes } from "./routes/auth.routes";
import { eventRoutes } from "./routes/event.routes";
import { ticketRoutes } from "./routes/ticket.routes";
import { transferRoutes } from "./routes/transfer.routes";
import { verifyRoutes } from "./routes/verify.routes";

export async function buildServer(): Promise<FastifyInstance> {
  const server = Fastify({
    logger: process.env.NODE_ENV === "test" ? false : true,
  });

  const configuredOrigins = (process.env.CORS_ORIGINS || "")
    .split(",")
    .map((origin) => origin.trim())
    .filter(Boolean);
  if (process.env.NODE_ENV === "production" && configuredOrigins.length === 0) {
    throw new Error("CORS_ORIGINS must contain at least one allowed origin in production");
  }
  const allowedOrigins = new Set(
    configuredOrigins.length
      ? configuredOrigins
      : ["http://localhost:5173", "http://127.0.0.1:5173", "http://localhost:4173"]
  );

  await server.register(fastifyCors, {
    origin: (origin, callback) => {
      if (!origin || allowedOrigins.has(origin)) {
        callback(null, true);
      } else {
        callback(new Error("Origin not allowed"), false);
      }
    },
    credentials: true,
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization", "X-CSRF-Token", "X-XSRF-Token"],
  });

  await server.register(fastifyRateLimit, {
    max: 100,
    timeWindow: "1 minute",
  });

  await setupAuthPlugins(server);
  if (process.env.NODE_ENV !== "test") {
    server.addHook("preHandler", (request, reply) =>
      (server as any).verifyCsrf(request, reply)
    );
  }

  await server.register(authRoutes);
  await server.register(eventRoutes);
  await server.register(ticketRoutes);
  await server.register(transferRoutes);
  await server.register(verifyRoutes);

  server.get("/api/health", async () => {
    return { status: "ok", timestamp: new Date().toISOString() };
  });

  return server;
}
