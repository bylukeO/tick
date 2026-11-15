import { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import fastifyJwt from "@fastify/jwt";
import fastifyCookie from "@fastify/cookie";
import crypto from "node:crypto";
import { db } from "../lib/db";

export interface AuthenticatedUser {
  id: string;
  email: string;
}

declare module "fastify" {
  interface FastifyRequest {
    user?: AuthenticatedUser;
    userPassword?: string;
  }
}

export function generateCsrfToken(): string {
  return crypto.randomBytes(24).toString("hex");
}

export async function setupAuthPlugins(server: FastifyInstance): Promise<void> {
  const jwtSecret = process.env.JWT_SECRET || "fallback_super_secret_jwt_key_at_least_32_bytes_long_123456";

  await server.register(fastifyCookie, {
    secret: jwtSecret,
    hook: "onRequest",
  });

  await server.register(fastifyJwt, {
    secret: jwtSecret,
    cookie: {
      cookieName: "access_token",
      signed: false,
    },
  });

  server.decorate(
    "authenticate",
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        const authHeader = request.headers.authorization;
        let token: string | undefined;

        if (authHeader && authHeader.startsWith("Bearer ")) {
          token = authHeader.substring(7);
        } else if (request.cookies.access_token) {
          token = request.cookies.access_token;
        }

        if (!token) {
          return reply.code(401).send({ error: "Authentication required" });
        }

        const decoded = server.jwt.verify<AuthenticatedUser>(token);
        const user = await db.user.findUnique({ where: { id: decoded.id } });

        if (!user) {
          return reply.code(401).send({ error: "User session invalid" });
        }

        request.user = { id: user.id, email: user.email };
      } catch {
        return reply.code(401).send({ error: "Invalid or expired token" });
      }
    }
  );

  server.decorate(
    "verifyCsrf",
    async (request: FastifyRequest, reply: FastifyReply) => {
      const isMutatingMethod = ["POST", "PUT", "PATCH", "DELETE"].includes(request.method);
      if (!isMutatingMethod) return;

      const authHeader = request.headers.authorization;
      if (authHeader && authHeader.startsWith("Bearer ")) {
        return;
      }

      const cookieCsrf = request.cookies.csrf_token;
      const headerCsrf =
        request.headers["x-csrf-token"] ||
        request.headers["x-xsrf-token"] ||
        (request.body as any)?._csrf;

      if (!cookieCsrf || !headerCsrf || cookieCsrf !== headerCsrf) {
        return reply.code(403).send({ error: "CSRF token mismatch or missing" });
      }
    }
  );
}
