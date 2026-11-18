import { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import fastifyJwt from "@fastify/jwt";
import fastifyCookie from "@fastify/cookie";
import crypto from "node:crypto";
import { db } from "../lib/db";

export interface AuthenticatedUser {
  id: string;
  email: string;
}

declare module "@fastify/jwt" {
  interface FastifyJWT {
    payload: AuthenticatedUser & { type?: string };
    user: AuthenticatedUser;
  }
}

declare module "fastify" {
  interface FastifyRequest {
    userPassword?: string;
  }
}

export function generateCsrfToken(): string {
  return crypto.randomBytes(24).toString("hex");
}

export async function setupAuthPlugins(server: FastifyInstance): Promise<void> {
  const jwtSecret = process.env.JWT_SECRET;
  if (process.env.NODE_ENV === "production" && (!jwtSecret || jwtSecret.length < 32)) {
    throw new Error("JWT_SECRET must be configured with at least 32 characters in production");
  }
  const signingSecret = jwtSecret || "local-development-only-jwt-secret-change-before-deploy-123456";

  await server.register(fastifyCookie, {
    secret: signingSecret,
    hook: "onRequest",
  });

  await server.register(fastifyJwt, {
    secret: signingSecret,
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

        const decoded = server.jwt.verify<AuthenticatedUser & { type?: string }>(token);
        if (decoded.type === "refresh") {
          return reply.code(401).send({ error: "Access token required" });
        }
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
      // These endpoints do not mutate an authenticated user's account state.
      if (["/api/auth/login", "/api/auth/register", "/api/verify/qr"].includes(request.routeOptions.url || "")) {
        return;
      }

      const authHeader = request.headers.authorization;
      if (authHeader && authHeader.startsWith("Bearer ")) return;

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
