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

  await server.register(fastifyCors, {
    origin: (origin, callback) => {
      callback(null, true);
    },
    credentials: true,
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
  });

  await server.register(fastifyRateLimit, {
    max: 100,
    timeWindow: "1 minute",
  });

  await setupAuthPlugins(server);

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
